#!/usr/bin/env tsx
// Applies supabase/migrations/*.sql to SUPABASE_DB_URL (docs/decisions.md D8).
//
//   pnpm db:migrate            apply pending migrations, each in its own transaction
//   pnpm db:migrate --status   list applied/pending migrations and RLS per public table
//
// Applied versions are recorded in supabase_migrations.schema_migrations, the
// table the Supabase CLI uses, so `supabase db push` can take over later.

import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { Client } from "pg";

const MIGRATIONS_DIR = path.join(process.cwd(), "supabase", "migrations");
const FILE_PATTERN = /^(\d+)_([\w.-]+)\.sql$/;
const LOCK_KEY = "skilltree:migrate";

interface MigrationFile {
  version: string;
  name: string;
  file: string;
}

async function listMigrationFiles(): Promise<MigrationFile[]> {
  const entries = await readdir(MIGRATIONS_DIR);
  const files: MigrationFile[] = [];
  for (const file of entries.filter((f) => f.endsWith(".sql"))) {
    const match = FILE_PATTERN.exec(file);
    if (!match) throw new Error(`Bad migration file name "${file}": expected <timestamp>_<name>.sql`);
    files.push({ version: match[1], name: match[2], file });
  }
  files.sort((a, b) => a.version.localeCompare(b.version));
  const seen = new Set<string>();
  for (const f of files) {
    if (seen.has(f.version)) throw new Error(`Duplicate migration version ${f.version}`);
    seen.add(f.version);
  }
  return files;
}

function connectionString(): string {
  const raw = process.env.SUPABASE_DB_URL;
  if (!raw) {
    throw new Error("SUPABASE_DB_URL is not set. Add it to .env.local (Supabase → Connect → Session pooler).");
  }
  // pg lets sslmode in the URL override the `ssl` option below, and newer
  // pg-connection-string treats `require` as verify-full, which rejects
  // Supabase's pooler certificate. The explicit `ssl` option is the one we want.
  const url = new URL(raw);
  url.searchParams.delete("sslmode");
  return url.toString();
}

async function tableExists(client: Client, qualified: string): Promise<boolean> {
  const res = await client.query<{ exists: boolean }>("select to_regclass($1) is not null as exists", [qualified]);
  return res.rows[0]?.exists ?? false;
}

async function appliedVersions(client: Client): Promise<Set<string>> {
  if (!(await tableExists(client, "supabase_migrations.schema_migrations"))) return new Set();
  const res = await client.query<{ version: string }>("select version from supabase_migrations.schema_migrations");
  return new Set(res.rows.map((r) => r.version));
}

async function ensureMigrationsTable(client: Client): Promise<void> {
  await client.query(`
    create schema if not exists supabase_migrations;
    create table if not exists supabase_migrations.schema_migrations (
      version text primary key,
      statements text[],
      name text
    );
  `);
}

async function printRls(client: Client): Promise<void> {
  const res = await client.query<{ table: string; rls: boolean; policies: string }>(`
    select c.relname as table,
           c.relrowsecurity as rls,
           (select count(*) from pg_policies p where p.schemaname = 'public' and p.tablename = c.relname)::text as policies
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r'
    order by c.relname
  `);
  if (res.rows.length === 0) {
    console.log("public tables: none");
    return;
  }
  console.log("public tables:");
  for (const r of res.rows) {
    console.log(`  ${r.table.padEnd(18)} rls=${r.rls ? "on " : "OFF"} policies=${r.policies}`);
  }
}

async function status(client: Client, files: MigrationFile[]): Promise<void> {
  const applied = await appliedVersions(client);
  for (const f of files) {
    console.log(`${applied.has(f.version) ? "applied" : "pending"}  ${f.version}_${f.name}`);
  }
  const known = new Set(files.map((f) => f.version));
  for (const v of [...applied].filter((v) => !known.has(v)).sort()) {
    console.log(`applied  ${v} (no local file)`);
  }
  await printRls(client);
}

async function migrate(client: Client, files: MigrationFile[]): Promise<void> {
  await ensureMigrationsTable(client);
  const applied = await appliedVersions(client);
  const pending = files.filter((f) => !applied.has(f.version));
  if (pending.length === 0) {
    console.log(`Up to date (${files.length} migration${files.length === 1 ? "" : "s"} applied).`);
    return;
  }
  for (const f of pending) {
    const sql = await readFile(path.join(MIGRATIONS_DIR, f.file), "utf8");
    const started = Date.now();
    await client.query("begin");
    try {
      await client.query(sql);
      // The CLI stores the file split into statements; splitting SQL safely
      // (dollar-quoted bodies) isn't worth it here, so the file is one element.
      await client.query(
        "insert into supabase_migrations.schema_migrations (version, name, statements) values ($1, $2, $3)",
        [f.version, f.name, [sql]],
      );
      await client.query("commit");
    } catch (err) {
      await client.query("rollback");
      throw new Error(`Migration ${f.file} failed and was rolled back: ${err instanceof Error ? err.message : String(err)}`);
    }
    console.log(`applied  ${f.version}_${f.name}  (${Date.now() - started} ms)`);
  }
  console.log(`Done: ${pending.length} migration${pending.length === 1 ? "" : "s"} applied.`);
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const unknown = args.filter((a) => a !== "--status");
  if (unknown.length > 0) throw new Error(`Unknown argument(s): ${unknown.join(" ")}. Usage: pnpm db:migrate [--status]`);

  const files = await listMigrationFiles();
  const client = new Client({ connectionString: connectionString(), ssl: { rejectUnauthorized: false } });
  await client.connect();
  try {
    if (args.includes("--status")) {
      await status(client, files);
      return;
    }
    // Session-level lock: two concurrent runs must not apply the same file twice.
    await client.query("select pg_advisory_lock(hashtext($1))", [LOCK_KEY]);
    try {
      await migrate(client, files);
    } finally {
      await client.query("select pg_advisory_unlock(hashtext($1))", [LOCK_KEY]);
    }
  } finally {
    await client.end();
  }
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
