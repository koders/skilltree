// Human-readable validator output, eslint-style: diagnostics grouped by file,
// one aligned row each, then a one-line summary.

import type { Diagnostic } from "@/lib/content/types";
import { summarize, type ValidationSummary } from "@/lib/content/validate";

export interface FormatOptions {
  /** ANSI colours (for a TTY). */
  color?: boolean;
  /** Show errors only; the summary still counts warnings. */
  quiet?: boolean;
}

interface Palette {
  file(s: string): string;
  dim(s: string): string;
  error(s: string): string;
  warn(s: string): string;
  ok(s: string): string;
}

const PLAIN: Palette = { file: id, dim: id, error: id, warn: id, ok: id };
const ANSI: Palette = {
  file: (s) => `\x1b[1m\x1b[4m${s}\x1b[0m`,
  dim: (s) => `\x1b[2m${s}\x1b[0m`,
  error: (s) => `\x1b[31m${s}\x1b[0m`,
  warn: (s) => `\x1b[33m${s}\x1b[0m`,
  ok: (s) => `\x1b[32m${s}\x1b[0m`,
};

const NO_FILE = "(no file)";

export function formatDiagnostics(diags: readonly Diagnostic[], opts: FormatOptions = {}): string {
  const paint = opts.color ? ANSI : PLAIN;
  const shown = opts.quiet ? diags.filter((d) => d.severity === "error") : diags;
  const lines: string[] = [];
  for (const [file, group] of groupByFile(shown)) {
    lines.push(paint.file(file));
    const lineWidth = Math.max(...group.map((d) => lineLabel(d).length));
    const codeWidth = Math.max(...group.map((d) => d.code.length));
    for (const d of group) {
      const severity = d.severity === "error" ? paint.error("error") : paint.warn("warn ");
      const line = paint.dim(lineLabel(d).padStart(lineWidth));
      const code = paint.dim(d.code.padEnd(codeWidth));
      lines.push(`  ${line}  ${severity}  ${code}  ${d.message}`);
    }
    lines.push("");
  }
  lines.push(formatSummary(summarize(diags), opts));
  return lines.join("\n");
}

/** "✖ 2 errors, 5 warnings (14 @search@ links to resolve)" or "✔ No errors, …". */
export function formatSummary(summary: ValidationSummary, opts: Pick<FormatOptions, "color"> = {}): string {
  const paint = opts.color ? ANSI : PLAIN;
  const warnings = summary.warnings === 0 ? "no warnings" : plural(summary.warnings, "warning");
  const search = summary.searchLinks > 0 ? ` (${plural(summary.searchLinks, "@search@ link")} to resolve)` : "";
  return summary.errors > 0
    ? paint.error(`✖ ${plural(summary.errors, "error")}, ${warnings}${search}`)
    : paint.ok(`✔ No errors, ${warnings}${search}`);
}

/** Groups in order of first appearance (validate() output is already sorted by file). */
function groupByFile(diags: readonly Diagnostic[]): Map<string, Diagnostic[]> {
  const groups = new Map<string, Diagnostic[]>();
  for (const d of diags) {
    const key = d.file ?? NO_FILE;
    const group = groups.get(key);
    if (group === undefined) groups.set(key, [d]);
    else group.push(d);
  }
  return groups;
}

function lineLabel(d: Diagnostic): string {
  return d.line === undefined ? "-" : String(d.line);
}

function plural(n: number, noun: string): string {
  return `${n} ${noun}${n === 1 ? "" : "s"}`;
}

function id(s: string): string {
  return s;
}
