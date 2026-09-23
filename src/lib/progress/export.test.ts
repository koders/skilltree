import { describe, expect, it } from "vitest";
import {
  buildExport,
  exportFileName,
  mergeSnapshots,
  parseExport,
  planImport,
  PROGRESS_EXPORT_FORMAT,
  rowKey,
  sameRow,
  SNAPSHOT_TABLES,
  summarizeCounts,
} from "@/lib/progress/export";
import { EMPTY_SNAPSHOT, type ProgressSnapshot } from "@/lib/progress/types";

const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

const SNAPSHOT: ProgressSnapshot = {
  items: [
    { skillId: "crypto.consensus", itemId: "read-pos", status: "done", completedAt: "2026-09-22T08:00:00.000Z" },
    { skillId: "crypto.consensus", itemId: "watch-intro", status: "skipped", completedAt: "2026-09-22T09:00:00.000Z" },
  ],
  skills: [
    {
      skillId: "crypto.consensus",
      learnedVia: "tested-out",
      learnedAt: "2026-09-23T08:00:00.000Z",
      startedAt: "2026-09-22T08:00:00.000Z",
      starred: false,
    },
  ],
  timeLogs: [
    {
      id: uuid(1),
      skillId: "crypto.consensus",
      itemId: "read-pos",
      questId: null,
      habitKey: null,
      activity: "read",
      minutes: 40,
      loggedOn: "2026-09-22",
      note: null,
      createdAt: "2026-09-22T08:00:00.000Z",
    },
  ],
  notes: [
    {
      id: uuid(2),
      skillId: "crypto.consensus",
      itemId: null,
      questId: null,
      kind: "note",
      title: null,
      body: "PoS in one line",
      url: null,
      createdAt: "2026-09-22T08:00:00.000Z",
      updatedAt: "2026-09-22T08:30:00.000Z",
    },
  ],
  recallAttempts: [
    {
      id: uuid(3),
      skillId: "crypto.consensus",
      questionId: "q1",
      mode: "test-out",
      sessionId: uuid(4),
      result: "pass",
      answer: "slashing",
      source: "app",
      createdAt: "2026-09-23T08:00:00.000Z",
    },
  ],
  recallCards: [
    {
      skillId: "crypto.consensus",
      questionId: "q1",
      box: 1,
      dueOn: "2026-09-24",
      lastResult: "pass",
      lastReviewedAt: "2026-09-23T08:00:00.000Z",
    },
  ],
  verifications: [
    { id: uuid(5), skillId: "crypto.consensus", itemId: "read-pos", verifiedAt: "2026-09-23T08:00:00.000Z", changed: false, note: null },
  ],
  questRuns: [
    {
      id: uuid(6),
      questId: "quest-crypto-finance-the-tie",
      status: "active",
      startedOn: "2026-09-21",
      hoursPerWeek: 4.5,
      forkedFrom: null,
      definition: null,
      createdAt: "2026-09-21T08:00:00.000Z",
      updatedAt: "2026-09-21T08:00:00.000Z",
    },
  ],
  habitLogs: [
    {
      id: uuid(7),
      habitKey: "quest-crypto-finance-the-tie/unchained-weekly",
      periodStart: "2026-09-21",
      doneOn: "2026-09-23",
      minutes: 45,
      note: null,
      createdAt: "2026-09-23T08:00:00.000Z",
    },
  ],
};

function file(data: unknown, extra: Record<string, unknown> = {}): string {
  return JSON.stringify({ format: PROGRESS_EXPORT_FORMAT, version: 1, exportedAt: "2026-09-23T12:00:00Z", data, ...extra });
}

function counter(start = 100): () => string {
  let n = start;
  return () => uuid(n++);
}

describe("buildExport", () => {
  it("wraps every table with format, version and a normalised timestamp", () => {
    const out = buildExport(SNAPSHOT, "2026-09-23T15:00:00+03:00");
    expect(out.format).toBe("skilltree-progress");
    expect(out.version).toBe(1);
    expect(out.exportedAt).toBe("2026-09-23T12:00:00.000Z");
    expect(Object.keys(out.data)).toEqual([...SNAPSHOT_TABLES]);
    expect(out.data.items).toEqual(SNAPSHOT.items);
    expect(out.data.items).not.toBe(SNAPSHOT.items);
  });

  it("names the download after the local date", () => {
    expect(exportFileName("2026-09-23")).toBe("skilltree-progress-2026-09-23.json");
  });

  it("rejects an invalid exportedAt", () => {
    expect(() => buildExport(EMPTY_SNAPSHOT, "not a date")).toThrow(/Invalid exportedAt/);
  });
});

describe("parseExport", () => {
  it("round-trips a full export", () => {
    const parsed = parseExport(JSON.stringify(buildExport(SNAPSHOT, new Date("2026-09-23T12:00:00Z"))));
    expect(parsed.exportedAt).toBe("2026-09-23T12:00:00.000Z");
    for (const t of SNAPSHOT_TABLES) {
      const rows: unknown[] = parsed.data[t] ?? [];
      const expected: unknown[] = SNAPSHOT[t];
      expect(rows.length, t).toBe(expected.length);
      rows.forEach((row, i) => expect(sameRow(row, expected[i]), `${t}[${i}]`).toBe(true));
    }
    // habitLogId is part of the format (time_logs.habit_log_id) and defaults to null.
    expect(parsed.data.timeLogs?.[0]).toMatchObject({ habitLogId: null });
  });

  it("accepts a partial file and fills defaults (the review-skill write-back case)", () => {
    const parsed = parseExport(
      JSON.stringify({
        format: PROGRESS_EXPORT_FORMAT,
        version: 1,
        data: {
          recallAttempts: [
            { skillId: "crypto.consensus", questionId: "q1", mode: "review", result: "pass", source: "claude-review" },
            { skillId: "crypto.consensus", questionId: "q2", mode: "review", result: "fail", answer: "not sure" },
            { skillId: "finance.money-settlement", questionId: "q1", mode: "review", result: "pass" },
          ],
        },
      }),
      { newId: counter(), now: new Date("2026-09-23T20:00:00Z") },
    );
    expect(parsed.exportedAt).toBeNull();
    expect(Object.keys(parsed.data)).toEqual(["recallAttempts"]);
    const [a, b, c] = parsed.data.recallAttempts ?? [];
    expect(a).toMatchObject({ source: "claude-review", answer: null, createdAt: "2026-09-23T20:00:00.000Z" });
    expect(b.source).toBe("import");
    expect(new Set([a.id, b.id, c.id]).size).toBe(3);
    // One generated session per (skill, mode).
    expect(a.sessionId).toBe(b.sessionId);
    expect(c.sessionId).not.toBe(a.sessionId);
  });

  it("defaults createdAt to exportedAt when present", () => {
    const parsed = parseExport(file({ verifications: [{ skillId: "s.a", itemId: "i" }] }), { newId: counter() });
    expect(parsed.data.verifications?.[0]).toMatchObject({ verifiedAt: "2026-09-23T12:00:00.000Z", changed: false, note: null });
  });

  it("fills quest run defaults (id, hours, fork, definition)", () => {
    const parsed = parseExport(file({ questRuns: [{ questId: "quest-a", status: "paused", startedOn: "2026-09-21" }] }), {
      newId: counter(7),
    });
    expect(parsed.data.questRuns?.[0]).toEqual({
      id: uuid(7),
      questId: "quest-a",
      status: "paused",
      startedOn: "2026-09-21",
      hoursPerWeek: null,
      forkedFrom: null,
      definition: null,
      createdAt: "2026-09-23T12:00:00.000Z",
      updatedAt: "2026-09-23T12:00:00.000Z",
    });
  });

  it("accepts an empty data object", () => {
    expect(parseExport(file({})).data).toEqual({});
  });

  it.each([
    ["not JSON", "{nope", /not valid JSON/],
    ["no envelope", JSON.stringify([1, 2]), /expected \{ format, version, data \}/],
    ["wrong format", JSON.stringify({ format: "other", version: 1, data: {} }), /format is "other"/],
    ["future version", JSON.stringify({ format: PROGRESS_EXPORT_FORMAT, version: 2, data: {} }), /version 2 is not supported/],
    ["unknown table", file({ recall_attempts: [] }), /unknown table\(s\) in data: recall_attempts/],
    ["bad exportedAt", file({}, { exportedAt: "yesterday" }), /exportedAt: expected an ISO timestamp/],
  ])("rejects %s", (_name, json, pattern) => {
    expect(() => parseExport(json)).toThrow(pattern);
  });

  it("reports the path of every bad field", () => {
    const json = file({
      timeLogs: [{ ...SNAPSHOT.timeLogs[0], minutes: 2000 }],
      items: [{ skillId: "s.a", itemId: "i", status: "todo" }],
    });
    let message = "";
    try {
      parseExport(json);
    } catch (err) {
      message = err instanceof Error ? err.message : "";
    }
    expect(message).toMatch(/^Invalid progress file:/);
    expect(message).toMatch(/data\.timeLogs\[0\]\.minutes/);
    expect(message).toMatch(/data\.items\[0\]\.status/);
  });

  it("rejects unknown row fields (typos) instead of dropping them", () => {
    expect(() => parseExport(file({ skills: [{ skillId: "s.a", stared: true }] }))).toThrow(/data\.skills\[0\]/);
  });

  it("enforces the database checks", () => {
    expect(() => parseExport(file({ notes: [{ kind: "note", body: "x" }] }))).toThrow(/needs a skillId or a questId/);
    expect(() =>
      parseExport(file({ habitLogs: [{ habitKey: "q/h", periodStart: "2026-09-28", doneOn: "2026-09-23" }] })),
    ).toThrow(/periodStart must not be after doneOn/);
    expect(() => parseExport(file({ recallCards: [{ skillId: "s.a", questionId: "q1", box: 0, dueOn: "2026-09-24" }] }))).toThrow(
      /recallCards\[0\]\.box/,
    );
    expect(() => parseExport(file({ questRuns: [{ questId: "q", status: "active", startedOn: "2026-09-21", hoursPerWeek: 0 }] }))).toThrow(
      /hoursPerWeek/,
    );
    expect(() => parseExport(file({ timeLogs: [{ ...SNAPSHOT.timeLogs[0], id: "not-a-uuid" }] }))).toThrow(/expected a UUID/);
  });

  it("rejects duplicate primary keys within the file", () => {
    const dup = { skillId: "s.a", itemId: "i", status: "done" };
    expect(() => parseExport(file({ items: [dup, { ...dup, status: "skipped" }] }))).toThrow(/data\.items: "s\.a\/i" at \[0\] and \[1\]/);
  });
});

describe("rowKey / mergeSnapshots", () => {
  it("uses the table's primary key", () => {
    expect(rowKey("items", SNAPSHOT.items[0])).toBe("crypto.consensus/read-pos");
    expect(rowKey("skills", SNAPSHOT.skills[0])).toBe("crypto.consensus");
    expect(rowKey("recallCards", SNAPSHOT.recallCards[0])).toBe("crypto.consensus#q1");
    expect(rowKey("timeLogs", SNAPSHOT.timeLogs[0])).toBe(uuid(1));
  });

  it("upserts by key and keeps tables the file leaves out", () => {
    const merged = mergeSnapshots(SNAPSHOT, {
      items: [
        { ...SNAPSHOT.items[0], status: "skipped" },
        { skillId: "crypto.consensus", itemId: "new", status: "done", completedAt: "2026-09-23T00:00:00.000Z" },
      ],
    });
    expect(merged.items.map((r) => `${r.itemId}:${r.status}`)).toEqual(["read-pos:skipped", "watch-intro:skipped", "new:done"]);
    expect(merged.timeLogs).toEqual(SNAPSHOT.timeLogs);
  });
});

describe("planImport", () => {
  it("merge: counts inserted/updated/unchanged and writes only what changed", () => {
    const newLog = { ...SNAPSHOT.timeLogs[0], id: uuid(50), minutes: 15 };
    const plan = planImport(
      SNAPSHOT,
      {
        timeLogs: [SNAPSHOT.timeLogs[0], newLog],
        skills: [{ ...SNAPSHOT.skills[0], starred: true }],
      },
      "merge",
    );
    expect(plan.counts.timeLogs).toEqual({ inserted: 1, updated: 0, unchanged: 1, deleted: 0 });
    expect(plan.counts.skills).toEqual({ inserted: 0, updated: 1, unchanged: 0, deleted: 0 });
    expect(plan.counts.items).toEqual({ inserted: 0, updated: 0, unchanged: 0, deleted: 0 });
    expect(plan.writes.timeLogs).toEqual([newLog]);
    expect(plan.writes.items).toEqual([]);
    expect(plan.result.timeLogs).toHaveLength(2);
    expect(plan.result.skills[0].starred).toBe(true);
    expect(summarizeCounts(plan.counts)).toBe("skills ~1, timeLogs +1 =1");
  });

  it("merge treats key order and habitLogId-vs-contract rows consistently", () => {
    const stored = { ...SNAPSHOT.timeLogs[0], habitLogId: null };
    const reordered = Object.fromEntries(Object.entries(stored).reverse()) as typeof stored;
    const plan = planImport({ ...EMPTY_SNAPSHOT, timeLogs: [stored] }, { timeLogs: [reordered] }, "merge");
    expect(plan.counts.timeLogs.unchanged).toBe(1);
  });

  it("replace: needs every table and replaces everything", () => {
    expect(() => planImport(SNAPSHOT, { items: [] }, "replace")).toThrow(/missing: skills, habitLogs/);
    const plan = planImport(SNAPSHOT, { ...EMPTY_SNAPSHOT, items: [SNAPSHOT.items[0]] }, "replace");
    expect(plan.counts.items).toEqual({ inserted: 1, updated: 0, unchanged: 0, deleted: 2 });
    expect(plan.counts.timeLogs).toEqual({ inserted: 0, updated: 0, unchanged: 0, deleted: 1 });
    expect(plan.result).toEqual({ ...EMPTY_SNAPSHOT, items: [SNAPSHOT.items[0]] });
    expect(summarizeCounts(plan.counts)).toMatch(/^items \+1 -2, skills -1/);
  });

  it("refuses a result with two active quest runs", () => {
    const second = { ...SNAPSHOT.questRuns[0], id: uuid(60), questId: "quest-other" };
    expect(() => planImport(SNAPSHOT, { questRuns: [second] }, "merge")).toThrow(/2 active quest runs/);
    // Pausing the old run in the same file is fine.
    const both = [{ ...SNAPSHOT.questRuns[0], status: "paused" as const }, second];
    expect(planImport(SNAPSHOT, { questRuns: both }, "merge").counts.questRuns).toMatchObject({ inserted: 1, updated: 1 });
  });

  it("an empty merge is a no-op", () => {
    const plan = planImport(SNAPSHOT, {}, "merge");
    expect(summarizeCounts(plan.counts)).toBe("nothing to import");
    expect(plan.result).toEqual(SNAPSHOT);
  });
});
