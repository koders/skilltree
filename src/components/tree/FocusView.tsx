"use client";

// Focus view: "what do I do now". Only skills in play, each expanded to the
// items still blocking it, grouped by why they matter this week.

import clsx from "clsx";
import { ArrowUpRight, Brain, Flag, Hourglass, Lock, Sparkles, Star, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { RankPips, StateBadge, TypeBadge } from "@/components/ui/Badges";
import { formatMinutesShort } from "@/components/ui/meta";
import { ProgressBar } from "@/components/ui/Progress";
import type { TreeData } from "@/lib/view-model";
import { estimateLabel, lockedRankNote, matchesQuery, openBlockingItems, plainText, type SkillMeta, type TreeModel } from "./model";
import { NEUTRAL_ORB, OrbArt } from "./Orb";

type SectionId = "quest" | "ready" | "progress" | "rusty" | "available" | "starred";

const SECTIONS: { id: SectionId; title: string; blurb: string }[] = [
  { id: "quest", title: "This week’s quest", blurb: "Planned for this week, or carried over." },
  { id: "ready", title: "Ready to complete", blurb: "Every rank done. Answer Recall to learn it." },
  { id: "progress", title: "In progress", blurb: "Pick up where you left off." },
  { id: "rusty", title: "Rusty — re-verify", blurb: "Facts past their freshness window." },
  { id: "available", title: "Available to start or test out", blurb: "Unlocked and waiting." },
  { id: "starred", title: "Starred", blurb: "Marked as important." },
];

const MAX_ITEMS = 5;

function sectionOf(meta: SkillMeta, quest: Set<string>): SectionId | null {
  const v = meta.view;
  if (quest.has(meta.skill.id) && !v.learned) return "quest";
  if (v.readyToComplete) return "ready";
  if (v.state === "in-progress") return "progress";
  if (v.state === "rusty") return "rusty";
  if (v.state === "available") return "available";
  if (v.starred) return "starred";
  return null;
}

export function FocusView({
  data,
  model,
  query,
  selectedId,
  onSelect,
  neutralSlot,
}: {
  data: TreeData;
  model: TreeModel;
  query: string;
  selectedId: string | null;
  onSelect: (id: string) => void;
  neutralSlot: number;
}) {
  const bySection = new Map<SectionId, SkillMeta[]>();
  let inPlay = 0;
  for (const meta of model.skills) {
    const section = sectionOf(meta, model.questSkillIds);
    if (!section) continue;
    inPlay += 1;
    if (!matchesQuery(meta, query)) continue;
    bySection.set(section, [...(bySection.get(section) ?? []), meta]);
  }
  // The quest's own order is the plan order.
  const questOrder = data.activeQuest?.thisWeekSkillIds ?? [];
  bySection.get("quest")?.sort((a, b) => questOrder.indexOf(a.skill.id) - questOrder.indexOf(b.skill.id));

  const titleOf = (id: string) => model.byId.get(id)?.skill.title ?? id;
  const shown = SECTIONS.filter((s) => (bySection.get(s.id)?.length ?? 0) > 0);

  if (shown.length === 0) {
    return (
      <div className="panel animate-rise flex flex-col items-center px-6 py-12 text-center">
        <OrbArt state="locked" color={NEUTRAL_ORB} slot={neutralSlot} size={48} />
        {inPlay > 0 ? (
          <>
            <p className="mt-4 font-display text-[20px] text-parchment">Nothing in focus matches</p>
            <p className="mt-1.5 text-[13px] text-mist">Clear the search to see all {inPlay} skills in play.</p>
          </>
        ) : (
          <>
            <p className="mt-4 font-display text-[20px] text-parchment">Nothing in play right now</p>
            <p className="mt-1.5 max-w-sm text-[13px] text-mist">
              Everything is either learned or still locked. Star a skill, or start the quest, to bring it into focus.
            </p>
          </>
        )}
      </div>
    );
  }

  const order = new Map(shown.flatMap((s) => bySection.get(s.id) ?? []).map((m, i) => [m.skill.id, i]));
  return (
    <div className="flex flex-col gap-8">
      {shown.map((section) => {
        const skills = bySection.get(section.id) ?? [];
        return (
          <section key={section.id} aria-labelledby={`focus-${section.id}`}>
            <header className="mb-3 flex flex-wrap items-end gap-x-3 gap-y-1 px-1">
              <h2 id={`focus-${section.id}`} className="font-display text-[22px] leading-tight text-parchment">
                {section.title}
              </h2>
              <span className="pb-[3px] font-mono text-[11px] tabular-nums text-mist-dim">{skills.length}</span>
              <p className="w-full text-[12.5px] text-mist sm:ml-auto sm:w-auto sm:pb-[3px]">
                {section.id === "quest" && data.activeQuest ? (
                  <Link href="/quest" className="inline-flex items-center gap-1 text-gold hover:text-gold-bright">
                    {data.activeQuest.title}
                    {data.activeQuest.currentWeek ? ` · week ${data.activeQuest.currentWeek}` : ""}
                    <ArrowUpRight className="h-3.5 w-3.5" />
                  </Link>
                ) : (
                  section.blurb
                )}
              </p>
            </header>
            <div className="flex flex-col gap-3">
              {skills.map((meta) => (
                <FocusCard
                  key={meta.skill.id}
                  meta={meta}
                  data={data}
                  model={model}
                  section={section.id}
                  selected={meta.skill.id === selectedId}
                  titleOf={titleOf}
                  onSelect={onSelect}
                  delay={Math.min(12, order.get(meta.skill.id) ?? 0) * 50}
                />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function FocusCard({
  meta,
  data,
  model,
  section,
  selected,
  titleOf,
  onSelect,
  delay,
}: {
  meta: SkillMeta;
  data: TreeData;
  model: TreeModel;
  section: SectionId;
  selected: boolean;
  titleOf: (id: string) => string;
  onSelect: (id: string) => void;
  delay: number;
}) {
  const { skill, view, color, branch } = meta;
  const open = openBlockingItems(meta, data);
  if (section === "quest") {
    // This week's slice first.
    open.sort((a, b) => Number(model.questItemKeys.has(b.item.key)) - Number(model.questItemKeys.has(a.item.key)));
  }
  const shown = open.slice(0, MAX_ITEMS);
  const more = open.length - shown.length;
  const quest = model.questSkillIds.has(skill.id);
  // A rank waiting on another skill (Market Intelligence's Rank 2): say so rather than leave the card empty.
  const rankNote = lockedRankNote(view, titleOf);
  const select = () => onSelect(skill.id);
  const itemBtn =
    "group/item grid w-full grid-cols-[30px_76px_minmax(0,1fr)_auto] items-center gap-x-2.5 rounded-lg px-2 py-2 text-left transition-colors hover:bg-ink-700/50 max-sm:grid-cols-[30px_minmax(0,1fr)_auto]";

  return (
    <article
      className={clsx(
        "panel animate-rise relative overflow-hidden transition-shadow",
        selected && "shadow-[0_0_0_1px_rgba(233,196,106,0.55),0_24px_60px_-20px_rgba(0,0,0,0.6)]",
      )}
      style={{ animationDelay: `${delay}ms` }}
    >
      <span className="absolute inset-y-0 left-0 w-[2px]" style={{ background: color, boxShadow: `0 0 12px ${color}` }} />
      <button
        type="button"
        onClick={select}
        aria-current={selected ? "true" : undefined}
        className="group flex w-full items-start gap-3.5 px-4 pb-3 pt-4 text-left sm:px-5"
      >
        <OrbArt
          state={view.state}
          color={color}
          slot={meta.branchIndex}
          progress={view.progress}
          size={40}
          className="mt-0.5 shrink-0 transition-transform duration-200 group-hover:scale-110"
        />
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="font-display text-[18px] leading-snug text-parchment group-hover:text-gold-bright">
              {skill.title}
            </span>
            {view.starred && <Star className="h-3.5 w-3.5 fill-gold text-gold" strokeWidth={1.5} aria-label="Starred" />}
            {quest && section !== "quest" && (
              <Flag className="h-3.5 w-3.5 fill-gold/40 text-gold" strokeWidth={2} aria-label="On this week's quest" />
            )}
          </span>
          <span className="mt-1 flex flex-wrap items-center gap-y-1 font-mono text-[11px] text-mist">
            <span style={{ color }}>{branch.title}</span>
            <span className="whitespace-nowrap">
              <span className="px-2 text-ink-400">·</span>
              {Math.round(view.progress * 100)}%
            </span>
            <span className="whitespace-nowrap">
              <span className="px-2 text-ink-400">·</span>
              {view.minutesLogged > 0 ? formatMinutesShort(view.minutesLogged) : "0 min"} of {estimateLabel(skill)}
            </span>
          </span>
        </span>
        <span className="flex shrink-0 flex-col items-end gap-2">
          <StateBadge state={view.state} />
          {view.ranks.length > 0 && <RankPips total={view.ranks.length} complete={view.ranksComplete} />}
        </span>
      </button>

      <div className="px-4 sm:px-5">
        <ProgressBar value={view.progress} color={color} className="!h-1" label={`${skill.title} progress`} />
      </div>

      <div className="px-2 pb-2 pt-2 sm:px-3">
        {section === "ready" || view.readyToComplete ? (
          <button type="button" onClick={select} className={clsx(itemBtn, "!grid-cols-[30px_minmax(0,1fr)_auto]")}>
            <span className="grid h-6 w-6 place-items-center rounded-full bg-gold/15 text-gold">
              <Brain className="h-3.5 w-3.5" />
            </span>
            <span className="text-[13.5px] text-gold-bright">
              Answer {skill.recall.length} Recall question{skill.recall.length === 1 ? "" : "s"} to learn it
            </span>
            <span className="font-mono text-[10.5px] uppercase tracking-[0.12em] text-gold">Complete</span>
          </button>
        ) : section === "rusty" ? (
          view.rust.stale.map((s) => {
            const item = skill.ranks.flatMap((r) => r.items).find((it) => it.id === s.itemId);
            return (
              <button key={s.itemKey} type="button" onClick={select} className={itemBtn}>
                <span className="grid h-6 w-6 place-items-center rounded-full bg-rust/15 text-rust-bright">
                  <TriangleAlert className="h-3.5 w-3.5" />
                </span>
                <span className="max-sm:hidden">
                  <TypeBadge type={item?.type ?? null} />
                </span>
                <span className="truncate text-[13.5px] text-parchment-dim group-hover/item:text-parchment">
                  {item ? plainText(item.title) : s.itemId}
                </span>
                <span className="font-mono text-[10.5px] text-rust-bright">stale {s.daysStale} d</span>
              </button>
            );
          })
        ) : (
          <>
            {view.canTestOut && (section === "available" || section === "starred") && (
              <button type="button" onClick={select} className={clsx(itemBtn, "!grid-cols-[30px_minmax(0,1fr)_auto]")}>
                <span className="grid h-6 w-6 place-items-center rounded-full bg-gold/10 text-gold">
                  <Sparkles className="h-3.5 w-3.5" />
                </span>
                <span className="text-[13.5px] text-parchment">
                  Already know it? Test out with {skill.recall.length} Recall question{skill.recall.length === 1 ? "" : "s"}
                </span>
                <span className="font-mono text-[10.5px] uppercase tracking-[0.12em] text-gold">Test out</span>
              </button>
            )}
            {view.state === "locked" && (
              <div className="flex items-center gap-2.5 px-2 py-2 text-[13px] text-mist">
                <Lock className="h-3.5 w-3.5 shrink-0" />
                Needs {view.missingRequires.map(titleOf).join(", ")}
              </div>
            )}
            {shown.map(({ item, rank }) => {
              const iv = data.state.items[item.key];
              const thisWeek = model.questItemKeys.has(item.key);
              return (
                <button key={item.key} type="button" onClick={select} className={itemBtn}>
                  <span className="font-mono text-[10px] tracking-[0.08em] text-mist-dim">R{rank}</span>
                  <span className="max-sm:hidden">
                    <TypeBadge type={item.type} />
                  </span>
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="truncate text-[13.5px] text-parchment-dim group-hover/item:text-parchment">
                      {plainText(item.title)}
                    </span>
                    {thisWeek && (
                      <span className="flex shrink-0 items-center gap-1 font-mono text-[9.5px] uppercase tracking-[0.12em] text-gold/90">
                        <Flag className="h-2.5 w-2.5 fill-gold/40" strokeWidth={2} />
                        This week
                      </span>
                    )}
                    {iv?.stale && <Hourglass className="h-3 w-3 shrink-0 text-stale" aria-label="Stale fact" />}
                  </span>
                  <span className="font-mono text-[11px] tabular-nums text-mist">{formatMinutesShort(item.minutes)}</span>
                </button>
              );
            })}
            {more > 0 && (
              <button
                type="button"
                onClick={select}
                className="ml-2 mt-0.5 rounded px-1 py-1 font-mono text-[11px] text-mist hover:text-gold"
              >
                + {more} more item{more === 1 ? "" : "s"}
              </button>
            )}
            {rankNote && (
              <div className="flex items-center gap-2.5 px-2 py-2 text-[13px] text-mist">
                <Lock className="h-3.5 w-3.5 shrink-0" />
                {rankNote}
              </div>
            )}
            {view.learned && section === "starred" && (
              <div className="px-2 py-2 text-[13px] text-mist">Learned. Nothing left to do.</div>
            )}
          </>
        )}
      </div>
    </article>
  );
}
