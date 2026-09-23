"use client";

import clsx from "clsx";
import { FileCode, Hourglass, ShieldCheck, TriangleAlert } from "lucide-react";
import { useId, useState } from "react";
import { verifyItem } from "@/app/actions";
import { Button } from "@/components/ui/Button";
import { Markdown } from "@/components/ui/Markdown";
import { useAction } from "@/components/ui/useAction";
import { FRESHNESS_DAYS } from "@/lib/config";
import type { Item } from "@/lib/content/types";
import { addDays } from "@/lib/engine/dates";
import type { ItemView } from "@/lib/engine/types";
import { usePanel } from "./context";
import { formatDay, formatInstant, relativeDays } from "./format";
import { escapeHandler, inputClass } from "./parts";

/**
 * Re-verification of a time-sensitive fact: "Still true" refreshes its
 * freshness window; "It changed" records the change and points at the
 * content file to edit.
 */
export function VerifyControl({
  item,
  itemView,
  showStatus = true,
}: {
  item: Item;
  itemView: ItemView;
  /** Hide the freshness line when the surrounding UI already states it. */
  showStatus?: boolean;
}) {
  const { data, skill } = usePanel();
  const { run, pending } = useAction();
  const [changing, setChanging] = useState(false);
  const [note, setNote] = useState("");
  const noteId = useId();

  const latest = data.verifications
    .filter((v) => v.skillId === skill.id && v.itemId === item.id)
    .reduce<(typeof data.verifications)[number] | null>((acc, v) => (acc === null || v.verifiedAt > acc.verifiedAt ? v : acc), null);
  const freshUntil = formatDay(addDays(data.today, FRESHNESS_DAYS), data.today);
  // The engine keeps the item stale until a later "Still true" or a newer As of date in the file.
  const changePending = itemView.changedOn !== null && latest?.changed === true;

  const submit = (changed: boolean) =>
    run(() => verifyItem({ skillId: skill.id, itemId: item.id, changed, note: note.trim() || null }), {
      success: changed ? "Change recorded: update the content file" : `Verified: fresh until ${freshUntil}`,
      tone: changed ? "info" : "success",
    }).then((r) => {
      if (r.ok) {
        setChanging(false);
        setNote("");
      }
    });

  return (
    <div
      className={clsx(
        "rounded-lg border px-3 py-2.5",
        itemView.stale ? "border-stale/45 bg-stale/[0.06]" : "border-ink-600 bg-ink-850/60",
      )}
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="hud-label inline-flex items-center gap-1.5 !text-stale">
          <ShieldCheck className="h-3.5 w-3.5" strokeWidth={1.8} />
          Re-verify
        </span>
        {showStatus && itemView.staleOn && (
          <span className={clsx("inline-flex items-center gap-1 font-mono text-[11px]", itemView.stale ? "text-stale" : "text-mist")}>
            {itemView.stale ? <TriangleAlert className="h-3 w-3" /> : <Hourglass className="h-3 w-3" />}
            {itemView.stale
              ? `stale since ${formatDay(itemView.staleOn, data.today)}`
              : `fresh until ${formatDay(itemView.staleOn, data.today)} (${relativeDays(itemView.staleOn, data.today)})`}
          </span>
        )}
        <span className="font-mono text-[11px] text-mist-dim">
          {itemView.changedOn
            ? `change found ${formatDay(itemView.changedOn, data.today)}`
            : itemView.lastVerifiedAt
              ? `last confirmed ${formatDay(itemView.lastVerifiedAt, data.today)}`
              : "not re-checked yet"}
        </span>
      </div>

      {item.verify && (
        <Markdown className="mt-2 text-[13px]">{`**Check:** ${item.verify}`}</Markdown>
      )}

      {latest && changePending && (
        <div className="mt-2.5 rounded-md border border-ink-500 bg-ink-900/60 px-2.5 py-2 text-[12.5px] text-parchment-dim">
          <p className="flex items-start gap-1.5">
            <FileCode className="mt-0.5 h-3.5 w-3.5 shrink-0 text-gold" strokeWidth={1.8} />
            <span>
              The check on {formatInstant(latest.verifiedAt, data.today)} found a change
              {latest.note ? <>: <span className="text-parchment">{latest.note}</span></> : null}. Update the fact in{" "}
              <code className="rounded bg-ink-700 px-1 font-mono text-[11.5px] text-parchment">
                {skill.file}:{item.line}
              </code>{" "}
              and its as-of date, then mark it still true.
            </span>
          </p>
        </div>
      )}

      {changing ? (
        <div className="mt-2.5 space-y-2" onKeyDown={escapeHandler(() => setChanging(false))}>
          <label htmlFor={noteId} className="sr-only">
            What changed?
          </label>
          <textarea
            id={noteId}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            placeholder="What changed? e.g. the band is now 5–8% (optional)"
            className={inputClass}
            autoFocus
          />
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="secondary" loading={pending} onClick={() => submit(true)}>
              Record change
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setChanging(false)}>
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <div className="mt-2.5 flex flex-wrap gap-2">
          <Button size="sm" variant="secondary" loading={pending} onClick={() => submit(false)}>
            <ShieldCheck className="h-3.5 w-3.5 text-ok" strokeWidth={2} />
            Still true
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setChanging(true)}>
            It changed
          </Button>
        </div>
      )}
    </div>
  );
}
