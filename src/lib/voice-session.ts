"use client";

import { useSyncExternalStore } from "react";

import type { PendingVoiceSession } from "@/lib/types";

const STORAGE_KEY = "auditly:pending-voice-session";

/** Lets this tab notice its own writes; the "storage" event only fires across tabs. */
const CHANGE_EVENT = "auditly:voice-session-change";

/**
 * Hands a finished voice note from the Home screen to the Review screen.
 *
 * sessionStorage is used on purpose: it survives the page navigation but is
 * gone when the tab closes, so a half-reviewed note never lingers. Every
 * access is wrapped in try/catch because private-browsing modes can throw.
 */
export function saveVoiceSession(session: PendingVoiceSession): void {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    window.dispatchEvent(new Event(CHANGE_EVENT));
  } catch {
    // Storage unavailable — the Review screen will fall back to its sample.
  }
}

export function clearVoiceSession(): void {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
    window.dispatchEvent(new Event(CHANGE_EVENT));
  } catch {
    // Nothing to do.
  }
}

function readRaw(): string | null {
  try {
    return sessionStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function parse(raw: string | null): PendingVoiceSession | null {
  if (raw === null) return null;
  try {
    const value: unknown = JSON.parse(raw);
    if (typeof value !== "object" || value === null) return null;

    const candidate = value as Partial<PendingVoiceSession>;
    if (typeof candidate.transcript !== "string") return null;

    return {
      transcript: candidate.transcript,
      mocked: candidate.mocked === true,
      records: Array.isArray(candidate.records) ? candidate.records : [],
    };
  } catch {
    return null;
  }
}

/**
 * Cached so getSnapshot returns the same object until the stored text changes.
 * useSyncExternalStore re-renders forever if the snapshot identity keeps moving.
 */
let cache: { raw: string | null; value: PendingVoiceSession | null } | null = null;

function getSnapshot(): PendingVoiceSession | null {
  const raw = readRaw();
  if (cache === null || cache.raw !== raw) {
    cache = { raw, value: parse(raw) };
  }
  return cache.value;
}

/** Nothing is stored while rendering on the server. */
function getServerSnapshot(): null {
  return null;
}

function subscribe(onChange: () => void): () => void {
  window.addEventListener(CHANGE_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(CHANGE_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

/** Reads the pending voice note, or null when there isn't one. */
export function usePendingVoiceSession(): PendingVoiceSession | null {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
