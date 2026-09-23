import { Flame } from "lucide-react";
import { XP_PER_RECALL_PASS } from "@/lib/config";
import type { XpSummary } from "@/lib/engine/types";
import { fmtHours, plural } from "./format";
import { StarGlyph } from "./PageFrame";

/** A title for each band of levels, so the number means something at a glance. */
const TITLES: [number, string][] = [
  [1, "Stargazer"],
  [3, "Wayfinder"],
  [5, "Navigator"],
  [8, "Cartographer"],
  [12, "Astronomer"],
  [17, "Luminary"],
];

function titleFor(level: number): string {
  let title = TITLES[0][1];
  for (const [from, name] of TITLES) if (level >= from) title = name;
  return title;
}

export function LevelCard({ xp }: { xp: XpSummary }) {
  const size = 148;
  const stroke = 5;
  const r = (size - stroke) / 2 - 6;
  const c = 2 * Math.PI * r;
  const toGo = Math.max(0, xp.nextLevelAt - xp.total);
  // Tick marks around the dial, one per 5% of the level.
  const ticks = Array.from({ length: 20 }, (_, i) => i);

  return (
    <section
      aria-labelledby="level-title"
      className="relative flex h-full flex-col overflow-hidden rounded-[var(--radius)] border border-gold/30 bg-[radial-gradient(420px_260px_at_30%_0%,rgba(233,196,106,0.13),transparent_70%),var(--ink-850)] p-5 sm:p-6"
    >
      <p className="hud-label flex items-center gap-2">
        <StarGlyph className="h-2.5 w-2.5 text-gold" />
        <span id="level-title">{titleFor(xp.level)}</span>
      </p>

      <div className="mt-4 flex items-center gap-5">
        <div className="relative shrink-0" style={{ width: size, height: size }}>
          <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90" aria-hidden>
            {ticks.map((i) => {
              const a = (i / ticks.length) * 2 * Math.PI;
              const r1 = size / 2 - 1;
              const r2 = size / 2 - (i % 5 === 0 ? 7 : 4);
              const at = (radius: number, f: (x: number) => number) => (size / 2 + radius * f(a)).toFixed(1);
              return (
                <line
                  key={i}
                  x1={at(r1, Math.cos)}
                  y1={at(r1, Math.sin)}
                  x2={at(r2, Math.cos)}
                  y2={at(r2, Math.sin)}
                  stroke={i / ticks.length < xp.progressToNext ? "var(--gold)" : "var(--ink-500)"}
                  strokeWidth={i % 5 === 0 ? 1.4 : 1}
                />
              );
            })}
            <circle cx={size / 2} cy={size / 2} r={r} fill="var(--ink-900)" stroke="var(--ink-600)" strokeWidth={stroke} />
            <circle
              cx={size / 2}
              cy={size / 2}
              r={r}
              fill="none"
              stroke="var(--gold)"
              strokeWidth={stroke}
              strokeLinecap="round"
              strokeDasharray={`${c * xp.progressToNext} ${c}`}
              style={{ filter: "drop-shadow(0 0 6px var(--gold))" }}
            />
          </svg>
          <div className="absolute inset-0 grid place-items-center text-center">
            <div>
              <div className="font-mono text-[9.5px] uppercase tracking-[0.2em] text-mist">Level</div>
              <div className="font-display text-[54px] font-light leading-none text-gold-bright [font-variation-settings:'opsz'_144]">
                {xp.level}
              </div>
            </div>
          </div>
        </div>

        <dl className="min-w-0 space-y-3.5">
          <div>
            <dt className="hud-label">Total XP</dt>
            <dd className="mt-1 font-mono text-[22px] leading-none text-parchment">{xp.total.toLocaleString("en")}</dd>
          </div>
          <div>
            <dt className="hud-label">To level {xp.level + 1}</dt>
            <dd className="mt-1 font-mono text-[15px] leading-none text-gold">
              {toGo.toLocaleString("en")} <span className="text-[11.5px] text-mist">XP to go</span>
            </dd>
          </div>
          <div>
            <dt className="hud-label">Time logged</dt>
            <dd className="mt-1 font-mono text-[15px] leading-none text-parchment-dim">
              {fmtHours(xp.minutesTotal)} <span className="text-[11.5px] text-mist">h</span>
            </dd>
          </div>
        </dl>
      </div>

      <div className="mt-5 flex flex-wrap gap-2 font-mono text-[11.5px]">
        <span
          className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-1 ${xp.weeklyStreak > 0 ? "border-gold/40 text-gold" : "border-ink-600 text-mist"}`}
        >
          <Flame className="h-3.5 w-3.5" strokeWidth={1.9} />
          {xp.weeklyStreak > 0 ? `${plural(xp.weeklyStreak, "week")} streak` : "No streak yet"}
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-md border border-ink-600 px-2 py-1 text-parchment-dim">
          {fmtHours(xp.thisWeekMinutes)} h this week
        </span>
      </div>

      <div className="mt-auto pt-5">
        <div className="flex justify-between font-mono text-[10.5px] text-mist">
          <span>{xp.levelFloor.toLocaleString("en")}</span>
          <span>{Math.round(xp.progressToNext * 100)}%</span>
          <span>{xp.nextLevelAt.toLocaleString("en")}</span>
        </div>
        <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-ink-600/70">
          <div
            className="h-full rounded-full bg-gradient-to-r from-gold-deep to-gold-bright shadow-[0_0_10px_var(--gold)]"
            style={{ width: `${xp.progressToNext * 100}%` }}
          />
        </div>
        {xp.recallBonus > 0 && (
          <p className="mt-3 text-[12px] text-mist">
            Includes {xp.recallBonus.toLocaleString("en")} XP from {plural(xp.recallBonus / XP_PER_RECALL_PASS, "recall answer")}
          </p>
        )}
      </div>
    </section>
  );
}
