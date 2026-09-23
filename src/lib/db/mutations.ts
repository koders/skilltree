// Every progress write, as plain async functions over a SupabaseClient so the
// app (via src/app/actions.ts) and tsx scripts share them. Each validates its
// input with zod. Local dates come from localToday() (Europe/Riga); instants
// are UTC ISO strings.

import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { LEITNER_INTERVALS_DAYS } from "@/lib/config";
import { isStartingSkill, type Skill } from "@/lib/content/types";
import { recallCardFromDb, rowsToDb, SNAPSHOT_KEYS, TABLES, type SnapshotKey } from "@/lib/db/rows";
import { loadSnapshotWith } from "@/lib/db/snapshot";
import { addDays, isIsoDate, localToday, periodStart, startOfWeek } from "@/lib/engine/dates";
import { parseExport, planImport, type ImportCounts } from "@/lib/progress/export";
import type {
  LearnedVia,
  ProgressSnapshot,
  RecallCardRow,
  RecallMode,
  RecallResult,
} from "@/lib/progress/types";

// ---------------------------------------------------------------- input schemas

const contentId = z.string().trim().min(1, "must not be empty").max(200);
const uuid = z.guid("expected a UUID");
const localDate = z.string().refine(isIsoDate, "expected a YYYY-MM-DD date");
/** Optional free text: blank becomes null. */
const optionalText = (max: number) =>
  z
    .string()
    .max(max)
    .nullish()
    .transform((v) => (v && v.trim() ? v : null));
const optionalId = contentId.nullish().transform((v) => v ?? null);
const minutes = z.number().int().min(1).max(1440);
const activity = z.enum(["watch", "read", "do", "build", "output", "habit", "review", "other"]);
const habitKey = z
  .string()
  .trim()
  .regex(/^[^/\s]+\/[^/\s]+$/, "expected `<owner id>/<item id>`");

export const setItemStatusSchema = z.object({
  skillId: contentId,
  itemId: contentId,
  status: z.enum(["todo", "done", "skipped"]),
  /** 0/null means "don't log time". */
  minutes: z.number().int().min(0).max(1440).nullish(),
  activity: activity.optional(),
});

export const logTimeSchema = z.object({
  skillId: optionalId,
  itemId: optionalId,
  questId: optionalId,
  habitKey: habitKey.nullish().transform((v) => v ?? null),
  activity,
  minutes,
  loggedOn: localDate.nullish(),
  note: optionalText(2000),
});

export const idSchema = z.object({ id: uuid });

export const saveNoteSchema = z
  .object({
    id: uuid.nullish(),
    skillId: optionalId,
    itemId: optionalId,
    questId: optionalId,
    kind: z.enum(["note", "output"]),
    title: optionalText(300),
    body: z.string().max(200_000),
    url: z
      .union([z.url({ protocol: /^https?$/, error: "expected an http(s) URL" }), z.literal("")])
      .nullish()
      .transform((v) => (v ? v : null)),
  })
  .refine((n) => n.skillId !== null || n.questId !== null, { message: "A note needs a skillId or a questId" });

export const submitRecallSchema = z.object({
  skillId: contentId,
  mode: z.enum(["test-out", "complete", "review"]),
  answers: z
    .array(
      z.object({
        questionId: contentId,
        result: z.enum(["pass", "fail"]),
        answer: optionalText(20_000),
      }),
    )
    .min(1, "answer at least one question"),
});

export const skillIdSchema = z.object({ skillId: contentId });

export const setSkillStarredSchema = z.object({ skillId: contentId, starred: z.boolean() });

export const verifyItemSchema = z.object({
  skillId: contentId,
  itemId: contentId,
  changed: z.boolean(),
  note: optionalText(2000),
});

const hoursPerWeek = z.number().positive().max(168);

export const startQuestSchema = z.object({
  questId: contentId,
  startedOn: localDate.nullish(),
  hoursPerWeek: hoursPerWeek.nullish(),
});

export const setQuestRunStatusSchema = z.object({
  runId: uuid,
  status: z.enum(["active", "paused", "completed", "abandoned"]),
});

export const updateQuestRunSchema = z
  .object({
    runId: uuid,
    startedOn: localDate.optional(),
    hoursPerWeek: hoursPerWeek.nullable().optional(),
  })
  .refine((u) => u.startedOn !== undefined || u.hoursPerWeek !== undefined, {
    message: "Nothing to update: pass startedOn and/or hoursPerWeek",
  });

export const logHabitSchema = z.object({
  habitKey,
  unit: z.enum(["week", "month", "year"]),
  doneOn: localDate.nullish(),
  minutes: z.number().int().min(0).max(1440).nullish(),
  note: optionalText(2000),
});

export const undoHabitSchema = z.object({ habitLogId: uuid });

export const importProgressSchema = z.object({
  json: z.string().min(2).max(20_000_000),
  mode: z.enum(["replace", "merge"]),
});

export type SetItemStatusInput = z.input<typeof setItemStatusSchema>;
export type LogTimeInput = z.input<typeof logTimeSchema>;
export type IdInput = z.input<typeof idSchema>;
export type SaveNoteInput = z.input<typeof saveNoteSchema>;
export type SubmitRecallInput = z.input<typeof submitRecallSchema>;
export type SkillIdInput = z.input<typeof skillIdSchema>;
export type SetSkillStarredInput = z.input<typeof setSkillStarredSchema>;
export type VerifyItemInput = z.input<typeof verifyItemSchema>;
export type StartQuestInput = z.input<typeof startQuestSchema>;
export type SetQuestRunStatusInput = z.input<typeof setQuestRunStatusSchema>;
export type UpdateQuestRunInput = z.input<typeof updateQuestRunSchema>;
export type LogHabitInput = z.input<typeof logHabitSchema>;
export type UndoHabitInput = z.input<typeof undoHabitSchema>;
export type ImportProgressInput = z.input<typeof importProgressSchema>;

export interface SubmitRecallResult {
  passed: number;
  total: number;
  /** This submission marked the skill learned (newly, or self-reported → tested-out/completed). */
  learned: boolean;
  /** The route it was learned by, when `learned`. */
  learnedVia: LearnedVia | null;
}

// ---------------------------------------------------------------- pure helpers

export interface RecallAnswer {
  questionId: string;
  result: RecallResult;
}

/**
 * Checks answers against a skill's recall question ids and counts passes.
 * Test-out and completion must answer every question exactly once; a review
 * may cover any non-empty subset (spaced review asks only the due cards).
 */
export function evaluateRecall(
  questionIds: readonly string[],
  answers: readonly RecallAnswer[],
  mode: RecallMode,
): { passed: number; total: number; allPassed: boolean } {
  if (questionIds.length === 0) throw new Error("This skill has no Recall questions.");
  if (questionIds.some((q) => !q)) {
    throw new Error("This skill has Recall questions without ids; run `pnpm content:ids` first.");
  }
  const known = new Set(questionIds);
  const seen = new Set<string>();
  for (const a of answers) {
    if (!known.has(a.questionId)) throw new Error(`Unknown recall question "${a.questionId}".`);
    if (seen.has(a.questionId)) throw new Error(`Recall question "${a.questionId}" was answered twice.`);
    seen.add(a.questionId);
  }
  if (mode !== "review") {
    const missing = questionIds.filter((q) => !seen.has(q));
    if (missing.length > 0) throw new Error(`Answer every Recall question; missing: ${missing.join(", ")}.`);
  }
  const passed = answers.filter((a) => a.result === "pass").length;
  const total = answers.length;
  return { passed, total, allPassed: total > 0 && passed === total && seen.size === questionIds.length };
}

/**
 * The learned route a recall submission sets, or null for no change.
 * Only a clean sweep counts; review never changes it; an already
 * completed/tested-out skill keeps its route; a self-reported one (row or
 * content starting skill) is upgraded.
 */
export function learnedViaAfterRecall(args: {
  mode: RecallMode;
  allPassed: boolean;
  current: LearnedVia | null;
  isStarting: boolean;
}): LearnedVia | null {
  if (args.mode === "review" || !args.allPassed) return null;
  const effective = args.current ?? (args.isStarting ? "self-reported" : null);
  if (effective !== null && effective !== "self-reported") return null;
  return args.mode === "test-out" ? "tested-out" : "completed";
}

/** Fresh Leitner cards for a skill that was just learned: box 1, due after the first interval. */
export function initialRecallCards(
  skillId: string,
  questionIds: readonly string[],
  today: string,
  reviewedAt: string,
): RecallCardRow[] {
  return questionIds.map((questionId) => ({
    skillId,
    questionId,
    box: 1,
    dueOn: addDays(today, LEITNER_INTERVALS_DAYS[0]),
    lastResult: "pass",
    lastReviewedAt: reviewedAt,
  }));
}

/** Leitner step after a review: pass moves up a box (capped), fail drops to box 1. */
export function nextRecallCard(card: RecallCardRow, result: RecallResult, today: string, reviewedAt: string): RecallCardRow {
  const maxBox = LEITNER_INTERVALS_DAYS.length;
  const box = result === "pass" ? Math.min(Math.max(card.box, 1) + 1, maxBox) : 1;
  return {
    ...card,
    box,
    dueOn: addDays(today, LEITNER_INTERVALS_DAYS[box - 1]),
    lastResult: result,
    lastReviewedAt: reviewedAt,
  };
}

/** A quest run starts on a Monday: the given date's week, or this week. */
export function questStartMonday(startedOn: string | null | undefined, today: string): string {
  return startOfWeek(startedOn ?? today);
}

// ---------------------------------------------------------------- DB helpers

interface DbError {
  message: string;
  code?: string;
  details?: string | null;
  hint?: string | null;
}

function dbFail(what: string, error: DbError): never {
  if (error.code === "23505" && /quest_runs_one_active/.test(`${error.message} ${error.details ?? ""}`)) {
    throw new Error(`${what}: another quest run is already active. Pause it first.`);
  }
  throw new Error(`${what}: ${error.message}${error.hint ? ` (${error.hint})` : ""}`);
}

/** Unwraps a supabase-js response, throwing a message that names the operation. */
function must<T>(res: { data: T | null; error: DbError | null }, what: string): T | null {
  if (res.error) dbFail(what, res.error);
  return res.data;
}

function field(data: unknown, name: string): unknown {
  return data !== null && typeof data === "object" ? (data as Record<string, unknown>)[name] : undefined;
}

function idOf(data: unknown, what: string): string {
  const id = field(data, "id");
  if (typeof id === "string") return id;
  throw new Error(`${what}: no id returned`);
}

function nowIso(): string {
  return new Date().toISOString();
}

/** Creates the skill's progress row if needed and stamps started_at once. */
async function ensureSkillStarted(client: SupabaseClient, skillId: string, at: string): Promise<void> {
  must(
    await client
      .from("skill_progress")
      .upsert({ skill_id: skillId, started_at: at }, { onConflict: "skill_id", ignoreDuplicates: true }),
    "Starting skill",
  );
  must(
    await client.from("skill_progress").update({ started_at: at }).eq("skill_id", skillId).is("started_at", null),
    "Starting skill",
  );
}

async function currentLearnedVia(client: SupabaseClient, skillId: string): Promise<LearnedVia | null> {
  const data: unknown = must(
    await client.from("skill_progress").select("learned_via").eq("skill_id", skillId).maybeSingle(),
    "Reading skill progress",
  );
  const value = field(data, "learned_via");
  return value === "completed" || value === "tested-out" || value === "self-reported" ? value : null;
}

// ---------------------------------------------------------------- items & time

export async function setItemStatus(client: SupabaseClient, raw: SetItemStatusInput): Promise<void> {
  const input = setItemStatusSchema.parse(raw);
  if (input.status === "todo") {
    must(
      await client.from("item_progress").delete().eq("skill_id", input.skillId).eq("item_id", input.itemId),
      "Resetting item",
    );
    return;
  }
  const at = nowIso();
  must(
    await client
      .from("item_progress")
      .upsert(
        { skill_id: input.skillId, item_id: input.itemId, status: input.status, completed_at: at },
        { onConflict: "skill_id,item_id" },
      ),
    "Saving item status",
  );
  if (input.minutes && input.minutes > 0) {
    must(
      await client.from("time_logs").insert({
        skill_id: input.skillId,
        item_id: input.itemId,
        activity: input.activity ?? "other",
        minutes: input.minutes,
        logged_on: localToday(),
      }),
      "Logging time",
    );
  }
  await ensureSkillStarted(client, input.skillId, at);
}

export async function logTime(client: SupabaseClient, raw: LogTimeInput): Promise<{ id: string }> {
  const input = logTimeSchema.parse(raw);
  const data = must(
    await client
      .from("time_logs")
      .insert({
        skill_id: input.skillId,
        item_id: input.itemId,
        quest_id: input.questId,
        habit_key: input.habitKey,
        activity: input.activity,
        minutes: input.minutes,
        logged_on: input.loggedOn ?? localToday(),
        note: input.note,
      })
      .select("id")
      .single(),
    "Logging time",
  );
  return { id: idOf(data, "Logging time") };
}

export async function deleteTimeLog(client: SupabaseClient, raw: IdInput): Promise<void> {
  const { id } = idSchema.parse(raw);
  must(await client.from("time_logs").delete().eq("id", id), "Deleting time log");
}

// ---------------------------------------------------------------- notes

export async function saveNote(client: SupabaseClient, raw: SaveNoteInput): Promise<{ id: string }> {
  const input = saveNoteSchema.parse(raw);
  const fields = {
    skill_id: input.skillId,
    item_id: input.itemId,
    quest_id: input.questId,
    kind: input.kind,
    title: input.title,
    body: input.body,
    url: input.url,
  };
  if (input.id) {
    const data = must(
      await client.from("notes").update(fields).eq("id", input.id).select("id").maybeSingle(),
      "Saving note",
    );
    if (!data) throw new Error(`Saving note: note ${input.id} not found`);
    return { id: idOf(data, "Saving note") };
  }
  const data = must(await client.from("notes").insert(fields).select("id").single(), "Saving note");
  return { id: idOf(data, "Saving note") };
}

export async function deleteNote(client: SupabaseClient, raw: IdInput): Promise<void> {
  const { id } = idSchema.parse(raw);
  must(await client.from("notes").delete().eq("id", id), "Deleting note");
}

// ---------------------------------------------------------------- recall & skills

/**
 * Stores one run through a skill's Recall questions (one new session id) and
 * applies its outcome: a clean test-out or completion check marks the skill
 * learned and seeds its Leitner cards; a review moves the answered cards.
 */
export async function submitRecall(
  client: SupabaseClient,
  raw: SubmitRecallInput,
  findSkill: (skillId: string) => Skill | undefined,
): Promise<SubmitRecallResult> {
  const input = submitRecallSchema.parse(raw);
  const skill = findSkill(input.skillId);
  if (!skill) throw new Error(`Unknown skill "${input.skillId}".`);
  const questionIds = skill.recall.map((q) => q.id);
  const { passed, total, allPassed } = evaluateRecall(questionIds, input.answers, input.mode);

  const at = nowIso();
  const today = localToday();
  const current = await currentLearnedVia(client, skill.id);
  const sessionId = crypto.randomUUID();

  must(
    await client.from("recall_attempts").insert(
      input.answers.map((a) => ({
        skill_id: skill.id,
        question_id: a.questionId,
        mode: input.mode,
        session_id: sessionId,
        result: a.result,
        answer: a.answer,
        source: "app",
        created_at: at,
      })),
    ),
    "Saving recall answers",
  );

  const learnedVia = learnedViaAfterRecall({ mode: input.mode, allPassed, current, isStarting: isStartingSkill(skill) });
  if (learnedVia) {
    must(
      await client
        .from("skill_progress")
        .upsert({ skill_id: skill.id, learned_via: learnedVia, learned_at: at }, { onConflict: "skill_id" }),
      "Marking skill learned",
    );
    const cards = initialRecallCards(skill.id, questionIds, today, at);
    must(
      await client.from("recall_cards").upsert(rowsToDb("recallCards", cards), { onConflict: "skill_id,question_id" }),
      "Scheduling recall cards",
    );
  }

  if (input.mode === "review") await applyReview(client, skill.id, input.answers, today, at);

  return { passed, total, learned: learnedVia !== null, learnedVia };
}

async function applyReview(
  client: SupabaseClient,
  skillId: string,
  answers: readonly RecallAnswer[],
  today: string,
  at: string,
): Promise<void> {
  const data: unknown = must(
    await client.from("recall_cards").select("*").eq("skill_id", skillId),
    "Reading recall cards",
  );
  const cards = new Map<string, RecallCardRow>();
  for (const raw of Array.isArray(data) ? data : []) {
    const card = recallCardFromDb(raw);
    cards.set(card.questionId, card);
  }
  // Only learned skills have cards; reviewing anything else just records the attempts.
  const updated = answers.flatMap((a) => {
    const card = cards.get(a.questionId);
    return card ? [nextRecallCard(card, a.result, today, at)] : [];
  });
  if (updated.length === 0) return;
  must(
    await client.from("recall_cards").upsert(rowsToDb("recallCards", updated), { onConflict: "skill_id,question_id" }),
    "Updating recall cards",
  );
}

/** "I already know this": learned (self-reported), unless it's already learned another way. */
export async function selfReportSkill(client: SupabaseClient, raw: SkillIdInput): Promise<void> {
  const { skillId } = skillIdSchema.parse(raw);
  const current = await currentLearnedVia(client, skillId);
  if (current !== null) return;
  must(
    await client
      .from("skill_progress")
      .upsert({ skill_id: skillId, learned_via: "self-reported", learned_at: nowIso() }, { onConflict: "skill_id" }),
    "Self-reporting skill",
  );
}

/** Un-learns a skill: clears learned_via/learned_at and its recall cards; item progress is kept. */
export async function resetSkill(client: SupabaseClient, raw: SkillIdInput): Promise<void> {
  const { skillId } = skillIdSchema.parse(raw);
  must(
    await client.from("skill_progress").update({ learned_via: null, learned_at: null }).eq("skill_id", skillId),
    "Resetting skill",
  );
  must(await client.from("recall_cards").delete().eq("skill_id", skillId), "Resetting skill");
}

export async function setSkillStarred(client: SupabaseClient, raw: SetSkillStarredInput): Promise<void> {
  const { skillId, starred } = setSkillStarredSchema.parse(raw);
  must(
    await client.from("skill_progress").upsert({ skill_id: skillId, starred }, { onConflict: "skill_id" }),
    "Starring skill",
  );
}

export async function startSkill(client: SupabaseClient, raw: SkillIdInput): Promise<void> {
  const { skillId } = skillIdSchema.parse(raw);
  await ensureSkillStarted(client, skillId, nowIso());
}

export async function verifyItem(client: SupabaseClient, raw: VerifyItemInput): Promise<{ id: string }> {
  const input = verifyItemSchema.parse(raw);
  const data = must(
    await client
      .from("verifications")
      .insert({ skill_id: input.skillId, item_id: input.itemId, changed: input.changed, note: input.note })
      .select("id")
      .single(),
    "Saving verification",
  );
  return { id: idOf(data, "Saving verification") };
}

// ---------------------------------------------------------------- quests

async function activeRuns(client: SupabaseClient): Promise<{ id: string; questId: string }[]> {
  const data: unknown = must(
    await client.from("quest_runs").select("id, quest_id").eq("status", "active"),
    "Reading quest runs",
  );
  return (Array.isArray(data) ? data : []).flatMap((r: unknown) => {
    const id = field(r, "id");
    const questId = field(r, "quest_id");
    return typeof id === "string" && typeof questId === "string" ? [{ id, questId }] : [];
  });
}

async function setRunsStatus(client: SupabaseClient, ids: readonly string[], status: string, what: string): Promise<void> {
  if (ids.length === 0) return;
  must(await client.from("quest_runs").update({ status }).in("id", [...ids]), what);
}

/** Starts a new run of a quest (week 1 = a Monday), pausing whichever run was active. */
export async function startQuest(client: SupabaseClient, raw: StartQuestInput): Promise<{ id: string }> {
  const input = startQuestSchema.parse(raw);
  const startedOn = questStartMonday(input.startedOn, localToday());
  const active = await activeRuns(client);
  if (active.some((r) => r.questId === input.questId)) {
    throw new Error(`Quest "${input.questId}" already has an active run.`);
  }
  const paused = active.map((r) => r.id);
  await setRunsStatus(client, paused, "paused", "Pausing the active quest");
  const res = await client
    .from("quest_runs")
    .insert({ quest_id: input.questId, status: "active", started_on: startedOn, hours_per_week: input.hoursPerWeek ?? null })
    .select("id")
    .single();
  if (res.error) {
    // Put the previously active run back so a failed start changes nothing.
    if (paused.length > 0) await client.from("quest_runs").update({ status: "active" }).in("id", paused);
    dbFail("Starting quest", res.error);
  }
  return { id: idOf(res.data, "Starting quest") };
}

export async function setQuestRunStatus(client: SupabaseClient, raw: SetQuestRunStatusInput): Promise<void> {
  const { runId, status } = setQuestRunStatusSchema.parse(raw);
  if (status === "active") {
    const others = (await activeRuns(client)).filter((r) => r.id !== runId).map((r) => r.id);
    await setRunsStatus(client, others, "paused", "Pausing the active quest");
  }
  const data = must(
    await client.from("quest_runs").update({ status }).eq("id", runId).select("id").maybeSingle(),
    "Updating quest run",
  );
  if (!data) throw new Error(`Updating quest run: run ${runId} not found`);
}

export async function updateQuestRun(client: SupabaseClient, raw: UpdateQuestRunInput): Promise<void> {
  const input = updateQuestRunSchema.parse(raw);
  const patch: { started_on?: string; hours_per_week?: number | null } = {};
  if (input.startedOn !== undefined) patch.started_on = startOfWeek(input.startedOn);
  if (input.hoursPerWeek !== undefined) patch.hours_per_week = input.hoursPerWeek;
  const data = must(
    await client.from("quest_runs").update(patch).eq("id", input.runId).select("id").maybeSingle(),
    "Updating quest run",
  );
  if (!data) throw new Error(`Updating quest run: run ${input.runId} not found`);
}

// ---------------------------------------------------------------- habits

/** Records one habit occurrence (and its time, linked so undo removes both). */
export async function logHabit(client: SupabaseClient, raw: LogHabitInput): Promise<{ id: string }> {
  const input = logHabitSchema.parse(raw);
  const doneOn = input.doneOn ?? localToday();
  const minutesDone = input.minutes && input.minutes > 0 ? input.minutes : null;
  const data = must(
    await client
      .from("habit_logs")
      .insert({
        habit_key: input.habitKey,
        period_start: periodStart(doneOn, input.unit),
        done_on: doneOn,
        minutes: minutesDone,
        note: input.note,
      })
      .select("id")
      .single(),
    "Logging habit",
  );
  const id = idOf(data, "Logging habit");
  if (minutesDone !== null) {
    const res = await client.from("time_logs").insert({
      habit_key: input.habitKey,
      habit_log_id: id,
      activity: "habit",
      minutes: minutesDone,
      logged_on: doneOn,
      note: input.note,
    });
    if (res.error) {
      await client.from("habit_logs").delete().eq("id", id);
      dbFail("Logging habit time", res.error);
    }
  }
  return { id };
}

/** Deletes a habit occurrence; its linked time log goes with it (on delete cascade). */
export async function undoHabit(client: SupabaseClient, raw: UndoHabitInput): Promise<void> {
  const { habitLogId } = undoHabitSchema.parse(raw);
  must(await client.from("habit_logs").delete().eq("id", habitLogId), "Undoing habit");
}

// ---------------------------------------------------------------- import

const WRITE_CHUNK = 500;

async function writeRows<K extends SnapshotKey>(
  client: SupabaseClient,
  key: K,
  rows: ProgressSnapshot[K],
  how: "insert" | "upsert",
): Promise<void> {
  const { table, primaryKey } = TABLES[key];
  const dbRows = rowsToDb(key, rows);
  for (let i = 0; i < dbRows.length; i += WRITE_CHUNK) {
    const chunk = dbRows.slice(i, i + WRITE_CHUNK);
    const res =
      how === "insert"
        ? await client.from(table).insert(chunk)
        : await client.from(table).upsert(chunk, { onConflict: primaryKey.join(",") });
    must(res, `Writing ${table}`);
  }
}

async function deleteAllRows(client: SupabaseClient): Promise<void> {
  for (const key of [...SNAPSHOT_KEYS].reverse()) {
    const { table, primaryKey } = TABLES[key];
    // PostgREST refuses an unfiltered DELETE; every primary key column is non-null.
    must(await client.from(table).delete().not(primaryKey[0], "is", null), `Clearing ${table}`);
  }
}

async function insertAll(client: SupabaseClient, snapshot: Partial<ProgressSnapshot>): Promise<void> {
  for (const key of SNAPSHOT_KEYS) {
    const rows = snapshot[key];
    if (rows && rows.length > 0) await writeRows(client, key, rows, "insert");
  }
}

/**
 * Imports a progress file (see src/lib/progress/export.ts). merge upserts the
 * file's rows (partial files allowed; safe to re-run); replace deletes
 * everything and inserts the file, restoring the previous rows if the insert
 * fails (PostgREST has no multi-statement transactions).
 */
export async function importProgress(client: SupabaseClient, raw: ImportProgressInput): Promise<ImportCounts> {
  const input = importProgressSchema.parse(raw);
  const file = parseExport(input.json);
  const current = await loadSnapshotWith(client);
  const plan = planImport(current, file.data, input.mode);

  if (plan.mode === "merge") {
    for (const key of SNAPSHOT_KEYS) {
      const rows = plan.writes[key];
      if (rows.length > 0) await writeRows(client, key, rows, "upsert");
    }
    return plan.counts;
  }

  await deleteAllRows(client);
  try {
    await insertAll(client, plan.writes);
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    try {
      await deleteAllRows(client);
      await insertAll(client, current);
    } catch (restoreErr) {
      throw new Error(
        `Import failed (${reason}) and restoring the previous data also failed ` +
          `(${restoreErr instanceof Error ? restoreErr.message : String(restoreErr)}). Re-import your last export.`,
      );
    }
    throw new Error(`Import failed; the previous data was restored. ${reason}`);
  }
  return plan.counts;
}
