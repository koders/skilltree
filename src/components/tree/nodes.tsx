"use client";

// React Flow node types for the constellation canvas: the player hub, skill
// orbs, branch titles and the astrolabe backdrop. Node types are memoised and
// registered at module scope (see SkillCanvas).

import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";
import clsx from "clsx";
import { Flag, Hourglass, Sparkles, Star, TriangleAlert } from "lucide-react";
import { memo } from "react";
import { RankPips } from "@/components/ui/Badges";
import { SKILL_STATE_META } from "@/components/ui/meta";
import type { SkillState } from "@/lib/engine/types";
import { useCanvasActions } from "./canvas-context";
import { HUB_SIZE, NODE_SIZE, ROMAN } from "./graph";
import type { SkillMeta } from "./model";
import { OrbArt } from "./Orb";
import { arcPath, wedgePath, type Pt } from "./paths";

// ---------------------------------------------------------------- skill orb

export type SkillNodeData = {
  meta: SkillMeta;
  selected: boolean;
  dimmed: boolean;
  /** Passes an active search/filter: gets a marker ring so hits stand out. */
  matched: boolean;
  quest: boolean;
  depth: number;
};
export type SkillFlowNode = Node<SkillNodeData, "skill">;

function aura(state: SkillState, color: string): { background: string; opacity: number } | null {
  switch (state) {
    case "available":
      return { background: `radial-gradient(circle, ${color} 0%, transparent 62%)`, opacity: 0.32 };
    case "in-progress":
      return { background: `radial-gradient(circle, ${color} 0%, transparent 60%)`, opacity: 0.4 };
    case "learned":
    case "tested-out":
      return { background: `radial-gradient(circle, ${color} 0%, var(--gold) 30%, transparent 62%)`, opacity: 0.3 };
    case "self-reported":
      return { background: `radial-gradient(circle, ${color} 0%, transparent 58%)`, opacity: 0.14 };
    case "rusty":
      return { background: "radial-gradient(circle, var(--rust) 0%, transparent 60%)", opacity: 0.35 };
    default:
      return null;
  }
}

function Badge({ className, children, title }: { className: string; children: React.ReactNode; title: string }) {
  return (
    <span
      title={title}
      className={clsx(
        "pointer-events-none absolute grid h-[20px] w-[20px] place-items-center rounded-full border shadow-[0_0_10px_rgba(0,0,0,0.6)]",
        className,
      )}
    >
      {children}
    </span>
  );
}

export const SkillNode = memo(function SkillNode({ data }: NodeProps<SkillFlowNode>) {
  const { select, hover, reveal } = useCanvasActions();
  const { meta, selected, dimmed, matched, quest, depth } = data;
  const { skill, view, color } = meta;
  const state = view.state;
  const glow = aura(state, color);
  const stale = !view.learned && view.rust.stale.length > 0;
  const stateLabel = SKILL_STATE_META[state].label;
  const pct = Math.round(view.progress * 100);
  const locked = state === "locked";

  return (
    <div
      className="st-node relative"
      style={{ width: NODE_SIZE, height: NODE_SIZE }}
      data-selected={selected}
      data-dimmed={dimmed}
      data-state={state}
    >
      <Handle type="target" position={Position.Top} isConnectable={false} className="st-handle" />
      <Handle type="source" position={Position.Bottom} isConnectable={false} className="st-handle" />

      <div className="st-appear absolute inset-0" style={{ animationDelay: `${160 + depth * 110}ms` }}>
        {glow && <div className="pointer-events-none absolute -inset-6 rounded-full" style={glow} />}
        {state === "available" && (
          <div
            className="animate-glow-pulse pointer-events-none absolute inset-[3px] rounded-full"
            style={{
              border: `1px solid color-mix(in oklab, ${color} 60%, transparent)`,
              boxShadow: `0 0 26px 1px color-mix(in oklab, ${color} 70%, transparent), inset 0 0 14px color-mix(in oklab, ${color} 45%, transparent)`,
            }}
          />
        )}
        {matched && !selected && (
          <span className="pointer-events-none absolute -inset-[7px] rounded-full border border-dashed border-parchment/55 shadow-[0_0_18px_rgba(236,230,214,0.18)]" />
        )}
        {selected && (
          <svg
            viewBox="0 0 96 96"
            className="pointer-events-none absolute -inset-[10px] h-[96px] w-[96px] overflow-visible"
            aria-hidden
          >
            <circle cx="48" cy="48" r="40" fill="none" stroke="var(--gold-bright)" strokeWidth="2" />
            <circle cx="48" cy="48" r="40" fill="none" stroke="var(--gold)" strokeOpacity="0.35" strokeWidth="9" />
            <g className="st-spin">
              <circle
                cx="48"
                cy="48"
                r="46"
                fill="none"
                stroke="var(--gold)"
                strokeWidth="1.2"
                strokeDasharray="10 8.06"
                strokeLinecap="round"
              />
            </g>
          </svg>
        )}

        <button
          type="button"
          aria-label={`${skill.title}: ${stateLabel}${state === "in-progress" ? `, ${pct}%` : ""}`}
          aria-pressed={selected}
          onClick={() => select(skill.id)}
          onPointerEnter={() => hover(skill.id)}
          onPointerLeave={() => hover(null)}
          onFocus={(e) => {
            if (!e.currentTarget.matches(":focus-visible")) return;
            hover(skill.id);
            reveal(skill.id);
          }}
          onBlur={() => hover(null)}
          className={clsx(
            "pointer-events-auto absolute inset-[6px] cursor-pointer rounded-full transition-transform duration-200 ease-out",
            "hover:scale-[1.09] active:scale-[0.96]",
            "focus-visible:!rounded-full focus-visible:!outline-none focus-visible:shadow-[0_0_0_3px_var(--ink-950),0_0_0_5px_var(--gold)]",
            locked && "opacity-80 saturate-50",
          )}
        >
          <OrbArt state={state} color={color} slot={meta.branchIndex} progress={view.progress} size={64} />
        </button>

        {view.readyToComplete && (
          <span
            className="st-bob pointer-events-none absolute -top-[22px] left-1/2 grid h-[20px] w-[20px] place-items-center"
            title="Ready to complete: answer Recall"
          >
            <span className="absolute inset-[2px] rotate-45 rounded-[3px] bg-gold shadow-[0_0_16px_var(--gold)]" />
            <span className="relative font-display text-[13px] font-bold leading-none text-ink-950">!</span>
          </span>
        )}
        {view.starred && (
          <Badge className="-left-[2px] -top-[2px] border-gold/60 bg-ink-900" title="Starred">
            <Star className="h-[11px] w-[11px] fill-gold text-gold" strokeWidth={1.5} />
          </Badge>
        )}
        {state === "tested-out" && (
          <Badge className="-right-[2px] -top-[2px] border-gold/60 bg-ink-900" title="Tested out">
            <Sparkles className="h-[11px] w-[11px] text-gold-bright" strokeWidth={2} />
          </Badge>
        )}
        {state === "rusty" && (
          <Badge className="-right-[2px] -top-[2px] border-rust/70 bg-ink-900" title="Rusty: re-verify">
            <TriangleAlert className="h-[11px] w-[11px] text-rust-bright" strokeWidth={2.2} />
          </Badge>
        )}
        {quest && (
          <Badge className="-bottom-[2px] -right-[2px] border-gold-bright bg-gold" title="On this week's quest">
            <Flag className="h-[11px] w-[11px] fill-ink-900 text-ink-900" strokeWidth={2} />
          </Badge>
        )}
        {stale && (
          <Badge className="-bottom-[2px] -left-[2px] border-stale/70 bg-ink-900" title="Has facts past their freshness window">
            <Hourglass className="h-[11px] w-[11px] text-stale" strokeWidth={2} />
          </Badge>
        )}

        <div
          className="st-label absolute left-1/2 top-[80px] flex w-[128px] -translate-x-1/2 cursor-pointer flex-col items-center gap-[5px]"
          onClick={() => select(skill.id)}
        >
          {view.ranks.length > 1 && (
            <RankPips total={view.ranks.length} complete={view.ranksComplete} />
          )}
          <span
            className={clsx(
              // The plate hides edges running behind the name.
              "line-clamp-2 rounded-md bg-ink-950/75 px-1.5 py-[1px] text-center text-[12px] font-medium leading-[1.3] shadow-[0_0_10px_4px_rgba(5,8,15,0.55)]",
              locked ? "text-mist" : state === "self-reported" ? "text-parchment-dim" : "text-parchment",
              selected && "!text-gold-bright",
            )}
          >
            {skill.title}
          </span>
        </div>
      </div>
    </div>
  );
});

// ---------------------------------------------------------------- hub

export type HubNodeData = { level: number; progress: number; total: number; nextLevelAt: number };
export type HubFlowNode = Node<HubNodeData, "hub">;

export const HubNode = memo(function HubNode({ data }: NodeProps<HubFlowNode>) {
  const r = 62;
  const c = 2 * Math.PI * r;
  const half = HUB_SIZE / 2;
  return (
    <div className="pointer-events-none relative select-none" style={{ width: HUB_SIZE, height: HUB_SIZE }}>
      <div
        className="st-breathe absolute -inset-16 rounded-full"
        style={{ background: "radial-gradient(circle, rgba(233,196,106,0.35) 0%, rgba(233,196,106,0.08) 40%, transparent 68%)" }}
      />
      <svg viewBox={`0 0 ${HUB_SIZE} ${HUB_SIZE}`} className="absolute inset-0 overflow-visible" aria-hidden>
        <g className="st-spin-slow">
          <circle cx={half} cy={half} r={71} fill="none" stroke="var(--gold)" strokeOpacity={0.4} strokeWidth={1} strokeDasharray="1 5.2" />
        </g>
        <circle cx={half} cy={half} r={r} fill="rgba(5,8,15,0.75)" stroke="var(--ink-600)" strokeWidth={5} />
        <circle
          cx={half}
          cy={half}
          r={r}
          fill="none"
          stroke="var(--gold)"
          strokeWidth={5}
          strokeLinecap="round"
          strokeDasharray={`${Math.max(0.005, data.progress) * c} ${c}`}
          transform={`rotate(-90 ${half} ${half})`}
          style={{ filter: "drop-shadow(0 0 5px var(--gold))" }}
        />
        <circle cx={half} cy={half} r={52} fill="url(#st-hub-core)" />
        <circle cx={half} cy={half} r={52} fill="url(#st-sheen)" opacity={0.7} />
        <circle cx={half} cy={half} r={47} fill="none" stroke="#fff8e0" strokeOpacity={0.45} strokeWidth={0.8} />
        <circle cx={half} cy={half} r={52} fill="none" stroke="var(--gold-deep)" strokeWidth={1.2} />
      </svg>
      <div className="absolute inset-0 grid place-items-center">
        <div className="flex flex-col items-center">
          <span className="font-mono text-[9px] font-semibold tracking-[0.32em] text-ink-900/70">LEVEL</span>
          <span
            className="font-display text-[44px] font-semibold leading-[0.95] text-ink-950"
            style={{ textShadow: "0 1px 0 rgba(255,248,224,0.6)" }}
          >
            {data.level}
          </span>
        </div>
      </div>
      <div className="absolute left-1/2 top-full mt-3 -translate-x-1/2 whitespace-nowrap rounded-full border border-gold/25 bg-ink-950/85 px-2.5 py-0.5 font-mono text-[11px] tracking-[0.08em] text-gold/90">
        {Math.round(data.total).toLocaleString("en")} <span className="text-mist">/ {data.nextLevelAt.toLocaleString("en")} XP</span>
      </div>
    </div>
  );
});

// ---------------------------------------------------------------- branch title

export const BRANCH_LABEL_W = 820;
export const BRANCH_LABEL_H = 120;

export type BranchLabelData = {
  title: string;
  color: string;
  learned: number;
  total: number;
  dimmed: boolean;
  /** Which way the title runs from its anchor, so it grows away from the tree. */
  align: "start" | "center" | "end";
};
export type BranchLabelFlowNode = Node<BranchLabelData, "branchLabel">;

export const BranchLabelNode = memo(function BranchLabelNode({ data }: NodeProps<BranchLabelFlowNode>) {
  const items = data.align === "start" ? "items-start text-left" : data.align === "end" ? "items-end text-right" : "items-center text-center";
  const rule = (dir: string) => ({ background: `linear-gradient(${dir}, transparent, ${data.color})` });
  return (
    <div
      className={clsx("pointer-events-none flex select-none flex-col justify-center transition-opacity duration-300", items)}
      style={{ width: BRANCH_LABEL_W, height: BRANCH_LABEL_H, opacity: data.dimmed ? 0.3 : 1 }}
    >
      <div
        className="whitespace-nowrap font-display font-light uppercase leading-none"
        style={{
          fontSize: 44,
          letterSpacing: "0.2em",
          color: `color-mix(in oklab, ${data.color} 55%, var(--parchment))`,
          opacity: 0.66,
          textShadow: `0 0 30px color-mix(in oklab, ${data.color} 50%, transparent)`,
        }}
      >
        {data.title}
      </div>
      <div className="mt-3 flex items-center gap-4 font-mono text-[15px] uppercase tracking-[0.28em]" style={{ color: data.color }}>
        {data.align !== "start" && <span className="h-px w-24" style={rule("90deg")} />}
        <span className="opacity-85">
          {data.learned}
          <span className="text-mist"> / {data.total} learned</span>
        </span>
        {data.align !== "end" && <span className="h-px w-24" style={rule("270deg")} />}
      </div>
    </div>
  );
});

// ---------------------------------------------------------------- astrolabe backdrop

export interface SkySector {
  id: string;
  start: number;
  end: number;
  mid: number;
  outer: number;
  outerDepth: number;
  color: string;
}

export interface SkyRay {
  target: string;
  d: string;
  from: Pt;
  to: Pt;
  color: string;
  lit: boolean;
  /** Target fails the current search/filter. */
  faded: boolean;
}

export type SkyData = {
  size: number;
  rings: number[];
  ringGap: number;
  sectors: SkySector[];
  rays: SkyRay[];
  rim: number;
  gapAngle: number;
};
export type SkyFlowNode = Node<SkyData, "sky">;

function polarPt(angle: number, radius: number): Pt {
  return { x: radius * Math.sin(angle), y: -radius * Math.cos(angle) };
}

function ticks(radius: number, every: number, major: number, len: number, majorLen: number): string {
  let d = "";
  for (let deg = 0; deg < 360; deg += every) {
    const a = (deg * Math.PI) / 180;
    const l = deg % major === 0 ? majorLen : len;
    const p = polarPt(a, radius);
    const q = polarPt(a, radius + l);
    d += `M${p.x.toFixed(1)} ${p.y.toFixed(1)}L${q.x.toFixed(1)} ${q.y.toFixed(1)}`;
  }
  return d;
}

export const SkyNode = memo(function SkyNode({ data }: NodeProps<SkyFlowNode>) {
  const { size, rings, sectors, rays, rim, gapAngle, ringGap } = data;
  const half = size / 2;
  const inner = (rings[0] ?? 240) - ringGap * 0.6;
  const degrees = Array.from({ length: 12 }, (_, i) => i * 30);
  return (
    <svg
      width={size}
      height={size}
      viewBox={`${-half} ${-half} ${size} ${size}`}
      className="pointer-events-none select-none overflow-visible"
      aria-hidden
    >
      <defs>
        {sectors.map((s) => (
          <radialGradient key={s.id} id={`st-neb-${s.id}`}>
            <stop offset="0%" stopColor={s.color} stopOpacity="0.15" />
            <stop offset="55%" stopColor={s.color} stopOpacity="0.055" />
            <stop offset="100%" stopColor={s.color} stopOpacity="0" />
          </radialGradient>
        ))}
        {rays.map((r) => (
          <linearGradient
            key={r.target}
            id={`st-ray-${r.target.replace(/[^\w-]/g, "_")}`}
            gradientUnits="userSpaceOnUse"
            x1={r.from.x}
            y1={r.from.y}
            x2={r.to.x}
            y2={r.to.y}
          >
            <stop offset="0%" stopColor="var(--gold)" />
            <stop offset="100%" stopColor={r.color} />
          </linearGradient>
        ))}
      </defs>

      {/* nebulae: a soft wash of each branch's hue over its sector */}
      {sectors.map((s) => {
        const c = polarPt(s.mid, ((rings[0] ?? 240) + s.outer) / 2);
        return (
          <circle
            key={`neb-${s.id}`}
            cx={c.x}
            cy={c.y}
            r={(s.outer - (rings[0] ?? 240)) / 2 + ringGap * 1.6}
            fill={`url(#st-neb-${s.id})`}
          />
        );
      })}

      {/* sector wedges and their engraved borders */}
      {sectors.map((s) => {
        const outer = s.outer + ringGap * 0.55;
        const a = polarPt(s.start, inner);
        const b = polarPt(s.start, outer);
        const c = polarPt(s.end, inner);
        const d = polarPt(s.end, outer);
        return (
          <g key={`wedge-${s.id}`}>
            <path d={wedgePath(inner, outer, s.start, s.end)} fill={s.color} fillOpacity={0.022} />
            <path
              d={`M${a.x} ${a.y}L${b.x} ${b.y}M${c.x} ${c.y}L${d.x} ${d.y}`}
              stroke={s.color}
              strokeOpacity={0.2}
              strokeWidth={1}
              strokeDasharray="2 7"
            />
            <path d={arcPath(outer, s.start, s.end)} fill="none" stroke={s.color} strokeOpacity={0.14} strokeWidth={1} />
          </g>
        );
      })}

      {/* depth rings: faint all round, tinted where a branch reaches */}
      {rings.map((r, depth) => (
        <g key={`ring-${depth}`}>
          <circle r={r} fill="none" stroke="var(--ink-400)" strokeOpacity={0.28} strokeWidth={1} strokeDasharray="1 7" />
          {sectors
            .filter((s) => s.outerDepth >= depth)
            .map((s) => (
              <path
                key={s.id}
                d={arcPath(r, s.start, s.end)}
                fill="none"
                stroke={s.color}
                strokeOpacity={0.16}
                strokeWidth={1.2}
              />
            ))}
        </g>
      ))}

      {/* tier numerals in the widest gap between sectors */}
      {rings.map((r, depth) => {
        const p = polarPt(gapAngle, r);
        return (
          <g key={`tier-${depth}`} transform={`translate(${p.x.toFixed(1)} ${p.y.toFixed(1)})`}>
            <circle r={15} fill="var(--ink-950)" stroke="var(--ink-500)" strokeOpacity={0.7} strokeWidth={1} />
            <text
              textAnchor="middle"
              dominantBaseline="central"
              fontFamily="var(--font-display)"
              fontSize={13}
              fill="var(--mist)"
              letterSpacing="0.05em"
            >
              {ROMAN[depth] ?? depth + 1}
            </text>
          </g>
        );
      })}

      {/* compass rose around the player */}
      <g className="st-spin-slow">
        <circle r={100} fill="none" stroke="var(--gold)" strokeOpacity={0.16} strokeWidth={1} />
        <path d={ticks(100, 5, 45, 5, 13)} stroke="var(--gold)" strokeOpacity={0.3} strokeWidth={1} />
      </g>

      {/* the astrolabe rim */}
      <circle r={rim} fill="none" stroke="var(--ink-400)" strokeOpacity={0.45} strokeWidth={1.2} />
      <circle r={rim + 22} fill="none" stroke="var(--ink-400)" strokeOpacity={0.25} strokeWidth={1} />
      <path d={ticks(rim, 2, 10, 6, 14)} stroke="var(--ink-400)" strokeOpacity={0.45} strokeWidth={1} />
      {degrees.map((deg) => {
        const p = polarPt((deg * Math.PI) / 180, rim + 44);
        return (
          <text
            key={deg}
            x={p.x}
            y={p.y}
            textAnchor="middle"
            dominantBaseline="central"
            fontFamily="var(--font-mono)"
            fontSize={16}
            letterSpacing="0.1em"
            fill="var(--mist-dim)"
          >
            {String(deg).padStart(3, "0")}
          </text>
        );
      })}

      {/* rays from the player to the first skills of every branch */}
      {rays.map((r) => (
        <path
          key={r.target}
          d={r.d}
          fill="none"
          stroke={`url(#st-ray-${r.target.replace(/[^\w-]/g, "_")})`}
          strokeOpacity={(r.lit ? 0.75 : 0.28) * (r.faded ? 0.2 : 1)}
          strokeWidth={r.lit ? 1.8 : 1.2}
          strokeDasharray={r.lit ? undefined : "3 6"}
          strokeLinecap="round"
        />
      ))}
    </svg>
  );
});
