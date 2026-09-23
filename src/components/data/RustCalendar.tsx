import clsx from "clsx";
import { FRESHNESS_DAYS } from "@/lib/config";
import { addDays, addMonths, diffDays, startOfMonth } from "@/lib/engine/dates";
import { fmtDate, fmtShort, fromToday, plural } from "@/components/journal/format";
import { SkillLink } from "@/components/journal/PageFrame";

export interface RustRow {
  key: string;
  skillId: string;
  skillTitle: string;
  color: string;
  title: string;
  asOf: string;
  staleOn: string;
  stale: boolean;
  verified: boolean;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** Every time-sensitive fact on a timeline: when it goes stale, and what's already rusting. */
export function RustCalendar({ rows, today }: { rows: RustRow[]; today: string }) {
  if (rows.length === 0) {
    return (
      <p className="rounded-[var(--radius)] border border-dashed border-ink-500 px-5 py-8 text-center text-[13.5px] text-mist">
        No time-sensitive items in the content.
      </p>
    );
  }
  const groups = new Map<string, RustRow[]>();
  for (const r of rows) groups.set(r.staleOn, [...(groups.get(r.staleOn) ?? []), r]);

  const first = rows[0].staleOn < today ? rows[0].staleOn : today;
  const last = rows.at(-1)!.staleOn;
  const start = startOfMonth(first);
  const end = addDays(addMonths(last > addDays(today, 120) ? last : addDays(today, 120), 1), -1);
  const span = Math.max(1, diffDays(start, end));
  const pos = (d: string) => `${(diffDays(start, d) / span) * 100}%`;
  const months: string[] = [];
  for (let m = startOfMonth(start); m <= end; m = addMonths(m, 1)) months.push(m);
  const staleCount = rows.filter((r) => r.stale).length;

  return (
    <div className="rounded-[var(--radius)] border border-ink-600/80 bg-ink-850/70">
      {/* timeline */}
      <div className="border-b border-ink-600/70 px-5 pb-5 pt-4">
        <div className="mb-8 flex flex-wrap items-baseline justify-between gap-2 text-[12.5px] text-mist">
          <span>
            {plural(rows.length, "time-sensitive fact")} ·{" "}
            {staleCount > 0 ? <span className="text-rust-bright">{staleCount} stale</span> : "none stale yet"}
          </span>
          <span className="font-mono text-[11px]">{FRESHNESS_DAYS}-day freshness window</span>
        </div>
        <div className="relative h-10">
          <div className="absolute inset-x-0 top-6 h-px bg-ink-500" />
          <div
            className="absolute top-6 h-px bg-gradient-to-r from-transparent to-gold/50"
            style={{ left: 0, width: pos(today) }}
            aria-hidden
          />
          {months.map((m) => (
            <div key={m} className="absolute top-4 flex -translate-x-px flex-col items-start" style={{ left: pos(m) }} aria-hidden>
              <span className="h-4 w-px bg-ink-500" />
              <span className="mt-1 font-mono text-[10px] text-mist-dim">
                {MONTHS[Number(m.slice(5, 7)) - 1]}
                {m.slice(5, 7) === "01" ? ` ${m.slice(0, 4)}` : ""}
              </span>
            </div>
          ))}
          <div className="absolute -top-3 bottom-0 flex -translate-x-1/2 flex-col items-center" style={{ left: pos(today) }}>
            <span className="font-mono text-[10px] text-gold">Today</span>
            <span className="mt-0.5 w-px flex-1 bg-gold shadow-[0_0_6px_var(--gold)]" />
          </div>
          {[...groups].map(([day, list]) => {
            const stale = list.some((r) => r.stale);
            return (
              <div
                key={day}
                className="absolute top-[18px] -translate-x-1/2"
                style={{ left: pos(day) }}
                title={`${plural(list.length, "fact")} ${stale ? "stale since" : "go stale on"} ${fmtDate(day)}`}
              >
                <span
                  className={clsx(
                    "grid h-[13px] w-[13px] rotate-45 place-items-center rounded-[2px] border",
                    stale ? "border-rust-bright bg-rust shadow-[0_0_10px_var(--rust)]" : "border-stale bg-ink-900",
                  )}
                />
                <span
                  className={clsx(
                    "absolute -top-5 left-1/2 -translate-x-1/2 font-mono text-[10.5px]",
                    stale ? "text-rust-bright" : "text-stale",
                  )}
                >
                  {list.length}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* list */}
      <ol className="divide-y divide-ink-600/60">
        {[...groups].map(([day, list]) => {
          const stale = list.some((r) => r.stale);
          return (
            <li key={day} className="px-5 py-4">
              <p className="flex flex-wrap items-baseline gap-x-2 text-[13px]">
                <span className={clsx("font-mono", stale ? "text-rust-bright" : "text-stale")}>{fmtDate(day)}</span>
                <span className="text-mist">
                  {stale ? `stale since ${fromToday(day, today)}` : `goes stale ${fromToday(day, today)}`} ·{" "}
                  {plural(list.length, "fact")}
                </span>
              </p>
              <ul className="mt-2.5 space-y-2">
                {list.map((r) => {
                  const elapsed = Math.min(1, Math.max(0, diffDays(r.asOf, today) / Math.max(1, diffDays(r.asOf, r.staleOn))));
                  return (
                    <li key={r.key} className="grid gap-x-4 gap-y-1.5 sm:grid-cols-[minmax(0,1fr)_200px] sm:items-center">
                      <div className="min-w-0">
                        <p className={clsx("text-[13px] leading-snug", r.stale ? "text-parchment" : "text-parchment-dim")}>
                          {r.stale && <span className="mr-1.5 font-mono text-[10px] uppercase tracking-[0.12em] text-rust-bright">Stale</span>}
                          {r.title}
                        </p>
                        <div className="mt-1">
                          <SkillLink skillId={r.skillId} title={r.skillTitle} color={r.color} className="!text-[11.5px]" />
                        </div>
                      </div>
                      <div>
                        <div className="h-1 overflow-hidden rounded-full bg-ink-700" title={`${Math.round(elapsed * 100)}% of the freshness window used`}>
                          <div
                            className={clsx("h-full rounded-full", r.stale ? "bg-rust-bright" : "bg-gradient-to-r from-ok/70 to-stale")}
                            style={{ width: `${Math.max(2, elapsed * 100)}%` }}
                          />
                        </div>
                        <p className="mt-1 flex justify-between font-mono text-[10.5px] text-mist-dim">
                          <span>
                            {r.verified ? "verified" : "as of"} {fmtShort(r.asOf, today)}
                          </span>
                          <span>{fmtShort(r.staleOn, today)}</span>
                        </p>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
