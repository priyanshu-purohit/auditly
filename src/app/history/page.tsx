import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";

import HistoryList from "@/components/HistoryList";
import { isDatabaseConfigured } from "@/lib/db";
import { HISTORY_DAYS, getHistory } from "@/lib/shop-data";

export const metadata = {
  title: "Purane records — Auditly",
};

export default function HistoryPage() {
  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col gap-5 px-4 py-6">
      <header className="flex items-center gap-3">
        <Link
          href="/"
          aria-label="Wapas"
          className="rounded-lg px-2 py-1 text-xl text-stone-500 hover:bg-stone-200 dark:text-stone-400 dark:hover:bg-stone-800"
        >
          &larr;
        </Link>
        <div>
          <h1 className="text-xl font-bold text-stone-900 dark:text-stone-50">
            Purane records
          </h1>
          <p className="text-xs text-stone-500 dark:text-stone-400">
            Pichhle {HISTORY_DAYS} din
          </p>
        </div>
      </header>

      <Suspense fallback={<Skeleton />}>
        <Days />
      </Suspense>
    </div>
  );
}

async function Days() {
  if (!isDatabaseConfigured()) {
    return (
      <p className="rounded-2xl bg-amber-50 px-4 py-4 text-sm leading-6 text-amber-900 dark:bg-amber-950 dark:text-amber-200">
        Database juda nahi hai.
      </p>
    );
  }

  // connection() first: new Date() is request-time data, which Cache
  // Components refuses to prerender.
  await connection();

  let data;
  try {
    data = await getHistory(new Date());
  } catch (cause) {
    console.error("[history] could not read:", cause);
    return (
      <p className="rounded-2xl bg-rose-50 px-4 py-4 text-sm leading-6 text-rose-800 dark:bg-rose-950 dark:text-rose-300">
        Purane records padhe nahi ja sake.
      </p>
    );
  }

  return <HistoryList days={data.days} products={data.products} />;
}

function Skeleton() {
  return (
    <div className="flex flex-col gap-3">
      <div className="h-5 w-40 rounded bg-stone-200 dark:bg-stone-800" />
      <div className="h-16 rounded-2xl bg-stone-200 dark:bg-stone-800" />
      <div className="h-16 rounded-2xl bg-stone-200 dark:bg-stone-800" />
      <div className="mt-3 h-5 w-40 rounded bg-stone-200 dark:bg-stone-800" />
      <div className="h-16 rounded-2xl bg-stone-200 dark:bg-stone-800" />
    </div>
  );
}
