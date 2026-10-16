/**
 * Shows what is in the Auditly database.
 *
 *   node scripts/db-inspect.mjs          # read only
 *   node scripts/db-inspect.mjs --wipe   # delete all products and transactions
 *
 * The shop row is always kept. The connection string is never printed.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import mongoose from "mongoose";

const projectRoot = resolve(import.meta.dirname, "..");

function readEnv(name) {
  let text;
  try {
    text = readFileSync(resolve(projectRoot, ".env.local"), "utf8");
  } catch {
    return "";
  }
  for (const line of text.split(/\r?\n/)) {
    if (line.startsWith(`${name}=`)) return line.slice(name.length + 1).trim();
  }
  return "";
}

const uri = readEnv("MONGODB_URI");
if (uri === "") {
  console.error("MONGODB_URI is empty in .env.local");
  process.exit(1);
}

await mongoose.connect(uri, {
  dbName: readEnv("MONGODB_DB") || "auditly",
  serverSelectionTimeoutMS: 8000,
});
const db = mongoose.connection.db;

for (const name of ["shops", "products", "transactions"]) {
  const collection = db.collection(name);
  const count = await collection.countDocuments();
  console.log(`\n${name}: ${count} document(s)`);

  const sample = await collection.find({}).limit(5).toArray();
  for (const doc of sample) {
    if (name === "transactions") {
      console.log(
        `   ${doc.type.padEnd(8)} ${String(doc.productName).padEnd(18)}` +
          ` qty=${doc.quantity ?? "-"}${doc.unit ?? ""} paise=${doc.amountPaise}` +
          ` status=${doc.status}`,
      );
    } else if (name === "products") {
      console.log(`   ${doc.name}  (key "${doc.nameKey}")  unit=${doc.unit}`);
    } else {
      console.log(`   ${doc.name}  slug=${doc.slug}`);
    }
  }
  if (count > 5) console.log(`   ... and ${count - 5} more`);
}

if (process.argv.includes("--wipe")) {
  const transactions = await db.collection("transactions").deleteMany({});
  const products = await db.collection("products").deleteMany({});
  console.log(
    `\nWIPED ${transactions.deletedCount} transactions and ${products.deletedCount} products. Shop kept.`,
  );
}

await mongoose.disconnect();
