"use client";

// STUB — replaced by the panel implementation. The props are the contract.

import type { TreeData } from "@/lib/view-model";

export interface SkillPanelProps {
  skillId: string;
  data: TreeData;
  onClose: () => void;
  /** Navigate to another skill (prerequisite chips, related links). */
  onSelectSkill: (skillId: string) => void;
}

export function SkillPanel({ skillId, onClose }: SkillPanelProps) {
  return (
    <aside className="panel fixed right-3 top-[calc(var(--topbar-h)+12px)] bottom-3 z-30 w-[min(460px,calc(100vw-24px))] p-5">
      <button onClick={onClose}>Close</button>
      <p className="mt-4 font-mono text-sm">{skillId}</p>
    </aside>
  );
}
