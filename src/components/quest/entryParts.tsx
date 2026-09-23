// Server-rendered pieces of a plan entry: title, meta line and briefing.
// Rendering them here keeps react-markdown out of the client bundle; the
// client row only owns the status controls.

import { ChevronRight, CornerDownRight, Hourglass } from "lucide-react";
import { TypeBadge } from "@/components/ui/Badges";
import { Markdown } from "@/components/ui/Markdown";
import { formatMinutesShort } from "@/components/ui/meta";
import type { PlanEntry } from "@/lib/engine/types";
import type { QuestContext } from "./context";
import { plainText } from "./format";
import { SkillChip } from "./SkillChip";
import type { QuestEntryRowProps } from "./QuestEntryRow";

export type EntryVariant = "planned" | "carry" | "ahead";

const HIDDEN_FIELDS = new Set(["done when"]);

export function entryTitle(ctx: QuestContext, entry: PlanEntry): { node: React.ReactNode; plain: string } {
  if (entry.kind === "recall") {
    const skill = ctx.skill(entry.skillId);
    return {
      // An inline <p>, like Markdown's output, so the row's strike-through styling applies.
      node: (
        <p className="inline">
          Answer Recall<span className="text-mist">:</span> {skill.title}
        </p>
      ),
      plain: `Answer Recall: ${skill.title}`,
    };
  }
  return { node: <Markdown inline>{entry.title}</Markdown>, plain: plainText(entry.title) };
}

export function EntryMeta({
  ctx,
  entry,
  variant,
}: {
  ctx: QuestContext;
  entry: PlanEntry;
  variant: EntryVariant;
}) {
  return (
    <>
      <TypeBadge type={entry.type} />
      <SkillChip skill={ctx.skill(entry.skillId)} />
      <span className="inline-flex items-center gap-1 font-mono text-[11.5px] text-mist">
        <Hourglass className="h-3 w-3" strokeWidth={1.8} aria-hidden />
        {formatMinutesShort(entry.minutes)}
      </span>
      {variant === "carry" ? (
        <span className="inline-flex items-center gap-1 rounded border border-stale/40 px-1.5 py-[1px] font-mono text-[10.5px] uppercase tracking-[0.1em] text-stale">
          <CornerDownRight className="h-3 w-3" strokeWidth={2} aria-hidden />
          Carried over from week {entry.week}
        </span>
      ) : null}
      {variant === "ahead" ? (
        <span className="rounded border border-ink-500 px-1.5 py-[1px] font-mono text-[10.5px] uppercase tracking-[0.1em] text-mist">
          Planned week {entry.week}
        </span>
      ) : null}
    </>
  );
}

/** "Done when" up front, the rest of the item's instructions behind a disclosure. */
export function EntryBriefing({ ctx, entry }: { ctx: QuestContext; entry: PlanEntry }) {
  if (entry.kind === "recall") {
    const skill = Object.hasOwn(ctx.app.index.skills, entry.skillId) ? ctx.app.index.skills[entry.skillId] : null;
    const questions = skill?.recall ?? [];
    if (questions.length === 0) return null;
    return (
      <div className="text-[12.5px] leading-snug text-parchment-dim">
        <div>
          {questions.length} question{questions.length === 1 ? "" : "s"}, answered in my own words and
          self-graded. Passing them all completes the skill.
        </div>
        <Disclosure label="Questions">
          <ol className="list-decimal space-y-1 pl-4 marker:font-mono marker:text-[11px] marker:text-mist">
            {questions.map((q) => (
              <li key={q.id || q.text}>
                <Markdown inline className="text-[12.5px]">
                  {q.text}
                </Markdown>
              </li>
            ))}
          </ol>
        </Disclosure>
      </div>
    );
  }

  const item = Object.hasOwn(ctx.app.index.items, entry.key) ? ctx.app.index.items[entry.key] : null;
  if (!item) return null;
  const fields = item.fields.filter((f) => f.label && !HIDDEN_FIELDS.has(f.label.toLowerCase()));
  if (!item.doneWhen && fields.length === 0) return null;
  return (
    <div className="text-[12.5px] leading-snug">
      {item.doneWhen ? (
        <div className="flex gap-2">
          <span className="hud-label shrink-0 pt-[2px] !text-[9.5px] !text-gold-deep">Done when</span>
          <Markdown inline className="min-w-0 text-[12.5px] !leading-snug">
            {item.doneWhen}
          </Markdown>
        </div>
      ) : null}
      {fields.length > 0 ? (
        <Disclosure label="Briefing">
          <dl className="space-y-2">
            {fields.map((f) => (
              <div key={`${f.label}-${f.line}`} className="grid gap-0.5 sm:grid-cols-[88px_minmax(0,1fr)] sm:gap-3">
                <dt className="hud-label pt-[2px] !text-[9.5px]">{f.label}</dt>
                <dd className="min-w-0">
                  <Markdown inline className="text-[12.5px] !leading-snug">
                    {f.text}
                  </Markdown>
                </dd>
              </div>
            ))}
          </dl>
        </Disclosure>
      ) : null}
    </div>
  );
}

function Disclosure({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <details className="group/brief mt-1.5">
      <summary className="inline-flex cursor-pointer list-none items-center gap-1 rounded font-mono text-[10.5px] uppercase tracking-[0.14em] text-mist transition-colors hover:text-parchment [&::-webkit-details-marker]:hidden">
        <ChevronRight className="h-3 w-3 transition-transform group-open/brief:rotate-90" strokeWidth={2} aria-hidden />
        {label}
      </summary>
      <div className="mt-2 border-l border-ink-600 pl-3">{children}</div>
    </details>
  );
}

/** Props for a QuestEntryRow, cut down to what the client needs. */
export function entryRowProps(
  ctx: QuestContext,
  entry: PlanEntry,
  variant: EntryVariant,
): Omit<QuestEntryRowProps, "isNext" | "anchorId"> {
  const { node, plain } = entryTitle(ctx, entry);
  const skill = ctx.skill(entry.skillId);
  const recallSkill =
    entry.kind === "recall" && Object.hasOwn(ctx.app.index.skills, entry.skillId)
      ? ctx.app.index.skills[entry.skillId]
      : null;
  return {
    entry,
    plainTitle: plain,
    title: node,
    meta: <EntryMeta ctx={ctx} entry={entry} variant={variant} />,
    details: <EntryBriefing ctx={ctx} entry={entry} />,
    recallSkill,
    recallCredited: recallSkill
      ? ctx.app.snapshot.recallAttempts
          .filter((a) => a.skillId === entry.skillId && a.mode !== "review" && a.result === "pass")
          .map((a) => a.questionId)
      : [],
    skillLearned: skill.learned,
  };
}
