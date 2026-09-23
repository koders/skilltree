// What the Data page's import panel knows about pasted JSON before sending it.
// Kept free of runtime imports beyond config so the client bundle stays small.

import { IMPORT_MAX_CHARS } from "@/lib/config";
import type { SnapshotTable } from "@/lib/progress/export";
import { TABLE_ORDER } from "./tables";

export interface ImportPreview {
  error: string | null;
  /** Rows per table present in `data`. */
  tables: [SnapshotTable, number][];
  /** The file re-serialized without whitespace (what gets sent), or null when it can't be sent. */
  payload: string | null;
}

function megabytes(chars: number): string {
  return `${(chars / 1_000_000).toFixed(chars < 10_000_000 ? 1 : 0)} MB`;
}

/** A quick look at pasted JSON: parse errors, rows per table and the compact payload. Null when empty. */
export function previewImport(json: string): ImportPreview | null {
  if (!json.trim()) return null;
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Not valid JSON", tables: [], payload: null };
  }
  const data = (raw as { data?: unknown } | null)?.data;
  if (!data || typeof data !== "object") return { error: "Expected { format, version, data: { … } }", tables: [], payload: null };
  const tables = TABLE_ORDER.flatMap((t): [SnapshotTable, number][] => {
    const rows = (data as Record<string, unknown>)[t];
    return Array.isArray(rows) ? [[t, rows.length]] : [];
  });
  // Pretty-printed exports shrink a lot without their indentation.
  const payload = JSON.stringify(raw);
  if (payload.length > IMPORT_MAX_CHARS) {
    return {
      error: `This file is ${megabytes(payload.length)}; the Data page imports up to ${megabytes(IMPORT_MAX_CHARS)}. Use \`pnpm progress:import <file>\` instead.`,
      tables,
      payload: null,
    };
  }
  return { error: null, tables, payload };
}
