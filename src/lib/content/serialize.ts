// Content AST → markdown, in the tree shape (one file per unit) or the bundle
// shape. Round-trip contract: parsing the output gives back the same AST,
// ignoring `file` and `line`.

import YAML from "yaml";
import { formatMinutes } from "@/lib/content/durations";
import { escapeTableCell, escapeThematicBreaks, shiftHeadings } from "@/lib/content/markdown";
import { splitPackBody } from "@/lib/content/parse-pack";
import { QUEST_INTRO_HEADING } from "@/lib/content/parse-quest";
import type { ContentFile } from "@/lib/content/parse-tree";
import type { Branch, ContentTree, Item, Pack, Quest, QuestStage, Rank, Skill } from "@/lib/content/types";

const NONE = "—";

function heading(depth: number, text: string): string {
  return `${"#".repeat(depth)} ${text}`;
}

function meta(key: string, value: string): string {
  return value === "" ? `- ${key}:` : `- ${key}: ${value}`;
}

function extraMetaLines(extra: Record<string, string>): string[] {
  return Object.entries(extra).map(([k, v]) => meta(k, v));
}

/** Free markdown as written into a file; in a bundle a bare `---` would close the branch or quest. */
function verbatim(text: string, bundle: boolean): string {
  return bundle ? escapeThematicBreaks(text) : text;
}

/** Joins non-empty blocks with one blank line. */
function blocks(parts: (string | null | false | undefined)[]): string {
  return parts.filter((p): p is string => typeof p === "string" && p !== "").join("\n\n");
}

// ------------------------------------------------------------------- items

function renderField(label: string, text: string): string[] {
  const [first, ...rest] = text.split("\n");
  const head = label === "" ? `  - ${first}` : `  - ${label}:${first === "" ? "" : ` ${first}`}`;
  return [head.trimEnd(), ...rest.map((r) => (r === "" ? "" : `    ${r}`))];
}

export function serializeItem(item: Item): string {
  const parts = ["-", item.checked ? "[x]" : "[ ]"];
  const type = item.rawType ?? item.type;
  if (type) parts.push(`[${type}]`);
  if (item.timeSensitive) parts.push("[time-sensitive]");
  // A title starting with "Optional" already implies the flag (spec §2.4).
  if (item.optional && !/^optional\b/i.test(item.title)) parts.push("[optional]");
  if (item.title) parts.push(item.title);
  let line = parts.join(" ");
  const time = item.timeText ?? (item.minutes === null ? null : formatMinutes(item.minutes));
  if (time) line += ` — ${time}`;
  if (item.id) line += ` {#${item.id}}`;
  return [line, ...item.fields.flatMap((f) => renderField(f.label, f.text))].join("\n");
}

// ------------------------------------------------------------------ skills

function renderRank(rank: Rank, depth: number): string {
  const lines = [heading(depth, `Rank ${rank.number}${rank.name ? ` — ${rank.name}` : ""}`)];
  if (rank.requires.length) lines.push(meta("requires", rank.requires.join(", ")));
  lines.push(...rank.items.map(serializeItem));
  return lines.join("\n");
}

function renderSection(depth: number, title: string, body: string, bundle: boolean): string {
  const shifted = verbatim(shiftHeadings(body, depth - 2), bundle);
  return shifted === "" ? heading(depth, title) : `${heading(depth, title)}\n\n${shifted}`;
}

interface SkillRenderOptions {
  /** Skill heading depth: 1 for a tree file, 2 inside a bundle branch. */
  depth: number;
  bundle: boolean;
  /** A bundle's own facts_as_of: skills with the same date inherit it instead of repeating it. */
  inheritedFactsAsOf: string | null;
}

function renderSkill(skill: Skill, opts: SkillRenderOptions): string {
  const d = opts.depth;
  const head = [heading(d, skill.title), meta("id", skill.id), meta("requires", skill.requires.join(", ") || NONE)];
  if (skill.related.length) head.push(meta("related", skill.related.join(", ")));
  if (skill.status !== null) head.push(meta("status", skill.status));
  if (skill.estimate) head.push(meta("estimate", skill.estimate.text));
  if (skill.factsAsOf !== null && skill.factsAsOf !== opts.inheritedFactsAsOf) head.push(meta("facts_as_of", skill.factsAsOf));
  head.push(...extraMetaLines(skill.extraMeta));

  const recall = skill.recall.map((q) => `- ${q.text}${q.id ? ` {#${q.id}}` : ""}`);
  const sources = skill.sources.map((s) => `- [${s.title}](${s.url})${s.note ? ` — ${s.note}` : ""}`);
  const b = opts.bundle;
  return blocks([
    head.join("\n"),
    skill.why !== null && verbatim(skill.why === "" ? "Why:" : `Why: ${skill.why}`, b),
    // The description is stored at tree depth, like section bodies.
    skill.description !== null && verbatim(shiftHeadings(skill.description, d - 1), b),
    ...skill.ranks.map((r) => renderRank(r, d + 1)),
    recall.length > 0 && [heading(d + 1, "Recall"), ...recall].join("\n"),
    sources.length > 0 && [heading(d + 1, "Sources"), ...sources].join("\n"),
    ...skill.sections.map((s) => renderSection(d + 1, s.heading, s.body, b)),
    skill.reviewLog !== null && renderSection(d + 1, "Review log", skill.reviewLog, b),
  ]);
}

/** Tree-shape skill file (`# Title`). */
export function serializeSkill(skill: Skill): string {
  return `${renderSkill(skill, { depth: 1, bundle: false, inheritedFactsAsOf: null })}\n`;
}

// ---------------------------------------------------------------- branches

function renderBranchHeader(branch: Branch, bundle: boolean): string {
  const head = [meta("id", branch.id)];
  if (branch.note !== null) head.push(meta("note", branch.note));
  if (branch.color !== null) head.push(meta("color", branch.color));
  if (branch.order !== null) head.push(meta("order", String(branch.order)));
  head.push(...extraMetaLines(branch.extraMeta));
  const title = bundle ? heading(1, `Branch: ${branch.title}`) : heading(1, branch.title);
  // The seed puts a blank line between a bundle section heading and its metadata.
  const description = branch.description === null ? null : verbatim(branch.description, bundle);
  return blocks([bundle ? `${title}\n\n${head.join("\n")}` : [title, ...head].join("\n"), description]);
}

/** `_branch.md`. */
export function serializeBranch(branch: Branch): string {
  return `${renderBranchHeader(branch, false)}\n`;
}

// ------------------------------------------------------------------ quests

function formatWeeks(stage: QuestStage): string {
  if (stage.weekEnd === null) return `${stage.weekStart}+`;
  if (stage.weekEnd === stage.weekStart) return `${stage.weekStart}`;
  return `${stage.weekStart}–${stage.weekEnd}`;
}

function formatStep(step: QuestStage["steps"][number]): string {
  if (step.text) return step.text;
  if (!step.ranks) return step.skillId;
  const label = step.ranks.length === 1 ? "Rank" : "Ranks";
  return `${step.skillId} (${label} ${step.ranks.join(", ")})`;
}

function renderStageTable(stages: QuestStage[]): string {
  if (!stages.length) return "";
  const rows = stages.map(
    (s) => `| ${formatWeeks(s)} | ${escapeTableCell(s.name)} | ${escapeTableCell(s.steps.map(formatStep).join(" → "))} |`,
  );
  return ["| Weeks | Stage | Skills (in order) |", "| --- | --- | --- |", ...rows].join("\n");
}

function renderQuest(quest: Quest, bundle: boolean): string {
  const head = [meta("id", quest.id)];
  if (quest.pace !== null) head.push(meta("pace", quest.pace));
  if (quest.goal !== null) head.push(meta("goal", quest.goal));
  head.push(...extraMetaLines(quest.extraMeta));
  const title = bundle ? heading(1, `Quest: ${quest.title}`) : heading(1, quest.title);

  const intro = quest.sections.filter((s) => s.heading === QUEST_INTRO_HEADING);
  const others = quest.sections.filter((s) => s.heading !== QUEST_INTRO_HEADING);
  const m = quest.maintenance;
  return blocks([
    bundle ? `${title}\n\n${head.join("\n")}` : [title, ...head].join("\n"),
    renderStageTable(quest.stages),
    ...intro.map((s) => verbatim(s.body, bundle)),
    m &&
      blocks([
        heading(2, m.heading || "Maintenance"),
        m.description !== null && verbatim(m.description, bundle),
        m.items.map(serializeItem).join("\n"),
      ]),
    ...others.map((s) => renderSection(2, s.heading, s.body, bundle)),
    quest.reviewLog !== null && renderSection(2, "Review log", quest.reviewLog, bundle),
  ]);
}

export function serializeQuest(quest: Quest): string {
  return `${renderQuest(quest, false)}\n`;
}

// ------------------------------------------------------------------- packs

function frontmatter(data: Record<string, unknown>): string {
  const doc = new YAML.Document(data);
  // Short lists of scalars stay on one line, like the seed's `branches: [a, b]`.
  YAML.visit(doc, {
    Seq(_, node) {
      if (node.items.every((item) => YAML.isScalar(item))) node.flow = true;
    },
  });
  return `---\n${doc.toString({ lineWidth: 0, flowCollectionPadding: false })}---`;
}

export function serializePack(pack: Pack): string {
  return `${blocks([frontmatter(pack.frontmatter), pack.body])}\n`;
}

// ------------------------------------------------------------------ bundle

function latestDate(dates: (string | null)[]): string | null {
  return dates.filter((d): d is string => d !== null).sort().pop() ?? null;
}

function exportFrontmatter(tree: ContentTree, factsAsOf: string | null): Record<string, unknown> {
  const data: Record<string, unknown> = { id: "skilltree-export", title: "skilltree export" };
  if (factsAsOf) data.facts_as_of = factsAsOf;
  data.branches = tree.branches.map((b) => b.id);
  data.quests = tree.quests.map((q) => q.id);
  return data;
}

/**
 * The whole tree as one `*.skilltree.md`. With a pack, its frontmatter and body
 * frame the bundle (intro first, the rest after the quests); without one, a
 * minimal frontmatter is generated. Skills whose facts_as_of equals the
 * bundle's inherit it; others state their own.
 */
export function serializeBundle(tree: ContentTree, pack?: Pack): string {
  const factsAsOf = pack ? pack.factsAsOf : latestDate(tree.skills.map((s) => s.factsAsOf));
  const data = pack ? pack.frontmatter : exportFrontmatter(tree, factsAsOf);
  const { intro, trailing } = pack ? splitPackBody(pack.body) : { intro: "", trailing: "" };
  const skillOpts: SkillRenderOptions = { depth: 2, bundle: true, inheritedFactsAsOf: factsAsOf };

  const known = new Set(tree.branches.map((b) => b.id));
  const orphanBranches: Branch[] = [...new Set(tree.skills.map((s) => s.branchId).filter((id) => !known.has(id)))].map(
    (id) => ({ id, title: id, note: null, description: null, color: null, order: null, skillIds: [], extraMeta: {}, file: "", line: 0 }),
  );
  const branchSections = [...tree.branches, ...orphanBranches].map((branch) => {
    const skills = tree.skills.filter((s) => s.branchId === branch.id);
    const ordered = [
      ...branch.skillIds.map((id) => skills.find((s) => s.id === id)).filter((s): s is Skill => s !== undefined),
      ...skills.filter((s) => !branch.skillIds.includes(s.id)),
    ];
    return blocks([renderBranchHeader(branch, true), ...ordered.map((s) => renderSkill(s, skillOpts))]);
  });

  const sections = [intro, ...branchSections, ...tree.quests.map((q) => renderQuest(q, true)), trailing].filter((s) => s !== "");
  return `${frontmatter(data)}\n\n${sections.join("\n\n---\n\n")}\n`;
}

// ------------------------------------------------------------------- files

/** Tree-shape files per spec §1, paths under `content/`. */
export function treeToFiles(tree: ContentTree, packs: Pack[] = tree.packs): ContentFile[] {
  return [
    ...tree.branches.map((b) => ({ path: `content/branches/${b.id}/_branch.md`, text: serializeBranch(b) })),
    ...tree.skills.map((s) => ({ path: `content/branches/${s.branchId}/${s.slug}.md`, text: serializeSkill(s) })),
    ...tree.quests.map((q) => ({ path: `content/quests/${q.id.replace(/^quest-/, "")}.md`, text: serializeQuest(q) })),
    ...packs.map((p) => ({ path: `content/packs/${p.id}.md`, text: serializePack(p) })),
  ];
}
