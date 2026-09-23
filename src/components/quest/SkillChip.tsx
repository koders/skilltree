import clsx from "clsx";
import { Check } from "lucide-react";
import Link from "next/link";
import { SKILL_STATE_META } from "@/components/ui/meta";
import type { SkillRef } from "./context";

/**
 * A skill as a small link chip that opens the tree's side panel. `hue`
 * picks the dot colour: the skill's branch, or its node state.
 */
export function SkillChip({
  skill,
  hue = "branch",
  suffix,
  complete,
  wrap,
  className,
}: {
  skill: SkillRef;
  hue?: "branch" | "state";
  suffix?: string;
  complete?: boolean;
  /** Let a long title wrap instead of truncating (narrow cards). */
  wrap?: boolean;
  className?: string;
}) {
  const color = hue === "state" ? SKILL_STATE_META[skill.state].color : skill.color;
  const lit = hue === "branch" || skill.state !== "locked";
  return (
    <Link
      href={`/?skill=${encodeURIComponent(skill.id)}`}
      title={`${skill.title} · ${SKILL_STATE_META[skill.state].label} — open in the tree`}
      className={clsx(
        "group/skill inline-flex min-w-0 max-w-full gap-1.5 rounded-md border px-1.5 py-[2px] text-[12px] leading-tight transition-colors",
        wrap ? "items-start py-[3px] [&>span:first-child]:mt-[4px] [&>svg]:mt-[2px] [&>span:nth-child(3)]:pt-[1px]" : "items-center",
        complete
          ? "border-gold/35 bg-gold/[0.06] text-parchment hover:border-gold/70"
          : "border-ink-500/80 bg-ink-800/60 text-parchment-dim hover:border-ink-400 hover:bg-ink-700/70 hover:text-parchment",
        className,
      )}
    >
      <span
        aria-hidden
        className="h-[7px] w-[7px] shrink-0 rotate-45 rounded-[1.5px]"
        style={
          lit
            ? { background: color, boxShadow: `0 0 6px color-mix(in oklab, ${color} 70%, transparent)` }
            : { border: `1px solid ${color}` }
        }
      />
      <span className={wrap ? "min-w-0" : "truncate"}>{skill.title}</span>
      {suffix ? <span className="shrink-0 font-mono text-[10.5px] text-mist">{suffix}</span> : null}
      {complete ? <Check aria-label="complete" className="h-3 w-3 shrink-0 text-gold" strokeWidth={2.5} /> : null}
    </Link>
  );
}
