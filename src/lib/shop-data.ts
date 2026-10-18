// Imported as a value, not just a type: correctRecord needs ObjectId at runtime.
import { Types } from "mongoose";

import { connectToDatabase } from "@/lib/db";
import { Product, toDisplayName, toNameKey } from "@/lib/models/product";
import { DEFAULT_SHOP_SLUG, Shop, defaultShopName } from "@/lib/models/shop";
import { Transaction } from "@/lib/models/transaction";
import type { Paise, ProductUnit, Transaction as TransactionView } from "@/lib/types";

/** Finds the single shop, creating it the first time the app runs. */
export async function getOrCreateShop(): Promise<{ id: Types.ObjectId; name: string }> {
  await connectToDatabase();

  // AUDITLY_SHOP_NAME is the source of truth while there is no screen for
  // renaming the shop. Change it in .env.local and the next page load picks it
  // up. Swap this for a stored name once onboarding exists.
  const wantedName = defaultShopName();

  const existing = await Shop.findOne({ slug: DEFAULT_SHOP_SLUG }).lean();

  if (existing === null) {
    try {
      const created = await Shop.create({ slug: DEFAULT_SHOP_SLUG, name: wantedName });
      return { id: created._id, name: created.name };
    } catch {
      // Two requests raced to create it; the unique index stopped the second.
      const raced = await Shop.findOne({ slug: DEFAULT_SHOP_SLUG }).lean();
      if (raced === null) throw new Error("could not create or find the shop");
      return { id: raced._id, name: raced.name };
    }
  }

  // Only write when the name actually changed — this runs on every page load.
  if (existing.name !== wantedName) {
    await Shop.updateOne({ _id: existing._id }, { $set: { name: wantedName } });
    return { id: existing._id, name: wantedName };
  }

  return { id: existing._id, name: existing.name };
}

/**
 * Finds a product by its spoken name, or creates it.
 *
 * A shopkeeper never sits down to type a catalogue, so the catalogue builds
 * itself out of what gets said.
 */
async function findOrCreateProduct(
  shopId: Types.ObjectId,
  name: string,
  unit: ProductUnit,
): Promise<{ id: Types.ObjectId; name: string }> {
  const nameKey = toNameKey(name);

  const product = await Product.findOneAndUpdate(
    { shopId, nameKey },
    { $setOnInsert: { shopId, nameKey, name: toDisplayName(name), unit, openingStock: 0 } },
    // returnDocument replaces the `new` option, which Mongoose 9 deprecated.
    { returnDocument: "after", upsert: true },
  ).lean();

  // Return the product's own spelling rather than what was said this time, so
  // the day's list shows one "Cheeni" instead of "Cheeni" and "cheeni".
  return { id: product!._id, name: product!.name };
}

export type RecordToSave = {
  type: "sale" | "purchase" | "expense";
  productName: string;
  quantity: number | null;
  unit: ProductUnit | null;
  amountPaise: Paise;
};

/** Writes confirmed records. Returns how many were stored. */
export async function saveRecords(
  records: RecordToSave[],
  transcript: string | null,
): Promise<number> {
  const shop = await getOrCreateShop();
  const occurredAt = new Date();

  const rows = [];
  for (const record of records) {
    const isExpense = record.type === "expense";

    const product =
      isExpense || record.unit === null
        ? null
        : await findOrCreateProduct(shop.id, record.productName, record.unit);

    rows.push({
      shopId: shop.id,
      type: record.type,
      productId: product?.id ?? null,
      productName: product?.name ?? toDisplayName(record.productName),
      quantity: isExpense ? null : record.quantity,
      unit: isExpense ? null : record.unit,
      amountPaise: record.amountPaise,
      occurredAt,
      status: "confirmed" as const,
      correctedBy: null,
      transcript,
    });
  }

  if (rows.length === 0) return 0;
  const inserted = await Transaction.insertMany(rows, { ordered: true });
  return inserted.length;
}

/** Start and end of the day a given moment falls in, in the server's zone. */
function dayBounds(now: Date): { start: Date; end: Date } {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start, end };
}

export type ProductView = {
  id: string;
  name: string;
  unit: ProductUnit;
  openingStock: number;
};

export type TodayData = {
  shopName: string;
  transactions: TransactionView[];
  products: ProductView[];
};

/**
 * Everything the Home screen needs for today.
 *
 * Corrected rows are left out — they have been replaced by newer ones.
 */
export async function getToday(now: Date): Promise<TodayData> {
  const shop = await getOrCreateShop();
  const { start, end } = dayBounds(now);

  const [rows, products] = await Promise.all([
    Transaction.find({
      shopId: shop.id,
      status: "confirmed",
      occurredAt: { $gte: start, $lt: end },
    })
      .sort({ occurredAt: -1 })
      .limit(200)
      .lean(),
    Product.find({ shopId: shop.id }).sort({ name: 1 }).limit(500).lean(),
  ]);

  return {
    shopName: shop.name,
    transactions: rows.map(toTransactionView),
    products: products.map((product) => ({
      id: String(product._id),
      name: product.name,
      unit: product.unit as ProductUnit,
      openingStock: product.openingStock,
    })),
  };
}

/**
 * Turns a database row into the plain shape the screens use.
 *
 * Shared by the day view and the history view so the two can never drift into
 * showing the same row differently.
 */
function toTransactionView(row: {
  _id: unknown;
  shopId: unknown;
  type: string;
  productId: unknown;
  productName: string;
  quantity: number | null;
  amountPaise: number;
  occurredAt: Date;
  createdAt: Date;
  status: string;
}): TransactionView {
  return {
    id: String(row._id),
    shopId: String(row.shopId),
    type: row.type as TransactionView["type"],
    productId: row.productId === null ? null : String(row.productId),
    productName: row.productName,
    quantity: row.quantity ?? null,
    amountPaise: row.amountPaise,
    occurredAt: row.occurredAt.toISOString(),
    createdAt: row.createdAt.toISOString(),
    status: row.status as TransactionView["status"],
  };
}

/**
 * A date key like "2026-10-16" in the server's own timezone.
 *
 * Built from the calendar fields rather than slicing an ISO string, because an
 * ISO string is UTC — at 2am IST that would report yesterday's date.
 */
function localDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export type HistoryDay = {
  /** "2026-10-16" */
  dateKey: string;
  transactions: TransactionView[];
};

/** How many days back the History screen looks. */
export const HISTORY_DAYS = 30;

/**
 * Past days, newest first.
 *
 * Unlike the day view this includes rows marked "corrected". History that
 * quietly hides what was changed is not history — the screen shows them
 * struck through, next to their replacement.
 */
export async function getHistory(
  now: Date,
  dayCount: number = HISTORY_DAYS,
): Promise<{ shopName: string; days: HistoryDay[]; products: ProductView[] }> {
  const shop = await getOrCreateShop();

  const { end } = dayBounds(now);
  const start = new Date(end);
  start.setDate(start.getDate() - dayCount);

  const [rows, products] = await Promise.all([
    Transaction.find({
      shopId: shop.id,
      occurredAt: { $gte: start, $lt: end },
    })
      .sort({ occurredAt: -1 })
      .limit(1000)
      .lean(),
    Product.find({ shopId: shop.id }).sort({ name: 1 }).limit(500).lean(),
  ]);

  // Group into days. The rows arrive newest first, so the days come out in
  // order too and no sorting is needed afterwards.
  const byDay = new Map<string, TransactionView[]>();
  for (const row of rows) {
    const key = localDateKey(row.occurredAt);
    const bucket = byDay.get(key);
    if (bucket === undefined) {
      byDay.set(key, [toTransactionView(row)]);
    } else {
      bucket.push(toTransactionView(row));
    }
  }

  return {
    shopName: shop.name,
    days: [...byDay.entries()].map(([dateKey, transactions]) => ({
      dateKey,
      transactions,
    })),
    products: products.map((product) => ({
      id: String(product._id),
      name: product.name,
      unit: product.unit as ProductUnit,
      openingStock: product.openingStock,
    })),
  };
}

/**
 * Replaces a record without erasing it.
 *
 * A new row is written and the old one is marked "corrected", pointing at its
 * replacement. The shopkeeper's book is append-only: anyone can see that a
 * change happened and what it was. Silently editing a ledger is how people
 * stop trusting it.
 *
 * The replacement keeps the ORIGINAL occurredAt. Fixing yesterday's sale must
 * not move it into today's takings.
 */
export async function correctRecord(
  transactionId: string,
  replacement: RecordToSave,
): Promise<{ ok: true; newId: string } | { ok: false; error: string }> {
  if (!Types.ObjectId.isValid(transactionId)) {
    return { ok: false, error: "Record ka ID galat hai." };
  }

  const shop = await getOrCreateShop();

  const original = await Transaction.findOne({
    _id: new Types.ObjectId(transactionId),
    shopId: shop.id,
  }).lean();

  if (original === null) {
    return { ok: false, error: "Record mila nahi." };
  }
  if (original.status === "corrected") {
    return { ok: false, error: "Yeh record pehle hi badla gaya hai." };
  }

  const isExpense = replacement.type === "expense";
  const product =
    isExpense || replacement.unit === null
      ? null
      : await findOrCreateProduct(shop.id, replacement.productName, replacement.unit);

  const created = await Transaction.create({
    shopId: shop.id,
    type: replacement.type,
    productId: product?.id ?? null,
    productName: product?.name ?? toDisplayName(replacement.productName),
    quantity: isExpense ? null : replacement.quantity,
    unit: isExpense ? null : replacement.unit,
    amountPaise: replacement.amountPaise,
    occurredAt: original.occurredAt,
    status: "confirmed",
    correctedBy: null,
    transcript: original.transcript,
  });

  await Transaction.updateOne(
    { _id: original._id },
    { $set: { status: "corrected", correctedBy: created._id } },
  );

  return { ok: true, newId: String(created._id) };
}
