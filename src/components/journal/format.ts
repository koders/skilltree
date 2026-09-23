// Display formatting for the habits, loot, journal and data pages. Dates are
// local `YYYY-MM-DD` strings (Europe/Riga); timestamps are UTC ISO strings
// and are shown on the Riga clock.

import { APP_TIMEZONE } from "@/lib/config";
import { diffDays, isIsoDate, isoWeekday, localDate } from "@/lib/engine/dates";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTHS_LONG = [
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
const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function parts(date: string): { y: number; m: number; d: number } {
  const [y, m, d] = date.split("-").map(Number);
  return { y, m, d };
}

/** "21 Sep", or "21 Sep 2025" when the year differs from `today`'s. */
export function fmtShort(date: string, today?: string): string {
  if (!isIsoDate(date)) return date;
  const { y, m, d } = parts(date);
  const withYear = today !== undefined && today.slice(0, 4) !== date.slice(0, 4);
  return `${d} ${MONTHS[m - 1]}${withYear ? ` ${y}` : ""}`;
}

/** "21 Sep 2026" */
export function fmtDate(date: string): string {
  if (!isIsoDate(date)) return date;
  const { y, m, d } = parts(date);
  return `${d} ${MONTHS[m - 1]} ${y}`;
}

/** "Mon 21 Sep" (year added when it isn't `today`'s year). */
export function fmtDay(date: string, today?: string): string {
  if (!isIsoDate(date)) return date;
  return `${WEEKDAYS[isoWeekday(date) - 1]} ${fmtShort(date, today)}`;
}

/** "September 2026" */
export function fmtMonth(date: string): string {
  const { y, m } = parts(date);
  return `${MONTHS_LONG[m - 1]} ${y}`;
}

/** "21–27 Sep", "28 Sep – 4 Oct" */
export function fmtRange(start: string, end: string): string {
  const a = parts(start);
  const b = parts(end);
  if (a.y === b.y && a.m === b.m) return `${a.d}–${b.d} ${MONTHS[a.m - 1]}`;
  return `${a.d} ${MONTHS[a.m - 1]} – ${b.d} ${MONTHS[b.m - 1]}`;
}

/** "Today", "Yesterday", else "Mon 21 Sep". */
export function relativeDay(date: string, today: string): string {
  const days = diffDays(date, today);
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days === -1) return "Tomorrow";
  return fmtDay(date, today);
}

/** "3 days ago", "in 12 days" */
export function fromToday(date: string, today: string): string {
  const days = diffDays(today, date);
  if (days === 0) return "today";
  if (days === 1) return "tomorrow";
  if (days === -1) return "yesterday";
  return days > 0 ? `in ${days} days` : `${-days} days ago`;
}

const CLOCK = new Intl.DateTimeFormat("en-GB", {
  timeZone: APP_TIMEZONE,
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

/** Riga wall-clock time of an instant, "13:02". */
export function fmtClock(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : CLOCK.format(d);
}

/** Local (Riga) calendar date of an instant; falls back to the raw prefix. */
export function dayOf(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso.slice(0, 10) : localDate(d);
}

export function plural(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`;
}

/** Hours with at most one decimal: 1.5, 2, 12. */
export function fmtHours(minutes: number): string {
  const h = minutes / 60;
  if (h >= 10 || Number.isInteger(h)) return String(Math.round(h));
  return h.toFixed(1).replace(/\.0$/, "");
}

/** Strips markdown links and emphasis for plain-text contexts (toasts, aria labels). */
export function plainText(markdown: string): string {
  return markdown
    .replace(/\[(?:@[\w-]+@)?([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/[*_`]/g, "")
    .trim();
}
