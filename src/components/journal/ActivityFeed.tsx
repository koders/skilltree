import clsx from "clsx";
import { BadgeCheck, Clock, NotebookPen, ShieldCheck, Star, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { ITEM_TYPE_META, formatMinutesShort } from "@/components/ui/meta";
import { DeleteLogButton } from "./DeleteLogButton";
import type { FeedDay, FeedEntry, FeedIcon } from "./feed";
import { fmtDay } from "./format";
import { SkillLink, StarGlyph } from "./PageFrame";

function iconFor(icon: FeedIcon): { Icon: LucideIcon; color: string } {
  switch (icon) {
    case "note":
      return { Icon: NotebookPen, color: "var(--parchment-dim)" };
    case "verify":
      return { Icon: ShieldCheck, color: "var(--ok)" };
    case "learned":
      return { Icon: Star, color: "var(--gold)" };
    case "review":
      return { Icon: ITEM_TYPE_META.recall.icon, color: "var(--type-recall)" };
    case "time":
    case "other":
      return { Icon: Clock, color: "var(--mist)" };
    default:
      return { Icon: ITEM_TYPE_META[icon].icon, color: ITEM_TYPE_META[icon].color };
  }
}

export function ActivityFeed({ days, today }: { days: FeedDay[]; today: string }) {
  if (days.length === 0) {
    return (
      <div className="rounded-[var(--radius)] border border-dashed border-ink-500 bg-ink-900/40 px-5 py-10 text-center">
        <StarGlyph className="mx-auto h-4 w-4 text-ink-400" />
        <p className="mt-3 font-display text-[18px] text-parchment">The journal is blank</p>
        <p className="mx-auto mt-1.5 max-w-[46ch] text-[13.5px] text-mist">
          Finish an item, log a session or check off a habit, and it lands here, grouped by day.
        </p>
      </div>
    );
  }
  return (
    <ol className="space-y-8">
      {days.map((day) => (
        <li key={day.day}>
          <div className="sticky top-[var(--topbar-h)] z-10 -mx-2 mb-2 flex items-baseline justify-between gap-3 bg-ink-900/85 px-2 py-2 backdrop-blur-sm">
            <h3 className="font-display text-[17px] font-normal text-parchment">
              {day.label}
              {day.label !== fmtDay(day.day, today) && (
                <span className="ml-2 font-mono text-[11px] text-mist">{fmtDay(day.day, today)}</span>
              )}
            </h3>
            {day.minutes > 0 && <span className="font-mono text-[11px] text-mist">{formatMinutesShort(day.minutes)}</span>}
          </div>
          <ol className="relative ml-[15px] border-l border-ink-600/70">
            {day.entries.map((e) => (
              <Entry key={e.id} entry={e} />
            ))}
          </ol>
        </li>
      ))}
    </ol>
  );
}

function Entry({ entry: e }: { entry: FeedEntry }) {
  const { Icon, color } = iconFor(e.icon);
  return (
    <li className="group/entry relative flex gap-3 py-2.5 pl-6 pr-1">
      <span
        className={clsx(
          "absolute -left-[15px] top-2.5 grid h-[30px] w-[30px] place-items-center rounded-full border bg-ink-900",
          e.tone === "gold" ? "border-gold/60 shadow-[0_0_12px_-2px_var(--gold)]" : e.tone === "rust" ? "border-rust/60" : "border-ink-500",
        )}
        aria-hidden
      >
        <Icon className="h-3.5 w-3.5" strokeWidth={1.9} style={{ color }} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[13.5px] leading-snug">
          <span
            className={clsx(
              "mr-1.5 font-mono text-[10.5px] uppercase tracking-[0.1em]",
              e.tone === "gold" ? "text-gold" : e.tone === "rust" ? "text-rust-bright" : "text-mist",
            )}
          >
            {e.verb}
          </span>
          <span className={e.tone === "dim" ? "text-parchment-dim" : "text-parchment"}>{e.title}</span>
          {e.kind === "learned" && <BadgeCheck className="ml-1 inline h-3.5 w-3.5 text-gold" aria-hidden />}
        </p>
        {e.detail && (
          <p className={clsx("mt-1 line-clamp-2 text-[12.5px]", e.tone === "rust" ? "text-rust-bright/90" : "text-mist")}>{e.detail}</p>
        )}
        <div className="mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
          {e.skillId && e.skillTitle ? (
            <SkillLink skillId={e.skillId} title={e.skillTitle} color={e.color} className="!text-[11.5px]" />
          ) : e.skillTitle ? (
            <Link
              href="/quest"
              className="inline-flex items-center gap-1.5 rounded-md border border-ink-500/70 bg-ink-800/50 px-1.5 py-[1px] text-[11.5px] text-parchment-dim hover:text-parchment"
            >
              <StarGlyph className="h-2.5 w-2.5 text-gold" />
              {e.skillTitle}
            </Link>
          ) : null}
          {e.minutes != null && e.minutes > 0 && (
            <span className="font-mono text-[11px] text-parchment-dim">{formatMinutesShort(e.minutes)}</span>
          )}
          {e.xp != null && e.xp > 0 && <span className="font-mono text-[11px] text-gold">+{e.xp} XP</span>}
          {e.clock && <span className="font-mono text-[11px] text-mist-dim">{e.clock}</span>}
        </div>
      </div>
      {e.timeLogId && (
        <div className="shrink-0 self-start">
          <DeleteLogButton id={e.timeLogId} label={e.title} />
        </div>
      )}
    </li>
  );
}
