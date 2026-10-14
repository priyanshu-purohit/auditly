import { formatRupees } from "@/lib/format";
import type { DaySummary } from "@/lib/summary";

/**
 * Today's money at a glance.
 *
 * The third card is deliberately labelled "cash", not "profit", with a note
 * underneath. Showing cash-in-minus-cash-out as profit would mislead the
 * shopkeeper, because the cost of the goods sold is not counted here.
 */
export default function SummaryCards({ summary }: { summary: DaySummary }) {
  return (
    <section aria-label="Aaj ka hisaab" className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-3">
        <Card
          label="Bikri (aaya)"
          value={formatRupees(summary.cashInPaise)}
          tone="in"
        />
        <Card
          label="Kharch (gaya)"
          value={formatRupees(summary.cashOutPaise)}
          tone="out"
        />
      </div>

      <div className="rounded-2xl border border-stone-200 bg-white p-4 dark:border-stone-700 dark:bg-stone-900">
        <p className="text-sm font-medium text-stone-500 dark:text-stone-400">
          Aaj ka cash (aaya − gaya)
        </p>
        <p
          className={`mt-1 text-3xl font-bold tabular-nums ${
            summary.netCashPaise < 0
              ? "text-rose-600 dark:text-rose-400"
              : "text-stone-900 dark:text-stone-50"
          }`}
        >
          {formatRupees(summary.netCashPaise)}
        </p>
        <p className="mt-2 flex gap-1.5 text-xs leading-5 text-stone-500 dark:text-stone-400">
          <span aria-hidden="true">ⓘ</span>
          <span>
            Yeh <strong className="font-semibold">profit nahi hai</strong>. Jo maal
            becha uski lagat isme shaamil nahi hai.
          </span>
        </p>
      </div>
    </section>
  );
}

function Card({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "in" | "out";
}) {
  const valueColour =
    tone === "in"
      ? "text-emerald-700 dark:text-emerald-400"
      : "text-rose-700 dark:text-rose-400";

  return (
    <div className="rounded-2xl border border-stone-200 bg-white p-4 dark:border-stone-700 dark:bg-stone-900">
      <p className="text-sm font-medium text-stone-500 dark:text-stone-400">{label}</p>
      <p className={`mt-1 text-2xl font-bold tabular-nums ${valueColour}`}>{value}</p>
    </div>
  );
}
