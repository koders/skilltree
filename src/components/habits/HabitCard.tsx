"use client";

import clsx from "clsx";
import { Check, Flame, Lock, Minus, Plus, Repeat, Undo2 } from "lucide-react";
import Link from "next/link";
import { useOptimistic, useState } from "react";
import { logHabit, undoHabit } from "@/app/actions";
import { Button } from "@/components/ui/Button";
import { formatMinutesShort } from "@/components/ui/meta";
import { useAction } from "@/components/ui/useAction";
import { xpForLog } from "@/lib/engine/xp";
import type { HabitCardModel } from "./model";

const MINUTE_STEP = 5;

function truncate(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;
}

/**
 * One maintenance habit. `title` is pre-rendered on the server (inline
 * markdown with resource chips) so the markdown renderer stays out of the
 * client bundle.
 */
export function HabitCard({ habit, title }: { habit: HabitCardModel; title: React.ReactNode }) {
  const { run, pending } = useAction();
  const [minutes, setMinutes] = useState(habit.minutes ?? 0);
  const [done, adjustDone] = useOptimistic(habit.doneThisPeriod, (n: number, delta: number) => Math.max(0, n + delta));
  const complete = done >= habit.target;
  const inactive = !habit.active;

  const checkOff = () => {
    const xp = xpForLog("habit", minutes);
    void run(
      () => {
        adjustDone(1);
        return logHabit({ habitKey: habit.key, unit: habit.unit, minutes });
      },
      {
        success: xp > 0 ? `+${xp} XP · ${truncate(habit.titlePlain, 42)}` : `Checked off · ${truncate(habit.titlePlain, 42)}`,
        tone: xp > 0 ? "xp" : "success",
      },
    );
  };

  const undo = () => {
    const id = habit.latestLogId;
    if (!id) return;
    void run(
      () => {
        adjustDone(-1);
        return undoHabit({ habitLogId: id });
      },
      { success: "Check-off undone", tone: "info" },
    );
  };

  const pips = Math.min(Math.max(habit.target, done), habit.target + 4);
  const ownerHref = habit.ownerKind === "skill" ? `/?skill=${encodeURIComponent(habit.ownerId)}` : "/quest";

  return (
    <article
      className={clsx(
        "group/habit relative flex h-full flex-col overflow-hidden rounded-[var(--radius)] border p-4 transition-[border-color,background,box-shadow] duration-300 sm:p-5",
        inactive
          ? "border-dashed border-ink-600 bg-ink-900/40"
          : complete
            ? "border-gold/45 bg-[linear-gradient(170deg,rgba(233,196,106,0.09),rgba(10,16,32,0.78)_50%)] shadow-[0_0_40px_-18px_var(--gold)]"
            : "border-ink-600/80 bg-ink-850/70 hover:border-ink-500 hover:bg-ink-850",
      )}
      aria-label={habit.titlePlain}
    >
      <div className="flex gap-3.5">
        <Emblem state={inactive ? "locked" : complete ? "complete" : "open"} />
        <div className="min-w-0 flex-1">
          <div className={clsx("text-[15px] leading-snug", inactive ? "text-parchment-dim" : "text-parchment")}>{title}</div>
          <div className="mt-2 flex flex-wrap items-center gap-x-2.5 gap-y-1.5 text-[12px]">
            <Link
              href={ownerHref}
              className="inline-flex max-w-full items-center gap-1.5 rounded-md border border-ink-500/70 bg-ink-800/50 px-1.5 py-[1px] text-[12px] text-parchment-dim transition-colors hover:border-ink-400 hover:text-parchment"
            >
              <span
                className="h-1.5 w-1.5 shrink-0 rotate-45"
                style={{ background: habit.ownerColor, boxShadow: `0 0 6px ${habit.ownerColor}` }}
              />
              <span className="hud-label !text-[9.5px] !tracking-[0.12em]">{habit.ownerKind === "quest" ? "Quest" : "Skill"}</span>
              <span className="truncate">{habit.ownerTitle}</span>
            </Link>
            <span className="font-mono text-[11px] uppercase tracking-[0.12em] text-type-habit">{habit.cadenceLabel}</span>
            {habit.minutes != null && <span className="font-mono text-[11px] text-mist">~{formatMinutesShort(habit.minutes)}</span>}
          </div>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-[7px]" role="img" aria-label={`${done} of ${habit.target} ${habit.periodNoun}`}>
            {Array.from({ length: pips }, (_, i) => {
              const filled = i < done;
              return (
                <span
                  key={`${i}-${filled}`}
                  className={clsx(
                    "h-[9px] w-[9px] rotate-45 rounded-[2px] border",
                    filled
                      ? complete
                        ? "animate-[glow-pulse_0.9s_ease-out_1] border-gold bg-gold shadow-[0_0_8px_var(--gold)]"
                        : "animate-[glow-pulse_0.9s_ease-out_1] border-type-habit bg-type-habit shadow-[0_0_8px_var(--type-habit)]"
                      : inactive
                        ? "border-ink-500"
                        : "border-ink-400",
                  )}
                />
              );
            })}
          </span>
          <span className="font-mono text-[11.5px] text-mist">
            <span className={clsx(complete ? "text-gold-bright" : "text-parchment")}>{done}</span>/{habit.target}{" "}
            <span className="text-mist-dim">·</span> {habit.periodLabel}
          </span>
        </div>
        {!inactive && (
          <span
            className={clsx(
              "inline-flex items-center gap-1 font-mono text-[11.5px]",
              habit.streak > 0 ? "text-gold" : "text-mist-dim",
            )}
            title="Consecutive complete periods"
          >
            <Flame className="h-3.5 w-3.5" strokeWidth={1.9} />
            {habit.streakLabel}
          </span>
        )}
      </div>

      <div className="min-h-4 flex-1" />

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-ink-600/60 pt-3.5">
        {inactive ? (
          <p className="inline-flex items-center gap-1.5 text-[12px] text-mist">
            <Lock className="h-3.5 w-3.5 shrink-0" strokeWidth={1.8} />
            {habit.inactiveReason}
          </p>
        ) : (
          <p className="text-[12px] text-mist">
            {habit.lastDoneLabel ? (
              <>
                Last done <span className="text-parchment-dim">{habit.lastDoneLabel}</span>
              </>
            ) : (
              "Not done yet"
            )}
          </p>
        )}

        {inactive ? null : (
          <div className="flex items-center gap-2">
            {habit.latestLogId && (
              <Button
                variant="ghost"
                size="sm"
                onClick={undo}
                disabled={pending || done === 0}
                title="Undo the latest check-off in this period"
              >
                <Undo2 className="h-3.5 w-3.5" />
                Undo
              </Button>
            )}
            <MinuteStepper value={minutes} onChange={setMinutes} disabled={pending} label={habit.titlePlain} />
            <Button variant={complete ? "secondary" : "gold"} size="sm" onClick={checkOff} loading={pending}>
              <Check className="h-3.5 w-3.5" strokeWidth={2.4} />
              {complete ? "Log again" : "Check off"}
            </Button>
          </div>
        )}
      </div>
    </article>
  );
}

function Emblem({ state }: { state: "open" | "complete" | "locked" }) {
  return (
    <div className="relative grid h-11 w-11 shrink-0 place-items-center" aria-hidden>
      <div
        className={clsx(
          "absolute inset-[6px] rotate-45 rounded-[7px] border transition-[background,border-color,box-shadow] duration-500",
          state === "complete" && "border-gold bg-gold/15 shadow-[0_0_20px_-3px_var(--gold)]",
          state === "open" && "border-type-habit/55 bg-type-habit/10 group-hover/habit:shadow-[0_0_16px_-4px_var(--type-habit)]",
          state === "locked" && "border-ink-500 bg-ink-800/60",
        )}
      />
      {state === "complete" ? (
        <Check key="c" className="relative h-[18px] w-[18px] animate-rise text-gold-bright" strokeWidth={2.4} />
      ) : state === "locked" ? (
        <Lock className="relative h-4 w-4 text-ink-400" strokeWidth={1.9} />
      ) : (
        <Repeat className="relative h-4 w-4 text-type-habit" strokeWidth={1.9} />
      )}
    </div>
  );
}

function MinuteStepper({
  value,
  onChange,
  disabled,
  label,
}: {
  value: number;
  onChange: (value: number) => void;
  disabled?: boolean;
  label: string;
}) {
  const clamp = (n: number) => Math.min(1440, Math.max(0, Math.round(n)));
  return (
    <div className="flex h-7 items-center rounded-md border border-ink-500 bg-ink-800/70 font-mono text-[12px] focus-within:border-ink-400">
      <button
        type="button"
        onClick={() => onChange(clamp(value - MINUTE_STEP))}
        disabled={disabled || value <= 0}
        className="grid h-full w-6 place-items-center rounded-l-md text-mist transition-colors hover:bg-ink-700 hover:text-parchment disabled:opacity-40"
        aria-label="5 minutes less"
      >
        <Minus className="h-3 w-3" />
      </button>
      <label className="flex items-center gap-0.5 px-1 text-mist">
        <input
          type="number"
          inputMode="numeric"
          min={0}
          max={1440}
          step={MINUTE_STEP}
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(clamp(Number(e.target.value) || 0))}
          className="w-8 bg-transparent text-right text-parchment outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
          aria-label={`Minutes spent on ${label}`}
        />
        <span>min</span>
      </label>
      <button
        type="button"
        onClick={() => onChange(clamp(value + MINUTE_STEP))}
        disabled={disabled}
        className="grid h-full w-6 place-items-center rounded-r-md text-mist transition-colors hover:bg-ink-700 hover:text-parchment disabled:opacity-40"
        aria-label="5 minutes more"
      >
        <Plus className="h-3 w-3" />
      </button>
    </div>
  );
}
