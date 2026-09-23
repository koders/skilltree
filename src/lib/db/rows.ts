// Pure mappers between the snake_case tables in supabase/migrations and the
// camelCase rows in src/lib/progress/types.ts. Reads are validated with zod so
// a schema drift fails loudly with the table, row and column in the message.
// Timestamps are normalised to `Date#toISOString()` (UTC, "Z", milliseconds)
// so the engine can compare them as strings.

import { z } from "zod";
import { isIsoDate } from "@/lib/engine/dates";
import { SNAPSHOT_TABLES, type SnapshotTable } from "@/lib/progress/export";
import type {
  HabitLogRow,
  ItemProgressRow,
  NoteRow,
  ProgressSnapshot,
  QuestRunRow,
  RecallAttemptRow,
  RecallCardRow,
  SkillProgressRow,
  TimeLogRow,
  VerificationRow,
} from "@/lib/progress/types";

/**
 * A time log as stored: the contract row plus the habit occurrence it was
 * logged with (time_logs.habit_log_id, deleted together with the habit log).
 */
export type TimeLogRecord = TimeLogRow & { habitLogId: string | null };

export type SnapshotKey = SnapshotTable;
/** Snapshot keys in foreign-key order: insert in this order, delete in reverse. */
export const SNAPSHOT_KEYS = SNAPSHOT_TABLES;

export const TABLES: Record<SnapshotKey, { table: string; primaryKey: readonly string[] }> = {
  items: { table: "item_progress", primaryKey: ["skill_id", "item_id"] },
  skills: { table: "skill_progress", primaryKey: ["skill_id"] },
  habitLogs: { table: "habit_logs", primaryKey: ["id"] },
  timeLogs: { table: "time_logs", primaryKey: ["id"] },
  notes: { table: "notes", primaryKey: ["id"] },
  recallAttempts: { table: "recall_attempts", primaryKey: ["id"] },
  recallCards: { table: "recall_cards", primaryKey: ["skill_id", "question_id"] },
  verifications: { table: "verifications", primaryKey: ["id"] },
  questRuns: { table: "quest_runs", primaryKey: ["id"] },
};

// ---------------------------------------------------------------- field parsers

/** Any parseable timestamp → canonical `toISOString()` form. */
export function normalizeTimestamp(value: string): string {
  const ms = Date.parse(value);
  if (Number.isNaN(ms)) throw new Error(`Invalid timestamp "${value}"`);
  return new Date(ms).toISOString();
}

const timestamp = z
  .string()
  .refine((s) => !Number.isNaN(Date.parse(s)), "expected a timestamp")
  .transform(normalizeTimestamp);
const date = z.string().refine(isIsoDate, "expected a YYYY-MM-DD date");
const text = z.string();
const nullableText = z.string().nullable();
// PostgREST serialises numeric as a JSON number, but a string is harmless to accept.
const numeric = z.union([z.number(), z.string().regex(/^-?\d+(\.\d+)?$/).transform(Number)]);

const itemStatus = z.enum(["done", "skipped"]);
const learnedVia = z.enum(["completed", "tested-out", "self-reported"]);
const activity = z.enum(["watch", "read", "do", "build", "output", "habit", "review", "other"]);
const noteKind = z.enum(["note", "output"]);
const recallMode = z.enum(["test-out", "complete", "review"]);
const recallResult = z.enum(["pass", "fail"]);
const questRunStatus = z.enum(["active", "paused", "completed", "abandoned"]);

// ---------------------------------------------------------------- DB row shapes

export type ItemProgressDb = {
  skill_id: string;
  item_id: string;
  status: ItemProgressRow["status"];
  completed_at: string;
};

export type SkillProgressDb = {
  skill_id: string;
  learned_via: SkillProgressRow["learnedVia"];
  learned_at: string | null;
  started_at: string | null;
  starred: boolean;
};

export type TimeLogDb = {
  id: string;
  skill_id: string | null;
  item_id: string | null;
  quest_id: string | null;
  habit_key: string | null;
  habit_log_id: string | null;
  activity: TimeLogRow["activity"];
  minutes: number;
  logged_on: string;
  note: string | null;
  created_at: string;
};

export type NoteDb = {
  id: string;
  skill_id: string | null;
  item_id: string | null;
  quest_id: string | null;
  kind: NoteRow["kind"];
  title: string | null;
  body: string;
  url: string | null;
  created_at: string;
  updated_at: string;
};

export type RecallAttemptDb = {
  id: string;
  skill_id: string;
  question_id: string;
  mode: RecallAttemptRow["mode"];
  session_id: string;
  result: RecallAttemptRow["result"];
  answer: string | null;
  source: string;
  created_at: string;
};

export type RecallCardDb = {
  skill_id: string;
  question_id: string;
  box: number;
  due_on: string;
  last_result: RecallCardRow["lastResult"];
  last_reviewed_at: string | null;
};

export type VerificationDb = {
  id: string;
  skill_id: string;
  item_id: string;
  verified_at: string;
  changed: boolean;
  note: string | null;
};

export type QuestRunDb = {
  id: string;
  quest_id: string;
  status: QuestRunRow["status"];
  started_on: string;
  hours_per_week: number | null;
  forked_from: string | null;
  definition: unknown;
  created_at: string;
  updated_at: string;
};

export type HabitLogDb = {
  id: string;
  habit_key: string;
  period_start: string;
  done_on: string;
  minutes: number | null;
  note: string | null;
  created_at: string;
};

// ---------------------------------------------------------------- DB → app

const itemProgressDb = z
  .object({ skill_id: text, item_id: text, status: itemStatus, completed_at: timestamp })
  .transform(
    (r): ItemProgressRow => ({ skillId: r.skill_id, itemId: r.item_id, status: r.status, completedAt: r.completed_at }),
  );

const skillProgressDb = z
  .object({
    skill_id: text,
    learned_via: learnedVia.nullable(),
    learned_at: timestamp.nullable(),
    started_at: timestamp.nullable(),
    starred: z.boolean(),
  })
  .transform(
    (r): SkillProgressRow => ({
      skillId: r.skill_id,
      learnedVia: r.learned_via,
      learnedAt: r.learned_at,
      startedAt: r.started_at,
      starred: r.starred,
    }),
  );

const timeLogDb = z
  .object({
    id: text,
    skill_id: nullableText,
    item_id: nullableText,
    quest_id: nullableText,
    habit_key: nullableText,
    habit_log_id: nullableText.optional(),
    activity,
    minutes: z.number().int(),
    logged_on: date,
    note: nullableText,
    created_at: timestamp,
  })
  .transform(
    (r): TimeLogRecord => ({
      id: r.id,
      skillId: r.skill_id,
      itemId: r.item_id,
      questId: r.quest_id,
      habitKey: r.habit_key,
      habitLogId: r.habit_log_id ?? null,
      activity: r.activity,
      minutes: r.minutes,
      loggedOn: r.logged_on,
      note: r.note,
      createdAt: r.created_at,
    }),
  );

const noteDb = z
  .object({
    id: text,
    skill_id: nullableText,
    item_id: nullableText,
    quest_id: nullableText,
    kind: noteKind,
    title: nullableText,
    body: text,
    url: nullableText,
    created_at: timestamp,
    updated_at: timestamp,
  })
  .transform(
    (r): NoteRow => ({
      id: r.id,
      skillId: r.skill_id,
      itemId: r.item_id,
      questId: r.quest_id,
      kind: r.kind,
      title: r.title,
      body: r.body,
      url: r.url,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    }),
  );

const recallAttemptDb = z
  .object({
    id: text,
    skill_id: text,
    question_id: text,
    mode: recallMode,
    session_id: text,
    result: recallResult,
    answer: nullableText,
    source: text,
    created_at: timestamp,
  })
  .transform(
    (r): RecallAttemptRow => ({
      id: r.id,
      skillId: r.skill_id,
      questionId: r.question_id,
      mode: r.mode,
      sessionId: r.session_id,
      result: r.result,
      answer: r.answer,
      source: r.source,
      createdAt: r.created_at,
    }),
  );

const recallCardDb = z
  .object({
    skill_id: text,
    question_id: text,
    box: z.number().int(),
    due_on: date,
    last_result: recallResult.nullable(),
    last_reviewed_at: timestamp.nullable(),
  })
  .transform(
    (r): RecallCardRow => ({
      skillId: r.skill_id,
      questionId: r.question_id,
      box: r.box,
      dueOn: r.due_on,
      lastResult: r.last_result,
      lastReviewedAt: r.last_reviewed_at,
    }),
  );

const verificationDb = z
  .object({
    id: text,
    skill_id: text,
    item_id: text,
    verified_at: timestamp,
    changed: z.boolean(),
    note: nullableText,
  })
  .transform(
    (r): VerificationRow => ({
      id: r.id,
      skillId: r.skill_id,
      itemId: r.item_id,
      verifiedAt: r.verified_at,
      changed: r.changed,
      note: r.note,
    }),
  );

const questRunDb = z
  .object({
    id: text,
    quest_id: text,
    status: questRunStatus,
    started_on: date,
    hours_per_week: numeric.nullable(),
    forked_from: nullableText,
    definition: z.unknown().optional(),
    created_at: timestamp,
    updated_at: timestamp,
  })
  .transform(
    (r): QuestRunRow => ({
      id: r.id,
      questId: r.quest_id,
      status: r.status,
      startedOn: r.started_on,
      hoursPerWeek: r.hours_per_week,
      forkedFrom: r.forked_from,
      definition: r.definition ?? null,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    }),
  );

const habitLogDb = z
  .object({
    id: text,
    habit_key: text,
    period_start: date,
    done_on: date,
    minutes: z.number().int().nullable(),
    note: nullableText,
    created_at: timestamp,
  })
  .transform(
    (r): HabitLogRow => ({
      id: r.id,
      habitKey: r.habit_key,
      periodStart: r.period_start,
      doneOn: r.done_on,
      minutes: r.minutes,
      note: r.note,
      createdAt: r.created_at,
    }),
  );

type SnapshotRow<K extends SnapshotKey> = ProgressSnapshot[K][number];

const DB_ROW_SCHEMAS: { [K in SnapshotKey]: z.ZodType<SnapshotRow<K>> } = {
  items: itemProgressDb,
  skills: skillProgressDb,
  timeLogs: timeLogDb,
  notes: noteDb,
  recallAttempts: recallAttemptDb,
  recallCards: recallCardDb,
  verifications: verificationDb,
  questRuns: questRunDb,
  habitLogs: habitLogDb,
};

function describeIssues(error: z.ZodError): string {
  return error.issues
    .slice(0, 5)
    .map((i) => `${i.path.length > 0 ? i.path.join(".") : "(row)"}: ${i.message}`)
    .join("; ");
}

/** Maps raw rows of one table (as returned by supabase-js) to app rows; throws on any bad row. */
export function rowsFromDb<K extends SnapshotKey>(key: K, data: unknown): SnapshotRow<K>[] {
  const table = TABLES[key].table;
  if (!Array.isArray(data)) throw new Error(`${table}: expected an array of rows, got ${typeof data}`);
  const schema = DB_ROW_SCHEMAS[key];
  return data.map((raw: unknown, i) => {
    const parsed = schema.safeParse(raw);
    if (!parsed.success) throw new Error(`${table} row ${i}: ${describeIssues(parsed.error)}`);
    return parsed.data;
  });
}

export const itemProgressFromDb = (raw: unknown): ItemProgressRow => itemProgressDb.parse(raw);
export const skillProgressFromDb = (raw: unknown): SkillProgressRow => skillProgressDb.parse(raw);
export const timeLogFromDb = (raw: unknown): TimeLogRecord => timeLogDb.parse(raw);
export const noteFromDb = (raw: unknown): NoteRow => noteDb.parse(raw);
export const recallAttemptFromDb = (raw: unknown): RecallAttemptRow => recallAttemptDb.parse(raw);
export const recallCardFromDb = (raw: unknown): RecallCardRow => recallCardDb.parse(raw);
export const verificationFromDb = (raw: unknown): VerificationRow => verificationDb.parse(raw);
export const questRunFromDb = (raw: unknown): QuestRunRow => questRunDb.parse(raw);
export const habitLogFromDb = (raw: unknown): HabitLogRow => habitLogDb.parse(raw);

// ---------------------------------------------------------------- app → DB
// Full rows, used by import (upsert by primary key). updated_at is left to its
// default/trigger.

export function itemProgressToDb(r: ItemProgressRow): ItemProgressDb {
  return { skill_id: r.skillId, item_id: r.itemId, status: r.status, completed_at: r.completedAt };
}

export function skillProgressToDb(r: SkillProgressRow): SkillProgressDb {
  return {
    skill_id: r.skillId,
    learned_via: r.learnedVia,
    learned_at: r.learnedAt,
    started_at: r.startedAt,
    starred: r.starred,
  };
}

export function timeLogToDb(r: TimeLogRow & { habitLogId?: string | null }): TimeLogDb {
  return {
    id: r.id,
    skill_id: r.skillId,
    item_id: r.itemId,
    quest_id: r.questId,
    habit_key: r.habitKey,
    habit_log_id: r.habitLogId ?? null,
    activity: r.activity,
    minutes: r.minutes,
    logged_on: r.loggedOn,
    note: r.note,
    created_at: r.createdAt,
  };
}

export function noteToDb(r: NoteRow): NoteDb {
  return {
    id: r.id,
    skill_id: r.skillId,
    item_id: r.itemId,
    quest_id: r.questId,
    kind: r.kind,
    title: r.title,
    body: r.body,
    url: r.url,
    created_at: r.createdAt,
    updated_at: r.updatedAt,
  };
}

export function recallAttemptToDb(r: RecallAttemptRow): RecallAttemptDb {
  return {
    id: r.id,
    skill_id: r.skillId,
    question_id: r.questionId,
    mode: r.mode,
    session_id: r.sessionId,
    result: r.result,
    answer: r.answer,
    source: r.source,
    created_at: r.createdAt,
  };
}

export function recallCardToDb(r: RecallCardRow): RecallCardDb {
  return {
    skill_id: r.skillId,
    question_id: r.questionId,
    box: r.box,
    due_on: r.dueOn,
    last_result: r.lastResult,
    last_reviewed_at: r.lastReviewedAt,
  };
}

export function verificationToDb(r: VerificationRow): VerificationDb {
  return {
    id: r.id,
    skill_id: r.skillId,
    item_id: r.itemId,
    verified_at: r.verifiedAt,
    changed: r.changed,
    note: r.note,
  };
}

export function questRunToDb(r: QuestRunRow): QuestRunDb {
  return {
    id: r.id,
    quest_id: r.questId,
    status: r.status,
    started_on: r.startedOn,
    hours_per_week: r.hoursPerWeek,
    forked_from: r.forkedFrom,
    definition: r.definition ?? null,
    created_at: r.createdAt,
    updated_at: r.updatedAt,
  };
}

export function habitLogToDb(r: HabitLogRow): HabitLogDb {
  return {
    id: r.id,
    habit_key: r.habitKey,
    period_start: r.periodStart,
    done_on: r.doneOn,
    minutes: r.minutes,
    note: r.note,
    created_at: r.createdAt,
  };
}

export type DbRow =
  | ItemProgressDb
  | SkillProgressDb
  | TimeLogDb
  | NoteDb
  | RecallAttemptDb
  | RecallCardDb
  | VerificationDb
  | QuestRunDb
  | HabitLogDb;

const TO_DB: { [K in SnapshotKey]: (row: SnapshotRow<K>) => DbRow } = {
  items: itemProgressToDb,
  skills: skillProgressToDb,
  timeLogs: timeLogToDb,
  notes: noteToDb,
  recallAttempts: recallAttemptToDb,
  recallCards: recallCardToDb,
  verifications: verificationToDb,
  questRuns: questRunToDb,
  habitLogs: habitLogToDb,
};

/** Maps app rows of one snapshot table to DB rows. */
export function rowsToDb<K extends SnapshotKey>(key: K, rows: readonly SnapshotRow<K>[]): DbRow[] {
  const map: (row: SnapshotRow<K>) => DbRow = TO_DB[key];
  return rows.map((r) => map(r));
}
