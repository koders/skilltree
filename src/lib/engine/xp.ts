// XP, levels and the weekly streak (docs/decisions.md D6, guide §7). Pure:
// `today` is passed in. XP is always a whole number: each log is rounded once,
// so per-skill, per-week and total sums agree.

import {
  STREAK_MIN_MINUTES_PER_WEEK,
  XP_PER_MINUTE,
  XP_PER_RECALL_PASS,
  xpForLevel,
} from "@/lib/config";
import { addDays, isIsoDate, localDate, startOfWeek } from "@/lib/engine/dates";
import type { WeekTotal, XpSummary } from "@/lib/engine/types";
import type { Activity, ProgressSnapshot, RecallAttemptRow } from "@/lib/progress/types";

const WEEKS_SHOWN = 12;

export interface LevelInfo {
  level: number;
  levelFloor: number;
  nextLevelAt: number;
  progressToNext: number;
}

export function levelForXp(total: number): LevelInfo {
  const xp = Number.isFinite(total) && total > 0 ? total : 0;
  let level = 1;
  while (xpForLevel(level + 1) <= xp) level += 1;
  const levelFloor = xpForLevel(level);
  const nextLevelAt = xpForLevel(level + 1);
  const span = nextLevelAt - levelFloor;
  return { level, levelFloor, nextLevelAt, progressToNext: span > 0 ? clamp01((xp - levelFloor) / span) : 0 };
}

export function xpForLog(activity: Activity, minutes: number): number {
  return Math.round(positiveMinutes(minutes) * XP_PER_MINUTE[knownActivity(activity)]);
}

/**
 * Unknown activities (e.g. a value added to the DB before the app knows it)
 * count as "other". Own keys only, so "toString" can't pick up a prototype method.
 */
function knownActivity(activity: string): Activity {
  return Object.hasOwn(XP_PER_MINUTE, activity) ? (activity as Activity) : "other";
}

export function recallBonusFor(attempts: RecallAttemptRow[]): number {
  return countedRecallPasses(attempts).length * XP_PER_RECALL_PASS;
}

/**
 * Passes that earn the recall bonus, oldest first. Review passes always
 * count; test-out and completion passes count once per (skill, question), so
 * retaking a test-out can't farm XP.
 */
export function countedRecallPasses(attempts: RecallAttemptRow[]): RecallAttemptRow[] {
  const passes = attempts
    .filter((a) => a.result === "pass")
    .map((a, i) => ({ a, i, at: Date.parse(a.createdAt) }))
    .sort((x, y) => compareTimes(x.at, y.at) || x.i - y.i)
    .map(({ a }) => a);
  const seen = new Set<string>();
  const counted: RecallAttemptRow[] = [];
  for (const a of passes) {
    if (a.mode !== "review") {
      const key = `${a.skillId}\u0000${a.questionId}`;
      if (seen.has(key)) continue;
      seen.add(key);
    }
    counted.push(a);
  }
  return counted;
}

export function computeXp(snapshot: ProgressSnapshot, today: string): XpSummary {
  const currentWeek = startOfWeek(today);
  const minutesByWeek = new Map<string, number>();
  const xpByWeek = new Map<string, number>();
  const byActivity: Partial<Record<Activity, number>> = {};
  let minutesTotal = 0;
  let logXp = 0;

  for (const log of snapshot.timeLogs) {
    const minutes = positiveMinutes(log.minutes);
    const xp = xpForLog(log.activity, log.minutes);
    minutesTotal += minutes;
    logXp += xp;
    const activity = knownActivity(log.activity);
    byActivity[activity] = (byActivity[activity] ?? 0) + xp;
    if (!isIsoDate(log.loggedOn)) continue;
    const week = startOfWeek(log.loggedOn);
    addTo(minutesByWeek, week, minutes);
    addTo(xpByWeek, week, xp);
  }

  const passes = countedRecallPasses(snapshot.recallAttempts);
  const recallBonus = passes.length * XP_PER_RECALL_PASS;
  for (const pass of passes) {
    if (Number.isNaN(Date.parse(pass.createdAt))) continue;
    addTo(xpByWeek, startOfWeek(localDate(pass.createdAt)), XP_PER_RECALL_PASS);
  }

  const total = logXp + recallBonus;
  const weeks: WeekTotal[] = Array.from({ length: WEEKS_SHOWN }, (_, i) => {
    const weekStart = addDays(currentWeek, (i - (WEEKS_SHOWN - 1)) * 7);
    return { weekStart, minutes: minutesByWeek.get(weekStart) ?? 0, xp: xpByWeek.get(weekStart) ?? 0 };
  });

  return {
    total,
    ...levelForXp(total),
    byActivity,
    recallBonus,
    minutesTotal,
    thisWeekMinutes: minutesByWeek.get(currentWeek) ?? 0,
    weeklyStreak: weeklyStreak(minutesByWeek, currentWeek),
    weeks,
  };
}

function weeklyStreak(minutesByWeek: Map<string, number>, currentWeek: string): number {
  const qualifies = (week: string) => (minutesByWeek.get(week) ?? 0) >= STREAK_MIN_MINUTES_PER_WEEK;
  // The current week may still be in progress: don't break the streak before it's over.
  let week = qualifies(currentWeek) ? currentWeek : addDays(currentWeek, -7);
  let streak = 0;
  while (qualifies(week)) {
    streak += 1;
    week = addDays(week, -7);
  }
  return streak;
}

function positiveMinutes(minutes: number): number {
  return Number.isFinite(minutes) && minutes > 0 ? minutes : 0;
}

function addTo(map: Map<string, number>, key: string, value: number): void {
  map.set(key, (map.get(key) ?? 0) + value);
}

function compareTimes(a: number, b: number): number {
  if (Number.isNaN(a) || Number.isNaN(b)) return Number.isNaN(a) ? (Number.isNaN(b) ? 0 : 1) : -1;
  return a - b;
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}
