// Progress rows as the app sees them (camelCase). The DB layer maps these
// to/from the snake_case tables in supabase/migrations. Only facts are stored;
// every derived state lives in src/lib/engine (see docs/decisions.md D3).

import type { ItemType } from "@/lib/content/types";

/** Absence of a row means "todo". */
export type StoredItemStatus = "done" | "skipped";
export type ItemStatus = "todo" | StoredItemStatus;

export interface ItemProgressRow {
  skillId: string;
  itemId: string;
  status: StoredItemStatus;
  /** ISO timestamp. */
  completedAt: string;
}

export type LearnedVia = "completed" | "tested-out" | "self-reported";

export interface SkillProgressRow {
  skillId: string;
  learnedVia: LearnedVia | null;
  learnedAt: string | null;
  startedAt: string | null;
  starred: boolean;
}

/** What the time was spent on; item types plus review/other. */
export type Activity = ItemType | "review" | "other";

export interface TimeLogRow {
  id: string;
  skillId: string | null;
  itemId: string | null;
  questId: string | null;
  /** `${ownerId}/${itemId}` for habit time. */
  habitKey: string | null;
  /** Set when the log was created together with a habit check-off (deleted with it). */
  habitLogId?: string | null;
  activity: Activity;
  minutes: number;
  /** Local date (Europe/Riga), YYYY-MM-DD. */
  loggedOn: string;
  note: string | null;
  createdAt: string;
}

export type NoteKind = "note" | "output";

export interface NoteRow {
  id: string;
  skillId: string | null;
  itemId: string | null;
  questId: string | null;
  kind: NoteKind;
  title: string | null;
  /** Markdown. */
  body: string;
  url: string | null;
  createdAt: string;
  updatedAt: string;
}

export type RecallMode = "test-out" | "complete" | "review";
export type RecallResult = "pass" | "fail";

export interface RecallAttemptRow {
  id: string;
  skillId: string;
  questionId: string;
  mode: RecallMode;
  /** Groups the answers of one run through a skill's questions. */
  sessionId: string;
  result: RecallResult;
  answer: string | null;
  /** "app" or e.g. "claude-review" for the future Claude Code review skill. */
  source: string;
  createdAt: string;
}

/** Leitner box per recall question (future spaced review; populated on learn). */
export interface RecallCardRow {
  skillId: string;
  questionId: string;
  box: number;
  dueOn: string;
  lastResult: RecallResult | null;
  lastReviewedAt: string | null;
}

export interface VerificationRow {
  id: string;
  skillId: string;
  itemId: string;
  verifiedAt: string;
  /** true when the fact had changed (and the content should be edited). */
  changed: boolean;
  note: string | null;
}

export type QuestRunStatus = "active" | "paused" | "completed" | "abandoned";

export interface QuestRunRow {
  id: string;
  questId: string;
  status: QuestRunStatus;
  /** Monday of week 1, YYYY-MM-DD (local). */
  startedOn: string;
  /** Override of the quest's hours/week target. */
  hoursPerWeek: number | null;
  /** Future: forked quests. */
  forkedFrom: string | null;
  definition: unknown | null;
  createdAt: string;
  updatedAt: string;
}

export interface HabitLogRow {
  id: string;
  /** Item key of the habit: `${questId|skillId}/${itemId}`. */
  habitKey: string;
  /** Start of the cadence period (Monday / 1st of month / Jan 1), YYYY-MM-DD. */
  periodStart: string;
  doneOn: string;
  minutes: number | null;
  note: string | null;
  createdAt: string;
}

/** Everything the engine needs; loaded in one go (the data is tiny). */
export interface ProgressSnapshot {
  items: ItemProgressRow[];
  skills: SkillProgressRow[];
  timeLogs: TimeLogRow[];
  notes: NoteRow[];
  recallAttempts: RecallAttemptRow[];
  recallCards: RecallCardRow[];
  verifications: VerificationRow[];
  questRuns: QuestRunRow[];
  habitLogs: HabitLogRow[];
}

export const EMPTY_SNAPSHOT: ProgressSnapshot = {
  items: [],
  skills: [],
  timeLogs: [],
  notes: [],
  recallAttempts: [],
  recallCards: [],
  verifications: [],
  questRuns: [],
  habitLogs: [],
};
