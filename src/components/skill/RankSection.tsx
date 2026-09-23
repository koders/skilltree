"use client";

import clsx from "clsx";
import { Lock } from "lucide-react";
import { useOptimistic } from "react";
import { setItemStatus } from "@/app/actions";
import { RankPips } from "@/components/ui/Badges";
import { formatMinutesShort } from "@/components/ui/meta";
import { useAction } from "@/components/ui/useAction";
import type { Item, Rank } from "@/lib/content/types";
import type { RankView } from "@/lib/engine/types";
import { xpForLog } from "@/lib/engine/xp";
import type { ItemStatus } from "@/lib/progress/types";
import { usePanel } from "./context";
import { ItemRow } from "./ItemRow";
import { SkillChip } from "./SkillChip";

type StatusUpdate = { itemId: string; status: ItemStatus };

/** One rank: its emblem, progress pips, lock notice and item rows. Item status changes apply optimistically. */
export function RankSection({ rank, rankView }: { rank: Rank; rankView: RankView }) {
  const { data, skill, view, skillsById } = usePanel();
  const { run } = useAction();

  const serverStatuses: Record<string, ItemStatus> = {};
  for (const item of rank.items) serverStatuses[item.id] = data.state.items[item.key]?.status ?? "todo";
  const [statuses, applyStatus] = useOptimistic(serverStatuses, (state, u: StatusUpdate) => ({ ...state, [u.itemId]: u.status }));

  const blocking = rank.items.filter((it) => data.state.items[it.key]?.blocking);
  // A test-out or self-report covers every item (ItemRow shows them as cleared), so they count here too.
  const covered = view.learned && view.learnedVia !== "completed";
  const doneCount = covered ? blocking.length : blocking.filter((it) => statuses[it.id] !== "todo").length;
  const complete = view.learned || (blocking.length > 0 ? doneCount === blocking.length : rankView.complete);
  const minutes = rank.items.reduce((sum, it) => sum + (it.optional || it.type === "habit" ? 0 : (it.minutes ?? 0)), 0);

  const titles = (ids: string[]) => ids.map((id) => skillsById.get(id)?.title ?? id).join(", ");
  // The skill's own requires first; a skill locked only by its ranks explains each rank by its own.
  const ownMissing = view.missingRequires.filter((id) => skill.requires.includes(id));
  const disabledReason =
    ownMissing.length > 0
      ? `Locked: learn ${titles(ownMissing)} first`
      : rankView.locked
        ? `Rank locked: learn ${titles(rankView.missingRequires)} first`
        : view.locked
          ? `Locked: learn ${titles(view.missingRequires)} first`
          : null;

  const setStatus = (item: Item, status: ItemStatus, logMinutes?: number) => {
    const activity = item.type && item.type !== "habit" ? item.type : "other";
    const xp = status === "done" && logMinutes ? xpForLog(activity, logMinutes) : 0;
    void run(
      async () => {
        applyStatus({ itemId: item.id, status });
        return setItemStatus({ skillId: skill.id, itemId: item.id, status, minutes: logMinutes ?? null, activity });
      },
      { success: xp > 0 ? `+${xp} XP · ${formatMinutesShort(logMinutes)} logged` : undefined, tone: "xp" },
    );
  };

  const cleared = (it: Item | undefined) => (it ? statuses[it.id] !== "todo" && it.type !== "habit" : false);

  return (
    <section aria-labelledby={`${rank.id}-heading`} className="relative">
      <div className="mb-1 flex items-center gap-3">
        <RankEmblem number={rank.number} complete={complete} locked={rankView.locked && !view.learned} started={doneCount > 0} />
        <div className="min-w-0 flex-1">
          <h3 id={`${rank.id}-heading`} className="font-display text-[17px] leading-tight text-parchment">
            Rank {rank.number}
            {rank.name && <span className="text-parchment-dim"> — {rank.name}</span>}
          </h3>
          <div className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1 font-mono text-[11px] text-mist">
            {blocking.length > 0 && (
              <>
                <RankPips total={blocking.length} complete={doneCount} />
                <span>
                  {doneCount}/{blocking.length}
                </span>
              </>
            )}
            {minutes > 0 && <span className="text-mist-dim">~{formatMinutesShort(minutes)}</span>}
            {complete && <span className="text-gold">complete</span>}
          </div>
        </div>
      </div>

      {rankView.locked && !view.learned && (
        <div className="mb-2 ml-[42px] flex flex-wrap items-center gap-1.5 rounded-lg border border-ink-500 bg-ink-850/70 px-2.5 py-2 text-[12.5px] text-parchment-dim">
          <Lock className="h-3.5 w-3.5 text-mist" strokeWidth={2} />
          <span>Unlocks after</span>
          {rankView.missingRequires.map((id) => (
            <SkillChip key={id} skillId={id} />
          ))}
        </div>
      )}

      <ol className={clsx("ml-[5px]", rankView.locked && !view.learned && "opacity-70")}>
        {rank.items.map((item, i) => (
          <ItemRow
            key={item.key || `${rank.id}-${i}`}
            item={item}
            itemView={data.state.items[item.key]}
            status={statuses[item.id] ?? "todo"}
            disabledReason={disabledReason}
            isFirst={i === 0}
            isLast={i === rank.items.length - 1}
            prevCleared={cleared(rank.items[i - 1])}
            nextCleared={cleared(rank.items[i + 1])}
            onSetStatus={setStatus}
          />
        ))}
      </ol>
    </section>
  );
}

/** A diamond with the rank number: outlined, lit gold when complete, a lock when locked. */
function RankEmblem({ number, complete, locked, started }: { number: number; complete: boolean; locked: boolean; started: boolean }) {
  return (
    <span className="relative grid h-8 w-8 shrink-0 place-items-center" aria-hidden>
      <span
        className="absolute inset-[5px] rotate-45 rounded-[4px] border-[1.5px] transition-[background,border-color,box-shadow] duration-500"
        style={
          complete
            ? {
                background: "linear-gradient(135deg, var(--gold-bright), var(--gold-deep))",
                borderColor: "var(--gold-bright)",
                boxShadow: "0 0 14px -2px var(--gold)",
              }
            : locked
              ? { borderColor: "var(--ink-400)", background: "var(--ink-850)" }
              : {
                  borderColor: started ? "var(--gold)" : "color-mix(in oklab, var(--gold) 45%, var(--ink-500))",
                  background: "var(--ink-850)",
                }
        }
      />
      <span
        className={clsx(
          "relative font-display text-[13px] font-semibold",
          complete ? "text-ink-900" : locked ? "text-mist" : "text-gold",
        )}
      >
        {locked ? <Lock className="h-3 w-3" strokeWidth={2.4} /> : number}
      </span>
    </span>
  );
}
