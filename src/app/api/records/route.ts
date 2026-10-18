import { isDatabaseConfigured } from "@/lib/db";
import { type RecordToSave, saveRecords } from "@/lib/shop-data";
import { validateRecord } from "@/lib/validate-record";

const MAX_RECORDS = 20;
const MAX_TRANSCRIPT_CHARS = 1000;

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
    const checked = validateRecord(raw, `Record ${index + 1}`);
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
