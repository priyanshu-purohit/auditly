import { canExtract, groqApiKey, groqModel } from "@/lib/env";
import {
  EXTRACTION_SYSTEM_PROMPT,
  buildExtractionUserMessage,
} from "@/lib/extract-prompt";
import type { ExtractedRecord, ExtractResponse, ProductUnit, TransactionType } from "@/lib/types";

const GROQ_CHAT_URL = "https://api.groq.com/openai/v1/chat/completions";

const MAX_TRANSCRIPT_CHARS = 1000;
/** A single voice note should never produce more than this many records. */
const MAX_RECORDS = 12;

const TYPES: TransactionType[] = ["sale", "purchase", "expense"];
const UNITS: ProductUnit[] = ["kg", "litre", "piece", "packet"];

function fail(status: number, message: string) {
  return Response.json({ error: message }, { status });
}

export async function POST(request: Request) {
  let transcript: string;
  try {
    const body: unknown = await request.json();
    const value =
      typeof body === "object" && body !== null
        ? (body as Record<string, unknown>).transcript
        : undefined;
    if (typeof value !== "string" || value.trim() === "") {
      return fail(400, "Transcript nahi mila.");
    }
    transcript = value.trim().slice(0, MAX_TRANSCRIPT_CHARS);
  } catch {
    return fail(400, "Request padhi nahi ja saki.");
  }

  // No key: hand back nothing and let the shopkeeper type the rows himself.
  if (!canExtract()) {
    console.log("[extract] skipped — GROQ_API_KEY is empty in .env.local");
    const body: ExtractResponse = { records: [], extracted: false };
    return Response.json(body);
  }

  let upstream: Response;
  try {
    upstream = await fetch(GROQ_CHAT_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${groqApiKey()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: groqModel(),
        temperature: 0,
        // Ask for JSON at the API level, not just in the prompt.
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: EXTRACTION_SYSTEM_PROMPT },
          { role: "user", content: buildExtractionUserMessage(transcript) },
        ],
      }),
    });
  } catch {
    return fail(502, "AI tak pahunch nahi paye. Internet check karein.");
  }

  if (!upstream.ok) {
    const detail = await upstream.text().catch(() => "");
    console.error(`[extract] Groq ${upstream.status}: ${detail.slice(0, 500)}`);
    if (upstream.status === 401) return fail(502, "Groq key galat hai.");
    if (upstream.status === 429) return fail(502, "Groq ki limit lag gayi. Thodi der baad.");
    return fail(502, "AI se jawab nahi mila.");
  }

  let content: string | null;
  try {
    const payload: unknown = await upstream.json();
    content = readMessageContent(payload);
  } catch {
    return fail(502, "AI ka jawab samajh nahi aaya.");
  }

  if (content === null) {
    console.error("[extract] no message content in Groq response");
    const body: ExtractResponse = { records: [], extracted: false };
    return Response.json(body);
  }

  // Validate instead of trusting. A bad shape degrades to manual entry
  // rather than throwing the shopkeeper into an error screen.
  const records = parseRecords(content);
  if (records === null) {
    console.error(`[extract] could not parse: ${content.slice(0, 300)}`);
    const body: ExtractResponse = { records: [], extracted: false };
    return Response.json(body);
  }

  const body: ExtractResponse = { records, extracted: true };
  return Response.json(body);
}

/** Digs choices[0].message.content out of an OpenAI-shaped response. */
function readMessageContent(payload: unknown): string | null {
  if (typeof payload !== "object" || payload === null) return null;
  const choices = (payload as Record<string, unknown>).choices;
  if (!Array.isArray(choices) || choices.length === 0) return null;

  const first = choices[0];
  if (typeof first !== "object" || first === null) return null;
  const message = (first as Record<string, unknown>).message;
  if (typeof message !== "object" || message === null) return null;

  const content = (message as Record<string, unknown>).content;
  return typeof content === "string" ? content : null;
}

/**
 * Turns the model's text into records we trust, or null if it is unusable.
 *
 * Small mistakes are repaired (a number instead of a string, an unknown unit)
 * because re-asking the model costs the shopkeeper time. Anything we cannot
 * make sense of is dropped.
 */
function parseRecords(content: string): ExtractedRecord[] | null {
  const json = extractJsonObject(content);
  if (json === null) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return null;
  }

  if (typeof parsed !== "object" || parsed === null) return null;
  const rawRecords = (parsed as Record<string, unknown>).records;
  if (!Array.isArray(rawRecords)) return null;

  const records: ExtractedRecord[] = [];
  for (const raw of rawRecords.slice(0, MAX_RECORDS)) {
    const record = coerceRecord(raw, records.length);
    if (record !== null) records.push(record);
  }
  return records;
}

/** Models sometimes wrap JSON in prose or a code fence; take the object. */
function extractJsonObject(content: string): string | null {
  const trimmed = content.trim();
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;
  return trimmed.slice(start, end + 1);
}

function coerceRecord(raw: unknown, index: number): ExtractedRecord | null {
  if (typeof raw !== "object" || raw === null) return null;
  const fields = raw as Record<string, unknown>;

  const type = TYPES.find((candidate) => candidate === fields.type);
  if (type === undefined) return null;

  const productName = asText(fields.productName).trim();
  if (productName === "") return null;

  const amountRupees = asText(fields.amountRupees).replace(/[^\d.]/g, "");
  if (amountRupees === "" || Number.parseFloat(amountRupees) <= 0) return null;

  const unit = UNITS.find((candidate) => candidate === fields.unit) ?? "piece";
  const quantity =
    type === "expense" ? "" : asText(fields.quantity).replace(/[^\d.]/g, "");

  return {
    id: `ai_${index + 1}`,
    type,
    productName,
    quantity,
    unit,
    amountRupees,
  };
}

/** Accepts a string or a number; anything else becomes "". */
function asText(value: unknown): string {
  if (typeof value === "string") return value;
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return "";
}
