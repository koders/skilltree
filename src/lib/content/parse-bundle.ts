// Bundle shape (spec §8): YAML frontmatter, an intro, `# Branch:` sections with
// `##` skills, `# Quest:` sections, and pack sections after a `---`.

import { slugify } from "@/lib/content/ids";
import {
  type SourceLine,
  headingOf,
  isBlank,
  isThematicBreak,
  joinLines,
  metaOf,
  toLines,
  trimBlankLines,
} from "@/lib/content/markdown";
import { splitBlock } from "@/lib/content/parse-block";
import { parseBranchHeader, stripPrefix } from "@/lib/content/parse-branch";
import { type ParseContext, createContext, parseError } from "@/lib/content/parse-context";
import { buildPack, packFactsAsOf, readFrontmatter } from "@/lib/content/parse-pack";
import { parseQuestBlock } from "@/lib/content/parse-quest";
import { parseSkillBlock } from "@/lib/content/parse-skill";
import type { Branch, ContentTree, Quest, Skill } from "@/lib/content/types";

type Segment = { kind: "branch" | "quest" | "pack"; lines: SourceLine[] };

function segmentsOf(body: SourceLine[]): Segment[] {
  const segments: Segment[] = [];
  let current: Segment = { kind: "pack", lines: [] };
  const start = (kind: Segment["kind"], first: SourceLine[]) => {
    segments.push(current);
    current = { kind, lines: first };
  };
  for (const l of body) {
    const h = headingOf(l);
    if (h && h.depth === 1) {
      if (/^branch:/i.test(h.text)) start("branch", [l]);
      else if (/^quest:/i.test(h.text)) start("quest", [l]);
      else start("pack", [l]);
    } else if (current.kind !== "pack" && isThematicBreak(l)) {
      // `---` closes the branch or quest; what follows (until the next `#`) is pack body.
      start("pack", []);
    } else {
      current.lines.push(l);
    }
  }
  segments.push(current);
  return segments;
}

const ID_VALUE_RE = /^[A-Za-z0-9][\w.-]*$/;

/**
 * Pack text is kept verbatim, so a skill that ended up there (usually after a
 * stray `---` between skills) would vanish from the tree without a word.
 */
function reportStraySkills(lines: SourceLine[], ctx: ParseContext): void {
  lines.forEach((l, i) => {
    const h = headingOf(l);
    if (h?.depth !== 2) return;
    const next = lines.slice(i + 1).find((x) => !isBlank(x));
    const meta = next ? metaOf(next) : null;
    if (meta?.key.toLowerCase() !== "id" || !ID_VALUE_RE.test(meta.value)) return;
    parseError(
      ctx,
      l.line,
      `"${h.text}" looks like a skill (- id: ${meta.value}), but it isn't inside a "# Branch:" section, so it's kept as pack text. ` +
        "Remove the --- above it or add a # Branch: heading.",
    );
  });
}

/** A pack chunk without surrounding blank lines and stray `---` breaks. */
function packChunk(lines: SourceLine[]): string {
  let out = trimBlankLines(lines);
  while (out.length && isThematicBreak(out[0])) out = trimBlankLines(out.slice(1));
  while (out.length && isThematicBreak(out[out.length - 1])) out = trimBlankLines(out.slice(0, -1));
  return joinLines(out);
}

export interface ParseBundleOptions {
  /**
   * Skills without their own `facts_as_of` inherit the bundle's (spec §4).
   * The importer turns this off to tell inherited dates from explicit ones.
   */
  inheritFactsAsOf?: boolean;
}

export function parseBundle(text: string, file: string, options: ParseBundleOptions = {}): ContentTree {
  const ctx = createContext(file);
  const { data, body, lineOf } = readFrontmatter(toLines(text), ctx);
  const segments = segmentsOf(body);
  const packChunks: string[] = [];
  const branches: Branch[] = [];
  const skills: Skill[] = [];
  const quests: Quest[] = [];

  const inherited = options.inheritFactsAsOf === false ? null : packFactsAsOf(data);

  for (const seg of segments) {
    if (seg.kind === "pack") {
      reportStraySkills(seg.lines, ctx);
      const chunk = packChunk(seg.lines);
      if (chunk !== "") packChunks.push(chunk);
    } else if (seg.kind === "quest") {
      quests.push(parseQuestBlock(seg.lines, null, ctx));
    } else {
      const block = splitBlock(seg.lines, 1);
      const branch = parseBranchHeader(block, slugify(stripPrefix(block.title, "Branch")), ctx);
      for (const section of block.sections) {
        const skill = parseSkillBlock(
          [section.headingLine, ...section.lines],
          { depth: 2, branchId: branch.id, inheritedFactsAsOf: inherited },
          ctx,
        );
        skills.push(skill);
        branch.skillIds.push(skill.id);
      }
      branches.push(branch);
    }
  }

  const pack = buildPack(data, packChunks.join("\n\n---\n\n"), file, ctx, lineOf("facts_as_of"));
  return {
    branches,
    skills,
    quests,
    packs: [pack],
    diagnostics: ctx.diagnostics,
    shape: "bundle",
  };
}
