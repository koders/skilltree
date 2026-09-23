"use client";

import clsx from "clsx";
import { ChevronDown, Plus, Trash2 } from "lucide-react";
import { useId, useState } from "react";
import { deleteTimeLog, logTime } from "@/app/actions";
import { Button } from "@/components/ui/Button";
import { Markdown } from "@/components/ui/Markdown";
import { formatMinutesShort, itemTypeMeta } from "@/components/ui/meta";
import { useAction } from "@/components/ui/useAction";
import { isItemType, type Rank } from "@/lib/content/types";
import { isIsoDate } from "@/lib/engine/dates";
import type { ItemView } from "@/lib/engine/types";
import { xpForLog } from "@/lib/engine/xp";
import type { Activity } from "@/lib/progress/types";
import { usePanel } from "./context";
import { ACTIVITIES, ACTIVITY_LABEL, formatDay, parseMinutes, skillTimeLogs } from "./format";
import { ConfirmAction, escapeHandler, FieldLabel, inputClass, SectionHeading } from "./parts";
import styles from "./skill.module.css";

const SHOWN = 6;

export function TimeLogSection() {
  const { data, skill, view, itemsById } = usePanel();
  const { run: runDelete } = useAction();
  const [adding, setAdding] = useState(false);
  const [showAll, setShowAll] = useState(false);
  // The same rows the engine totals (habit check-off time included), so the header adds up.
  const logs = skillTimeLogs(data.timeLogs, skill.id).toSorted(
    (a, b) => b.loggedOn.localeCompare(a.loggedOn) || b.createdAt.localeCompare(a.createdAt),
  );
  const shown = showAll ? logs : logs.slice(0, SHOWN);
  const logXp = logs.reduce((sum, l) => sum + xpForLog(l.activity, l.minutes), 0);
  // view.xp also counts Recall passes; show that part on its own line rather than in the rows' total.
  const recallXp = Math.max(0, view.xp - logXp);

  return (
    <section aria-labelledby="time-heading">
      <SectionHeading
        id="time-heading"
        title="Time log"
        meta={logs.length > 0 ? `${formatMinutesShort(view.minutesLogged)} · ${logXp.toLocaleString("en")} XP` : undefined}
        action={
          !adding && (
            <Button size="sm" variant="ghost" onClick={() => setAdding(true)}>
              <Plus className="h-3.5 w-3.5" />
              Log time
            </Button>
          )
        }
      />
      {adding && (
        <div className="mb-3">
          <LogTimeForm defaultActivity={suggestedActivity(skill.ranks, data.state.items, logs)} onDone={() => setAdding(false)} />
        </div>
      )}
      {logs.length === 0 ? (
        !adding && (
          <p className="text-[13px] leading-relaxed text-mist">
            No time logged yet. Active work earns more: build and output ×2, do ×1.5, watch and read ×1.
          </p>
        )
      ) : (
        <>
          <ul className="divide-y divide-ink-700/80 border-y border-ink-700/80">
            {shown.map((log) => {
              const itemId = log.itemId ?? (log.habitKey ? log.habitKey.slice(log.habitKey.indexOf("/") + 1) : null);
              const item = itemId ? itemsById.get(itemId) : undefined;
              const meta = itemTypeMeta(isItemType(log.activity) ? log.activity : null);
              return (
                <li key={log.id} className="group/log grid grid-cols-[3.4rem_1fr_auto] items-start gap-x-3 py-2">
                  <span className="pt-px font-mono text-[11px] text-mist">{formatDay(log.loggedOn, data.today)}</span>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-baseline gap-x-2">
                      <span className="font-mono text-[12.5px] text-parchment">{formatMinutesShort(log.minutes)}</span>
                      <span
                        className="font-mono text-[10px] uppercase tracking-[0.1em]"
                        style={{ color: isItemType(log.activity) ? meta.color : "var(--mist)" }}
                      >
                        {ACTIVITY_LABEL[log.activity] ?? log.activity}
                      </span>
                      <span className="font-mono text-[11px] text-gold">+{xpForLog(log.activity, log.minutes)} XP</span>
                    </div>
                    {item && (
                      <Markdown inline className="mt-0.5 line-clamp-1 text-[12.5px] !text-parchment-dim">
                        {item.title}
                      </Markdown>
                    )}
                    {log.note && <p className="mt-0.5 text-[12.5px] italic text-mist">{log.note}</p>}
                  </div>
                  {log.habitLogId ? (
                    // Habit time goes with its check-off: undo it on the Habits page.
                    <span className="pt-px font-mono text-[10px] uppercase tracking-[0.1em] text-mist" title="Logged with a habit check-off">
                      habit
                    </span>
                  ) : (
                    <ConfirmAction
                      label="Delete time entry"
                      confirmLabel="Delete"
                      icon={<Trash2 className="h-3.5 w-3.5" />}
                      onConfirm={() =>
                        void runDelete(() => deleteTimeLog({ id: log.id }), { success: "Time entry deleted", tone: "info" })
                      }
                      className="md:opacity-0 md:group-hover/log:opacity-100 md:focus-within:opacity-100 md:focus:opacity-100"
                    />
                  )}
                </li>
              );
            })}
          </ul>
          {recallXp > 0 && (
            <p className="mt-2 font-mono text-[11px] text-mist">
              Plus <span className="text-gold">+{recallXp.toLocaleString("en")} XP</span> from Recall questions passed ·{" "}
              {view.xp.toLocaleString("en")} XP in all
            </p>
          )}
          {logs.length > SHOWN && (
            <button
              type="button"
              onClick={() => setShowAll((s) => !s)}
              aria-expanded={showAll}
              className="mt-2 inline-flex items-center gap-1 text-[12px] text-mist hover:text-parchment"
            >
              <ChevronDown className={clsx("h-3.5 w-3.5 transition-transform", showAll && "rotate-180")} />
              {showAll ? "Show fewer" : `Show all ${logs.length}`}
            </button>
          )}
        </>
      )}
    </section>
  );
}

/** The type of the next todo item in an open rank; otherwise the latest log's activity; otherwise "read". */
function suggestedActivity(ranks: Rank[], items: Record<string, ItemView>, logs: { activity: Activity }[]): Activity {
  for (const rank of ranks) {
    for (const item of rank.items) {
      if (item.type && item.type !== "habit" && items[item.key]?.status === "todo") return item.type;
    }
  }
  return logs[0]?.activity ?? "read";
}

/**
 * Log time on the skill (activity picker) or on one item (`itemId`, fixed
 * activity = the item's type).
 */
export function LogTimeForm({
  itemId,
  fixedActivity,
  defaultActivity = "read",
  defaultMinutes,
  onDone,
}: {
  itemId?: string;
  fixedActivity?: Activity;
  defaultActivity?: Activity;
  defaultMinutes?: number | null;
  onDone: () => void;
}) {
  const { data, skill } = usePanel();
  const { run, pending } = useAction();
  const [activity, setActivity] = useState<Activity>(fixedActivity ?? defaultActivity);
  const [minutes, setMinutes] = useState(defaultMinutes ? String(defaultMinutes) : "");
  const [date, setDate] = useState(data.today);
  const [note, setNote] = useState("");
  const ids = useId();
  const parsed = parseMinutes(minutes);
  const validDate = isIsoDate(date) && date <= data.today;
  const xp = parsed ? xpForLog(activity, parsed) : 0;

  const submit = () => {
    if (!parsed || !validDate) return;
    void run(
      () =>
        logTime({
          skillId: skill.id,
          itemId: itemId ?? null,
          activity,
          minutes: parsed,
          loggedOn: date,
          note: note.trim() || null,
        }),
      { success: `+${xp} XP · ${formatMinutesShort(parsed)} logged`, tone: "xp" },
    ).then((r) => {
      if (r.ok) onDone();
    });
  };

  return (
    <form
      className={clsx("rounded-lg border border-ink-500 bg-ink-850/80 p-3", styles.reveal)}
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      onKeyDown={escapeHandler(onDone)}
    >
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-[1.2fr_0.8fr_1.1fr]">
        {fixedActivity ? (
          <div>
            <span className="mb-1 block font-mono text-[10px] uppercase tracking-[0.12em] text-mist">Activity</span>
            <span
              className="inline-flex h-[34px] items-center font-mono text-[12px] uppercase tracking-[0.1em]"
              style={{ color: itemTypeMeta(isItemType(activity) ? activity : null).color }}
            >
              {ACTIVITY_LABEL[activity]}
            </span>
          </div>
        ) : (
          <div>
            <FieldLabel htmlFor={`${ids}-activity`}>Activity</FieldLabel>
            <div className="relative">
              <select
                id={`${ids}-activity`}
                value={activity}
                onChange={(e) => setActivity(e.target.value as Activity)}
                className={clsx(inputClass, "appearance-none pr-7")}
              >
                {ACTIVITIES.map((a) => (
                  <option key={a} value={a}>
                    {ACTIVITY_LABEL[a]}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-mist" />
            </div>
          </div>
        )}
        <div>
          <FieldLabel htmlFor={`${ids}-minutes`}>Minutes</FieldLabel>
          <input
            id={`${ids}-minutes`}
            type="number"
            inputMode="numeric"
            min={1}
            max={1440}
            required
            value={minutes}
            onChange={(e) => setMinutes(e.target.value)}
            placeholder="45"
            className={clsx(
              inputClass,
              "font-mono [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none",
            )}
            autoFocus
          />
        </div>
        <div className="col-span-2 sm:col-span-1">
          <FieldLabel htmlFor={`${ids}-date`}>Day</FieldLabel>
          <input
            id={`${ids}-date`}
            type="date"
            value={date}
            max={data.today}
            onChange={(e) => setDate(e.target.value)}
            className={clsx(inputClass, "font-mono [color-scheme:dark]")}
          />
        </div>
      </div>
      <div className="mt-2.5">
        <FieldLabel htmlFor={`${ids}-note`}>Note (optional)</FieldLabel>
        <input
          id={`${ids}-note`}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="What I worked on"
          maxLength={2000}
          className={inputClass}
        />
      </div>
      <div className="mt-3 flex items-center gap-2">
        <Button type="submit" size="sm" variant="gold" loading={pending} disabled={!parsed || !validDate}>
          Log{xp > 0 && <span className="font-mono text-[11px] opacity-75">+{xp} XP</span>}
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={onDone}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
