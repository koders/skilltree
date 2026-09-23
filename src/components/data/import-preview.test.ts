import { describe, expect, it } from "vitest";
import nextConfig from "../../../next.config";
import { previewImport } from "@/components/data/import-preview";
import { IMPORT_MAX_CHARS } from "@/lib/config";
import { importProgressSchema } from "@/lib/db/mutations";

/** Bytes for a Next size limit: a number, or "32mb"-style text. */
function toBytes(limit: number | string | undefined): number {
  if (typeof limit === "number") return limit;
  const m = /^(\d+(?:\.\d+)?)\s*(b|kb|mb|gb)$/i.exec(limit ?? "");
  if (!m) throw new Error(`unrecognised size limit ${String(limit)}`);
  const unit = { b: 1, kb: 1024, mb: 1024 ** 2, gb: 1024 ** 3 }[m[2].toLowerCase() as "b" | "kb" | "mb" | "gb"];
  return Number(m[1]) * unit;
}

describe("import size limits", () => {
  it("lets a file at the schema's cap through the Server Action body limit", () => {
    const actionLimit = toBytes(nextConfig.experimental?.serverActions?.bodySizeLimit);
    // The file travels as an escaped JSON string inside the action body, and
    // non-ASCII text takes 2–3 UTF-8 bytes per char: leave room for both.
    expect(actionLimit).toBeGreaterThanOrEqual(IMPORT_MAX_CHARS * 2);
    // src/proxy.ts buffers request bodies; past this size it silently truncates them.
    expect(toBytes(nextConfig.experimental?.proxyClientMaxBodySize)).toBeGreaterThanOrEqual(actionLimit);
  });

  it("uses the same cap in the import schema", () => {
    expect(importProgressSchema.safeParse({ json: "x".repeat(IMPORT_MAX_CHARS), mode: "merge" }).success).toBe(true);
    expect(importProgressSchema.safeParse({ json: "x".repeat(IMPORT_MAX_CHARS + 1), mode: "merge" }).success).toBe(false);
  });
});

describe("previewImport", () => {
  const file = { format: "skilltree-progress", version: 1, data: { items: [{ skillId: "s.a" }], timeLogs: [] } };

  it("is null for an empty field", () => {
    expect(previewImport("  \n")).toBeNull();
  });

  it("counts rows per table and sends the file compacted", () => {
    const pretty = JSON.stringify(file, null, 2);
    const look = previewImport(pretty);
    expect(look).toEqual({ error: null, tables: [["items", 1], ["timeLogs", 0]], payload: JSON.stringify(file) });
    expect(look!.payload!.length).toBeLessThan(pretty.length);
  });

  it("reports invalid JSON and a missing data object", () => {
    expect(previewImport("{ nope")).toMatchObject({ payload: null, tables: [] });
    expect(previewImport("{ nope")!.error).toBeTruthy();
    expect(previewImport('{"format":"x"}')).toMatchObject({ error: expect.stringMatching(/data/), payload: null });
  });

  it("refuses a file over the import cap before sending it, pointing at the CLI", () => {
    const big = JSON.stringify({ ...file, data: { notes: [{ body: "x".repeat(IMPORT_MAX_CHARS) }] } });
    const look = previewImport(big);
    expect(look).toMatchObject({ payload: null, error: expect.stringMatching(/pnpm progress:import/) });
  });
});
