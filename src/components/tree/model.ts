// Client-side view model for the tree page: per-skill display metadata,
// search/filter matching and the "what's next" hints shared by all three views.

import type { Branch, Item, Skill } from "@/lib/content/types";
import { LEARNED_STATES, type SkillState, type SkillView } from "@/lib/engine/types";
import type { TreeData } from "@/lib/view-model";
import { branchColor, formatMinutesShort } from "@/components/ui/meta";

export type TreeViewMode = "tree" | "list" | "focus";
export const VIEW_MODES: TreeViewMode[] = ["tree", "list", "focus"];

export function parseViewMode(value: string | null): TreeViewMode {
  return value === "list" || value === "focus" ? value : "tree";
}

export type StateFilter = "all" | "available" | "in-progress" | "learned" | "rusty" | "locked" | "starred";

export const STATE_FILTERS: { id: StateFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "available", label: "Available" },
  { id: "in-progress", label: "In progress" },
  { id: "learned", label: "Learned" },
  { id: "rusty", label: "Rusty" },
  { id: "locked", label: "Locked" },
  { id: "starred", label: "Starred" },
];

export function matchesFilter(view: SkillView, filter: StateFilter): boolean {
  switch (filter) {
    case "all":
      return true;
    case "learned":
      return LEARNED_STATES.includes(view.state);
    case "starred":
      return view.starred;
    default:
      return view.state === filter;
  }
}

export interface SkillMeta {
  skill: Skill;
  view: SkillView;
  branch: Branch;
  /** Index in data.branches: the palette slot every view uses for this branch. */
  branchIndex: number;
  color: string;
  /** Lower-cased title, id, Why and item titles, for search. */
  haystack: string;
}

export interface TreeModel {
  skills: SkillMeta[];
  byId: Map<string, SkillMeta>;
  branchColors: Map<string, string>;
  /** Branch hues by palette slot (data.branches order, plus one slot for skills without a known branch). */
  palette: string[];
  questSkillIds: Set<string>;
  questItemKeys: Set<string>;
}

const FALLBACK_BRANCH: Branch = {
  id: "",
  title: "Unsorted",
  note: null,
  description: null,
  color: null,
  order: null,
  skillIds: [],
  extraMeta: {},
  file: "",
  line: 0,
};

export function buildTreeModel(data: TreeData): TreeModel {
  const branchIndex = new Map(data.branches.map((b, i) => [b.id, i]));
  const palette = [...data.branches, FALLBACK_BRANCH].map((b, i) => branchColor(b, i));
  const branchColors = new Map(data.branches.map((b, i) => [b.id, palette[i]]));
  const skills: SkillMeta[] = [];
  for (const skill of data.skills) {
    const view = data.state.skills[skill.id];
    if (!view) continue;
    const index = branchIndex.get(skill.branchId) ?? data.branches.length;
    const branch = data.branches[index] ?? FALLBACK_BRANCH;
    const itemTitles = skill.ranks.flatMap((r) => r.items.map((it) => plainText(it.title)));
    skills.push({
      skill,
      view,
      branch,
      branchIndex: index,
      color: palette[index],
      haystack: [skill.title, skill.id, skill.why ?? "", ...itemTitles].join("\n").toLowerCase(),
    });
  }
  return {
    skills,
    byId: new Map(skills.map((s) => [s.skill.id, s])),
    branchColors,
    palette,
    questSkillIds: new Set(data.activeQuest?.thisWeekSkillIds ?? []),
    questItemKeys: new Set(data.activeQuest?.thisWeekItemKeys ?? []),
  };
}

export function matchesQuery(meta: SkillMeta, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return q.split(/\s+/).every((word) => meta.haystack.includes(word));
}

/** Markdown one-liner → plain text: typed links keep their title, emphasis and code marks go. */
export function plainText(markdown: string): string {
  return markdown
    .replace(/\[@[a-z]+@([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/[*_`]+/g, "")
    .trim();
}

export function isLearnedState(state: SkillState): boolean {
  return LEARNED_STATES.includes(state);
}

/** Incomplete required items in ranks that aren't locked, in content order. */
export function openBlockingItems(meta: SkillMeta, data: TreeData): { item: Item; rank: number }[] {
  if (meta.view.learned) return [];
  const out: { item: Item; rank: number }[] = [];
  for (const rank of meta.skill.ranks) {
    const rv = meta.view.ranks.find((r) => r.id === rank.id);
    if (rv?.locked) continue;
    for (const item of rank.items) {
      const iv = data.state.items[item.key];
      if (iv?.blocking && iv.status === "todo") out.push({ item, rank: rank.number });
    }
  }
  return out;
}

/** Compact duration for dense rows: 140 → "2h 20m", 25 → "25m", 180 → "3h". */
export function compactMinutes(minutes: number): string {
  const m = Math.round(minutes);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  const rest = m % 60;
  return rest === 0 ? `${h}h` : `${h}h ${rest}m`;
}

export function estimateLabel(skill: Skill): string {
  const est = skill.estimate;
  if (!est) return "—";
  if (est.hours != null) return `~${formatMinutesShort(est.hours * 60)}`;
  return est.text;
}

export type HintTone = "gold" | "rust" | "mist" | "parchment" | "branch";

export interface Hint {
  text: string;
  tone: HintTone;
}

/** The next thing to do with a skill, in a few words. */
export function nextActionHint(meta: SkillMeta, data: TreeData, titleOf: (id: string) => string): Hint {
  const v = meta.view;
  if (v.readyToComplete) return { text: "Ready to complete", tone: "gold" };
  if (v.state === "rusty") return { text: "Rusty — re-verify", tone: "rust" };
  if (v.state === "locked") {
    const [first, ...rest] = v.missingRequires;
    const more = rest.length > 0 ? ` +${rest.length}` : "";
    return { text: first ? `Needs ${titleOf(first)}${more}` : "Locked", tone: "mist" };
  }
  if (v.state === "in-progress") {
    const left = openBlockingItems(meta, data).length;
    return { text: left === 1 ? "1 item left" : `${left} items left`, tone: "branch" };
  }
  if (v.state === "available") {
    return v.canTestOut
      ? { text: "Test out available", tone: "parchment" }
      : { text: "Ready to start", tone: "parchment" };
  }
  if (v.state === "tested-out") return { text: "Tested out", tone: "gold" };
  if (v.state === "self-reported") return { text: "Already known", tone: "mist" };
  return { text: "Learned", tone: "gold" };
}

export const HINT_COLOR: Record<Exclude<HintTone, "branch">, string> = {
  gold: "var(--gold)",
  rust: "var(--rust-bright)",
  mist: "var(--mist)",
  parchment: "var(--parchment-dim)",
};

export function hintColor(hint: Hint, branch: string): string {
  return hint.tone === "branch" ? branch : HINT_COLOR[hint.tone];
}
