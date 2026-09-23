import type { Metadata } from "next";
import { ActivityFeed } from "@/components/journal/ActivityFeed";
import { BranchProgress, XpByActivity } from "@/components/journal/Breakdowns";
import { buildFeed } from "@/components/journal/feed";
import { fmtHours, plural } from "@/components/journal/format";
import { LevelCard } from "@/components/journal/LevelCard";
import { LogTimeForm, type SkillOptionGroup } from "@/components/journal/LogTimeForm";
import { PageFrame, PageHeader, SectionHeading } from "@/components/journal/PageFrame";
import { WeeklyChart } from "@/components/journal/WeeklyChart";
import { branchColor } from "@/components/ui/meta";
import { getAppData } from "@/lib/data";

export const metadata: Metadata = { title: "Journal" };

export default async function JournalPage() {
  const { tree, index, snapshot, state, activeQuest, today } = await getAppData();
  const xp = state.xp;
  const days = buildFeed(index, snapshot, today);
  const colors = Object.fromEntries(tree.branches.map((b, i) => [b.id, branchColor(b, i)]));
  const titles = Object.fromEntries(tree.skills.map((s) => [s.id, s.title]));
  const groups: SkillOptionGroup[] = tree.branches.map((b) => ({
    branch: b.title,
    skills: b.skillIds.flatMap((id) => (index.skills[id] ? [{ id, title: index.skills[id].title }] : [])),
  }));
  const target = activeQuest?.thisWeek?.targetMinutes ?? null;

  return (
    <PageFrame>
      <PageHeader
        plate="V"
        eyebrow="Ship's log"
        title="Journal"
        subtitle={
          <>
            Levels, hours and everything that happened, day by day.{" "}
            {xp.weeklyStreak > 0 ? (
              <span className="text-gold">
                {plural(xp.weeklyStreak, "week")} streak, {fmtHours(xp.thisWeekMinutes)} h so far this week.
              </span>
            ) : (
              <span>{fmtHours(xp.thisWeekMinutes)} h logged this week.</span>
            )}
          </>
        }
      />

      <div className="mt-10 grid gap-4 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <div className="animate-rise">
          <LevelCard xp={xp} />
        </div>
        <div className="animate-rise [animation-delay:60ms]">
          <WeeklyChart weeks={xp.weeks} target={target} streak={xp.weeklyStreak} today={today} />
        </div>
        <div className="animate-rise [animation-delay:120ms]">
          <XpByActivity xp={xp} />
        </div>
        <div className="animate-rise [animation-delay:180ms]">
          <BranchProgress branches={tree.branches} views={state.branches} skills={state.skills} titles={titles} colors={colors} />
        </div>
      </div>

      <div className="mt-16 grid gap-10 lg:grid-cols-[minmax(0,1fr)_340px] lg:gap-12">
        <aside className="lg:order-2" aria-labelledby="log-time">
          <div className="rounded-[var(--radius)] border border-ink-600/80 bg-ink-850/70 p-5 lg:sticky lg:top-[calc(var(--topbar-h)+20px)]">
            <h2 id="log-time" className="font-display text-[20px] font-normal text-parchment">
              Log time
            </h2>
            <p className="mb-5 mt-1 text-[12.5px] text-mist">For work that isn&apos;t an item: a stray video, a rabbit hole, a review.</p>
            <LogTimeForm groups={groups} today={today} />
          </div>
        </aside>

        <section className="min-w-0 lg:order-1" aria-labelledby="activity">
          <SectionHeading id="activity" eyebrow="Newest first" title="Activity" className="mb-5" />
          <ActivityFeed days={days} today={today} />
        </section>
      </div>
    </PageFrame>
  );
}
