"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import type { SpeakResponse } from "@/lib/types";

type Phase = "idle" | "loading" | "speaking";

/**
 * "Sun lo" — plays the day's summary out loud.
 *
 * Two ways it can speak:
 *  - ElevenLabs returns MP3 bytes, which sound good and are what the project
 *    is judged on.
 *  - Otherwise the browser's own Hindi voice reads the text. Free, works
 *    offline, and means the feature is never dead just because a key or a
 *    voice id is missing.
 *
 * The server decides which; this component just plays what it is handed.
 */
export default function SpeakButton() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [caption, setCaption] = useState<string | null>(null);
  const [source, setSource] = useState<SpeakResponse["source"] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const objectUrlRef = useRef<string | null>(null);

  const cleanUp = useCallback(() => {
    audioRef.current?.pause();
    audioRef.current = null;
    if (objectUrlRef.current !== null) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
  }, []);

  // Stop talking if the page goes away mid-sentence.
  useEffect(() => {
    return () => {
      audioRef.current?.pause();
      if (objectUrlRef.current !== null) URL.revokeObjectURL(objectUrlRef.current);
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  function playMp3(base64: string) {
    const bytes = Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
    const url = URL.createObjectURL(new Blob([bytes], { type: "audio/mpeg" }));
    objectUrlRef.current = url;

    const audio = new Audio(url);
    audioRef.current = audio;
    audio.addEventListener("ended", () => {
      setPhase("idle");
      cleanUp();
    });
    audio.addEventListener("error", () => {
      setError("Awaaz chal nahi payi.");
      setPhase("idle");
    });

    setPhase("speaking");
    void audio.play().catch(() => {
      setError("Browser ne awaaz rok di. Screen par tap karke dobara try karein.");
      setPhase("idle");
    });
  }

  function speakWithBrowser(text: string) {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      setError("Is browser mein awaaz support nahi hai.");
      setPhase("idle");
      return;
    }

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "hi-IN";
    utterance.rate = 0.95;

    // Prefer a real Hindi voice when the device has one installed.
    const hindi = window.speechSynthesis
      .getVoices()
      .find((voice) => voice.lang === "hi-IN" || voice.lang.startsWith("hi"));
    if (hindi !== undefined) utterance.voice = hindi;

    utterance.addEventListener("end", () => setPhase("idle"));
    utterance.addEventListener("error", () => {
      setError("Awaaz chal nahi payi.");
      setPhase("idle");
    });

    setPhase("speaking");
    window.speechSynthesis.speak(utterance);
  }

  async function speak() {
    if (phase === "speaking") {
      cleanUp();
      setPhase("idle");
      return;
    }
    if (phase === "loading") return;

    setPhase("loading");
    setError(null);

    let result: SpeakResponse;
    try {
      const response = await fetch("/api/speak", { method: "POST" });
      if (!response.ok) {
        setError(await readError(response));
        setPhase("idle");
        return;
      }
      result = (await response.json()) as SpeakResponse;
    } catch {
      setError("Server tak pahunch nahi paye.");
      setPhase("idle");
      return;
    }

    setCaption(result.text);
    setSource(result.source);

    if (result.audioBase64 !== null) {
      playMp3(result.audioBase64);
    } else {
      speakWithBrowser(result.text);
    }
  }

  return (
    <section className="rounded-2xl border border-stone-200 bg-white p-4 dark:border-stone-700 dark:bg-stone-900">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => void speak()}
          disabled={phase === "loading"}
          className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-white transition active:scale-95 ${
            phase === "speaking"
              ? "bg-rose-600"
              : "bg-stone-900 hover:bg-stone-700 disabled:bg-stone-400 dark:bg-stone-100 dark:text-stone-900 dark:hover:bg-stone-300"
          }`}
          aria-label={phase === "speaking" ? "Awaaz rokein" : "Aaj ka hisaab suniye"}
        >
          {phase === "loading" ? (
            <span className="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
          ) : phase === "speaking" ? (
            <StopIcon />
          ) : (
            <SpeakerIcon />
          )}
        </button>

        <div className="min-w-0 flex-1">
          <p className="font-semibold text-stone-900 dark:text-stone-100">
            {phase === "speaking" ? "Bol raha hoon..." : "Aaj ka hisaab suniye"}
          </p>
          <p className="mt-0.5 text-xs text-stone-500 dark:text-stone-400">
            {phase === "speaking" ? "Rokne ke liye dabayein" : "Dabayein aur sun lein"}
          </p>
        </div>

        {source !== null && (
          <span
            className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${
              source === "elevenlabs"
                ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                : "bg-stone-100 text-stone-600 dark:bg-stone-800 dark:text-stone-300"
            }`}
          >
            {source === "elevenlabs" ? "ElevenLabs" : "Browser awaaz"}
          </span>
        )}
      </div>

      {caption !== null && (
        <p
          lang="hi"
          className="mt-3 border-t border-stone-100 pt-3 text-sm leading-7 text-stone-600 dark:border-stone-800 dark:text-stone-300"
        >
          {caption}
        </p>
      )}

      {error !== null && (
        <p
          role="alert"
          className="mt-3 rounded-xl bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700 dark:bg-rose-950 dark:text-rose-300"
        >
          {error}
        </p>
      )}
    </section>
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
  return "Awaaz nahi bani. Dobara koshish karein.";
}

function SpeakerIcon() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M11 5 6 9H3v6h3l5 4V5Z" />
      <path d="M16 9a4 4 0 0 1 0 6" />
      <path d="M19 6a8 8 0 0 1 0 12" />
    </svg>
  );
}

function StopIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <rect x="6" y="6" width="12" height="12" rx="2" />
    </svg>
  );
}
