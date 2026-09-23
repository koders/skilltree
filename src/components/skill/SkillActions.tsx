"use client";

import clsx from "clsx";
import { Brain, Ellipsis, Lock, Play, RotateCcw, TriangleAlert } from "lucide-react";
import { useState } from "react";
import { resetSkill, selfReportSkill, startSkill } from "@/app/actions";
import { Button } from "@/components/ui/Button";
import { Markdown } from "@/components/ui/Markdown";
import { useAction } from "@/components/ui/useAction";
import { usePanel } from "./context";
import { formatDay, formatInstant, LEARNED_VIA_LABEL, plural } from "./format";
import { ConfirmAction, Sparkle } from "./parts";
import { SkillChip } from "./SkillChip";
import { VerifyControl } from "./VerifyControl";

/** The state callout under the header: what this skill needs from me next. */
export function SkillActions() {
  const { view } = usePanel();
  switch (view.state) {
    case "locked":
      return <LockedCallout />;
    case "available":
      return <AvailableCallout />;
    case "in-progress":
      return <InProgressCallout />;
    default:
      return <LearnedCallout />;
  }
}

function Callout({
  accent,
  glow,
  icon,
  title,
  children,
  corner,
}: {
  accent: string;
  glow?: boolean;
  icon: React.ReactNode;
  title: React.ReactNode;
  children?: React.ReactNode;
  corner?: React.ReactNode;
}) {
  return (
    <section
      aria-label="Next step"
      className="relative overflow-hidden rounded-xl border bg-ink-850/70 px-4 py-3.5"
      style={{
        borderColor: `color-mix(in oklab, ${accent} 38%, transparent)`,
        boxShadow: glow ? `0 0 34px -12px ${accent}, inset 0 1px 0 rgba(236,230,214,0.05)` : undefined,
        backgroundImage: `linear-gradient(120deg, color-mix(in oklab, ${accent} 9%, transparent), transparent 55%)`,
      }}
    >
      <span aria-hidden className="absolute inset-y-3 left-0 w-[2px] rounded-full" style={{ background: accent }} />
      <div className="flex items-start gap-2.5">
        <span className="mt-[3px] shrink-0" style={{ color: accent }}>
          {icon}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <p className="font-display text-[16.5px] leading-snug text-parchment">{title}</p>
            {corner}
          </div>
          {children}
        </div>
      </div>
    </section>
  );
}

function LockedCallout() {
  const { skill, view } = usePanel();
  // Locked by its ranks alone (each needs another skill), not by the skill's own requires.
  const byRanks = !view.missingRequires.some((id) => skill.requires.includes(id));
  return (
    <Callout accent="var(--ink-400)" icon={<Lock className="h-4 w-4" strokeWidth={2} />} title="Locked">
      <p className="mt-1 text-[13px] text-parchment-dim">
        {byRanks
          ? `Every rank needs another skill first. Rank ${view.ranks.find((r) => r.locked)?.number ?? 1} opens after:`
          : `Learn ${view.missingRequires.length === 1 ? "this" : "these"} first:`}
      </p>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {view.missingRequires.map((id) => (
          <SkillChip key={id} skillId={id} />
        ))}
      </div>
    </Callout>
  );
}

function AvailableCallout() {
  const { skill, view, openRecall } = usePanel();
  const { run, pending } = useAction();
  const selfReport = useAction();
  const [confirmSelf, setConfirmSelf] = useState(false);

  return (
    <Callout accent="var(--parchment)" icon={<Sparkle className="!h-3.5 !w-3.5" />} title="Ready to begin">
      <p className="mt-1 text-[13px] leading-relaxed text-parchment-dim">
        Work through the ranks below
        {view.canTestOut
          ? `, or test out: answer its ${plural(skill.recall.length, "Recall question")} from memory.`
          : "."}
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Button
          variant="primary"
          loading={pending}
          onClick={() => run(() => startSkill({ skillId: skill.id }), { success: "Skill started" })}
        >
          <Play className="h-3.5 w-3.5 fill-current" strokeWidth={2} />
          Start skill
        </Button>
        {view.canTestOut && (
          <Button variant="secondary" onClick={() => openRecall("test-out")}>
            <Brain className="h-4 w-4 text-type-recall" strokeWidth={1.8} />
            Test out
          </Button>
        )}
      </div>
      <div className="mt-3 border-t border-ink-600/60 pt-2.5">
        {confirmSelf ? (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[12.5px] text-parchment-dim">Mark it learned (self-reported), without answering Recall?</span>
            <Button
              size="sm"
              variant="secondary"
              loading={selfReport.pending}
              onClick={() =>
                selfReport
                  .run(() => selfReportSkill({ skillId: skill.id }), { success: "Marked learned (self-reported)" })
                  .then(() => setConfirmSelf(false))
              }
            >
              Mark learned
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setConfirmSelf(false)}>
              Cancel
            </Button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setConfirmSelf(true)}
            className="text-[12.5px] text-mist underline decoration-ink-500 underline-offset-4 transition-colors hover:text-parchment hover:decoration-mist"
          >
            I already know this
          </button>
        )}
      </div>
    </Callout>
  );
}

function InProgressCallout() {
  const { skill, view, openRecall } = usePanel();
  const done = view.ranks.reduce((n, r) => n + r.doneCount, 0);
  const total = view.ranks.reduce((n, r) => n + r.blockingCount, 0);

  if (view.readyToComplete) {
    return (
      <Callout
        accent="var(--gold)"
        glow
        icon={<Sparkle className="!h-4 !w-4 animate-glow-pulse" />}
        title="Every rank cleared"
      >
        <p className="mt-1 text-[13px] leading-relaxed text-parchment-dim">
          One step left: answer the {plural(skill.recall.length, "Recall question")} to learn this skill.
        </p>
        <Button variant="gold" className="mt-3 w-full sm:w-auto" onClick={() => openRecall("complete")}>
          <Brain className="h-4 w-4" strokeWidth={2} />
          Complete skill — answer Recall
        </Button>
      </Callout>
    );
  }

  return (
    <Callout accent="var(--gold)" icon={<Sparkle className="!h-3.5 !w-3.5" />} title="In progress">
      <p className="mt-1 text-[13px] text-parchment-dim">
        {total > 0 ? `${done} of ${total} required items cleared` : "Nothing required left in the ranks"}
        {view.ranks.length > 1 && ` · ${view.ranksComplete} of ${plural(view.ranks.length, "rank")} complete`}.
      </p>
      {view.canTestOut && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Button variant="secondary" onClick={() => openRecall("test-out")}>
            <Brain className="h-4 w-4 text-type-recall" strokeWidth={1.8} />
            Test out
          </Button>
          <span className="text-[12px] text-mist">Already know the rest? Answer Recall now.</span>
        </div>
      )}
    </Callout>
  );
}

function LearnedCallout() {
  const { data, skill, view, openRecall } = usePanel();
  const { run, pending } = useAction();
  const [menu, setMenu] = useState(false);
  const via = view.learnedVia;
  const rusty = view.state === "rusty";
  // A starting skill without a progress row can't be un-learned: content says it's known.
  const canReset = !(view.isStarting && view.learnedAt === null && via === "self-reported");

  const line =
    view.learnedAt !== null
      ? `Learned ${formatInstant(view.learnedAt, data.today)}${via ? ` · via ${LEARNED_VIA_LABEL[via]}` : ""}`
      : view.isStarting
        ? "Starting skill · self-reported"
        : `Learned${via ? ` · via ${LEARNED_VIA_LABEL[via]}` : ""}`;

  return (
    <div className="space-y-3">
      <Callout
        accent={rusty ? "var(--rust-bright)" : "var(--gold-bright)"}
        glow={!rusty}
        icon={<Sparkle className="!h-4 !w-4" />}
        title={line}
        corner={
          canReset ? (
            <button
              type="button"
              aria-label="More actions"
              aria-expanded={menu}
              onClick={() => setMenu((m) => !m)}
              className="-mr-1.5 -mt-1 grid h-7 w-7 shrink-0 place-items-center rounded-md text-mist transition-colors hover:bg-ink-700 hover:text-parchment"
            >
              <Ellipsis className="h-4 w-4" />
            </button>
          ) : null
        }
      >
        {via === "self-reported" && (
          <p className="mt-1 text-[13px] text-parchment-dim">
            {view.canTestOut
              ? "Self-reported so far. Answer its Recall questions to confirm it."
              : view.isStarting && view.learnedAt === null
                ? "Seeded as already known when the tree was created."
                : "Marked as already known."}
          </p>
        )}
        {via === "self-reported" && view.canTestOut && (
          <Button variant="secondary" className="mt-3" onClick={() => openRecall("test-out")}>
            <Brain className="h-4 w-4 text-type-recall" strokeWidth={1.8} />
            Test out to confirm
          </Button>
        )}
        {menu && canReset && (
          <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-ink-600/60 pt-2.5">
            <RotateCcw className="h-3.5 w-3.5 text-mist" />
            <span className="text-[12.5px] text-parchment-dim">Un-learn it; item progress and time stay.</span>
            <ConfirmAction
              label="Reset skill"
              confirmLabel="Reset"
              onConfirm={() =>
                void run(() => resetSkill({ skillId: skill.id }), { success: "Skill reset", tone: "info" }).then((r) => {
                  if (r.ok) setMenu(false);
                })
              }
              pending={pending}
              className="!text-danger"
            />
          </div>
        )}
      </Callout>
      {rusty && <RustCallout />}
    </div>
  );
}

function RustCallout() {
  const { data, view, itemsById } = usePanel();
  const { stale, failedReview } = view.rust;
  return (
    <Callout
      accent="var(--rust-bright)"
      icon={<TriangleAlert className="h-4 w-4" strokeWidth={2} />}
      title="Going rusty"
    >
      <p className="mt-1 text-[13px] leading-relaxed text-parchment-dim">
        {stale.length > 0 &&
          `${plural(stale.length, "time-sensitive fact")} ${stale.length === 1 ? "is" : "are"} past the freshness window. Re-check ${stale.length === 1 ? "it" : "them"} to polish the skill.`}
        {stale.length > 0 && failedReview && " "}
        {failedReview && "A Recall review failed after it was learned: go over the questions below."}
      </p>
      {stale.length > 0 && (
        <ul className="mt-3 space-y-3">
          {stale.map((s) => {
            const item = itemsById.get(s.itemId);
            const itemView = data.state.items[s.itemKey];
            if (!item || !itemView) return null;
            return (
              <li key={s.itemKey}>
                <div className="mb-1.5 flex flex-wrap items-baseline gap-x-2 text-[13px]">
                  <Markdown inline className={clsx("!text-parchment")}>
                    {item.title}
                  </Markdown>
                  <span className="font-mono text-[11px] text-stale">
                    stale since {formatDay(s.staleSince, data.today)} · {plural(s.daysStale, "day")}
                  </span>
                </div>
                <VerifyControl item={item} itemView={itemView} showStatus={false} />
              </li>
            );
          })}
        </ul>
      )}
    </Callout>
  );
}
