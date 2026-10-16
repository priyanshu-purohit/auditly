import { isDatabaseConfigured } from "@/lib/db";
import { rupeesToPaise } from "@/lib/format";
import { type RecordToSave, saveRecords } from "@/lib/shop-data";
import type { ProductUnit, TransactionType } from "@/lib/types";
import { PRODUCT_UNITS, TRANSACTION_TYPES } from "@/lib/units";

const MAX_RECORDS = 20;
const MAX_TRANSCRIPT_CHARS = 1000;
/** ₹10,00,000 in paise — a sanity ceiling, not a business rule. */
const MAX_AMOUNT_PAISE = 100_000_000;

function fail(status: number, message: string) {
  return Response.json({ error: message }, { status });
}

export async function POST(request: Request) {
  if (!isDatabaseConfigured()) {
    return fail(503, "Database set nahi hai. MONGODB_URI .env.local mein daalein.");
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return fail(400, "Request padhi nahi ja saki.");
  }

  if (typeof body !== "object" || body === null) {
    return fail(400, "Galat request.");
  }
  const fields = body as Record<string, unknown>;

  if (!Array.isArray(fields.records) || fields.records.length === 0) {
    return fail(400, "Koi record nahi bheja.");
  }
  if (fields.records.length > MAX_RECORDS) {
    return fail(400, "Ek baar mein itne record save nahi ho sakte.");
  }

  const transcript =
    typeof fields.transcript === "string" && fields.transcript.trim() !== ""
      ? fields.transcript.trim().slice(0, MAX_TRANSCRIPT_CHARS)
      : null;

  // Validate every row before touching the database — all or nothing.
  const toSave: RecordToSave[] = [];
  for (const [index, raw] of fields.records.entries()) {
    const checked = validateRecord(raw, index);
    if (typeof checked === "string") return fail(400, checked);
    toSave.push(checked);
  }

  try {
    const saved = await saveRecords(toSave, transcript);
    return Response.json({ saved });
  } catch (cause) {
    console.error("[records] save failed:", cause);
    return fail(502, "Save nahi ho paya. Dobara koshish karein.");
  }
}

/** Returns a clean record, or a message naming what is wrong with row `index`. */
function validateRecord(raw: unknown, index: number): RecordToSave | string {
  const position = `Record ${index + 1}`;

  if (typeof raw !== "object" || raw === null) return `${position}: galat shape.`;
  const fields = raw as Record<string, unknown>;

  const type = TRANSACTION_TYPES.find((candidate) => candidate === fields.type);
  if (type === undefined) return `${position}: type galat hai.`;

  const productName = typeof fields.productName === "string" ? fields.productName.trim() : "";
  if (productName === "") return `${position}: naam khali hai.`;
  if (productName.length > 120) return `${position}: naam bahut lamba hai.`;

  const amountPaise = rupeesToPaise(
    typeof fields.amountRupees === "string" ? fields.amountRupees : "",
  );
  if (!Number.isInteger(amountPaise) || amountPaise <= 0) {
    return `${position}: rakam galat hai.`;
  }
  if (amountPaise > MAX_AMOUNT_PAISE) return `${position}: rakam bahut badi hai.`;

  if (type === "expense") {
    return { type, productName, quantity: null, unit: null, amountPaise };
  }

  const quantity = Number.parseFloat(
    typeof fields.quantity === "string" ? fields.quantity : "",
  );
  if (!Number.isFinite(quantity) || quantity <= 0) {
    return `${position}: quantity galat hai.`;
  }

  const unit: ProductUnit | undefined = PRODUCT_UNITS.find(
    (candidate) => candidate === fields.unit,
  );
  if (unit === undefined) return `${position}: unit galat hai.`;

  return { type: type as TransactionType, productName, quantity, unit, amountPaise };
}
