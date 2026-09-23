import clsx from "clsx";
import { Check, ChevronRight, Lock, Minus } from "lucide-react";
import { Markdown } from "@/components/ui/Markdown";
import { formatMinutesShort, itemTypeMeta } from "@/components/ui/meta";
import { addDays } from "@/lib/engine/dates";
import type { PlanEntry } from "@/lib/engine/types";
import { isCleared, type QuestContext } from "./context";
import { formatRange } from "./format";
import { SectionHeading } from "./QuestTimeline";
import { SkillChip } from "./SkillChip";
import styles from "./quest.module.css";

/** Every planned week as an accordion, so I can look back or ahead. */
export function WeekByWeek({ ctx, preview = false }: { ctx: QuestContext; preview?: boolean }) {
  const current = preview ? null : ctx.view.currentWeek;
  const openWeek = current !== null && current >= 1 ? Math.min(current, Math.max(...ctx.weeks)) : 1;
  return (
    <section aria-labelledby="weeks-title">
      <SectionHeading
        id="weeks-title"
        eyebrow={preview ? "Route preview" : "The plan"}
        title="Week by week"
        aside={
          <span className="font-mono text-[11px] text-mist">
            {ctx.view.plan.filter(isCleared).length} / {ctx.view.plan.length} cleared
          </span>
        }
      />
      <div className="panel mt-3 divide-y divide-ink-600/50 overflow-hidden">
        {ctx.weeks.map((week) => (
          <WeekRow key={week} ctx={ctx} week={week} current={current} defaultOpen={week === openWeek} preview={preview} />
        ))}
      </div>
    </section>
  );
}

function WeekRow({
  ctx,
  week,
  current,
  defaultOpen,
  preview,
}: {
  ctx: QuestContext;
  week: number;
  current: number | null;
  defaultOpen: boolean;
  preview: boolean;
}) {
  const entries = ctx.entriesByWeek.get(week) ?? [];
  const cleared = entries.filter(isCleared).length;
  const minutes = entries.reduce((s, e) => s + e.minutes, 0);
  const monday = ctx.weekMonday(week);
  const stageIndex = ctx.stageOfWeek(week);
  const stage = stageIndex >= 0 ? ctx.quest.stages[stageIndex] : null;
  const hue = ctx.stageHue(stageIndex);
  const isCurrent = current !== null && week === current;
  const isPast = current !== null && week < current;
  const allClear = entries.length > 0 && cleared === entries.length;

  return (
    <details className={clsx("group", styles.week)} open={defaultOpen}>
      <summary
        className={clsx(
          "grid cursor-pointer grid-cols-[16px_minmax(0,1fr)_auto] items-center gap-x-3 px-4 py-3 transition-colors hover:bg-ink-800/50 sm:grid-cols-[16px_104px_minmax(0,1fr)_auto] sm:px-5",
          isCurrent && "bg-gold/[0.04]",
        )}
      >
        <ChevronRight className={clsx("h-4 w-4 text-mist transition-transform", styles.chevron)} strokeWidth={2} aria-hidden />
        <span className="flex items-baseline gap-2">
          <span className={clsx("font-display text-[17px] font-medium", isCurrent ? "text-gold-bright" : allClear ? "text-parchment" : "text-parchment-dim")}>
            Week {week}
          </span>
          {isCurrent ? (
            <span className="rounded border border-gold/50 px-1 font-mono text-[9px] uppercase tracking-[0.14em] text-gold">Now</span>
          ) : null}
        </span>
        <span className="col-start-2 row-start-2 flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 sm:col-start-3 sm:row-start-1">
          {monday ? (
            <span className="font-mono text-[11px] text-mist">{formatRange(monday, addDays(monday, 6))}</span>
          ) : null}
          {stage ? (
            <span className="inline-flex items-center gap-1.5 text-[12px]" style={{ color: hue }}>
              <span className="h-1.5 w-1.5 rotate-45" style={{ background: hue }} aria-hidden />
              {stage.name}
            </span>
          ) : null}
          <span className="font-mono text-[11px] text-mist-dim">
            {entries.length === 0 ? "Nothing planned" : `${entries.length} objective${entries.length === 1 ? "" : "s"} · ${formatMinutesShort(minutes)}`}
          </span>
        </span>
        <span className="col-start-3 row-span-2 row-start-1 flex items-center gap-2 sm:col-start-4 sm:row-span-1">
          {entries.length > 0 ? (
            <>
              <MiniPips entries={entries} />
              <span className={clsx("w-9 text-right font-mono text-[11.5px]", allClear ? "text-gold" : isPast && !preview ? "text-rust-bright" : "text-mist")}>
                {cleared}/{entries.length}
              </span>
            </>
          ) : null}
        </span>
      </summary>

      {entries.length > 0 ? (
        <ul className="space-y-0.5 px-3 pb-3 sm:pl-[52px] sm:pr-5">
          {entries.map((e) => (
            <PlanLine key={e.key} ctx={ctx} entry={e} />
          ))}
        </ul>
      ) : null}
    </details>
  );
}

function MiniPips({ entries }: { entries: PlanEntry[] }) {
  return (
    <span className="hidden items-center gap-[3px] sm:flex" aria-hidden>
      {entries.slice(0, 10).map((e) => (
        <span
          key={e.key}
          className="h-[6px] w-[6px] rotate-45 rounded-[1px]"
          style={
            isCleared(e)
              ? { background: "var(--gold)", boxShadow: "0 0 5px var(--gold)" }
              : { border: "1px solid var(--ink-400)" }
          }
        />
      ))}
    </span>
  );
}

function PlanLine({ ctx, entry }: { ctx: QuestContext; entry: PlanEntry }) {
  const meta = itemTypeMeta(entry.type);
  const Icon = meta.icon;
  const done = entry.status === "done";
  const skipped = entry.status === "skipped";
  const locked = entry.locked && entry.status === "todo";
  const status = done ? "Done" : skipped ? "Skipped" : locked ? "Locked" : "To do";
  return (
    <li className="grid grid-cols-[20px_minmax(0,1fr)] items-start gap-x-2.5 rounded-lg px-2 py-2 hover:bg-ink-800/40 sm:grid-cols-[20px_minmax(0,1fr)_auto]">
      <span className="mt-[1px] grid h-5 w-5 place-items-center" title={status}>
        {done ? (
          <span className="grid h-4 w-4 place-items-center rounded-full bg-gold shadow-[0_0_8px_-1px_var(--gold)]">
            <Check className="h-3 w-3 text-ink-900" strokeWidth={3} aria-label="Done" />
          </span>
        ) : skipped ? (
          <Minus className="h-3.5 w-3.5 text-mist" strokeWidth={2.5} aria-label="Skipped" />
        ) : locked ? (
          <Lock className="h-3.5 w-3.5 text-mist-dim" strokeWidth={2} aria-label="Locked" />
        ) : (
          <Icon className="h-4 w-4" style={{ color: meta.color }} strokeWidth={1.8} aria-label={`${meta.label}, to do`} />
        )}
      </span>
      <div className="min-w-0">
        <div className={clsx("text-[13.5px] leading-snug", done || skipped ? "text-mist line-through decoration-ink-400" : locked ? "text-mist" : "text-parchment")}>
          {entry.kind === "recall" ? (
            <span>Answer Recall: {ctx.skill(entry.skillId).title}</span>
          ) : (
            <Markdown inline>{entry.title}</Markdown>
          )}
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="font-mono text-[10.5px] uppercase tracking-[0.1em]" style={{ color: meta.color }}>
            {meta.label}
          </span>
          <SkillChip skill={ctx.skill(entry.skillId)} />
          {locked && entry.lockReason ? <span className="text-[11.5px] text-mist-dim">{entry.lockReason}</span> : null}
        </div>
      </div>
      <span className="col-start-2 font-mono text-[11px] text-mist sm:col-start-3 sm:pt-[2px] sm:text-right">
        {formatMinutesShort(entry.minutes)}
      </span>
    </li>
  );
}
