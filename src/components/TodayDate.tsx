"use client";

import { useSyncExternalStore } from "react";

const DAYS = [
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

/** Computed once, on the phone, then reused so the snapshot stays stable. */
let cachedLabel: string | null = null;

function getSnapshot(): string {
  if (cachedLabel === null) {
    const now = new Date();
    cachedLabel = `${DAYS[now.getDay()]}, ${now.getDate()} ${MONTHS[now.getMonth()]}`;
  }
  return cachedLabel;
}

/** The date never changes while the page is open, so there is nothing to subscribe to. */
function subscribe(): () => void {
  return () => {};
}

/** On the server there is no date yet — the placeholder renders instead. */
function getServerSnapshot(): null {
  return null;
}

/**
 * Shows the phone's current date.
 *
 * The clock is read through useSyncExternalStore so it only ever runs in the
 * browser. Two problems that avoids:
 * 1. Cache Components fails the build if new Date() runs while prerendering.
 * 2. The server's timezone and the phone's timezone can disagree, which would
 *    cause a hydration mismatch.
 */
export default function TodayDate() {
  const label = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  if (label === null) {
    // Placeholder of roughly the right width, so the layout does not jump.
    return (
      <span className="inline-block h-4 w-32 rounded bg-stone-200 align-middle dark:bg-stone-700" />
    );
  }

  return <span>{label}</span>;
}
