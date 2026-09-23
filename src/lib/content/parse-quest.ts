// Quest block (spec §7.2): metadata, a stage table, a maintenance section with
// habit items, and other kept sections. `# Title` in the tree, `# Quest: Title`
// in a bundle; both put sections at `##`.

import { parseCadence } from "@/lib/content/cadence";
import { slugify } from "@/lib/content/ids";
import {
  type SourceLine,
  isTableLine,
  isTableSeparator,
  joinLines,
  paragraphsOf,
  splitTableRow,
} from "@/lib/content/markdown";
import { stripPrefix } from "@/lib/content/parse-branch";
import { type SectionBlock, readMeta, sectionBody, splitBlock } from "@/lib/content/parse-block";
import { type DiagnosticRef, type ParseContext, parseError } from "@/lib/content/parse-context";
import { parseItemList } from "@/lib/content/parse-items";
import type { Maintenance, Quest, QuestStage, QuestStep, Section } from "@/lib/content/types";

export const QUEST_META_KEYS = ["id", "pace", "goal"] as const;

/** Heading of the kept section holding quest paragraphs that aren't the stage table. */
export const QUEST_INTRO_HEADING = "";

const HOURS_PER_WEEK_RE = /~?\s*(\d+(?:\.\d+)?)(?:\s*[–-]\s*(\d+(?:\.\d+)?))?\s*h(?:ours?|rs?)?\s*(?:\/|per\s+)\s*w(?:ee)?k/i;

/** `~4–5 h/week` → {4, 5}; a single number gives min = max. */
function hoursPerWeekOf(text: string): { min: number; max: number } | null {
  const m = HOURS_PER_WEEK_RE.exec(text);
  if (!m) return null;
  const [a, b] = [Number(m[1]), Number(m[2] ?? m[1])];
  return { min: Math.min(a, b), max: Math.max(a, b) };
}

/** `12 weeks, ~4–5 h/week, …` → weeks 12, hours {4, 5}. */
export function parsePace(pace: string): { weeks: number | null; hoursPerWeek: { min: number; max: number } | null } {
  const weeks = /(\d+)[\s-]*weeks?\b/i.exec(pace);
  return { weeks: weeks ? Number(weeks[1]) : null, hoursPerWeek: hoursPerWeekOf(pace) };
}

/** `1–3` → 1..3, `13+` → 13..open, `4` → 4..4. Weeks count from 1 and ranges can't run backwards. */
export function parseWeeks(cell: string): { weekStart: number; weekEnd: number | null } | null {
  const text = cell.trim();
  const range = /^(\d+)\s*[–—-]\s*(\d+)$/.exec(text);
  const open = /^(\d+)\s*\+$/.exec(text);
  const single = /^(\d+)$/.exec(text);
  let weeks: { weekStart: number; weekEnd: number | null } | null = null;
  if (range) weeks = { weekStart: Number(range[1]), weekEnd: Number(range[2]) };
  else if (open) weeks = { weekStart: Number(open[1]), weekEnd: null };
  else if (single) weeks = { weekStart: Number(single[1]), weekEnd: Number(single[1]) };
  if (!weeks || weeks.weekStart < 1 || (weeks.weekEnd !== null && weeks.weekEnd < weeks.weekStart)) return null;
  return weeks;
}

/** Splits on `→`, `->` and `,`, but not inside parentheses (`(Ranks 1, 3)`). */
function splitSteps(cell: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let current = "";
  for (let i = 0; i < cell.length; i += 1) {
    const ch = cell[i];
    if (ch === "(") depth += 1;
    if (ch === ")") depth = Math.max(0, depth - 1);
    const arrow = ch === "→" ? 1 : cell.startsWith("->", i) ? 2 : ch === "," ? 1 : 0;
    if (depth === 0 && arrow > 0) {
      out.push(current.trim());
      current = "";
      i += arrow - 1;
    } else {
      current += ch;
    }
  }
  out.push(current.trim());
  return out.filter((s) => s !== "");
}

/** `1` → [1], `1–2` → [1, 2], `1, 3` → [1, 3]. Ranks count from 1. */
export function parseRankList(text: string): number[] | null {
  const out: number[] = [];
  for (const part of text.split(",").map((s) => s.trim())) {
    const range = /^(\d+)\s*[–—-]\s*(\d+)$/.exec(part);
    const single = /^(\d+)$/.exec(part);
    if (range) {
      const [a, b] = [Number(range[1]), Number(range[2])];
      if (b < a) return null;
      for (let n = a; n <= b; n += 1) out.push(n);
    } else if (single) out.push(Number(single[1]));
    else return null;
  }
  return out.length && out.every((n) => n >= 1) ? out : null;
}

const STEP_RE = /^([A-Za-z0-9][\w.-]*)\s*(?:\(\s*ranks?\s+([^)]*)\))?$/i;

function parseStep(text: string): QuestStep | null {
  const m = STEP_RE.exec(text);
  if (!m) return null;
  if (m[2] === undefined) return { skillId: m[1], ranks: null, text };
  const ranks = parseRankList(m[2]);
  return ranks ? { skillId: m[1], ranks, text } : null;
}

function parseStageTable(lines: SourceLine[], ctx: ParseContext, ref: DiagnosticRef): QuestStage[] {
  const rows = lines.map((l) => ({ cells: splitTableRow(l.text), line: l.line }));
  const header = rows[0].cells;
  if (rows.length < 2 || !isTableSeparator(rows[1].cells)) {
    parseError(ctx, rows[0].line, "Malformed stage table: the header row must be followed by a | --- | separator row.", ref);
    return [];
  }
  const col = (re: RegExp) => header.findIndex((h) => re.test(h));
  const weeksCol = col(/^weeks?\b/i);
  const stageCol = col(/^stage\b/i);
  const skillsCol = col(/^skills?\b/i);
  if (weeksCol < 0 || stageCol < 0 || skillsCol < 0) {
    parseError(ctx, rows[0].line, "Malformed stage table: it needs Weeks, Stage and Skills columns.", ref);
    return [];
  }
  // The serializer writes exactly these three columns, so anything else would be lost on the next write.
  header.forEach((name, i) => {
    if (i === weeksCol || i === stageCol || i === skillsCol) return;
    parseError(ctx, rows[0].line, `Stage table column "${name}" isn't part of the format and would be dropped; move it into a paragraph.`, ref);
  });

  const stages: QuestStage[] = [];
  for (const row of rows.slice(2)) {
    if (row.cells.length !== header.length) {
      parseError(ctx, row.line, `Malformed stage table row: ${row.cells.length} cells, expected ${header.length}.`, ref);
      continue;
    }
    const weeks = parseWeeks(row.cells[weeksCol]);
    if (!weeks) {
      parseError(ctx, row.line, `Unparseable weeks "${row.cells[weeksCol]}"; expected N, N–M (M ≥ N) or N+, counting from week 1.`, ref);
      continue;
    }
    const steps: QuestStep[] = [];
    for (const text of splitSteps(row.cells[skillsCol])) {
      const step = parseStep(text);
      if (step) steps.push(step);
      else parseError(ctx, row.line, `Unparseable quest step "${text}"; expected "skill.id" or "skill.id (Ranks 1–2)".`, ref);
    }
    stages.push({ name: row.cells[stageCol], ...weeks, steps, line: row.line });
  }
  return stages;
}

/** `Maintenance (weekly, from week 13, ~2 h/week)`. */
export function parseMaintenanceHeading(heading: string): Pick<Maintenance, "cadence" | "fromWeek" | "hoursPerWeek"> {
  const inner = /\(([^)]*)\)/.exec(heading)?.[1] ?? "";
  const parts = inner.split(",").map((s) => s.trim());
  const cadence = parts.map(parseCadence).find((c) => c !== null) ?? null;
  const fromWeek = /from\s+week\s+(\d+)/i.exec(inner);
  return {
    cadence,
    fromWeek: fromWeek ? Number(fromWeek[1]) : null,
    // A range counts at its upper bound, like item times.
    hoursPerWeek: hoursPerWeekOf(inner)?.max ?? null,
  };
}

function parseMaintenance(section: SectionBlock, questId: string, ctx: ParseContext, ref: DiagnosticRef): Maintenance {
  const head = parseMaintenanceHeading(section.heading);
  const { items, paragraphs } = parseItemList(
    section.lines,
    { ownerId: questId, defaultCadence: head.cadence, ref, allowRequires: false, allowParagraphs: true },
    ctx,
  );
  return {
    heading: section.heading,
    ...head,
    description: paragraphs.length ? paragraphs.join("\n\n") : null,
    items,
    line: section.line,
  };
}

/** `lines[0]` is the quest heading (depth 1). */
export function parseQuestBlock(lines: SourceLine[], fallbackId: string | null, ctx: ParseContext): Quest {
  const block = splitBlock(lines, 1);
  const title = stripPrefix(block.title, "Quest");
  const { known, extra } = readMeta(block.meta, QUEST_META_KEYS, ctx);

  let id = known.id?.value.trim() ?? "";
  if (id === "") {
    id = fallbackId ?? `quest-${slugify(title)}`;
    parseError(ctx, block.line, `Quest "${title}" has no "- id:" line (using "${id}").`, { questId: id });
  }
  const ref: DiagnosticRef = { questId: id };
  const pace = known.pace ? known.pace.value : null;
  const { weeks, hoursPerWeek } = pace === null ? { weeks: null, hoursPerWeek: null } : parsePace(pace);

  let stages: QuestStage[] = [];
  let tableSeen = false;
  const intro: SourceLine[][] = [];
  for (const p of paragraphsOf(block.preamble)) {
    if (!tableSeen && p.every(isTableLine)) {
      tableSeen = true;
      stages = parseStageTable(p, ctx, ref);
    } else {
      intro.push(p);
    }
  }
  // Without these, a quest whose table didn't parse would silently plan nothing.
  if (!tableSeen) {
    const stray = block.preamble.find(isTableLine);
    if (stray) {
      parseError(ctx, stray.line, "Malformed stage table: put a blank line between the table and the text around it.", ref);
    } else {
      parseError(ctx, block.line, `Quest "${title}" has no stage table ("| Weeks | Stage | Skills |") before its first ## section.`, ref);
    }
  }

  // The Quest type has no description, so other preamble paragraphs are kept
  // as a section without a heading (serialized right after the stage table).
  const sections: Section[] = [];
  if (intro.length) {
    sections.push({ heading: QUEST_INTRO_HEADING, body: intro.map(joinLines).join("\n\n"), line: intro[0][0].line });
  }
  let maintenance: Maintenance | null = null;
  let reviewLog: string | null = null;
  for (const section of block.sections) {
    const heading = section.heading.trim();
    if (/^maintenance\b/i.test(heading)) {
      if (maintenance) parseError(ctx, section.line, "Duplicate Maintenance section.", ref);
      else maintenance = parseMaintenance(section, id, ctx, ref);
    } else if (heading.toLowerCase() === "review log") {
      const body = sectionBody(section, 2);
      reviewLog = reviewLog === null ? body : `${reviewLog}\n\n${body}`;
    } else {
      sections.push({ heading, body: sectionBody(section, 2), line: section.line });
    }
  }

  return {
    id,
    title,
    pace,
    weeks,
    hoursPerWeek,
    goal: known.goal ? known.goal.value : null,
    stages,
    maintenance,
    reviewLog,
    sections,
    extraMeta: extra,
    file: ctx.file,
    line: block.line,
  };
}
