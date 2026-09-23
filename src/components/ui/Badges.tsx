import clsx from "clsx";
import { Lock, Sparkles, Star, TriangleAlert } from "lucide-react";
import type { PlanEntryType, SkillState } from "@/lib/engine/types";
import type { ItemType } from "@/lib/content/types";
import { itemTypeMeta, SKILL_STATE_META } from "./meta";

export function StateBadge({ state, className }: { state: SkillState; className?: string }) {
  const meta = SKILL_STATE_META[state];
  const Icon =
    state === "locked" ? Lock : state === "rusty" ? TriangleAlert : state === "tested-out" ? Sparkles : state === "learned" ? Star : null;
  return (
    <span
      title={meta.description}
      className={clsx(
        "inline-flex items-center gap-1 rounded-full border px-2 py-[2px] font-mono text-[10.5px] uppercase tracking-[0.1em]",
        className,
      )}
      style={{ color: meta.color, borderColor: `color-mix(in oklab, ${meta.color} 40%, transparent)` }}
    >
      {Icon && <Icon className="h-3 w-3" strokeWidth={2} />}
      {meta.label}
    </span>
  );
}

export function TypeBadge({ type, className }: { type: ItemType | PlanEntryType | null; className?: string }) {
  const meta = itemTypeMeta(type);
  const Icon = meta.icon;
  return (
    <span
      className={clsx("inline-flex items-center gap-1 font-mono text-[10.5px] uppercase tracking-[0.1em]", className)}
      style={{ color: meta.color }}
    >
      <Icon className="h-3.5 w-3.5" strokeWidth={1.9} />
      {meta.label}
    </span>
  );
}

/** Game-style rank pips: ◆◆◇ */
export function RankPips({ total, complete, color = "var(--gold)" }: { total: number; complete: number; color?: string }) {
  if (total <= 0) return null;
  return (
    <span className="inline-flex items-center gap-[3px]" aria-label={`${complete} of ${total} ranks complete`}>
      {Array.from({ length: total }, (_, i) => (
        <span
          key={i}
          className="h-[7px] w-[7px] rotate-45 rounded-[1.5px] border"
          style={
            i < complete
              ? { background: color, borderColor: color, boxShadow: `0 0 6px ${color}` }
              : { borderColor: "var(--ink-400)" }
          }
        />
      ))}
    </span>
  );
}

export function Chip({ children, className, ...rest }: React.HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1 rounded-md border border-ink-500 bg-ink-700/50 px-1.5 py-[1px] font-mono text-[11px] text-parchment-dim",
        className,
      )}
      {...rest}
    >
      {children}
    </span>
  );
}

export function StarToggleIcon({ on }: { on: boolean }) {
  return <Star className={clsx("h-4 w-4", on ? "fill-gold text-gold" : "text-mist")} strokeWidth={1.8} />;
}
