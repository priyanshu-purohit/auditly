"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

type Phase = "idle" | "listening" | "thinking";

const LABELS: Record<Phase, string> = {
  idle: "Bolein",
  listening: "Sun raha hoon...",
  thinking: "Samajh raha hoon...",
};

const HINTS: Record<Phase, string> = {
  idle: "Dabayein aur boliye — jaise \"paanch kilo cheeni bechi do sau rupaye kilo\"",
  listening: "Boliye... dobara dabane par ruk jayega",
  thinking: "Aapki baat se record bana raha hoon",
};

/**
 * The main button on the Home screen.
 *
 * For now it only PRETENDS to listen, then opens the Review screen with
 * mock results. Real recording and ElevenLabs come on day 2 — this keeps
 * the flow clickable without spending any voice credits.
 */
export default function MicButton() {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("idle");
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  // Clear any pending timers if the user navigates away mid-flow.
  useEffect(() => {
    // Captured because the cleanup runs later; the array itself is never reassigned.
    const pending = timers.current;
    return () => {
      pending.forEach(clearTimeout);
    };
  }, []);

  function startFakeRecording() {
    if (phase !== "idle") return;

    setPhase("listening");
    timers.current.push(
      setTimeout(() => setPhase("thinking"), 1800),
      setTimeout(() => router.push("/review"), 3000),
    );
  }

  const busy = phase !== "idle";

  return (
    <div className="flex flex-col items-center gap-4">
      <button
        type="button"
        onClick={startFakeRecording}
        disabled={busy}
        aria-label={LABELS[phase]}
        className={`relative flex h-36 w-36 items-center justify-center rounded-full text-white shadow-lg transition active:scale-95 disabled:active:scale-100 ${
          busy
            ? "bg-rose-600"
            : "bg-emerald-600 hover:bg-emerald-700 focus-visible:ring-4 focus-visible:ring-emerald-300 focus-visible:outline-none"
        }`}
      >
        {phase === "listening" && (
          <span className="absolute inset-0 animate-ping rounded-full bg-rose-500/40" />
        )}
        {phase === "thinking" ? (
          <span className="h-10 w-10 animate-spin rounded-full border-4 border-white/30 border-t-white" />
        ) : (
          <MicIcon />
        )}
      </button>

      <p className="text-lg font-semibold text-stone-900 dark:text-stone-100">
        {LABELS[phase]}
      </p>
      <p className="max-w-xs text-center text-sm leading-6 text-stone-500 dark:text-stone-400">
        {HINTS[phase]}
      </p>
    </div>
  );
}

function MicIcon() {
  return (
    <svg
      width="48"
      height="48"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
      <path d="M5 11a7 7 0 0 0 14 0" />
      <path d="M12 18v4" />
    </svg>
  );
}
