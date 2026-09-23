"use client";

import clsx from "clsx";
import { ExternalLink, Gem, NotebookPen, Pencil, Plus, Trash2 } from "lucide-react";
import { useId, useState } from "react";
import { deleteNote, saveNote } from "@/app/actions";
import { Button } from "@/components/ui/Button";
import { Markdown } from "@/components/ui/Markdown";
import { useAction } from "@/components/ui/useAction";
import type { NoteKind, NoteRow } from "@/lib/progress/types";
import { usePanel } from "./context";
import { formatInstant, plural } from "./format";
import { ConfirmAction, escapeHandler, FieldLabel, inputClass, SectionHeading, Segmented } from "./parts";
import styles from "./skill.module.css";

/** Skill-level notes and loot (item notes live under their items). */
export function NotesSection() {
  const { data, skill } = usePanel();
  const [adding, setAdding] = useState(false);
  const notes = data.notes
    .filter((n) => n.skillId === skill.id && n.itemId === null)
    .toSorted((a, b) => b.createdAt.localeCompare(a.createdAt));
  const lootCount = notes.filter((n) => n.kind === "output").length;
  const itemNoteCount = data.notes.filter((n) => n.skillId === skill.id && n.itemId !== null).length;

  return (
    <section aria-labelledby="notes-heading">
      <SectionHeading
        id="notes-heading"
        title="Notes & loot"
        meta={
          notes.length > 0
            ? [notes.length - lootCount > 0 && plural(notes.length - lootCount, "note"), lootCount > 0 && `${lootCount} loot`]
                .filter(Boolean)
                .join(" · ")
            : undefined
        }
        action={
          !adding && (
            <Button size="sm" variant="ghost" onClick={() => setAdding(true)}>
              <Plus className="h-3.5 w-3.5" />
              Add
            </Button>
          )
        }
      />
      {adding && (
        <div className="mb-3">
          <NoteForm initialKind="note" onDone={() => setAdding(false)} />
        </div>
      )}
      {notes.length > 0 ? (
        <ul className="space-y-2">
          {notes.map((n) => (
            <li key={n.id}>
              <NoteCard note={n} />
            </li>
          ))}
        </ul>
      ) : (
        !adding && (
          <p className="text-[13px] leading-relaxed text-mist">
            Nothing yet. Jot down what clicked, or attach <span className="text-gold">loot</span>: the write-ups and
            builds this skill produced.
          </p>
        )
      )}
      {itemNoteCount > 0 && (
        <p className="mt-2 font-mono text-[11px] text-mist-dim">
          + {itemNoteCount} on items above
        </p>
      )}
    </section>
  );
}

export function NoteCard({ note }: { note: NoteRow }) {
  const { data } = usePanel();
  const { run, pending } = useAction();
  const [editing, setEditing] = useState(false);
  const loot = note.kind === "output";

  if (editing) return <NoteForm note={note} initialKind={note.kind} itemId={note.itemId} onDone={() => setEditing(false)} />;

  return (
    <article
      className={clsx(
        "group/note relative rounded-lg border bg-ink-850/60 px-3 py-2.5",
        loot ? "border-gold/30 shadow-[inset_2px_0_0_var(--gold)]" : "border-ink-600",
      )}
    >
      <header className="flex items-start gap-2">
        <span
          className={clsx(
            "mt-[2px] inline-flex shrink-0 items-center gap-1 font-mono text-[10px] uppercase tracking-[0.1em]",
            loot ? "text-gold" : "text-mist",
          )}
        >
          {loot ? <Gem className="h-3 w-3" strokeWidth={1.8} /> : <NotebookPen className="h-3 w-3" strokeWidth={1.8} />}
          {loot ? "Loot" : "Note"}
        </span>
        <div className="min-w-0 flex-1">
          {note.title && <p className="text-[13.5px] font-medium leading-snug text-parchment">{note.title}</p>}
        </div>
        <div className="-mr-1.5 -mt-1 flex shrink-0 items-center gap-0.5 md:opacity-0 md:transition-opacity md:group-hover/note:opacity-100 md:group-focus-within/note:opacity-100">
          <button
            type="button"
            onClick={() => setEditing(true)}
            aria-label={loot ? "Edit loot" : "Edit note"}
            title="Edit"
            className="grid h-7 w-7 place-items-center rounded-md text-mist hover:bg-ink-700/70 hover:text-parchment"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
          <ConfirmAction
            label={loot ? "Delete loot" : "Delete note"}
            confirmLabel="Delete"
            icon={<Trash2 className="h-3.5 w-3.5" />}
            pending={pending}
            onConfirm={() => void run(() => deleteNote({ id: note.id }), { success: loot ? "Loot removed" : "Note deleted", tone: "info" })}
          />
        </div>
        <span
          className="shrink-0 font-mono text-[10.5px] leading-5 text-mist-dim"
          title={note.updatedAt !== note.createdAt ? `Edited ${formatInstant(note.updatedAt, data.today)}` : undefined}
        >
          {formatInstant(note.createdAt, data.today)}
        </span>
      </header>
      {note.url && (
        <a
          href={note.url}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-1 inline-flex max-w-full items-center gap-1 font-mono text-[11.5px] text-parchment-dim underline decoration-ink-400 underline-offset-[3px] hover:text-parchment hover:decoration-gold"
        >
          <ExternalLink className="h-3 w-3 shrink-0" />
          <span className="truncate">{displayUrl(note.url)}</span>
        </a>
      )}
      {note.body.trim() && <Markdown className="mt-1.5 text-[13px]">{note.body}</Markdown>}
    </article>
  );
}

function displayUrl(url: string): string {
  try {
    const u = new URL(url);
    return `${u.hostname.replace(/^www\./, "")}${u.pathname === "/" ? "" : u.pathname}`;
  } catch {
    return url;
  }
}

/** Create or edit a note / loot on the skill, or on one item when `itemId` is set. */
export function NoteForm({
  note,
  itemId = null,
  initialKind,
  lockKind,
  onDone,
}: {
  note?: NoteRow;
  itemId?: string | null;
  initialKind: NoteKind;
  lockKind?: boolean;
  onDone: () => void;
}) {
  const { skill } = usePanel();
  const { run, pending } = useAction();
  const [kind, setKind] = useState<NoteKind>(initialKind);
  const [title, setTitle] = useState(note?.title ?? "");
  const [url, setUrl] = useState(note?.url ?? "");
  const [body, setBody] = useState(note?.body ?? "");
  const [error, setError] = useState<string | null>(null);
  const ids = useId();
  const loot = kind === "output";
  const empty = !title.trim() && !url.trim() && !body.trim();

  const submit = () => {
    if (empty) return;
    const trimmedUrl = url.trim();
    if (trimmedUrl && !/^https?:\/\/\S+$/i.test(trimmedUrl)) {
      setError("Links need to start with http:// or https://");
      return;
    }
    setError(null);
    void run(
      () =>
        saveNote({
          id: note?.id ?? null,
          skillId: skill.id,
          itemId,
          kind,
          title: title.trim() || null,
          body,
          url: trimmedUrl || null,
        }),
      { success: note ? "Saved" : loot ? "Loot attached" : "Note saved" },
    ).then((r) => {
      if (r.ok) onDone();
    });
  };

  return (
    <form
      className={clsx(
        "space-y-2.5 rounded-lg border bg-ink-850/80 p-3",
        loot ? "border-gold/35" : "border-ink-500",
        styles.reveal,
      )}
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      onKeyDown={escapeHandler(onDone)}
    >
      {!lockKind && (
        <Segmented<NoteKind>
          label="Kind"
          value={kind}
          onChange={setKind}
          options={[
            {
              value: "note",
              label: (
                <>
                  <NotebookPen className="h-3.5 w-3.5" strokeWidth={1.8} /> Note
                </>
              ),
            },
            {
              value: "output",
              label: (
                <>
                  <Gem className="h-3.5 w-3.5 text-gold" strokeWidth={1.8} /> Loot
                </>
              ),
            },
          ]}
        />
      )}
      {lockKind && (
        <p className={clsx("hud-label flex items-center gap-1.5", loot && "!text-gold")}>
          {loot ? <Gem className="h-3.5 w-3.5" /> : <NotebookPen className="h-3.5 w-3.5" />}
          {note ? "Edit" : loot ? "Attach loot" : "New note"}
        </p>
      )}
      <div>
        <FieldLabel htmlFor={`${ids}-title`}>{loot ? "What did I make?" : "Title (optional)"}</FieldLabel>
        <input
          id={`${ids}-title`}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={loot ? "e.g. One-page write-up, a dashboard, a script" : "e.g. What finally clicked"}
          className={inputClass}
          maxLength={300}
          autoFocus
        />
      </div>
      <div>
        <FieldLabel htmlFor={`${ids}-url`}>Link (optional)</FieldLabel>
        <input
          id={`${ids}-url`}
          type="url"
          inputMode="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://…"
          className={clsx(inputClass, "font-mono !text-[12.5px]")}
        />
      </div>
      <div>
        <FieldLabel htmlFor={`${ids}-body`}>{loot ? "Summary or the text itself" : "Note"} · markdown</FieldLabel>
        <textarea
          id={`${ids}-body`}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              submit();
            }
          }}
          rows={loot ? 3 : 4}
          placeholder={loot ? "What it covers, what I'd do differently…" : "What clicked, what confused me, what to look up…"}
          className={clsx(inputClass, "resize-y leading-relaxed")}
        />
      </div>
      {error && <p className="text-[12.5px] text-danger">{error}</p>}
      <div className="flex items-center gap-2">
        <Button type="submit" size="sm" variant={loot ? "gold" : "primary"} loading={pending} disabled={empty}>
          {note ? "Save" : loot ? "Attach loot" : "Save note"}
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={onDone}>
          Cancel
        </Button>
        <span className="ml-auto hidden font-mono text-[10.5px] text-mist-dim sm:inline">⌘↵ to save</span>
      </div>
    </form>
  );
}
