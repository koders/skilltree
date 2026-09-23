// One skill block (spec §2), shared by both shapes: the skill heading is `#`
// in a tree file and `##` inside a bundle branch; sections sit one level below.

import { parseEstimate } from "@/lib/content/durations";
import { slugify } from "@/lib/content/ids";
import {
  type SourceLine,
  bulletOf,
  headingOf,
  indentOf,
  isBlank,
  isNoneValue,
  shiftHeadings,
  splitList,
  stripTrailingId,
} from "@/lib/content/markdown";
import { type SectionBlock, readMeta, sectionBody, splitBlock, whyAndDescription } from "@/lib/content/parse-block";
import { type DiagnosticRef, type ParseContext, parseError } from "@/lib/content/parse-context";
import { parseItemList } from "@/lib/content/parse-items";
import { isIsoDate } from "@/lib/engine/dates";
import type { Rank, RecallQuestion, Section, Skill, Source } from "@/lib/content/types";

export const SKILL_META_KEYS = ["id", "requires", "related", "status", "estimate", "facts_as_of"] as const;

export interface SkillBlockOptions {
  /** Heading depth of the skill title: 1 in tree files, 2 in bundles. */
  depth: number;
  /** Branch the block sits in (bundle branch id, or the tree folder). */
  branchId: string;
  /** Used when the block has no `- id:` (tree shape: derived from the path). */
  fallbackId?: string;
  /** Bundle `facts_as_of`, inherited when the skill doesn't set its own. */
  inheritedFactsAsOf?: string | null;
}

const RANK_RE = /^Rank\s+(\d+)\s*(?:[—–:-]\s*(.*?))?\s*$/i;

function parseRecall(section: SectionBlock, ctx: ParseContext, ref: DiagnosticRef): RecallQuestion[] {
  const drafts: { first: string; headerId: string | null; more: string[]; line: number }[] = [];
  for (const l of section.lines) {
    if (isBlank(l)) continue;
    const bullet = bulletOf(l, true);
    if (bullet && bullet.indent === 0) {
      // An id at the end of the first line counts too, so `pnpm content:ids` can append there.
      const { text, id } = stripTrailingId(bullet.text);
      drafts.push({ first: text.trim(), headerId: id, more: [], line: l.line });
    } else if (drafts.length && indentOf(l.text) > 0) {
      drafts[drafts.length - 1].more.push(l.text.trim());
    } else {
      parseError(ctx, l.line, `Expected a recall question bullet ("- Question? {#q1}"), found "${l.text.trim()}".`, ref);
    }
  }
  return drafts.map((d) => {
    const full = [d.first, ...d.more].join(" ");
    if (d.headerId !== null) return { id: d.headerId, text: full, line: d.line };
    const { text, id } = stripTrailingId(full);
    return { id: id ?? "", text: text.trim(), line: d.line };
  });
}

const SOURCE_RE = /^\[([^\]]*)\]\(\s*((?:[^()\s]|\([^()\s]*\))+)(?:\s+"[^"]*")?\s*\)(.*)$/;

export function parseSourceBullet(text: string): { title: string; url: string; note: string | null } | null {
  const m = SOURCE_RE.exec(text.trim());
  if (!m) return null;
  const note = m[3].replace(/^\s*[—–:,-]?\s*/, "").trim();
  return { title: m[1].trim(), url: m[2], note: note === "" ? null : note };
}

/** `Sources (as of 2026-09-23)`: the heading's date, which the serializer can't keep in the heading. */
export function headingAsOf(heading: string): string | null {
  return /\bas of (\d{4}-\d{2}-\d{2})/i.exec(heading)?.[1] ?? null;
}

function parseSources(section: SectionBlock, ctx: ParseContext, ref: DiagnosticRef): Source[] {
  const out: Source[] = [];
  const asOf = headingAsOf(section.heading);
  for (const l of section.lines) {
    if (isBlank(l)) continue;
    const bullet = bulletOf(l);
    if (bullet && bullet.indent === 0) {
      const source = parseSourceBullet(bullet.text);
      if (source) out.push({ ...source, line: l.line });
      else parseError(ctx, l.line, `A source must start with a markdown link: "- [Title](url) — note".`, ref);
    } else if (out.length && indentOf(l.text) > 0) {
      const s = out[out.length - 1];
      s.note = s.note === null ? l.text.trim() : `${s.note} ${l.text.trim()}`;
    } else {
      parseError(ctx, l.line, `Expected a source bullet ("- [Title](url) — note"), found "${l.text.trim()}".`, ref);
    }
  }
  return asOf === null ? out : out.map((s) => (s.note === null ? { ...s, note: `as of ${asOf}` } : s));
}

function parseRank(
  section: SectionBlock,
  match: RegExpExecArray,
  skillId: string,
  ctx: ParseContext,
  ref: DiagnosticRef,
): Rank {
  const number = Number(match[1]);
  const { items, requires } = parseItemList(
    section.lines,
    { ownerId: skillId, defaultCadence: null, ref, allowRequires: true, allowParagraphs: false },
    ctx,
  );
  const name = match[2]?.trim() || null;
  return { id: `rank-${number}`, number, name, requires, items, line: section.line };
}

/** `lines[0]` is the skill heading; the block ends before the next heading at `depth` or above. */
export function parseSkillBlock(lines: SourceLine[], opts: SkillBlockOptions, ctx: ParseContext): Skill {
  const block = splitBlock(lines, opts.depth);
  const title = block.title;
  const { known, extra } = readMeta(block.meta, SKILL_META_KEYS, ctx);

  let id = known.id?.value.trim() ?? "";
  if (id === "") {
    id = opts.fallbackId ?? `${opts.branchId}.${slugify(title)}`;
    parseError(ctx, block.line, `Skill "${title}" has no "- id:" line (using "${id}").`, { skillId: id });
  }
  const ref: DiagnosticRef = { skillId: id };
  const dot = id.indexOf(".");

  const estimateText = known.estimate?.value;
  const estimate = estimateText === undefined || isNoneValue(estimateText) ? null : parseEstimate(estimateText);
  if (estimate && estimate.hours === null && known.estimate) {
    parseError(ctx, known.estimate.line, `Unparseable estimate "${estimate.text}"; expected e.g. "~3 h".`, ref);
  }

  let factsAsOf = opts.inheritedFactsAsOf ?? null;
  if (known.facts_as_of) {
    factsAsOf = known.facts_as_of.value;
    if (!isIsoDate(factsAsOf)) {
      parseError(ctx, known.facts_as_of.line, `Invalid facts_as_of "${factsAsOf}"; expected YYYY-MM-DD.`, ref);
    }
  }

  for (const l of block.preamble) {
    const h = headingOf(l);
    if (h && RANK_RE.test(h.text)) {
      parseError(ctx, l.line, `"${h.text}" must be a ${"#".repeat(opts.depth + 1)} heading (one level below the skill).`, ref);
    }
  }
  const sectionDepth = opts.depth + 1;
  const { why, description: rawDescription } = whyAndDescription(block.preamble);
  // Stored at tree depth like section bodies, so `####` in a bundle is `###` in a file.
  const description = rawDescription === null ? null : shiftHeadings(rawDescription, 2 - sectionDepth);

  const ranks: Rank[] = [];
  const recall: RecallQuestion[] = [];
  const sources: Source[] = [];
  const sections: Section[] = [];
  let reviewLog: string | null = null;
  const seen = new Set<string>();

  for (const section of block.sections) {
    const heading = section.heading.trim();
    const kind = /^sources\b/i.test(heading) ? "sources" : heading.toLowerCase();
    const rank = RANK_RE.exec(heading);
    if (rank) {
      const parsed = parseRank(section, rank, id, ctx, ref);
      const expected = ranks.length + 1;
      if (parsed.number !== expected) {
        parseError(ctx, section.line, `"${heading}" is out of order; expected Rank ${expected}.`, ref);
      }
      ranks.push(parsed);
      continue;
    }
    if (/^rank\b/i.test(heading)) {
      parseError(ctx, section.line, `Malformed rank heading "${heading}"; expected "Rank N" or "Rank N — Name".`, ref);
    }
    if (kind === "recall" || kind === "sources" || kind === "review log") {
      if (seen.has(kind)) parseError(ctx, section.line, `Duplicate "${heading}" section.`, ref);
      seen.add(kind);
    }
    if (kind === "recall") recall.push(...parseRecall(section, ctx, ref));
    else if (kind === "sources") sources.push(...parseSources(section, ctx, ref));
    else if (kind === "review log") {
      const body = sectionBody(section, sectionDepth);
      reviewLog = reviewLog === null ? body : `${reviewLog}\n\n${body}`;
    } else sections.push({ heading, body: sectionBody(section, sectionDepth), line: section.line });
  }

  return {
    id,
    branchId: dot > 0 ? id.slice(0, dot) : opts.branchId,
    slug: dot > 0 ? id.slice(dot + 1) : id,
    title,
    requires: splitList(known.requires?.value ?? ""),
    related: splitList(known.related?.value ?? ""),
    status: known.status ? known.status.value : null,
    estimate,
    factsAsOf,
    why,
    description,
    ranks,
    recall,
    sources,
    reviewLog,
    sections,
    extraMeta: extra,
    file: ctx.file,
    line: block.line,
  };
}
