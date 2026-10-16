"use client";

import Link from "next/link";
import { useRef, useState } from "react";

import { TYPE_LABELS, formatRupees, rupeesToPaise } from "@/lib/format";
import { mockVoiceSession } from "@/lib/mock-data";
import type { ExtractedRecord, ProductUnit, TransactionType } from "@/lib/types";
import { clearVoiceSession, usePendingVoiceSession } from "@/lib/voice-session";

const TYPES: TransactionType[] = ["sale", "purchase", "expense"];
const UNITS: ProductUnit[] = ["kg", "litre", "piece", "packet"];

const inputClass =
  "rounded-xl border border-stone-300 bg-white px-3 py-2.5 text-stone-900 placeholder:text-stone-400 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 focus:outline-none dark:border-stone-600 dark:bg-stone-800 dark:text-stone-100 dark:focus:ring-emerald-900";

export default function ReviewPage() {
  const session = usePendingVoiceSession();

  // null means "not edited yet" — then the rows come from the voice note.
  // Visiting /review directly shows the sample, which keeps design review easy.
  const [edited, setEdited] = useState<ExtractedRecord[] | null>(null);
  const [saved, setSaved] = useState(false);
  const newIdCounter = useRef(0);

  const transcript = session?.transcript ?? mockVoiceSession.transcript;
  const records = edited ?? session?.records ?? mockVoiceSession.records;

  function updateRecord(id: string, changes: Partial<ExtractedRecord>) {
    setEdited(
      records.map((record) => (record.id === id ? { ...record, ...changes } : record)),
    );
  }

  function removeRecord(id: string) {
    setEdited(records.filter((record) => record.id !== id));
  }

  function addRecord() {
    newIdCounter.current += 1;
    setEdited([
      ...records,
      {
        id: `r_new_${newIdCounter.current}`,
        type: "sale",
        productName: "",
        quantity: "",
        unit: "kg",
        amountRupees: "",
      },
    ]);
  }

  function save() {
    clearVoiceSession();
    setSaved(true);
  }

  const problems = records.map(findProblem);
  const canSave = records.length > 0 && problems.every((problem) => problem === null);
  const totalPaise = records.reduce(
    (sum, record) => sum + rupeesToPaise(record.amountRupees),
    0,
  );

  if (saved) {
    return <SavedScreen count={records.length} totalPaise={totalPaise} />;
  }

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
        <h1 className="text-xl font-bold text-stone-900 dark:text-stone-50">
          Check karein
        </h1>
      </header>

      <section className="rounded-2xl border border-stone-200 bg-white p-4 dark:border-stone-700 dark:bg-stone-900">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-semibold tracking-wide text-stone-500 uppercase dark:text-stone-400">
            Aapne kaha
          </p>
          <SourceBadge session={session} />
        </div>
        <p className="mt-2 leading-7 text-stone-800 italic dark:text-stone-200">
          &ldquo;{transcript}&rdquo;
        </p>
      </section>

      <div>
        <h2 className="mb-2 text-sm font-semibold tracking-wide text-stone-500 uppercase dark:text-stone-400">
          {records.length === 0
            ? "Koi record nahi bana"
            : `${records.length} record mile — galat ho to theek kar lein`}
        </h2>

        {records.length === 0 && (
          <p className="mb-3 rounded-xl bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900 dark:bg-amber-950 dark:text-amber-200">
            Transcript se records banana day 3 par shuru hoga. Tab tak neeche se
            haath se jod lein.
          </p>
        )}

        <div className="flex flex-col gap-3">
          {records.map((record, index) => (
            <RecordCard
              key={record.id}
              record={record}
              problem={problems[index]}
              onChange={(changes) => updateRecord(record.id, changes)}
              onRemove={() => removeRecord(record.id)}
            />
          ))}
        </div>

        <button
          type="button"
          onClick={addRecord}
          className="mt-3 w-full rounded-xl border border-dashed border-stone-300 py-3 text-sm font-medium text-stone-600 hover:bg-stone-100 dark:border-stone-600 dark:text-stone-300 dark:hover:bg-stone-800"
        >
          + Ek aur record jodein
        </button>
      </div>

      <div className="sticky bottom-0 -mx-4 mt-auto border-t border-stone-200 bg-stone-50 px-4 pt-3 pb-4 dark:border-stone-700 dark:bg-stone-950">
        <div className="mb-3 flex items-baseline justify-between">
          <span className="text-sm text-stone-500 dark:text-stone-400">Kul rakam</span>
          <span className="text-xl font-bold tabular-nums text-stone-900 dark:text-stone-50">
            {formatRupees(totalPaise)}
          </span>
        </div>
        <button
          type="button"
          onClick={save}
          disabled={!canSave}
          className="w-full rounded-xl bg-emerald-600 py-4 text-lg font-semibold text-white shadow-sm hover:bg-emerald-700 focus-visible:ring-4 focus-visible:ring-emerald-300 focus-visible:outline-none disabled:cursor-not-allowed disabled:bg-stone-300 disabled:text-stone-500 dark:disabled:bg-stone-700 dark:disabled:text-stone-500"
        >
          Sahi hai, save karein
        </button>
      </div>
    </div>
  );
}

/** Tells the shopkeeper where this transcript came from. */
function SourceBadge({
  session,
}: {
  session: { mocked: boolean } | null;
}) {
  if (session === null) {
    return (
      <span className="shrink-0 rounded-full bg-stone-100 px-2.5 py-1 text-xs font-semibold text-stone-600 dark:bg-stone-800 dark:text-stone-300">
        Sample
      </span>
    );
  }
  if (session.mocked) {
    return (
      <span className="shrink-0 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-800 dark:bg-amber-950 dark:text-amber-300">
        Mock — koi credit kharch nahi
      </span>
    );
  }
  return (
    <span className="shrink-0 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
      ElevenLabs
    </span>
  );
}

/** Returns a message to show the shopkeeper, or null when the record is fine. */
function findProblem(record: ExtractedRecord): string | null {
  if (record.productName.trim() === "") {
    return record.type === "expense"
      ? "Kharch ka naam likhein"
      : "Saamaan ka naam likhein";
  }
  if (rupeesToPaise(record.amountRupees) <= 0) {
    return "Rakam likhein";
  }
  if (record.type !== "expense") {
    const quantity = Number.parseFloat(record.quantity);
    if (!Number.isFinite(quantity) || quantity <= 0) {
      return "Kitna? Quantity likhein";
    }
  }
  return null;
}

function RecordCard({
  record,
  problem,
  onChange,
  onRemove,
}: {
  record: ExtractedRecord;
  problem: string | null;
  onChange: (changes: Partial<ExtractedRecord>) => void;
  onRemove: () => void;
}) {
  const isExpense = record.type === "expense";

  return (
    <div className="rounded-2xl border border-stone-200 bg-white p-4 dark:border-stone-700 dark:bg-stone-900">
      <div className="flex items-center justify-between gap-2">
        <div className="flex gap-1.5" role="group" aria-label="Kis tarah ka record">
          {TYPES.map((type) => (
            <button
              key={type}
              type="button"
              aria-pressed={record.type === type}
              onClick={() => onChange({ type })}
              className={`rounded-full px-3 py-1.5 text-sm font-medium transition ${
                record.type === type
                  ? "bg-stone-900 text-white dark:bg-stone-100 dark:text-stone-900"
                  : "bg-stone-100 text-stone-600 hover:bg-stone-200 dark:bg-stone-800 dark:text-stone-300 dark:hover:bg-stone-700"
              }`}
            >
              {TYPE_LABELS[type]}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={onRemove}
          aria-label="Record hatayein"
          className="rounded-lg px-2 py-1 text-stone-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950"
        >
          &#10005;
        </button>
      </div>

      <div className="mt-4 flex flex-col gap-3">
        <Field label={isExpense ? "Kharch kis cheez ka" : "Saamaan"}>
          <input
            value={record.productName}
            onChange={(event) => onChange({ productName: event.target.value })}
            placeholder={isExpense ? "jaise Bijli ka bill" : "jaise Cheeni"}
            className={inputClass}
          />
        </Field>

        <div className="flex gap-3">
          {!isExpense && (
            <Field label="Kitna" className="flex-1">
              <div className="flex gap-2">
                <input
                  value={record.quantity}
                  onChange={(event) => onChange({ quantity: event.target.value })}
                  inputMode="decimal"
                  placeholder="5"
                  className={`${inputClass} w-full tabular-nums`}
                />
                <select
                  value={record.unit}
                  onChange={(event) =>
                    onChange({ unit: event.target.value as ProductUnit })
                  }
                  aria-label="Unit"
                  className={`${inputClass} w-28`}
                >
                  {UNITS.map((unit) => (
                    <option key={unit} value={unit}>
                      {unit}
                    </option>
                  ))}
                </select>
              </div>
            </Field>
          )}

          <Field label="Rakam (&#8377;)" className={isExpense ? "flex-1" : "w-32"}>
            <input
              value={record.amountRupees}
              onChange={(event) => onChange({ amountRupees: event.target.value })}
              inputMode="decimal"
              placeholder="1000"
              className={`${inputClass} w-full tabular-nums`}
            />
          </Field>
        </div>
      </div>

      {problem !== null && (
        <p className="mt-3 text-sm font-medium text-rose-600 dark:text-rose-400">
          {problem}
        </p>
      )}
    </div>
  );
}

function Field({
  label,
  children,
  className = "",
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={`flex flex-col gap-1.5 ${className}`}>
      <span className="text-xs font-medium text-stone-500 dark:text-stone-400">
        {label}
      </span>
      {children}
    </label>
  );
}

function SavedScreen({ count, totalPaise }: { count: number; totalPaise: number }) {
  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-4 px-4 py-6 text-center">
      <div className="flex h-20 w-20 items-center justify-center rounded-full bg-emerald-100 text-4xl text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
        &#10003;
      </div>
      <h1 className="text-2xl font-bold text-stone-900 dark:text-stone-50">
        Save ho gaya
      </h1>
      <p className="text-stone-600 dark:text-stone-300">
        {count} record, kul {formatRupees(totalPaise)}
      </p>
      <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-200">
        Abhi sirf dikhane ke liye hai &mdash; database day 4 par judega.
      </p>
      <Link
        href="/"
        className="mt-2 rounded-xl bg-stone-900 px-6 py-3 font-semibold text-white dark:bg-stone-100 dark:text-stone-900"
      >
        Home par wapas
      </Link>
    </div>
  );
}
