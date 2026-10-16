/**
 * Checks that spoken sentences turn into the right records.
 *
 * Start the app first (npm run dev), then: node scripts/check-extract.mjs
 *
 * Uses Groq's free tier, so running it costs nothing. It never touches
 * ElevenLabs, so it never spends voice credits.
 */
const BASE = process.env.AUDITLY_BASE_URL ?? "http://localhost:3000";

const CASES = [
  {
    name: "Devanagari purchase with a rate",
    transcript: "बीस किलो आटा खरीदा पैंतीस रुपये किलो",
    expect: { type: "purchase", productName: "Atta", quantity: "20", amountRupees: "700" },
  },
  {
    name: "Decimal quantity (dhai = 2.5)",
    transcript: "dhai litre tel becha sau rupaye litre",
    expect: { type: "sale", quantity: "2.5", amountRupees: "250" },
  },
  {
    name: "Expense, no product or quantity",
    transcript: "aaj dukaan ka kiraya diya paanch hazaar",
    expect: { type: "expense", quantity: "", amountRupees: "5000" },
  },
  {
    name: "Total given, not a rate",
    transcript: "cheeni bechi hazaar rupaye ki",
    expect: { type: "sale", amountRupees: "1000" },
  },
  {
    name: "Three things in one breath",
    transcript:
      "das kilo atta becha chalis rupaye kilo, do sabun beche pachas rupaye, transport ka kharcha do sau",
    expectCount: 3,
  },
  {
    name: "Plain English",
    transcript: "sold 3 kg rice for 60 rupees per kg",
    expect: { type: "sale", quantity: "3", amountRupees: "180" },
  },
  {
    name: "Not a transaction at all",
    transcript: "namaste bhai kaise ho aap",
    expectCount: 0,
  },
  {
    name: "Mixed script Hinglish",
    transcript: "5 किलो cheeni bechi 200 rupaye kilo",
    expect: { type: "sale", quantity: "5", amountRupees: "1000" },
  },
];

const sleep = (ms) => new Promise((done) => setTimeout(done, ms));

async function askOnce(transcript) {
  const response = await fetch(`${BASE}/api/extract`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ transcript }),
  });
  return response.json();
}

/**
 * Groq's free tier caps requests per minute, so a throttled case is retried
 * once after a pause. Without this, running the script twice in a row reports
 * failures that are really just rate limiting.
 */
async function ask(transcript) {
  const first = await askOnce(transcript);
  const throttled = typeof first.error === "string" && first.error.includes("limit");
  if (!throttled) return first;

  console.log("      (rate limited — waiting 20s, retrying once)");
  await sleep(20_000);
  return askOnce(transcript);
}

let pass = 0;
let fail = 0;
let isFirst = true;

for (const testCase of CASES) {
  // Space the calls out to stay inside the free tier.
  if (!isFirst) await sleep(1500);
  isFirst = false;

  let data;
  try {
    data = await ask(testCase.transcript);
  } catch (cause) {
    console.log(`FAIL  ${testCase.name}\n      request failed: ${cause.message}`);
    fail += 1;
    continue;
  }

  if (data.error !== undefined) {
    console.log(`FAIL  ${testCase.name}\n      server said: ${data.error}`);
    fail += 1;
    continue;
  }

  const records = data.records ?? [];
  const shown = records
    .map((r) => `${r.type}/${r.productName}/${r.quantity || "-"}${r.unit}/Rs${r.amountRupees}`)
    .join("  ");

  if (testCase.expectCount !== undefined) {
    const ok = records.length === testCase.expectCount;
    console.log(
      ok
        ? `PASS  ${testCase.name}  (${records.length})  ${shown}`
        : `FAIL  ${testCase.name}\n      wanted ${testCase.expectCount} records, got ${records.length}  ${shown}`,
    );
    if (ok) {
      pass += 1;
    } else {
      fail += 1;
    }
    continue;
  }

  if (records.length === 0) {
    console.log(`FAIL  ${testCase.name}\n      no records returned`);
    fail += 1;
    continue;
  }

  const misses = Object.entries(testCase.expect)
    .filter(([key, want]) => records[0][key] !== want)
    .map(([key, want]) => `${key}: got "${records[0][key]}", want "${want}"`);

  if (misses.length === 0) {
    console.log(`PASS  ${testCase.name}  ${shown}`);
    pass += 1;
  } else {
    console.log(`FAIL  ${testCase.name}\n      ${misses.join("\n      ")}`);
    fail += 1;
  }
}

console.log(`\n${pass} passed, ${fail} failed, ${CASES.length} total`);
process.exitCode = fail === 0 ? 0 : 1;
