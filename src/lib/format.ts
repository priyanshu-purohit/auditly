import type { Paise, ProductUnit, TransactionType } from "./types";

/**
 * Groups digits the Indian way: 1234567 -> "12,34,567"
 * (last three digits, then pairs).
 */
function groupIndian(value: number): string {
  const digits = Math.abs(value).toString();
  if (digits.length <= 3) return digits;

  const lastThree = digits.slice(-3);
  let rest = digits.slice(0, -3);
  const pairs: string[] = [];

  while (rest.length > 2) {
    pairs.unshift(rest.slice(-2));
    rest = rest.slice(0, -2);
  }
  if (rest.length > 0) pairs.unshift(rest);

  return `${pairs.join(",")},${lastThree}`;
}

/**
 * Turns paise into something a shopkeeper reads: 120000 -> "₹1,200"
 * Paise are only shown when they are not zero.
 *
 * Written by hand instead of using toLocaleString() on purpose — the browser
 * and the server can format locales differently, which breaks hydration.
 */
export function formatRupees(paise: Paise): string {
  const sign = paise < 0 ? "-" : "";
  const absolute = Math.abs(Math.round(paise));
  const whole = Math.trunc(absolute / 100);
  const remainder = absolute % 100;
  const decimals = remainder > 0 ? `.${remainder.toString().padStart(2, "0")}` : "";

  return `${sign}₹${groupIndian(whole)}${decimals}`;
}

/** "200" (rupees typed by the user) -> 20000 paise. Returns 0 for junk input. */
export function rupeesToPaise(rupees: string): Paise {
  const parsed = Number.parseFloat(rupees);
  if (!Number.isFinite(parsed)) return 0;
  return Math.round(parsed * 100);
}

const UNIT_LABELS: Record<ProductUnit, string> = {
  kg: "kg",
  litre: "litre",
  piece: "pcs",
  packet: "packet",
};

export function formatQuantity(
  quantity: number | null,
  unit: ProductUnit | null,
): string {
  if (quantity === null || unit === null) return "—";
  return `${quantity} ${UNIT_LABELS[unit]}`;
}

/** Hinglish labels, in English letters, as chosen for the UI. */
export const TYPE_LABELS: Record<TransactionType, string> = {
  sale: "Bikri",
  purchase: "Kharid",
  expense: "Kharch",
};

/** Does this transaction bring money in, or send it out? */
export function isMoneyIn(type: TransactionType): boolean {
  return type === "sale";
}

/** How stock moves: sales reduce it, purchases add to it, expenses do not touch it. */
export function stockDirection(type: TransactionType): -1 | 0 | 1 {
  if (type === "sale") return -1;
  if (type === "purchase") return 1;
  return 0;
}

/**
 * Reads the clock time straight out of an ISO string: "...T16:10:00+05:30" -> "4:10 pm"
 *
 * The characters are read directly instead of using new Date(...).getHours(),
 * because getHours() uses the server's timezone (often UTC) and would show
 * the wrong time. The offset is already baked into the string.
 */
export function formatTimeFromIso(iso: string): string {
  const match = /T(\d{2}):(\d{2})/.exec(iso);
  if (match === null) return "";

  const hours24 = Number(match[1]);
  const minutes = match[2];
  const suffix = hours24 < 12 ? "am" : "pm";
  const hours12 = hours24 % 12 === 0 ? 12 : hours24 % 12;

  return `${hours12}:${minutes} ${suffix}`;
}
