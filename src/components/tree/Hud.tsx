"use client";

// Floating HUD: view switcher, search and state filters. On the canvas it
// floats over the sky; in the list and focus views it docks as a sidebar.
// On phones it collapses to one row with a toggle for search + filters.

import clsx from "clsx";
import { Crosshair, Flag, ListTree, Orbit, Search, SlidersHorizontal, Star, X } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import type { SkillState } from "@/lib/engine/types";
import type { ActiveQuestSummary } from "@/lib/view-model";
import { STATE_FILTERS, type StateFilter, type TreeViewMode } from "./model";
import { NEUTRAL_ORB, OrbArt } from "./Orb";

const VIEWS: { id: TreeViewMode; label: string; icon: typeof Orbit }[] = [
  { id: "tree", label: "Tree", icon: Orbit },
  { id: "list", label: "List", icon: ListTree },
  { id: "focus", label: "Focus", icon: Crosshair },
];

const FILTER_ORB: Partial<Record<StateFilter, SkillState>> = {
  available: "available",
  "in-progress": "in-progress",
  learned: "learned",
  rusty: "rusty",
  locked: "locked",
};

export interface HudProps {
  view: TreeViewMode;
  onView: (view: TreeViewMode) => void;
  query: string;
  onQuery: (query: string) => void;
  filter: StateFilter;
  onFilter: (filter: StateFilter) => void;
  counts: Record<StateFilter, number>;
  /** Skills shown after search + filter, when either is active. */
  matchCount: number | null;
  total: number;
  quest: ActiveQuestSummary | null;
  /** Palette slot of the neutral orb colour (see NEUTRAL_ORB). */
  neutralSlot: number;
  searchRef: React.RefObject<HTMLInputElement | null>;
  showFilters: boolean;
  className?: string;
}

export function Hud({
  view,
  onView,
  query,
  onQuery,
  filter,
  onFilter,
  counts,
  matchCount,
  total,
  quest,
  neutralSlot,
  searchRef,
  showFilters,
  className,
}: HudProps) {
  const [open, setOpen] = useState(false);
  const active = query.trim() !== "" || (showFilters && filter !== "all");

  return (
    <div className={clsx("panel w-full p-2 sm:w-[344px]", className)}>
      <div className="flex items-center gap-2">
        <div
          className="flex flex-1 items-center rounded-[10px] border border-ink-600/80 bg-ink-950/60 p-[3px]"
          role="group"
          aria-label="View"
        >
          {VIEWS.map(({ id, label, icon: Icon }) => {
            const on = view === id;
            return (
              <button
                key={id}
                type="button"
                aria-pressed={on}
                onClick={() => onView(id)}
                className={clsx(
                  "relative flex h-8 flex-1 items-center justify-center gap-1.5 rounded-[7px] text-[12.5px] font-medium transition-[background,color,box-shadow] duration-200",
                  on
                    ? "bg-ink-600/90 text-parchment shadow-[inset_0_1px_0_rgba(236,230,214,0.08),0_0_0_1px_rgba(233,196,106,0.18)]"
                    : "text-mist hover:text-parchment",
                )}
              >
                <Icon className={clsx("h-3.5 w-3.5", on && "text-gold")} strokeWidth={1.9} />
                {label}
                {on && (
                  <span className="absolute inset-x-4 -bottom-[3px] h-px bg-gold shadow-[0_0_8px_var(--gold)]" />
                )}
              </button>
            );
          })}
        </div>

        {quest && (
          <Link
            href="/quest"
            title={`${quest.title}: this week's plan`}
            className="flex h-9 shrink-0 items-center gap-1.5 rounded-[10px] border border-gold/45 bg-gold/10 px-2.5 text-[12px] font-medium text-gold transition-colors hover:border-gold hover:bg-gold/15 hover:text-gold-bright"
          >
            <Flag className="h-3.5 w-3.5 fill-gold/30" strokeWidth={1.9} />
            <span className="hidden whitespace-nowrap min-[400px]:inline">
              Quest{quest.currentWeek ? <span className="font-mono text-[11px]"> · wk {quest.currentWeek}</span> : null}
            </span>
          </Link>
        )}

        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          aria-controls="tree-hud-tools"
          aria-label={open ? "Hide search and filters" : "Show search and filters"}
          className={clsx(
            "relative grid h-9 w-9 shrink-0 place-items-center rounded-[10px] border transition-colors sm:hidden",
            open ? "border-gold/50 bg-gold/10 text-gold" : "border-ink-600 bg-ink-950/60 text-mist",
          )}
        >
          <SlidersHorizontal className="h-4 w-4" strokeWidth={1.8} />
          {active && !open && <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-gold" />}
        </button>
      </div>

      <div id="tree-hud-tools" className={clsx(open ? "block" : "hidden", "sm:block")}>
        <label className="group relative mt-2 flex h-9 items-center rounded-[10px] border border-ink-600/80 bg-ink-950/60 transition-colors focus-within:border-gold/60 focus-within:shadow-[0_0_0_3px_rgba(233,196,106,0.12)]">
          <Search className="pointer-events-none ml-2.5 h-3.5 w-3.5 shrink-0 text-mist" strokeWidth={2} />
          <span className="sr-only">Search skills</span>
          <input
            ref={searchRef}
            type="text"
            inputMode="search"
            enterKeyHint="search"
            autoComplete="off"
            spellCheck={false}
            value={query}
            onChange={(e) => onQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape" && query) {
                e.preventDefault();
                e.stopPropagation();
                onQuery("");
              }
            }}
            placeholder="Search skills, items, why…"
            className="h-full min-w-0 flex-1 bg-transparent px-2 text-[13px] text-parchment outline-none placeholder:text-mist-dim focus-visible:!outline-none"
          />
          {query ? (
            <button
              type="button"
              onClick={() => {
                onQuery("");
                searchRef.current?.focus();
              }}
              aria-label="Clear search"
              className="mr-1.5 grid h-6 w-6 place-items-center rounded-md text-mist hover:bg-ink-600 hover:text-parchment"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          ) : (
            <kbd className="mr-2 hidden rounded border border-ink-500 px-1.5 font-mono text-[10px] text-mist-dim sm:inline">
              /
            </kbd>
          )}
        </label>

        {showFilters && (
          <div className="mt-2 flex flex-wrap gap-1" role="group" aria-label="Filter by state">
            {STATE_FILTERS.map(({ id, label }) => {
              const on = filter === id;
              const orb = FILTER_ORB[id];
              return (
                <button
                  key={id}
                  type="button"
                  aria-pressed={on}
                  onClick={() => onFilter(on && id !== "all" ? "all" : id)}
                  className={clsx(
                    "flex h-7 items-center gap-1.5 rounded-full border pl-1.5 pr-2 text-[12px] transition-[background,border,color] duration-150",
                    on
                      ? "border-gold/55 bg-gold/10 text-parchment"
                      : "border-ink-600/80 bg-ink-900/40 text-mist hover:border-ink-400 hover:text-parchment",
                  )}
                >
                  {orb ? (
                    <OrbArt state={orb} color={NEUTRAL_ORB} slot={neutralSlot} progress={0.6} size={13} />
                  ) : id === "starred" ? (
                    <Star className="h-3 w-3 fill-gold text-gold" strokeWidth={1.5} />
                  ) : (
                    <span
                      className="h-[11px] w-[11px] rounded-full border border-parchment-dim/50"
                      style={{ background: "conic-gradient(var(--branch-1), var(--branch-2), var(--branch-3), var(--branch-1))" }}
                    />
                  )}
                  {label}
                  <span className={clsx("font-mono text-[10.5px] tabular-nums", on ? "text-gold" : "text-mist-dim")}>
                    {counts[id]}
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {matchCount !== null && (
          <div className="mt-2 flex items-center justify-between px-1 font-mono text-[11px] text-mist" aria-live="polite">
            <span>
              <span className="text-parchment">{matchCount}</span> of {total} skills match
            </span>
            <button
              type="button"
              onClick={() => {
                onQuery("");
                onFilter("all");
              }}
              className="rounded px-1 uppercase tracking-[0.1em] text-mist-dim hover:text-gold"
            >
              Clear
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
