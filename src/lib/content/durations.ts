// Item times (spec §6.1) and skill estimates (spec §6.2).

import type { Estimate } from "@/lib/content/types";

const NUMBER = String.raw`\d+(?:\.\d+)?`;
const UNIT = String.raw`(hours?|hrs?|h|minutes?|mins?|min)(?![A-Za-z])`;
// One duration part: a number or a range (upper bound counts) plus a unit.
const PART = String.raw`(${NUMBER})(?:\s*[–-]\s*(${NUMBER}))?\s*${UNIT}`;

interface Part {
  minutes: number;
  isHours: boolean;
  end: number;
}

function matchPart(text: string, from: number): Part | null {
  const re = new RegExp(PART, "iy");
  re.lastIndex = from;
  const m = re.exec(text);
  if (!m) return null;
  const value = Number(m[2] ?? m[1]);
  const isHours = m[3].toLowerCase().startsWith("h");
  return { minutes: isHours ? value * 60 : value, isHours, end: re.lastIndex };
}

function skipSpaces(text: string, from: number): number {
  let i = from;
  while (i < text.length && /\s/.test(text[i])) i += 1;
  return i;
}

/** One duration without ranges across units: `1 h 30 min`, `1–2 h`, `45 min`. */
function singleDurationAt(text: string, pos: number): { minutes: number; end: number } | null {
  const first = matchPart(text, pos);
  if (!first) return null;
  let minutes = first.minutes;
  let end = first.end;
  if (first.isHours) {
    const second = matchPart(text, skipSpaces(text, end));
    // "1h30" (minutes glued to the hours unit) would otherwise leave "30" as a note.
    const glued = /(\d{1,2})m?(?![\w.])/y;
    glued.lastIndex = end;
    const gluedMatch = second ? null : glued.exec(text);
    if (second && !second.isHours) {
      minutes += second.minutes;
      end = second.end;
    } else if (gluedMatch) {
      minutes += Number(gluedMatch[1]);
      end = glued.lastIndex;
    }
  }
  return { minutes, end };
}

/** Parses a duration starting at `from` (`~1 h 30 min`, `~45 min–1 h`), or null. */
function durationAt(text: string, from: number): { minutes: number; end: number } | null {
  let pos = from;
  if (text[pos] === "~") pos = skipSpaces(text, pos + 1);
  const first = singleDurationAt(text, pos);
  if (!first) return null;
  // A range whose ends carry their own units (`45 min–1 h`) counts at its upper bound too.
  const separator = /\s*[–-]\s*~?\s*/y;
  separator.lastIndex = first.end;
  const upper = separator.exec(text) ? singleDurationAt(text, separator.lastIndex) : null;
  const minutes = Math.max(first.minutes, upper?.minutes ?? 0);
  return { minutes: Math.round(minutes), end: upper?.end ?? first.end };
}

/**
 * `~1 h 30 min` → 90, `~45 min at 1.5x` → 45 (note "at 1.5x"), `~1–2 h` → 120
 * (ranges count at their upper bound), `~1 h total` → 60 (note "total").
 * Returns null when the text doesn't start with a duration.
 */
export function parseDuration(text: string): { minutes: number; note: string | null } | null {
  const s = text.trim();
  const d = durationAt(s, 0);
  if (!d) return null;
  const note = s.slice(d.end).trim();
  return { minutes: d.minutes, note: note === "" ? null : note };
}

/** Every duration mentioned anywhere in `text`, in order. */
export function scanDurations(text: string): { minutes: number; index: number }[] {
  const out: { minutes: number; index: number }[] = [];
  let i = 0;
  while (i < text.length) {
    const startsToken = text[i] === "~" || (/\d/.test(text[i]) && (i === 0 || !/[\w.]/.test(text[i - 1])));
    const d = startsToken ? durationAt(text, i) : null;
    if (d) {
      out.push({ minutes: d.minutes, index: i });
      i = d.end;
    } else {
      i += 1;
    }
  }
  return out;
}

function toHours(minutes: number): number {
  return Math.round((minutes / 60) * 1000) / 1000;
}

/**
 * `~3.5 h` is core hours; any duration in a part (split at `+`, `,` or `;`)
 * that mentions "optional" counts as optional hours: `~3.5 h + optional book
 * (~6 h)` → 3.5/6, `~2 h (+1 h optional)` → 2/1, `~2 h, plus ~1 h optional` →
 * 2/1. Other trailing text is kept only in `text`.
 */
export function parseEstimate(text: string): Estimate {
  let core: number | null = null;
  let optional: number | null = null;
  for (const part of text.split(/[+,;]/)) {
    const found = scanDurations(part);
    if (found.length === 0) continue;
    const minutes = found.reduce((sum, d) => sum + d.minutes, 0);
    if (/optional/i.test(part)) optional = (optional ?? 0) + minutes;
    else core = (core ?? 0) + minutes;
  }
  return {
    text: text.trim(),
    hours: core === null ? null : toHours(core),
    optionalHours: optional === null ? null : toHours(optional),
  };
}

/** `~30 min`, `~1 h`, `~1.5 h`, `~1 h 15 min`. */
export function formatMinutes(minutes: number): string {
  const m = Math.max(0, Math.round(minutes));
  if (m < 60) return `~${m} min`;
  // Whole and half hours read better as decimals ("~1.5 h").
  if (m % 30 === 0) return `~${m / 60} h`;
  return `~${Math.floor(m / 60)} h ${m % 60} min`;
}
