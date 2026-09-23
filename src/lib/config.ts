// Tunable game mechanics and app settings (docs/decisions.md D6). Changing
// these never needs a migration: every derived value is recomputed on read.

import type { Activity } from "@/lib/progress/types";

/** All week/day boundaries are computed in this zone. */
export const APP_TIMEZONE = "Europe/Riga";

/** Days before a time-sensitive fact goes stale (guide §5). */
export const FRESHNESS_DAYS = 90;

/** XP per minute logged, by activity (guide §7: active work earns more). */
export const XP_PER_MINUTE: Record<Activity, number> = {
  watch: 1,
  read: 1,
  habit: 1,
  do: 1.5,
  build: 2,
  output: 2,
  review: 1,
  other: 1,
};

/** XP bonus per recall question passed (test-out, completion or review). */
export const XP_PER_RECALL_PASS = 10;

/** Total XP needed to reach `level` (level 1 = 0 XP). */
export function xpForLevel(level: number): number {
  if (level <= 1) return 0;
  return Math.round(100 * Math.pow(level - 1, 1.8));
}

/** A week counts toward the streak when at least this many minutes were logged. */
export const STREAK_MIN_MINUTES_PER_WEEK = 120;

/** Default minutes for the "answer Recall" step the quest plan adds after each skill. */
export const RECALL_STEP_MINUTES = 15;

/**
 * Largest progress file (in chars) the Data page imports. next.config.ts sizes
 * the Server Action body limit from it; bigger files go through
 * `pnpm progress:import`.
 */
export const IMPORT_MAX_CHARS = 20_000_000;

/** Leitner intervals in days for boxes 1..n (future spaced review, guide §7). */
export const LEITNER_INTERVALS_DAYS = [1, 3, 7, 14, 30, 60] as const;

/** Guide §3 / §6 sizing (validator warnings). */
export const ITEM_MIN_MINUTES = 10;
export const ITEM_MAX_MINUTES = 120;
export const RANK_MIN_MINUTES = 60;
export const RANK_MAX_MINUTES = 300;
export const ESTIMATE_TOLERANCE = 0.25;
export const MAX_RESOURCES_PER_ITEM = 5;
export const MIN_TEXT_LENGTH = 40;
