import clsx from "clsx";
import { ExternalLink } from "lucide-react";
import { fmtShort } from "@/components/journal/format";
import { SkillLink } from "@/components/journal/PageFrame";
import { Markdown } from "@/components/ui/Markdown";
import { formatMinutesShort, ITEM_TYPE_META } from "@/components/ui/meta";
import type { LootExtra, LootNote, LootSlot, LootType } from "./model";

/** Hexagonal item frame, the game's "inventory slot". */
export function Relic({
  type,
  collected,
  large,
  className,
}: {
  type: LootType;
  collected: boolean;
  large?: boolean;
  className?: string;
}) {
  const meta = ITEM_TYPE_META[type];
  const Icon = meta.icon;
  return (
    <div
      className={clsx("relative grid shrink-0 place-items-center", large ? "h-16 w-16" : "h-12 w-12", className)}
      style={collected ? { filter: `drop-shadow(0 0 10px color-mix(in oklab, ${meta.color} 45%, transparent))` } : undefined}
      aria-hidden
    >
      <svg viewBox="0 0 48 48" className="absolute inset-0 h-full w-full">
        <polygon
          points="24,2 43,13 43,35 24,46 5,35 5,13"
          fill={collected ? `color-mix(in oklab, ${meta.color} 14%, var(--ink-850))` : "transparent"}
          stroke={collected ? meta.color : "var(--ink-500)"}
          strokeWidth="1.3"
          strokeDasharray={collected ? undefined : "3 3"}
        />
        {collected && (
          <polygon
            points="24,7.5 38.3,15.75 38.3,32.25 24,40.5 9.7,32.25 9.7,15.75"
            fill="none"
            stroke={meta.color}
            strokeOpacity="0.35"
            strokeWidth="0.8"
          />
        )}
      </svg>
      <Icon className={clsx("relative", large ? "h-7 w-7" : "h-5 w-5")} strokeWidth={1.7} style={{ color: collected ? meta.color : "var(--ink-400)" }} />
    </div>
  );
}

function hostOf(url: string): string {
  try {
    return new URL(url).host.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function NotePreview({ note }: { note: LootNote }) {
  const long = note.body.length > 220;
  return (
    <div className="relative mt-3.5 border-t border-ink-600/60 pt-3">
      {note.title && <p className="text-[13px] font-medium leading-snug text-parchment">{note.title}</p>}
      {note.body.trim() && (
        <div
          className={clsx(
            "mt-1 max-h-[6.6em] overflow-hidden text-[13px]",
            long && "[mask-image:linear-gradient(to_bottom,black_50%,transparent)]",
          )}
        >
          <Markdown className="!leading-[1.55]">{note.body}</Markdown>
        </div>
      )}
      {note.url && (
        <a
          href={note.url}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-2.5 inline-flex max-w-full items-center gap-1.5 font-mono text-[11.5px] text-mist transition-colors hover:text-gold"
        >
          <ExternalLink className="h-3 w-3 shrink-0" />
          <span className="truncate">{hostOf(note.url)}</span>
        </a>
      )}
    </div>
  );
}

function CardShell({ type, children }: { type: LootType; children: React.ReactNode }) {
  const color = ITEM_TYPE_META[type].color;
  return (
    <article
      className="group/loot relative flex h-full flex-col overflow-hidden rounded-[var(--radius)] border bg-ink-850/85 p-4 transition-[transform,box-shadow] duration-300 hover:-translate-y-0.5 sm:p-5"
      style={{
        borderColor: `color-mix(in oklab, ${color} 36%, transparent)`,
        boxShadow: `0 22px 44px -28px color-mix(in oklab, ${color} 70%, transparent)`,
      }}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute -right-12 -top-14 h-40 w-40 rounded-full opacity-[0.16] blur-3xl transition-opacity duration-500 group-hover/loot:opacity-30"
        style={{ background: color }}
      />
      {children}
    </article>
  );
}

function CardTop({ type, label, on, today }: { type: LootType; label: string; on: string | null; today: string }) {
  const meta = ITEM_TYPE_META[type];
  return (
    <div className="relative flex items-start justify-between gap-3">
      <Relic type={type} collected />
      <div className="pt-1 text-right">
        <div className="font-mono text-[10.5px] uppercase tracking-[0.14em]" style={{ color: meta.color }}>
          {label}
        </div>
        {on && <div className="mt-1 font-mono text-[11px] text-mist">{fmtShort(on, today)}</div>}
      </div>
    </div>
  );
}

export function LootCard({ slot, color, today }: { slot: LootSlot; color: string; today: string }) {
  if (!slot.collected) return <LockedSlot slot={slot} color={color} />;
  const note = slot.notes[0];
  return (
    <CardShell type={slot.type}>
      <CardTop type={slot.type} label={ITEM_TYPE_META[slot.type].label} on={slot.collectedOn} today={today} />
      <h3 className="relative mt-3.5 font-display text-[16.5px] font-normal">
        <Markdown inline className="!leading-snug !text-parchment">
          {slot.title}
        </Markdown>
      </h3>
      <div className="relative mt-2.5">
        <SkillLink skillId={slot.skillId} title={slot.skillTitle} color={color} />
      </div>
      {note && <NotePreview note={note} />}
      {slot.notes.length > 1 && (
        <p className="relative mt-2 font-mono text-[11px] text-mist">+{slot.notes.length - 1} more output notes</p>
      )}
      {!note && slot.status === "done" && (
        <p className="relative mt-auto pt-4 text-[12px] text-mist-dim">No write-up attached yet</p>
      )}
    </CardShell>
  );
}

export function ExtraLootCard({ extra, color, today }: { extra: LootExtra; color: string; today: string }) {
  return (
    <CardShell type="output">
      <CardTop type="output" label="Output" on={extra.createdOn} today={today} />
      <h3 className="relative mt-3.5 font-display text-[16.5px] font-normal leading-snug text-parchment">
        {extra.title ?? "Untitled output"}
      </h3>
      {extra.skillId && extra.skillTitle && (
        <div className="relative mt-2.5">
          <SkillLink skillId={extra.skillId} title={extra.skillTitle} color={color} />
        </div>
      )}
      <NotePreview note={{ ...extra, title: null }} />
    </CardShell>
  );
}

function LockedSlot({ slot, color }: { slot: LootSlot; color: string }) {
  const meta = ITEM_TYPE_META[slot.type];
  return (
    <article className="relative flex h-full flex-col rounded-[var(--radius)] border border-dashed border-ink-600 bg-ink-900/35 p-4 transition-colors hover:border-ink-500 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <Relic type={slot.type} collected={false} />
        <div className="pt-1 text-right font-mono text-[10.5px] uppercase tracking-[0.14em] text-mist-dim">
          {meta.label}
          {slot.minutes != null && <div className="mt-1 normal-case tracking-normal">~{formatMinutesShort(slot.minutes)}</div>}
        </div>
      </div>
      <h3 className="mt-3.5 font-display text-[15.5px] font-normal leading-snug text-parchment-dim/75">{slot.titlePlain}</h3>
      <div className="mt-2.5 opacity-75">
        <SkillLink skillId={slot.skillId} title={slot.skillTitle} color={color} />
      </div>
      <p className="mt-auto pt-4 font-mono text-[10.5px] uppercase tracking-[0.14em] text-mist-dim">
        {slot.status === "skipped" ? "Skipped" : "Not yet collected"}
      </p>
    </article>
  );
}
