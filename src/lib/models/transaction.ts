import { Schema, Types, model, models, type Model } from "mongoose";

import type { ProductUnit, TransactionStatus, TransactionType } from "@/lib/types";
import { PRODUCT_UNITS, TRANSACTION_STATUSES, TRANSACTION_TYPES } from "@/lib/units";

/**
 * One thing that happened in the shop.
 *
 * Two deliberate choices here:
 *
 * - `amountPaise` is a whole number of paise. ₹1000 is stored as 100000.
 *   Money never touches a decimal, so it can never drift.
 * - Nothing is ever deleted or overwritten. Correcting a record inserts a new
 *   one and marks the old one "corrected", with `correctedBy` pointing at the
 *   replacement. A shopkeeper has to be able to trust that the book is a book.
 */
export interface TransactionDoc {
  shopId: Types.ObjectId;
  type: TransactionType;
  /** Null for an expense — "bijli ka bill" has no product. */
  productId: Types.ObjectId | null;
  /** Copied in, so old rows still read correctly after a product is renamed. */
  productName: string;
  quantity: number | null;
  unit: ProductUnit | null;
  amountPaise: number;
  /** When it happened in the shop; may be backdated later. */
  occurredAt: Date;
  status: TransactionStatus;
  correctedBy: Types.ObjectId | null;
  /** What was actually said. Kept so the shopkeeper can see why a row exists. */
  transcript: string | null;
  createdAt: Date;
}

const transactionSchema = new Schema<TransactionDoc>(
  {
    shopId: { type: Schema.Types.ObjectId, ref: "Shop", required: true, index: true },

    type: { type: String, required: true, enum: TRANSACTION_TYPES },

    productId: { type: Schema.Types.ObjectId, ref: "Product", default: null },
    productName: { type: String, required: true, trim: true, maxlength: 120 },

    quantity: { type: Number, default: null, min: 0 },
    unit: { type: String, default: null, enum: [...PRODUCT_UNITS, null] },

    amountPaise: {
      type: Number,
      required: true,
      min: 1,
      validate: {
        validator: Number.isInteger,
        message: "amountPaise must be a whole number of paise",
      },
    },

    occurredAt: { type: Date, required: true },

    status: {
      type: String,
      required: true,
      enum: TRANSACTION_STATUSES,
      default: "confirmed",
    },
    correctedBy: { type: Schema.Types.ObjectId, ref: "Transaction", default: null },

    transcript: { type: String, default: null, maxlength: 1000 },
    createdAt: { type: Date },
  },
  { timestamps: { createdAt: "createdAt", updatedAt: false } },
);

// The day view: newest first, for one shop.
transactionSchema.index({ shopId: 1, occurredAt: -1 });
// Stock sums skip corrected rows.
transactionSchema.index({ shopId: 1, status: 1 });

export const Transaction: Model<TransactionDoc> =
  (models.Transaction as Model<TransactionDoc>) ??
  model<TransactionDoc>("Transaction", transactionSchema);
