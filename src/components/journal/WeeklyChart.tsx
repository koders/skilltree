import clsx from "clsx";
import { STREAK_MIN_MINUTES_PER_WEEK } from "@/lib/config";
import { addDays } from "@/lib/engine/dates";
import type { WeekTotal } from "@/lib/engine/types";
import { fmtHours, fmtRange, fmtShort, plural } from "./format";
import { StarGlyph } from "./PageFrame";

/** The weeks that make up the current weekly streak (engine rule: the current week only counts once it qualifies). */
function streakWeeks(weeks: WeekTotal[], streak: number): Set<string> {
  const current = weeks.at(-1);
  if (!current || streak <= 0) return new Set();
  const lastIdx = current.minutes >= STREAK_MIN_MINUTES_PER_WEEK ? weeks.length - 1 : weeks.length - 2;
  return new Set(weeks.slice(Math.max(0, lastIdx - streak + 1), lastIdx + 1).map((w) => w.weekStart));
}

function axisLabel(week: WeekTotal, prev: WeekTotal | undefined): string {
  const newMonth = !prev || prev.weekStart.slice(5, 7) !== week.weekStart.slice(5, 7);
  return newMonth ? fmtShort(week.weekStart) : String(Number(week.weekStart.slice(8, 10)));
}

export function WeeklyChart({
  weeks,
  target,
  streak,
  today,
}: {
  weeks: WeekTotal[];
  /** Weekly target band from the active quest, in minutes. */
  target: { min: number; max: number } | null;
  streak: number;
  today: string;
}) {
  const peak = Math.max(...weeks.map((w) => w.minutes), target?.max ?? 0, STREAK_MIN_MINUTES_PER_WEEK * 1.5);
  const scale = Math.ceil(peak / 60) * 60;
  const pct = (minutes: number) => `${(minutes / scale) * 100}%`;
  const inStreak = streakWeeks(weeks, streak);
  const total = weeks.reduce((s, w) => s + w.minutes, 0);
  const active = weeks.filter((w) => w.minutes > 0).length;
  const gridHours = Array.from({ length: scale / 60 + 1 }, (_, i) => i).filter((h) => scale / 60 <= 6 || h % 2 === 0);

  return (
    <section aria-labelledby="weekly-title" className="flex h-full flex-col rounded-[var(--radius)] border border-ink-600/80 bg-ink-850/70 p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
        <div>
          <h2 id="weekly-title" className="font-display text-[20px] font-normal text-parchment">
            Hours per week
          </h2>
          <p className="mt-1 text-[12.5px] text-mist">
            Last 12 weeks · {fmtHours(total)} h across {plural(active, "active week")}
          </p>
        </div>
        <ul className="flex flex-wrap items-center gap-x-4 gap-y-1.5 font-mono text-[10.5px] text-mist">
          {target && (
            <li className="flex items-center gap-1.5">
              <span className="h-2.5 w-4 rounded-[3px] border border-dashed border-gold/60 bg-[color-mix(in_oklab,var(--gold)_14%,transparent)]" />
              Quest target {fmtHours(target.min)}–{fmtHours(target.max)} h
            </li>
          )}
          <li className="flex items-center gap-1.5">
            <span className="w-4 border-t border-dashed border-mist" />
            Streak line {fmtHours(STREAK_MIN_MINUTES_PER_WEEK)} h
          </li>
          <li className="flex items-center gap-1.5">
            <StarGlyph className="h-2.5 w-2.5 text-gold" />
            Streak week
          </li>
        </ul>
      </div>

      <div className="mt-6 flex flex-1 gap-2.5">
        {/* y axis */}
        <div className="relative w-6 shrink-0 font-mono text-[10px] text-mist-dim" aria-hidden>
          <div className="absolute inset-x-0 bottom-6 top-3">
            {gridHours.map((h) => (
              <span key={h} className="absolute right-0 translate-y-1/2" style={{ bottom: pct(h * 60) }}>
                {h}h
              </span>
            ))}
          </div>
        </div>

        <div className="relative min-h-[190px] flex-1">
          {/* plot */}
          <div className="absolute inset-x-0 bottom-6 top-3">
            {gridHours.map((h) => (
              <div key={h} className="absolute inset-x-0 border-t border-ink-600/45" style={{ bottom: pct(h * 60) }} aria-hidden />
            ))}
            {target && (
              <div
                className="absolute inset-x-0 border-y border-dashed border-gold/55 bg-[color-mix(in_oklab,var(--gold)_15%,transparent)]"
                style={{ bottom: pct(target.min), height: pct(target.max - target.min) }}
                aria-hidden
              />
            )}
            <div
              className="absolute inset-x-0 border-t border-dashed border-mist/60"
              style={{ bottom: pct(STREAK_MIN_MINUTES_PER_WEEK) }}
              aria-hidden
            />

            <ol className="absolute inset-0 grid grid-cols-12 gap-[2px]">
              {weeks.map((w, i) => {
                const current = i === weeks.length - 1;
                const streakWeek = inStreak.has(w.weekStart);
                const end = addDays(w.weekStart, 6);
                return (
                  <li key={w.weekStart} className="group/bar relative flex h-full items-end justify-center" tabIndex={0}>
                    <span className="sr-only">
                      Week of {fmtShort(w.weekStart, today)}: {fmtHours(w.minutes)} hours, {w.xp} XP
                      {streakWeek ? ", streak week" : ""}
                    </span>
                    {/* hover band: the whole column is the hit target */}
                    <span
                      className="absolute inset-0 rounded-md bg-parchment/0 transition-colors group-hover/bar:bg-parchment/[0.04] group-focus-visible/bar:bg-parchment/[0.06]"
                      aria-hidden
                    />
                    <span
                      className={clsx(
                        "relative w-[min(58%,22px)] rounded-t-[4px] transition-[filter] duration-300 group-hover/bar:brightness-125",
                        current
                          ? "bg-gradient-to-t from-gold-deep to-gold-bright shadow-[0_0_18px_-2px_var(--gold)]"
                          : streakWeek
                            ? "bg-gradient-to-t from-gold-deep/70 to-gold/80"
                            : "bg-gradient-to-t from-ink-500 to-parchment-dim/70",
                      )}
                      style={{ height: w.minutes > 0 ? `max(3px, ${pct(w.minutes)})` : "0px" }}
                      aria-hidden
                    >
                      {streakWeek && (
                        <StarGlyph className="absolute -top-4 left-1/2 h-2.5 w-2.5 -translate-x-1/2 text-gold drop-shadow-[0_0_4px_var(--gold)]" />
                      )}
                    </span>
                    {current && w.minutes === 0 && (
                      <span className="absolute bottom-0 h-[2px] w-[min(58%,22px)] rounded-full bg-gold/60" aria-hidden />
                    )}
                    {/* tooltip */}
                    <span
                      className={clsx(
                        "pointer-events-none absolute bottom-[calc(100%+4px)] z-10 hidden w-max rounded-lg border border-ink-500 bg-ink-800/95 px-2.5 py-1.5 text-left font-mono text-[11px] leading-relaxed text-parchment shadow-lg group-hover/bar:block group-focus-visible/bar:block",
                        i < 2 ? "left-0" : i > weeks.length - 3 ? "right-0" : "left-1/2 -translate-x-1/2",
                      )}
                      aria-hidden
                    >
                      <span className="block text-mist">
                        {fmtRange(w.weekStart, end)}
                        {current ? " · this week" : ""}
                      </span>
                      {fmtHours(w.minutes)} h · {w.xp.toLocaleString("en")} XP
                    </span>
                  </li>
                );
              })}
            </ol>
          </div>

          {/* x axis */}
          <ol className="absolute inset-x-0 bottom-0 grid h-5 grid-cols-12 gap-[2px] font-mono text-[10px]" aria-hidden>
            {weeks.map((w, i) => (
              <li
                key={w.weekStart}
                className={clsx(
                  "whitespace-nowrap text-center",
                  i === weeks.length - 1 ? "text-gold" : "text-mist-dim",
                  i % 2 === 1 && i !== weeks.length - 1 && "max-sm:invisible",
                )}
              >
                {i === weeks.length - 1 ? "Now" : axisLabel(w, weeks[i - 1])}
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}
