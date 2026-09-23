// Derived state: pure outputs of (content, progress snapshot, today).
// Nothing here is stored (docs/decisions.md D3).

import type { Cadence, ItemType } from "@/lib/content/types";
import type { Activity, ItemStatus, LearnedVia, QuestRunRow } from "@/lib/progress/types";

export type SkillState =
  | "locked"
  | "available"
  | "in-progress"
  | "learned"
  | "tested-out"
  | "self-reported"
  | "rusty";

export const LEARNED_STATES: readonly SkillState[] = ["learned", "tested-out", "self-reported", "rusty"];

export interface StaleItem {
  itemId: string;
  itemKey: string;
  /** Effective as-of date (content date or last re-verification, whichever is later). */
  asOf: string;
  /** Date it went stale (asOf + FRESHNESS_DAYS). */
  staleSince: string;
  daysStale: number;
}

export interface RustInfo {
  /** Time-sensitive items past the freshness window. */
  stale: StaleItem[];
  /** Latest recall review after learning failed (spaced review, later). */
  failedReview: boolean;
  /** learned && (stale.length > 0 || failedReview). */
  isRusty: boolean;
  /** Earliest date a currently fresh time-sensitive item goes stale; null if none. */
  nextStaleOn: string | null;
}

export interface ItemView {
  key: string;
  /** Skill id (or quest id for maintenance habits). */
  ownerId: string;
  itemId: string;
  status: ItemStatus;
  completedAt: string | null;
  minutesLogged: number;
  /** Required for rank completion (not optional, not a habit). */
  blocking: boolean;
  // Time-sensitive items only (null/false otherwise):
  asOf: string | null;
  lastVerifiedAt: string | null;
  staleOn: string | null;
  stale: boolean;
  noteCount: number;
  outputCount: number;
}

export interface RankView {
  id: string;
  number: number;
  name: string | null;
  /** Rank-level requires not yet learned. */
  locked: boolean;
  missingRequires: string[];
  /** All blocking items done or skipped (always true once the skill is learned). */
  complete: boolean;
  doneCount: number;
  blockingCount: number;
  /** 0..1, by estimated minutes of blocking items done or skipped. */
  progress: number;
}

export interface SkillView {
  id: string;
  state: SkillState;
  learned: boolean;
  learnedVia: LearnedVia | null;
  learnedAt: string | null;
  /** Seeded as learned (self-reported) in content. */
  isStarting: boolean;
  starred: boolean;
  /** Skill-level requires not learned. */
  locked: boolean;
  missingRequires: string[];
  ranks: RankView[];
  ranksComplete: number;
  /** 0..1 (1 when learned). */
  progress: number;
  /** Every rank complete but not learned yet: next step is answering Recall. */
  readyToComplete: boolean;
  /** Not locked, not learned (or self-reported), and has ≥ 1 Recall question. */
  canTestOut: boolean;
  rust: RustInfo;
  minutesLogged: number;
  xp: number;
  lastActivityAt: string | null;
  lastTestOut: { at: string; passed: number; total: number } | null;
  noteCount: number;
  outputCount: number;
}

export interface BranchView {
  id: string;
  total: number;
  learned: number;
  inProgress: number;
  available: number;
  locked: number;
  rusty: number;
  /** Mean skill progress, 0..1. */
  progress: number;
  xp: number;
}

export interface WeekTotal {
  /** Monday, YYYY-MM-DD. */
  weekStart: string;
  minutes: number;
  xp: number;
}

export interface XpSummary {
  total: number;
  level: number;
  /** Total XP at the start of the current level. */
  levelFloor: number;
  /** Total XP needed for the next level. */
  nextLevelAt: number;
  /** 0..1 progress from levelFloor to nextLevelAt. */
  progressToNext: number;
  byActivity: Partial<Record<Activity, number>>;
  recallBonus: number;
  minutesTotal: number;
  thisWeekMinutes: number;
  /** Consecutive qualifying weeks, ending this week (or last week if this one doesn't qualify yet). */
  weeklyStreak: number;
  /** The last 12 ISO weeks, oldest first, including the current one. */
  weeks: WeekTotal[];
}

export interface TreeState {
  /** Local date (Europe/Riga), YYYY-MM-DD. */
  today: string;
  skills: Record<string, SkillView>;
  items: Record<string, ItemView>;
  branches: Record<string, BranchView>;
  xp: XpSummary;
}

// ---------------------------------------------------------------- quests

export type PlanEntryType = ItemType | "recall";

/** One line of a quest's week plan: an item, or the "answer Recall" step closing a skill. */
export interface PlanEntry {
  kind: "item" | "recall";
  skillId: string;
  /** null for the recall step. */
  itemId: string | null;
  /** Item key, or `${skillId}#recall` for the recall step. */
  key: string;
  title: string;
  type: PlanEntryType;
  minutes: number;
  /** Planned week, 1-based. */
  week: number;
  stageIndex: number;
  status: ItemStatus;
  locked: boolean;
  lockReason: string | null;
}

export interface StageStepView {
  skillId: string;
  ranks: number[] | null;
  text: string;
  complete: boolean;
}

export interface StageView {
  index: number;
  name: string;
  weekStart: number;
  weekEnd: number | null;
  steps: StageStepView[];
  plannedMinutes: number;
  doneMinutes: number;
  /** 0..1 by planned minutes. */
  progress: number;
  isCurrent: boolean;
}

export interface ThisWeek {
  week: number;
  /** Monday and Sunday of the current week, YYYY-MM-DD. */
  weekStart: string;
  weekEnd: string;
  /** Planned for this week. */
  entries: PlanEntry[];
  /** Planned for earlier weeks and still todo. */
  carryOver: PlanEntry[];
  /** Next todo entries after this week; filled only when this week's entries are all cleared. */
  getAhead: PlanEntry[];
  /** Time logged this ISO week (all activities). */
  minutesLogged: number;
  targetMinutes: { min: number; max: number } | null;
}

export type QuestStatus = "not-started" | "active" | "paused" | "completed" | "abandoned";

export interface QuestView {
  questId: string;
  run: QuestRunRow | null;
  status: QuestStatus;
  /** 1-based; null when not started. Can exceed the quest length (follow-on). */
  currentWeek: number | null;
  stages: StageView[];
  plan: PlanEntry[];
  /** 0..1 by planned minutes done or skipped. */
  progress: number;
  thisWeek: ThisWeek | null;
  /** First todo, unlocked entry in plan order. */
  nextUp: PlanEntry | null;
  /** Weeks ahead (+) or behind (−) the plan; null when not started. */
  paceWeeks: number | null;
  maintenance: { active: boolean; fromWeek: number | null };
}

// ---------------------------------------------------------------- habits

export interface HabitView {
  /** Item key: `${ownerId}/${itemId}`. */
  key: string;
  ownerId: string;
  ownerKind: "quest" | "skill";
  itemId: string;
  title: string;
  minutes: number | null;
  cadence: Cadence;
  active: boolean;
  /** Why it isn't active yet, e.g. "Starts in quest week 13". */
  inactiveReason: string | null;
  periodStart: string;
  periodEnd: string;
  doneThisPeriod: number;
  target: number;
  complete: boolean;
  /** Consecutive complete periods ending with the current one (or the previous one if the current isn't complete yet). */
  streak: number;
  lastDoneOn: string | null;
}
