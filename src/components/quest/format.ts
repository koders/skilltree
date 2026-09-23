// Display helpers for the quest page. Pure and locale-independent, so server
// and client render identical strings (no hydration drift from ICU data).

import { addDays, startOfWeek } from "@/lib/engine/dates";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function parts(date: string): { day: number; month: number; weekday: number } {
  const [y, m, d] = date.split("-").map(Number);
  const utc = new Date(Date.UTC(y, m - 1, d));
  return { day: d, month: m - 1, weekday: utc.getUTCDay() };
}

/** "Mon 21 Sep" */
export function formatDay(date: string): string {
  const p = parts(date);
  return `${WEEKDAYS[p.weekday]} ${p.day} ${MONTHS[p.month]}`;
}

/** "21 Sep" */
export function formatShortDate(date: string): string {
  const p = parts(date);
  return `${p.day} ${MONTHS[p.month]}`;
}

/** "21–27 Sep" or "28 Sep – 4 Oct". */
export function formatRange(start: string, end: string): string {
  const a = parts(start);
  const b = parts(end);
  if (a.month === b.month) return `${a.day}–${b.day} ${MONTHS[b.month]}`;
  return `${a.day} ${MONTHS[a.month]} – ${b.day} ${MONTHS[b.month]}`;
}

/** Monday of quest week `week` for a run whose week 1 contains `startedOn`. */
export function mondayOfWeek(startedOn: string, week: number): string {
  return addDays(startOfWeek(startedOn), (week - 1) * 7);
}

/** "4", "4.5", "12" — hours without a unit. */
export function hoursNumber(minutes: number): string {
  const h = minutes / 60;
  if (Number.isInteger(h)) return String(h);
  return h >= 10 ? String(Math.round(h)) : String(Math.round(h * 10) / 10);
}

/** "4–5 h" or "4 h". */
export function targetLabel(target: { min: number; max: number }): string {
  return target.min === target.max
    ? `${hoursNumber(target.min)} h`
    : `${hoursNumber(target.min)}–${hoursNumber(target.max)} h`;
}

export type PaceTone = "ahead" | "on-track" | "behind" | "far-behind";

export function paceInfo(paceWeeks: number): { label: string; tone: PaceTone; color: string } {
  if (paceWeeks > 0) {
    return { label: `+${paceWeeks} week${paceWeeks === 1 ? "" : "s"} ahead`, tone: "ahead", color: "var(--ok)" };
  }
  if (paceWeeks === 0) return { label: "On track", tone: "on-track", color: "var(--gold)" };
  const n = -paceWeeks;
  return {
    label: `${n} week${n === 1 ? "" : "s"} behind`,
    tone: n === 1 ? "behind" : "far-behind",
    color: n === 1 ? "var(--stale)" : "var(--rust-bright)",
  };
}

/** "(Rank 1)", "(Ranks 1–2)", "(Ranks 1, 3)"; empty for a whole-skill step. */
export function rankSuffix(ranks: number[] | null): string {
  if (!ranks || ranks.length === 0) return "";
  if (ranks.length === 1) return `(Rank ${ranks[0]})`;
  const sorted = [...ranks].sort((a, b) => a - b);
  const contiguous = sorted.every((r, i) => i === 0 || r === sorted[i - 1] + 1);
  return contiguous
    ? `(Ranks ${sorted[0]}–${sorted[sorted.length - 1]})`
    : `(Ranks ${sorted.join(", ")})`;
}

const TYPED_LINK = /\[@[a-z]+@([^\]]*)\]\([^)]*\)/g;
const LINK = /\[([^\]]*)\]\([^)]*\)/g;

/** Inline markdown → plain text, for aria-labels and titles. */
export function plainText(markdown: string): string {
  return markdown
    .replace(TYPED_LINK, "$1")
    .replace(LINK, "$1")
    .replace(/[*_`]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}
