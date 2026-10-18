"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import TypePill from "@/components/TypePill";
import {
  TYPE_LABELS,
  formatRupees,
  formatTimeFromIso,
  isMoneyIn,
  stockDirection,
} from "@/lib/format";
import type { HistoryDay, ProductView } from "@/lib/shop-data";
import { summariseDay } from "@/lib/summary";
import type { ProductUnit, Transaction } from "@/lib/types";
import { PRODUCT_UNITS, TRANSACTION_TYPES } from "@/lib/units";

const WEEKDAYS = [
  "Ravivar",
  "Somvar",
  "Mangalwar",
  "Budhvar",
  "Guruvar",
  "Shukravar",
  "Shanivar",
];
const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

/**
 * "2026-10-16" -> "Shukravar, 16 October"
 *
 * The date is rebuilt in UTC and read back with the UTC getters, so the
 * weekday is the same on the server and in the browser. Using local getters
 * here would risk a hydration mismatch.
 */
function dayLabel(dateKey: string): string {
  const [year, month, day] = dateKey.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return `${WEEKDAYS[date.getUTCDay()]}, ${day} ${MONTHS[month - 1]}`;
}

type Draft = {
  type: Transaction["type"];
  productName: string;
  quantity: string;
  unit: ProductUnit;
  amountRupees: string;
};

const inputClass =
  "rounded-xl border border-stone-300 bg-white px-3 py-2 text-stone-900 placeholder:text-stone-400 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 focus:outline-none dark:border-stone-600 dark:bg-stone-800 dark:text-stone-100 dark:focus:ring-emerald-900";

export default function HistoryList({
  days,
  products,
}: {
  days: HistoryDay[];
  products: ProductView[];
}) {
  const router = useRouter();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function unitFor(transaction: Transaction): ProductUnit {
    const product = products.find((candidate) => candidate.id === transaction.productId);
    return product?.unit ?? "piece";
  }

  function startEditing(transaction: Transaction) {
    setEditingId(transaction.id);
    setError(null);
    setDraft({
      type: transaction.type,
      productName: transaction.productName ?? "",
      quantity: transaction.quantity === null ? "" : String(transaction.quantity),
      unit: unitFor(transaction),
      amountRupees: String(Math.round(transaction.amountPaise / 100)),
    });
  }

  function cancelEditing() {
    setEditingId(null);
    setDraft(null);
    setError(null);
  }

  async function saveCorrection(id: string) {
    if (draft === null || saving) return;
    setSaving(true);
    setError(null);

    try {
      const response = await fetch("/api/records/correct", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, record: draft }),
      });

      if (!response.ok) {
        setError(await readError(response));
        return;
      }

      cancelEditing();
      // Pull the updated day back from the server rather than patching state
      // here — the correction changes the old row too.
      router.refresh();
    } catch {
      setError("Server tak pahunch nahi paye.");
    } finally {
      setSaving(false);
    }
  }

  if (days.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-stone-300 p-8 text-center text-sm leading-6 text-stone-500 dark:border-stone-600 dark:text-stone-400">
        Abhi koi purana record nahi hai.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {days.map((day) => {
        const summary = summariseDay(day.transactions);
        return (
          <section key={day.dateKey}>
            <header className="mb-2 flex items-baseline justify-between gap-2">
              <h2 className="font-semibold text-stone-900 dark:text-stone-100">
                {dayLabel(day.dateKey)}
              </h2>
              <p className="text-xs text-stone-500 tabular-nums dark:text-stone-400">
                <span className="text-emerald-700 dark:text-emerald-400">
                  +{formatRupees(summary.cashInPaise)}
                </span>
                <span className="mx-1.5">·</span>
                <span className="text-rose-700 dark:text-rose-400">
                  −{formatRupees(summary.cashOutPaise)}
                </span>
              </p>
            </header>

            <ul className="flex flex-col gap-2">
              {day.transactions.map((transaction) => (
                <li key={transaction.id}>
                  {editingId === transaction.id && draft !== null ? (
                    <Editor
                      draft={draft}
                      saving={saving}
                      error={error}
                      onChange={(changes) => setDraft({ ...draft, ...changes })}
                      onCancel={cancelEditing}
                      onSave={() => void saveCorrection(transaction.id)}
                    />
                  ) : (
                    <Row
                      transaction={transaction}
                      unit={unitFor(transaction)}
                      onEdit={() => startEditing(transaction)}
                    />
                  )}
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

function Row({
  transaction,
  unit,
  onEdit,
}: {
  transaction: Transaction;
  unit: ProductUnit;
  onEdit: () => void;
}) {
  const wasCorrected = transaction.status === "corrected";
  const direction = stockDirection(transaction.type);

  return (
    <div
      className={`flex items-center gap-3 rounded-2xl border p-3.5 ${
        wasCorrected
          ? "border-stone-200 bg-stone-100 opacity-70 dark:border-stone-800 dark:bg-stone-900/50"
          : "border-stone-200 bg-white dark:border-stone-700 dark:bg-stone-900"
      }`}
    >
      <TypePill type={transaction.type} />

      <div className="min-w-0 flex-1">
        <p
          className={`truncate font-semibold text-stone-900 dark:text-stone-100 ${
            wasCorrected ? "line-through" : ""
          }`}
        >
          {transaction.productName ?? "—"}
        </p>
        <p className="mt-0.5 text-xs text-stone-500 dark:text-stone-400">
          {transaction.quantity !== null && direction !== 0 && (
            <>
              <span>
                {transaction.quantity} {unit}
              </span>
              <span className="mx-1.5">·</span>
            </>
          )}
          {formatTimeFromIso(transaction.occurredAt)}
          {wasCorrected && (
            <span className="ml-1.5 rounded bg-amber-100 px-1.5 py-0.5 font-medium text-amber-800 dark:bg-amber-950 dark:text-amber-300">
              badla gaya
            </span>
          )}
        </p>
      </div>

      <p
        className={`shrink-0 font-bold tabular-nums ${wasCorrected ? "line-through" : ""} ${
          isMoneyIn(transaction.type)
            ? "text-emerald-700 dark:text-emerald-400"
            : "text-rose-700 dark:text-rose-400"
        }`}
      >
        {isMoneyIn(transaction.type) ? "+" : "−"}
        {formatRupees(transaction.amountPaise)}
      </p>

      {!wasCorrected && (
        <button
          type="button"
          onClick={onEdit}
          className="shrink-0 rounded-lg px-2 py-1 text-xs font-medium text-stone-500 underline underline-offset-2 hover:text-stone-900 dark:text-stone-400 dark:hover:text-stone-100"
        >
          Theek karein
        </button>
      )}
    </div>
  );
}

function Editor({
  draft,
  saving,
  error,
  onChange,
  onCancel,
  onSave,
}: {
  draft: Draft;
  saving: boolean;
  error: string | null;
  onChange: (changes: Partial<Draft>) => void;
  onCancel: () => void;
  onSave: () => void;
}) {
  const isExpense = draft.type === "expense";

  return (
    <div className="rounded-2xl border-2 border-emerald-500 bg-white p-4 dark:bg-stone-900">
      <p className="mb-3 text-xs leading-5 text-stone-500 dark:text-stone-400">
        Purana record mitega nahi — naya record banega aur purana
        &ldquo;badla gaya&rdquo; dikhega.
      </p>

      <div className="flex gap-1.5" role="group" aria-label="Kis tarah ka record">
        {TRANSACTION_TYPES.map((type) => (
          <button
            key={type}
            type="button"
            aria-pressed={draft.type === type}
            onClick={() => onChange({ type })}
            className={`rounded-full px-3 py-1.5 text-sm font-medium transition ${
              draft.type === type
                ? "bg-stone-900 text-white dark:bg-stone-100 dark:text-stone-900"
                : "bg-stone-100 text-stone-600 hover:bg-stone-200 dark:bg-stone-800 dark:text-stone-300"
            }`}
          >
            {TYPE_LABELS[type]}
          </button>
        ))}
      </div>

      <div className="mt-3 flex flex-col gap-3">
        <input
          value={draft.productName}
          onChange={(event) => onChange({ productName: event.target.value })}
          placeholder={isExpense ? "Bijli ka bill" : "Cheeni"}
          aria-label={isExpense ? "Kharch kis cheez ka" : "Saamaan"}
          className={inputClass}
        />

        <div className="flex gap-2">
          {!isExpense && (
            <>
              <input
                value={draft.quantity}
                onChange={(event) => onChange({ quantity: event.target.value })}
                inputMode="decimal"
                placeholder="5"
                aria-label="Kitna"
                className={`${inputClass} w-20 tabular-nums`}
              />
              <select
                value={draft.unit}
                onChange={(event) => onChange({ unit: event.target.value as ProductUnit })}
                aria-label="Unit"
                className={`${inputClass} w-24`}
              >
                {PRODUCT_UNITS.map((unit) => (
                  <option key={unit} value={unit}>
                    {unit}
                  </option>
                ))}
              </select>
            </>
          )}
          <input
            value={draft.amountRupees}
            onChange={(event) => onChange({ amountRupees: event.target.value })}
            inputMode="decimal"
            placeholder="1000"
            aria-label="Rakam rupaye mein"
            className={`${inputClass} flex-1 tabular-nums`}
          />
        </div>
      </div>

      {error !== null && (
        <p
          role="alert"
          className="mt-3 rounded-xl bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700 dark:bg-rose-950 dark:text-rose-300"
        >
          {error}
        </p>
      )}

      <div className="mt-4 flex gap-2">
        <button
          type="button"
          onClick={onSave}
          disabled={saving}
          className="flex-1 rounded-xl bg-emerald-600 py-3 font-semibold text-white hover:bg-emerald-700 disabled:bg-stone-300 disabled:text-stone-500 dark:disabled:bg-stone-700"
        >
          {saving ? "Save ho raha hai..." : "Badlav save karein"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={saving}
          className="rounded-xl border border-stone-300 px-4 py-3 font-medium text-stone-600 hover:bg-stone-100 dark:border-stone-600 dark:text-stone-300 dark:hover:bg-stone-800"
        >
          Rehne dein
        </button>
      </div>
    </div>
  );
}

async function readError(response: Response): Promise<string> {
  try {
    const body: unknown = await response.json();
    if (typeof body === "object" && body !== null) {
      const field = (body as Record<string, unknown>).error;
      if (typeof field === "string" && field !== "") return field;
    }
  } catch {
    // Fall through.
  }
  return "Badlav save nahi hua.";
}
