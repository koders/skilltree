// The shape shared by skills, branches and quests: a heading, metadata bullets
// right after it, free paragraphs, then sections one heading level deeper.

import {
  type MetaEntry,
  type SourceLine,
  headingOf,
  indentOf,
  isBlank,
  joinLines,
  metaOf,
  paragraphsOf,
  shiftHeadings,
  trimBlankLines,
} from "@/lib/content/markdown";
import { type DiagnosticRef, type ParseContext, parseError } from "@/lib/content/parse-context";

export interface SectionBlock {
  heading: string;
  line: number;
  headingLine: SourceLine;
  /** Body lines, without the heading. */
  lines: SourceLine[];
}

export interface Block {
  title: string;
  line: number;
  depth: number;
  meta: MetaEntry[];
  /** Lines after the metadata and before the first section. */
  preamble: SourceLine[];
  sections: SectionBlock[];
}

function readMetaEntries(lines: SourceLine[], from: number): { meta: MetaEntry[]; next: number } {
  let i = from;
  while (i < lines.length && isBlank(lines[i])) i += 1;
  if (i >= lines.length || !metaOf(lines[i])) return { meta: [], next: from };
  const meta: MetaEntry[] = [];
  while (i < lines.length) {
    const entry = metaOf(lines[i]);
    if (entry) {
      meta.push(entry);
    } else if (meta.length && !isBlank(lines[i]) && indentOf(lines[i].text) > 0 && !lines[i].fenced) {
      // A wrapped value continues on an indented line.
      const last = meta[meta.length - 1];
      last.value = `${last.value} ${lines[i].text.trim()}`.trim();
    } else {
      break;
    }
    i += 1;
  }
  return { meta, next: i };
}

/** `lines[0]` must be the block's heading at `depth`. */
export function splitBlock(lines: SourceLine[], depth: number): Block {
  const heading = headingOf(lines[0]);
  const { meta, next } = readMetaEntries(lines, 1);
  const preamble: SourceLine[] = [];
  const sections: SectionBlock[] = [];
  for (let i = next; i < lines.length; i += 1) {
    const h = headingOf(lines[i]);
    if (h && h.depth <= depth + 1) {
      sections.push({ heading: h.text, line: lines[i].line, headingLine: lines[i], lines: [] });
    } else if (sections.length) {
      sections[sections.length - 1].lines.push(lines[i]);
    } else {
      preamble.push(lines[i]);
    }
  }
  return { title: heading?.text ?? "", line: lines[0].line, depth, meta, preamble, sections };
}

export interface ReadMeta {
  /** First entry per known key (lower-cased). */
  known: Record<string, MetaEntry>;
  /** Unknown keys as written, in source order. */
  extra: Record<string, string>;
}

export function readMeta(
  entries: MetaEntry[],
  knownKeys: readonly string[],
  ctx: ParseContext,
  ref: DiagnosticRef = {},
): ReadMeta {
  const known: Record<string, MetaEntry> = {};
  const extra: Record<string, string> = {};
  const seen = new Set<string>();
  for (const e of entries) {
    const key = e.key.toLowerCase();
    if (seen.has(key)) {
      parseError(ctx, e.line, `Duplicate metadata key "${e.key}"; the first one wins.`, ref);
      continue;
    }
    seen.add(key);
    if (knownKeys.includes(key)) known[key] = e;
    else extra[e.key] = e.value;
  }
  return { known, extra };
}

/** Raw markdown of a section body, with headings rebased to tree-shape depth. */
export function sectionBody(section: SectionBlock, sectionDepth: number): string {
  return shiftHeadings(joinLines(trimBlankLines(section.lines)), 2 - sectionDepth);
}

const WHY_RE = /^why:[ \t]*/i;

/** Splits preamble paragraphs into the first `Why:` paragraph and the rest. */
export function whyAndDescription(preamble: SourceLine[]): { why: string | null; description: string | null } {
  let why: string | null = null;
  const rest: string[] = [];
  for (const p of paragraphsOf(preamble)) {
    const text = joinLines(p);
    if (why === null && WHY_RE.test(text)) why = text.replace(WHY_RE, "").trim();
    else rest.push(text);
  }
  return { why, description: rest.length ? rest.join("\n\n") : null };
}
