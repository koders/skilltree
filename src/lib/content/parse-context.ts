// Shared state for one parse: the file being read and the diagnostics sink.

import type { Diagnostic } from "@/lib/content/types";

export interface ParseContext {
  file: string;
  diagnostics: Diagnostic[];
}

export type DiagnosticRef = Pick<Diagnostic, "skillId" | "itemId" | "questId">;

export function createContext(file: string, diagnostics: Diagnostic[] = []): ParseContext {
  return { file, diagnostics };
}

/** Structural problems only; content rules belong to the validator. */
export function parseError(ctx: ParseContext, line: number, message: string, ref: DiagnosticRef = {}): void {
  const d: Diagnostic = { severity: "error", code: "parse", message, file: ctx.file, line };
  if (ref.skillId) d.skillId = ref.skillId;
  if (ref.questId) d.questId = ref.questId;
  if (ref.itemId) d.itemId = ref.itemId;
  ctx.diagnostics.push(d);
}
