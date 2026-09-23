import clsx from "clsx";
import { Brain, Clock, type LucideIcon } from "lucide-react";
import type { Branch } from "@/lib/content/types";
import type { BranchView, SkillView, XpSummary } from "@/lib/engine/types";
import type { Activity } from "@/lib/progress/types";
import { ITEM_TYPE_META, SKILL_STATE_META } from "@/components/ui/meta";
import { StarGlyph } from "./PageFrame";

const ACTIVITY_META: Record<Activity, { label: string; color: string; icon: LucideIcon }> = {
  watch: ITEM_TYPE_META.watch,
  read: ITEM_TYPE_META.read,
  do: ITEM_TYPE_META.do,
  build: ITEM_TYPE_META.build,
  output: ITEM_TYPE_META.output,
  habit: ITEM_TYPE_META.habit,
  review: { label: "Review", color: "var(--type-recall)", icon: Brain },
  other: { label: "Other", color: "var(--mist)", icon: Clock },
};

const ACTIVITY_ORDER: Activity[] = ["watch", "read", "do", "build", "output", "habit", "review", "other"];

function Panel({ id, title, sub, children }: { id: string; title: string; sub: React.ReactNode; children: React.ReactNode }) {
  return (
    <section aria-labelledby={id} className="h-full rounded-[var(--radius)] border border-ink-600/80 bg-ink-850/70 p-5 sm:p-6">
      <h2 id={id} className="font-display text-[20px] font-normal text-parchment">
        {title}
      </h2>
      <p className="mt-1 text-[12.5px] text-mist">{sub}</p>
      <div className="mt-5">{children}</div>
    </section>
  );
}

export function XpByActivity({ xp }: { xp: XpSummary }) {
  const rows = [
    ...ACTIVITY_ORDER.map((a) => ({ key: a, ...ACTIVITY_META[a], value: xp.byActivity[a] ?? 0 })),
    { key: "recall", ...ITEM_TYPE_META.recall, label: "Recall", value: xp.recallBonus },
  ]
    .filter((r) => r.value > 0)
    .sort((a, b) => b.value - a.value);
  const max = Math.max(1, ...rows.map((r) => r.value));
  const active = ["do", "build", "output"].reduce((s, a) => s + (xp.byActivity[a as Activity] ?? 0), 0);
  const logged = Object.values(xp.byActivity).reduce((s, v) => s + (v ?? 0), 0);

  return (
    <Panel
      id="xp-activity"
      title="XP by activity"
      sub={
        logged > 0
          ? `${Math.round((active / logged) * 100)}% of logged XP from active work (do, build, output)`
          : "Active work (do, build, output) earns up to 2× per minute"
      }
    >
      {rows.length === 0 ? (
        <p className="rounded-lg border border-dashed border-ink-500 px-4 py-6 text-center text-[13px] text-mist">
          No XP yet. Log time or finish an item to start the tally.
        </p>
      ) : (
        <ul className="space-y-3">
          {rows.map((r) => {
            const Icon = r.icon;
            return (
              <li key={r.key} className="grid grid-cols-[88px_1fr_auto] items-center gap-3 sm:grid-cols-[110px_1fr_auto]">
                <span className="flex items-center gap-2 truncate text-[12.5px] text-parchment-dim">
                  <Icon className="h-3.5 w-3.5 shrink-0" strokeWidth={1.9} style={{ color: r.color }} />
                  {r.label}
                </span>
                <span className="h-2 overflow-hidden rounded-full bg-ink-700/80">
                  <span
                    className="block h-full rounded-full"
                    style={{
                      width: `${Math.max(2, (r.value / max) * 100)}%`,
                      background: r.color,
                      boxShadow: `0 0 10px color-mix(in oklab, ${r.color} 60%, transparent)`,
                    }}
                  />
                </span>
                <span className="w-16 text-right font-mono text-[12px] text-parchment">
                  {r.value.toLocaleString("en")}
                  <span className="ml-1 text-[10px] text-mist">XP</span>
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </Panel>
  );
}

export function BranchProgress({
  branches,
  views,
  skills,
  titles,
  colors,
}: {
  branches: Branch[];
  views: Record<string, BranchView>;
  skills: Record<string, SkillView>;
  titles: Record<string, string>;
  colors: Record<string, string>;
}) {
  const learned = branches.reduce((s, b) => s + (views[b.id]?.learned ?? 0), 0);
  const total = branches.reduce((s, b) => s + (views[b.id]?.total ?? 0), 0);
  return (
    <Panel id="branch-progress" title="Branches" sub={`${learned} of ${total} skills learned across the tree`}>
      <ul className="space-y-5">
        {branches.map((b) => {
          const view = views[b.id];
          if (!view) return null;
          const color = colors[b.id];
          return (
            <li key={b.id}>
              <div className="flex items-baseline justify-between gap-3">
                <span className="flex min-w-0 items-center gap-2 text-[13.5px] text-parchment">
                  <StarGlyph className="h-3 w-3" style={{ color, filter: `drop-shadow(0 0 4px ${color})` }} />
                  <span className="truncate">{b.title}</span>
                </span>
                <span className="shrink-0 font-mono text-[12px] text-parchment">
                  {view.learned}
                  <span className="text-mist">/{view.total}</span>
                  <span className="ml-2 text-[10.5px] text-mist">{Math.round(view.progress * 100)}%</span>
                </span>
              </div>
              {/* one segment per skill, filled by its own progress */}
              <div className="mt-2 flex gap-[3px]" role="img" aria-label={`${b.title}: ${view.learned} of ${view.total} skills learned`}>
                {b.skillIds.map((id) => {
                  const s = skills[id];
                  if (!s) return null;
                  const rusty = s.state === "rusty";
                  const fill = rusty ? "var(--rust-bright)" : color;
                  return (
                    <span
                      key={id}
                      title={`${titles[id] ?? id} · ${SKILL_STATE_META[s.state].label}`}
                      className={clsx("h-2 flex-1 overflow-hidden rounded-[2px] bg-ink-700/80", s.locked && "opacity-50")}
                    >
                      <span
                        className="block h-full"
                        style={{
                          width: `${s.progress * 100}%`,
                          background: s.learned ? fill : `color-mix(in oklab, ${fill} 55%, transparent)`,
                          boxShadow: s.learned ? `0 0 8px ${fill}` : undefined,
                        }}
                      />
                    </span>
                  );
                })}
              </div>
              <p className="mt-1.5 flex flex-wrap gap-x-3 font-mono text-[10.5px] text-mist">
                {view.inProgress > 0 && <span>{view.inProgress} in progress</span>}
                {view.available > 0 && <span>{view.available} available</span>}
                {view.locked > 0 && <span>{view.locked} locked</span>}
                {view.rusty > 0 && <span className="text-rust-bright">{view.rusty} rusty</span>}
              </p>
            </li>
          );
        })}
      </ul>
    </Panel>
  );
}
