"use client";

import clsx from "clsx";
import { useOptimistic } from "react";
import { setSkillStarred } from "@/app/actions";
import { RankPips, StarToggleIcon, StateBadge } from "@/components/ui/Badges";
import { ProgressRing } from "@/components/ui/Progress";
import { useAction } from "@/components/ui/useAction";
import { usePanel } from "./context";
import { formatDay, formatInstant, formatMinutesCompact } from "./format";
import { Sparkle } from "./parts";
import styles from "./skill.module.css";

export function PanelHeader() {
  const { data, skill, view, color } = usePanel();
  const branch = data.branches.find((b) => b.id === skill.branchId);
  const pct = Math.round(view.progress * 100);
  const learnedLike = view.learned;

  return (
    <header className="relative px-5 pb-5 pt-5 sm:px-6">
      <div aria-hidden className={clsx("pointer-events-none absolute inset-x-0 top-0 h-56", styles.nebula)} />
      <div aria-hidden className={clsx("pointer-events-none absolute inset-x-0 top-0 h-40 opacity-70", styles.stars)} />

      <div className="relative">
        <div className="flex items-center gap-2 pr-20">
          <span
            aria-hidden
            className="h-2 w-2 rounded-full"
            style={{ background: color, boxShadow: `0 0 10px ${color}` }}
          />
          <span className="hud-label truncate" style={{ color: `color-mix(in oklab, ${color} 70%, var(--parchment))` }}>
            {branch?.title ?? skill.branchId}
          </span>
        </div>

        <h2 className="mt-2 pr-4 font-display text-[26px] font-medium leading-[1.12] tracking-[-0.01em] text-parchment [text-wrap:balance]">
          {skill.title}
        </h2>
        <p className="mt-1 font-mono text-[10.5px] tracking-wide text-mist-dim">{skill.id}</p>

        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5">
          <StateBadge state={view.state} />
          {skill.estimate && (
            <span className="font-mono text-[11.5px] text-parchment-dim" title="Estimated time">
              {skill.estimate.text}
            </span>
          )}
          {skill.factsAsOf && (
            <span className="font-mono text-[11px] text-mist-dim" title="Time-sensitive facts checked on this date">
              facts as of {formatDay(skill.factsAsOf, data.today)}
            </span>
          )}
        </div>

        <dl className="mt-4 grid grid-cols-[auto_1fr_1fr_1fr] items-center rounded-xl border border-ink-600/80 bg-ink-900/55 shadow-[inset_0_1px_0_rgba(236,230,214,0.04)]">
          <div className="border-r border-ink-600/70 px-3 py-2.5">
            <dt className="sr-only">Progress</dt>
            <dd>
              <ProgressRing value={view.progress} size={52} stroke={3} color={learnedLike ? "var(--gold-bright)" : "var(--gold)"}>
                {learnedLike ? (
                  <Sparkle className="!h-4 !w-4 text-gold-bright drop-shadow-[0_0_6px_var(--gold)]" />
                ) : (
                  <span className="font-mono text-[12px] font-medium text-parchment">{pct}%</span>
                )}
              </ProgressRing>
            </dd>
          </div>
          <HudCell label="Ranks">
            {view.ranks.length > 0 ? (
              <span className="flex items-center gap-2">
                <RankPips total={view.ranks.length} complete={view.ranksComplete} />
                <span className="text-parchment-dim">
                  {view.ranksComplete}/{view.ranks.length}
                </span>
              </span>
            ) : (
              <span className="text-mist-dim">—</span>
            )}
          </HudCell>
          <HudCell label="Logged">
            <span className={view.minutesLogged > 0 ? "text-parchment" : "text-mist-dim"}>
              {view.minutesLogged > 0 ? formatMinutesCompact(view.minutesLogged) : "—"}
            </span>
          </HudCell>
          <HudCell label="XP" last>
            <span className={view.xp > 0 ? "text-gold-bright" : "text-mist-dim"}>{view.xp.toLocaleString("en")}</span>
          </HudCell>
        </dl>

        {view.lastTestOut && (
          <p className="mt-2.5 font-mono text-[11px] text-mist">
            Last test-out:{" "}
            <span className={view.lastTestOut.passed === view.lastTestOut.total ? "text-gold" : "text-parchment-dim"}>
              {view.lastTestOut.passed}/{view.lastTestOut.total}
            </span>{" "}
            on {formatInstant(view.lastTestOut.at, data.today)}
          </p>
        )}
      </div>
    </header>
  );
}

function HudCell({ label, children, last }: { label: string; children: React.ReactNode; last?: boolean }) {
  return (
    <div className={clsx("min-w-0 px-3 py-2.5", !last && "border-r border-ink-600/70")}>
      <dt className="hud-label !text-[9.5px]">{label}</dt>
      <dd className="mt-1 truncate font-mono text-[13px]">{children}</dd>
    </div>
  );
}

/** Star / unstar, applied optimistically. */
export function StarToggle() {
  const { skill, view } = usePanel();
  const { run } = useAction();
  const [starred, setStarredOptimistic] = useOptimistic(view.starred);
  return (
    <button
      type="button"
      aria-pressed={starred}
      aria-label={starred ? "Unstar skill" : "Star skill"}
      title={starred ? "Starred: shown in the focus view" : "Star: keep it in the focus view"}
      onClick={() => {
        const next = !starred;
        void run(async () => {
          setStarredOptimistic(next);
          return setSkillStarred({ skillId: skill.id, starred: next });
        });
      }}
      className="grid h-8 w-8 place-items-center rounded-lg transition-colors hover:bg-ink-700/80"
    >
      <StarToggleIcon on={starred} />
    </button>
  );
}
