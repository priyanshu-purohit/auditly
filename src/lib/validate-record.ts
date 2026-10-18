import { rupeesToPaise } from "@/lib/format";
import type { RecordToSave } from "@/lib/shop-data";
import type { ProductUnit, TransactionType } from "@/lib/types";
import { PRODUCT_UNITS, TRANSACTION_TYPES } from "@/lib/units";

/** ₹10,00,000 in paise — a sanity ceiling, not a business rule. */
export const MAX_AMOUNT_PAISE = 100_000_000;

/**
 * Checks one record coming from the browser.
 *
 * Shared by the save route and the correction route on purpose: two copies of
 * this logic would eventually disagree, and then a correction could write a row
 * that the original save would have rejected.
 *
 * Returns a clean record, or a message naming what is wrong with it.
 */
export function validateRecord(raw: unknown, label: string): RecordToSave | string {
  if (typeof raw !== "object" || raw === null) return `${label}: galat shape.`;
  const fields = raw as Record<string, unknown>;

  const type = TRANSACTION_TYPES.find((candidate) => candidate === fields.type);
  if (type === undefined) return `${label}: type galat hai.`;

  const productName =
    typeof fields.productName === "string" ? fields.productName.trim() : "";
  if (productName === "") return `${label}: naam khali hai.`;
  if (productName.length > 120) return `${label}: naam bahut lamba hai.`;

  const amountPaise = rupeesToPaise(
    typeof fields.amountRupees === "string" ? fields.amountRupees : "",
  );
  if (!Number.isInteger(amountPaise) || amountPaise <= 0) {
    return `${label}: rakam galat hai.`;
  }
  if (amountPaise > MAX_AMOUNT_PAISE) return `${label}: rakam bahut badi hai.`;

  if (type === "expense") {
    return { type, productName, quantity: null, unit: null, amountPaise };
  }

  const quantity = Number.parseFloat(
    typeof fields.quantity === "string" ? fields.quantity : "",
  );
  if (!Number.isFinite(quantity) || quantity <= 0) {
    return `${label}: quantity galat hai.`;
  }

  const unit: ProductUnit | undefined = PRODUCT_UNITS.find(
    (candidate) => candidate === fields.unit,
  );
  if (unit === undefined) return `${label}: unit galat hai.`;

  return { type: type as TransactionType, productName, quantity, unit, amountPaise };
}
