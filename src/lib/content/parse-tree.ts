// Tree shape (spec §1): one file per branch, skill, quest and pack under
// content/. Pure: takes file contents, never touches the filesystem.

import { type SourceLine, headingOf, isBlank, toLines } from "@/lib/content/markdown";
import { splitBlock } from "@/lib/content/parse-block";
import { parseBranchHeader } from "@/lib/content/parse-branch";
import { type ParseContext, createContext, parseError } from "@/lib/content/parse-context";
import { parsePackFile } from "@/lib/content/parse-pack";
import { parseQuestBlock } from "@/lib/content/parse-quest";
import { parseSkillBlock } from "@/lib/content/parse-skill";
import type { Branch, ContentTree, Diagnostic, Pack, Quest, Skill } from "@/lib/content/types";

export interface ContentFile {
  /** Repo-relative, e.g. "content/branches/crypto/consensus.md". */
  path: string;
  text: string;
}

export type ContentFileKind =
  | { kind: "branch"; branchDir: string }
  | { kind: "skill"; branchDir: string; slug: string }
  | { kind: "quest"; slug: string }
  | { kind: "pack"; id: string };

/**
 * What a content path holds, from its place under content/ (null: not
 * content). READMEs and `_*.md` files (other than `_branch.md`) are notes for
 * people, so they are ignored everywhere.
 */
export function classifyPath(filePath: string): ContentFileKind | null {
  const p = filePath.replace(/\\/g, "/");
  let m = /(?:^|\/)branches\/([^/]+)\/_branch\.md$/.exec(p);
  if (m) return { kind: "branch", branchDir: m[1] };
  if (/(?:^|\/)(?:readme\.md|_[^/]*)$/i.test(p)) return null;
  m = /(?:^|\/)branches\/([^/]+)\/([^/_][^/]*)\.md$/.exec(p);
  if (m) return { kind: "skill", branchDir: m[1], slug: m[2] };
  m = /(?:^|\/)quests\/([^/]+)\.md$/.exec(p);
  if (m) return { kind: "quest", slug: m[1] };
  m = /(?:^|\/)packs\/([^/]+)\.md$/.exec(p);
  if (m) return { kind: "pack", id: m[1] };
  return null;
}

/** The file's single `#` block; stray text before it and extra `#` headings are errors. */
function topBlock(text: string, ctx: ParseContext): SourceLine[] | null {
  const lines = toLines(text);
  const start = lines.findIndex((l) => headingOf(l)?.depth === 1);
  if (start < 0) {
    parseError(ctx, 1, 'No "# Title" heading found.');
    return null;
  }
  const stray = lines.slice(0, start).find((l) => !isBlank(l));
  if (stray) parseError(ctx, stray.line, `Unexpected text before the "# Title" heading: "${stray.text.trim()}".`);
  const next = lines.findIndex((l, i) => i > start && headingOf(l)?.depth === 1);
  if (next < 0) return lines.slice(start);
  parseError(ctx, lines[next].line, "Only one # heading is allowed per file; the rest of the file is ignored.");
  return lines.slice(start, next);
}

export function parseSkillFile(text: string, file: string, diagnostics: Diagnostic[] = []): Skill | null {
  const ctx = createContext(file, diagnostics);
  const where = classifyPath(file);
  const branchDir = where?.kind === "skill" ? where.branchDir : "";
  const fallbackId = where?.kind === "skill" ? `${where.branchDir}.${where.slug}` : undefined;
  const lines = topBlock(text, ctx);
  return lines ? parseSkillBlock(lines, { depth: 1, branchId: branchDir, fallbackId }, ctx) : null;
}

export function parseBranchFile(text: string, file: string, diagnostics: Diagnostic[] = []): Branch | null {
  const ctx = createContext(file, diagnostics);
  const where = classifyPath(file);
  const lines = topBlock(text, ctx);
  if (!lines) return null;
  const block = splitBlock(lines, 1);
  for (const section of block.sections) {
    parseError(ctx, section.line, `Unexpected section "${section.heading}" in a branch file; skills go in their own files.`);
  }
  return parseBranchHeader(block, where?.kind === "branch" ? where.branchDir : null, ctx);
}

export function parseQuestFile(text: string, file: string, diagnostics: Diagnostic[] = []): Quest | null {
  const ctx = createContext(file, diagnostics);
  const where = classifyPath(file);
  const lines = topBlock(text, ctx);
  return lines ? parseQuestBlock(lines, where?.kind === "quest" ? `quest-${where.slug}` : null, ctx) : null;
}

/** Code-point order: stable across machines, unlike localeCompare. */
export function compareStrings(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

function byTitle(a: { title: string; id: string }, b: { title: string; id: string }): number {
  return compareStrings(a.title.toLowerCase(), b.title.toLowerCase()) || compareStrings(a.id, b.id);
}

/**
 * Files have no order, so skills within a branch are ordered topologically by
 * their prerequisites (skill and rank `requires` inside the branch), ties by
 * title. Skills caught in a cycle go last, by title (the validator reports it).
 */
export function orderSkills(skills: Skill[]): Skill[] {
  const ids = new Set(skills.map((s) => s.id));
  const pending = new Map(
    skills.map((s) => [s.id, new Set([...s.requires, ...s.ranks.flatMap((r) => r.requires)].filter((r) => ids.has(r) && r !== s.id))]),
  );
  const out: Skill[] = [];
  let remaining = [...skills].sort(byTitle);
  while (remaining.length) {
    const ready = remaining.find((s) => pending.get(s.id)?.size === 0);
    if (!ready) {
      out.push(...remaining);
      break;
    }
    out.push(ready);
    remaining = remaining.filter((s) => s !== ready);
    for (const deps of pending.values()) deps.delete(ready.id);
  }
  return out;
}

function byOrder(a: Branch, b: Branch): number {
  const oa = a.order ?? Number.POSITIVE_INFINITY;
  const ob = b.order ?? Number.POSITIVE_INFINITY;
  return oa !== ob ? oa - ob : byTitle(a, b);
}

export function parseTreeFiles(files: ContentFile[]): ContentTree {
  const diagnostics: Diagnostic[] = [];
  const branchByDir = new Map<string, Branch>();
  const skillsByDir = new Map<string, Skill[]>();
  const quests: Quest[] = [];
  const packs: Pack[] = [];

  for (const file of [...files].sort((a, b) => compareStrings(a.path, b.path))) {
    const where = classifyPath(file.path);
    if (!where) continue;
    if (where.kind === "branch") {
      const branch = parseBranchFile(file.text, file.path, diagnostics);
      if (branch) branchByDir.set(where.branchDir, branch);
    } else if (where.kind === "skill") {
      const skill = parseSkillFile(file.text, file.path, diagnostics);
      if (skill) skillsByDir.set(where.branchDir, [...(skillsByDir.get(where.branchDir) ?? []), skill]);
    } else if (where.kind === "quest") {
      const quest = parseQuestFile(file.text, file.path, diagnostics);
      if (quest) quests.push(quest);
    } else {
      packs.push(parsePackFile(file.text, file.path, createContext(file.path, diagnostics)));
    }
  }

  const branches = [...branchByDir.values()].sort(byOrder);
  const skills: Skill[] = [];
  for (const [dir, branch] of [...branchByDir.entries()].sort((a, b) => byOrder(a[1], b[1]))) {
    const ordered = orderSkills(skillsByDir.get(dir) ?? []);
    branch.skillIds = ordered.map((s) => s.id);
    skills.push(...ordered);
  }
  for (const [dir, orphans] of [...skillsByDir.entries()].sort((a, b) => compareStrings(a[0], b[0]))) {
    if (branchByDir.has(dir)) continue;
    for (const s of orphans) {
      diagnostics.push({
        severity: "error",
        code: "parse",
        message: `Skill folder content/branches/${dir}/ has no _branch.md.`,
        file: s.file,
        line: s.line,
        skillId: s.id,
      });
    }
    skills.push(...orderSkills(orphans));
  }

  return {
    branches,
    skills,
    quests: quests.sort((a, b) => compareStrings(a.id, b.id)),
    packs: packs.sort((a, b) => compareStrings(a.id, b.id)),
    diagnostics,
    shape: "tree",
  };
}
