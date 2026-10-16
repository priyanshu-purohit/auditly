import type { ProductUnit, TransactionType } from "@/lib/types";

/**
 * The allowed values, in one place.
 *
 * The screens, the AI validation and the database schemas all read these, so
 * adding a unit later means editing one line instead of hunting for four.
 */
export const PRODUCT_UNITS: ProductUnit[] = ["kg", "litre", "piece", "packet"];

export const TRANSACTION_TYPES: TransactionType[] = ["sale", "purchase", "expense"];

export const TRANSACTION_STATUSES = ["confirmed", "corrected"] as const;
