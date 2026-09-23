import clsx from "clsx";
import { Check } from "lucide-react";
import { ProgressBar } from "@/components/ui/Progress";
import { formatMinutesShort } from "@/components/ui/meta";
import type { StageView } from "@/lib/engine/types";
import { isCleared, type QuestContext } from "./context";
import { rankSuffix } from "./format";
import { SkillChip } from "./SkillChip";
import { TrackScroll } from "./TrackScroll";
import styles from "./quest.module.css";

const OPEN_COLUMN_WEIGHT = 2;

/** Week columns: 1…N for bounded stages, then one wider "N+1+" column. */
function columns(ctx: QuestContext) {
  const bounded = Array.from({ length: ctx.lastBoundedWeek }, (_, i) => i + 1);
  const weights = [...bounded.map(() => 1), ...(ctx.hasOpenStage ? [OPEN_COLUMN_WEIGHT] : [])];
  const template = weights.map((w) => `minmax(0,${w}fr)`).join(" ");
  const total = weights.reduce((a, b) => a + b, 0);
  /** 1-based grid column of a quest week. */
  const columnOf = (week: number) => Math.min(Math.max(1, week), weights.length);
  /** Centre of a column as a % of the track width. */
  const centreOf = (col: number) => {
    const before = weights.slice(0, col - 1).reduce((a, b) => a + b, 0);
    return ((before + weights[col - 1] / 2) / total) * 100;
  };
  return { bounded, template, columnOf, centreOf, openColumn: ctx.hasOpenStage ? weights.length : null };
}

type WeekMark = "cleared" | "open-past" | "current" | "future" | "empty";

function weekMark(ctx: QuestContext, week: number, currentWeek: number | null): WeekMark {
  const entries = ctx.entriesByWeek.get(week) ?? [];
  if (currentWeek !== null && week === currentWeek) return "current";
  if (entries.length > 0 && entries.every(isCleared)) return "cleared";
  if (currentWeek !== null && week < currentWeek) return entries.length > 0 ? "open-past" : "cleared";
  return entries.length > 0 ? "future" : "empty";
}

/**
 * The route as a constellation track: stage segments over week nodes, a gold
 * "now" marker, cleared weeks lit.
 */
export function WeekTrack({ ctx, preview = false }: { ctx: QuestContext; preview?: boolean }) {
  const { view, quest } = ctx;
  const currentWeek = preview ? null : view.currentWeek;
  const { bounded, template, columnOf, centreOf, openColumn } = columns(ctx);
  const nowCol = currentWeek !== null && currentWeek >= 1 ? columnOf(currentWeek) : null;
  const lit = nowCol === null ? 0 : centreOf(nowCol);
  const openStage = quest.stages.find((s) => s.weekEnd === null) ?? null;
  const openWeeks = openStage ? [...ctx.entriesByWeek.keys()].filter((w) => w > ctx.lastBoundedWeek) : [];
  const openCleared =
    openWeeks.length > 0 && openWeeks.every((w) => (ctx.entriesByWeek.get(w) ?? []).every(isCleared));
  const openMark: WeekMark =
    currentWeek !== null && currentWeek > ctx.lastBoundedWeek
      ? "current"
      : openCleared
        ? "cleared"
        : openWeeks.length > 0
          ? "future"
          : "empty";

  return (
    <TrackScroll>
      <div
        className="relative grid min-w-[620px] gap-y-3 pt-6"
        style={{ gridTemplateColumns: template }}
        role="img"
        aria-label={trackLabel(ctx, currentWeek)}
      >
        {/* Stage segments */}
        {view.stages.map((stage) => {
          const hue = ctx.stageHue(stage.index);
          const start = columnOf(stage.weekStart);
          const end = stage.weekEnd === null ? (openColumn ?? start) : columnOf(stage.weekEnd);
          const active = !preview && stage.isCurrent;
          return (
            <div
              key={stage.index}
              className="relative z-[1] mx-[3px] h-[34px] overflow-hidden rounded-md border"
              style={{
                gridColumn: `${start} / ${end + 1}`,
                gridRow: 1,
                borderColor: `color-mix(in oklab, ${hue} ${active ? 70 : 38}%, transparent)`,
                background: `color-mix(in oklab, ${hue} 7%, var(--ink-850))`,
                boxShadow: active ? `0 0 22px -8px ${hue}` : undefined,
              }}
            >
              <div
                hidden={preview}
                className="absolute inset-y-0 left-0 transition-[width] duration-700"
                style={{
                  width: `${Math.round(stage.progress * 100)}%`,
                  background: `linear-gradient(90deg, color-mix(in oklab, ${hue} 18%, transparent), color-mix(in oklab, ${hue} 36%, transparent))`,
                  borderRight: stage.progress > 0 && stage.progress < 1 ? `1px solid ${hue}` : undefined,
                }}
              />
              <div className="relative flex h-full items-center justify-between gap-2 px-2.5">
                <span className="truncate text-[12.5px] font-medium" style={{ color: hue }}>
                  {stage.name}
                </span>
                {!preview ? (
                  <span className="shrink-0 font-mono text-[10.5px] text-parchment-dim">
                    {stage.progress >= 1 ? <Check className="h-3.5 w-3.5 text-gold" strokeWidth={2.5} /> : `${Math.round(stage.progress * 100)}%`}
                  </span>
                ) : null}
              </div>
            </div>
          );
        })}

        {/* The hairline the week nodes sit on */}
        <div
          aria-hidden
          className={clsx("pointer-events-none absolute left-0 right-0 h-px", styles.trackLine)}
          style={{ bottom: 27, ["--lit" as string]: `${lit}%` }}
        />

        {/* Week nodes */}
        {bounded.map((week) => (
          <WeekNode key={week} week={week} label={String(week)} mark={preview ? "future" : weekMark(ctx, week, currentWeek)} />
        ))}
        {openColumn !== null ? (
          <WeekNode
            week={openColumn}
            label={`${ctx.lastBoundedWeek + 1}+`}
            mark={preview ? "future" : openMark}
          />
        ) : null}

        {/* Now marker */}
        {nowCol !== null ? (
          <div
            aria-hidden
            data-now
            className="pointer-events-none relative z-0 flex justify-center"
            style={{ gridColumn: nowCol, gridRow: "1 / span 2" }}
          >
            <div className="absolute -top-6 flex flex-col items-center">
              <span className="rounded-sm bg-gold px-1 font-mono text-[9px] font-semibold uppercase tracking-[0.14em] text-ink-900 shadow-[0_0_12px_var(--gold)]">
                Now
              </span>
              <span className="h-[3px] w-px bg-gold" />
            </div>
            <span className="absolute -top-[5px] bottom-[27px] w-px bg-gradient-to-b from-gold via-gold/60 to-gold shadow-[0_0_8px_var(--gold)]" />
          </div>
        ) : null}
      </div>
    </TrackScroll>
  );
}

function WeekNode({ week, label, mark }: { week: number; label: string; mark: WeekMark }) {
  return (
    <div className="flex flex-col items-center gap-1.5" style={{ gridColumn: week, gridRow: 2 }}>
      <span className="relative grid h-4 w-4 place-items-center">
        {mark === "current" ? (
          <>
            <span className="absolute inset-[-5px] animate-glow-pulse rounded-full bg-gold/25 blur-[3px]" />
            <span className="h-3 w-3 rotate-45 rounded-[2px] border-2 border-gold-bright bg-ink-900 shadow-[0_0_10px_var(--gold)]" />
          </>
        ) : mark === "cleared" ? (
          <span className="h-2.5 w-2.5 rotate-45 rounded-[2px] bg-gold shadow-[0_0_8px_var(--gold)]" />
        ) : mark === "open-past" ? (
          <span className="h-2.5 w-2.5 rotate-45 rounded-[2px] border border-rust-bright bg-ink-900" />
        ) : mark === "future" ? (
          <span className="h-2 w-2 rotate-45 rounded-[1.5px] border border-ink-400 bg-ink-900" />
        ) : (
          <span className="h-1 w-1 rounded-full bg-ink-500" />
        )}
      </span>
      <span
        className={clsx(
          "font-mono text-[10.5px] leading-none",
          mark === "current" ? "text-gold-bright" : mark === "cleared" ? "text-gold" : mark === "open-past" ? "text-rust-bright" : "text-mist-dim",
        )}
      >
        {label}
      </span>
    </div>
  );
}

function trackLabel(ctx: QuestContext, currentWeek: number | null): string {
  const stages = ctx.view.stages
    .map((s) => `${s.name}, weeks ${s.weekStart}${s.weekEnd === null ? "+" : `–${s.weekEnd}`}, ${Math.round(s.progress * 100)}%`)
    .join("; ");
  return `Quest timeline. ${currentWeek !== null && currentWeek >= 1 ? `Now in week ${currentWeek}. ` : ""}${stages}.`;
}

/** One stage: its weeks, progress and skills. */
export function StageCard({ ctx, stage, preview = false }: { ctx: QuestContext; stage: StageView; preview?: boolean }) {
  const hue = ctx.stageHue(stage.index);
  const current = !preview && stage.isCurrent;
  const complete = !preview && stage.progress >= 1;
  const weeks = stage.weekEnd === null ? `Weeks ${stage.weekStart}+` : stage.weekStart === stage.weekEnd ? `Week ${stage.weekStart}` : `Weeks ${stage.weekStart}–${stage.weekEnd}`;
  return (
    <article
      className={clsx("panel relative overflow-hidden p-4", current && "!border-gold/40")}
      aria-label={`Stage ${stage.index + 1}: ${stage.name}`}
    >
      <span aria-hidden className="absolute inset-x-0 top-0 h-[2px]" style={{ background: `linear-gradient(90deg, ${hue}, transparent)` }} />
      <div className="flex items-center justify-between gap-2">
        <span className="hud-label !text-[10px]">
          Stage {stage.index + 1} · {weeks}
        </span>
        {current ? (
          <span className="rounded border border-gold/50 px-1.5 font-mono text-[9.5px] uppercase tracking-[0.14em] text-gold">Now</span>
        ) : complete ? (
          <Check className="h-4 w-4 text-gold" strokeWidth={2.5} aria-label="Stage complete" />
        ) : null}
      </div>
      <h3 className="mt-1 font-display text-[19px] font-medium leading-tight" style={{ color: current ? "var(--parchment)" : undefined }}>
        {stage.name}
      </h3>
      {!preview ? (
        <>
          <ProgressBar value={stage.progress} color={hue} className="mt-3" label={`${stage.name} progress`} />
          <div className="mt-1.5 flex justify-between font-mono text-[10.5px] text-mist">
            <span>{Math.round(stage.progress * 100)}%</span>
            <span>
              {formatMinutesShort(stage.doneMinutes)} / {formatMinutesShort(stage.plannedMinutes)}
            </span>
          </div>
        </>
      ) : (
        <div className="mt-1 font-mono text-[10.5px] text-mist">~{formatMinutesShort(stage.plannedMinutes)} planned</div>
      )}
      <ul className="mt-3 flex flex-col items-start gap-1.5">
        {stage.steps.map((step, i) => (
          <li key={`${step.skillId}-${i}`} className="flex max-w-full items-baseline gap-1.5">
            <span className="w-4 shrink-0 text-right font-mono text-[10px] text-mist-dim">{i + 1}</span>
            <SkillChip skill={ctx.skill(step.skillId)} hue="state" suffix={rankSuffix(step.ranks)} complete={step.complete} wrap />
          </li>
        ))}
      </ul>
    </article>
  );
}

/** Every stage as a card: weeks, progress and its skills in route order. */
export function QuestStages({ ctx, preview = false }: { ctx: QuestContext; preview?: boolean }) {
  return (
    <section aria-labelledby="stages-title">
      <SectionHeading id="stages-title" eyebrow={preview ? "What it covers" : "The route"} title="Stages" />
      <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {ctx.view.stages.map((stage) => (
          <StageCard key={stage.index} ctx={ctx} stage={stage} preview={preview} />
        ))}
      </div>
    </section>
  );
}

export function SectionHeading({
  id,
  eyebrow,
  title,
  aside,
}: {
  id: string;
  eyebrow: string;
  title: string;
  aside?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <div className="hud-label">{eyebrow}</div>
        <h2 id={id} className="mt-0.5 font-display text-[24px] font-medium leading-tight tracking-tight">
          {title}
        </h2>
      </div>
      {aside}
    </div>
  );
}
