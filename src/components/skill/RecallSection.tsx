"use client";

import { Brain, Check, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Markdown } from "@/components/ui/Markdown";
import type { RecallAttemptRow } from "@/lib/progress/types";
import { usePanel } from "./context";
import { formatInstant, plural } from "./format";
import { SectionHeading } from "./parts";

const MODE_LABEL: Record<RecallAttemptRow["mode"], string> = {
  "test-out": "test-out",
  complete: "completion check",
  review: "review",
};

export function RecallSection() {
  const { data, skill, view, openRecall } = usePanel();
  if (skill.recall.length === 0) return null;

  const latest = new Map<string, RecallAttemptRow>();
  for (const a of data.recallAttempts) {
    if (a.skillId !== skill.id) continue;
    const prev = latest.get(a.questionId);
    if (!prev || a.createdAt > prev.createdAt) latest.set(a.questionId, a);
  }

  const hint = view.readyToComplete
    ? "Answer these to complete the skill."
    : view.canTestOut && !view.learned
      ? "Answer these from memory, without notes, to test out."
      : view.canTestOut
        ? "Answer them from memory to confirm the self-report."
        : view.learned
          ? "Revisit these now and then to keep the skill fresh."
          : "The check that closes this skill once its ranks are done.";

  return (
    <section aria-labelledby="recall-heading">
      <SectionHeading
        id="recall-heading"
        title="Recall"
        meta={plural(skill.recall.length, "question")}
        action={
          view.readyToComplete ? (
            <Button size="sm" variant="gold" onClick={() => openRecall("complete")}>
              <Brain className="h-3.5 w-3.5" />
              Answer
            </Button>
          ) : view.canTestOut ? (
            <Button size="sm" variant="ghost" onClick={() => openRecall("test-out")}>
              <Brain className="h-3.5 w-3.5 text-type-recall" />
              Test out
            </Button>
          ) : null
        }
      />
      <p className="mb-2.5 text-[12.5px] text-mist">{hint}</p>
      <ol className="space-y-1">
        {skill.recall.map((q, i) => {
          const last = latest.get(q.id);
          return (
            <li key={q.id || i} className="flex items-start gap-3 rounded-lg px-1 py-1.5">
              <span
                aria-hidden
                className="mt-[1px] grid h-5 w-5 shrink-0 place-items-center rounded-full border border-type-recall/40 font-mono text-[10.5px] text-type-recall"
              >
                {i + 1}
              </span>
              <Markdown className="min-w-0 flex-1 text-[13.5px] !leading-snug !text-parchment">{q.text}</Markdown>
              {last && (
                <span
                  className="mt-[2px] inline-flex shrink-0 items-center gap-1 font-mono text-[10.5px]"
                  style={{ color: last.result === "pass" ? "var(--gold)" : "var(--rust-bright)" }}
                  title={`${last.result === "pass" ? "Got it" : "Not yet"} in a ${MODE_LABEL[last.mode]} on ${formatInstant(last.createdAt, data.today)}`}
                >
                  {last.result === "pass" ? <Check className="h-3 w-3" strokeWidth={3} /> : <X className="h-3 w-3" strokeWidth={3} />}
                  <span className="text-mist-dim">{formatInstant(last.createdAt, data.today)}</span>
                  <span className="sr-only">{last.result === "pass" ? "passed" : "not yet"}</span>
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
