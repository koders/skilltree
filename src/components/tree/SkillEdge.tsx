"use client";

// Prerequisite links. Paths are precomputed (graph.ts); this only styles them:
// powered when the prerequisite is learned, flowing when it opens an
// available skill, gradient + dashed across branches, dotted for rank-only.

import type { Edge, EdgeProps } from "@xyflow/react";
import { memo } from "react";
import type { Pt } from "./paths";

export type SkillEdgeData = {
  d: string;
  from: Pt;
  to: Pt;
  mid: Pt;
  sourceColor: string;
  targetColor: string;
  crossBranch: boolean;
  kind: "requires" | "rank-requires";
  rankLabel: string | null;
  /** The prerequisite is learned. */
  powered: boolean;
  /** Powered and leads into a skill that's available now. */
  unlock: boolean;
  /** Fails the current search/filter. */
  faded: boolean;
  /** Touches the hovered or selected skill. */
  highlight: boolean;
};
export type SkillFlowEdge = Edge<SkillEdgeData, "skill">;

export const SkillEdge = memo(function SkillEdge({ id, data }: EdgeProps<SkillFlowEdge>) {
  if (!data) return null;
  const { d, from, to, mid, sourceColor, targetColor, crossBranch, kind, rankLabel, powered, unlock, faded, highlight } = data;
  const gradId = `st-eg-${id.replace(/[^\w-]/g, "_")}`;
  const stroke = crossBranch ? `url(#${gradId})` : sourceColor;
  const dash = kind === "rank-requires" ? "0.1 7" : crossBranch ? "8 6" : undefined;
  const lit = powered || highlight;
  const coreWidth = kind === "rank-requires" ? (lit ? 3.2 : 2.6) : powered ? 2.2 : highlight ? 1.8 : 1.3;
  const coreOpacity = powered ? 0.95 : highlight ? 0.8 : 0.34;

  return (
    <g style={{ opacity: faded ? 0.12 : 1, transition: "opacity 260ms ease" }}>
      {crossBranch && (
        <defs>
          <linearGradient id={gradId} gradientUnits="userSpaceOnUse" x1={from.x} y1={from.y} x2={to.x} y2={to.y}>
            <stop offset="0%" stopColor={sourceColor} />
            <stop offset="100%" stopColor={targetColor} />
          </linearGradient>
        </defs>
      )}
      {lit && (
        <path
          d={d}
          fill="none"
          stroke={stroke}
          strokeOpacity={powered ? 0.16 : 0.1}
          strokeWidth={powered ? 9 : 7}
          strokeLinecap="round"
        />
      )}
      <path
        d={d}
        fill="none"
        stroke={stroke}
        strokeOpacity={coreOpacity}
        strokeWidth={coreWidth}
        strokeDasharray={dash}
        strokeLinecap="round"
      />
      {unlock && (
        <path
          d={d}
          className="st-flow"
          fill="none"
          stroke={`color-mix(in oklab, ${targetColor} 45%, white)`}
          strokeWidth={3}
          strokeDasharray="1.5 32.5"
          strokeLinecap="round"
          style={{ filter: `drop-shadow(0 0 4px ${targetColor})` }}
        />
      )}
      {rankLabel && (
        <g transform={`translate(${mid.x.toFixed(1)} ${mid.y.toFixed(1)})`}>
          <rect
            x={-15}
            y={-9}
            width={30}
            height={18}
            rx={9}
            fill="var(--ink-950)"
            stroke={targetColor}
            strokeOpacity={lit ? 0.8 : 0.45}
          />
          <text
            textAnchor="middle"
            dominantBaseline="central"
            fontFamily="var(--font-mono)"
            fontSize={10}
            fontWeight={600}
            letterSpacing="0.06em"
            fill={lit ? "var(--parchment)" : "var(--mist)"}
          >
            {rankLabel}
          </text>
        </g>
      )}
    </g>
  );
});
