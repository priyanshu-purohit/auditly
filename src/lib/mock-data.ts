/**
 * Fake data for building the screens.
 *
 * Everything here is hardcoded on purpose — no database, no API keys, no
 * ElevenLabs credits spent. This file gets deleted once MongoDB is wired up.
 *
 * Dates are written as fixed strings, never new Date(), because this project
 * has Cache Components enabled and a live clock call breaks the build.
 */
import type { Product, Shop, Transaction, VoiceSession } from "./types";

export const mockShop: Shop = {
  id: "shop_1",
  name: "Sharma General Store",
  createdAt: "2026-09-01T09:00:00+05:30",
};

export const mockProducts: Product[] = [
  { id: "p_cheeni", shopId: "shop_1", name: "Cheeni", unit: "kg", openingStock: 50, createdAt: "2026-09-01T09:00:00+05:30" },
  { id: "p_atta", shopId: "shop_1", name: "Atta", unit: "kg", openingStock: 80, createdAt: "2026-09-01T09:00:00+05:30" },
  { id: "p_tel", shopId: "shop_1", name: "Sarso Tel", unit: "litre", openingStock: 24, createdAt: "2026-09-01T09:00:00+05:30" },
  { id: "p_sabun", shopId: "shop_1", name: "Sabun", unit: "piece", openingStock: 60, createdAt: "2026-09-01T09:00:00+05:30" },
];

/** Today's records, newest first. */
export const mockTodayTransactions: Transaction[] = [
  {
    id: "t_6",
    shopId: "shop_1",
    type: "expense",
    productId: null,
    productName: "Bijli ka bill",
    quantity: null,
    amountPaise: 120000,
    occurredAt: "2026-10-14T17:40:00+05:30",
    createdAt: "2026-10-14T17:40:00+05:30",
    status: "confirmed",
  },
  {
    id: "t_5",
    shopId: "shop_1",
    type: "sale",
    productId: "p_cheeni",
    productName: "Cheeni",
    quantity: 5,
    amountPaise: 100000,
    occurredAt: "2026-10-14T16:10:00+05:30",
    createdAt: "2026-10-14T16:10:00+05:30",
    status: "confirmed",
  },
  {
    id: "t_4",
    shopId: "shop_1",
    type: "sale",
    productId: "p_sabun",
    productName: "Sabun",
    quantity: 4,
    amountPaise: 14000,
    occurredAt: "2026-10-14T14:25:00+05:30",
    createdAt: "2026-10-14T14:25:00+05:30",
    status: "confirmed",
  },
  {
    id: "t_3",
    shopId: "shop_1",
    type: "purchase",
    productId: "p_atta",
    productName: "Atta",
    quantity: 25,
    amountPaise: 87500,
    occurredAt: "2026-10-14T12:00:00+05:30",
    createdAt: "2026-10-14T12:05:00+05:30",
    status: "confirmed",
  },
  {
    id: "t_2",
    shopId: "shop_1",
    type: "sale",
    productId: "p_tel",
    productName: "Sarso Tel",
    quantity: 2,
    amountPaise: 36000,
    occurredAt: "2026-10-14T10:30:00+05:30",
    createdAt: "2026-10-14T10:30:00+05:30",
    status: "confirmed",
  },
  {
    id: "t_1",
    shopId: "shop_1",
    type: "sale",
    productId: "p_atta",
    productName: "Atta",
    quantity: 10,
    amountPaise: 42000,
    occurredAt: "2026-10-14T09:15:00+05:30",
    createdAt: "2026-10-14T09:15:00+05:30",
    status: "confirmed",
  },
];

/**
 * What the Review screen receives after a voice note.
 * This is the exact example from the README, so the demo tells a clear story.
 */
export const mockVoiceSession: VoiceSession = {
  id: "vs_1",
  transcript:
    "Paanch kilo cheeni bechi do sau rupaye kilo, aur bijli ka bill bhara baarah sau rupaye",
  records: [
    {
      id: "r_1",
      type: "sale",
      productName: "Cheeni",
      quantity: "5",
      unit: "kg",
      amountRupees: "1000",
    },
    {
      id: "r_2",
      type: "expense",
      productName: "Bijli ka bill",
      quantity: "",
      unit: "piece",
      amountRupees: "1200",
    },
  ],
};
