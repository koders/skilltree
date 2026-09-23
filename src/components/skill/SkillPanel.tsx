"use client";

import clsx from "clsx";
import { X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { StateBadge } from "@/components/ui/Badges";
import { Markdown } from "@/components/ui/Markdown";
import { branchColor } from "@/components/ui/meta";
import type { Item, Skill } from "@/lib/content/types";
import type { TreeData } from "@/lib/view-model";
import { PanelContext, type PanelContextValue, type RecallMode } from "./context";
import { PanelHeader, StarToggle } from "./PanelHeader";
import { RankSection } from "./RankSection";
import { RecallDialog } from "./RecallDialog";
import { RecallSection } from "./RecallSection";
import { ReferenceSections } from "./ReferenceSections";
import { NotesSection } from "./NotesSection";
import { SectionHeading } from "./parts";
import { SkillActions } from "./SkillActions";
import { SkillChip } from "./SkillChip";
import { TimeLogSection } from "./TimeLogSection";
import styles from "./skill.module.css";

export interface SkillPanelProps {
  skillId: string;
  data: TreeData;
  onClose: () => void;
  /** Navigate to another skill (prerequisite chips, related links). */
  onSelectSkill: (skillId: string) => void;
}

/** Distance a bottom sheet must be dragged down before it closes. */
const DISMISS_PX = 110;

/**
 * The skill side panel: a drawer on the right on desktop, a bottom sheet on
 * phones. Everything about one skill: state and next step, Why, ranks and
 * items, Recall, notes and loot, time, sources.
 */
export function SkillPanel({ skillId, data, onClose, onSelectSkill }: SkillPanelProps) {
  const skill = data.skills.find((s) => s.id === skillId);
  const [dragY, setDragY] = useState(0);
  const dragStart = useRef<number | null>(null);
  const asideRef = useRef<HTMLElement>(null);
  const openerRef = useRef<HTMLElement | null>(null);

  // Opened from the keyboard (an orb or list row with a visible focus ring): move focus into
  // the panel, so Tab doesn't have to walk every remaining orb first. Clicks leave focus alone.
  useEffect(() => {
    const aside = asideRef.current;
    const from = document.activeElement;
    if (!aside || !(from instanceof HTMLElement) || aside.contains(from) || !from.matches(":focus-visible")) return;
    openerRef.current = from;
    aside.focus({ preventScroll: true });
  }, [skillId]);

  // …and hand it back to that orb or row when the panel closes.
  useEffect(() => {
    return () => {
      const opener = openerRef.current;
      const lost = document.activeElement === null || document.activeElement === document.body;
      if (opener?.isConnected && lost) opener.focus({ preventScroll: true });
    };
  }, []);

  const onPointerDown = (e: React.PointerEvent) => {
    dragStart.current = e.clientY;
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (dragStart.current === null) return;
    setDragY(Math.max(0, e.clientY - dragStart.current));
  };
  const onPointerUp = () => {
    if (dragStart.current === null) return;
    dragStart.current = null;
    if (dragY > DISMISS_PX) onClose();
    else setDragY(0);
  };

  return (
    <aside
      ref={asideRef}
      tabIndex={-1}
      aria-label={skill ? `Skill: ${skill.title}` : "Skill"}
      className={clsx(
        // Denser than the default glass: this is a reading surface over a busy canvas.
        "panel fixed z-30 flex flex-col overflow-hidden !bg-[rgba(8,12,24,0.94)] outline-none backdrop-blur-xl",
        "inset-x-0 bottom-0 h-[86dvh] max-md:!rounded-b-none max-md:!rounded-t-[20px] max-md:!border-b-0",
        "md:inset-x-auto md:bottom-3 md:right-3 md:top-[calc(var(--topbar-h)+12px)] md:h-auto md:w-[min(480px,calc(100vw-24px))]",
        styles.drawer,
      )}
      style={dragY > 0 ? { transform: `translateY(${dragY}px)`, transition: "none" } : { transition: "transform 0.25s ease-out" }}
    >
      {/* Bottom-sheet grab handle (phones). */}
      <div
        className="flex h-6 shrink-0 cursor-grab touch-none items-center justify-center active:cursor-grabbing md:hidden"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        aria-hidden
      >
        <span className="h-1 w-10 rounded-full bg-ink-400/80" />
      </div>

      {skill ? (
        <PanelBody key={skill.id} skill={skill} data={data} onClose={onClose} onSelectSkill={onSelectSkill} />
      ) : (
        <div className="p-6">
          <CloseButton onClose={onClose} />
          <p className="hud-label">Unknown skill</p>
          <p className="mt-2 font-mono text-[13px] text-parchment-dim">{skillId}</p>
          <p className="mt-3 text-[13px] text-mist">It isn&apos;t in the content tree. It may have been renamed or removed.</p>
        </div>
      )}
    </aside>
  );
}

function CloseButton({ onClose }: { onClose: () => void }) {
  return (
    <button
      type="button"
      onClick={onClose}
      aria-label="Close panel"
      title="Close (Esc)"
      className="grid h-8 w-8 place-items-center rounded-lg text-mist transition-colors hover:bg-ink-700/80 hover:text-parchment"
    >
      <X className="h-4 w-4" />
    </button>
  );
}

function PanelBody({
  skill,
  data,
  onClose,
  onSelectSkill,
}: {
  skill: Skill;
  data: TreeData;
  onClose: () => void;
  onSelectSkill: (skillId: string) => void;
}) {
  const [recall, setRecall] = useState<{ open: boolean; mode: RecallMode }>({ open: false, mode: "test-out" });
  // Once the title scrolls away, a compact bar keeps the skill's name in view.
  const [compact, setCompact] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const root = scrollRef.current;
    const target = sentinelRef.current;
    if (!root || !target) return;
    const io = new IntersectionObserver(([entry]) => setCompact(!entry.isIntersecting), { root });
    io.observe(target);
    return () => io.disconnect();
  }, []);
  const view = data.state.skills[skill.id];
  const branchIndex = data.branches.findIndex((b) => b.id === skill.branchId);
  const branch = data.branches[branchIndex];
  const color = branch ? branchColor(branch, branchIndex) : "var(--mist)";

  const skillsById = new Map(data.skills.map((s) => [s.id, s]));
  const itemsById = new Map<string, Item>();
  for (const rank of skill.ranks) for (const item of rank.items) if (item.id) itemsById.set(item.id, item);
  const unlocks = data.skills.filter((s) => s.requires.includes(skill.id) || s.ranks.some((r) => r.requires.includes(skill.id)));

  if (!view) return null;

  const ctx: PanelContextValue = {
    data,
    skill,
    view,
    color,
    skillsById,
    itemsById,
    onSelectSkill,
    openRecall: (mode) => setRecall({ open: true, mode }),
  };

  return (
    <PanelContext value={ctx}>
      <div
        aria-hidden={!compact}
        className={clsx(
          "absolute inset-x-0 top-0 z-20 flex h-[52px] items-center gap-2.5 border-b border-ink-600/70 bg-ink-900/85 pl-5 pr-24 backdrop-blur-md transition-[opacity,transform] duration-200 max-md:top-6 sm:pl-6",
          compact ? "opacity-100" : "pointer-events-none -translate-y-1 opacity-0",
        )}
      >
        <span aria-hidden className="h-2 w-2 shrink-0 rounded-full" style={{ background: color, boxShadow: `0 0 8px ${color}` }} />
        <span className="truncate font-display text-[15.5px] text-parchment">{skill.title}</span>
        <StateBadge state={view.state} className="hidden shrink-0 sm:inline-flex" />
      </div>
      <div className="absolute right-3 top-2.5 z-30 flex items-center gap-0.5 max-md:top-[34px]">
        <StarToggle />
        <CloseButton onClose={onClose} />
      </div>

      <div
        ref={scrollRef}
        className={clsx("relative min-h-0 flex-1 overflow-y-auto overscroll-contain", styles.body)}
        style={{ "--branch": color } as React.CSSProperties}
      >
        <div ref={sentinelRef} aria-hidden className="pointer-events-none absolute inset-x-0 top-[96px] h-px" />
        <PanelHeader />

        <div className="space-y-7 px-5 pb-10 sm:px-6">
          <SkillActions />

          {(skill.why || skill.description) && (
            <section aria-label="Why" className="space-y-3">
              {skill.why && (
                <blockquote className="relative pl-4">
                  <span
                    aria-hidden
                    className="absolute inset-y-0.5 left-0 w-[2px] rounded-full"
                    style={{ background: `linear-gradient(to bottom, ${color}, transparent)` }}
                  />
                  <p className="hud-label mb-1">Why</p>
                  <Markdown className="font-display text-[16px] !leading-[1.5] italic !text-parchment [font-variation-settings:'SOFT'_50]">
                    {skill.why}
                  </Markdown>
                </blockquote>
              )}
              {skill.description && <Markdown className="text-[13.5px]">{skill.description}</Markdown>}
            </section>
          )}

          {(skill.requires.length > 0 || skill.related.length > 0 || unlocks.length > 0) && (
            <section aria-label="Connections" className="space-y-2.5">
              {/* When every prerequisite is missing, the Locked callout above already lists them. */}
              {!(view.locked && view.missingRequires.length === skill.requires.length) && (
                <ChipRow label="Requires" ids={skill.requires} />
              )}
              <ChipRow label="Unlocks" ids={unlocks.map((s) => s.id)} />
              <ChipRow label="Related" ids={skill.related} />
            </section>
          )}

          {skill.ranks.length > 0 && (
            <section aria-label="Ranks">
              <SectionHeading title="Ranks" meta={`${view.ranksComplete}/${view.ranks.length}`} />
              <div className="space-y-6">
                {skill.ranks.map((rank, i) => {
                  const rankView = view.ranks[i];
                  return rankView ? <RankSection key={rank.id} rank={rank} rankView={rankView} /> : null;
                })}
              </div>
            </section>
          )}

          <RecallSection />
          <NotesSection />
          <TimeLogSection />
          <ReferenceSections />

          <p className="flex items-center justify-center gap-2 pt-2 font-mono text-[10.5px] text-mist-dim">
            <span aria-hidden className="h-px w-6 bg-ink-500" />
            {skill.file}
            <span aria-hidden className="h-px w-6 bg-ink-500" />
          </p>
        </div>
      </div>

      <RecallDialog
        open={recall.open}
        mode={recall.mode}
        skill={skill}
        creditedQuestionIds={creditedRecall(data, skill.id)}
        onClose={() => setRecall((r) => ({ ...r, open: false }))}
      />
    </PanelContext>
  );
}

/** Questions of this skill whose test-out or completion pass has already earned its XP. */
function creditedRecall(data: TreeData, skillId: string): string[] {
  return data.recallAttempts
    .filter((a) => a.skillId === skillId && a.mode !== "review" && a.result === "pass")
    .map((a) => a.questionId);
}

function ChipRow({ label, ids }: { label: string; ids: string[] }) {
  if (ids.length === 0) return null;
  return (
    <div className="flex items-start gap-3">
      <span className="hud-label w-[4.5rem] shrink-0 pt-[5px]">{label}</span>
      <div className="flex min-w-0 flex-1 flex-wrap gap-1.5">
        {ids.map((id) => (
          <SkillChip key={id} skillId={id} />
        ))}
      </div>
    </div>
  );
}
