import Link from "next/link";

import MicButton from "@/components/MicButton";
import SummaryCards from "@/components/SummaryCards";
import TodayDate from "@/components/TodayDate";
import TransactionList from "@/components/TransactionList";
import { mockProducts, mockShop, mockTodayTransactions } from "@/lib/mock-data";
import { summariseDay, summariseStockMovement } from "@/lib/summary";

export default function HomePage() {
  // Mock data for now. Replaced by a MongoDB query on day 4.
  const transactions = mockTodayTransactions;
  const summary = summariseDay(transactions);
  const stockMoves = summariseStockMovement(transactions, mockProducts);

  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-4 py-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight text-stone-900 dark:text-stone-50">
          {mockShop.name}
        </h1>
        <p className="mt-0.5 text-sm text-stone-500 dark:text-stone-400">
          <TodayDate />
        </p>
      </header>

      <SummaryCards summary={summary} />

      <section className="flex flex-col items-center gap-5 rounded-2xl border border-stone-200 bg-white py-8 dark:border-stone-700 dark:bg-stone-900">
        <MicButton />
        <Link
          href="/review"
          className="rounded-lg px-4 py-2 text-sm font-medium text-stone-600 underline underline-offset-4 hover:text-stone-900 dark:text-stone-400 dark:hover:text-stone-100"
        >
          Ya phir type karke likhein
        </Link>
      </section>

      {stockMoves.length > 0 && (
        <section>
          <h2 className="mb-2 text-sm font-semibold tracking-wide text-stone-500 uppercase dark:text-stone-400">
            Aaj ka stock
          </h2>
          <ul className="flex flex-wrap gap-2">
            {stockMoves.map((move) => (
              <li
                key={move.productName}
                className="rounded-full border border-stone-200 bg-white px-3 py-1.5 text-sm dark:border-stone-700 dark:bg-stone-900"
              >
                <span className="font-medium text-stone-700 dark:text-stone-200">
                  {move.productName}
                </span>{" "}
                <span
                  className={`font-semibold tabular-nums ${
                    move.change < 0
                      ? "text-rose-600 dark:text-rose-400"
                      : "text-sky-600 dark:text-sky-400"
                  }`}
                >
                  {move.change < 0 ? "−" : "+"}
                  {Math.abs(move.change)} {move.unit}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <h2 className="mb-2 text-sm font-semibold tracking-wide text-stone-500 uppercase dark:text-stone-400">
          Aaj ke records ({summary.recordCount})
        </h2>
        <TransactionList transactions={transactions} products={mockProducts} />
      </section>

      <footer className="mt-auto pt-4 text-center text-xs text-stone-400 dark:text-stone-500">
        Voice by ElevenLabs
      </footer>
    </div>
  );
}
