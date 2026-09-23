// Habit cadence (spec §5): an explicit `Cadence:` field, wording in the title,
// or the maintenance section's default.

import type { Cadence, CadenceUnit } from "@/lib/content/types";

const UNIT_OF: Record<string, CadenceUnit> = {
  week: "week",
  weekly: "week",
  month: "month",
  monthly: "month",
  year: "year",
  yearly: "year",
  annual: "year",
  annually: "year",
};

const FREQUENCY_WORDS: Record<string, number> = { once: 1, twice: 2, thrice: 3 };
const COUNT_WORDS: Record<string, number> = { a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6 };
// "10 min a week" is a time budget, not a count of occurrences.
const NOT_A_COUNTED_THING = /^(?:h|hr|hrs|hour|hours|min|mins|minute|minutes|times?|x|×)$/;

export function formatCadence(unit: CadenceUnit, times: number): string {
  if (times === 1) return { week: "weekly", month: "monthly", year: "yearly" }[unit];
  return `${times}× ${unit}`;
}

function cadence(unitWord: string, times: number): Cadence | null {
  const unit = UNIT_OF[unitWord.toLowerCase()];
  if (!unit || !Number.isFinite(times) || times < 1) return null;
  return { unit, times, text: formatCadence(unit, times) };
}

function stripLinkUrls(text: string): string {
  return text.replace(/\]\((?:[^()\s]|\([^()\s]*\))+\)/g, "]");
}

/** "2× week", "2x weekly", "twice-weekly", "3 times a month", "twice a week", "2x/week". */
function explicitFrequency(t: string): Cadence | null {
  const m = /(?:^|[^\w.])(?:(\d+)\s*(?:×|x|times)|(once|twice|thrice))[\s-]*(?:(?:a|an|per|each|every|\/|in\s+a)\s*)?(week|month|year)(?:ly)?\b/.exec(t);
  if (!m) return null;
  return cadence(m[3], m[1] ? Number(m[1]) : FREQUENCY_WORDS[m[2]]);
}

/** "one episode a month", "two reports per year". */
function countedThing(t: string): Cadence | null {
  const re = /\b(a|an|one|two|three|four|five|six|\d+)\s+((?:[a-z][\w'’-]*\s+){1,2}?)(?:a|per|each|every)\s+(week|month|year)\b/g;
  for (let m = re.exec(t); m; m = re.exec(t)) {
    const words = m[2].trim().split(/\s+/);
    if (words.some((w) => NOT_A_COUNTED_THING.test(w) || w in FREQUENCY_WORDS)) continue;
    const times = /^\d+$/.test(m[1]) ? Number(m[1]) : COUNT_WORDS[m[1]];
    return cadence(m[3], times);
  }
  return null;
}

function adjective(t: string): Cadence | null {
  const m = /\b(weekly|monthly|yearly|annually|annual)\b/.exec(t);
  return m ? cadence(m[1], 1) : null;
}

function everyUnit(t: string): Cadence | null {
  const m = /\b(?:every|per|each)\s+(week|month|year)\b/.exec(t);
  return m ? cadence(m[1], 1) : null;
}

function findCadence(text: string): Cadence | null {
  const t = stripLinkUrls(text).toLowerCase();
  return explicitFrequency(t) ?? countedThing(t) ?? adjective(t) ?? everyUnit(t);
}

/** Explicit cadence text: `weekly`, `monthly`, `yearly`/`annually`, `2× week`, `twice a week`, `3x month`… */
export function parseCadence(text: string): Cadence | null {
  const bare = text.trim().toLowerCase();
  if (bare in UNIT_OF) return cadence(bare, 1);
  return findCadence(text);
}

/** Cadence implied by a habit title: "one episode a month", "Annual …", "10 min twice a week". */
export function inferCadenceFromTitle(title: string): Cadence | null {
  return findCadence(title);
}
