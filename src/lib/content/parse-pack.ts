// Packs (spec §7.3): YAML frontmatter plus the non-skill markdown of one
// authoring session. The body is kept verbatim.

import YAML from "yaml";
import {
  type SourceLine,
  bulletOf,
  headingOf,
  isBlank,
  isThematicBreak,
  joinLines,
  splitFrontmatter,
  toLines,
  trimBlankLines,
} from "@/lib/content/markdown";
import { type ParseContext, parseError } from "@/lib/content/parse-context";
import { headingAsOf, parseSourceBullet } from "@/lib/content/parse-skill";
import { isIsoDate } from "@/lib/engine/dates";
import type { Pack, Source } from "@/lib/content/types";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function dateString(value: unknown): string | null {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString().slice(0, 10);
  if (typeof value === "string") return value.trim();
  if (typeof value === "number") return String(value);
  return null;
}

export interface Frontmatter {
  data: Record<string, unknown>;
  body: SourceLine[];
  /** Line of a top-level key (`facts_as_of: …`), else of the opening `---` (1 without frontmatter). */
  lineOf: (key: string) => number;
}

export function readFrontmatter(lines: SourceLine[], ctx: ParseContext): Frontmatter {
  const split = splitFrontmatter(lines);
  const yamlLines = split.yaml === null ? [] : lines.slice(1, 1 + split.yaml.split("\n").length);
  const lineOf = (key: string) =>
    yamlLines.find((l) => new RegExp(`^${key}\\s*:`).test(l.text))?.line ?? Math.max(1, split.yamlLine);
  const empty = (body: SourceLine[]): Frontmatter => ({ data: {}, body, lineOf });
  if (split.unterminated) {
    parseError(ctx, split.yamlLine, "Frontmatter opened with --- but never closed.");
    return empty(lines);
  }
  if (split.yaml === null) return empty(split.body);
  try {
    const data: unknown = YAML.parse(split.yaml);
    if (data === null || data === undefined) return empty(split.body);
    if (!isRecord(data)) {
      parseError(ctx, split.yamlLine, "Frontmatter must be a YAML mapping (key: value lines).");
      return empty(split.body);
    }
    return { data, body: split.body, lineOf };
  } catch (err) {
    const message = err instanceof Error ? err.message.split("\n")[0] : String(err);
    parseError(ctx, split.yamlLine, `Invalid YAML frontmatter: ${message}`);
    return empty(split.body);
  }
}

/** File name without directories and `.skilltree.md` / `.md`. */
export function baseId(file: string): string {
  const name = file.split(/[\\/]/).pop() ?? file;
  return name.replace(/\.skilltree\.md$/i, "").replace(/\.md$/i, "");
}

export function packFactsAsOf(data: Record<string, unknown>): string | null {
  return dateString(data.facts_as_of);
}

export function buildPack(
  data: Record<string, unknown>,
  body: string,
  file: string,
  ctx: ParseContext,
  factsLine: number,
): Pack {
  const factsAsOf = packFactsAsOf(data);
  if (factsAsOf !== null && !isIsoDate(factsAsOf)) {
    parseError(ctx, factsLine, `Invalid facts_as_of "${factsAsOf}"; expected YYYY-MM-DD.`);
  }
  const firstHeading = toLines(body)
    .map(headingOf)
    .find((h) => h !== null);
  const id = typeof data.id === "string" && data.id.trim() !== "" ? data.id.trim() : baseId(file);
  const title = typeof data.title === "string" ? data.title : (firstHeading?.text ?? id);
  return { id, title, frontmatter: data, factsAsOf, body, file };
}

/** `content/packs/<id>.md`: frontmatter + verbatim body. */
export function parsePackFile(text: string, file: string, ctx: ParseContext): Pack {
  const { data, body, lineOf } = readFrontmatter(toLines(text), ctx);
  return buildPack(data, joinLines(trimBlankLines(body)), file, ctx, lineOf("facts_as_of"));
}

/**
 * A pack body from a bundle is the intro, a `---`, then the trailing sections.
 * Splits it back so a bundle can place the intro first and the rest last.
 */
export function splitPackBody(body: string): { intro: string; trailing: string } {
  const lines = toLines(body);
  const first = lines.find((l) => !isBlank(l));
  if (!first || headingOf(first)?.depth !== 1) return { intro: "", trailing: body };
  const brk = lines.findIndex(isThematicBreak);
  if (brk < 0) return { intro: body, trailing: "" };
  return {
    intro: joinLines(trimBlankLines(lines.slice(0, brk))),
    trailing: joinLines(trimBlankLines(lines.slice(brk + 1))),
  };
}

/**
 * The bullets under a pack's `Sources` heading. A date in the heading
 * ("Sources (… as of 2026-09-23)") becomes the note of undated sources.
 */
export function extractPackSources(body: string): Source[] {
  const lines = toLines(body);
  const start = lines.findIndex((l) => /^sources\b/i.test(headingOf(l)?.text ?? ""));
  if (start < 0) return [];
  const asOf = headingAsOf(headingOf(lines[start])?.text ?? "");
  const out: Source[] = [];
  for (const l of lines.slice(start + 1)) {
    if (headingOf(l) || isThematicBreak(l)) break;
    const bullet = bulletOf(l);
    if (!bullet || bullet.indent > 0) continue;
    const source = parseSourceBullet(bullet.text);
    if (source) out.push({ ...source, note: source.note ?? (asOf ? `as of ${asOf}` : null), line: l.line });
  }
  return out;
}
