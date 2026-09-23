import clsx from "clsx";
import { ArrowRight, Flame, Repeat } from "lucide-react";
import Link from "next/link";
import { Markdown } from "@/components/ui/Markdown";
import type { HabitView } from "@/lib/engine/types";
import type { QuestContext } from "./context";
import { formatDay } from "./format";

/** The quest's maintenance habits: when they start, and this period's tally once active. */
export function MaintenanceCard({ ctx }: { ctx: QuestContext }) {
  const { quest, view, app } = ctx;
  const maintenance = quest.maintenance;
  if (!maintenance) return null;
  const habits = app.habits.filter((h) => h.ownerKind === "quest" && h.ownerId === quest.id);
  const fromWeek = Math.max(1, maintenance.fromWeek ?? 1);
  const startsOn = ctx.weekMonday(fromWeek);
  const active = view.maintenance.active;
  const done = habits.filter((h) => h.complete).length;
  const hours = maintenance.hoursPerWeek;

  return (
    <section aria-labelledby="maintenance-title" className="panel p-4 sm:p-5">
      <div className="flex items-center justify-between gap-3">
        <div className="hud-label flex items-center gap-1.5">
          <Repeat className="h-3.5 w-3.5 text-type-habit" strokeWidth={2} aria-hidden />
          Maintenance
        </div>
        <Link
          href="/habits"
          className="inline-flex items-center gap-1 rounded font-mono text-[11px] text-mist transition-colors hover:text-parchment"
        >
          Habits <ArrowRight className="h-3 w-3" strokeWidth={2} />
        </Link>
      </div>
      <h2 id="maintenance-title" className="mt-1 font-display text-[18px] font-medium leading-snug">
        {active ? (
          <span className="inline-flex items-center gap-2">
            Active
            <span className="h-1.5 w-1.5 animate-twinkle rounded-full bg-type-habit shadow-[0_0_8px_var(--type-habit)]" aria-hidden />
          </span>
        ) : view.status === "not-started" ? (
          `Unlocks in week ${fromWeek}`
        ) : view.status === "paused" ? (
          "Paused with the quest"
        ) : (
          `Starts in week ${fromWeek}`
        )}
      </h2>
      <p className="mt-1 text-[12.5px] leading-snug text-mist">
        {active
          ? `${done} of ${habits.length} done this period${hours ? ` · ~${hours} h/week` : ""}`
          : `${startsOn && view.status !== "not-started" ? `${formatDay(startsOn)} · ` : ""}${habits.length} habits${hours ? ` · ~${hours} h/week` : ""}${maintenance.description ? ` — ${stripPeriod(maintenance.description)}` : ""}`}
      </p>

      <ul className="mt-3 space-y-2">
        {habits.map((h) => (
          <HabitLine key={h.key} habit={h} active={active} />
        ))}
      </ul>
    </section>
  );
}

function stripPeriod(text: string): string {
  const t = text.trim();
  return t.charAt(0).toLowerCase() + t.slice(1).replace(/\.$/, "");
}

function HabitLine({ habit, active }: { habit: HabitView; active: boolean }) {
  return (
    <li className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
      <div className={clsx("min-w-0 text-[12.5px] leading-snug", active ? "text-parchment-dim" : "text-mist")}>
        <Markdown inline className="line-clamp-2 !leading-snug">
          {habit.title}
        </Markdown>
      </div>
      <div className="flex items-center gap-2 pt-[1px]">
        {active ? (
          <>
            <span className="flex items-center gap-[3px]" aria-label={`${habit.doneThisPeriod} of ${habit.target} this period`}>
              {Array.from({ length: Math.max(1, habit.target) }, (_, i) => (
                <span
                  key={i}
                  className="h-[7px] w-[7px] rotate-45 rounded-[1.5px]"
                  style={
                    i < habit.doneThisPeriod
                      ? { background: "var(--type-habit)", boxShadow: "0 0 6px var(--type-habit)" }
                      : { border: "1px solid var(--ink-400)" }
                  }
                />
              ))}
            </span>
            {habit.streak > 0 ? (
              <span className="inline-flex items-center gap-0.5 font-mono text-[10.5px] text-gold" title={`${habit.streak}-period streak`}>
                <Flame className="h-3 w-3" strokeWidth={2} aria-hidden />
                {habit.streak}
              </span>
            ) : null}
          </>
        ) : (
          <span className="font-mono text-[10.5px] text-mist-dim">{habit.cadence.text}</span>
        )}
      </div>
    </li>
  );
}
