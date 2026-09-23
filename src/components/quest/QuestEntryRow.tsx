"use client";

import clsx from "clsx";
import { Brain, Check, Lock, Minus, RotateCcw, SkipForward } from "lucide-react";
import { useOptimistic, useRef, useState } from "react";
import { setItemStatus } from "@/app/actions";
import { RecallDialog } from "@/components/skill/RecallDialog";
import { Button } from "@/components/ui/Button";
import { formatMinutesShort, itemTypeMeta } from "@/components/ui/meta";
import { useAction } from "@/components/ui/useAction";
import type { Skill } from "@/lib/content/types";
import type { PlanEntry } from "@/lib/engine/types";
import { xpForLog } from "@/lib/engine/xp";
import type { Activity, ItemStatus } from "@/lib/progress/types";
import styles from "./quest.module.css";

export interface QuestEntryRowProps {
  entry: PlanEntry;
  /** Plain-text title for labels. */
  plainTitle: string;
  /** Server-rendered title (inline markdown). */
  title: React.ReactNode;
  /** Server-rendered meta line: type, skill chip, carry-over flag… */
  meta: React.ReactNode;
  /** Server-rendered briefing (done-when, resources, do/skip). */
  details?: React.ReactNode;
  /** The skill, for recall entries (opens the Recall dialog). */
  recallSkill?: Skill | null;
  /** Recall questions whose pass already earned XP (a retake doesn't earn it again). */
  recallCredited?: string[];
  /** Its skill is already learned: entries show as cleared and can't be undone here. */
  skillLearned: boolean;
  isNext?: boolean;
  /** DOM id, so the "Next up" link can jump to the row. */
  anchorId?: string;
}

const SPARK_ANGLES = [0, 45, 90, 135, 180, 225, 270, 315];

/** One objective in the quest log: status orb, title, and done / skip / undo. */
export function QuestEntryRow({
  entry,
  plainTitle,
  title,
  meta,
  details,
  recallSkill,
  recallCredited,
  skillLearned,
  isNext,
  anchorId,
}: QuestEntryRowProps) {
  const { run, pending } = useAction();
  const [status, setOptimisticStatus] = useOptimistic<ItemStatus>(entry.status);
  const [logging, setLogging] = useState(false);
  const [minutes, setMinutes] = useState(String(entry.minutes));
  const [celebrate, setCelebrate] = useState(false);
  const [recallOpen, setRecallOpen] = useState(false);
  const doneRef = useRef<HTMLButtonElement>(null);

  const typeMeta = itemTypeMeta(entry.type);
  const TypeIcon = entry.kind === "recall" ? Brain : typeMeta.icon;
  const done = status === "done";
  const skipped = status === "skipped";
  const cleared = done || skipped;
  const locked = entry.locked && !cleared;
  const activity: Activity = entry.type === "recall" ? "review" : entry.type;
  const parsedMinutes = Math.round(Number(minutes));
  const validMinutes = Number.isFinite(parsedMinutes) && parsedMinutes >= 1 && parsedMinutes <= 1440;
  const previewXp = validMinutes ? xpForLog(activity, parsedMinutes) : 0;

  function write(next: ItemStatus, logMinutes: number) {
    if (entry.itemId === null) return;
    const skillId = entry.skillId;
    const itemId = entry.itemId;
    const xp = logMinutes > 0 ? xpForLog(activity, logMinutes) : 0;
    const success =
      next === "done"
        ? xp > 0
          ? `+${xp} XP · ${formatMinutesShort(logMinutes)} logged`
          : "Objective cleared"
        : next === "skipped"
          ? "Skipped — it won't block the rank"
          : "Back on the list · logged time stays in the journal";
    return run(
      () => {
        setOptimisticStatus(next);
        return setItemStatus({
          skillId,
          itemId,
          status: next,
          minutes: logMinutes > 0 ? logMinutes : null,
          activity,
        });
      },
      { success, tone: xp > 0 ? "xp" : next === "todo" ? "info" : "success" },
    );
  }

  function cancelLogging() {
    setLogging(false);
    // The Done button remounts once the step closes; give focus back to it.
    requestAnimationFrame(() => doneRef.current?.focus());
  }

  function complete(withTime: boolean) {
    if (withTime && !validMinutes) return;
    setLogging(false);
    setCelebrate(true);
    void write("done", withTime ? parsedMinutes : 0);
  }

  return (
    <li
      id={anchorId}
      className={clsx(
        "group/row relative grid scroll-mt-24 grid-cols-[auto_minmax(0,1fr)] gap-x-3.5 gap-y-2 rounded-xl border px-3 py-3 transition-colors sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:px-3.5",
        isNext && !cleared
          ? "border-gold/30 bg-[linear-gradient(90deg,rgba(233,196,106,0.07),transparent_70%)]"
          : "border-transparent hover:border-ink-600/70 hover:bg-ink-800/40",
        celebrate && styles.flash,
      )}
      onAnimationEnd={(e) => {
        if (e.target === e.currentTarget) setCelebrate(false);
      }}
    >
      {/* Status orb */}
      <div className="relative mt-0.5 grid h-8 w-8 place-items-center" aria-hidden>
        <span
          className={clsx(
            "absolute inset-[3px] rotate-45 rounded-[7px] border transition-[background,border-color,box-shadow] duration-500",
            done
              ? "border-gold-bright bg-gradient-to-br from-gold-bright to-gold-deep shadow-[0_0_16px_-2px_var(--gold)]"
              : skipped
                ? "border-dashed border-mist-dim bg-ink-800"
                : locked
                  ? "border-ink-500 bg-ink-850"
                  : "bg-ink-800",
            celebrate && done && styles.burst,
          )}
          style={!cleared && !locked ? { borderColor: typeMeta.color, boxShadow: `0 0 12px -4px ${typeMeta.color}` } : undefined}
        />
        {done ? (
          <Check className="relative h-4 w-4 text-ink-900" strokeWidth={3} />
        ) : skipped ? (
          <Minus className="relative h-4 w-4 text-mist" strokeWidth={2.5} />
        ) : locked ? (
          <Lock className="relative h-3.5 w-3.5 text-mist-dim" strokeWidth={2} />
        ) : (
          <TypeIcon className="relative h-4 w-4" style={{ color: typeMeta.color }} strokeWidth={1.9} />
        )}
        {celebrate && done
          ? SPARK_ANGLES.map((a) => (
              <span key={a} className={styles.spark} style={{ ["--a" as string]: `${a}deg` }} />
            ))
          : null}
      </div>

      {/* Title, meta, details */}
      <div className="min-w-0">
        <div className="flex items-start gap-2">
          <div
            className={clsx(
              "min-w-0 flex-1 text-[14.5px] leading-snug transition-colors duration-500",
              styles.title,
              cleared && styles.struck,
              done ? "text-parchment-dim" : skipped ? "text-mist [--strike:var(--mist-dim)]" : locked ? "text-mist" : "text-parchment",
            )}
          >
            {title}
            <span className="sr-only">
              {" "}
              ({done ? "done" : skipped ? "skipped" : locked ? "locked" : "to do"})
            </span>
          </div>
          {isNext && !cleared ? (
            <span className="mt-[3px] shrink-0 rounded border border-gold/50 px-1.5 py-[1px] font-mono text-[9.5px] uppercase tracking-[0.14em] text-gold">
              Next
            </span>
          ) : null}
        </div>
        <div className="mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1.5">{meta}</div>
        {locked && entry.lockReason ? (
          <p className="mt-1.5 flex items-center gap-1.5 text-[12.5px] text-mist">
            <Lock className="h-3 w-3 shrink-0" strokeWidth={2} />
            {entry.lockReason}
          </p>
        ) : null}
        {details && !cleared && !locked ? <div className="mt-2">{details}</div> : null}
      </div>

      {/* Controls */}
      <div className="col-start-2 flex flex-wrap items-center gap-1.5 sm:col-start-3 sm:row-start-1 sm:justify-end sm:self-start">
        {entry.kind === "recall" ? (
          done ? (
            <span className="inline-flex h-7 items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.12em] text-gold">
              <Check className="h-3.5 w-3.5" strokeWidth={2.5} /> Learned
            </span>
          ) : (
            <Button
              variant={locked ? "secondary" : "gold"}
              size="sm"
              disabled={locked || !recallSkill}
              title={locked ? (entry.lockReason ?? undefined) : undefined}
              onClick={() => setRecallOpen(true)}
            >
              <Brain className="h-3.5 w-3.5" strokeWidth={2} />
              Answer Recall
            </Button>
          )
        ) : cleared ? (
          skillLearned ? (
            <span className="inline-flex h-7 items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.12em] text-gold">
              <Check className="h-3.5 w-3.5" strokeWidth={2.5} /> Skill learned
            </span>
          ) : (
            <>
              <span
                className={clsx(
                  "font-mono text-[10.5px] uppercase tracking-[0.12em]",
                  done ? "text-gold" : "text-mist",
                )}
              >
                {done ? typeMeta.verb : "Skipped"}
              </span>
              <Button
                variant="ghost"
                size="sm"
                disabled={pending}
                onClick={() => void write("todo", 0)}
                aria-label={`Undo: ${plainTitle}`}
              >
                <RotateCcw className="h-3.5 w-3.5" strokeWidth={2} />
                Undo
              </Button>
            </>
          )
        ) : logging ? null : (
          <>
            <Button
              variant="ghost"
              size="sm"
              disabled={locked || pending}
              onClick={() => void write("skipped", 0)}
              aria-label={`Skip: ${plainTitle}`}
              title={locked ? (entry.lockReason ?? undefined) : "Skip — skipped items don't block the rank"}
            >
              <SkipForward className="h-3.5 w-3.5" strokeWidth={2} />
              Skip
            </Button>
            <Button
              ref={doneRef}
              variant="secondary"
              size="sm"
              disabled={locked || pending}
              onClick={() => {
                setMinutes(String(entry.minutes));
                setLogging(true);
              }}
              aria-label={`Mark done: ${plainTitle}`}
              title={locked ? (entry.lockReason ?? undefined) : undefined}
              className="hover:!border-gold/60 hover:!text-gold-bright"
            >
              <Check className="h-3.5 w-3.5" strokeWidth={2.5} />
              Done
            </Button>
          </>
        )}
      </div>

      {/* Time-spent step */}
      {logging && !cleared ? (
        <form
          className="col-span-2 col-start-1 flex flex-wrap items-center gap-2 rounded-lg border border-gold/25 bg-ink-850/80 px-3 py-2.5 sm:col-span-2 sm:col-start-2"
          onSubmit={(e) => {
            e.preventDefault();
            complete(true);
          }}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              e.stopPropagation();
              cancelLogging();
            }
          }}
        >
          <label className="flex items-center gap-2 text-[13px] text-parchment-dim">
            Time spent
            <input
              type="number"
              inputMode="numeric"
              min={1}
              max={1440}
              step={1}
              autoFocus
              value={minutes}
              onChange={(e) => setMinutes(e.target.value)}
              className="h-8 w-[76px] rounded-md border border-ink-500 bg-ink-900 px-2 text-right font-mono text-[13px] text-parchment outline-none focus:border-gold/70"
              aria-describedby={`xp-${entry.key}`}
            />
            <span className="font-mono text-[12px] text-mist">min</span>
          </label>
          <span id={`xp-${entry.key}`} className="font-mono text-[12px] text-gold" aria-live="polite">
            {validMinutes ? `+${previewXp} XP` : "1–1440 min"}
          </span>
          <div className="ml-auto flex flex-wrap items-center gap-1.5">
            <Button type="button" variant="ghost" size="sm" onClick={cancelLogging}>
              Cancel
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => complete(false)}>
              Done, no time
            </Button>
            <Button type="submit" variant="gold" size="sm" disabled={!validMinutes}>
              <Check className="h-3.5 w-3.5" strokeWidth={2.5} />
              Log &amp; complete
            </Button>
          </div>
        </form>
      ) : null}

      {recallOpen && recallSkill ? (
        <RecallDialog
          open
          onClose={() => setRecallOpen(false)}
          skill={recallSkill}
          mode="complete"
          creditedQuestionIds={recallCredited}
          onSubmitted={(result) => {
            if (result.learned) setCelebrate(true);
          }}
        />
      ) : null}
    </li>
  );
}
