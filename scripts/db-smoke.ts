#!/usr/bin/env tsx
// End-to-end smoke test of src/lib/db against the real database.
//
//   pnpm db:smoke
//
// Every row it writes uses ids starting with "zz-smoke" and is deleted at the
// end (also on failure). If a real quest run was active, it is paused by the
// quest steps and re-activated afterwards. Replace-mode import is never run
// here: it would wipe real progress.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Skill } from "@/lib/content/types";
import * as m from "@/lib/db/mutations";
import { createServiceClient } from "@/lib/db/raw-client";
import { loadSnapshotWith } from "@/lib/db/snapshot";
import { addDays, localToday, startOfWeek } from "@/lib/engine/dates";
import { buildExport, parseExport, PROGRESS_EXPORT_FORMAT, SNAPSHOT_TABLES, sameRow } from "@/lib/progress/export";
import type { ProgressSnapshot } from "@/lib/progress/types";

const PREFIX = "zz-smoke";
const SKILL = `${PREFIX}.test`;
const SKILL_SELF = `${PREFIX}.self`;
const QUEST_A = `${PREFIX}.quest-a`;
const QUEST_B = `${PREFIX}.quest-b`;
const HABIT = `${PREFIX}.quest-a/weekly-news`;

function fakeSkill(id: string, questionIds: string[], status: string | null = null): Skill {
  return {
    id,
    branchId: PREFIX,
    slug: id.split(".")[1] ?? id,
    title: `Smoke ${id}`,
    requires: [],
    related: [],
    status,
    estimate: null,
    factsAsOf: null,
    why: null,
    description: null,
    ranks: [],
    recall: questionIds.map((q, i) => ({ id: q, text: `Question ${q}?`, line: i + 1 })),
    sources: [],
    reviewLog: null,
    sections: [],
    extraMeta: {},
    file: "(smoke)",
    line: 1,
  };
}

const SKILLS: Record<string, Skill> = {
  [SKILL]: fakeSkill(SKILL, ["q1", "q2", "q3"]),
  [SKILL_SELF]: fakeSkill(SKILL_SELF, ["q1", "q2", "q3"], "learned (self-reported)"),
};
const findSkill = (id: string): Skill | undefined => SKILLS[id];

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`Assertion failed: ${message}`);
}

async function expectError(fn: () => Promise<unknown>, pattern: RegExp, what: string): Promise<void> {
  try {
    await fn();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    assert(pattern.test(message), `${what}: unexpected error "${message}"`);
    return;
  }
  throw new Error(`Assertion failed: ${what} should have thrown`);
}

let steps = 0;
async function step(name: string, fn: () => Promise<void>): Promise<void> {
  await fn();
  steps++;
  console.log(`ok  ${name}`);
}

const isSmoke = (value: string | null | undefined): boolean => typeof value === "string" && value.startsWith(PREFIX);

/** Only the rows this script owns. */
function smokeRows(s: ProgressSnapshot): ProgressSnapshot {
  return {
    items: s.items.filter((r) => isSmoke(r.skillId)),
    skills: s.skills.filter((r) => isSmoke(r.skillId)),
    timeLogs: s.timeLogs.filter((r) => isSmoke(r.skillId) || isSmoke(r.habitKey) || isSmoke(r.questId)),
    notes: s.notes.filter((r) => isSmoke(r.skillId) || isSmoke(r.questId)),
    recallAttempts: s.recallAttempts.filter((r) => isSmoke(r.skillId)),
    recallCards: s.recallCards.filter((r) => isSmoke(r.skillId)),
    verifications: s.verifications.filter((r) => isSmoke(r.skillId)),
    questRuns: s.questRuns.filter((r) => isSmoke(r.questId)),
    habitLogs: s.habitLogs.filter((r) => isSmoke(r.habitKey)),
  };
}

async function cleanup(client: SupabaseClient): Promise<void> {
  const deletes: [string, string][] = [
    ["time_logs", "skill_id"],
    ["time_logs", "habit_key"],
    ["time_logs", "quest_id"],
    ["habit_logs", "habit_key"],
    ["item_progress", "skill_id"],
    ["skill_progress", "skill_id"],
    ["notes", "skill_id"],
    ["notes", "quest_id"],
    ["recall_attempts", "skill_id"],
    ["recall_cards", "skill_id"],
    ["verifications", "skill_id"],
    ["quest_runs", "quest_id"],
  ];
  for (const [table, column] of deletes) {
    const { error } = await client.from(table).delete().like(column, `${PREFIX}%`);
    if (error) throw new Error(`cleanup ${table}.${column}: ${error.message}`);
  }
}

async function run(client: SupabaseClient): Promise<void> {
  const snap = async () => smokeRows(await loadSnapshotWith(client));
  const today = localToday();

  await step("setItemStatus done (+ time log, skill started)", async () => {
    await m.setItemStatus(client, { skillId: SKILL, itemId: "read-a", status: "done", minutes: 25, activity: "read" });
    const s = await snap();
    const item = s.items.find((r) => r.itemId === "read-a");
    assert(item?.status === "done", "item done");
    const log = s.timeLogs.find((r) => r.itemId === "read-a");
    assert(log?.minutes === 25 && log.activity === "read" && log.loggedOn === today, "time log for today");
    assert(s.skills.find((r) => r.skillId === SKILL)?.startedAt, "skill started");
  });

  await step("setItemStatus skipped, then todo deletes the row", async () => {
    const startedAt = (await snap()).skills.find((r) => r.skillId === SKILL)?.startedAt;
    await m.setItemStatus(client, { skillId: SKILL, itemId: "read-a", status: "skipped" });
    let s = await snap();
    assert(s.items.find((r) => r.itemId === "read-a")?.status === "skipped", "item skipped");
    assert(s.timeLogs.length === 1, "no time log without minutes");
    assert(s.skills.find((r) => r.skillId === SKILL)?.startedAt === startedAt, "started_at kept");
    await m.setItemStatus(client, { skillId: SKILL, itemId: "read-a", status: "todo" });
    s = await snap();
    assert(!s.items.some((r) => r.itemId === "read-a"), "row deleted");
  });

  await step("setItemStatus rejects bad input", async () => {
    await expectError(
      () => m.setItemStatus(client, { skillId: SKILL, itemId: "x", status: "done", minutes: 5000 }),
      /minutes/,
      "minutes > 1440",
    );
  });

  await step("logTime / deleteTimeLog", async () => {
    const { id } = await m.logTime(client, { skillId: SKILL, activity: "build", minutes: 90, loggedOn: "2026-09-21", note: " " });
    let s = await snap();
    const log = s.timeLogs.find((r) => r.id === id);
    assert(log?.minutes === 90 && log.loggedOn === "2026-09-21" && log.note === null, "time log stored, blank note → null");
    await m.deleteTimeLog(client, { id });
    s = await snap();
    assert(!s.timeLogs.some((r) => r.id === id), "time log deleted");
  });

  await step("saveNote insert/update, deleteNote", async () => {
    const { id } = await m.saveNote(client, { skillId: SKILL, itemId: "read-a", kind: "note", title: "First", body: "# hi" });
    await m.saveNote(client, { id, skillId: SKILL, kind: "output", title: "Second", body: "text", url: "https://example.com/x" });
    let s = await snap();
    const note = s.notes.find((r) => r.id === id);
    assert(note?.title === "Second" && note.kind === "output" && note.url === "https://example.com/x", "note updated");
    assert(note.itemId === null, "update replaces item link");
    assert(note.updatedAt >= note.createdAt, "updated_at trigger");
    await expectError(() => m.saveNote(client, { kind: "note", body: "orphan" }), /skillId or a questId/, "orphan note");
    await m.deleteNote(client, { id });
    s = await snap();
    assert(!s.notes.some((r) => r.id === id), "note deleted");
  });

  await step("verifyItem", async () => {
    const { id } = await m.verifyItem(client, { skillId: SKILL, itemId: "fact-a", changed: true, note: "APR moved" });
    const v = (await snap()).verifications.find((r) => r.id === id);
    assert(v?.changed === true && v.note === "APR moved", "verification stored");
  });

  await step("setSkillStarred / startSkill keeps started_at", async () => {
    const before = (await snap()).skills.find((r) => r.skillId === SKILL)?.startedAt;
    await m.setSkillStarred(client, { skillId: SKILL, starred: true });
    await m.startSkill(client, { skillId: SKILL });
    const row = (await snap()).skills.find((r) => r.skillId === SKILL);
    assert(row?.starred === true, "starred");
    assert(row.startedAt === before, "started_at unchanged");
  });

  await step("selfReportSkill, then a clean test-out upgrades to tested-out", async () => {
    await m.selfReportSkill(client, { skillId: SKILL_SELF });
    let s = await snap();
    assert(s.skills.find((r) => r.skillId === SKILL_SELF)?.learnedVia === "self-reported", "self-reported");
    const res = await m.submitRecall(
      client,
      {
        skillId: SKILL_SELF,
        mode: "test-out",
        answers: [
          { questionId: "q1", result: "pass", answer: "a" },
          { questionId: "q2", result: "pass" },
          { questionId: "q3", result: "pass", answer: "" },
        ],
      },
      findSkill,
    );
    assert(res.learned && res.learnedVia === "tested-out" && res.passed === 3 && res.total === 3, "result");
    s = await snap();
    assert(s.skills.find((r) => r.skillId === SKILL_SELF)?.learnedVia === "tested-out", "tested-out");
    const attempts = s.recallAttempts.filter((r) => r.skillId === SKILL_SELF);
    assert(attempts.length === 3 && new Set(attempts.map((a) => a.sessionId)).size === 1, "one session");
    const cards = s.recallCards.filter((r) => r.skillId === SKILL_SELF);
    assert(cards.length === 3 && cards.every((c) => c.box === 1 && c.dueOn === addDays(today, 1)), "cards box 1, due tomorrow");
  });

  await step("submitRecall: failed test-out doesn't learn; incomplete answers rejected", async () => {
    const res = await m.submitRecall(
      client,
      {
        skillId: SKILL,
        mode: "test-out",
        answers: [
          { questionId: "q1", result: "pass" },
          { questionId: "q2", result: "fail" },
          { questionId: "q3", result: "pass" },
        ],
      },
      findSkill,
    );
    assert(!res.learned && res.passed === 2 && res.total === 3, "not learned");
    await expectError(
      () => m.submitRecall(client, { skillId: SKILL, mode: "complete", answers: [{ questionId: "q1", result: "pass" }] }, findSkill),
      /missing: q2, q3/,
      "coverage",
    );
    await expectError(
      () => m.submitRecall(client, { skillId: `${PREFIX}.nope`, mode: "review", answers: [{ questionId: "q1", result: "pass" }] }, findSkill),
      /Unknown skill/,
      "unknown skill",
    );
  });

  await step("submitRecall complete → completed; review moves cards", async () => {
    const all = ["q1", "q2", "q3"].map((questionId) => ({ questionId, result: "pass" as const }));
    const res = await m.submitRecall(client, { skillId: SKILL, mode: "complete", answers: all }, findSkill);
    assert(res.learnedVia === "completed", "completed");
    await m.submitRecall(
      client,
      {
        skillId: SKILL,
        mode: "review",
        answers: [
          { questionId: "q1", result: "pass" },
          { questionId: "q2", result: "fail" },
        ],
      },
      findSkill,
    );
    const s = await snap();
    assert(s.skills.find((r) => r.skillId === SKILL)?.learnedVia === "completed", "review keeps learned");
    const card = (q: string) => s.recallCards.find((c) => c.skillId === SKILL && c.questionId === q);
    assert(card("q1")?.box === 2 && card("q1")?.dueOn === addDays(today, 3), "q1 up to box 2");
    assert(card("q2")?.box === 1 && card("q2")?.lastResult === "fail", "q2 back to box 1");
    assert(card("q3")?.box === 1 && card("q3")?.lastResult === "pass", "q3 untouched");
  });

  await step("resetSkill clears learned + cards, keeps items", async () => {
    await m.setItemStatus(client, { skillId: SKILL, itemId: "do-b", status: "done" });
    await m.resetSkill(client, { skillId: SKILL });
    const s = await snap();
    const row = s.skills.find((r) => r.skillId === SKILL);
    assert(row && row.learnedVia === null && row.learnedAt === null && row.starred, "learned cleared, star kept");
    assert(!s.recallCards.some((c) => c.skillId === SKILL), "cards deleted");
    assert(s.items.some((r) => r.skillId === SKILL && r.itemId === "do-b"), "items kept");
  });

  let runA = "";
  let runB = "";
  await step("startQuest snaps to Monday; a second start pauses the first", async () => {
    runA = (await m.startQuest(client, { questId: QUEST_A, startedOn: "2026-09-23", hoursPerWeek: 4 })).id;
    let s = await snap();
    const a = s.questRuns.find((r) => r.id === runA);
    assert(a?.status === "active" && a.startedOn === "2026-09-21" && a.hoursPerWeek === 4, "run A active from Monday");
    runB = (await m.startQuest(client, { questId: QUEST_B })).id;
    s = await snap();
    assert(s.questRuns.find((r) => r.id === runA)?.status === "paused", "run A paused");
    const b = s.questRuns.find((r) => r.id === runB);
    assert(b?.status === "active" && b.startedOn === startOfWeek(today) && b.hoursPerWeek === null, "run B active this week");
    await expectError(() => m.startQuest(client, { questId: QUEST_B }), /already has an active run/, "double start");
  });

  await step("setQuestRunStatus / updateQuestRun", async () => {
    await m.setQuestRunStatus(client, { runId: runA, status: "active" });
    let s = await snap();
    assert(s.questRuns.find((r) => r.id === runB)?.status === "paused", "activating A pauses B");
    await m.updateQuestRun(client, { runId: runA, startedOn: "2026-10-01", hoursPerWeek: 3.5 });
    s = await snap();
    const a = s.questRuns.find((r) => r.id === runA);
    assert(a?.startedOn === "2026-09-28" && a.hoursPerWeek === 3.5, "run A updated (snapped to Monday)");
    await m.updateQuestRun(client, { runId: runA, hoursPerWeek: null });
    await m.setQuestRunStatus(client, { runId: runA, status: "completed" });
    s = await snap();
    const done = s.questRuns.find((r) => r.id === runA);
    assert(done?.status === "completed" && done.hoursPerWeek === null, "run A completed, hours cleared");
    await expectError(
      () => m.setQuestRunStatus(client, { runId: crypto.randomUUID(), status: "paused" }),
      /not found/,
      "unknown run",
    );
  });

  await step("logHabit (+ linked time log) / undoHabit cascades", async () => {
    const { id } = await m.logHabit(client, { habitKey: HABIT, unit: "week", doneOn: "2026-09-24", minutes: 45, note: "ep 1" });
    let s = await snap();
    const h = s.habitLogs.find((r) => r.id === id);
    assert(h?.periodStart === "2026-09-21" && h.minutes === 45, "habit log with Monday period");
    const tl = s.timeLogs.find((r) => r.habitKey === HABIT);
    assert(tl?.activity === "habit" && tl.minutes === 45 && tl.loggedOn === "2026-09-24", "habit time logged");
    assert((tl as { habitLogId?: string | null }).habitLogId === id, "time log linked to habit log");
    const { id: monthly } = await m.logHabit(client, { habitKey: HABIT, unit: "month", doneOn: "2026-09-24" });
    s = await snap();
    assert(s.habitLogs.find((r) => r.id === monthly)?.periodStart === "2026-09-01", "month period");
    assert(s.timeLogs.filter((r) => r.habitKey === HABIT).length === 1, "no time log without minutes");
    await m.undoHabit(client, { habitLogId: id });
    await m.undoHabit(client, { habitLogId: monthly });
    s = await snap();
    assert(s.habitLogs.length === 0 && !s.timeLogs.some((r) => r.habitKey === HABIT), "habit + time log gone");
  });

  await step("importProgress merge: partial file, idempotent with ids, generated ids without", async () => {
    const attemptId = crypto.randomUUID();
    const sessionId = crypto.randomUUID();
    const file = JSON.stringify({
      format: PROGRESS_EXPORT_FORMAT,
      version: 1,
      exportedAt: "2026-09-23T10:00:00Z",
      data: {
        recallAttempts: [
          { id: attemptId, sessionId, skillId: SKILL, questionId: "q1", mode: "review", result: "pass", source: "claude-review" },
        ],
        skills: [{ skillId: `${PREFIX}.imported`, starred: true }],
      },
    });
    const first = await m.importProgress(client, { json: file, mode: "merge" });
    assert(first.recallAttempts.inserted === 1 && first.skills.inserted === 1, "first import inserts");
    const second = await m.importProgress(client, { json: file, mode: "merge" });
    assert(
      second.recallAttempts.unchanged === 1 && second.skills.unchanged === 1,
      `re-import unchanged: ${JSON.stringify({ attempts: second.recallAttempts, skills: second.skills })}`,
    );
    const s = await snap();
    const a = s.recallAttempts.find((r) => r.id === attemptId);
    assert(a?.source === "claude-review" && a.createdAt === "2026-09-23T10:00:00.000Z", "attempt imported");
    assert(s.skills.find((r) => r.skillId === `${PREFIX}.imported`)?.starred === true, "skill imported");

    const noIds = JSON.stringify({
      format: PROGRESS_EXPORT_FORMAT,
      version: 1,
      data: { recallAttempts: [{ skillId: SKILL, questionId: "q2", mode: "review", result: "fail" }] },
    });
    const third = await m.importProgress(client, { json: noIds, mode: "merge" });
    assert(third.recallAttempts.inserted === 1, "row without id inserted");
    await expectError(
      () => m.importProgress(client, { json: noIds, mode: "replace" }),
      /complete export/,
      "replace refuses partial files (before touching anything)",
    );
  });

  await step("replace-mode delete filter is accepted by PostgREST (scoped to smoke rows)", async () => {
    // importProgress(replace) clears tables with `.not(pk, "is", null)`; replace itself is never run here.
    await m.setItemStatus(client, { skillId: SKILL, itemId: "tmp", status: "done" });
    const { error } = await client.from("item_progress").delete().not("skill_id", "is", null).like("skill_id", `${PREFIX}%`);
    assert(!error, `delete filter: ${error?.message}`);
    assert((await snap()).items.length === 0, "smoke items cleared");
  });

  await step("export → parse round trip of the whole database", async () => {
    const full = await loadSnapshotWith(client);
    const exported = buildExport(full, new Date());
    const parsed = parseExport(JSON.stringify(exported));
    for (const t of SNAPSHOT_TABLES) {
      const rows = parsed.data[t] ?? [];
      assert(rows.length === full[t].length, `${t} row count`);
      rows.forEach((row, i) => assert(sameRow(row, full[t][i]), `${t}[${i}] round-trips`));
    }
  });
}

async function main(): Promise<void> {
  const client = createServiceClient();
  const started = Date.now();
  await cleanup(client); // leftovers from an aborted earlier run
  const before = await loadSnapshotWith(client);
  const realActive = before.questRuns.filter((r) => r.status === "active" && !isSmoke(r.questId)).map((r) => r.id);

  let failure: unknown = null;
  try {
    await run(client);
  } catch (err) {
    failure = err;
  } finally {
    await cleanup(client);
    if (realActive.length > 0) {
      const { error } = await client.from("quest_runs").update({ status: "active" }).in("id", realActive);
      if (error) console.error(`!! could not re-activate quest run(s) ${realActive.join(", ")}: ${error.message}`);
      else console.log(`restored active quest run(s): ${realActive.join(", ")}`);
    }
  }

  const left = smokeRows(await loadSnapshotWith(client));
  const leftover = SNAPSHOT_TABLES.filter((t) => left[t].length > 0).map((t) => `${t}=${left[t].length}`);
  if (leftover.length > 0) console.error(`!! leftover smoke rows: ${leftover.join(", ")}`);
  else console.log("cleanup: no zz-smoke rows left");

  if (failure) throw failure;
  if (leftover.length > 0) throw new Error("cleanup incomplete");
  console.log(`${steps} steps passed in ${Date.now() - started} ms`);
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? (err.stack ?? err.message) : err);
  process.exit(1);
});
