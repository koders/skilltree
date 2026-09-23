import type { Metadata } from "next";
import { HabitCard } from "@/components/habits/HabitCard";
import { buildHabitCards, groupByUnit, resetHint, summarize, type HabitCardModel } from "@/components/habits/model";
import { fmtHours, plural } from "@/components/journal/format";
import { HudStat, HudStrip, PageFrame, PageHeader, SectionHeading, StarGlyph } from "@/components/journal/PageFrame";
import { Markdown } from "@/components/ui/Markdown";
import { ProgressBar } from "@/components/ui/Progress";
import { getAppData } from "@/lib/data";

export const metadata: Metadata = { title: "Habits" };

export default async function HabitsPage() {
  const { habits, index, snapshot, today, quests, activeQuest } = await getAppData();
  const cards = buildHabitCards(habits, index, snapshot, today);
  const active = cards.filter((c) => c.active);
  const inactive = cards.filter((c) => !c.active);
  const summary = summarize(habits, index, snapshot, quests, activeQuest, today);
  const periodEnds = new Map(habits.map((h) => [h.cadence.unit, h.periodEnd]));

  return (
    <PageFrame>
      <PageHeader
        plate="III"
        eyebrow="Maintenance"
        title="Habits"
        subtitle="The weeklies and monthlies that keep learned skills from rusting. Check one off when it's done; the time counts as XP."
      >
        <Summary summary={summary} />
      </PageHeader>

      <section className="mt-12" aria-labelledby="habits-active">
        <SectionHeading id="habits-active" eyebrow="In rotation" title="Active" count={active.length} />
        {active.length === 0 ? (
          <div className="mt-5 rounded-[var(--radius)] border border-dashed border-ink-500 bg-ink-900/40 px-5 py-8 text-center">
            <StarGlyph className="mx-auto h-4 w-4 text-ink-400" />
            <p className="mt-3 font-display text-[18px] text-parchment">No habits in rotation yet</p>
            <p className="mx-auto mt-1.5 max-w-[52ch] text-[13.5px] text-mist">
              Quest maintenance switches on in its follow-on weeks, and a skill&apos;s monthly or yearly habits unlock once you
              start that skill. Everything waiting is listed below.
            </p>
          </div>
        ) : (
          <div className="mt-6 space-y-10">
            {groupByUnit(active).map((group) => (
              <div key={group.unit}>
                <div className="mb-3.5 flex items-center gap-3">
                  <h3 className="font-mono text-[11px] uppercase tracking-[0.16em] text-type-habit">{group.label}</h3>
                  <span className="h-px flex-1 bg-gradient-to-r from-ink-500 to-transparent" />
                  {periodEnds.has(group.unit) && (
                    <span className="font-mono text-[11px] text-mist">
                      {resetHint(group.unit, periodEnds.get(group.unit)!, today)}
                    </span>
                  )}
                </div>
                <HabitGrid cards={group.cards} />
              </div>
            ))}
          </div>
        )}
      </section>

      {inactive.length > 0 && (
        <section className="mt-16" aria-labelledby="habits-inactive">
          <SectionHeading id="habits-inactive" eyebrow="Waiting to unlock" title="Not yet active" count={inactive.length} />
          <div className="mt-6 opacity-80">
            <HabitGrid cards={inactive} />
          </div>
        </section>
      )}
    </PageFrame>
  );
}

function HabitGrid({ cards }: { cards: HabitCardModel[] }) {
  return (
    <ul className="grid gap-3.5 md:grid-cols-2">
      {cards.map((card, i) => (
        <li key={card.key} className="animate-rise" style={{ animationDelay: `${Math.min(i, 8) * 45}ms` }}>
          <HabitCard
            habit={card}
            title={
              <Markdown inline className={card.active ? "!text-parchment" : undefined}>
                {card.title}
              </Markdown>
            }
          />
        </li>
      ))}
    </ul>
  );
}

function Summary({ summary }: { summary: ReturnType<typeof summarize> }) {
  const target = summary.targetMinutes;
  return (
    <HudStrip className="grid-cols-2 sm:grid-cols-3">
      <HudStat
        label="Maintenance · this week"
        className="col-span-2 sm:col-span-1"
        value={
          <>
            <span>{fmtHours(summary.maintenanceMinutes)}</span>
            <span className="text-[13px] text-mist">{target !== null ? `/ ${fmtHours(target)} h` : "h"}</span>
          </>
        }
        sub={summary.questNote ?? (summary.questTitle ? "Quest maintenance target" : undefined)}
      >
        {target !== null && (
          <ProgressBar
            className="mt-2.5 w-full"
            value={target > 0 ? summary.maintenanceMinutes / target : 0}
            color="var(--type-habit)"
            label="Maintenance time this week"
          />
        )}
      </HudStat>
      <HudStat
        label="Complete"
        value={
          <>
            <span className={summary.activeCount > 0 && summary.completeCount === summary.activeCount ? "text-gold-bright" : ""}>
              {summary.completeCount}
            </span>
            <span className="text-[13px] text-mist">/ {summary.activeCount}</span>
          </>
        }
        sub={summary.activeCount === 0 ? "None active yet" : `of ${plural(summary.activeCount, "active habit")}, this period`}
      />
      <HudStat
        label="Best streak"
        value={
          summary.bestStreak ? (
            <span className="text-gold">{summary.bestStreak.streak}</span>
          ) : (
            <span className="text-mist-dim">0</span>
          )
        }
        sub={summary.bestStreak ? plural(summary.bestStreak.streak, summary.bestStreak.unit).replace(/^\d+ /, "") : "periods in a row"}
      />
    </HudStrip>
  );
}
