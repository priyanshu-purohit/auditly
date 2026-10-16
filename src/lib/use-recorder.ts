"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/** Recordings stop themselves after this long. 20s ≈ 110 ElevenLabs credits. */
export const MAX_RECORDING_MS = 20_000;

/** Formats most-preferred first; the browser picks the first one it supports. */
const PREFERRED_TYPES = [
  "audio/webm;codecs=opus",
  "audio/webm",
  "audio/ogg;codecs=opus",
  "audio/mp4",
];

export type RecorderPhase = "idle" | "requesting" | "recording";

function pickMimeType(): string {
  for (const type of PREFERRED_TYPES) {
    if (MediaRecorder.isTypeSupported(type)) return type;
  }
  return "";
}

function extensionFor(mimeType: string): string {
  if (mimeType.includes("ogg")) return "ogg";
  if (mimeType.includes("mp4")) return "mp4";
  return "webm";
}

/**
 * Records a short voice note in the browser.
 *
 * Nothing is uploaded here — stop() hands back the audio and the caller
 * decides what to do with it. Recording also stops on its own after
 * MAX_RECORDING_MS, and then calls onLimitReached so the caller can finish
 * the flow. That cap matters: ElevenLabs bills per minute of audio.
 */
export function useRecorder(options: { onLimitReached?: () => void } = {}) {
  const [phase, setPhase] = useState<RecorderPhase>("idle");
  const [error, setError] = useState<string | null>(null);
  const [elapsedMs, setElapsedMs] = useState(0);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const autoStopRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Kept in a ref so the auto-stop timer always calls the latest callback.
  // Updated in an effect because writing a ref during render is not allowed.
  const onLimitReachedRef = useRef(options.onLimitReached);
  useEffect(() => {
    onLimitReachedRef.current = options.onLimitReached;
  }, [options.onLimitReached]);

  const clearTimers = useCallback(() => {
    if (autoStopRef.current !== null) clearTimeout(autoStopRef.current);
    if (tickRef.current !== null) clearInterval(tickRef.current);
    autoStopRef.current = null;
    tickRef.current = null;
  }, []);

  const releaseMic = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    recorderRef.current = null;
  }, []);

  // Release the microphone if the user navigates away mid-recording.
  useEffect(() => {
    return () => {
      if (autoStopRef.current !== null) clearTimeout(autoStopRef.current);
      if (tickRef.current !== null) clearInterval(tickRef.current);
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  const start = useCallback(async (): Promise<boolean> => {
    setError(null);

    if (typeof MediaRecorder === "undefined" || navigator.mediaDevices === undefined) {
      setError("Is browser mein recording support nahi hai. Chrome try karein.");
      return false;
    }

    setPhase("requesting");

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (cause) {
      setPhase("idle");
      const name = cause instanceof DOMException ? cause.name : "";
      if (name === "NotAllowedError" || name === "SecurityError") {
        setError("Mic ki permission nahi mili. Browser settings mein allow karein.");
      } else if (name === "NotFoundError") {
        setError("Koi mic nahi mila.");
      } else {
        setError("Mic chalu nahi ho paya.");
      }
      return false;
    }

    const mimeType = pickMimeType();
    let recorder: MediaRecorder;
    try {
      recorder =
        mimeType === ""
          ? new MediaRecorder(stream)
          : new MediaRecorder(stream, { mimeType });
    } catch {
      stream.getTracks().forEach((track) => track.stop());
      setPhase("idle");
      setError("Recording shuru nahi ho payi.");
      return false;
    }

    chunksRef.current = [];
    recorder.addEventListener("dataavailable", (event) => {
      if (event.data.size > 0) chunksRef.current.push(event.data);
    });

    streamRef.current = stream;
    recorderRef.current = recorder;
    recorder.start();

    setElapsedMs(0);
    setPhase("recording");

    const startedAt = Date.now();
    tickRef.current = setInterval(() => {
      setElapsedMs(Date.now() - startedAt);
    }, 200);

    // Hit the ceiling: stop, then let the caller pick the audio up.
    autoStopRef.current = setTimeout(() => {
      autoStopRef.current = null;
      const active = recorderRef.current;
      if (active !== null && active.state !== "inactive") {
        active.stop();
      }
      onLimitReachedRef.current?.();
    }, MAX_RECORDING_MS);

    return true;
  }, []);

  /**
   * Stops recording and resolves with the audio, or null if there is none.
   * Safe to call after the automatic stop has already fired.
   */
  const stop = useCallback(async (): Promise<File | null> => {
    const recorder = recorderRef.current;
    if (recorder === null) return null;

    clearTimers();

    // If the auto-stop already ran, the "stop" event has fired and the chunks
    // are ready — waiting for another one would hang forever.
    if (recorder.state !== "inactive") {
      const finished = new Promise<void>((resolve) => {
        recorder.addEventListener("stop", () => resolve(), { once: true });
      });
      recorder.stop();
      await finished;
    }

    const mimeType = recorder.mimeType === "" ? "audio/webm" : recorder.mimeType;
    releaseMic();
    setPhase("idle");
    setElapsedMs(0);

    const chunks = chunksRef.current;
    chunksRef.current = [];
    if (chunks.length === 0) return null;

    const blob = new Blob(chunks, { type: mimeType });
    if (blob.size === 0) return null;

    return new File([blob], `voice.${extensionFor(mimeType)}`, { type: mimeType });
  }, [clearTimers, releaseMic]);

  return { phase, error, elapsedMs, start, stop, setError };
}
