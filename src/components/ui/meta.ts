// Display metadata shared by every view: colours, labels and icons for item
// types, resource types and skill states. Keep in sync with globals.css.

import {
  BookOpen,
  Compass,
  FileText,
  GraduationCap,
  Hammer,
  Hand,
  Library,
  Mic,
  Newspaper,
  CirclePlay,
  Repeat,
  Rss,
  ScrollText,
  Search,
  Brain,
  GitBranch,
  Wrench,
  Landmark,
  type LucideIcon,
} from "lucide-react";
import type { ItemType } from "@/lib/content/types";
import type { PlanEntryType, SkillState } from "@/lib/engine/types";

export const ITEM_TYPE_META: Record<PlanEntryType, { label: string; color: string; icon: LucideIcon; verb: string }> = {
  watch: { label: "Watch", color: "var(--type-watch)", icon: CirclePlay, verb: "Watched" },
  read: { label: "Read", color: "var(--type-read)", icon: BookOpen, verb: "Read" },
  do: { label: "Do", color: "var(--type-do)", icon: Hand, verb: "Done" },
  build: { label: "Build", color: "var(--type-build)", icon: Hammer, verb: "Built" },
  output: { label: "Output", color: "var(--type-output)", icon: ScrollText, verb: "Written" },
  habit: { label: "Habit", color: "var(--type-habit)", icon: Repeat, verb: "Done" },
  recall: { label: "Recall", color: "var(--type-recall)", icon: Brain, verb: "Answered" },
};

export function itemTypeMeta(type: ItemType | PlanEntryType | null) {
  return type ? ITEM_TYPE_META[type] : { label: "Item", color: "var(--mist)", icon: FileText, verb: "Done" };
}

export const RESOURCE_TYPE_META: Record<string, { label: string; icon: LucideIcon }> = {
  video: { label: "Video", icon: CirclePlay },
  search: { label: "Search", icon: Search },
  course: { label: "Course", icon: GraduationCap },
  official: { label: "Official", icon: Landmark },
  article: { label: "Article", icon: Newspaper },
  book: { label: "Book", icon: Library },
  podcast: { label: "Podcast", icon: Mic },
  tool: { label: "Tool", icon: Wrench },
  opensource: { label: "Repo", icon: GitBranch },
  feed: { label: "Feed", icon: Rss },
};

export function resourceTypeMeta(type: string) {
  return RESOURCE_TYPE_META[type] ?? { label: type, icon: Compass };
}

export const SKILL_STATE_META: Record<SkillState, { label: string; color: string; description: string }> = {
  locked: { label: "Locked", color: "var(--ink-400)", description: "Prerequisites not learned yet" },
  available: { label: "Available", color: "var(--parchment)", description: "Ready to start or test out" },
  "in-progress": { label: "In progress", color: "var(--gold)", description: "Working through its items" },
  learned: { label: "Learned", color: "var(--gold-bright)", description: "Items done and Recall answered" },
  "tested-out": { label: "Tested out", color: "var(--gold-bright)", description: "Recall answered before starting" },
  "self-reported": { label: "Self-reported", color: "var(--parchment-dim)", description: "Something I already knew" },
  rusty: { label: "Rusty", color: "var(--rust-bright)", description: "Facts past their freshness window, or a failed review" },
};

/** Default branch hues by position; a branch's `color` in content overrides. */
export const BRANCH_PALETTE = [
  "#5ec8f2",
  "#56d39b",
  "#b69cff",
  "#f28f6b",
  "#f2c14e",
  "#ff7eb6",
  "#7ee0d0",
  "#9fb4ff",
];

export function branchColor(branch: { color: string | null }, index: number): string {
  return branch.color ?? BRANCH_PALETTE[index % BRANCH_PALETTE.length];
}

export function formatMinutesShort(minutes: number | null | undefined): string {
  if (minutes == null) return "—";
  if (minutes < 60) return `${Math.round(minutes)} min`;
  const h = minutes / 60;
  if (Number.isInteger(h)) return `${h} h`;
  const whole = Math.floor(h);
  const rest = Math.round(minutes - whole * 60);
  return rest === 30 ? `${whole}.5 h` : `${whole} h ${rest} min`;
}
