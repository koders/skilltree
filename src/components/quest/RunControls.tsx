"use client";

import clsx from "clsx";
import { Flag, Pause, Play, RotateCcw, SlidersHorizontal, X } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { setQuestRunStatus, updateQuestRun } from "@/app/actions";
import { Button } from "@/components/ui/Button";
import { useAction } from "@/components/ui/useAction";
import { addDays, isIsoDate, startOfWeek, weekNumber } from "@/lib/engine/dates";
import type { QuestRunStatus } from "@/lib/progress/types";
import { formatDay } from "./format";

export interface RunControlsProps {
  runId: string;
  status: QuestRunStatus;
  /** Monday of week 1. */
  startedOn: string;
  /** The run's own hours/week override, if any. */
  hoursPerWeek: number | null;
  /** The quest's default target, e.g. "4–5". */
  defaultHours: string | null;
  paceWeeks: number | null;
  today: string;
}

/** Pause / resume / complete, plus a popover to move week 1 or change the weekly hours. */
export function RunControls(props: RunControlsProps) {
  const { runId, status } = props;
  const { run, pending } = useAction();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const panelId = useId();

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const setStatus = (next: QuestRunStatus, success: string) =>
    run(() => setQuestRunStatus({ runId, status: next }), { success, tone: "info" });

  return (
    <div ref={rootRef} className="relative flex flex-wrap items-center gap-2">
      {status === "active" ? (
        <Button size="sm" variant="secondary" loading={pending} onClick={() => setStatus("paused", "Quest paused")}>
          <Pause className="h-3.5 w-3.5" strokeWidth={2} />
          Pause
        </Button>
      ) : status === "paused" ? (
        <Button size="sm" variant="gold" loading={pending} onClick={() => setStatus("active", "Quest resumed")}>
          <Play className="h-3.5 w-3.5" strokeWidth={2} />
          Resume
        </Button>
      ) : (
        <Button size="sm" variant="secondary" loading={pending} onClick={() => setStatus("active", "Quest reopened")}>
          <RotateCcw className="h-3.5 w-3.5" strokeWidth={2} />
          Reopen
        </Button>
      )}
      {status !== "completed" ? (
        <Button size="sm" variant="secondary" disabled={pending} onClick={() => setStatus("completed", "Quest marked completed")}>
          <Flag className="h-3.5 w-3.5" strokeWidth={2} />
          Mark completed
        </Button>
      ) : null}
      <Button
        size="sm"
        variant="ghost"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        aria-label="Quest schedule settings"
        title="Start date and hours per week"
        onClick={() => setOpen((o) => !o)}
        className={clsx(open && "!bg-ink-700 !text-parchment")}
      >
        <SlidersHorizontal className="h-4 w-4" strokeWidth={1.8} />
        <span className="sm:hidden">Schedule</span>
      </Button>

      {open ? <SchedulePanel id={panelId} {...props} onClose={() => setOpen(false)} /> : null}
    </div>
  );
}

function SchedulePanel({
  id,
  runId,
  startedOn,
  hoursPerWeek,
  defaultHours,
  paceWeeks,
  today,
  onClose,
}: RunControlsProps & { id: string; onClose: () => void }) {
  const { run, pending } = useAction();
  const [date, setDate] = useState(startedOn);
  const [hours, setHours] = useState(hoursPerWeek === null ? "" : String(hoursPerWeek));
  const [confirmAbandon, setConfirmAbandon] = useState(false);

  const monday = isIsoDate(date) ? startOfWeek(date) : null;
  const weekNow = monday ? weekNumber(monday, today) : null;
  const parsedHours = hours.trim() === "" ? null : Number(hours);
  const hoursValid = parsedHours === null || (Number.isFinite(parsedHours) && parsedHours > 0 && parsedHours <= 168);
  const dateChanged = monday !== null && monday !== startedOn;
  const hoursChanged = parsedHours !== hoursPerWeek;
  const canSave = monday !== null && hoursValid && (dateChanged || hoursChanged);
  const behind = paceWeeks !== null && paceWeeks < 0 ? -paceWeeks : 0;
  const shiftedStart = addDays(startedOn, behind * 7);

  async function save() {
    if (!canSave || monday === null) return;
    const res = await run(
      () =>
        updateQuestRun({
          runId,
          ...(dateChanged ? { startedOn: monday } : {}),
          ...(hoursChanged ? { hoursPerWeek: parsedHours } : {}),
        }),
      { success: "Schedule updated", tone: "info" },
    );
    if (res.ok) onClose();
  }

  async function shift() {
    const res = await run(() => updateQuestRun({ runId, startedOn: shiftedStart }), {
      success: `Week 1 moved to ${formatDay(shiftedStart)} · back on track`,
      tone: "info",
    });
    if (res.ok) onClose();
  }

  async function abandon() {
    const res = await run(() => setQuestRunStatus({ runId, status: "abandoned" }), {
      success: "Quest abandoned · item progress is kept",
      tone: "info",
    });
    if (res.ok) onClose();
  }

  return (
    <div
      id={id}
      role="dialog"
      aria-label="Quest schedule"
      className="panel fixed inset-x-4 top-[calc(var(--topbar-h)+12px)] z-50 !bg-ink-850 p-4 shadow-[0_24px_60px_-12px_rgba(0,0,0,0.8)] animate-rise sm:absolute sm:inset-x-auto sm:right-0 sm:top-full sm:mt-2 sm:w-[320px]"
    >
      <div className="flex items-center justify-between">
        <span className="hud-label">Schedule</span>
        <button
          type="button"
          onClick={onClose}
          className="rounded-md p-1 text-mist hover:bg-ink-700 hover:text-parchment"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <form
        className="mt-3 space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        <label className="block">
          <span className="text-[12.5px] text-parchment-dim">Week 1 starts</span>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="mt-1 h-9 w-full rounded-lg border border-ink-500 bg-ink-900 px-2.5 font-mono text-[13px] text-parchment outline-none focus:border-gold/70"
          />
          <span className="mt-1 block font-mono text-[11px] text-mist">
            {monday
              ? `${formatDay(monday)} · today is ${weekNow !== null && weekNow >= 1 ? `week ${weekNow}` : "before week 1"}`
              : "Pick a date"}
          </span>
        </label>

        <label className="block">
          <span className="text-[12.5px] text-parchment-dim">Hours per week</span>
          <input
            type="number"
            inputMode="decimal"
            min={0.5}
            max={168}
            step={0.5}
            value={hours}
            placeholder={defaultHours ? `${defaultHours} (quest default)` : "Quest default"}
            onChange={(e) => setHours(e.target.value)}
            className="mt-1 h-9 w-full rounded-lg border border-ink-500 bg-ink-900 px-2.5 font-mono text-[13px] text-parchment outline-none placeholder:text-mist-dim focus:border-gold/70"
          />
          <span className={clsx("mt-1 block text-[11.5px]", hoursValid ? "text-mist" : "text-danger")}>
            {hoursValid ? "Blank uses the quest's target. Sets the weekly bar and the follow-on pace." : "Enter 0.5–168 hours"}
          </span>
        </label>

        <div className="flex justify-end gap-2">
          <Button type="button" size="sm" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" size="sm" variant="gold" disabled={!canSave} loading={pending}>
            Save
          </Button>
        </div>
      </form>

      {behind > 0 ? (
        <div className="mt-4 rounded-lg border border-stale/35 bg-stale/[0.06] p-3">
          <p className="text-[12.5px] leading-snug text-parchment-dim">
            {behind} week{behind === 1 ? "" : "s"} behind. Move week 1 to <span className="text-parchment">{formatDay(shiftedStart)}</span> to
            be back on track.
          </p>
          <Button size="sm" variant="secondary" className="mt-2" disabled={pending} onClick={() => void shift()}>
            Re-plan from here
          </Button>
        </div>
      ) : null}

      <div className="mt-4 border-t border-ink-600/70 pt-3">
        {confirmAbandon ? (
          <div className="space-y-2">
            <p className="text-[12.5px] leading-snug text-parchment-dim">
              Abandon this run? Items and skills keep their progress; the quest goes back to not started.
            </p>
            <div className="flex gap-2">
              <Button size="sm" variant="danger" disabled={pending} onClick={() => void abandon()}>
                Abandon quest
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setConfirmAbandon(false)}>
                Keep it
              </Button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setConfirmAbandon(true)}
            className="rounded text-[12px] text-mist underline decoration-ink-400 underline-offset-4 hover:text-danger hover:decoration-danger/60"
          >
            Abandon quest…
          </button>
        )}
      </div>
    </div>
  );
}
