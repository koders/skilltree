"use client";

// The tree page shell. Owns the URL state (?view, ?skill, ?q) and the state
// filter, and lays out the three views, the HUD, the legend and the side
// panel. URL updates use history.replaceState: Next syncs useSearchParams
// without a server round trip, and history isn't spammed.

import clsx from "clsx";
import { useSearchParams } from "next/navigation";
import { useDeferredValue, useEffect, useEffectEvent, useMemo, useRef, useState } from "react";
import { SkillPanel } from "@/components/skill/SkillPanel";
import type { TreeData } from "@/lib/view-model";
import { FocusView } from "./FocusView";
import { Hud } from "./Hud";
import { Legend } from "./Legend";
import {
  buildTreeModel,
  matchesFilter,
  matchesQuery,
  parseViewMode,
  STATE_FILTERS,
  type StateFilter,
  type TreeViewMode,
} from "./model";
import { NEUTRAL_ORB, OrbDefs } from "./Orb";
import { SkillCanvas } from "./SkillCanvas";
import { SkillList } from "./SkillList";

function writeParams(patch: Record<string, string | null>) {
  const params = new URLSearchParams(window.location.search);
  for (const [key, value] of Object.entries(patch)) {
    if (value === null || value === "") params.delete(key);
    else params.set(key, value);
  }
  const qs = params.toString();
  window.history.replaceState(null, "", qs ? `${window.location.pathname}?${qs}` : window.location.pathname);
}

function isTyping(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);
}

export function TreeExplorer({ data }: { data: TreeData }) {
  const searchParams = useSearchParams();
  const view = parseViewMode(searchParams.get("view"));
  const model = useMemo(() => buildTreeModel(data), [data]);
  const skillParam = searchParams.get("skill");
  const selectedId = skillParam && model.byId.has(skillParam) ? skillParam : null;

  const [query, setQueryState] = useState(() => searchParams.get("q") ?? "");
  const [filter, setFilter] = useState<StateFilter>("all");
  const deferredQuery = useDeferredValue(query);
  const searchRef = useRef<HTMLInputElement>(null);

  // Focus ignores the state filter: it's already a curated slice.
  const activeFilter = view === "focus" ? "all" : filter;
  const visible = useMemo(() => {
    if (!deferredQuery.trim() && activeFilter === "all") return null;
    return new Set(
      model.skills
        .filter((m) => matchesFilter(m.view, activeFilter) && matchesQuery(m, deferredQuery))
        .map((m) => m.skill.id),
    );
  }, [model, deferredQuery, activeFilter]);

  const counts = useMemo(() => {
    const out = {} as Record<StateFilter, number>;
    for (const { id } of STATE_FILTERS) out[id] = model.skills.filter((m) => matchesFilter(m.view, id)).length;
    return out;
  }, [model]);

  const orbPalette = useMemo(() => [...model.palette, NEUTRAL_ORB], [model.palette]);
  const neutralSlot = orbPalette.length - 1;

  const select = (id: string | null) => writeParams({ skill: id });
  const setView = (v: TreeViewMode) => writeParams({ view: v === "tree" ? null : v });
  const setQuery = (q: string) => {
    setQueryState(q);
    writeParams({ q: q || null });
  };

  const onKey = useEffectEvent((e: KeyboardEvent) => {
    if (e.defaultPrevented) return;
    if (e.key === "Escape" && selectedId) {
      // A dialog opened from the panel handles its own Escape.
      if (document.querySelector("dialog[open]")) return;
      select(null);
      return;
    }
    if (e.key === "/" && !isTyping(e.target) && !e.metaKey && !e.ctrlKey && !e.altKey) {
      e.preventDefault();
      searchRef.current?.focus();
      searchRef.current?.select();
    }
  });
  useEffect(() => {
    const handler = (e: KeyboardEvent) => onKey(e);
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const panelOpen = selectedId !== null;
  const hud = (className: string) => (
    <Hud
      view={view}
      onView={setView}
      query={query}
      onQuery={setQuery}
      filter={filter}
      onFilter={setFilter}
      counts={counts}
      matchCount={visible ? visible.size : null}
      total={model.skills.length}
      quest={data.activeQuest}
      neutralSlot={neutralSlot}
      searchRef={searchRef}
      showFilters={view !== "focus"}
      className={className}
    />
  );

  return (
    <div className="relative h-full w-full">
      <OrbDefs palette={orbPalette} />

      {view === "tree" ? (
        <>
          {/* HUD first in the DOM so Tab reaches search before the orbs. */}
          <div className="pointer-events-none absolute inset-x-3 top-3 z-20 flex sm:right-auto">
            {hud("pointer-events-auto animate-rise")}
          </div>
          <SkillCanvas
            data={data}
            model={model}
            visible={visible}
            selectedId={selectedId}
            onSelect={select}
            panelOpen={panelOpen}
          />
          <Legend
            data={data}
            palette={model.palette}
            neutralSlot={neutralSlot}
            fold={panelOpen}
            className="absolute bottom-3 left-3 z-20 animate-rise [animation-delay:120ms]"
          />
          {visible && visible.size === 0 && (
            <div className="pointer-events-none absolute inset-x-0 top-1/2 z-10 flex -translate-y-1/2 justify-center">
              <div className="panel pointer-events-auto px-5 py-4 text-center animate-rise">
                <p className="font-display text-[18px] text-parchment">No stars match</p>
                <p className="mt-1 text-[13px] text-mist">Try another word, or clear the filter.</p>
                <button
                  type="button"
                  onClick={() => {
                    setQuery("");
                    setFilter("all");
                  }}
                  className="mt-3 rounded-md border border-ink-500 px-3 py-1 font-mono text-[11px] uppercase tracking-[0.12em] text-mist transition-colors hover:border-gold/60 hover:text-gold"
                >
                  Clear
                </button>
              </div>
            </div>
          )}
        </>
      ) : (
        <div
          className={clsx(
            "starfield absolute inset-0 overflow-y-auto transition-[padding] duration-300",
            // Below lg the panel overlays the list like a drawer: a 260px sliver of list would be worse.
            panelOpen && "lg:pr-[calc(min(480px,100vw-24px)+24px)]",
          )}
        >
          {/* With the panel open there's less room: the HUD docks above the list unless the screen is huge. */}
          <div
            className={clsx(
              "mx-auto grid max-w-[1160px] items-start gap-4 px-3 py-3 sm:px-5 sm:py-5",
              panelOpen
                ? "2xl:grid-cols-[344px_minmax(0,1fr)] 2xl:gap-6"
                : "lg:grid-cols-[344px_minmax(0,1fr)] lg:gap-6",
            )}
          >
            <div className={panelOpen ? "2xl:sticky 2xl:top-5" : "lg:sticky lg:top-5"}>{hud("animate-rise")}</div>
            <section className="min-w-0 pb-16" aria-label={view === "list" ? "Skill list" : "Focus"}>
              {view === "list" ? (
                <SkillList data={data} model={model} visible={visible} selectedId={selectedId} onSelect={select} />
              ) : (
                <FocusView
                  data={data}
                  model={model}
                  query={deferredQuery}
                  selectedId={selectedId}
                  onSelect={select}
                  neutralSlot={neutralSlot}
                />
              )}
            </section>
          </div>
        </div>
      )}

      {selectedId && (
        <SkillPanel skillId={selectedId} data={data} onClose={() => select(null)} onSelectSkill={select} />
      )}
    </div>
  );
}
