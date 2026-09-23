// View model for /habits: HabitView (engine) + owner display data + the
// habit-log id the "undo" button removes. Pure; built on the server.

import type { CadenceUnit, ContentIndex } from "@/lib/content/types";
import { addDays, diffDays, startOfWeek } from "@/lib/engine/dates";
import type { HabitView, QuestView } from "@/lib/engine/types";
import type { ProgressSnapshot } from "@/lib/progress/types";
import { branchColor } from "@/components/ui/meta";
import { fmtDay, fmtRange, plainText, plural, relativeDay } from "@/components/journal/format";

export interface HabitCardModel {
  key: string;
  unit: CadenceUnit;
  /** Inline markdown (may contain typed resource links). */
  title: string;
  titlePlain: string;
  minutes: number | null;
  ownerKind: HabitView["ownerKind"];
  ownerTitle: string;
  ownerId: string;
  ownerColor: string;
  cadenceLabel: string;
  periodLabel: string;
  /** "this week" / "this month" / "this year" */
  periodNoun: string;
  doneThisPeriod: number;
  target: number;
  complete: boolean;
  streak: number;
  streakLabel: string;
  lastDoneLabel: string | null;
  active: boolean;
  inactiveReason: string | null;
  /** Newest check-off in the current period (undo target). */
  latestLogId: string | null;
}

const UNIT_ORDER: CadenceUnit[] = ["week", "month", "year"];
const CADENCE_NAME: Record<CadenceUnit, string> = { week: "Weekly", month: "Monthly", year: "Yearly" };

export function cadenceLabel(unit: CadenceUnit, times: number): string {
  return times > 1 ? `${times}× a ${unit}` : CADENCE_NAME[unit];
}

function periodLabel(h: HabitView): string {
  if (h.cadence.unit === "week") return fmtRange(h.periodStart, h.periodEnd);
  if (h.cadence.unit === "month") {
    return new Date(`${h.periodStart}T00:00:00Z`).toLocaleString("en-GB", { month: "long", timeZone: "UTC" });
  }
  return h.periodStart.slice(0, 4);
}

function lastDone(date: string, today: string): string {
  const label = relativeDay(date, today);
  return label === "Today" || label === "Yesterday" ? label.toLowerCase() : label;
}

export function buildHabitCards(
  habits: HabitView[],
  index: ContentIndex,
  snapshot: ProgressSnapshot,
  today: string,
): HabitCardModel[] {
  const branchIndex = new Map(index.tree.branches.map((b, i) => [b.id, i]));
  return habits.map((h) => {
    const unit = h.cadence.unit;
    let ownerTitle = h.ownerId;
    let ownerColor = "var(--gold)";
    if (h.ownerKind === "quest") {
      ownerTitle = index.quests[h.ownerId]?.title ?? h.ownerId;
    } else {
      const skill = index.skills[h.ownerId];
      if (skill) {
        ownerTitle = skill.title;
        const branch = index.branches[skill.branchId];
        if (branch) ownerColor = branchColor(branch, branchIndex.get(branch.id) ?? 0);
      }
    }
    const latest = snapshot.habitLogs
      .filter((l) => l.habitKey === h.key && l.doneOn >= h.periodStart && l.doneOn <= h.periodEnd)
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0))[0];
    return {
      key: h.key,
      unit,
      title: h.title,
      titlePlain: plainText(h.title),
      minutes: h.minutes,
      ownerKind: h.ownerKind,
      ownerTitle,
      ownerId: h.ownerId,
      ownerColor,
      cadenceLabel: cadenceLabel(unit, h.target),
      periodLabel: periodLabel(h),
      periodNoun: `this ${unit}`,
      doneThisPeriod: h.doneThisPeriod,
      target: h.target,
      complete: h.complete,
      streak: h.streak,
      streakLabel: h.streak > 0 ? plural(h.streak, unit) : "No streak yet",
      lastDoneLabel: h.lastDoneOn ? lastDone(h.lastDoneOn, today) : null,
      active: h.active,
      inactiveReason: h.inactiveReason,
      latestLogId: latest?.id ?? null,
    };
  });
}

export function groupByUnit(cards: HabitCardModel[]): { unit: CadenceUnit; label: string; cards: HabitCardModel[] }[] {
  return UNIT_ORDER.map((unit) => ({ unit, label: CADENCE_NAME[unit], cards: cards.filter((c) => c.unit === unit) })).filter(
    (g) => g.cards.length > 0,
  );
}

/** "Resets Monday · 5 days left" for the current period of `unit`. */
export function resetHint(unit: CadenceUnit, periodEnd: string, today: string): string {
  const left = diffDays(today, periodEnd) + 1;
  const next = addDays(periodEnd, 1);
  const when = unit === "week" ? "Monday" : fmtDay(next, today);
  return `Resets ${when} · ${plural(left, "day")} left`;
}

export interface HabitsSummary {
  maintenanceMinutes: number;
  /** Weekly maintenance target of the relevant quest, in minutes. */
  targetMinutes: number | null;
  questTitle: string | null;
  questNote: string | null;
  activeCount: number;
  completeCount: number;
  bestStreak: { streak: number; unit: CadenceUnit } | null;
}

export function summarize(
  habits: HabitView[],
  index: ContentIndex,
  snapshot: ProgressSnapshot,
  quests: QuestView[],
  activeQuest: QuestView | null,
  today: string,
): HabitsSummary {
  const weekStart = startOfWeek(today);
  const weekEnd = addDays(weekStart, 6);
  const maintenanceMinutes = snapshot.timeLogs
    .filter((l) => l.habitKey !== null && l.loggedOn >= weekStart && l.loggedOn <= weekEnd)
    .reduce((sum, l) => sum + Math.max(0, l.minutes), 0);

  const quest =
    (activeQuest ? index.quests[activeQuest.questId] : undefined) ??
    index.tree.quests.find((q) => q.maintenance?.hoursPerWeek != null) ??
    null;
  const hours = quest?.maintenance?.hoursPerWeek ?? null;
  const view = quest ? quests.find((q) => q.questId === quest.id) : undefined;
  let questNote: string | null = null;
  if (view) {
    if (view.status === "not-started" || view.status === "abandoned") questNote = "Start the quest to schedule its maintenance";
    else if (view.status === "paused") questNote = "Quest paused, so maintenance is on hold";
    else if (!view.maintenance.active && view.maintenance.fromWeek) {
      questNote = `Quest maintenance starts in week ${view.maintenance.fromWeek}`;
    }
  }

  const active = habits.filter((h) => h.active);
  let bestStreak: HabitsSummary["bestStreak"] = null;
  for (const h of active) {
    if (h.streak > 0 && (bestStreak === null || h.streak > bestStreak.streak)) {
      bestStreak = { streak: h.streak, unit: h.cadence.unit };
    }
  }
  return {
    maintenanceMinutes,
    targetMinutes: hours !== null ? Math.round(hours * 60) : null,
    questTitle: quest?.title ?? null,
    questNote,
    activeCount: active.length,
    completeCount: active.filter((h) => h.complete).length,
    bestStreak,
  };
}
