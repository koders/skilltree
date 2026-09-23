import { Pause, Star } from "lucide-react";
import { formatMinutesShort } from "@/components/ui/meta";
import { isCleared, questSkillIds, type QuestContext } from "./context";
import { hoursNumber } from "./format";
import { MaintenanceCard } from "./MaintenanceCard";
import { QuestHeader } from "./QuestHeader";
import { QuestStages, StageCard, WeekTrack } from "./QuestTimeline";
import { ThisWeekCard } from "./ThisWeekCard";
import { WeekByWeek } from "./WeekByWeek";

/** A quest with a run: active, paused or completed. */
export function QuestActive({ ctx }: { ctx: QuestContext }) {
  const { view } = ctx;
  const currentStage = view.stages.find((s) => s.isCurrent) ?? null;

  return (
    <div className="space-y-10">
      <div className="space-y-5">
        <QuestHeader ctx={ctx} />

        <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
          <div className="min-w-0 space-y-4">
            {view.status === "paused" ? <PausedNote /> : null}
            {view.status === "completed" ? (
              <CompletedCard ctx={ctx} />
            ) : view.thisWeek ? (
              <ThisWeekCard ctx={ctx} thisWeek={view.thisWeek} />
            ) : null}
            <section aria-label="Route timeline" className="panel px-4 pb-4 pt-3 sm:px-6">
              <div className="hud-label">The route</div>
              <WeekTrack ctx={ctx} />
            </section>
          </div>

          <aside className="space-y-5" aria-label="Quest status">
            {/* Stacked on narrow screens, the Stages list right below already shows this card. */}
            {currentStage ? (
              <div className="hidden lg:block">
                <StageCard ctx={ctx} stage={currentStage} />
              </div>
            ) : null}
            <RouteLedger ctx={ctx} />
            <MaintenanceCard ctx={ctx} />
          </aside>
        </div>
      </div>

      <QuestStages ctx={ctx} />
      <WeekByWeek ctx={ctx} />
    </div>
  );
}

function PausedNote() {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-ink-500 bg-ink-800/70 px-4 py-3">
      <Pause className="mt-0.5 h-4 w-4 shrink-0 text-parchment-dim" strokeWidth={2.2} aria-hidden />
      <p className="text-[13.5px] leading-snug text-parchment-dim">
        <span className="text-parchment">Paused.</span> The calendar keeps running, so weeks you miss show up as
        carry-over. Resume when you&apos;re back, or re-plan from the schedule menu to move week 1.
      </p>
    </div>
  );
}

function CompletedCard({ ctx }: { ctx: QuestContext }) {
  const { view, quest } = ctx;
  const open = view.plan.filter((e) => !isCleared(e)).length;
  const learned = questSkillIds(quest).filter((id) => ctx.skill(id).learned).length;
  return (
    <section className="panel relative overflow-hidden px-6 py-10 text-center" aria-labelledby="completed-title">
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(80%_100%_at_50%_0%,rgba(233,196,106,0.16),transparent_65%)]" />
      <div className="relative mx-auto grid h-14 w-14 place-items-center">
        <span className="absolute inset-1.5 rotate-45 rounded-[10px] border border-gold-bright bg-gradient-to-br from-gold-bright to-gold-deep shadow-[0_0_36px_-4px_var(--gold)]" />
        <Star className="relative h-6 w-6 fill-ink-900 text-ink-900" strokeWidth={1.5} />
      </div>
      <h2 id="completed-title" className="relative mt-4 font-display text-[28px] font-medium text-gold-bright">
        Quest complete
      </h2>
      <p className="relative mx-auto mt-2 max-w-[48ch] text-[14px] leading-relaxed text-parchment-dim">
        {learned} of {questSkillIds(quest).length} skills learned, {Math.round(view.progress * 100)}% of the route cleared.
        {open > 0 ? ` ${open} objective${open === 1 ? " is" : "s are"} still open in the plan below.` : ""} Maintenance keeps
        the skills from going rusty.
      </p>
    </section>
  );
}

/** Totals for the whole route. */
function RouteLedger({ ctx }: { ctx: QuestContext }) {
  const { view, quest, app } = ctx;
  const skillIds = questSkillIds(quest);
  const skillSet = new Set(skillIds);
  const learned = skillIds.filter((id) => ctx.skill(id).learned).length;
  const planned = view.plan.reduce((s, e) => s + e.minutes, 0);
  const cleared = view.plan.filter(isCleared).reduce((s, e) => s + e.minutes, 0);
  const since = view.run?.startedOn ?? app.today;
  const logged = app.snapshot.timeLogs
    .filter((l) => l.skillId !== null && skillSet.has(l.skillId) && l.loggedOn >= since)
    .reduce((s, l) => s + l.minutes, 0);

  const rows = [
    { label: "Skills learned", value: `${learned}`, of: `/ ${skillIds.length}`, share: skillIds.length ? learned / skillIds.length : 0 },
    { label: "Route cleared", value: formatMinutesShort(cleared), of: `/ ${hoursNumber(planned)} h`, share: planned ? cleared / planned : 0 },
    { label: "Logged on the route", value: `${hoursNumber(logged)} h`, of: "since week 1", share: null },
    { label: "Weekly streak", value: `${app.state.xp.weeklyStreak}`, of: app.state.xp.weeklyStreak === 1 ? "week" : "weeks", share: null },
  ];

  return (
    <section className="panel p-4 sm:p-5" aria-labelledby="ledger-title">
      <h2 id="ledger-title" className="hud-label">
        Route ledger
      </h2>
      <dl className="mt-3 space-y-3">
        {rows.map((r) => (
          <div key={r.label}>
            <div className="flex items-baseline justify-between gap-3">
              <dt className="text-[12.5px] text-mist">{r.label}</dt>
              <dd className="font-mono text-[12px] text-mist">
                <span className="text-[14px] text-parchment">{r.value}</span> {r.of}
              </dd>
            </div>
            {r.share !== null ? (
              <div className="mt-1.5 h-[3px] overflow-hidden rounded-full bg-ink-600/70" aria-hidden>
                <div className="h-full rounded-full bg-gold/80" style={{ width: `${Math.round(r.share * 100)}%` }} />
              </div>
            ) : null}
          </div>
        ))}
      </dl>
    </section>
  );
}
