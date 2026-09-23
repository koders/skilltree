// Everything the quest page's server components share, built once from
// getAppData(). Server-side only: it holds the whole AppData, and client
// components get slim props cut from it instead.

import type { Quest } from "@/lib/content/types";
import type { AppData } from "@/lib/data";
import { localDate } from "@/lib/engine/dates";
import type { PlanEntry, QuestView, SkillState, ThisWeek, TreeState } from "@/lib/engine/types";
import { branchColor } from "@/components/ui/meta";
import { mondayOfWeek } from "./format";

export interface SkillRef {
  id: string;
  title: string;
  /** Branch hue. */
  color: string;
  state: SkillState;
  learned: boolean;
}

export interface QuestContext {
  app: AppData;
  quest: Quest;
  view: QuestView;
  skill: (id: string) => SkillRef;
  /** Last week of the last bounded stage (12 in the seed). */
  lastBoundedWeek: number;
  /** An open-ended stage ("13+") follows the bounded ones. */
  hasOpenStage: boolean;
  /** Every week that has plan entries, plus any empty bounded week, ascending. */
  weeks: number[];
  entriesByWeek: Map<number, PlanEntry[]>;
  /** Monday of a quest week; null before the quest starts. */
  weekMonday: (week: number) => string | null;
  stageHue: (stageIndex: number) => string;
  stageOfWeek: (week: number) => number;
}

// Stage hues run cool → warm along the route.
const STAGE_HUES = ["#5ec8f2", "#7ee0d0", "#b69cff", "#f28f6b", "#9fb4ff", "#f2c14e", "#ff7eb6", "#56d39b"];

export function buildQuestContext(app: AppData, questId: string): QuestContext | null {
  const quest = Object.hasOwn(app.index.quests, questId) ? app.index.quests[questId] : undefined;
  const view = app.quests.find((q) => q.questId === questId);
  if (!quest || !view) return null;

  const branchHue = new Map(app.tree.branches.map((b, i) => [b.id, branchColor(b, i)]));
  const skill = (id: string): SkillRef => {
    const content = Object.hasOwn(app.index.skills, id) ? app.index.skills[id] : undefined;
    const state = Object.hasOwn(app.state.skills, id) ? app.state.skills[id] : undefined;
    return {
      id,
      title: content?.title ?? id,
      color: (content && branchHue.get(content.branchId)) ?? "var(--mist)",
      state: state?.state ?? "locked",
      learned: state?.learned ?? false,
    };
  };

  const bounded = quest.stages.filter((s) => s.weekEnd !== null);
  const lastBoundedWeek = Math.max(quest.weeks ?? 0, ...bounded.map((s) => s.weekEnd ?? 0), 1);
  const hasOpenStage = quest.stages.some((s) => s.weekEnd === null);

  const entriesByWeek = new Map<number, PlanEntry[]>();
  for (const entry of view.plan) {
    const list = entriesByWeek.get(entry.week);
    if (list) list.push(entry);
    else entriesByWeek.set(entry.week, [entry]);
  }
  const lastPlanned = Math.max(lastBoundedWeek, ...entriesByWeek.keys());
  const weeks = Array.from({ length: lastPlanned }, (_, i) => i + 1).filter(
    (w) => w <= lastBoundedWeek || entriesByWeek.has(w),
  );

  const startedOn = view.run?.startedOn ?? null;
  const stageOfWeek = (week: number) =>
    quest.stages.findIndex((s) => week >= s.weekStart && week <= (s.weekEnd ?? Infinity));

  return {
    app,
    quest,
    view,
    skill,
    lastBoundedWeek,
    hasOpenStage,
    weeks,
    entriesByWeek,
    weekMonday: (week) => (startedOn ? mondayOfWeek(startedOn, week) : null),
    stageHue: (i) => (i < 0 ? "var(--mist)" : STAGE_HUES[i % STAGE_HUES.length]),
    stageOfWeek,
  };
}

/** Status the planner reports is final; "cleared" = done or skipped. */
export function isCleared(entry: PlanEntry): boolean {
  return entry.status !== "todo";
}

/**
 * Keys of other weeks' entries cleared during this quest week. The planner
 * lists only open carry-over and get-ahead entries; adding these back keeps
 * the count moving, Undo in reach, and a Recall step's row (which owns its
 * dialog) mounted long enough to show the result.
 */
export function bankedKeys(
  plan: PlanEntry[],
  week: Pick<ThisWeek, "week" | "weekStart" | "weekEnd">,
  state: Pick<TreeState, "items" | "skills">,
): Set<string> {
  const within = (at: string | null) => {
    if (!at) return false;
    const day = localDate(at);
    return day >= week.weekStart && day <= week.weekEnd;
  };
  const clearedAt = (entry: PlanEntry): string | null => {
    if (entry.kind === "recall") return Object.hasOwn(state.skills, entry.skillId) ? state.skills[entry.skillId].learnedAt : null;
    return Object.hasOwn(state.items, entry.key) ? state.items[entry.key].completedAt : null;
  };
  return new Set(plan.filter((e) => e.week !== week.week && isCleared(e) && within(clearedAt(e))).map((e) => e.key));
}

/** Distinct skills the quest's stages name, in route order. */
export function questSkillIds(quest: Quest): string[] {
  return [...new Set(quest.stages.flatMap((s) => s.steps.map((step) => step.skillId)))];
}
