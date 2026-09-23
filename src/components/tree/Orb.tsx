// Skill orb art, one look per node state. Drawn in a 64-unit box so the same
// art serves the canvas (64 px at zoom 1) and the tiny legend/list dots.
// Gradients and filters live once in <OrbDefs/>, keyed by branch palette slot.

import { Fragment } from "react";
import type { SkillState } from "@/lib/engine/types";

/** Branch-less orb hue for legends and filter chips. */
export const NEUTRAL_ORB = "#c3cde0";

const C = 32;
const RIM = 28.5;
const CIRC = 2 * Math.PI * RIM;

export function starPath(s: number, cx = C, cy = C): string {
  const k = s * 0.2;
  return (
    `M${cx} ${cy - s}Q${cx + k} ${cy - k} ${cx + s} ${cy}` +
    `Q${cx + k} ${cy + k} ${cx} ${cy + s}` +
    `Q${cx - k} ${cy + k} ${cx - s} ${cy}` +
    `Q${cx - k} ${cy - k} ${cx} ${cy - s}Z`
  );
}

const LOCK_PATH = "M26.5 31v-3.2a5.5 5.5 0 0 1 11 0V31M24.5 31h15v9.5h-15z";

export interface OrbArtProps {
  state: SkillState;
  color: string;
  /** Palette slot for the branch gradients in <OrbDefs/>. */
  slot: number;
  /** 0..1, drawn as an arc when in progress. */
  progress?: number;
  /** Rendered size in px; glyphs are dropped below 24. */
  size?: number;
  className?: string;
}

export function OrbArt({ state, color, slot, progress = 0, size = 64, className }: OrbArtProps) {
  const detail = size >= 24;
  return (
    <svg viewBox="0 0 64 64" width={size} height={size} className={className} aria-hidden overflow="visible">
      {state === "locked" && (
        <>
          <circle cx={C} cy={C} r={25} fill="url(#st-dark)" />
          <circle cx={C} cy={C} r={25} fill="none" stroke={color} strokeOpacity={0.08} strokeWidth={5} />
          <circle
            cx={C}
            cy={C}
            r={RIM}
            fill="none"
            stroke="var(--ink-400)"
            strokeOpacity={0.8}
            strokeWidth={detail ? 1.3 : 3}
            strokeDasharray={detail ? "2.2 3.6" : undefined}
          />
          {detail && (
            <path
              d={LOCK_PATH}
              fill="none"
              stroke="var(--mist-dim)"
              strokeWidth={1.6}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          )}
        </>
      )}

      {state === "available" && (
        <>
          <circle cx={C} cy={C} r={25.5} fill="url(#st-dark)" />
          <circle cx={C} cy={C} r={23} fill="none" stroke={color} strokeOpacity={0.22} strokeWidth={detail ? 6 : 10} />
          <circle cx={C} cy={C} r={RIM} fill="none" stroke={color} strokeWidth={detail ? 2.4 : 5} />
          {detail && (
            <path d={starPath(9)} fill="none" stroke={color} strokeOpacity={0.85} strokeWidth={1.3} strokeLinejoin="round" />
          )}
        </>
      )}

      {state === "in-progress" && (
        <>
          <circle cx={C} cy={C} r={25.5} fill={`url(#st-core-${slot})`} />
          <circle cx={C} cy={C} r={RIM} fill="none" stroke="var(--ink-600)" strokeWidth={detail ? 3.2 : 6} />
          <circle
            cx={C}
            cy={C}
            r={RIM}
            fill="none"
            stroke={color}
            strokeWidth={detail ? 3.2 : 6}
            strokeLinecap="round"
            strokeDasharray={`${Math.max(0.02, progress) * CIRC} ${CIRC}`}
            transform={`rotate(-90 ${C} ${C})`}
          />
          {detail && <path d={starPath(8)} fill="#fff" fillOpacity={0.85} />}
        </>
      )}

      {(state === "learned" || state === "tested-out") && (
        <>
          <circle cx={C} cy={C} r={RIM + 2.6} fill="none" stroke="var(--gold)" strokeOpacity={0.35} strokeWidth={0.8} />
          <circle cx={C} cy={C} r={26.5} fill={`url(#st-fill-${slot})`} />
          <circle cx={C} cy={C} r={26.5} fill="url(#st-sheen)" />
          <circle cx={C} cy={C} r={RIM} fill="none" stroke="var(--gold)" strokeWidth={detail ? 2 : 5} />
          {detail && <path d={starPath(10)} fill="#fff" fillOpacity={0.92} />}
        </>
      )}

      {state === "self-reported" && (
        <>
          <circle cx={C} cy={C} r={26.5} fill={`url(#st-muted-${slot})`} />
          <circle cx={C} cy={C} r={26.5} fill="url(#st-sheen)" opacity={0.5} />
          <circle
            cx={C}
            cy={C}
            r={RIM}
            fill="none"
            stroke="var(--parchment-dim)"
            strokeOpacity={0.7}
            strokeWidth={detail ? 1.2 : 3}
            strokeDasharray={detail ? "3 2.6" : undefined}
          />
          {detail && <path d={starPath(8.5)} fill="var(--parchment)" fillOpacity={0.55} />}
        </>
      )}

      {state === "rusty" && (
        <>
          <circle cx={C} cy={C} r={26} fill="url(#st-rust-core)" />
          <circle cx={C} cy={C} r={26} fill="url(#st-sheen)" opacity={0.35} />
          <circle
            cx={C}
            cy={C}
            r={RIM}
            fill="none"
            stroke="var(--rust-bright)"
            strokeWidth={detail ? 4 : 6}
            filter={detail ? "url(#st-grain)" : undefined}
          />
          {detail && (
            <>
              <path
                d="M13.5 20.5l5 3.2-.8 4.6 4.1 2.6M47.5 42.5l-4.6-1.4-1.9 3.6-4.4.2M38 7.8l-1.4 4.8 2.6 2.5"
                fill="none"
                stroke="#2a0f05"
                strokeOpacity={0.7}
                strokeWidth={1.1}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path d={starPath(8.5)} fill="#ffe6d2" fillOpacity={0.78} />
            </>
          )}
        </>
      )}
    </svg>
  );
}

/** Shared gradients and filters for every <OrbArt/> on the page. Mount once. */
export function OrbDefs({ palette }: { palette: string[] }) {
  return (
    <svg width="0" height="0" aria-hidden focusable="false" className="pointer-events-none absolute">
      <defs>
        <radialGradient id="st-dark" cx="50%" cy="38%" r="62%">
          <stop offset="0%" stopColor="#18223d" />
          <stop offset="100%" stopColor="#05080f" />
        </radialGradient>
        <radialGradient id="st-sheen" cx="36%" cy="26%" r="46%">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.5" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="st-rust-core" cx="40%" cy="34%" r="72%">
          <stop offset="0%" style={{ stopColor: "var(--rust-bright)" }} />
          <stop offset="48%" style={{ stopColor: "var(--rust)" }} />
          <stop offset="100%" stopColor="#261006" />
        </radialGradient>
        <radialGradient id="st-hub-core" cx="40%" cy="32%" r="72%">
          <stop offset="0%" style={{ stopColor: "#fff4cf" }} />
          <stop offset="38%" style={{ stopColor: "var(--gold-bright)" }} />
          <stop offset="72%" style={{ stopColor: "var(--gold)" }} />
          <stop offset="100%" style={{ stopColor: "var(--gold-deep)" }} />
        </radialGradient>
        <filter id="st-grain" x="-15%" y="-15%" width="130%" height="130%">
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="4" result="noise" />
          <feColorMatrix
            in="noise"
            type="matrix"
            values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 4 -1.7"
            result="holes"
          />
          <feComposite in="SourceGraphic" in2="holes" operator="out" result="pitted" />
          <feTurbulence type="turbulence" baseFrequency="0.12" numOctaves="1" seed="11" result="warp" />
          <feDisplacementMap in="pitted" in2="warp" scale="2.4" xChannelSelector="R" yChannelSelector="G" />
        </filter>
        {palette.map((c, i) => (
          <Fragment key={i}>
            <radialGradient id={`st-fill-${i}`} cx="40%" cy="34%" r="72%">
              <stop offset="0%" style={{ stopColor: `color-mix(in oklab, ${c} 50%, white)` }} />
              <stop offset="52%" style={{ stopColor: c }} />
              <stop offset="100%" style={{ stopColor: `color-mix(in oklab, ${c} 40%, #05080f)` }} />
            </radialGradient>
            <radialGradient id={`st-muted-${i}`} cx="40%" cy="34%" r="72%">
              <stop offset="0%" style={{ stopColor: `color-mix(in oklab, ${c} 40%, #9aa1b3)` }} />
              <stop offset="60%" style={{ stopColor: `color-mix(in oklab, ${c} 28%, #1e2a47)` }} />
              <stop offset="100%" stopColor="#0b1222" />
            </radialGradient>
            <radialGradient id={`st-core-${i}`} cx="50%" cy="50%" r="50%">
              <stop offset="0%" style={{ stopColor: `color-mix(in oklab, ${c} 75%, white)` }} />
              <stop offset="30%" style={{ stopColor: c, stopOpacity: 0.55 }} />
              <stop offset="100%" stopColor="#070b16" />
            </radialGradient>
          </Fragment>
        ))}
      </defs>
    </svg>
  );
}
