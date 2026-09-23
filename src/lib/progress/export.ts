// Versioned JSON export/import of all progress (docs/decisions.md D7).
//
//   { "format": "skilltree-progress", "version": 1, "exportedAt": "…Z",
//     "data": { "items": [...], "skills": [...], …every ProgressSnapshot key } }
//
// The in-app export (/api/export, `pnpm progress export`) always writes every
// table. Import accepts two modes:
//
// - merge: upsert by primary key (id, or skillId+itemId / skillId /
//   skillId+questionId). Rows not in the file are kept. The file may be
//   PARTIAL: any table can be left out, and within a row, fields that have a
//   natural default may be omitted (ids are generated, createdAt defaults to
//   exportedAt or now, nullable fields default to null). This is how external
//   tools such as the Claude Code review skill append recall attempts, e.g.
//     { "format": "skilltree-progress", "version": 1,
//       "data": { "recallAttempts": [{ "skillId": "crypto.consensus",
//         "questionId": "q1", "mode": "review", "result": "pass",
//         "source": "claude-review" }] } }
//   Rows without an id (or attempts without a sessionId) get fresh ones on
//   every import, so include ids and sessionIds when a file may be imported
//   twice. Attempts without a sessionId share one generated session per
//   (skillId, mode) within the file.
// - replace: delete everything, then insert the file. Needs a complete file
//   (every table present, possibly empty).

import { z } from "zod";
import { isIsoDate } from "@/lib/engine/dates";
import type { ProgressSnapshot } from "@/lib/progress/types";

export const PROGRESS_EXPORT_FORMAT = "skilltree-progress";
export const PROGRESS_EXPORT_VERSION = 1;

export type SnapshotTable = keyof ProgressSnapshot;
type Row<K extends SnapshotTable> = ProgressSnapshot[K][number];

/** Every snapshot table, parents before children (habit logs before the time logs that reference them). */
export const SNAPSHOT_TABLES = [
  "items",
  "skills",
  "habitLogs",
  "timeLogs",
  "notes",
  "recallAttempts",
  "recallCards",
  "verifications",
  "questRuns",
] as const satisfies readonly SnapshotTable[];

export interface ProgressExport {
  format: typeof PROGRESS_EXPORT_FORMAT;
  version: typeof PROGRESS_EXPORT_VERSION;
  /** ISO timestamp (UTC). */
  exportedAt: string;
  data: ProgressSnapshot;
}

/** A parsed import file: like ProgressExport, but tables may be missing (merge only). */
export interface ProgressImportFile {
  format: typeof PROGRESS_EXPORT_FORMAT;
  version: typeof PROGRESS_EXPORT_VERSION;
  exportedAt: string | null;
  data: Partial<ProgressSnapshot>;
}

export type ImportMode = "replace" | "merge";

export interface TableImportCount {
  /** Rows in the file whose key wasn't in the database. */
  inserted: number;
  /** Rows in the file that replace a different existing row. */
  updated: number;
  /** Rows in the file identical to the existing row (not written). */
  unchanged: number;
  /** Existing rows removed (replace mode only). */
  deleted: number;
}

export type ImportCounts = Record<SnapshotTable, TableImportCount>;

export interface ImportPlan {
  mode: ImportMode;
  /** Rows to write per table: upserted in merge mode, inserted after deleting all in replace mode. */
  writes: { [K in SnapshotTable]: Row<K>[] };
  counts: ImportCounts;
  /** The snapshot the database should hold afterwards. */
  result: ProgressSnapshot;
}

// ---------------------------------------------------------------- export

function normalizeIso(value: Date | string): string {
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) throw new Error(`Invalid exportedAt "${String(value)}"`);
  return d.toISOString();
}

export function buildExport(snapshot: ProgressSnapshot, exportedAt: Date | string): ProgressExport {
  const data = {} as ProgressSnapshot;
  for (const table of SNAPSHOT_TABLES) assignTable(data, table, [...snapshot[table]]);
  return {
    format: PROGRESS_EXPORT_FORMAT,
    version: PROGRESS_EXPORT_VERSION,
    exportedAt: normalizeIso(exportedAt),
    data,
  };
}

/** `skilltree-progress-YYYY-MM-DD.json` for a local date. */
export function exportFileName(localDate: string): string {
  return `skilltree-progress-${localDate}.json`;
}

function assignTable<K extends SnapshotTable>(target: Partial<ProgressSnapshot>, table: K, rows: Row<K>[]): void {
  (target as Record<K, Row<K>[]>)[table] = rows;
}

// ---------------------------------------------------------------- parse

export interface ParseExportOptions {
  /** Default for missing createdAt/updatedAt when the file has no exportedAt. */
  now?: Date;
  /** Id generator for rows without an id (tests inject a deterministic one). */
  newId?: () => string;
}

const ISO_TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/;

const timestamp = z
  .string()
  .refine((s) => ISO_TIMESTAMP.test(s) && !Number.isNaN(Date.parse(s)), "expected an ISO timestamp")
  .transform((s) => new Date(s).toISOString());
const date = z.string().refine(isIsoDate, "expected a YYYY-MM-DD date");
const id = z.guid("expected a UUID");
const key = z.string().trim().min(1, "must not be empty");
const optText = z.string().nullable().default(null);
const optKey = key.nullable().default(null);

const activity = z.enum(["watch", "read", "do", "build", "output", "habit", "review", "other"]);

function rowSchemas(defaults: { newId: () => string; createdAt: string }) {
  const newId = id.default(defaults.newId);
  const createdAt = timestamp.default(defaults.createdAt);
  return {
    items: z.strictObject({
      skillId: key,
      itemId: key,
      status: z.enum(["done", "skipped"]),
      completedAt: createdAt,
    }),
    skills: z.strictObject({
      skillId: key,
      learnedVia: z.enum(["completed", "tested-out", "self-reported"]).nullable().default(null),
      learnedAt: timestamp.nullable().default(null),
      startedAt: timestamp.nullable().default(null),
      starred: z.boolean().default(false),
    }),
    habitLogs: z
      .strictObject({
        id: newId,
        habitKey: key,
        periodStart: date,
        doneOn: date,
        minutes: z.number().int().positive().nullable().default(null),
        note: optText,
        createdAt,
      })
      .refine((r) => r.periodStart <= r.doneOn, { message: "periodStart must not be after doneOn", path: ["periodStart"] }),
    timeLogs: z.strictObject({
      id: newId,
      skillId: optKey,
      itemId: optKey,
      questId: optKey,
      habitKey: optKey,
      habitLogId: id.nullable().default(null),
      activity,
      minutes: z.number().int().min(1).max(1440),
      loggedOn: date,
      note: optText,
      createdAt,
    }),
    notes: z
      .strictObject({
        id: newId,
        skillId: optKey,
        itemId: optKey,
        questId: optKey,
        kind: z.enum(["note", "output"]),
        title: optText,
        body: z.string().default(""),
        url: optText,
        createdAt,
        updatedAt: createdAt,
      })
      .refine((r) => r.skillId !== null || r.questId !== null, { message: "a note needs a skillId or a questId" }),
    recallAttempts: z.strictObject({
      id: newId,
      skillId: key,
      questionId: key,
      mode: z.enum(["test-out", "complete", "review"]),
      // Filled per (skillId, mode) after parsing when missing.
      sessionId: id.optional(),
      result: z.enum(["pass", "fail"]),
      answer: optText,
      source: key.default("import"),
      createdAt,
    }),
    recallCards: z.strictObject({
      skillId: key,
      questionId: key,
      box: z.number().int().min(1).default(1),
      dueOn: date,
      lastResult: z.enum(["pass", "fail"]).nullable().default(null),
      lastReviewedAt: timestamp.nullable().default(null),
    }),
    verifications: z.strictObject({
      id: newId,
      skillId: key,
      itemId: key,
      verifiedAt: createdAt,
      changed: z.boolean().default(false),
      note: optText,
    }),
    questRuns: z.strictObject({
      id: newId,
      questId: key,
      status: z.enum(["active", "paused", "completed", "abandoned"]),
      startedOn: date,
      hoursPerWeek: z.number().positive().nullable().default(null),
      forkedFrom: id.nullable().default(null),
      definition: z
        .unknown()
        .optional()
        .transform((v) => v ?? null),
      createdAt,
      updatedAt: createdAt,
    }),
  };
}

const envelopeSchema = z.object({
  format: z.string(),
  version: z.unknown(),
  exportedAt: z.unknown().optional(),
  data: z.record(z.string(), z.unknown()),
});

function formatPath(path: readonly PropertyKey[]): string {
  let out = "";
  for (const p of path) out += typeof p === "number" ? `[${p}]` : `${out ? "." : ""}${String(p)}`;
  return out || "(root)";
}

function describeIssues(error: z.ZodError, prefix: string): string {
  const shown = error.issues.slice(0, 8).map((i) => `  - ${prefix}${formatPath(i.path)}: ${i.message}`);
  const more = error.issues.length > shown.length ? [`  - …and ${error.issues.length - shown.length} more`] : [];
  return [...shown, ...more].join("\n");
}

function fail(message: string): never {
  throw new Error(`Invalid progress file: ${message}`);
}

/**
 * Parses and validates an export/import file. Throws an Error whose message
 * lists the offending paths, e.g. `data.timeLogs[3].minutes: Too big…`.
 */
export function parseExport(json: string, options: ParseExportOptions = {}): ProgressImportFile {
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch (err) {
    fail(`not valid JSON (${err instanceof Error ? err.message : String(err)})`);
  }

  const envelope = envelopeSchema.safeParse(raw);
  if (!envelope.success) fail(`expected { format, version, data }:\n${describeIssues(envelope.error, "")}`);
  const { format, version, data } = envelope.data;
  if (format !== PROGRESS_EXPORT_FORMAT) fail(`format is "${format}", expected "${PROGRESS_EXPORT_FORMAT}"`);
  if (version !== PROGRESS_EXPORT_VERSION) {
    fail(`version ${JSON.stringify(version)} is not supported (this app reads version ${PROGRESS_EXPORT_VERSION})`);
  }

  let exportedAt: string | null = null;
  if (envelope.data.exportedAt !== undefined && envelope.data.exportedAt !== null) {
    const parsed = timestamp.safeParse(envelope.data.exportedAt);
    if (!parsed.success) fail("exportedAt: expected an ISO timestamp");
    exportedAt = parsed.data;
  }

  const unknownTables = Object.keys(data).filter((k) => !(SNAPSHOT_TABLES as readonly string[]).includes(k));
  if (unknownTables.length > 0) {
    fail(`unknown table(s) in data: ${unknownTables.join(", ")} (known: ${SNAPSHOT_TABLES.join(", ")})`);
  }

  const newId = options.newId ?? (() => crypto.randomUUID());
  const createdAt = exportedAt ?? (options.now ?? new Date()).toISOString();
  const schemas = rowSchemas({ newId, createdAt });

  const out: Partial<ProgressSnapshot> = {};
  const errors: string[] = [];
  for (const table of SNAPSHOT_TABLES) {
    if (!(table in data)) continue;
    const parsed = z.array(schemas[table]).safeParse(data[table]);
    if (!parsed.success) {
      errors.push(describeIssues(parsed.error, `data.${table}`));
      continue;
    }
    if (table === "recallAttempts") {
      assignTable(out, table, fillSessionIds(parsed.data as RecallAttemptInput[], newId));
    } else {
      assignTable(out, table, parsed.data as Row<typeof table>[]);
    }
  }
  if (errors.length > 0) fail(`\n${errors.join("\n")}`);

  const duplicates = findDuplicateKeys(out);
  if (duplicates.length > 0) fail(`duplicate keys:\n${duplicates.map((d) => `  - ${d}`).join("\n")}`);

  return { format: PROGRESS_EXPORT_FORMAT, version: PROGRESS_EXPORT_VERSION, exportedAt, data: out };
}

type RecallAttemptInput = Omit<Row<"recallAttempts">, "sessionId"> & { sessionId?: string };

function fillSessionIds(rows: RecallAttemptInput[], newId: () => string): Row<"recallAttempts">[] {
  const sessions = new Map<string, string>();
  return rows.map((r) => {
    if (r.sessionId) return { ...r, sessionId: r.sessionId };
    const group = `${r.skillId}\u0000${r.mode}`;
    let sessionId = sessions.get(group);
    if (!sessionId) {
      sessionId = newId();
      sessions.set(group, sessionId);
    }
    return { ...r, sessionId };
  });
}

// ---------------------------------------------------------------- keys & merge

/** Primary key of a row, as one string. */
export function rowKey<K extends SnapshotTable>(table: K, row: Row<K>): string {
  switch (table) {
    case "items": {
      const r = row as Row<"items">;
      return `${r.skillId}/${r.itemId}`;
    }
    case "skills":
      return (row as Row<"skills">).skillId;
    case "recallCards": {
      const r = row as Row<"recallCards">;
      return `${r.skillId}#${r.questionId}`;
    }
    default:
      return (row as { id: string }).id;
  }
}

function findDuplicateKeys(data: Partial<ProgressSnapshot>): string[] {
  const out: string[] = [];
  for (const table of SNAPSHOT_TABLES) {
    const rows = data[table];
    if (!rows) continue;
    const seen = new Map<string, number>();
    rows.forEach((row: Row<typeof table>, i: number) => {
      const k = rowKey(table, row);
      const first = seen.get(k);
      if (first === undefined) seen.set(k, i);
      else out.push(`data.${table}: "${k}" at [${first}] and [${i}]`);
    });
  }
  return out;
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value !== null && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      // A missing field and null are the same row: every optional field defaults to null.
      .filter(([, v]) => v !== undefined && v !== null)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${stableJson(v)}`).join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}

/** Deep equality for progress rows, ignoring key order and treating missing fields as null. */
export function sameRow(a: unknown, b: unknown): boolean {
  return stableJson(a) === stableJson(b);
}

function emptyCounts(): ImportCounts {
  const counts = {} as ImportCounts;
  for (const table of SNAPSHOT_TABLES) counts[table] = { inserted: 0, updated: 0, unchanged: 0, deleted: 0 };
  return counts;
}

/** Upserts `incoming` rows into `base` by primary key; tables missing from `incoming` are kept as-is. */
export function mergeSnapshots(base: ProgressSnapshot, incoming: Partial<ProgressSnapshot>): ProgressSnapshot {
  const result = {} as ProgressSnapshot;
  for (const table of SNAPSHOT_TABLES) assignTable(result, table, mergeTable(table, base[table], incoming[table]));
  return result;
}

function mergeTable<K extends SnapshotTable>(table: K, base: readonly Row<K>[], incoming: readonly Row<K>[] | undefined): Row<K>[] {
  if (!incoming || incoming.length === 0) return [...base];
  const byKey = new Map<string, Row<K>>();
  for (const row of base) byKey.set(rowKey(table, row), row);
  for (const row of incoming) byKey.set(rowKey(table, row), row);
  return [...byKey.values()];
}

/**
 * Works out what an import will do, without touching the database.
 * Throws when replace gets a partial file or the result would break a
 * database invariant (more than one active quest run).
 */
export function planImport(current: ProgressSnapshot, incoming: Partial<ProgressSnapshot>, mode: ImportMode): ImportPlan {
  const counts = emptyCounts();
  const writes = {} as ImportPlan["writes"];

  if (mode === "replace") {
    const missing = SNAPSHOT_TABLES.filter((t) => !incoming[t]);
    if (missing.length > 0) {
      throw new Error(`Replace needs a complete export; the file is missing: ${missing.join(", ")}. Use merge for partial files.`);
    }
    const result = {} as ProgressSnapshot;
    for (const table of SNAPSHOT_TABLES) {
      const rows = [...(incoming[table] ?? [])];
      assignTable(result, table, rows);
      assignTable(writes, table, rows);
      counts[table] = { inserted: rows.length, updated: 0, unchanged: 0, deleted: current[table].length };
    }
    assertOneActiveRun(result);
    return { mode, writes, counts, result };
  }

  for (const table of SNAPSHOT_TABLES) assignTable(writes, table, planMergeTable(table, current[table], incoming[table], counts[table]));
  const result = mergeSnapshots(current, incoming);
  assertOneActiveRun(result);
  return { mode, writes, counts, result };
}

function planMergeTable<K extends SnapshotTable>(
  table: K,
  current: readonly Row<K>[],
  incoming: readonly Row<K>[] | undefined,
  count: TableImportCount,
): Row<K>[] {
  const existing = new Map<string, Row<K>>();
  for (const row of current) existing.set(rowKey(table, row), row);
  const writes: Row<K>[] = [];
  for (const row of incoming ?? []) {
    const before = existing.get(rowKey(table, row));
    if (!before) {
      count.inserted++;
      writes.push(row);
    } else if (sameRow(before, row)) {
      count.unchanged++;
    } else {
      count.updated++;
      writes.push(row);
    }
  }
  return writes;
}

function assertOneActiveRun(snapshot: ProgressSnapshot): void {
  const active = snapshot.questRuns.filter((r) => r.status === "active");
  if (active.length > 1) {
    throw new Error(
      `Import would leave ${active.length} active quest runs (${active.map((r) => `${r.questId} ${r.id}`).join(", ")}); at most one may be active.`,
    );
  }
}

/** One-line summary of import counts, e.g. "items +3 ~1, timeLogs +10". */
export function summarizeCounts(counts: ImportCounts): string {
  const parts = SNAPSHOT_TABLES.flatMap((t) => {
    const c = counts[t];
    const bits = [
      c.inserted ? `+${c.inserted}` : "",
      c.updated ? `~${c.updated}` : "",
      c.deleted ? `-${c.deleted}` : "",
      c.unchanged ? `=${c.unchanged}` : "",
    ].filter(Boolean);
    return bits.length > 0 ? [`${t} ${bits.join(" ")}`] : [];
  });
  return parts.length > 0 ? parts.join(", ") : "nothing to import";
}
