import clsx from "clsx";
import { Flag, Pause, Star } from "lucide-react";
import { ProgressRing } from "@/components/ui/Progress";
import { diffDays } from "@/lib/engine/dates";
import type { ThisWeek } from "@/lib/engine/types";
import type { QuestContext } from "./context";
import { formatDay, formatRange, hoursNumber, paceInfo, targetLabel } from "./format";
import { RunControls } from "./RunControls";
import styles from "./quest.module.css";

/** Title, status and the HUD strip: overall progress, week, pace, hours. */
export function QuestHeader({ ctx }: { ctx: QuestContext }) {
  const { quest, view, app } = ctx;
  const run = view.run;
  if (!run) return null;
  const week = view.currentWeek;
  const thisWeek = view.thisWeek;
  const pace = view.paceWeeks === null ? null : paceInfo(view.paceWeeks);
  const defaultHours = quest.hoursPerWeek
    ? quest.hoursPerWeek.min === quest.hoursPerWeek.max
      ? String(quest.hoursPerWeek.min)
      : `${quest.hoursPerWeek.min}–${quest.hoursPerWeek.max}`
    : null;

  return (
    // No overflow-hidden here: the schedule popover must be able to hang below the header.
    <header className="panel relative z-20">
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden rounded-[inherit]">
        <div className="starfield absolute inset-0 opacity-70" />
        <div className="absolute -left-20 -top-32 h-80 w-[36rem] rounded-full bg-gold/[0.07] blur-3xl" />
      </div>
      <div className="relative flex flex-col gap-4 px-4 pb-5 pt-5 sm:px-7 sm:pt-6 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 max-w-3xl">
          <StatusEyebrow status={view.status} />
          <h1 className="mt-2 font-display text-[30px] font-medium leading-[1.05] tracking-tight text-parchment sm:text-[40px]">
            {quest.title}
          </h1>
          {quest.goal ? (
            <p className="mt-2 max-w-[62ch] text-[14px] leading-relaxed text-parchment-dim">
              <span className="text-mist">Goal: </span>
              {quest.goal}
            </p>
          ) : null}
        </div>
        <div className="shrink-0 lg:pt-1">
          <RunControls
            runId={run.id}
            status={run.status}
            startedOn={run.startedOn}
            hoursPerWeek={run.hoursPerWeek}
            defaultHours={defaultHours}
            paceWeeks={view.paceWeeks}
            today={app.today}
          />
        </div>
      </div>

      <div className="relative grid grid-cols-2 rounded-b-[var(--radius)] border-t border-ink-600/60 bg-ink-900/40 md:grid-cols-[auto_1fr_1fr_1.6fr]">
        <HudCell className="col-span-2 flex items-center gap-4 border-b border-ink-600/50 md:col-span-1 md:border-b-0 md:border-r">
          <ProgressRing value={view.progress} size={58} stroke={4}>
            <span className="font-display text-[15px] font-semibold text-gold-bright">{Math.round(view.progress * 100)}%</span>
          </ProgressRing>
          <div>
            <div className="hud-label">Overall</div>
            <div className="mt-0.5 font-mono text-[12px] text-parchment-dim">
              {view.plan.filter((e) => e.status !== "todo").length} / {view.plan.length} objectives
            </div>
          </div>
        </HudCell>

        <HudCell className="border-r border-ink-600/50">
          <div className="hud-label">{week !== null && week > ctx.lastBoundedWeek ? "Follow-on" : "Quest week"}</div>
          <div className="mt-1 font-display text-[22px] font-medium leading-none">
            {week === null ? "—" : week < 1 ? (
              <span className="text-[18px]">Starts {formatDay(run.startedOn)}</span>
            ) : week > ctx.lastBoundedWeek ? (
              <>Week {week}</>
            ) : (
              <>
                Week {week}
                <span className="font-mono text-[12px] font-normal text-mist"> of {ctx.lastBoundedWeek}</span>
              </>
            )}
          </div>
          {week !== null && week < 1 ? (
            <div className="mt-1.5 font-mono text-[11px] text-mist">{countdown(diffDays(app.today, run.startedOn))}</div>
          ) : thisWeek ? (
            <div className="mt-1.5 font-mono text-[11px] text-mist">{formatRange(thisWeek.weekStart, thisWeek.weekEnd)}</div>
          ) : null}
        </HudCell>

        <HudCell className="md:border-r md:border-ink-600/50">
          <div className="hud-label">Pace</div>
          {pace ? (
            <>
              <div className="mt-1 flex items-center gap-2 font-display text-[20px] font-medium leading-none" style={{ color: pace.color }}>
                <span className="h-2 w-2 rotate-45 rounded-[1px]" style={{ background: pace.color, boxShadow: `0 0 8px ${pace.color}` }} aria-hidden />
                {pace.label}
              </div>
              <div className="mt-1.5 text-[11.5px] text-mist">
                {pace.tone === "on-track" ? "Earliest open objective is this week's" : pace.tone === "ahead" ? "Earliest open objective is in a later week" : "Open objectives from earlier weeks"}
              </div>
            </>
          ) : (
            <div className="mt-1 text-mist">—</div>
          )}
        </HudCell>

        <HudCell className="col-span-2 border-t border-ink-600/50 md:col-span-1 md:border-t-0">
          {thisWeek ? <WeekHoursMeter thisWeek={thisWeek} /> : null}
        </HudCell>
      </div>
    </header>
  );
}

function countdown(days: number): string {
  if (days <= 0) return "Today";
  return days === 1 ? "Tomorrow" : `In ${days} days`;
}

function HudCell({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={clsx("px-4 py-4 sm:px-6", className)}>{children}</div>;
}

function StatusEyebrow({ status }: { status: string }) {
  return (
    <div className="hud-label flex items-center gap-2">
      <span>Quest</span>
      <span className="text-ink-400">·</span>
      {status === "active" ? (
        <span className="inline-flex items-center gap-1.5 text-gold">
          <span className="relative grid h-2 w-2 place-items-center">
            <span className="absolute inset-[-3px] animate-glow-pulse rounded-full bg-gold/40 blur-[2px]" />
            <span className="h-1.5 w-1.5 rounded-full bg-gold" />
          </span>
          Active
        </span>
      ) : status === "paused" ? (
        <span className="inline-flex items-center gap-1 text-parchment-dim">
          <Pause className="h-3 w-3" strokeWidth={2.5} /> Paused
        </span>
      ) : status === "completed" ? (
        <span className="inline-flex items-center gap-1 text-gold-bright">
          <Star className="h-3 w-3 fill-gold-bright" strokeWidth={2} /> Completed
        </span>
      ) : (
        <span className="inline-flex items-center gap-1">
          <Flag className="h-3 w-3" strokeWidth={2} /> {status}
        </span>
      )}
    </div>
  );
}

/** This week's logged time against the target band. */
export function WeekHoursMeter({ thisWeek }: { thisWeek: ThisWeek }) {
  const logged = thisWeek.minutesLogged;
  const target = thisWeek.targetMinutes;
  const scale = Math.max(target ? target.max * 1.25 : 300, logged * 1.05, 60);
  const pct = (m: number) => `${Math.min(100, (m / scale) * 100)}%`;
  const reached = target ? logged >= target.min : false;
  const over = target ? logged > target.max : false;
  const fill = reached ? "var(--gold)" : "var(--parchment-dim)";

  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <div className="hud-label">Hours this week</div>
        {target ? (
          <div className={clsx("font-mono text-[11px]", reached ? "text-gold" : "text-mist")}>
            {over ? "Above target" : reached ? "Target reached" : `${hoursNumber(Math.max(0, target.min - logged))} h to go`}
          </div>
        ) : null}
      </div>
      <div className="mt-1 flex items-baseline gap-1.5">
        <span className={clsx("font-display text-[24px] font-medium leading-none", reached ? "text-gold-bright" : "text-parchment")}>
          {hoursNumber(logged)}
        </span>
        <span className="font-mono text-[12px] text-mist">{target ? `/ ${targetLabel(target)}` : "h"}</span>
      </div>
      <div
        className="relative mt-2.5 h-2.5 rounded-full bg-ink-700/80"
        role="meter"
        aria-label="Hours logged this week"
        aria-valuemin={0}
        aria-valuemax={Math.round(scale)}
        aria-valuenow={logged}
        aria-valuetext={`${hoursNumber(logged)} h${target ? ` of ${targetLabel(target)}` : ""}`}
      >
        {target ? (
          <div
            aria-hidden
            className={clsx("absolute inset-y-[-3px] rounded-[3px] border border-gold/45", styles.band)}
            style={{ left: pct(target.min), width: `calc(${pct(target.max)} - ${pct(target.min)})`, minWidth: 3 }}
          />
        ) : null}
        <div
          className="absolute inset-y-0 left-0 rounded-full transition-[width] duration-700"
          style={{
            width: pct(logged),
            background: `linear-gradient(90deg, color-mix(in oklab, ${fill} 55%, transparent), ${fill})`,
            boxShadow: logged > 0 ? `0 0 10px color-mix(in oklab, ${fill} 60%, transparent)` : undefined,
          }}
        />
      </div>
      {target ? (
        <div className="relative mt-1.5 h-3 font-mono text-[10px] text-mist-dim" aria-hidden>
          <span className="absolute -translate-x-1/2" style={{ left: pct(target.min) }}>
            {hoursNumber(target.min)}
          </span>
          {target.max !== target.min ? (
            <span className="absolute -translate-x-1/2" style={{ left: pct(target.max) }}>
              {hoursNumber(target.max)}
            </span>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
