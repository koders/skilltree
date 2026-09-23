"use client";

import { createContext, useContext } from "react";
import type { Item, Skill } from "@/lib/content/types";
import type { SkillView } from "@/lib/engine/types";
import type { TreeData } from "@/lib/view-model";

export type RecallMode = "test-out" | "complete";

/** What every section of an open skill panel needs; provided once by the panel body. */
export interface PanelContextValue {
  data: TreeData;
  skill: Skill;
  view: SkillView;
  /** The skill's branch hue. */
  color: string;
  skillsById: Map<string, Skill>;
  /** The skill's items by local id. */
  itemsById: Map<string, Item>;
  onSelectSkill: (skillId: string) => void;
  openRecall: (mode: RecallMode) => void;
}

export const PanelContext = createContext<PanelContextValue | null>(null);

export function usePanel(): PanelContextValue {
  const ctx = useContext(PanelContext);
  if (!ctx) throw new Error("usePanel() outside a SkillPanel");
  return ctx;
}
