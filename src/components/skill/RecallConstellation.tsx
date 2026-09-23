"use client";

import clsx from "clsx";
import { useId } from "react";
import styles from "./skill.module.css";

const W = 340;
const H = 190;
const CX = W / 2;
const CY = H / 2;
const STAR = "M0 -1C0.08 -0.3 0.3 -0.08 1 0C0.3 0.08 0.08 0.3 0 1C-0.08 0.3 -0.3 0.08 -1 0C-0.3 -0.08 -0.08 -0.3 0 -1Z";

/** Deterministic points on a loose ellipse around the core: one star per question, label pushed outward. */
function layout(n: number): { x: number; y: number; lx: number; ly: number }[] {
  return Array.from({ length: n }, (_, i) => {
    const angle = -Math.PI / 2 + (i / n) * Math.PI * 2 + (i % 2 === 0 ? 0.22 : -0.14);
    const r = i % 2 === 0 ? 1 : 0.84;
    const x = CX + Math.cos(angle) * 138 * r;
    const y = CY + Math.sin(angle) * 70 * r;
    return {
      x: Math.round(x),
      y: Math.round(y),
      lx: Math.round(x + Math.cos(angle) * 20),
      ly: Math.round(y + Math.sin(angle) * 15 + 3),
    };
  });
}

/** Faint background stars, fixed so they don't jump between renders. */
const DUST = [
  [22, 30, 0.8], [58, 150, 0.6], [96, 22, 0.5], [120, 172, 0.7], [210, 18, 0.6], [246, 168, 0.5],
  [300, 40, 0.8], [318, 132, 0.6], [270, 92, 0.4], [40, 96, 0.5], [150, 60, 0.35], [196, 128, 0.35],
] as const;

/**
 * The Recall result as a constellation: one star per question, lit gold when
 * passed. When the skill is learned the core ignites with a starburst and the
 * lines between the stars draw in.
 */
export function RecallConstellation({ results, celebrate }: { results: ("pass" | "fail")[]; celebrate: boolean }) {
  const id = useId().replace(/:/g, "");
  const pts = layout(results.length);
  const n = pts.length;
  const lit = (i: number) => results[i] === "pass";

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="mx-auto block h-auto w-full max-w-[380px]" aria-hidden>
      <defs>
        <radialGradient id={`${id}-halo`}>
          <stop offset="0" stopColor="var(--gold-bright)" stopOpacity="0.55" />
          <stop offset="0.45" stopColor="var(--gold)" stopOpacity="0.16" />
          <stop offset="1" stopColor="var(--gold)" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={`${id}-core`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#fff6d8" />
          <stop offset="0.5" stopColor="var(--gold-bright)" />
          <stop offset="1" stopColor="var(--gold-deep)" />
        </linearGradient>
      </defs>

      {DUST.map(([x, y, r], i) => (
        <circle
          key={`dust-${i}`}
          cx={x}
          cy={y}
          r={r}
          fill="var(--parchment)"
          className="animate-twinkle"
          style={{ animationDelay: `${(i * 0.7) % 5}s` }}
        />
      ))}

      {celebrate && (
        <>
          <circle cx={CX} cy={CY} r={86} fill={`url(#${id}-halo)`} className={styles.halo} />
          <g className={styles.burst}>
            {Array.from({ length: 24 }, (_, i) => {
              const a = (i / 24) * Math.PI * 2;
              const long = i % 2 === 0;
              const r0 = 20;
              const r1 = long ? 92 : 58;
              return (
                <line
                  key={i}
                  x1={CX + Math.cos(a) * r0}
                  y1={CY + Math.sin(a) * r0}
                  x2={CX + Math.cos(a) * r1}
                  y2={CY + Math.sin(a) * r1}
                  stroke="var(--gold)"
                  strokeOpacity={long ? 0.45 : 0.25}
                  strokeWidth={long ? 1.2 : 0.8}
                  strokeLinecap="round"
                />
              );
            })}
          </g>
        </>
      )}

      {/* Spokes from the core to each star. */}
      {pts.map((p, i) => (
        <line
          key={`spoke-${i}`}
          x1={CX}
          y1={CY}
          x2={p.x}
          y2={p.y}
          pathLength={1}
          stroke={lit(i) ? "var(--gold)" : "var(--ink-500)"}
          strokeOpacity={lit(i) ? 0.35 : 0.6}
          strokeWidth={1}
          strokeDasharray={lit(i) ? undefined : "0.02 0.03"}
          className={clsx(lit(i) && styles.segment)}
          style={{ "--delay": `${0.3 + i * 0.16}s` } as React.CSSProperties}
        />
      ))}

      {/* The ring through the stars; a segment lights when both ends passed. */}
      {n > 1 &&
        pts.map((p, i) => {
          const q = pts[(i + 1) % n];
          if (n === 2 && i === 1) return null;
          const on = lit(i) && lit((i + 1) % n);
          return (
            <line
              key={`seg-${i}`}
              x1={p.x}
              y1={p.y}
              x2={q.x}
              y2={q.y}
              pathLength={1}
              stroke={on ? "var(--gold-bright)" : "var(--ink-500)"}
              strokeOpacity={on ? 0.8 : 0.5}
              strokeWidth={on ? 1.4 : 1}
              strokeLinecap="round"
              className={clsx(on && styles.segment)}
              style={{ "--delay": `${0.55 + i * 0.16}s` } as React.CSSProperties}
            />
          );
        })}

      {/* Core. */}
      <g transform={`translate(${CX} ${CY})`}>
        <g className={clsx(celebrate && styles.core)}>
          <path
            d={STAR}
            transform={`scale(${celebrate ? 22 : 15})`}
            fill={celebrate ? `url(#${id}-core)` : "var(--ink-700)"}
            stroke={celebrate ? "none" : "var(--ink-400)"}
            strokeWidth={celebrate ? 0 : 0.07}
          />
          {celebrate && <circle r={3} fill="#fffaf0" />}
        </g>
      </g>

      {/* Question stars. */}
      {pts.map((p, i) => (
        <g key={`star-${i}`} transform={`translate(${p.x} ${p.y})`}>
          <g className={clsx(lit(i) && styles.starLit)} style={{ "--delay": `${0.35 + i * 0.16}s` } as React.CSSProperties}>
            {lit(i) && <circle r={11} fill="var(--gold)" opacity={0.18} />}
            <path
              d={STAR}
              transform={`scale(${lit(i) ? 9 : 7})`}
              fill={lit(i) ? "var(--gold-bright)" : "var(--ink-850)"}
              stroke={lit(i) ? "none" : "var(--rust-bright)"}
              strokeWidth={lit(i) ? 0 : 0.14}
            />
          </g>
          <text
            x={p.lx - p.x}
            y={p.ly - p.y}
            textAnchor="middle"
            className="font-mono"
            fontSize={9.5}
            fill={lit(i) ? "var(--gold)" : "var(--rust-bright)"}
            opacity={0.85}
          >
            Q{i + 1}
          </text>
        </g>
      ))}
    </svg>
  );
}
