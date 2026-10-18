/**
 * Checks that correcting a record never destroys the original.
 *
 * Start the app first (npm run dev), then: node scripts/check-history.mjs
 *
 * This WRITES to the database and clears it first so the numbers are
 * predictable, so it refuses to run when real records are present. Point the
 * app at a throwaway database to test safely:
 *
 *   MONGODB_DB=auditly_tmp npm run dev
 *   MONGODB_DB=auditly_tmp npm run check:history
 */
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import mongoose from "mongoose";

const projectRoot = resolve(import.meta.dirname, "..");
const BASE = process.env.AUDITLY_BASE_URL ?? "http://localhost:3000";

function env(name) {
  let text;
  try {
    text = readFileSync(resolve(projectRoot, ".env.local"), "utf8");
  } catch {
    return "";
  }
  for (const line of text.split(/\r?\n/)) {
    if (line.startsWith(name + "=")) return line.slice(name.length + 1).trim();
  }
  return "";
}

const dbName = process.env.MONGODB_DB || env("MONGODB_DB") || "auditly";

let pass = 0;
let fail = 0;
function check(name, ok, detail = "") {
  if (ok) {
    console.log("PASS  " + name);
    pass += 1;
  } else {
    console.log("FAIL  " + name + (detail ? "\n      " + detail : ""));
    fail += 1;
  }
}

async function post(path, body) {
  const response = await fetch(BASE + path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  let json = null;
  try {
    json = await response.json();
  } catch {
    // Some responses have no body.
  }
  return { status: response.status, json };
}

// --- refuse to wipe real records -----------------------------------------
const inspectPath = resolve(import.meta.dirname, "db-inspect.mjs");
const countOutput = execFileSync(process.execPath, [inspectPath], { encoding: "utf8" });
const existingCount = Number(/transactions: (\d+) document/.exec(countOutput)?.[1] ?? "0");

if (existingCount > 0 && !process.argv.includes("--force")) {
  console.error(
    "REFUSING TO RUN: the database already holds " + existingCount + " transaction(s).\n" +
      "This script deletes every product and transaction before testing.\n\n" +
      "Point the app at a throwaway database instead:\n" +
      "    MONGODB_DB=auditly_tmp npm run dev\n" +
      "    MONGODB_DB=auditly_tmp npm run check:history\n\n" +
      "Or, if that data really is throwaway: npm run check:history -- --force",
  );
  process.exit(1);
}

execFileSync(process.execPath, [inspectPath, "--wipe"], { stdio: "ignore" });

// --- seed one record -----------------------------------------------------
const saved = await post("/api/records", {
  transcript: "paanch kilo cheeni bechi do sau rupaye kilo",
  records: [
    { type: "sale", productName: "Cheeni", quantity: "5", unit: "kg", amountRupees: "1000" },
  ],
});
check("seed record saved", saved.status === 200 && saved.json?.saved === 1, JSON.stringify(saved.json));

await mongoose.connect(env("MONGODB_URI"), { dbName, serverSelectionTimeoutMS: 8000 });
const db = mongoose.connection.db;

const original = await db.collection("transactions").findOne({ productName: "Cheeni" });
check("record is in the database", original !== null);
if (original === null) {
  await mongoose.disconnect();
  process.exit(1);
}
const originalId = String(original._id);
const originalOccurredAt = original.occurredAt.toISOString();

// --- bad input is refused ------------------------------------------------
const goodRecord = {
  type: "sale",
  productName: "Cheeni",
  quantity: "5",
  unit: "kg",
  amountRupees: "1100",
};

const noId = await post("/api/records/correct", { record: goodRecord });
check("missing id refused", noId.status === 400, JSON.stringify(noId.json));

const badId = await post("/api/records/correct", { id: "not-an-id", record: goodRecord });
check("malformed id refused", badId.status === 400, JSON.stringify(badId.json));

const unknown = await post("/api/records/correct", {
  id: "ffffffffffffffffffffffff",
  record: goodRecord,
});
check("unknown record refused", unknown.status === 400, JSON.stringify(unknown.json));

const badAmount = await post("/api/records/correct", {
  id: originalId,
  record: { ...goodRecord, amountRupees: "0" },
});
check("zero amount refused", badAmount.status === 400, JSON.stringify(badAmount.json));

// --- the real correction: ₹1000 -> ₹1100 --------------------------------
const corrected = await post("/api/records/correct", { id: originalId, record: goodRecord });
check(
  "correction accepted",
  corrected.status === 200 && corrected.json?.corrected === true,
  JSON.stringify(corrected.json),
);
const newId = corrected.json?.newId;

// --- the original is kept, not erased -----------------------------------
const oldRow = await db.collection("transactions").findOne({ _id: original._id });
check("original still exists", oldRow !== null);
check("original marked corrected", oldRow?.status === "corrected", "status=" + oldRow?.status);
check(
  "original points at its replacement",
  String(oldRow?.correctedBy) === String(newId),
  "correctedBy=" + oldRow?.correctedBy + " newId=" + newId,
);
check("original amount untouched", oldRow?.amountPaise === 100000, "paise=" + oldRow?.amountPaise);

// --- the replacement ----------------------------------------------------
const newRow = await db
  .collection("transactions")
  .findOne({ _id: new mongoose.Types.ObjectId(String(newId)) });
check("replacement exists", newRow !== null);
check("replacement is confirmed", newRow?.status === "confirmed", "status=" + newRow?.status);
check("replacement has the new amount", newRow?.amountPaise === 110000, "paise=" + newRow?.amountPaise);
check(
  "replacement keeps the ORIGINAL date",
  newRow?.occurredAt.toISOString() === originalOccurredAt,
  "was " + originalOccurredAt + ", now " + newRow?.occurredAt.toISOString(),
);
check("replacement carries the transcript", typeof newRow?.transcript === "string");

// --- the same row cannot be corrected twice -----------------------------
const again = await post("/api/records/correct", {
  id: originalId,
  record: { ...goodRecord, amountRupees: "1200" },
});
check("double correction refused", again.status === 400, JSON.stringify(again.json));

// --- what the screens show ----------------------------------------------
const history = (await (await fetch(BASE + "/history")).text()).replaceAll("<!-- -->", "");
check("history marks the old row", history.includes("badla gaya"));
check("history shows the new amount", history.includes("1,100"));

const home = (await (await fetch(BASE + "/")).text()).replaceAll("<!-- -->", "");
// The day total must count ₹1,100 only, never ₹1,000 + ₹1,100 = ₹2,100.
check(
  "today's total excludes the corrected row",
  home.includes("1,100") && !home.includes("2,100"),
);

await mongoose.disconnect();
console.log("\n" + pass + " passed, " + fail + " failed");
console.log("\nRun `node scripts/db-inspect.mjs --wipe` to clear this test data.");
process.exitCode = fail === 0 ? 0 : 1;
