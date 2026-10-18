import { isDatabaseConfigured } from "@/lib/db";
import { correctRecord } from "@/lib/shop-data";
import { validateRecord } from "@/lib/validate-record";

function fail(status: number, message: string) {
  return Response.json({ error: message }, { status });
}

/**
 * Corrects one past record.
 *
 * Nothing is overwritten: the replacement is inserted and the original is
 * marked "corrected". See correctRecord() for why.
 */
export async function POST(request: Request) {
  if (!isDatabaseConfigured()) {
    return fail(503, "Database set nahi hai.");
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

  const id = typeof fields.id === "string" ? fields.id.trim() : "";
  if (id === "") {
    return fail(400, "Kaunsa record badalna hai, woh nahi bataya.");
  }

  // Same validator the save route uses, so a correction can never store
  // something the original save would have refused.
  const checked = validateRecord(fields.record, "Record");
  if (typeof checked === "string") {
    return fail(400, checked);
  }

  try {
    const result = await correctRecord(id, checked);
    if (!result.ok) {
      return fail(400, result.error);
    }
    return Response.json({ corrected: true, newId: result.newId });
  } catch (cause) {
    console.error("[records/correct] failed:", cause);
    return fail(502, "Badlav save nahi hua. Dobara koshish karein.");
  }
}
