/**
 * Checks saving and reading back: validation, the write, and the Home screen.
 *
 * Start the app first (npm run dev), then: node scripts/check-db.mjs
 *
 * This WRITES to the database. It wipes products and transactions first so the
 * numbers are predictable, so do not run it once you have real records.
 */
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";

const BASE = process.env.AUDITLY_BASE_URL ?? "http://localhost:3000";

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

let pass = 0;
let fail = 0;
function check(name, ok, detail = "") {
  if (ok) {
    console.log(`PASS  ${name}`);
    pass += 1;
  } else {
    console.log(`FAIL  ${name}${detail ? `\n      ${detail}` : ""}`);
    fail += 1;
  }
}

// This check needs an empty day to make the totals predictable, so it wipes
// first. Refuse to do that silently once there are real records — losing a
// shopkeeper's day to a test script would be unforgivable.
const existing = await post("/api/records", { records: [] });
if (existing.status === 503) {
  console.error("Database is not configured. Set MONGODB_URI in .env.local.");
  process.exit(1);
}

const countOutput = execFileSync(
  process.execPath,
  [resolve(import.meta.dirname, "db-inspect.mjs")],
  { encoding: "utf8" },
);
const transactionCount = Number(/transactions: (\d+) document/.exec(countOutput)?.[1] ?? "0");

if (transactionCount > 0 && !process.argv.includes("--force")) {
  console.error(
    `REFUSING TO RUN: the database already holds ${transactionCount} transaction(s).\n` +
      "This script deletes every product and transaction before testing.\n\n" +
      "If that data matters, back it up or test against a different MONGODB_DB.\n" +
      "If you are sure it is throwaway data, re-run with:\n" +
      "    npm run check:db -- --force",
  );
  process.exit(1);
}

console.log("Clearing products and transactions first...\n");
execFileSync(
  process.execPath,
  [resolve(import.meta.dirname, "db-inspect.mjs"), "--wipe"],
  { stdio: "ignore" },
);

// --- bad input must be refused before the database is touched -------------
const bad = [
  ["empty records rejected", { records: [] }],
  [
    "bad type rejected",
    { records: [{ type: "nonsense", productName: "X", quantity: "1", unit: "kg", amountRupees: "10" }] },
  ],
  [
    "zero amount rejected",
    { records: [{ type: "sale", productName: "X", quantity: "1", unit: "kg", amountRupees: "0" }] },
  ],
  [
    "blank name rejected",
    { records: [{ type: "sale", productName: "   ", quantity: "1", unit: "kg", amountRupees: "10" }] },
  ],
  [
    "bad unit rejected",
    { records: [{ type: "sale", productName: "X", quantity: "1", unit: "tonne", amountRupees: "10" }] },
  ],
  [
    "sale without quantity rejected",
    { records: [{ type: "sale", productName: "X", quantity: "", unit: "kg", amountRupees: "10" }] },
  ],
];

for (const [name, body] of bad) {
  const result = await post("/api/records", body);
  check(name, result.status === 400, `got ${result.status}: ${JSON.stringify(result.json)}`);
}

// --- the real write -------------------------------------------------------
const saved = await post("/api/records", {
  transcript: "paanch kilo cheeni bechi do sau rupaye kilo, aur bijli ka bill bhara baarah sau",
  records: [
    { type: "sale", productName: "Cheeni", quantity: "5", unit: "kg", amountRupees: "1000" },
    { type: "expense", productName: "Bijli ka bill", quantity: "", unit: "piece", amountRupees: "1200" },
    { type: "purchase", productName: "Cheeni", quantity: "25", unit: "kg", amountRupees: "4500" },
  ],
});
check(
  "three records saved",
  saved.status === 200 && saved.json?.saved === 3,
  `got ${saved.status}: ${JSON.stringify(saved.json)}`,
);

// Same product, messier spelling — must reuse the product, not duplicate it.
const again = await post("/api/records", {
  records: [{ type: "sale", productName: "  cheeni ", quantity: "2", unit: "kg", amountRupees: "400" }],
});
check("messy spelling reuses the product", again.status === 200 && again.json?.saved === 1);

// --- read the Home screen back -------------------------------------------
// React puts <!-- --> between adjacent text nodes in server HTML, so strip
// those before looking for things like "18 kg".
const html = (await (await fetch(`${BASE}/`)).text()).replaceAll("<!-- -->", "");

check("Home shows the sale amount", html.includes("1,000"));
check("Home shows the expense", html.includes("Bijli ka bill"));
check("Home shows the product", html.includes("Cheeni"));
// Bought 25, sold 5 then 2 -> +18
check("stock nets to +18 kg", html.includes("18 kg"));
// In 1000 + 400 = 1400; out 1200 + 4500 = 5700; net -4300
check("net cash shows the loss", html.includes("4,300"));
check("one Cheeni spelling only", !html.includes(">cheeni<"));

console.log(`\n${pass} passed, ${fail} failed`);
console.log("\nRun `node scripts/db-inspect.mjs --wipe` to clear this test data.");
process.exitCode = fail === 0 ? 0 : 1;
