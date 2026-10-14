import { TYPE_LABELS } from "@/lib/format";
import type { TransactionType } from "@/lib/types";

const STYLES: Record<TransactionType, string> = {
  sale: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
  purchase: "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300",
  expense: "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300",
};

export default function TypePill({ type }: { type: TransactionType }) {
  return (
    <span
      className={`inline-flex shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${STYLES[type]}`}
    >
      {TYPE_LABELS[type]}
    </span>
  );
}
