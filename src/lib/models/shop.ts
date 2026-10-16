import { Schema, model, models, type Model } from "mongoose";

/**
 * The shop itself.
 *
 * There is exactly one for now, found by its fixed slug. The field exists so
 * that adding real accounts later does not need a data migration.
 *
 * The shape is written out by hand rather than inferred from the schema —
 * inference plus `timestamps` produces a type that breaks query checking.
 */
export interface ShopDoc {
  slug: string;
  name: string;
  createdAt: Date;
}

const shopSchema = new Schema<ShopDoc>(
  {
    slug: { type: String, required: true, unique: true, trim: true },
    name: { type: String, required: true, trim: true, maxlength: 120 },
    createdAt: { type: Date },
  },
  { timestamps: { createdAt: "createdAt", updatedAt: false } },
);

// `models.Shop ?? ...` stops "model already compiled" errors on hot reload.
export const Shop: Model<ShopDoc> =
  (models.Shop as Model<ShopDoc>) ?? model<ShopDoc>("Shop", shopSchema);

/** The single shop this MVP works with. */
export const DEFAULT_SHOP_SLUG = "default";

export function defaultShopName(): string {
  const value = (process.env.AUDITLY_SHOP_NAME ?? "").trim();
  return value === "" ? "Meri Dukaan" : value;
}
