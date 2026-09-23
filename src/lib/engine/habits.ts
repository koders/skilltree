// Maintenance habits: quest maintenance items and the monthly/annual habits
// inside skills (format-spec §5, guide §8). Pure: `today` is passed in.

import type { Cadence, ContentIndex, Item, Quest, Skill } from "@/lib/content/types";
import { isIsoDate, periodEnd, periodStart, previousPeriodStart } from "@/lib/engine/dates";
import { isLearnedState } from "@/lib/engine/state";
import type { HabitView, TreeState } from "@/lib/engine/types";
import type { HabitLogRow, ProgressSnapshot } from "@/lib/progress/types";

export const DEFAULT_HABIT_CADENCE: Cadence = { unit: "week", times: 1, text: "weekly" };

interface Activation {
  active: boolean;
  inactiveReason: string | null;
}

/**
 * @param questWeeks current week number of each quest's active run; a missing
 *   or null entry means the quest has no active run.
 */
export function computeHabits(
  index: ContentIndex,
  snapshot: ProgressSnapshot,
  tree: TreeState,
  questWeeks: Record<string, number | null>,
  today: string,
): HabitView[] {
  const logsByKey = new Map<string, HabitLogRow[]>();
  for (const log of snapshot.habitLogs) {
    logsByKey.set(log.habitKey, [...(logsByKey.get(log.habitKey) ?? []), log]);
  }
  const view = (ownerKind: HabitView["ownerKind"], item: Item, cadence: Cadence, activation: Activation) =>
    habitView(ownerKind, item, cadence, activation, logsByKey.get(item.key) ?? [], today);

  const questHabits = Object.values(index.quests).flatMap((quest) => {
    const activation = questActivation(quest, questWeeks);
    const fallback = quest.maintenance?.cadence ?? DEFAULT_HABIT_CADENCE;
    return (quest.maintenance?.items ?? []).map((item) =>
      view("quest", item, item.cadence ?? fallback, activation),
    );
  });
  const skillHabits = Object.values(index.skills).flatMap((skill) => {
    const activation = skillActivation(skill, tree);
    return skill.ranks
      .flatMap((rank) => rank.items)
      .filter((item) => item.type === "habit")
      .map((item) => view("skill", item, item.cadence ?? DEFAULT_HABIT_CADENCE, activation));
  });

  // Array.prototype.sort is stable, so content order survives within each group.
  return [...questHabits, ...skillHabits].sort((a, b) => Number(b.active) - Number(a.active));
}

function questActivation(quest: Quest, questWeeks: Record<string, number | null>): Activation {
  // Same rule as QuestView.maintenance (quest.ts): never before week 1.
  const fromWeek = Math.max(1, quest.maintenance?.fromWeek ?? 1);
  const week: unknown = Object.hasOwn(questWeeks, quest.id) ? questWeeks[quest.id] : undefined;
  if (typeof week !== "number") return { active: false, inactiveReason: "Start the quest to unlock" };
  if (week < fromWeek) return { active: false, inactiveReason: `Starts in quest week ${fromWeek}` };
  return { active: true, inactiveReason: null };
}

function skillActivation(skill: Skill, tree: TreeState): Activation {
  const state = Object.hasOwn(tree.skills, skill.id) ? tree.skills[skill.id].state : null;
  if (state !== null && (state === "in-progress" || isLearnedState(state))) {
    return { active: true, inactiveReason: null };
  }
  return { active: false, inactiveReason: `Unlocks when you start ${skill.title}` };
}

function habitView(
  ownerKind: HabitView["ownerKind"],
  item: Item,
  cadence: Cadence,
  activation: Activation,
  logs: HabitLogRow[],
  today: string,
): HabitView {
  const unit = cadence.unit;
  const target = Number.isFinite(cadence.times) ? Math.max(1, cadence.times) : 1;
  const current = periodStart(today, unit);

  const doneByPeriod = new Map<string, number>();
  let lastDoneOn: string | null = null;
  for (const log of logs) {
    const period = logPeriod(log, unit);
    if (period !== null) doneByPeriod.set(period, (doneByPeriod.get(period) ?? 0) + 1);
    if (isIsoDate(log.doneOn) && (lastDoneOn === null || log.doneOn > lastDoneOn)) lastDoneOn = log.doneOn;
  }

  const doneThisPeriod = doneByPeriod.get(current) ?? 0;
  const complete = doneThisPeriod >= target;
  let streak = 0;
  let period = complete ? current : previousPeriodStart(current, unit);
  while ((doneByPeriod.get(period) ?? 0) >= target) {
    streak += 1;
    period = previousPeriodStart(period, unit);
  }

  return {
    key: item.key,
    ownerId: item.ownerId,
    ownerKind,
    itemId: item.id,
    title: item.title,
    minutes: item.minutes,
    cadence,
    active: activation.active,
    inactiveReason: activation.inactiveReason,
    periodStart: current,
    periodEnd: periodEnd(current, unit),
    doneThisPeriod,
    target,
    complete,
    streak,
    lastDoneOn,
  };
}

/**
 * The period a log counts toward under the habit's *current* cadence. The
 * stored periodStart was derived from doneOn with the cadence of the day
 * (db/mutations logHabit), so doneOn is the fact: re-deriving from it keeps
 * a log in the right period after the content's cadence changes, even when
 * the old period straddles two new ones (a week across a month end).
 */
function logPeriod(log: HabitLogRow, unit: Cadence["unit"]): string | null {
  if (isIsoDate(log.doneOn)) return periodStart(log.doneOn, unit);
  if (isIsoDate(log.periodStart)) return periodStart(log.periodStart, unit);
  return null;
}
