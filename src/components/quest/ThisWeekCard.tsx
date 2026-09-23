import clsx from "clsx";
import { CalendarDays, ChevronRight, CornerDownRight, Sparkles, Star } from "lucide-react";
import { formatMinutesShort, itemTypeMeta } from "@/components/ui/meta";
import type { PlanEntry, ThisWeek } from "@/lib/engine/types";
import { bankedKeys, isCleared, type QuestContext } from "./context";
import { entryRowProps, type EntryVariant } from "./entryParts";
import { formatDay, formatRange, plainText } from "./format";
import { QuestEntryRow } from "./QuestEntryRow";

/** The centrepiece: this week's objectives as a game quest log. */
export function ThisWeekCard({ ctx, thisWeek }: { ctx: QuestContext; thisWeek: ThisWeek }) {
  const { view } = ctx;
  const beforeStart = thisWeek.week < 1;
  const { entries } = thisWeek;
  // The planner lists only open carry-over and get-ahead entries. Keep the ones
  // cleared this week in view too, so the count moves and Undo stays in reach.
  const banked = bankedKeys(view.plan, thisWeek, ctx.app.state);
  const carryKeys = new Set(thisWeek.carryOver.map((e) => e.key));
  const aheadKeys = new Set(thisWeek.getAhead.map((e) => e.key));
  const carryOver = view.plan.filter((e) => carryKeys.has(e.key) || (banked.has(e.key) && e.week < thisWeek.week));
  const getAhead = view.plan.filter((e) => aheadKeys.has(e.key) || (banked.has(e.key) && e.week > thisWeek.week));
  const openAhead = thisWeek.getAhead.length;
  const objectives = [...carryOver, ...entries];
  const clearedCount = objectives.filter(isCleared).length;
  const weekCleared = !beforeStart && entries.length > 0 && clearedCount === objectives.length;
  const nothingPlanned = !beforeStart && objectives.length === 0;
  const nextKey = view.nextUp?.key ?? null;
  const stageIndex = ctx.stageOfWeek(Math.max(1, thisWeek.week));
  const stage = stageIndex >= 0 ? ctx.quest.stages[stageIndex] : null;
  const hue = ctx.stageHue(stageIndex);
  const plannedMinutes = entries.reduce((s, e) => s + e.minutes, 0);
  const startsOn = ctx.weekMonday(1);

  return (
    <section aria-labelledby="this-week-title" className="panel relative overflow-hidden">
      {/* stage-hued glow in the corner */}
      <div
        aria-hidden
        className="pointer-events-none absolute -right-24 -top-28 h-64 w-64 rounded-full opacity-[0.13] blur-3xl"
        style={{ background: weekCleared ? "var(--gold)" : hue }}
      />

      <header className="relative flex flex-wrap items-end justify-between gap-x-6 gap-y-3 border-b border-ink-600/60 px-4 pb-4 pt-5 sm:px-6">
        <div className="min-w-0">
          <div className="hud-label flex items-center gap-2">
            <span>This week</span>
            {stage ? (
              <>
                <span className="text-ink-400">/</span>
                <span style={{ color: hue }}>{stage.name}</span>
              </>
            ) : null}
          </div>
          <h2 id="this-week-title" className="mt-1 flex flex-wrap items-baseline gap-x-3 font-display text-[30px] font-medium leading-none tracking-tight">
            {beforeStart ? "Before week 1" : `Week ${thisWeek.week}`}
            <span className="font-mono text-[12.5px] font-normal tracking-normal text-mist">
              {formatRange(thisWeek.weekStart, thisWeek.weekEnd)}
            </span>
          </h2>
          {view.nextUp && !weekCleared ? (
            <NextUpLine ctx={ctx} entry={view.nextUp} inCard={[...objectives, ...getAhead].some((e) => e.key === nextKey)} />
          ) : null}
        </div>

        {!beforeStart && objectives.length > 0 ? (
          <div className="flex flex-col items-start gap-2 sm:items-end">
            <div className="font-mono text-[12px] text-mist">
              <span className={clsx("text-[20px]", weekCleared ? "text-gold-bright" : "text-parchment")}>
                {clearedCount}
              </span>
              <span className="mx-1 text-ink-400">/</span>
              {objectives.length} objectives
            </div>
            <ObjectivePips objectives={objectives} />
          </div>
        ) : null}
      </header>

      <div className="relative px-2 py-3 sm:px-3">
        {beforeStart ? (
          <EmptyNote
            icon={<Star className="h-5 w-5 text-gold" strokeWidth={1.6} />}
            title={startsOn ? `The quest begins ${formatDay(startsOn)}` : "The quest hasn't begun"}
            body="Nothing is due yet. If you want a head start, the first open objectives are below."
          />
        ) : nothingPlanned ? (
          <EmptyNote
            icon={<Star className="h-5 w-5 text-gold" strokeWidth={1.6} />}
            title="Nothing planned this week"
            body="The route has no objectives here. Use the time to get ahead or keep up the habits."
          />
        ) : (
          <>
            {/* Carry-over first: it's overdue, and it often unlocks this week's items. */}
            {carryOver.length > 0 ? (
              <div>
                <SubHeading
                  icon={<CornerDownRight className="h-3.5 w-3.5" strokeWidth={2} />}
                  color="var(--stale)"
                  label={`Carried over · ${carryOver.length}`}
                  note={
                    (view.paceWeeks ?? 0) <= -2
                      ? `${-(view.paceWeeks ?? 0)} weeks behind · re-plan from the schedule menu`
                      : "Still open from earlier weeks"
                  }
                  first
                />
                <EntryList ctx={ctx} entries={carryOver} variant="carry" nextKey={nextKey} />
              </div>
            ) : null}
            {entries.length > 0 ? (
              <div className={carryOver.length > 0 ? "mt-2" : undefined}>
                {carryOver.length > 0 ? (
                  <SubHeading
                    icon={<CalendarDays className="h-3.5 w-3.5" strokeWidth={2} />}
                    color="var(--parchment-dim)"
                    label={`Planned for week ${thisWeek.week} · ${entries.length}`}
                    note={formatMinutesShort(plannedMinutes)}
                  />
                ) : null}
                <EntryList ctx={ctx} entries={entries} variant="planned" nextKey={nextKey} />
              </div>
            ) : null}
            {entries.length > 0 && carryOver.length === 0 && !weekCleared ? (
              <p className="px-3 pb-1 pt-3 font-mono text-[11px] text-mist-dim">
                Planned this week: {formatMinutesShort(plannedMinutes)}
              </p>
            ) : null}
          </>
        )}

        {weekCleared ? <WeekCleared week={thisWeek.week} hasMore={openAhead > 0} /> : null}

        {getAhead.length > 0 ? (
          <div className="mt-2">
            <SubHeading
              icon={<Sparkles className="h-3.5 w-3.5" strokeWidth={2} />}
              color="var(--gold)"
              label={beforeStart ? "Get a head start" : "Get ahead"}
              note={beforeStart ? "The first open objectives on the route" : "The next objectives on the route"}
            />
            <EntryList ctx={ctx} entries={getAhead} variant="ahead" nextKey={nextKey} />
          </div>
        ) : null}
        {weekCleared && openAhead === 0 ? (
          <p className="px-3 pb-2 text-center text-[13px] text-mist">The whole route is clear. Nothing left to get ahead on.</p>
        ) : null}
      </div>
    </section>
  );
}

function cssId(key: string): string {
  return key.replace(/[^a-zA-Z0-9_-]/g, "-");
}

/** "Next up" callout; a jump link when the entry is listed in this card. */
function NextUpLine({ ctx, entry, inCard }: { ctx: QuestContext; entry: PlanEntry; inCard: boolean }) {
  const meta = itemTypeMeta(entry.type);
  // Plain text: the title's own links can't nest inside the jump link.
  const text = entry.kind === "recall" ? `Answer Recall: ${ctx.skill(entry.skillId).title}` : plainText(entry.title);
  const body = (
    <>
      <span className="shrink-0 whitespace-nowrap font-mono text-[10px] uppercase tracking-[0.16em] text-gold">Next up</span>
      <span className="h-px w-3 shrink-0 bg-gold/50" aria-hidden />
      <span className="flex min-w-0 items-center gap-1.5">
        <span className="h-1.5 w-1.5 shrink-0 rotate-45" style={{ background: meta.color }} aria-hidden />
        <span className="truncate">{text}</span>
        {inCard ? null : <span className="shrink-0 font-mono text-[11px] text-mist">· week {entry.week}</span>}
      </span>
    </>
  );
  const className = "mt-2.5 flex max-w-full items-center gap-2 text-[13px] text-parchment-dim";
  return inCard ? (
    <a href={`#entry-${cssId(entry.key)}`} className={clsx(className, "hover:text-parchment")}>
      {body}
    </a>
  ) : (
    <div className={className}>{body}</div>
  );
}

/** Long lists (a run that fell far behind) show the first few and fold the rest. */
const LIST_LIMIT = 6;

function EntryList({
  ctx,
  entries,
  variant,
  nextKey,
}: {
  ctx: QuestContext;
  entries: PlanEntry[];
  variant: EntryVariant;
  nextKey: string | null;
}) {
  const row = (entry: PlanEntry) => (
    <QuestEntryRow
      key={entry.key}
      {...entryRowProps(ctx, entry, variant)}
      isNext={entry.key === nextKey}
      anchorId={`entry-${cssId(entry.key)}`}
    />
  );
  // Keep the next-up entry visible even when it falls past the fold.
  const nextIndex = entries.findIndex((e) => e.key === nextKey);
  const limit = nextIndex >= LIST_LIMIT ? nextIndex + 1 : LIST_LIMIT;
  const shown = entries.length > limit + 1 ? entries.slice(0, limit) : entries;
  const folded = entries.slice(shown.length);
  return (
    <>
      <ol className="space-y-1">{shown.map(row)}</ol>
      {folded.length > 0 ? (
        <details className="group/more">
          <summary className="mx-3 mt-1 inline-flex cursor-pointer list-none items-center gap-1.5 rounded py-1.5 font-mono text-[11px] uppercase tracking-[0.12em] text-mist transition-colors hover:text-parchment [&::-webkit-details-marker]:hidden">
            <ChevronRight className="h-3.5 w-3.5 transition-transform group-open/more:rotate-90" strokeWidth={2} aria-hidden />
            <span className="group-open/more:hidden">Show {folded.length} more</span>
            <span className="hidden group-open/more:inline">Show fewer</span>
          </summary>
          <ol className="mt-1 space-y-1">{folded.map(row)}</ol>
        </details>
      ) : null}
    </>
  );
}

const PIP_LIMIT = 24;

function ObjectivePips({ objectives }: { objectives: PlanEntry[] }) {
  const extra = objectives.length - PIP_LIMIT;
  return (
    <div className="flex max-w-[260px] flex-wrap items-center gap-[5px] sm:justify-end" aria-hidden>
      {objectives.slice(0, PIP_LIMIT).map((e) => {
        const cleared = isCleared(e);
        const color = itemTypeMeta(e.type).color;
        return (
          <span
            key={e.key}
            title={cleared ? "Cleared" : "Open"}
            className="h-[9px] w-[9px] rotate-45 rounded-[2px] border transition-all duration-500"
            style={
              cleared
                ? { background: "var(--gold)", borderColor: "var(--gold-bright)", boxShadow: "0 0 8px var(--gold)" }
                : { borderColor: color, background: "var(--ink-800)" }
            }
          />
        );
      })}
      {extra > 0 ? <span className="ml-1 font-mono text-[10.5px] text-mist">+{extra}</span> : null}
    </div>
  );
}

function SubHeading({
  icon,
  color,
  label,
  note,
  first,
}: {
  icon: React.ReactNode;
  color: string;
  label: string;
  note: string;
  first?: boolean;
}) {
  return (
    <div className={clsx("flex items-center gap-2 px-3 pb-1.5", first ? "pt-1" : "pt-3")}>
      <span className="inline-flex items-center gap-1.5 font-mono text-[10.5px] uppercase tracking-[0.14em]" style={{ color }}>
        {icon}
        {label}
      </span>
      <span className="h-px flex-1 bg-gradient-to-r from-ink-500 to-transparent" aria-hidden />
      <span className="text-[12px] text-mist-dim">{note}</span>
    </div>
  );
}

function WeekCleared({ week, hasMore }: { week: number; hasMore: boolean }) {
  return (
    <div className="relative mx-1 mt-3 overflow-hidden rounded-xl border border-gold/35 bg-[radial-gradient(120%_140%_at_50%_0%,rgba(233,196,106,0.14),transparent_60%)] px-5 py-6 text-center">
      <div aria-hidden className="pointer-events-none absolute inset-0">
        {[
          [6, 24],
          [5, 70],
          [24, 12],
          [74, 16],
          [95, 64],
          [92, 26],
          [60, 8],
        ].map(([x, y], i) => (
          <span
            key={i}
            className="absolute h-1 w-1 animate-twinkle rounded-full bg-gold-bright shadow-[0_0_6px_var(--gold)]"
            style={{ left: `${x}%`, top: `${y}%`, animationDelay: `${i * 0.6}s` }}
          />
        ))}
      </div>
      <div className="relative mx-auto grid h-11 w-11 place-items-center">
        <span className="absolute inset-1 rotate-45 rounded-[8px] border border-gold-bright bg-gradient-to-br from-gold-bright to-gold-deep shadow-[0_0_28px_-2px_var(--gold)]" />
        <Star className="relative h-5 w-5 fill-ink-900 text-ink-900" strokeWidth={1.5} />
      </div>
      <p className="relative mt-3 font-display text-[22px] font-medium text-gold-bright">Week {week} cleared</p>
      <p className="relative mt-1 text-[13.5px] text-parchment-dim">
        {hasMore ? "Every objective is done. Bank the time, or get ahead on the route." : "Every objective is done."}
      </p>
    </div>
  );
}

function EmptyNote({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <div className="flex items-start gap-3 px-3 py-4">
      <div className="mt-0.5">{icon}</div>
      <div>
        <p className="font-display text-[18px] text-parchment">{title}</p>
        <p className="mt-0.5 text-[13.5px] text-mist">{body}</p>
      </div>
    </div>
  );
}
