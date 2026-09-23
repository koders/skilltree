import { connection } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { rowsFromDb, SNAPSHOT_KEYS, TABLES, type SnapshotKey } from "@/lib/db/rows";
import type { ProgressSnapshot } from "@/lib/progress/types";

/**
 * All progress rows, for the current request. `connection()` opts the caller
 * out of prerendering: every page depends on live progress (decisions D2).
 */
export async function loadSnapshot(): Promise<ProgressSnapshot> {
  await connection();
  // client.ts is guarded by "server-only", which throws outside Next's server
  // bundles; importing it lazily keeps this module usable from tsx scripts.
  const { db } = await import("@/lib/db/client");
  return loadSnapshotWith(db());
}

/** Loads every progress table in parallel with the given client (scripts use this directly). */
export async function loadSnapshotWith(client: SupabaseClient): Promise<ProgressSnapshot> {
  const tables = await Promise.all(SNAPSHOT_KEYS.map((key) => loadTable(client, key)));
  const snapshot = {} as Record<SnapshotKey, unknown[]>;
  SNAPSHOT_KEYS.forEach((key, i) => {
    snapshot[key] = tables[i];
  });
  return snapshot as unknown as ProgressSnapshot;
}

// Supabase caps a response at 1000 rows by default (db-max-rows); page past it.
const PAGE_SIZE = 1000;

async function loadTable<K extends SnapshotKey>(client: SupabaseClient, key: K): Promise<ProgressSnapshot[K]> {
  const { table, primaryKey } = TABLES[key];
  const raw: unknown[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    let query = client.from(table).select("*");
    for (const column of primaryKey) query = query.order(column, { ascending: true });
    const { data, error } = await query.range(from, from + PAGE_SIZE - 1);
    if (error) {
      throw new Error(
        `Loading progress failed: ${table}: ${error.message}${error.hint ? ` (${error.hint})` : ""}. ` +
          "Check SUPABASE_PROJECT_URL / SUPABASE_SECRET_KEY and that `pnpm db:migrate` has run.",
      );
    }
    const page: unknown[] = Array.isArray(data) ? data : [];
    raw.push(...page);
    if (page.length < PAGE_SIZE) break;
  }
  return rowsFromDb(key, raw) as ProgressSnapshot[K];
}
