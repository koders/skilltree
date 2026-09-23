// Calendar-date helpers. Dates are plain `YYYY-MM-DD` strings in the app's
// local zone (Europe/Riga); arithmetic runs on UTC midnights so DST never
// shifts a day. Only `localToday` / `localDate` touch real time zones.

import type { CadenceUnit } from "@/lib/content/types";
import { APP_TIMEZONE } from "@/lib/config";

const DAY_MS = 86_400_000;

function toUtc(date: string): number {
  const [y, m, d] = date.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
}

function fromUtc(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

/** The calendar date of `instant` in `timeZone`, as YYYY-MM-DD. */
export function localDate(instant: Date | string, timeZone: string = APP_TIMEZONE): string {
  const d = typeof instant === "string" ? new Date(instant) : instant;
  // en-CA formats as YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

export function localToday(now: Date = new Date(), timeZone: string = APP_TIMEZONE): string {
  return localDate(now, timeZone);
}

export function isIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  return fromUtc(toUtc(value)) === value;
}

export function addDays(date: string, days: number): string {
  return fromUtc(toUtc(date) + days * DAY_MS);
}

/** Whole days from `a` to `b` (positive when b is later). */
export function diffDays(a: string, b: string): number {
  return Math.round((toUtc(b) - toUtc(a)) / DAY_MS);
}

/** ISO weekday: Monday = 1 … Sunday = 7. */
export function isoWeekday(date: string): number {
  const day = new Date(toUtc(date)).getUTCDay();
  return day === 0 ? 7 : day;
}

/** Monday of the ISO week containing `date`. */
export function startOfWeek(date: string): string {
  return addDays(date, 1 - isoWeekday(date));
}

export function startOfMonth(date: string): string {
  return `${date.slice(0, 7)}-01`;
}

export function startOfYear(date: string): string {
  return `${date.slice(0, 4)}-01-01`;
}

export function addMonths(date: string, months: number): string {
  const [y, m] = date.split("-").map(Number);
  const total = y * 12 + (m - 1) + months;
  const ny = Math.floor(total / 12);
  const nm = (total % 12) + 1;
  return `${String(ny).padStart(4, "0")}-${String(nm).padStart(2, "0")}-01`;
}

/** Start of the cadence period containing `date`. */
export function periodStart(date: string, unit: CadenceUnit): string {
  if (unit === "week") return startOfWeek(date);
  if (unit === "month") return startOfMonth(date);
  return startOfYear(date);
}

/** Last day of the period that starts at `start`. */
export function periodEnd(start: string, unit: CadenceUnit): string {
  if (unit === "week") return addDays(start, 6);
  if (unit === "month") return addDays(addMonths(start, 1), -1);
  return `${start.slice(0, 4)}-12-31`;
}

/** Start of the period before the one starting at `start`. */
export function previousPeriodStart(start: string, unit: CadenceUnit): string {
  if (unit === "week") return addDays(start, -7);
  if (unit === "month") return addMonths(start, -1);
  return `${Number(start.slice(0, 4)) - 1}-01-01`;
}

/** 1-based week number of `date` in a run whose week 1 starts on `weekOneMonday`. */
export function weekNumber(weekOneMonday: string, date: string): number {
  return Math.floor(diffDays(weekOneMonday, date) / 7) + 1;
}
