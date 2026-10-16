"use client";

import { useRouter } from "next/navigation";
import { useCallback, useRef, useState } from "react";

import type { ExtractResponse, TranscribeResponse } from "@/lib/types";
import { MAX_RECORDING_MS, useRecorder } from "@/lib/use-recorder";
import { saveVoiceSession } from "@/lib/voice-session";

type Stage = "ready" | "uploading";

/**
 * The main button on the Home screen.
 *
 * Tap to record, tap again to stop (or wait for the 20-second cap). The audio
 * goes to /api/transcribe, which returns a saved transcript unless real
 * ElevenLabs calls have been switched on in .env.local.
 */
export default function MicButton() {
  const router = useRouter();
  const [stage, setStage] = useState<Stage>("ready");
  const [failure, setFailure] = useState<string | null>(null);

  // Guards against the auto-stop and a user tap both finishing the same note.
  const finishingRef = useRef(false);

  const recorder = useRecorder({
    onLimitReached: () => {
      void finish();
    },
  });

  const finish = useCallback(async () => {
    if (finishingRef.current) return;
    finishingRef.current = true;

    try {
      const audio = await recorder.stop();
      if (audio === null) {
        setFailure("Kuch record nahi hua. Dobara koshish karein.");
        return;
      }

      setStage("uploading");
      setFailure(null);

      const form = new FormData();
      form.append("audio", audio, audio.name);

      let response: Response;
      try {
        response = await fetch("/api/transcribe", { method: "POST", body: form });
      } catch {
        setFailure("Server tak pahunch nahi paye. Internet check karein.");
        return;
      }

      if (!response.ok) {
        const message = await readError(response);
        setFailure(message);
        return;
      }

      const result = (await response.json()) as TranscribeResponse;

      // Ask the AI to turn the sentence into records. If this step fails the
      // transcript still reaches the Review screen, where rows can be typed.
      const records = await extractRecords(result.transcript);

      saveVoiceSession({
        transcript: result.transcript,
        mocked: result.mocked,
        records,
      });
      router.push("/review");
    } finally {
      finishingRef.current = false;
      setStage("ready");
    }
  }, [recorder, router]);

  async function handleTap() {
    if (stage === "uploading") return;

    if (recorder.phase === "recording") {
      await finish();
      return;
    }
    if (recorder.phase === "idle") {
      setFailure(null);
      await recorder.start();
    }
  }

  const recording = recorder.phase === "recording";
  const busy = stage === "uploading" || recorder.phase === "requesting";
  const message = failure ?? recorder.error;

  const secondsLeft = Math.max(
    0,
    Math.ceil((MAX_RECORDING_MS - recorder.elapsedMs) / 1000),
  );

  return (
    <div className="flex flex-col items-center gap-4">
      <button
        type="button"
        onClick={handleTap}
        disabled={busy}
        aria-label={recording ? "Recording band karein" : "Bolein"}
        className={`relative flex h-36 w-36 items-center justify-center rounded-full text-white shadow-lg transition active:scale-95 disabled:active:scale-100 ${
          recording
            ? "bg-rose-600"
            : busy
              ? "bg-stone-400"
              : "bg-emerald-600 hover:bg-emerald-700 focus-visible:ring-4 focus-visible:ring-emerald-300 focus-visible:outline-none"
        }`}
      >
        {recording && (
          <span className="absolute inset-0 animate-ping rounded-full bg-rose-500/40" />
        )}
        {busy ? (
          <span className="h-10 w-10 animate-spin rounded-full border-4 border-white/30 border-t-white" />
        ) : recording ? (
          <StopIcon />
        ) : (
          <MicIcon />
        )}
      </button>

      <p className="text-lg font-semibold text-stone-900 dark:text-stone-100">
        {recording
          ? `Sun raha hoon... ${secondsLeft}s`
          : stage === "uploading"
            ? "Samajh raha hoon..."
            : recorder.phase === "requesting"
              ? "Mic maang raha hoon..."
              : "Bolein"}
      </p>

      <p className="max-w-xs text-center text-sm leading-6 text-stone-500 dark:text-stone-400">
        {recording
          ? "Ho jaye to dobara dabayein"
          : "Dabayein aur boliye — jaise “paanch kilo cheeni bechi do sau rupaye kilo”"}
      </p>

      {message !== null && (
        <p
          role="alert"
          className="max-w-xs rounded-xl bg-rose-50 px-4 py-3 text-center text-sm font-medium text-rose-700 dark:bg-rose-950 dark:text-rose-300"
        >
          {message}
        </p>
      )}
    </div>
  );
}

/**
 * Turns the transcript into records. Never throws — an empty list just means
 * the shopkeeper fills the rows in himself.
 */
async function extractRecords(transcript: string) {
  try {
    const response = await fetch("/api/extract", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ transcript }),
    });
    if (!response.ok) return [];
    const result = (await response.json()) as ExtractResponse;
    return Array.isArray(result.records) ? result.records : [];
  } catch {
    return [];
  }
}

/** Pulls the server's message out of a failed response, with a fallback. */
async function readError(response: Response): Promise<string> {
  try {
    const body: unknown = await response.json();
    if (typeof body === "object" && body !== null) {
      const field = (body as Record<string, unknown>).error;
      if (typeof field === "string" && field !== "") return field;
    }
  } catch {
    // Fall through to the generic message.
  }
  return "Transcript nahi mil paya. Dobara koshish karein.";
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

function StopIcon() {
  return (
    <svg width="44" height="44" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <rect x="6" y="6" width="12" height="12" rx="2" />
    </svg>
  );
}
