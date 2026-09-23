import { addDays, startOfWeek } from "@/lib/engine/dates";
import type { QuestContext } from "./context";
import { questSkillIds } from "./context";
import { hoursNumber } from "./format";
import { MaintenanceCard } from "./MaintenanceCard";
import { QuestStages, WeekTrack } from "./QuestTimeline";
import { StartQuestForm } from "./StartQuestForm";
import { WeekByWeek } from "./WeekByWeek";

/** The quest before it starts: what it is, what it takes, and "Start quest". */
export function QuestNotStarted({ ctx }: { ctx: QuestContext }) {
  const { quest, view, app } = ctx;
  const thisMonday = startOfWeek(app.today);
  const plannedMinutes = view.plan.reduce((s, e) => s + e.minutes, 0);
  const items = view.plan.filter((e) => e.kind === "item").length;
  const recalls = view.plan.filter((e) => e.kind === "recall").length;
  const skills = questSkillIds(quest).length;
  const defaultHours = quest.hoursPerWeek
    ? quest.hoursPerWeek.min === quest.hoursPerWeek.max
      ? String(quest.hoursPerWeek.min)
      : `${quest.hoursPerWeek.min}–${quest.hoursPerWeek.max}`
    : null;

  const stats = [
    { value: String(ctx.lastBoundedWeek), label: "weeks", note: ctx.hasOpenStage ? "+ follow-on" : null },
    { value: `~${hoursNumber(plannedMinutes)}`, label: "hours", note: defaultHours ? `${defaultHours} h / week` : null },
    { value: String(skills), label: "skills", note: `${recalls} recall checks` },
    { value: String(items), label: "items", note: `${quest.stages.length} stages` },
  ];

  return (
    <div className="space-y-10">
      <section aria-labelledby="quest-title" className="panel relative overflow-hidden">
        <div aria-hidden className="starfield pointer-events-none absolute inset-0 opacity-80" />
        <div aria-hidden className="pointer-events-none absolute -left-32 -top-40 h-[26rem] w-[40rem] rounded-full bg-gold/[0.08] blur-3xl" />
        <div aria-hidden className="pointer-events-none absolute -bottom-40 right-40 h-80 w-80 rounded-full bg-[#5ec8f2]/[0.06] blur-3xl" />

        <div className="relative grid lg:grid-cols-[minmax(0,1fr)_380px]">
          <div className="px-5 pb-7 pt-7 sm:px-10 sm:pb-10 sm:pt-10">
            <div className="hud-label flex items-center gap-2">
              <span>Quest</span>
              <span className="text-ink-400">·</span>
              <span className="text-parchment-dim">Not started</span>
            </div>
            <h1
              id="quest-title"
              className="mt-3 max-w-[16ch] font-display text-[38px] font-medium leading-[1.02] tracking-tight text-parchment sm:text-[56px]"
            >
              {quest.title}
            </h1>
            {quest.goal ? (
              <p className="mt-4 max-w-[58ch] text-[15px] leading-relaxed text-parchment-dim">
                <span className="text-gold">Goal — </span>
                {quest.goal}
              </p>
            ) : null}
            {quest.pace ? (
              <p className="mt-3 font-mono text-[12px] text-mist">
                <span className="hud-label mr-2 !text-[10px]">Pace</span>
                {quest.pace}
              </p>
            ) : null}

            <dl className="mt-8 grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-ink-600/60 bg-ink-600/40 sm:grid-cols-4">
              {stats.map((s) => (
                <div key={s.label} className="bg-ink-900/85 px-4 py-3.5">
                  <dt className="hud-label !text-[10px]">{s.label}</dt>
                  <dd className="mt-1 font-display text-[30px] font-medium leading-none text-gold-bright">{s.value}</dd>
                  {s.note ? <dd className="mt-1.5 font-mono text-[10.5px] text-mist">{s.note}</dd> : null}
                </div>
              ))}
            </dl>
          </div>

          <div className="border-t border-ink-600/60 bg-ink-900/55 px-5 py-7 backdrop-blur-sm sm:px-8 lg:border-l lg:border-t-0 lg:py-10">
            <h2 className="font-display text-[22px] font-medium">Begin the quest</h2>
            <p className="mt-1 text-[13px] leading-snug text-mist">
              The plan lays each stage&apos;s items over its weeks and adapts to what you actually finish. Only the start
              week is stored.
            </p>
            <div className="mt-5">
              <StartQuestForm
                questId={quest.id}
                thisMonday={thisMonday}
                nextMonday={addDays(thisMonday, 7)}
                defaultHours={defaultHours}
              />
            </div>
          </div>
        </div>

        <div className="relative border-t border-ink-600/60 bg-ink-950/40 px-5 pb-5 pt-4 sm:px-10">
          <div className="hud-label mb-1">The route</div>
          <WeekTrack ctx={ctx} preview />
        </div>
      </section>

      <QuestStages ctx={ctx} preview />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <WeekByWeek ctx={ctx} preview />
        <div className="lg:pt-[62px]">
          <MaintenanceCard ctx={ctx} />
        </div>
      </div>
    </div>
  );
}
