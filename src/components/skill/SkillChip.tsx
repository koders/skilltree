"use client";

import clsx from "clsx";
import { SKILL_STATE_META } from "@/components/ui/meta";
import { LEARNED_STATES } from "@/lib/engine/types";
import { usePanel } from "./context";

/** A clickable link to another skill, with a small orb in that skill's state colour. */
export function SkillChip({ skillId, className }: { skillId: string; className?: string }) {
  const { data, skillsById, onSelectSkill } = usePanel();
  const skill = skillsById.get(skillId);
  const view = data.state.skills[skillId];

  if (!skill || !view) {
    return (
      <span
        className={clsx(
          "inline-flex items-center gap-1.5 rounded-full border border-dashed border-ink-500 px-2 py-0.5 font-mono text-[11px] text-mist-dim",
          className,
        )}
        title="Not in the content tree"
      >
        {skillId}
      </span>
    );
  }

  const meta = SKILL_STATE_META[view.state];
  const lit = LEARNED_STATES.includes(view.state);
  return (
    <button
      type="button"
      onClick={() => onSelectSkill(skillId)}
      title={`${meta.label}: ${meta.description}`}
      className={clsx(
        "group inline-flex max-w-full items-center gap-1.5 rounded-full border border-ink-500 bg-ink-800/70 py-0.5 pl-1.5 pr-2.5 text-left text-[12.5px] text-parchment-dim transition-[border-color,color,background-color] hover:border-ink-400 hover:bg-ink-700 hover:text-parchment",
        className,
      )}
    >
      <span
        aria-hidden
        className="h-2 w-2 shrink-0 rounded-full border"
        style={{
          borderColor: meta.color,
          background: lit || view.state === "in-progress" ? meta.color : "transparent",
          boxShadow: lit ? `0 0 8px ${meta.color}` : undefined,
        }}
      />
      <span className="truncate">{skill.title}</span>
      <span className="sr-only">({meta.label})</span>
    </button>
  );
}
