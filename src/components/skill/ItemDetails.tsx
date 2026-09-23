"use client";

import clsx from "clsx";
import { Clock, Gem, LifeBuoy, NotebookPen, Target } from "lucide-react";
import { useState } from "react";
import { Markdown } from "@/components/ui/Markdown";
import type { Item, ItemField } from "@/lib/content/types";
import type { ItemView } from "@/lib/engine/types";
import { usePanel } from "./context";
import { remainingMinutes } from "./format";
import { NoteCard, NoteForm } from "./NotesSection";
import { LogTimeForm } from "./TimeLogSection";
import { VerifyControl } from "./VerifyControl";
import styles from "./skill.module.css";

type OpenForm = "time" | "note" | "loot" | null;

/** Everything under an expanded item: its fields in source order, re-verification, time, notes and loot. */
export function ItemDetails({ item, itemView }: { item: Item; itemView: ItemView | undefined }) {
  const { data, skill } = usePanel();
  const [form, setForm] = useState<OpenForm>(null);
  const isHabit = item.type === "habit";
  const canTrack = item.id !== "";
  const notes = data.notes
    .filter((n) => n.skillId === skill.id && n.itemId === item.id && canTrack)
    .toSorted((a, b) => b.createdAt.localeCompare(a.createdAt));
  // The Verify line is shown inside the re-verify control instead.
  const fields = item.fields.filter((f) => !(item.timeSensitive && f.label.toLowerCase() === "verify"));

  return (
    <div className="space-y-2.5 border-l border-ink-600/70 pl-3.5">
      {fields.length > 0 && (
        <div className="space-y-2">
          {fields.map((f, i) => (
            <FieldBlock key={`${f.line}-${i}`} field={f} />
          ))}
        </div>
      )}

      {item.timeSensitive && itemView && canTrack && <VerifyControl item={item} itemView={itemView} />}

      {canTrack && (
        <div className="flex flex-wrap gap-1.5 pt-0.5">
          {!isHabit && (
            <ActionChip active={form === "time"} onClick={() => setForm(form === "time" ? null : "time")}>
              <Clock className="h-3.5 w-3.5" strokeWidth={1.8} />
              Log time
            </ActionChip>
          )}
          <ActionChip active={form === "note"} onClick={() => setForm(form === "note" ? null : "note")}>
            <NotebookPen className="h-3.5 w-3.5" strokeWidth={1.8} />
            Add note
          </ActionChip>
          {(item.type === "output" || item.type === "build") && (
            <ActionChip gold active={form === "loot"} onClick={() => setForm(form === "loot" ? null : "loot")}>
              <Gem className="h-3.5 w-3.5" strokeWidth={1.8} />
              Attach loot
            </ActionChip>
          )}
        </div>
      )}

      {form === "time" && (
        <LogTimeForm
          itemId={item.id}
          fixedActivity={item.type ?? "other"}
          // What's left of the estimate, like the completion form: sessions add up to it.
          defaultMinutes={remainingMinutes(item.minutes, itemView?.minutesLogged ?? 0)}
          onDone={() => setForm(null)}
        />
      )}
      {form === "note" && <NoteForm itemId={item.id} initialKind="note" lockKind onDone={() => setForm(null)} />}
      {form === "loot" && <NoteForm itemId={item.id} initialKind="output" lockKind onDone={() => setForm(null)} />}

      {notes.length > 0 && (
        <ul className="space-y-2">
          {notes.map((n) => (
            <li key={n.id}>
              <NoteCard note={n} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function FieldBlock({ field }: { field: ItemField }) {
  const label = field.label.trim();
  const key = label.toLowerCase();

  if (key === "done when") {
    return (
      <div className="rounded-lg border border-gold/30 bg-gold/[0.05] px-3 py-2">
        <p className="hud-label flex items-center gap-1.5 !text-gold">
          <Target className="h-3.5 w-3.5" strokeWidth={2} />
          Done when
        </p>
        <Markdown className="mt-1 text-[13.5px] !text-parchment">{field.text}</Markdown>
      </div>
    );
  }

  if (key === "if stuck") return <StuckHint text={field.text} />;

  if (label === "") return <Markdown className="text-[13px]">{field.text}</Markdown>;

  return (
    <div className="text-[13px] sm:grid sm:grid-cols-[4.75rem_1fr] sm:gap-x-3">
      <span
        className={clsx(
          "block pb-0.5 font-mono text-[10px] uppercase leading-snug tracking-[0.12em] sm:pb-0 sm:pt-[3px]",
          key === "skip" ? "text-mist-dim" : key === "fast track" ? "text-type-do" : "text-mist",
        )}
      >
        {label}
      </span>
      <Markdown className="min-w-0 break-words">{field.text}</Markdown>
    </div>
  );
}

function StuckHint({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-expanded={false}
        className="inline-flex items-center gap-1.5 rounded-md border border-dashed border-ink-500 px-2 py-1 text-[12px] text-mist transition-colors hover:border-mist hover:text-parchment"
      >
        <LifeBuoy className="h-3.5 w-3.5" strokeWidth={1.8} />
        Stuck?
      </button>
    );
  }
  return (
    <div className={clsx("rounded-lg border border-ink-500 bg-ink-850/70 px-3 py-2", styles.reveal)}>
      <p className="hud-label flex items-center gap-1.5">
        <LifeBuoy className="h-3.5 w-3.5" strokeWidth={1.8} />
        If stuck
      </p>
      <Markdown className="mt-1 text-[13px]">{text}</Markdown>
    </div>
  );
}

function ActionChip({
  children,
  onClick,
  active,
  gold,
}: {
  children: React.ReactNode;
  onClick: () => void;
  active: boolean;
  gold?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={clsx(
        "inline-flex h-7 items-center gap-1.5 rounded-md border px-2 text-[12px] transition-colors",
        active
          ? "border-ink-400 bg-ink-600 text-parchment"
          : gold
            ? "border-gold/35 text-gold hover:border-gold/60 hover:bg-gold/[0.07]"
            : "border-ink-500 text-parchment-dim hover:border-ink-400 hover:bg-ink-700/70 hover:text-parchment",
      )}
    >
      {children}
    </button>
  );
}
