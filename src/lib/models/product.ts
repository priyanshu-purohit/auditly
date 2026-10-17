import { Schema, Types, model, models, type Model } from "mongoose";

import type { ProductUnit } from "@/lib/types";
import { PRODUCT_UNITS } from "@/lib/units";

/**
 * One item the shop deals in.
 *
 * `nameKey` is the lowercase, space-squeezed form of `name`. Voice input is
 * never spelled consistently — "cheeni", "Cheeni", "CHEENI " all arrive over a
 * week — and matching on nameKey keeps them as one product instead of three.
 */
export interface ProductDoc {
  shopId: Types.ObjectId;
  name: string;
  nameKey: string;
  unit: ProductUnit;
  openingStock: number;
  createdAt: Date;
}

const productSchema = new Schema<ProductDoc>(
  {
    shopId: { type: Schema.Types.ObjectId, ref: "Shop", required: true, index: true },
    name: { type: String, required: true, trim: true, maxlength: 120 },
    nameKey: { type: String, required: true, trim: true, maxlength: 120 },
    unit: { type: String, required: true, enum: PRODUCT_UNITS },
    openingStock: { type: Number, required: true, default: 0, min: 0 },
    createdAt: { type: Date },
  },
  { timestamps: { createdAt: "createdAt", updatedAt: false } },
);

// One product per name per shop.
productSchema.index({ shopId: 1, nameKey: 1 }, { unique: true });

export const Product: Model<ProductDoc> =
  (models.Product as Model<ProductDoc>) ?? model<ProductDoc>("Product", productSchema);

/** "  Sarso   Tel " -> "sarso tel" */
export function toNameKey(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

/**
 * Tidies a spoken name for display: "  layz " -> "Layz".
 *
 * The AI is told to capitalise but does not always comply, which left the
 * day's list showing "Cheeni" next to "layz". Only the first letter is touched
 * — "Bijli ka bill" should not become "Bijli Ka Bill".
 */
export function toDisplayName(name: string): string {
  const tidy = name.trim().replace(/\s+/g, " ");
  if (tidy === "") return tidy;
  return tidy[0].toUpperCase() + tidy.slice(1);
}
