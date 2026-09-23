// Display helpers for the skill panel. Dates in the app are local
// `YYYY-MM-DD` (Europe/Riga); instants from the DB go through localDate().

import { diffDays, localDate } from "@/lib/engine/dates";
import type { Activity, LearnedVia } from "@/lib/progress/types";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "23 Sep", or "23 Sep 2025" when the year differs from `today`'s. */
export function formatDay(date: string, today: string): string {
  const [y, m, d] = date.split("-");
  const label = `${Number(d)} ${MONTHS[Number(m) - 1] ?? m}`;
  return y === today.slice(0, 4) ? label : `${label} ${y}`;
}

/** An ISO instant as a local day label. */
export function formatInstant(iso: string, today: string): string {
  return formatDay(localDate(iso), today);
}

/** "today", "yesterday", "in 3 days", "4 days ago". */
export function relativeDays(date: string, today: string): string {
  const n = diffDays(today, date);
  if (n === 0) return "today";
  if (n === 1) return "tomorrow";
  if (n === -1) return "yesterday";
  return n > 0 ? `in ${n} days` : `${-n} days ago`;
}

/** Compact duration for tight HUD cells: "45m", "4h 40m", "12h". */
export function formatMinutesCompact(minutes: number): string {
  const m = Math.round(minutes);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  const rest = m % 60;
  return rest === 0 ? `${h}h` : `${h}h ${rest}m`;
}

export function plural(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`;
}

export const LEARNED_VIA_LABEL: Record<LearnedVia, string> = {
  completed: "completion check",
  "tested-out": "test-out",
  "self-reported": "self-report",
};

export const ACTIVITY_LABEL: Record<Activity, string> = {
  watch: "Watch",
  read: "Read",
  do: "Do",
  build: "Build",
  output: "Output",
  habit: "Habit",
  review: "Review",
  other: "Other",
};

export const ACTIVITIES: Activity[] = ["watch", "read", "do", "build", "output", "review", "other"];

/** Parses a minutes input; null unless it's a whole number in 1..1440. */
export function parseMinutes(value: string): number | null {
  const n = Number(value.trim());
  return Number.isInteger(n) && n >= 1 && n <= 1440 ? n : null;
}
