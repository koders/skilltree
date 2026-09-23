// Quest planner (docs/decisions.md D7). A run stores only its start Monday;
// everything here is derived from (content, progress snapshot, tree state,
// today): the week plan, "this week", stage progress and pace.

import { RECALL_STEP_MINUTES } from "@/lib/config";
import {
  isStartingSkill,
  type ContentIndex,
  type Item,
  type Quest,
  type QuestStage,
  type QuestStep,
  type Rank,
  type Skill,
} from "@/lib/content/types";
import { addDays, isIsoDate, startOfWeek, weekNumber } from "@/lib/engine/dates";
import type { PlanEntry, QuestView, StageStepView, StageView, ThisWeek, TreeState } from "@/lib/engine/types";
import type { ItemStatus, ProgressSnapshot, QuestRunRow } from "@/lib/progress/types";

/** Planning estimate for an item without a parsed time (the validator flags those). */
const DEFAULT_ITEM_MINUTES = 30;
/** Weekly hours when neither the run nor the quest sets a target. */
const DEFAULT_HOURS_PER_WEEK = 5;
const GET_AHEAD_LIMIT = 5;
/** Absorbs float error when cumulative minutes land exactly on a week boundary. */
const WEEK_EPSILON = 1e-9;

// ---------------------------------------------------------------- runs

/**
 * The run the quest page shows: the active run, else the latest paused one,
 * else the latest completed one. Abandoned runs are never shown.
 */
export function currentRun(snapshot: ProgressSnapshot, questId: string): QuestRunRow | null {
  const runs = snapshot.questRuns.filter((r) => r.questId === questId);
  // At most one run is active across all quests (DB index), and it is the one
  // being worked on even if a paused run of the same quest was touched later.
  for (const status of ["active", "paused", "completed"] as const) {
    const latest = runs.filter((r) => r.status === status).sort(newestFirst)[0];
    if (latest) return latest;
  }
  return null;
}

// Rows written in one transaction share now(), so ids break ties to keep the
// pick independent of the order the DB returns rows in.
function newestFirst(a: QuestRunRow, b: QuestRunRow): number {
  return (
    timeOf(b.updatedAt) - timeOf(a.updatedAt) ||
    timeOf(b.createdAt) - timeOf(a.createdAt) ||
    (a.id < b.id ? 1 : a.id > b.id ? -1 : 0)
  );
}

function timeOf(iso: string): number {
  const t = Date.parse(iso);
  return Number.isNaN(t) ? 0 : t;
}

function weeklyCapacityMinutes(quest: Quest, run: QuestRunRow | null): number {
  return (run?.hoursPerWeek ?? quest.hoursPerWeek?.max ?? DEFAULT_HOURS_PER_WEEK) * 60;
}

function targetMinutes(quest: Quest, run: QuestRunRow | null): ThisWeek["targetMinutes"] {
  if (run?.hoursPerWeek != null) return { min: run.hoursPerWeek * 60, max: run.hoursPerWeek * 60 };
  if (quest.hoursPerWeek) return { min: quest.hoursPerWeek.min * 60, max: quest.hoursPerWeek.max * 60 };
  return null;
}

/** Own-property lookup, so content ids like "constructor" never hit Object.prototype. */
function lookup<T>(record: Record<string, T>, key: string): T | undefined {
  return Object.hasOwn(record, key) ? record[key] : undefined;
}

// ---------------------------------------------------------------- plan

type DraftEntry = Omit<PlanEntry, "week">;

/** What one quest step adds to the plan. */
interface ScheduledStep {
  step: QuestStep;
  /** null when the step names an unknown skill. */
  skill: Skill | null;
  /** Ranks this step schedules for the first time, in rank order. */
  ranks: Rank[];
  /** The skill's "answer Recall" step is planned right after this step. */
  closesSkill: boolean;
}

/**
 * Walks the steps in quest order. A rank scheduled by an earlier step is not
 * repeated, and a skill's Recall step follows the step that schedules its
 * last remaining rank.
 */
function scheduleSteps(index: ContentIndex, quest: Quest): ScheduledStep[][] {
  const covered = new Map<string, Set<number>>();
  const closed = new Set<string>();
  return quest.stages.map((stage) =>
    stage.steps.map((step): ScheduledStep => {
      const skill = lookup(index.skills, step.skillId) ?? null;
      if (!skill) return { step, skill, ranks: [], closesSkill: false };
      const done = covered.get(skill.id) ?? new Set<number>();
      covered.set(skill.id, done);
      const ranks = skill.ranks.filter((r) => inStep(step, r.number) && !done.has(r.number));
      for (const rank of ranks) done.add(rank.number);
      const closesSkill =
        !closed.has(skill.id) && hasRecallStep(skill) && skill.ranks.every((r) => done.has(r.number));
      if (closesSkill) closed.add(skill.id);
      return { step, skill, ranks, closesSkill };
    }),
  );
}

/**
 * Every blocking item of the quest's steps in order, plus an "answer Recall"
 * step once a skill's ranks are all scheduled, spread over each stage's weeks
 * by cumulative minutes. A rank scheduled by an earlier step is not repeated.
 */
export function buildPlan(
  index: ContentIndex,
  quest: Quest,
  tree: TreeState,
  weeklyCapacityMinutes: number,
): PlanEntry[] {
  return scheduleSteps(index, quest).flatMap((steps, stageIndex) => {
    const drafts: DraftEntry[] = [];
    for (const { skill, ranks, closesSkill } of steps) {
      if (!skill) continue;
      for (const rank of ranks) {
        for (const item of rank.items) {
          if (isBlocking(item)) drafts.push(itemEntry(index, tree, skill, rank.number, item, stageIndex));
        }
      }
      if (closesSkill) drafts.push(recallEntry(index, tree, skill, stageIndex));
    }
    return assignWeeks(drafts, quest.stages[stageIndex], weeklyCapacityMinutes);
  });
}

function inStep(step: QuestStep, rankNumber: number): boolean {
  return step.ranks === null || step.ranks.includes(rankNumber);
}

function isBlocking(item: Item): boolean {
  return !item.optional && item.type !== "habit";
}

function hasRecallStep(skill: Skill): boolean {
  return skill.recall.length > 0 && !isStartingSkill(skill);
}

function itemEntry(
  index: ContentIndex,
  tree: TreeState,
  skill: Skill,
  rankNumber: number,
  item: Item,
  stageIndex: number,
): DraftEntry {
  const lockReason = itemLockReason(index, tree, skill.id, rankNumber);
  return {
    kind: "item",
    skillId: skill.id,
    itemId: item.id,
    key: item.key,
    title: item.title,
    // An untyped item is a parse error; plan it as generic work rather than drop it.
    type: item.type ?? "do",
    minutes: item.minutes ?? DEFAULT_ITEM_MINUTES,
    stageIndex,
    status: entryStatus(tree, skill.id, lookup(tree.items, item.key)?.status ?? "todo"),
    locked: lockReason !== null,
    lockReason,
  };
}

function recallEntry(index: ContentIndex, tree: TreeState, skill: Skill, stageIndex: number): DraftEntry {
  const lockReason = recallLockReason(index, tree, skill.id);
  return {
    kind: "recall",
    skillId: skill.id,
    itemId: null,
    key: `${skill.id}#recall`,
    title: `Answer Recall: ${skill.title}`,
    type: "recall",
    minutes: RECALL_STEP_MINUTES,
    stageIndex,
    status: entryStatus(tree, skill.id, "todo"),
    locked: lockReason !== null,
    lockReason,
  };
}

/** A learned skill (completed, tested out or self-reported) clears all its entries; a skip stays a skip. */
function entryStatus(tree: TreeState, skillId: string, own: ItemStatus): ItemStatus {
  return own === "todo" && lookup(tree.skills, skillId)?.learned ? "done" : own;
}

// Learned skills are never shown as locked: their entries are already done,
// even if a test-out happened before a prerequisite was learned.
function itemLockReason(index: ContentIndex, tree: TreeState, skillId: string, rankNumber: number): string | null {
  const view = lookup(tree.skills, skillId);
  if (!view || view.learned) return null;
  // The skill's own requires come first; a skill locked only because every rank is
  // locked explains each rank by that rank's own requires.
  const own = ownMissingRequires(index, skillId, view.missingRequires);
  if (own.length > 0) return `Learn ${listTitles(index, own)} first`;
  const rank = view.ranks.find((r) => r.number === rankNumber);
  if (rank?.locked) return `Rank ${rankNumber} needs ${listTitles(index, rank.missingRequires)}`;
  if (view.locked) return `Learn ${listTitles(index, view.missingRequires)} first`;
  return null;
}

function recallLockReason(index: ContentIndex, tree: TreeState, skillId: string): string | null {
  const view = lookup(tree.skills, skillId);
  if (view?.learned) return null;
  if (view?.locked) return `Learn ${listTitles(index, view.missingRequires)} first`;
  const lockedRank = view?.ranks.find((r) => r.locked);
  if (lockedRank) return `Rank ${lockedRank.number} needs ${listTitles(index, lockedRank.missingRequires)}`;
  if (!view?.readyToComplete) return "Finish the skill's items first";
  return null;
}

/** The part of a skill's missing requires that the skill itself (not one of its ranks) names. */
function ownMissingRequires(index: ContentIndex, skillId: string, missing: string[]): string[] {
  const requires = lookup(index.skills, skillId)?.requires ?? [];
  return missing.filter((id) => requires.includes(id));
}

/** "A", "A and B", "A, B and C". */
function listTitles(index: ContentIndex, skillIds: string[]): string {
  const titles = skillIds.map((id) => lookup(index.skills, id)?.title ?? id);
  if (titles.length === 0) return "its prerequisites";
  if (titles.length === 1) return titles[0];
  return `${titles.slice(0, -1).join(", ")} and ${titles[titles.length - 1]}`;
}

/**
 * A bounded stage spreads its minutes evenly over its weeks; an open-ended
 * one fills weeks from its start at the weekly capacity. Each entry lands in
 * the week where its cumulative start time falls.
 */
function assignWeeks(drafts: DraftEntry[], stage: QuestStage, weeklyCapacityMinutes: number): PlanEntry[] {
  const span = stage.weekEnd === null ? null : Math.max(1, stage.weekEnd - stage.weekStart + 1);
  const capacity = span === null ? weeklyCapacityMinutes : sumMinutes(drafts) / span;
  const entries: PlanEntry[] = [];
  let minutesBefore = 0;
  for (const draft of drafts) {
    const offset = capacity > 0 ? Math.floor((minutesBefore + WEEK_EPSILON) / capacity) : 0;
    const week = stage.weekStart + (span === null ? offset : Math.min(span - 1, offset));
    entries.push({ ...draft, week });
    minutesBefore += draft.minutes;
  }
  return entries;
}

function sumMinutes(entries: readonly { minutes: number }[]): number {
  return entries.reduce((sum, e) => sum + e.minutes, 0);
}

function isCleared(entry: PlanEntry): boolean {
  return entry.status !== "todo";
}

/** 0..1 by minutes; entries that are all zero-minute fall back to counting entries. */
function clearedShare(entries: PlanEntry[]): number {
  const cleared = entries.filter(isCleared);
  const planned = sumMinutes(entries);
  if (planned > 0) return sumMinutes(cleared) / planned;
  return entries.length > 0 ? cleared.length / entries.length : 0;
}

// ---------------------------------------------------------------- views

export function computeQuestView(
  index: ContentIndex,
  questId: string,
  snapshot: ProgressSnapshot,
  tree: TreeState,
  today: string,
): QuestView {
  const quest = lookup(index.quests, questId);
  if (!quest) throw new Error(`Unknown quest "${questId}"`);
  const run = currentRun(snapshot, questId);
  const plan = buildPlan(index, quest, tree, weeklyCapacityMinutes(quest, run));
  const currentWeek = run ? runWeek(run.startedOn, today) : null;

  return {
    questId,
    run,
    status: run?.status ?? "not-started",
    currentWeek,
    stages: stageViews(index, quest, plan, tree, currentWeek),
    plan,
    progress: clearedShare(plan),
    thisWeek:
      run && currentWeek !== null ? thisWeekView(quest, run, plan, snapshot, currentWeek, today) : null,
    nextUp: plan.find((e) => e.status === "todo" && !e.locked) ?? null,
    paceWeeks: currentWeek === null ? null : paceWeeks(plan, currentWeek),
    maintenance: maintenanceState(quest, run, currentWeek),
  };
}

/** One view per quest, in content order. */
export function computeQuestViews(
  index: ContentIndex,
  snapshot: ProgressSnapshot,
  tree: TreeState,
  today: string,
): QuestView[] {
  return index.tree.quests.map((q) => computeQuestView(index, q.id, snapshot, tree, today));
}

/**
 * Quest weeks are ISO weeks (Monday start, decisions D6): week 1 is the ISO
 * week containing startedOn, even if an imported run doesn't start on a
 * Monday. A run that starts in the future sits at week 0: nothing is due yet.
 * An unreadable date gives null rather than NaN leaking into every week check.
 */
function runWeek(startedOn: string, today: string): number | null {
  if (!isIsoDate(startedOn) || !isIsoDate(today)) return null;
  return Math.max(0, weekNumber(startOfWeek(startedOn), today));
}

/** questId → current week of its active run; null when the quest isn't actively running. */
/**
 * questId → current week, for runs whose maintenance habits should run.
 * A completed run keeps its maintenance going: the habits exist to keep
 * learned skills from going rusty after the quest (seed: "Keeps learned
 * skills from going rusty"). Paused and abandoned runs pause them.
 */
export function activeQuestWeeks(views: QuestView[]): Record<string, number | null> {
  return Object.fromEntries(
    views.map((v) => [v.questId, v.status === "active" || v.status === "completed" ? v.currentWeek : null]),
  );
}

function thisWeekView(
  quest: Quest,
  run: QuestRunRow,
  plan: PlanEntry[],
  snapshot: ProgressSnapshot,
  currentWeek: number,
  today: string,
): ThisWeek {
  const weekStart = startOfWeek(today);
  const weekEnd = addDays(weekStart, 6);
  const entries = plan.filter((e) => e.week === currentWeek);
  const carryOver = plan.filter((e) => e.week < currentWeek && e.status === "todo");
  const cleared = entries.every(isCleared) && carryOver.length === 0;
  const getAhead = cleared
    ? plan.filter((e) => e.week > currentWeek && e.status === "todo").slice(0, GET_AHEAD_LIMIT)
    : [];
  const minutesLogged = snapshot.timeLogs
    .filter((log) => log.loggedOn >= weekStart && log.loggedOn <= weekEnd)
    .reduce((sum, log) => sum + log.minutes, 0);

  return {
    week: currentWeek,
    weekStart,
    weekEnd,
    entries,
    carryOver,
    getAhead,
    minutesLogged,
    targetMinutes: targetMinutes(quest, run),
  };
}

function stageViews(
  index: ContentIndex,
  quest: Quest,
  plan: PlanEntry[],
  tree: TreeState,
  currentWeek: number | null,
): StageView[] {
  const currentIndex =
    currentWeek === null
      ? -1
      : quest.stages.findIndex((s) => currentWeek >= s.weekStart && currentWeek <= (s.weekEnd ?? Infinity));
  const schedule = scheduleSteps(index, quest);

  return quest.stages.map((stage, stageIndex) => {
    const entries = plan.filter((e) => e.stageIndex === stageIndex);
    const steps = schedule[stageIndex].map((scheduled): StageStepView => ({
      skillId: scheduled.step.skillId,
      ranks: scheduled.step.ranks,
      text: scheduled.step.text,
      complete: isStepComplete(scheduled, tree),
    }));
    // A stage that plans nothing (e.g. only starting skills) is done when its steps are.
    const stepsDone = steps.length > 0 && steps.every((s) => s.complete);
    return {
      index: stageIndex,
      name: stage.name,
      weekStart: stage.weekStart,
      weekEnd: stage.weekEnd,
      steps,
      plannedMinutes: sumMinutes(entries),
      doneMinutes: sumMinutes(entries.filter(isCleared)),
      progress: entries.length > 0 ? clearedShare(entries) : stepsDone ? 1 : 0,
      isCurrent: stageIndex === currentIndex,
    };
  });
}

/**
 * A whole-skill step, or a rank-limited one that the skill's Recall step
 * follows, is complete once the skill is learned. Any other rank-limited step
 * is complete once its listed ranks are.
 */
function isStepComplete({ step, closesSkill }: ScheduledStep, tree: TreeState): boolean {
  const view = lookup(tree.skills, step.skillId);
  if (!view) return false;
  if (view.learned) return true;
  if (step.ranks === null || closesSkill) return false;
  const listed = step.ranks;
  const ranks = view.ranks.filter((r) => listed.includes(r.number));
  return ranks.length > 0 && ranks.every((r) => r.complete);
}

/**
 * Weeks between the earliest outstanding entry and now: + ahead, − behind.
 * Before week 1 counts as week 1 so an untouched future run reads "on track",
 * and a finished plan is never behind.
 */
function paceWeeks(plan: PlanEntry[], currentWeek: number): number {
  const week = Math.max(1, currentWeek);
  const todo = plan.filter((e) => e.status === "todo");
  if (todo.length > 0) return Math.min(...todo.map((e) => e.week)) - week;
  const lastWeek = plan.reduce((max, e) => Math.max(max, e.week), 0);
  return Math.max(0, lastWeek + 1 - week);
}

// A maintenance section without "from week N" applies from week 1.
function maintenanceState(quest: Quest, run: QuestRunRow | null, currentWeek: number | null): QuestView["maintenance"] {
  const fromWeek = quest.maintenance?.fromWeek ?? null;
  const active =
    (run?.status === "active" || run?.status === "completed") &&
    quest.maintenance !== null &&
    currentWeek !== null &&
    currentWeek >= Math.max(1, fromWeek ?? 1);
  return { active, fromWeek };
}
