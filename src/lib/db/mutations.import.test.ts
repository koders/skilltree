// importProgress against an in-memory stand-in for the few PostgREST calls it
// makes. Replace mode can't be exercised against the real database (it wipes
// it), so its delete → insert → restore-on-failure path is covered here.

import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import { importProgress } from "@/lib/db/mutations";
import { rowsToDb, SNAPSHOT_KEYS, TABLES } from "@/lib/db/rows";
import { buildExport, PROGRESS_EXPORT_FORMAT } from "@/lib/progress/export";
import { EMPTY_SNAPSHOT, type ProgressSnapshot } from "@/lib/progress/types";

type Row = Record<string, unknown>;
type Result = { data: Row[] | null; error: { message: string } | null };

class FakeDb {
  tables = new Map<string, Row[]>();
  /** Table whose next insert fails once. */
  failNextInsertInto: string | null = null;

  constructor() {
    for (const key of SNAPSHOT_KEYS) this.tables.set(TABLES[key].table, []);
  }

  from(table: string): FakeQuery {
    return new FakeQuery(this, table);
  }

  load(snapshot: ProgressSnapshot): void {
    for (const key of SNAPSHOT_KEYS) this.tables.set(TABLES[key].table, rowsToDb(key, snapshot[key]) as Row[]);
  }

  rows(table: string): Row[] {
    return this.tables.get(table) ?? [];
  }
}

class FakeQuery implements PromiseLike<Result> {
  private op: "select" | "delete" | "insert" | "upsert" = "select";
  private payload: Row[] = [];
  private conflict: string[] = [];
  private window: [number, number] = [0, Number.POSITIVE_INFINITY];

  constructor(
    private db: FakeDb,
    private table: string,
  ) {}

  select(): this {
    return this;
  }
  order(): this {
    return this;
  }
  not(): this {
    return this;
  }
  range(from: number, to: number): this {
    this.window = [from, to];
    return this;
  }
  delete(): this {
    this.op = "delete";
    return this;
  }
  insert(rows: Row | Row[]): this {
    this.op = "insert";
    this.payload = Array.isArray(rows) ? rows : [rows];
    return this;
  }
  upsert(rows: Row | Row[], options: { onConflict: string }): this {
    this.op = "upsert";
    this.payload = Array.isArray(rows) ? rows : [rows];
    this.conflict = options.onConflict.split(",");
    return this;
  }

  then<A = Result, B = never>(
    onFulfilled?: ((value: Result) => A | PromiseLike<A>) | null,
    onRejected?: ((reason: unknown) => B | PromiseLike<B>) | null,
  ): PromiseLike<A | B> {
    return Promise.resolve(this.run()).then(onFulfilled, onRejected);
  }

  private run(): Result {
    const rows = this.db.rows(this.table);
    switch (this.op) {
      case "select":
        return { data: rows.slice(this.window[0], this.window[1] + 1), error: null };
      case "delete":
        this.db.tables.set(this.table, []);
        return { data: null, error: null };
      case "insert":
        if (this.db.failNextInsertInto === this.table) {
          this.db.failNextInsertInto = null;
          return { data: null, error: { message: "simulated failure" } };
        }
        this.db.tables.set(this.table, [...rows, ...this.payload]);
        return { data: null, error: null };
      case "upsert": {
        const key = (r: Row) => this.conflict.map((c) => String(r[c])).join("|");
        const byKey = new Map(rows.map((r) => [key(r), r]));
        for (const r of this.payload) byKey.set(key(r), { ...byKey.get(key(r)), ...r });
        this.db.tables.set(this.table, [...byKey.values()]);
        return { data: null, error: null };
      }
    }
  }
}

const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

const BEFORE: ProgressSnapshot = {
  ...EMPTY_SNAPSHOT,
  items: [{ skillId: "s.a", itemId: "one", status: "done", completedAt: "2026-09-20T08:00:00.000Z" }],
  habitLogs: [
    { id: uuid(1), habitKey: "q/h", periodStart: "2026-09-14", doneOn: "2026-09-15", minutes: 30, note: null, createdAt: "2026-09-15T08:00:00.000Z" },
  ],
};

const AFTER: ProgressSnapshot = {
  ...EMPTY_SNAPSHOT,
  items: [{ skillId: "s.b", itemId: "two", status: "skipped", completedAt: "2026-09-22T08:00:00.000Z" }],
  timeLogs: [
    {
      id: uuid(2),
      skillId: "s.b",
      itemId: "two",
      questId: null,
      habitKey: null,
      activity: "do",
      minutes: 50,
      loggedOn: "2026-09-22",
      note: null,
      createdAt: "2026-09-22T08:00:00.000Z",
    },
  ],
};

function setup(): { fake: FakeDb; client: SupabaseClient } {
  const fake = new FakeDb();
  fake.load(BEFORE);
  return { fake, client: fake as unknown as SupabaseClient };
}

const fullFile = (s: ProgressSnapshot) => JSON.stringify(buildExport(s, "2026-09-23T12:00:00Z"));

describe("importProgress", () => {
  it("replace: swaps the whole database for the file", async () => {
    const { fake, client } = setup();
    const counts = await importProgress(client, { json: fullFile(AFTER), mode: "replace" });
    expect(counts.items).toEqual({ inserted: 1, updated: 0, unchanged: 0, deleted: 1 });
    expect(counts.habitLogs).toMatchObject({ inserted: 0, deleted: 1 });
    expect(fake.rows("item_progress")).toEqual(rowsToDb("items", AFTER.items));
    expect(fake.rows("habit_logs")).toEqual([]);
    expect(fake.rows("time_logs")).toMatchObject([{ id: uuid(2), habit_log_id: null }]);
  });

  it("replace: restores the previous rows when an insert fails", async () => {
    const { fake, client } = setup();
    fake.failNextInsertInto = "time_logs";
    await expect(importProgress(client, { json: fullFile(AFTER), mode: "replace" })).rejects.toThrow(
      /previous data was restored.*Writing time_logs: simulated failure/,
    );
    expect(fake.rows("item_progress")).toEqual(rowsToDb("items", BEFORE.items));
    expect(fake.rows("habit_logs")).toEqual(rowsToDb("habitLogs", BEFORE.habitLogs));
    expect(fake.rows("time_logs")).toEqual([]);
  });

  it("replace: refuses a partial file without touching anything", async () => {
    const { fake, client } = setup();
    const partial = JSON.stringify({ format: PROGRESS_EXPORT_FORMAT, version: 1, data: { items: [] } });
    await expect(importProgress(client, { json: partial, mode: "replace" })).rejects.toThrow(/complete export/);
    expect(fake.rows("item_progress")).toHaveLength(1);
  });

  it("merge: upserts the file's rows and keeps the rest", async () => {
    const { fake, client } = setup();
    const file = JSON.stringify({
      format: PROGRESS_EXPORT_FORMAT,
      version: 1,
      data: {
        items: [
          { skillId: "s.a", itemId: "one", status: "skipped", completedAt: "2026-09-20T08:00:00.000Z" },
          { skillId: "s.a", itemId: "new", status: "done", completedAt: "2026-09-21T08:00:00.000Z" },
        ],
      },
    });
    const counts = await importProgress(client, { json: file, mode: "merge" });
    expect(counts.items).toEqual({ inserted: 1, updated: 1, unchanged: 0, deleted: 0 });
    expect(fake.rows("item_progress").map((r) => `${String(r.item_id)}:${String(r.status)}`).sort()).toEqual(["new:done", "one:skipped"]);
    expect(fake.rows("habit_logs")).toHaveLength(1);
  });

  it("rejects an invalid file before reading the database", async () => {
    const { client } = setup();
    await expect(importProgress(client, { json: "{}", mode: "merge" })).rejects.toThrow(/Invalid progress file/);
  });
});
