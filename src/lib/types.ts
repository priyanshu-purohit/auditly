/**
 * Shared data shapes for Auditly.
 *
 * NOTE: these mirror the planned MongoDB collections (shops, products,
 * transactions) but are NOT the final schema. A few fields are still open
 * questions, marked with TODO. Confirm before the database work on day 4.
 */

/** Money is always stored in paise (1 rupee = 100 paise) so there are no decimal errors. */
export type Paise = number;

/** What kind of thing happened. */
export type TransactionType =
  | "sale" // bikri — goods go out, money comes in
  | "purchase" // kharid — goods come in, money goes out
  | "expense"; // kharch — only money goes out (rent, bijli, transport)

/**
 * draft     = extracted from voice, not yet confirmed by the shopkeeper
 * confirmed = shopkeeper checked it and saved it
 * corrected = superseded by a later correction; kept so history is never erased
 */
export type TransactionStatus = "draft" | "confirmed" | "corrected";

/** TODO(day 4): the original schema typed `unit` as an integer. Strings are clearer. */
export type ProductUnit = "kg" | "litre" | "piece" | "packet";

export type Shop = {
  id: string;
  name: string;
  createdAt: string;
};

export type Product = {
  id: string;
  shopId: string;
  name: string;
  unit: ProductUnit;
  openingStock: number;
  createdAt: string;
};

export type Transaction = {
  id: string;
  shopId: string;
  type: TransactionType;
  /** null for expenses — "bijli ka bill" has no product. */
  productId: string | null;
  /** Denormalised so a row can be shown without a second lookup. */
  productName: string | null;
  /** TODO(day 4): "2.5 kilo" is real, so this may need to be a scaled integer. */
  quantity: number | null;
  amountPaise: Paise;
  /** When it happened in the shop (may be backdated). */
  occurredAt: string;
  /** When it was written to the database. */
  createdAt: string;
  status: TransactionStatus;
};

/**
 * One record the AI pulled out of a voice note, shown on the Review screen
 * before the shopkeeper confirms it. Amount is a string here because it is
 * being typed into an input box.
 */
export type ExtractedRecord = {
  id: string;
  type: TransactionType;
  productName: string;
  quantity: string;
  unit: ProductUnit;
  amountRupees: string;
};

/** A single voice note plus everything the AI understood from it. */
export type VoiceSession = {
  id: string;
  transcript: string;
  records: ExtractedRecord[];
};
