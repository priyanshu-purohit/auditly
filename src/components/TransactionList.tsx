import TypePill from "@/components/TypePill";
import { formatRupees, formatTimeFromIso, isMoneyIn, stockDirection } from "@/lib/format";
import type { Product, Transaction } from "@/lib/types";

export default function TransactionList({
  transactions,
  products,
}: {
  transactions: Transaction[];
  products: Product[];
}) {
  if (transactions.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-stone-300 p-8 text-center text-sm text-stone-500 dark:border-stone-600 dark:text-stone-400">
        Aaj ka koi record nahi hai. Mic dabayein aur boliye.
      </p>
    );
  }

  return (
    <ul className="flex flex-col gap-2">
      {transactions.map((transaction) => (
        <Row key={transaction.id} transaction={transaction} products={products} />
      ))}
    </ul>
  );
}

function Row({
  transaction,
  products,
}: {
  transaction: Transaction;
  products: Product[];
}) {
  const product = products.find((p) => p.id === transaction.productId);
  const direction = stockDirection(transaction.type);
  const showStock = product !== undefined && transaction.quantity !== null && direction !== 0;

  return (
    <li className="flex items-center gap-3 rounded-2xl border border-stone-200 bg-white p-3.5 dark:border-stone-700 dark:bg-stone-900">
      <TypePill type={transaction.type} />

      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold text-stone-900 dark:text-stone-100">
          {transaction.productName ?? "—"}
        </p>
        <p className="mt-0.5 text-xs text-stone-500 dark:text-stone-400">
          {showStock && (
            <>
              <span
                className={
                  direction < 0
                    ? "font-semibold text-rose-600 dark:text-rose-400"
                    : "font-semibold text-sky-600 dark:text-sky-400"
                }
              >
                Stock {direction < 0 ? "−" : "+"}
                {transaction.quantity} {product.unit}
              </span>
              <span className="mx-1.5">·</span>
            </>
          )}
          {formatTimeFromIso(transaction.occurredAt)}
        </p>
      </div>

      <p
        className={`shrink-0 font-bold tabular-nums ${
          isMoneyIn(transaction.type)
            ? "text-emerald-700 dark:text-emerald-400"
            : "text-rose-700 dark:text-rose-400"
        }`}
      >
        {isMoneyIn(transaction.type) ? "+" : "−"}
        {formatRupees(transaction.amountPaise)}
      </p>
    </li>
  );
}
