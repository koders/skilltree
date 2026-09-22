// Content AST: what the parser produces from `content/` (tree shape) or a
// `*.skilltree.md` bundle. See docs/format-spec.md. Everything here is plain,
// JSON-serialisable data so it can be passed to client components.

export const ITEM_TYPES = ["watch", "read", "do", "build", "output", "habit"] as const;
export type ItemType = (typeof ITEM_TYPES)[number];

/** Item types that make me produce something (guide §4 "active, not passive"). */
export const ACTIVE_ITEM_TYPES: readonly ItemType[] = ["do", "build", "output"];

export const RESOURCE_TYPES = [
  "video",
  "search",
  "course",
  "official",
  "article",
  "book",
  "podcast",
  "tool",
  "opensource",
  "feed",
] as const;
export type ResourceType = (typeof RESOURCE_TYPES)[number];

export function isItemType(value: string): value is ItemType {
  return (ITEM_TYPES as readonly string[]).includes(value);
}

export function isResourceType(value: string): value is ResourceType {
  return (RESOURCE_TYPES as readonly string[]).includes(value);
}

/** A typed link `[@type@Title](url)` found anywhere in an item's text. */
export interface Resource {
  /** One of RESOURCE_TYPES when known; unknown types are kept verbatim. */
  type: string;
  title: string;
  url: string;
  /** Where it was found: "title" or the sub-bullet label, e.g. "Resource", "Do". */
  field: string;
}

/** One `Label: text` sub-bullet under an item, in source order. */
export interface ItemField {
  /** Label as written, e.g. "Done when", "Case study". Empty string for unlabeled notes. */
  label: string;
  /** Inline markdown. Continuation lines are joined with "\n". */
  text: string;
  line: number;
}

export type CadenceUnit = "week" | "month" | "year";

export interface Cadence {
  unit: CadenceUnit;
  /** Occurrences per unit, e.g. 2 for "twice a week". */
  times: number;
  /** Where it came from, for display, e.g. "2× week" or "monthly". */
  text: string;
}

export interface Item {
  /** Local id (kebab-case), unique within its owner. Empty string if missing in a bundle. */
  id: string;
  /** Globally unique key used for progress: `${ownerId}/${id}`. */
  key: string;
  /** Skill id, or quest id for maintenance habits. */
  ownerId: string;
  /** null when missing or unknown (the parser also emits a diagnostic). */
  type: ItemType | null;
  /** The raw bracketed type as written, e.g. "watch". */
  rawType: string | null;
  /** Inline markdown, without type/flags/time/id. */
  title: string;
  /** Parsed estimate in minutes (per occurrence for habits). */
  minutes: number | null;
  /** The time as written, e.g. "~45 min at 1.5x". */
  timeText: string | null;
  timeSensitive: boolean;
  optional: boolean;
  /** `- [x]` in source. Ignored by the app (progress lives in the DB). */
  checked: boolean;
  fields: ItemField[];
  resources: Resource[];
  // Convenience copies of well-known fields (first occurrence; null if absent).
  do: string | null;
  skip: string | null;
  doneWhen: string | null;
  ifStuck: string | null;
  fastTrack: string | null;
  verify: string | null;
  /** `As of:` override, YYYY-MM-DD. */
  asOf: string | null;
  /** Habits only: resolved cadence (explicit field → title wording → section default). */
  cadence: Cadence | null;
  line: number;
}

export interface Rank {
  /** `rank-${number}` */
  id: string;
  number: number;
  name: string | null;
  /** Rank-level blocking prerequisites (skill ids). */
  requires: string[];
  items: Item[];
  line: number;
}

export interface RecallQuestion {
  /** e.g. "q1". Empty string if missing in a bundle. */
  id: string;
  text: string;
  line: number;
}

export interface Source {
  title: string;
  url: string;
  /** Text after the link's trailing " — ", e.g. "as of 2026-09-23". */
  note: string | null;
  line: number;
}

/** A section kept verbatim (e.g. "Review log" or anything the spec doesn't define). */
export interface Section {
  heading: string;
  /** Raw markdown body. */
  body: string;
  line: number;
}

export interface Estimate {
  /** As written, e.g. "~3.5 h + optional book (~6 h)". */
  text: string;
  /** Core hours. */
  hours: number | null;
  /** Hours mentioned as optional. */
  optionalHours: number | null;
}

export const SELF_REPORTED_STATUS = "learned (self-reported)";

export interface Skill {
  /** `branch.skill-name` */
  id: string;
  branchId: string;
  /** Part after the dot. */
  slug: string;
  title: string;
  requires: string[];
  related: string[];
  /** Only "learned (self-reported)" is meaningful; kept as written. */
  status: string | null;
  estimate: Estimate | null;
  /** YYYY-MM-DD; in a bundle, inherited from the bundle if not set on the skill. */
  factsAsOf: string | null;
  why: string | null;
  /** Other paragraphs before the first rank. */
  description: string | null;
  ranks: Rank[];
  recall: RecallQuestion[];
  sources: Source[];
  reviewLog: string | null;
  sections: Section[];
  /** Unknown metadata keys, kept for display (and warned about). */
  extraMeta: Record<string, string>;
  /** Repo-relative path of the file this came from. */
  file: string;
  line: number;
}

export interface Branch {
  id: string;
  title: string;
  note: string | null;
  description: string | null;
  color: string | null;
  order: number | null;
  /** Skill ids in source order. */
  skillIds: string[];
  extraMeta: Record<string, string>;
  file: string;
  line: number;
}

export interface QuestStep {
  skillId: string;
  /** Limited to these rank numbers, e.g. [1] for "(Rank 1)"; null = whole skill. */
  ranks: number[] | null;
  /** As written in the table cell, e.g. "finance.market-intelligence (Rank 1)". */
  text: string;
}

export interface QuestStage {
  name: string;
  weekStart: number;
  /** null for open-ended stages like "13+". */
  weekEnd: number | null;
  steps: QuestStep[];
  line: number;
}

export interface Maintenance {
  /** Heading as written, e.g. "Maintenance (weekly, from week 13, ~2 h/week)". */
  heading: string;
  cadence: Cadence | null;
  fromWeek: number | null;
  hoursPerWeek: number | null;
  description: string | null;
  items: Item[];
  line: number;
}

export interface Quest {
  id: string;
  title: string;
  pace: string | null;
  weeks: number | null;
  hoursPerWeek: { min: number; max: number } | null;
  goal: string | null;
  stages: QuestStage[];
  maintenance: Maintenance | null;
  reviewLog: string | null;
  sections: Section[];
  extraMeta: Record<string, string>;
  file: string;
  line: number;
}

export interface Pack {
  id: string;
  title: string;
  /** Parsed YAML frontmatter (id, title, owner, created, facts_as_of, …). */
  frontmatter: Record<string, unknown>;
  factsAsOf: string | null;
  /** Everything that isn't a branch, skill or quest: intro, review log, sources… */
  body: string;
  file: string;
}

export type Severity = "error" | "warning";

export interface Diagnostic {
  severity: Severity;
  /** Stable code, e.g. "duplicate-id". See docs/format-spec.md §9. */
  code: string;
  message: string;
  file?: string;
  line?: number;
  skillId?: string;
  itemId?: string;
  questId?: string;
}

export interface ContentTree {
  branches: Branch[];
  skills: Skill[];
  quests: Quest[];
  packs: Pack[];
  /** Parse-level diagnostics (syntax). The validator adds rule diagnostics on top. */
  diagnostics: Diagnostic[];
  /** "tree" when loaded from content/, "bundle" when parsed from a *.skilltree.md file. */
  shape: "tree" | "bundle";
}

/** Lookup tables over a ContentTree. */
export interface ContentIndex {
  tree: ContentTree;
  skills: Record<string, Skill>;
  branches: Record<string, Branch>;
  quests: Record<string, Quest>;
  /** Every item by key (`owner/id`), including quest maintenance habits. */
  items: Record<string, Item>;
}

export function indexContent(tree: ContentTree): ContentIndex {
  const skills: Record<string, Skill> = {};
  const branches: Record<string, Branch> = {};
  const quests: Record<string, Quest> = {};
  const items: Record<string, Item> = {};
  for (const b of tree.branches) branches[b.id] = b;
  for (const s of tree.skills) {
    skills[s.id] = s;
    for (const r of s.ranks) for (const it of r.items) items[it.key] = it;
  }
  for (const q of tree.quests) {
    quests[q.id] = q;
    for (const it of q.maintenance?.items ?? []) items[it.key] = it;
  }
  return { tree, skills, branches, quests, items };
}

export function isStartingSkill(skill: Skill): boolean {
  return skill.status?.trim().toLowerCase() === SELF_REPORTED_STATUS;
}
