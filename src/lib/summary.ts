import type { Paise, Product, ProductUnit, Transaction } from "./types";

export type DaySummary = {
  /** Money that came in from sales. */
  cashInPaise: Paise;
  /** Money that went out — stock purchases plus expenses. */
  cashOutPaise: Paise;
  /**
   * cashIn minus cashOut.
   *
   * This is NOT profit. Profit needs the cost of the goods that were sold,
   * which we do not track yet. The UI must say so clearly.
   */
  netCashPaise: Paise;
  recordCount: number;
};

export function summariseDay(transactions: Transaction[]): DaySummary {
  let cashInPaise = 0;
  let cashOutPaise = 0;

  for (const transaction of transactions) {
    if (transaction.status === "corrected") continue; // superseded, do not count twice

    if (transaction.type === "sale") {
      cashInPaise += transaction.amountPaise;
    } else {
      cashOutPaise += transaction.amountPaise;
    }
  }

  return {
    cashInPaise,
    cashOutPaise,
    netCashPaise: cashInPaise - cashOutPaise,
    recordCount: transactions.filter((t) => t.status !== "corrected").length,
  };
}

/** Net stock movement per product for the day, e.g. Cheeni -5 kg, Atta +15 kg. */
export function summariseStockMovement(
  transactions: Transaction[],
  products: Product[],
): Array<{ productName: string; change: number; unit: ProductUnit }> {
  const moves = new Map<string, { change: number; unit: ProductUnit }>();

  for (const transaction of transactions) {
    if (transaction.status === 'corrected') continue;
    if (transaction.type === 'expense') continue; // expenses never move stock
    if (transaction.productId === null || transaction.quantity === null) continue;

    const product = products.find((p) => p.id === transaction.productId);
    if (product === undefined) continue;

    const direction = transaction.type === 'sale' ? -1 : 1;
    const existing = moves.get(product.name);
    moves.set(product.name, {
      change: (existing?.change ?? 0) + direction * transaction.quantity,
      unit: product.unit,
    });
  }

  return [...moves.entries()].map(([productName, move]) => ({
    productName,
    change: move.change,
    unit: move.unit,
  }));
}
