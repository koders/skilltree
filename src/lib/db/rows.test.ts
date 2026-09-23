import { describe, expect, it } from "vitest";
import {
  habitLogFromDb,
  itemProgressFromDb,
  noteFromDb,
  normalizeTimestamp,
  questRunFromDb,
  recallAttemptFromDb,
  recallCardFromDb,
  rowsFromDb,
  rowsToDb,
  skillProgressFromDb,
  SNAPSHOT_KEYS,
  TABLES,
  timeLogFromDb,
  timeLogToDb,
  verificationFromDb,
} from "@/lib/db/rows";
import type { TimeLogRow } from "@/lib/progress/types";

// Rows shaped like PostgREST returns them (timestamptz with µs and +00:00).
const DB = {
  item_progress: {
    skill_id: "crypto.consensus",
    item_id: "read-pos",
    status: "done",
    completed_at: "2026-09-23T08:15:30.123456+00:00",
    updated_at: "2026-09-23T08:15:30.123456+00:00",
  },
  skill_progress: {
    skill_id: "crypto.consensus",
    learned_via: null,
    learned_at: null,
    started_at: "2026-09-22T21:00:00+00:00",
    starred: true,
    updated_at: "2026-09-22T21:00:00+00:00",
  },
  time_logs: {
    id: "7d1f5c1e-7a7b-4f3e-9d0a-1c2b3d4e5f60",
    skill_id: "crypto.consensus",
    item_id: "read-pos",
    quest_id: null,
    habit_key: null,
    habit_log_id: null,
    activity: "read",
    minutes: 30,
    logged_on: "2026-09-23",
    note: null,
    created_at: "2026-09-23T08:15:30.5+00:00",
  },
  notes: {
    id: "0b7e3f7e-1111-4a2b-8c3d-000000000001",
    skill_id: null,
    item_id: null,
    quest_id: "quest-crypto-finance-the-tie",
    kind: "output",
    title: "Week 1 memo",
    body: "## memo",
    url: "https://example.com/memo",
    created_at: "2026-09-23T10:00:00+03:00",
    updated_at: "2026-09-23T10:05:00+03:00",
  },
  recall_attempts: {
    id: "0b7e3f7e-1111-4a2b-8c3d-000000000002",
    skill_id: "crypto.consensus",
    question_id: "q1",
    mode: "test-out",
    session_id: "0b7e3f7e-1111-4a2b-8c3d-000000000003",
    result: "pass",
    answer: "finality",
    source: "app",
    created_at: "2026-09-23T08:00:00+00:00",
  },
  recall_cards: {
    skill_id: "crypto.consensus",
    question_id: "q1",
    box: 2,
    due_on: "2026-09-26",
    last_result: "pass",
    last_reviewed_at: "2026-09-23T08:00:00+00:00",
  },
  verifications: {
    id: "0b7e3f7e-1111-4a2b-8c3d-000000000004",
    skill_id: "finance.market-structure",
    item_id: "fees",
    verified_at: "2026-09-23T08:00:00+00:00",
    changed: false,
    note: null,
  },
  quest_runs: {
    id: "0b7e3f7e-1111-4a2b-8c3d-000000000005",
    quest_id: "quest-crypto-finance-the-tie",
    status: "active",
    started_on: "2026-09-21",
    hours_per_week: 4.5,
    forked_from: null,
    definition: null,
    created_at: "2026-09-23T08:00:00+00:00",
    updated_at: "2026-09-23T08:00:00+00:00",
  },
  habit_logs: {
    id: "0b7e3f7e-1111-4a2b-8c3d-000000000006",
    habit_key: "quest-crypto-finance-the-tie/unchained-weekly",
    period_start: "2026-09-21",
    done_on: "2026-09-23",
    minutes: 45,
    note: null,
    created_at: "2026-09-23T08:00:00+00:00",
  },
};

function without<T extends object>(obj: T, key: keyof T): Record<string, unknown> {
  return Object.fromEntries(Object.entries(obj).filter(([k]) => k !== key));
}

describe("normalizeTimestamp", () => {
  it("turns Postgres timestamptz output into toISOString form", () => {
    expect(normalizeTimestamp("2026-09-23T08:15:30.123456+00:00")).toBe("2026-09-23T08:15:30.123Z");
    expect(normalizeTimestamp("2026-09-23T10:00:00+03:00")).toBe("2026-09-23T07:00:00.000Z");
  });

  it("rejects garbage", () => {
    expect(() => normalizeTimestamp("yesterday")).toThrow(/Invalid timestamp/);
  });
});

describe("DB → app mappers", () => {
  it("maps item_progress", () => {
    expect(itemProgressFromDb(DB.item_progress)).toEqual({
      skillId: "crypto.consensus",
      itemId: "read-pos",
      status: "done",
      completedAt: "2026-09-23T08:15:30.123Z",
    });
  });

  it("maps skill_progress with nulls", () => {
    expect(skillProgressFromDb(DB.skill_progress)).toEqual({
      skillId: "crypto.consensus",
      learnedVia: null,
      learnedAt: null,
      startedAt: "2026-09-22T21:00:00.000Z",
      starred: true,
    });
  });

  it("maps time_logs including the habit link", () => {
    expect(timeLogFromDb({ ...DB.time_logs, habit_log_id: DB.habit_logs.id })).toMatchObject({
      id: DB.time_logs.id,
      activity: "read",
      minutes: 30,
      loggedOn: "2026-09-23",
      habitLogId: DB.habit_logs.id,
      createdAt: "2026-09-23T08:15:30.500Z",
    });
    expect(timeLogFromDb(without(DB.time_logs, "habit_log_id")).habitLogId).toBeNull();
  });

  it("maps notes, recall, verifications and habits", () => {
    expect(noteFromDb(DB.notes)).toMatchObject({ questId: "quest-crypto-finance-the-tie", kind: "output", createdAt: "2026-09-23T07:00:00.000Z" });
    expect(recallAttemptFromDb(DB.recall_attempts)).toMatchObject({ questionId: "q1", mode: "test-out", sessionId: DB.recall_attempts.session_id });
    expect(recallCardFromDb(DB.recall_cards)).toEqual({
      skillId: "crypto.consensus",
      questionId: "q1",
      box: 2,
      dueOn: "2026-09-26",
      lastResult: "pass",
      lastReviewedAt: "2026-09-23T08:00:00.000Z",
    });
    expect(verificationFromDb(DB.verifications)).toMatchObject({ itemId: "fees", changed: false });
    expect(habitLogFromDb(DB.habit_logs)).toMatchObject({ periodStart: "2026-09-21", doneOn: "2026-09-23", minutes: 45 });
  });

  it("accepts numeric as a string and turns a missing jsonb into null", () => {
    const run = questRunFromDb({ ...without(DB.quest_runs, "definition"), hours_per_week: "3.5" });
    expect(run.hoursPerWeek).toBe(3.5);
    expect(run.definition).toBeNull();
    expect(questRunFromDb({ ...DB.quest_runs, definition: { stages: [] } }).definition).toEqual({ stages: [] });
  });

  it("rejects values outside the schema", () => {
    expect(() => itemProgressFromDb({ ...DB.item_progress, status: "todo" })).toThrow();
    expect(() => habitLogFromDb({ ...DB.habit_logs, done_on: "2026-02-30" })).toThrow();
  });
});

describe("rowsFromDb", () => {
  it("maps every row of a table", () => {
    const rows = rowsFromDb("items", [DB.item_progress, { ...DB.item_progress, item_id: "other", status: "skipped" }]);
    expect(rows.map((r) => [r.itemId, r.status])).toEqual([
      ["read-pos", "done"],
      ["other", "skipped"],
    ]);
  });

  it("names the table, row and column of a bad row", () => {
    expect(() => rowsFromDb("timeLogs", [DB.time_logs, { ...DB.time_logs, logged_on: "23.09.2026" }])).toThrow(
      /time_logs row 1: logged_on: expected a YYYY-MM-DD date/,
    );
  });

  it("rejects a non-array payload", () => {
    expect(() => rowsFromDb("skills", null)).toThrow(/skill_progress: expected an array/);
  });
});

describe("app → DB mappers", () => {
  it("round-trips every table through rowsToDb", () => {
    const cases = [
      ["items", "item_progress"],
      ["skills", "skill_progress"],
      ["timeLogs", "time_logs"],
      ["notes", "notes"],
      ["recallAttempts", "recall_attempts"],
      ["recallCards", "recall_cards"],
      ["verifications", "verifications"],
      ["questRuns", "quest_runs"],
      ["habitLogs", "habit_logs"],
    ] as const;
    for (const [key, table] of cases) {
      const rows = rowsFromDb(key, [DB[table]]);
      const back = rowsToDb(key, rows);
      expect(rowsFromDb(key, back), key).toEqual(rows);
      expect(Object.keys(back[0]).every((k) => k === k.toLowerCase()), `${key} is snake_case`).toBe(true);
    }
  });

  it("writes habit_log_id as null for plain contract rows", () => {
    const plain: TimeLogRow = {
      id: DB.time_logs.id,
      skillId: null,
      itemId: null,
      questId: null,
      habitKey: "quest-a/weekly",
      activity: "habit",
      minutes: 20,
      loggedOn: "2026-09-23",
      note: null,
      createdAt: "2026-09-23T08:00:00.000Z",
    };
    expect(timeLogToDb(plain).habit_log_id).toBeNull();
  });
});

describe("TABLES", () => {
  it("covers every snapshot key once, in FK order", () => {
    expect([...SNAPSHOT_KEYS].sort()).toEqual(Object.keys(TABLES).sort());
    expect(SNAPSHOT_KEYS.indexOf("habitLogs")).toBeLessThan(SNAPSHOT_KEYS.indexOf("timeLogs"));
    expect(TABLES.items.primaryKey).toEqual(["skill_id", "item_id"]);
    expect(TABLES.recallCards.primaryKey).toEqual(["skill_id", "question_id"]);
  });
});
