"use client";

import clsx from "clsx";
import {
  Check,
  ChevronDown,
  Clock,
  Gem,
  Hourglass,
  MessageSquare,
  Minus,
  Repeat,
  SkipForward,
  TriangleAlert,
} from "lucide-react";
import Link from "next/link";
import { useId, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Markdown } from "@/components/ui/Markdown";
import { formatMinutesShort, itemTypeMeta } from "@/components/ui/meta";
import type { Item } from "@/lib/content/types";
import { xpForLog } from "@/lib/engine/xp";
import type { ItemView } from "@/lib/engine/types";
import type { ItemStatus } from "@/lib/progress/types";
import { usePanel } from "./context";
import { formatDay, parseMinutes, relativeDays, remainingMinutes } from "./format";
import { ItemDetails } from "./ItemDetails";
import { escapeHandler, Tag } from "./parts";
import styles from "./skill.module.css";

export interface ItemRowProps {
  item: Item;
  itemView: ItemView | undefined;
  /** Optimistic status. */
  status: ItemStatus;
  /** Why the status can't change (locked skill or rank), or null. */
  disabledReason: string | null;
  isFirst: boolean;
  isLast: boolean;
  /** Neighbours cleared (done or skipped): lights the constellation segments between nodes. */
  prevCleared: boolean;
  nextCleared: boolean;
  onSetStatus: (item: Item, status: ItemStatus, minutes?: number) => void;
}

const cleared = (s: ItemStatus) => s !== "todo";

export function ItemRow(props: ItemRowProps) {
  const { item, itemView, status, disabledReason, isFirst, isLast, prevCleared, nextCleared, onSetStatus } = props;
  const { data, view } = usePanel();
  const [expanded, setExpanded] = useState(false);
  const [completing, setCompleting] = useState(false);
  // Only a completion made in this session pops; done items don't all animate on open.
  const [celebrate, setCelebrate] = useState(false);
  const detailsId = useId();
  const nodeRef = useRef<HTMLButtonElement>(null);

  const meta = itemTypeMeta(item.type);
  const TypeIcon = meta.icon;
  const isHabit = item.type === "habit";
  const noId = item.id === "";
  const reason = noId ? "This item has no id yet: run `pnpm content:ids`" : disabledReason;
  const thisWeek = data.activeQuest?.thisWeekItemKeys.includes(item.key) ?? false;
  // A test-out or self-report clears every item (the quest plan counts them done), but the
  // item itself stays todo so it can still be worked through and logged.
  const covered =
    status === "todo" && !isHabit && !item.optional && view.learned && view.learnedVia !== "completed"
      ? view.learnedVia === "tested-out"
        ? "cleared by the test-out"
        : "cleared: already known"
      : null;
  const isCleared = cleared(status) || covered !== null;

  const complete = (minutes?: number) => {
    setCompleting(false);
    setCelebrate(true);
    onSetStatus(item, "done", minutes);
  };

  const toggleExpanded = () => setExpanded((e) => !e);

  return (
    <li className={clsx("group/item relative flex gap-3 py-2.5 pr-1", item.optional && !isCleared && "opacity-[0.78]")}>
      {/* Constellation segments between item nodes. */}
      <span
        aria-hidden
        className={clsx("absolute left-[11px] w-px", isFirst ? "-top-1.5 h-3.5" : "top-0 h-2")}
        style={{ background: !isFirst && prevCleared && isCleared ? "var(--gold-deep)" : "var(--ink-500)" }}
      />
      {!isLast && (
        <span
          aria-hidden
          className="absolute bottom-0 left-[11px] top-[36px] w-px"
          style={{ background: nextCleared && isCleared ? "var(--gold-deep)" : "var(--ink-500)" }}
        />
      )}

      <div className="relative z-10 flex w-[23px] shrink-0 justify-center pt-px">
        {isHabit ? (
          <span
            className="grid h-[22px] w-[22px] place-items-center rounded-full border border-dashed"
            style={{ borderColor: meta.color, color: meta.color }}
            title="Habit: tracked on the Habits page"
          >
            <Repeat className="h-3 w-3" strokeWidth={2} />
          </span>
        ) : (
          <StatusNode
            ref={nodeRef}
            status={status}
            color={meta.color}
            // A lock stops new work, not housekeeping: a done or skipped item can always be undone.
            disabledReason={noId || status === "todo" ? reason : null}
            celebrate={celebrate}
            covered={covered}
            label={item.title}
            onClick={() => {
              if (status === "todo") setCompleting((c) => !c);
              else onSetStatus(item, "todo");
            }}
          />
        )}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-start gap-2">
          {/* The chevron button is the accessible toggle; clicking the text is a mouse shortcut. */}
          <div
            className="min-w-0 flex-1 cursor-pointer"
            onClick={(e) => {
              if ((e.target as HTMLElement).closest("a, button")) return;
              toggleExpanded();
            }}
          >
            <Markdown
              inline
              className={clsx(
                "text-[14px] leading-snug transition-colors",
                status === "done" && "!text-parchment-dim",
                status === "skipped" && "!text-mist-dim line-through decoration-ink-400",
                status === "todo" && "!text-parchment",
              )}
            >
              {item.title}
            </Markdown>
            <div className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1">
              <Tag color={meta.color}>
                <TypeIcon className="h-3 w-3" strokeWidth={2} />
                {meta.label}
              </Tag>
              {(item.timeText || item.minutes != null) && (
                <Tag className="!normal-case !tracking-normal text-mist" title="Estimated time">
                  <Clock className="h-3 w-3" strokeWidth={1.8} />
                  {item.timeText ?? formatMinutesShort(item.minutes)}
                </Tag>
              )}
              {isHabit && item.cadence && (
                <Tag color="var(--type-habit)" className="!normal-case !tracking-normal">
                  {item.cadence.text}
                </Tag>
              )}
              {item.optional && <Tag className="text-mist-dim">optional</Tag>}
              {status === "skipped" && <Tag className="text-mist">skipped</Tag>}
              {covered && (
                <Tag color="var(--gold-deep)" className="!normal-case !tracking-normal" title="The skill is learned, so this item no longer blocks anything">
                  {covered}
                </Tag>
              )}
              {thisWeek && !isCleared && (
                <Tag
                  color="var(--gold)"
                  className="rounded border border-gold/40 bg-gold/[0.08] px-1 py-px"
                  title={`Planned for this week on ${data.activeQuest?.title ?? "the active quest"}`}
                >
                  This week
                </Tag>
              )}
              {item.timeSensitive && itemView?.staleOn && (
                <Tag
                  color={itemView.stale ? "var(--stale)" : "color-mix(in oklab, var(--stale) 70%, var(--mist))"}
                  className="!normal-case !tracking-normal"
                  title="Time-sensitive fact"
                >
                  {itemView.stale ? <TriangleAlert className="h-3 w-3" /> : <Hourglass className="h-3 w-3" />}
                  {itemView.stale
                    ? `stale since ${formatDay(itemView.staleOn, data.today)}`
                    : `as of ${formatDay(itemView.asOf ?? data.today, data.today)} · stale ${relativeDays(itemView.staleOn, data.today)}`}
                </Tag>
              )}
              {itemView && itemView.minutesLogged > 0 && (
                <Tag className="!normal-case !tracking-normal text-parchment-dim" title="Time logged on this item">
                  {formatMinutesShort(itemView.minutesLogged)} logged
                </Tag>
              )}
              {itemView && itemView.noteCount > 0 && (
                <Tag className="text-mist" title={`${itemView.noteCount} note${itemView.noteCount === 1 ? "" : "s"}`}>
                  <MessageSquare className="h-3 w-3" strokeWidth={1.8} />
                  {itemView.noteCount}
                </Tag>
              )}
              {itemView && itemView.outputCount > 0 && (
                <Tag color="var(--gold)" title={`${itemView.outputCount} loot attached`}>
                  <Gem className="h-3 w-3" strokeWidth={1.8} />
                  {itemView.outputCount}
                </Tag>
              )}
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-0.5">
            {!isHabit && status === "todo" && !reason && !covered && (
              <button
                type="button"
                onClick={() => onSetStatus(item, "skipped")}
                title="Skip: doesn't block the rank"
                className="inline-flex h-7 items-center gap-1 rounded-md px-1.5 font-mono text-[10.5px] uppercase tracking-[0.08em] text-mist-dim opacity-100 transition-[opacity,color,background-color] hover:bg-ink-700/70 hover:text-parchment focus-visible:opacity-100 md:opacity-0 md:group-hover/item:opacity-100 md:group-focus-within/item:opacity-100"
              >
                <SkipForward className="h-3 w-3" strokeWidth={2} />
                Skip
              </button>
            )}
            <button
              type="button"
              onClick={toggleExpanded}
              aria-expanded={expanded}
              aria-controls={detailsId}
              aria-label={expanded ? "Hide details" : "Show details"}
              className="grid h-7 w-7 place-items-center rounded-md text-mist transition-colors hover:bg-ink-700/70 hover:text-parchment"
            >
              <ChevronDown className={clsx("h-4 w-4 transition-transform duration-200", expanded && "rotate-180")} />
            </button>
          </div>
        </div>

        {completing && status === "todo" && (
          <CompleteForm
            item={item}
            logged={itemView?.minutesLogged ?? 0}
            onCancel={() => {
              setCompleting(false);
              nodeRef.current?.focus();
            }}
            onComplete={complete}
          />
        )}

        {isHabit && (
          <p className="mt-1.5 text-[12.5px] text-mist">
            Tracked on the{" "}
            <Link href="/habits" className="text-parchment underline decoration-ink-400 underline-offset-[3px] hover:decoration-gold">
              Habits page
            </Link>
            {item.cadence ? ` · ${item.cadence.text}` : ""}
          </p>
        )}

        {expanded && (
          <div id={detailsId} className={clsx("mt-3", styles.reveal)}>
            <ItemDetails item={item} itemView={itemView} />
          </div>
        )}
      </div>
    </li>
  );
}

function StatusNode({
  ref,
  status,
  color,
  disabledReason,
  celebrate,
  covered,
  label,
  onClick,
}: {
  ref: React.Ref<HTMLButtonElement>;
  status: ItemStatus;
  color: string;
  disabledReason: string | null;
  celebrate: boolean;
  /** Cleared by learning the skill, though not marked done itself. */
  covered: string | null;
  label: string;
  onClick: () => void;
}) {
  const plainLabel = label.replace(/\[@[a-z]+@([^\]]*)\]\([^)]*\)/g, "$1").replace(/[*_`[\]]/g, "");
  const title =
    disabledReason ??
    (status === "done"
      ? "Done · click to undo"
      : status === "skipped"
        ? "Skipped · click to restore"
        : covered
          ? `${covered[0].toUpperCase()}${covered.slice(1)} · click to mark it done`
          : "Mark done");
  return (
    <button
      ref={ref}
      type="button"
      role="checkbox"
      aria-checked={status === "done"}
      aria-label={`${plainLabel}${status === "skipped" ? " (skipped)" : ""}`}
      title={title}
      disabled={disabledReason !== null}
      onClick={onClick}
      className={clsx(
        "group/node relative grid h-[22px] w-[22px] place-items-center rounded-full border-[1.5px] disabled:cursor-not-allowed disabled:opacity-40",
        styles.node,
        status === "done" && celebrate && styles.nodeDone,
      )}
      style={
        status === "done"
          ? {
              background: "radial-gradient(circle at 35% 30%, var(--gold-bright), var(--gold) 70%)",
              borderColor: "var(--gold-bright)",
              boxShadow: "0 0 12px -1px var(--gold)",
            }
          : status === "skipped"
            ? { borderColor: "var(--ink-400)", borderStyle: "dashed", background: "var(--ink-850)" }
            : covered
              ? { borderColor: "var(--gold-deep)", borderStyle: "dashed", background: "color-mix(in oklab, var(--gold) 10%, var(--ink-850))" }
              : {
                borderColor: `color-mix(in oklab, ${color} 62%, var(--ink-500))`,
                background: "var(--ink-850)",
              }
      }
    >
      {status === "done" && <Check className="h-3 w-3 text-ink-900" strokeWidth={3.2} />}
      {status === "skipped" && <Minus className="h-3 w-3 text-mist" strokeWidth={2.4} />}
      {status === "todo" && !disabledReason && (
        <Check
          className={clsx(
            "h-3 w-3 transition-opacity group-hover/node:opacity-60 group-focus-visible/node:opacity-60",
            covered ? "opacity-40" : "opacity-0",
          )}
          style={{ color: covered ? "var(--gold)" : color }}
          strokeWidth={3}
        />
      )}
    </button>
  );
}

/** "Time spent [45] min · Log & complete / Just complete" */
function CompleteForm({
  item,
  logged,
  onCancel,
  onComplete,
}: {
  item: Item;
  /** Minutes already logged on the item; the prefill is what's left of the estimate. */
  logged: number;
  onCancel: () => void;
  onComplete: (minutes?: number) => void;
}) {
  const [value, setValue] = useState(() => String(remainingMinutes(item.minutes, logged) ?? ""));
  const inputId = useId();
  const minutes = parseMinutes(value);
  const activity = item.type && item.type !== "habit" ? item.type : "other";
  const xp = minutes ? xpForLog(activity, minutes) : 0;
  // With sessions already logged, finishing usually adds nothing: make that the easy path.
  const justCompleteFirst = logged > 0 && !minutes;

  return (
    <div
      className={clsx("mt-2 rounded-lg border border-gold/30 bg-gold/[0.05] px-3 py-2.5", styles.reveal)}
      onKeyDown={escapeHandler(onCancel)}
    >
      <div className="flex items-center gap-2">
        <label htmlFor={inputId} className="text-[12.5px] text-parchment-dim">
          Time spent
        </label>
        <input
          id={inputId}
          type="number"
          inputMode="numeric"
          min={1}
          max={1440}
          value={value}
          autoFocus
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key !== "Enter") return;
            if (minutes) {
              e.preventDefault();
              onComplete(minutes);
            } else if (justCompleteFirst && !value.trim()) {
              e.preventDefault();
              onComplete();
            }
          }}
          className="h-7 w-[4.25rem] rounded-md border border-ink-500 bg-ink-850 px-2 text-right font-mono text-[13px] text-parchment [appearance:textfield] focus:border-gold/60 focus:outline-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
        />
        <span className="font-mono text-[12px] text-mist">min</span>
        {xp > 0 && <span className="ml-auto font-mono text-[11.5px] text-gold">+{xp} XP</span>}
      </div>
      {logged > 0 && (
        <p className="mt-1.5 font-mono text-[11px] text-mist">
          {formatMinutesShort(logged)} already logged on this item{minutes ? "; the time above is added to it" : ""}
        </p>
      )}
      <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
        <Button size="sm" variant={justCompleteFirst ? "secondary" : "gold"} disabled={!minutes} onClick={() => minutes && onComplete(minutes)}>
          <Check className="h-3.5 w-3.5" strokeWidth={2.6} />
          Log &amp; complete
        </Button>
        <Button size="sm" variant={justCompleteFirst ? "gold" : "secondary"} onClick={() => onComplete()}>
          Just complete
        </Button>
        <Button size="sm" variant="ghost" className="ml-auto" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
