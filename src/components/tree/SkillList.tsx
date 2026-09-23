"use client";

// List view: every skill grouped by branch, in content order, with its state,
// ranks, progress, time and the next thing to do. Rows open the side panel;
// arrow keys move between rows.

import clsx from "clsx";
import { Flag, Star } from "lucide-react";
import { RankPips, StateBadge } from "@/components/ui/Badges";
import { ProgressBar } from "@/components/ui/Progress";
import type { TreeData } from "@/lib/view-model";
import { compactMinutes, hintColor, nextActionHint, type SkillMeta, type TreeModel } from "./model";
import { OrbArt } from "./Orb";

function moveFocus(from: HTMLElement, key: string) {
  const rows = Array.from(document.querySelectorAll<HTMLElement>("[data-skill-row]"));
  const i = rows.indexOf(from);
  if (i < 0) return false;
  const next =
    key === "ArrowDown" ? rows[i + 1] : key === "ArrowUp" ? rows[i - 1] : key === "Home" ? rows[0] : rows[rows.length - 1];
  next?.focus();
  return true;
}

export function SkillList({
  data,
  model,
  visible,
  selectedId,
  onSelect,
}: {
  data: TreeData;
  model: TreeModel;
  visible: Set<string> | null;
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const titleOf = (id: string) => model.byId.get(id)?.skill.title ?? id;
  const groups = [...data.branches.map((b) => b.id), ""]
    .map((branchId) => ({
      branchId,
      skills: model.skills.filter(
        (m) => (m.branch.id === branchId) && (!visible || visible.has(m.skill.id)),
      ),
    }))
    .filter((g) => g.skills.length > 0);

  if (groups.length === 0) {
    return (
      <div className="panel animate-rise px-6 py-10 text-center">
        <p className="font-display text-[20px] text-parchment">No skills match</p>
        <p className="mt-1.5 text-[13px] text-mist">Try a different search, or clear the state filter.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      {groups.map(({ branchId, skills }, gi) => {
        const first = skills[0];
        const branch = first.branch;
        const color = first.color;
        const stats = data.state.branches[branchId];
        return (
          <section
            key={branchId || "unsorted"}
            aria-labelledby={`branch-${branchId}`}
            className="panel animate-rise @container overflow-hidden"
            style={{ animationDelay: `${gi * 70}ms` }}
          >
            <header
              className="relative flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-ink-600/60 px-4 py-3.5 sm:px-5"
              style={{ background: `linear-gradient(90deg, color-mix(in oklab, ${color} 10%, transparent), transparent 60%)` }}
            >
              <span className="absolute inset-y-0 left-0 w-[2px]" style={{ background: color, boxShadow: `0 0 12px ${color}` }} />
              <h2 id={`branch-${branchId}`} className="font-display text-[21px] leading-tight text-parchment">
                {branch.title}
              </h2>
              <span className="font-mono text-[11.5px] uppercase tracking-[0.12em] text-mist">
                <span style={{ color }}>{stats?.learned ?? 0}</span> / {stats?.total ?? skills.length} learned
              </span>
              <ProgressBar
                value={stats?.progress ?? 0}
                color={color}
                className="ml-auto w-full sm:w-44"
                label={`${branch.title} progress`}
              />
            </header>

            <div className="hidden grid-cols-[22px_minmax(0,1fr)_118px_52px_92px_104px] gap-x-4 px-5 pb-1 pt-2.5 @2xl:grid" aria-hidden>
              <span />
              <span className="hud-label !text-[9.5px]">Skill · next step</span>
              <span className="hud-label !text-[9.5px]">State</span>
              <span className="hud-label !text-[9.5px]">Ranks</span>
              <span className="hud-label !text-[9.5px]">Progress</span>
              <span className="hud-label !text-[9.5px] text-right">Logged / est.</span>
            </div>

            <ul className="flex flex-col px-1.5 pb-1.5 @2xl:px-2 @2xl:pb-2">
              {skills.map((meta) => (
                <SkillRow
                  key={meta.skill.id}
                  meta={meta}
                  data={data}
                  selected={meta.skill.id === selectedId}
                  quest={model.questSkillIds.has(meta.skill.id)}
                  titleOf={titleOf}
                  onSelect={onSelect}
                />
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

function SkillRow({
  meta,
  data,
  selected,
  quest,
  titleOf,
  onSelect,
}: {
  meta: SkillMeta;
  data: TreeData;
  selected: boolean;
  quest: boolean;
  titleOf: (id: string) => string;
  onSelect: (id: string) => void;
}) {
  const { skill, view, color } = meta;
  const hint = nextActionHint(meta, data, titleOf);
  const locked = view.state === "locked";
  return (
    <li>
      <button
        type="button"
        data-skill-row
        aria-current={selected ? "true" : undefined}
        onClick={() => onSelect(skill.id)}
        onKeyDown={(e) => {
          if (["ArrowDown", "ArrowUp", "Home", "End"].includes(e.key) && moveFocus(e.currentTarget, e.key)) {
            e.preventDefault();
          }
        }}
        className={clsx(
          "group relative grid w-full grid-cols-[22px_minmax(0,1fr)_auto] items-center gap-x-3 rounded-[10px] px-2.5 py-2.5 text-left transition-colors @2xl:grid-cols-[22px_minmax(0,1fr)_118px_52px_92px_104px] @2xl:gap-x-4 @2xl:px-3",
          selected ? "bg-gold/[0.07] shadow-[inset_0_0_0_1px_rgba(233,196,106,0.35)]" : "hover:bg-ink-700/45",
        )}
      >
        {selected && <span className="absolute inset-y-2 left-0 w-[2px] rounded-full bg-gold shadow-[0_0_8px_var(--gold)]" />}
        <OrbArt
          state={view.state}
          color={color}
          slot={meta.branchIndex}
          progress={view.progress}
          size={22}
          className="transition-transform duration-200 group-hover:scale-110"
        />

        <span className="min-w-0">
          <span className="flex items-center gap-1.5">
            <span
              className={clsx(
                "truncate text-[14px] font-medium",
                locked ? "text-parchment-dim" : "text-parchment",
                selected && "!text-gold-bright",
              )}
            >
              {skill.title}
            </span>
            {view.starred && <Star className="h-3 w-3 shrink-0 fill-gold text-gold" strokeWidth={1.5} aria-label="Starred" />}
            {quest && <Flag className="h-3 w-3 shrink-0 fill-gold/40 text-gold" strokeWidth={2} aria-label="On this week's quest" />}
          </span>
          <span className="mt-0.5 flex min-w-0 items-center gap-2 text-[12px]">
            <span className="max-w-full shrink-0 truncate" style={{ color: hintColor(hint, color) }}>
              {hint.text}
            </span>
            <span className="hidden min-w-0 truncate font-mono text-[10.5px] text-mist-dim @4xl:inline">{skill.id}</span>
          </span>
        </span>

        <span className="justify-self-end @2xl:justify-self-start">
          <StateBadge state={view.state} />
        </span>
        <span className="hidden @2xl:block">
          {view.ranks.length > 0 ? <RankPips total={view.ranks.length} complete={view.ranksComplete} /> : null}
        </span>
        <span className="hidden items-center gap-2 @2xl:flex">
          <ProgressBar value={view.progress} color={color} className="flex-1" label={`${skill.title} progress`} />
          <span className="w-8 text-right font-mono text-[10.5px] tabular-nums text-mist">
            {Math.round(view.progress * 100)}%
          </span>
        </span>
        <span className="hidden whitespace-nowrap text-right font-mono text-[11.5px] tabular-nums @2xl:block">
          <span className={view.minutesLogged > 0 ? "text-parchment-dim" : "text-mist-dim"}>
            {view.minutesLogged > 0 ? compactMinutes(view.minutesLogged) : "0"}
          </span>
          <span className="text-mist-dim">
            {" / "}
            {skill.estimate?.hours != null ? compactMinutes(skill.estimate.hours * 60) : "—"}
          </span>
        </span>
      </button>
    </li>
  );
}
