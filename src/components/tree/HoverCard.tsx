"use client";

// The hover/focus tooltip for an orb. Rendered in screen space (outside the
// zoomed viewport) so it stays crisp and readable at any zoom level.

import { useStore } from "@xyflow/react";
import { Flag, Hourglass, Lock, Sparkles, Star, TriangleAlert } from "lucide-react";
import { StateBadge } from "@/components/ui/Badges";
import { formatMinutesShort } from "@/components/ui/meta";
import { ProgressBar } from "@/components/ui/Progress";
import { estimateLabel, type SkillMeta } from "./model";
import type { Pt } from "./paths";

const CARD_W = 280;
const ORB_R = 38;

function Line({ icon, color, children }: { icon: React.ReactNode; color: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2 text-[12.5px] leading-snug" style={{ color }}>
      <span className="mt-[2px] shrink-0">{icon}</span>
      <span>{children}</span>
    </div>
  );
}

export function HoverCard({
  meta,
  at,
  quest,
  titleOf,
}: {
  meta: SkillMeta;
  at: Pt;
  quest: boolean;
  titleOf: (id: string) => string;
}) {
  const transform = useStore((s) => s.transform);
  const width = useStore((s) => s.width);
  const [tx, ty, zoom] = transform;
  const sx = at.x * zoom + tx;
  const sy = at.y * zoom + ty;
  const r = ORB_R * zoom;
  const above = sy - r - 16 > 230;
  const left = Math.min(Math.max(sx, CARD_W / 2 + 12), Math.max(CARD_W / 2 + 12, width - CARD_W / 2 - 12));
  const style: React.CSSProperties = above
    ? { left, top: sy - r - 14, transform: "translate(-50%, -100%)" }
    : { left, top: sy + r + 46 * zoom + 10, transform: "translate(-50%, 0)" };

  const { skill, view, color, branch } = meta;
  const pct = Math.round(view.progress * 100);
  const staleCount = view.rust.stale.length;

  return (
    <div className="pointer-events-none absolute z-30" style={style} role="tooltip">
      <div key={skill.id} className="panel animate-rise !bg-ink-900/95 px-3.5 pb-3 pt-2.5" style={{ width: CARD_W }}>
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: color, boxShadow: `0 0 8px ${color}` }} />
          <span className="hud-label min-w-0 flex-1 truncate">{branch.title}</span>
          <StateBadge state={view.state} />
        </div>
        <div className="mt-1.5 font-display text-[17px] leading-snug text-parchment">{skill.title}</div>

        <div className="mt-2.5 flex items-center gap-2.5">
          <ProgressBar value={view.progress} color={color} className="flex-1" label="Skill progress" />
          <span className="w-9 text-right font-mono text-[11px] text-parchment-dim">{pct}%</span>
        </div>
        <div className="mt-1.5 flex justify-between font-mono text-[11px] text-mist">
          <span>est. {estimateLabel(skill)}</span>
          <span>{view.minutesLogged > 0 ? `${formatMinutesShort(view.minutesLogged)} logged` : "nothing logged"}</span>
        </div>

        <div className="mt-2.5 flex flex-col gap-1.5 border-t border-ink-600/60 pt-2.5 empty:hidden">
          {view.state === "locked" && view.missingRequires.length > 0 && (
            <Line icon={<Lock className="h-3.5 w-3.5" />} color="var(--mist)">
              Needs {view.missingRequires.map(titleOf).join(", ")}
            </Line>
          )}
          {view.readyToComplete && (
            <Line icon={<Sparkles className="h-3.5 w-3.5" />} color="var(--gold-bright)">
              Ready to complete: answer Recall
            </Line>
          )}
          {view.canTestOut && !view.readyToComplete && (
            <Line icon={<Sparkles className="h-3.5 w-3.5" />} color="var(--gold)">
              Test out available · {skill.recall.length} Recall questions
            </Line>
          )}
          {view.state === "rusty" && (
            <Line icon={<TriangleAlert className="h-3.5 w-3.5" />} color="var(--rust-bright)">
              {staleCount > 0
                ? `${staleCount} fact${staleCount === 1 ? "" : "s"} past the freshness window: re-verify`
                : "Failed review: refresh it"}
            </Line>
          )}
          {!view.learned && staleCount > 0 && (
            <Line icon={<Hourglass className="h-3.5 w-3.5" />} color="var(--stale)">
              {staleCount} stale fact{staleCount === 1 ? "" : "s"} to re-check
            </Line>
          )}
          {quest && (
            <Line icon={<Flag className="h-3.5 w-3.5" />} color="var(--gold)">
              On this week&rsquo;s quest
            </Line>
          )}
          {view.starred && (
            <Line icon={<Star className="h-3.5 w-3.5 fill-current" />} color="var(--gold)">
              Starred
            </Line>
          )}
        </div>
      </div>
    </div>
  );
}
