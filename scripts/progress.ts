#!/usr/bin/env tsx
// Progress export/import from the command line (same format as /api/export).
//
//   pnpm progress export [file]            write every table (stdout when no file)
//   pnpm progress import <file>            merge: upsert the file's rows (partial files OK)
//   pnpm progress import <file> --replace  delete everything, then insert the file
//
// A --replace import first saves a backup export to the OS temp dir.

import { readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { importProgress } from "@/lib/db/mutations";
import { createServiceClient } from "@/lib/db/raw-client";
import { loadSnapshotWith } from "@/lib/db/snapshot";
import { localToday } from "@/lib/engine/dates";
import { buildExport, exportFileName, SNAPSHOT_TABLES, summarizeCounts } from "@/lib/progress/export";
import type { ProgressSnapshot } from "@/lib/progress/types";

const USAGE = "Usage: pnpm progress export [file] | pnpm progress import <file> [--replace]";

function rowTotals(snapshot: ProgressSnapshot): string {
  return SNAPSHOT_TABLES.map((t) => `${t} ${snapshot[t].length}`).join(", ");
}

async function exportCommand(file: string | undefined): Promise<void> {
  const snapshot = await loadSnapshotWith(createServiceClient());
  const json = `${JSON.stringify(buildExport(snapshot, new Date()), null, 2)}\n`;
  if (!file) {
    process.stdout.write(json);
    console.error(`Exported ${rowTotals(snapshot)}`);
    return;
  }
  await writeFile(file, json, "utf8");
  console.error(`Wrote ${file}: ${rowTotals(snapshot)}`);
}

async function importCommand(file: string, replace: boolean): Promise<void> {
  const client = createServiceClient();
  const json = await readFile(file, "utf8");
  if (replace) {
    const backup = path.join(tmpdir(), `backup-${Date.now()}-${exportFileName(localToday())}`);
    const snapshot = await loadSnapshotWith(client);
    await writeFile(backup, `${JSON.stringify(buildExport(snapshot, new Date()), null, 2)}\n`, "utf8");
    console.error(`Backup of the current data: ${backup}`);
  }
  const counts = await importProgress(client, { json, mode: replace ? "replace" : "merge" });
  console.error(`Imported ${file} (${replace ? "replace" : "merge"}): ${summarizeCounts(counts)}`);
  console.log(JSON.stringify(counts));
}

async function main(): Promise<void> {
  const [command, ...rest] = process.argv.slice(2);
  const flags = rest.filter((a) => a.startsWith("--"));
  const args = rest.filter((a) => !a.startsWith("--"));
  const badFlags = flags.filter((f) => !(command === "import" && f === "--replace"));
  if (badFlags.length > 0) throw new Error(`Unknown option(s): ${badFlags.join(" ")}\n${USAGE}`);

  if (command === "export" && args.length <= 1) return exportCommand(args[0]);
  if (command === "import" && args.length === 1) return importCommand(args[0], flags.includes("--replace"));
  throw new Error(USAGE);
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
