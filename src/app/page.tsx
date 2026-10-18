import { connection } from "next/server";
import Link from "next/link";
import { Suspense, cache } from "react";

import MicButton from "@/components/MicButton";
import SpeakButton from "@/components/SpeakButton";
import SummaryCards from "@/components/SummaryCards";
import TodayDate from "@/components/TodayDate";
import TransactionList from "@/components/TransactionList";
import { isDatabaseConfigured } from "@/lib/db";
import { getToday } from "@/lib/shop-data";
import { summariseDay, summariseStockMovement } from "@/lib/summary";

export default function HomePage() {
  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-4 py-6">
      {/* The shell renders instantly; the day's figures stream in behind it. */}
      <Suspense fallback={<HeaderSkeleton />}>
        <ShopHeader />
      </Suspense>

      <Suspense fallback={<SummarySkeleton />}>
        <TodaySummary />
      </Suspense>

      <SpeakButton />

      <section className="flex flex-col items-center gap-5 rounded-2xl border border-stone-200 bg-white py-8 dark:border-stone-700 dark:bg-stone-900">
        <MicButton />
        <Link
          href="/review"
          className="rounded-lg px-4 py-2 text-sm font-medium text-stone-600 underline underline-offset-4 hover:text-stone-900 dark:text-stone-400 dark:hover:text-stone-100"
        >
          Ya phir type karke likhein
        </Link>
      </section>

      <Suspense fallback={<ListSkeleton />}>
        <TodayRecords />
      </Suspense>

      <Link
        href="/history"
        className="rounded-xl border border-stone-200 bg-white px-4 py-3.5 text-center text-sm font-medium text-stone-700 hover:bg-stone-100 dark:border-stone-700 dark:bg-stone-900 dark:text-stone-200 dark:hover:bg-stone-800"
      >
        Purane records dekhein
      </Link>

      <footer className="mt-auto pt-4 text-center text-xs text-stone-400 dark:text-stone-500">
        Voice by ElevenLabs
      </footer>
    </div>
  );
}

/**
 * Reads today's data.
 *
 * Wrapped in React cache() so the three Suspense boundaries below share a
 * single query instead of hitting Atlas three times per page load.
 *
 * connection() is awaited first because new Date() is request-time data —
 * Cache Components refuses to prerender a clock read. Everything below runs
 * once per request, inside the Suspense boundaries above.
 */
const loadToday = cache(async () => {
  await connection();
  return getToday(new Date());
});

async function ShopHeader() {
  // Resolve the name first, then render — building JSX inside try/catch hides
  // render errors from the error boundary.
  let name = "Auditly";
  if (isDatabaseConfigured()) {
    try {
      const data = await loadToday();
      name = data.shopName;
    } catch {
      // Keep the fallback name; TodaySummary reports the problem to the user.
    }
  }
  return <Header name={name} />;
}

function Header({ name }: { name: string }) {
  return (
    <header>
      <h1 className="text-2xl font-bold tracking-tight text-stone-900 dark:text-stone-50">
        {name}
      </h1>
      <p className="mt-0.5 text-sm text-stone-500 dark:text-stone-400">
        <TodayDate />
      </p>
    </header>
  );
}

async function TodaySummary() {
  if (!isDatabaseConfigured()) return <SetupNotice />;

  let data;
  try {
    data = await loadToday();
  } catch (cause) {
    console.error("[home] could not read today:", cause);
    return <DatabaseError />;
  }

  const summary = summariseDay(data.transactions);
  const stockMoves = summariseStockMovement(
    data.transactions,
    data.products.map((product) => ({
      id: product.id,
      shopId: "",
      name: product.name,
      unit: product.unit,
      openingStock: product.openingStock,
      createdAt: "",
    })),
  );

  return (
    <>
      <SummaryCards summary={summary} />
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
    </>
  );
}

async function TodayRecords() {
  if (!isDatabaseConfigured()) return null;

  let data;
  try {
    data = await loadToday();
  } catch {
    return null;
  }

  const summary = summariseDay(data.transactions);

  return (
    <section>
      <h2 className="mb-2 text-sm font-semibold tracking-wide text-stone-500 uppercase dark:text-stone-400">
        Aaj ke records ({summary.recordCount})
      </h2>
      <TransactionList
        transactions={data.transactions}
        products={data.products.map((product) => ({
          id: product.id,
          shopId: "",
          name: product.name,
          unit: product.unit,
          openingStock: product.openingStock,
          createdAt: "",
        }))}
      />
    </section>
  );
}

function SetupNotice() {
  return (
    <p className="rounded-2xl bg-amber-50 px-4 py-4 text-sm leading-6 text-amber-900 dark:bg-amber-950 dark:text-amber-200">
      Database juda nahi hai. <code>MONGODB_URI</code> ko <code>.env.local</code> mein
      daal kar server dobara chalayein.
    </p>
  );
}

function DatabaseError() {
  return (
    <p className="rounded-2xl bg-rose-50 px-4 py-4 text-sm leading-6 text-rose-800 dark:bg-rose-950 dark:text-rose-300">
      Database se baat nahi ho payi. Internet aur MONGODB_URI check karein.
    </p>
  );
}

function HeaderSkeleton() {
  return (
    <header>
      <div className="h-8 w-48 rounded bg-stone-200 dark:bg-stone-800" />
      <div className="mt-2 h-4 w-32 rounded bg-stone-200 dark:bg-stone-800" />
    </header>
  );
}

function SummarySkeleton() {
  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-3">
        <div className="h-24 rounded-2xl bg-stone-200 dark:bg-stone-800" />
        <div className="h-24 rounded-2xl bg-stone-200 dark:bg-stone-800" />
      </div>
      <div className="h-32 rounded-2xl bg-stone-200 dark:bg-stone-800" />
    </div>
  );
}

function ListSkeleton() {
  return (
    <div className="flex flex-col gap-2">
      <div className="h-16 rounded-2xl bg-stone-200 dark:bg-stone-800" />
      <div className="h-16 rounded-2xl bg-stone-200 dark:bg-stone-800" />
    </div>
  );
}
