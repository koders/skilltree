"use client";

// Bottom-left key for the canvas: what each orb and badge means, and how far
// along each branch is. Open by default on wide screens, folded on phones.

import clsx from "clsx";
import { ChevronDown, Flag, Hourglass, Star } from "lucide-react";
import { useState, useSyncExternalStore } from "react";
import { ProgressBar } from "@/components/ui/Progress";
import { SKILL_STATE_META } from "@/components/ui/meta";
import type { SkillState } from "@/lib/engine/types";
import type { TreeData } from "@/lib/view-model";
import { NEUTRAL_ORB, OrbArt } from "./Orb";

const WIDE = "(min-width: 640px)";

function subscribeWide(onChange: () => void) {
  const query = window.matchMedia(WIDE);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

const STATES: SkillState[] = ["locked", "available", "in-progress", "learned", "tested-out", "self-reported", "rusty"];

export function Legend({
  data,
  palette,
  neutralSlot,
  fold,
  className,
}: {
  data: TreeData;
  palette: string[];
  neutralSlot: number;
  /** Fold out of the way (e.g. while the side panel is open) unless the user opened it. */
  fold: boolean;
  className?: string;
}) {
  // null = automatic (open on sm+, folded on phones or when `fold`) until toggled.
  const [choice, setChoice] = useState<boolean | null>(null);
  const open = choice ?? (fold ? false : null);
  // The automatic state is drawn with CSS breakpoints (no hydration flash); this only tells assistive tech.
  const wide = useSyncExternalStore(subscribeWide, () => window.matchMedia(WIDE).matches, () => null);
  const toggle = () => setChoice(!(open ?? window.matchMedia(WIDE).matches));

  return (
    <div className={clsx("panel w-[272px] max-w-[calc(100vw-24px)] overflow-hidden", className)}>
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open ?? wide ?? undefined}
        aria-controls="tree-legend"
        className="flex w-full items-center gap-2 px-3 py-2 text-left"
      >
        <span className="hud-label flex-1">Legend</span>
        <span className="flex items-center gap-1" aria-hidden>
          {data.branches.map((b, i) => (
            <span key={b.id} className="h-1.5 w-1.5 rounded-full" style={{ background: palette[i] }} />
          ))}
        </span>
        <ChevronDown
          className={clsx(
            "h-3.5 w-3.5 text-mist transition-transform duration-200",
            open === null ? "rotate-180 max-sm:rotate-0" : open ? "rotate-180" : "rotate-0",
          )}
        />
      </button>

      <div
        id="tree-legend"
        className={clsx("border-t border-ink-600/60 px-3 pb-3 pt-2.5", open === null ? "hidden sm:block" : open ? "block" : "hidden")}
      >
        <ul className="grid grid-cols-2 gap-x-3 gap-y-1.5">
          {STATES.map((s) => (
            <li key={s} className="flex items-center gap-2 text-[12px] text-parchment-dim" title={SKILL_STATE_META[s].description}>
              <OrbArt state={s} color={NEUTRAL_ORB} slot={neutralSlot} progress={0.6} size={15} />
              {SKILL_STATE_META[s].label}
            </li>
          ))}
        </ul>
        <ul className="mt-2.5 flex flex-wrap gap-x-3 gap-y-1.5 text-[11.5px] text-mist">
          <li className="flex items-center gap-1.5">
            <Star className="h-3 w-3 fill-gold text-gold" strokeWidth={1.5} /> Starred
          </li>
          <li className="flex items-center gap-1.5">
            <span className="grid h-3.5 w-3.5 place-items-center rounded-full bg-gold">
              <Flag className="h-2 w-2 fill-ink-900 text-ink-900" strokeWidth={2.5} />
            </span>
            This week
          </li>
          <li className="flex items-center gap-1.5">
            <span className="grid h-3.5 w-3.5 place-items-center">
              <span className="h-2.5 w-2.5 rotate-45 rounded-[2px] bg-gold shadow-[0_0_6px_var(--gold)]" />
            </span>
            Ready
          </li>
          <li className="flex items-center gap-1.5">
            <Hourglass className="h-3 w-3 text-stale" strokeWidth={2} /> Stale facts
          </li>
        </ul>

        <div className="mt-3 border-t border-ink-600/60 pt-2.5">
          <div className="hud-label mb-2">Branches</div>
          <ul className="flex flex-col gap-2">
            {data.branches.map((b, i) => {
              const stats = data.state.branches[b.id];
              const color = palette[i];
              return (
                <li key={b.id}>
                  <div className="flex items-center gap-2 text-[12px]">
                    <span className="h-2 w-2 rounded-full" style={{ background: color, boxShadow: `0 0 6px ${color}` }} />
                    <span className="min-w-0 flex-1 truncate text-parchment-dim">{b.title}</span>
                    <span className="font-mono text-[11px] tabular-nums text-mist">
                      <span className="text-parchment">{stats?.learned ?? 0}</span>/{stats?.total ?? 0}
                    </span>
                  </div>
                  <ProgressBar value={stats?.progress ?? 0} color={color} className="mt-1 !h-1" label={`${b.title} progress`} />
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </div>
  );
}
