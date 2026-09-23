"use client";

import clsx from "clsx";
import { ArrowLeft, ArrowRight, Check, ChevronRight, Target, X } from "lucide-react";
import { useEffect, useId, useRef, useState, useTransition } from "react";
import { submitRecall } from "@/app/actions";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { Markdown } from "@/components/ui/Markdown";
import { useToast } from "@/components/ui/Toast";
import { XP_PER_RECALL_PASS } from "@/lib/config";
import type { Skill } from "@/lib/content/types";
import type { RecallResult } from "@/lib/progress/types";
import { plural } from "./format";
import { inputClass, Sparkle } from "./parts";
import { RecallConstellation } from "./RecallConstellation";
import styles from "./skill.module.css";

export interface RecallDialogProps {
  open: boolean;
  onClose: () => void;
  skill: Skill;
  mode: "test-out" | "complete";
  /** Called after a successful submit. */
  onSubmitted?: (result: { passed: number; total: number; learned: boolean }) => void;
  /**
   * Questions whose test-out or completion pass already earned XP. Retakes don't
   * earn it again (engine/xp.ts), so the result only promises XP for the others.
   */
  creditedQuestionIds?: readonly string[];
}

/**
 * The Recall flow: one question at a time, a written answer, then honest
 * self-grading (there are no answer keys), a summary and the submit. A test-out
 * or completion check where every answer passes marks the skill learned.
 */
export function RecallDialog({ open, onClose, skill, mode, onSubmitted, creditedQuestionIds = [] }: RecallDialogProps) {
  // Unsent answers are worth a confirm before a stray backdrop click or Escape throws them away.
  const dirtyRef = useRef(false);
  const [askDiscard, setAskDiscard] = useState(false);

  useEffect(() => {
    if (!open) return;
    dirtyRef.current = false;
    // Escape belongs to the dialog while it's open, not to the page (which would close the skill panel).
    const guard = (e: KeyboardEvent) => {
      if (e.key === "Escape") e.stopImmediatePropagation();
    };
    window.addEventListener("keydown", guard, true);
    return () => window.removeEventListener("keydown", guard, true);
  }, [open]);

  const close = () => {
    dirtyRef.current = false;
    setAskDiscard(false);
    onClose();
  };
  const requestClose = () => {
    if (dirtyRef.current) setAskDiscard(true);
    else close();
  };

  return (
    <Dialog
      open={open}
      onClose={requestClose}
      wide
      title={
        <span className="flex min-w-0 flex-col gap-0.5 sm:flex-row sm:items-baseline sm:gap-2">
          <span className="hud-label shrink-0 whitespace-nowrap !text-type-recall">
            {mode === "test-out" ? "Test out" : "Completion check"}
          </span>
          <span className="min-w-0 sm:truncate">{skill.title}</span>
        </span>
      }
    >
      {askDiscard && (
        <div
          role="alertdialog"
          aria-label="Discard answers?"
          className="mb-4 flex flex-wrap items-center gap-2 rounded-lg border border-rust/50 bg-rust/10 px-3 py-2 text-[13px]"
        >
          <span className="flex-1 text-parchment">Leave now? Unsent answers are lost.</span>
          <Button size="sm" variant="danger" onClick={close}>
            Discard
          </Button>
          <Button size="sm" variant="secondary" autoFocus onClick={() => setAskDiscard(false)}>
            Keep answering
          </Button>
        </div>
      )}
      <RecallFlow
        skill={skill}
        mode={mode}
        onDirty={(d) => {
          dirtyRef.current = d;
        }}
        onSubmitted={onSubmitted}
        creditedQuestionIds={creditedQuestionIds}
        onClose={close}
      />
    </Dialog>
  );
}

// ---------------------------------------------------------------- flow

interface SubmitOutcome {
  passed: number;
  total: number;
  learned: boolean;
  /** Recall bonus this attempt actually adds. */
  xp: number;
}

function RecallFlow({
  skill,
  mode,
  onDirty,
  onSubmitted,
  creditedQuestionIds,
  onClose,
}: {
  skill: Skill;
  mode: "test-out" | "complete";
  onDirty: (dirty: boolean) => void;
  onSubmitted?: RecallDialogProps["onSubmitted"];
  creditedQuestionIds: readonly string[];
  onClose: () => void;
}) {
  const questions = skill.recall;
  const n = questions.length;
  const toast = useToast();
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<string[]>(() => questions.map(() => ""));
  const [grades, setGrades] = useState<(RecallResult | null)[]>(() => questions.map(() => null));
  const [revealed, setRevealed] = useState<boolean[]>(() => questions.map(() => false));
  const [outcome, setOutcome] = useState<SubmitOutcome | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (n === 0) {
    return (
      <div className="py-6 text-center">
        <p className="text-[14px] text-parchment-dim">This skill has no Recall questions yet.</p>
        <Button className="mt-4" onClick={onClose}>
          Close
        </Button>
      </div>
    );
  }

  if (outcome) {
    return <ResultView skill={skill} mode={mode} grades={grades} outcome={outcome} onClose={onClose} />;
  }

  const grade = (i: number, result: RecallResult) => {
    setGrades((g) => g.map((x, j) => (j === i ? result : x)));
    onDirty(true);
    setStep(i + 1);
  };

  const submit = () => {
    if (grades.some((g) => g === null)) return;
    setError(null);
    startTransition(async () => {
      let res: Awaited<ReturnType<typeof submitRecall>>;
      try {
        res = await submitRecall({
          skillId: skill.id,
          mode,
          answers: questions.map((q, i) => ({
            questionId: q.id,
            result: grades[i] ?? "fail",
            answer: answers[i].trim() || null,
          })),
        });
      } catch (err) {
        // A transport failure (server down or restarting, stale action id) rejects instead of
        // returning ok:false; thrown from a transition it would reach the error boundary and
        // unmount the dialog with every answer. Keep them and let the user retry.
        res = { ok: false, error: err instanceof Error ? err.message : String(err) };
      }
      if (!res.ok) {
        setError(res.error);
        return;
      }
      const result = { passed: res.data.passed, total: res.data.total, learned: res.data.learned };
      const newPasses = questions.filter((q, i) => grades[i] === "pass" && !creditedQuestionIds.includes(q.id)).length;
      const xp = newPasses * XP_PER_RECALL_PASS;
      onDirty(false);
      setOutcome({ ...result, xp });
      if (result.learned) toast(xp > 0 ? `+${xp} XP · ${skill.title} learned` : `${skill.title} learned`, xp > 0 ? "xp" : "success");
      onSubmitted?.(result);
    });
  };

  const firstUngraded = grades.findIndex((g) => g === null);
  const reachable = (i: number) => i <= (firstUngraded === -1 ? n : firstUngraded);

  return (
    <div className="min-h-[340px]">
      <ProgressDots grades={grades} step={step} reachable={reachable} onJump={setStep} />

      {step < n ? (
        <QuestionStep
          key={step}
          index={step}
          total={n}
          skill={skill}
          text={questions[step].text}
          answer={answers[step]}
          onAnswer={(v) => {
            setAnswers((a) => a.map((x, j) => (j === step ? v : x)));
            if (v.trim()) onDirty(true);
          }}
          revealed={revealed[step]}
          onReveal={() => setRevealed((r) => r.map((x, j) => (j === step ? true : x)))}
          grade={grades[step]}
          onGrade={(r) => grade(step, r)}
          onBack={step > 0 ? () => setStep(step - 1) : undefined}
          mode={mode}
        />
      ) : (
        <SummaryStep
          skill={skill}
          mode={mode}
          answers={answers}
          grades={grades}
          onToggle={(i) => setGrades((g) => g.map((x, j) => (j === i ? (x === "pass" ? "fail" : "pass") : x)))}
          onEdit={setStep}
          onSubmit={submit}
          pending={pending}
          error={error}
        />
      )}
    </div>
  );
}

function ProgressDots({
  grades,
  step,
  reachable,
  onJump,
}: {
  grades: (RecallResult | null)[];
  step: number;
  reachable: (i: number) => boolean;
  onJump: (i: number) => void;
}) {
  const n = grades.length;
  return (
    <nav aria-label="Questions" className="mb-6 flex items-center justify-center">
      {grades.map((g, i) => (
        <span key={i} className="flex items-center">
          {i > 0 && (
            <span
              aria-hidden
              className="h-px w-8 sm:w-12"
              style={{ background: grades[i - 1] === "pass" && g === "pass" ? "var(--gold-deep)" : "var(--ink-500)" }}
            />
          )}
          <button
            type="button"
            disabled={!reachable(i)}
            onClick={() => onJump(i)}
            aria-current={step === i ? "step" : undefined}
            aria-label={`Question ${i + 1}${g === "pass" ? ", got it" : g === "fail" ? ", not yet" : ""}`}
            className={clsx(
              "relative grid h-6 w-6 place-items-center rounded-full border-[1.5px] font-mono text-[10px] transition-[background,border-color,box-shadow] disabled:cursor-default",
              step === i && styles.dotCurrent,
              g === "pass"
                ? "border-gold-bright bg-gold text-ink-900"
                : g === "fail"
                  ? "border-rust-bright bg-rust/25 text-rust-bright"
                  : step === i
                    ? "border-gold bg-ink-850 text-gold"
                    : "border-ink-400 bg-ink-850 text-mist",
            )}
          >
            {g === "pass" ? <Check className="h-3 w-3" strokeWidth={3} /> : g === "fail" ? <X className="h-3 w-3" strokeWidth={3} /> : i + 1}
          </button>
        </span>
      ))}
      <span aria-hidden className="h-px w-8 bg-ink-500 sm:w-12" />
      <button
        type="button"
        disabled={!reachable(n)}
        onClick={() => onJump(n)}
        aria-current={step === n ? "step" : undefined}
        aria-label="Summary"
        className={clsx(
          "grid h-7 w-7 place-items-center transition-colors disabled:cursor-default",
          step === n ? "text-gold-bright" : reachable(n) ? "text-gold" : "text-ink-400",
        )}
      >
        <Sparkle className="!h-4 !w-4" />
      </button>
    </nav>
  );
}

function QuestionStep({
  index,
  total,
  skill,
  text,
  answer,
  onAnswer,
  revealed,
  onReveal,
  grade,
  onGrade,
  onBack,
  mode,
}: {
  index: number;
  total: number;
  skill: Skill;
  text: string;
  answer: string;
  onAnswer: (value: string) => void;
  revealed: boolean;
  onReveal: () => void;
  grade: RecallResult | null;
  onGrade: (result: RecallResult) => void;
  onBack?: () => void;
  mode: "test-out" | "complete";
}) {
  const answerId = useId();
  return (
    <div className={styles.reveal}>
      <p className="hud-label">
        Question {index + 1} of {total}
      </p>
      <div role="heading" aria-level={3} className="mt-2 font-display text-[21px] leading-snug sm:text-[23px] [text-wrap:balance]">
        <Markdown inline className="!text-parchment !leading-snug">
          {text}
        </Markdown>
      </div>

      <label htmlFor={answerId} className="mt-5 block font-mono text-[10.5px] uppercase tracking-[0.12em] text-mist">
        Your answer <span className="normal-case tracking-normal text-mist-dim">(kept with the attempt)</span>
      </label>
      <textarea
        id={answerId}
        value={answer}
        onChange={(e) => onAnswer(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && !revealed) {
            e.preventDefault();
            onReveal();
          }
        }}
        rows={5}
        // autoFocus covers later questions; data-autofocus the first, when the dialog opens.
        autoFocus
        data-autofocus
        placeholder={mode === "test-out" ? "From memory, no notes…" : "In my own words…"}
        className={clsx(inputClass, "mt-1.5 resize-y !text-[14px] leading-relaxed")}
      />

      {!revealed ? (
        <div className="mt-4 flex flex-wrap items-center gap-3">
          {onBack && (
            <Button variant="ghost" onClick={onBack}>
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>
          )}
          <span className="ml-auto hidden font-mono text-[10.5px] text-mist-dim sm:inline">⌘↵</span>
          <Button variant="primary" onClick={onReveal}>
            Check yourself
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      ) : (
        <SelfGrade skill={skill} grade={grade} onGrade={onGrade} onBack={onBack} />
      )}
    </div>
  );
}

function SelfGrade({
  skill,
  grade,
  onGrade,
  onBack,
}: {
  skill: Skill;
  grade: RecallResult | null;
  onGrade: (r: RecallResult) => void;
  onBack?: () => void;
}) {
  const checks = skill.ranks.flatMap((r) => r.items.filter((it) => it.doneWhen).map((it) => ({ key: it.key, title: it.title, doneWhen: it.doneWhen as string })));
  return (
    <div className={clsx("mt-4 rounded-xl border border-ink-500 bg-ink-850/80 p-4", styles.reveal)}>
      <p className="text-[13px] leading-relaxed text-parchment-dim">
        There&apos;s no answer key. Compare what you wrote with your notes and the skill&apos;s Done-when checks, then
        grade yourself honestly: would it hold up if someone asked you at work?
      </p>
      {checks.length > 0 && (
        <details className="group mt-3 rounded-lg border border-gold/25 bg-gold/[0.04]">
          <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-2 [&::-webkit-details-marker]:hidden">
            <ChevronRight className="h-3.5 w-3.5 text-gold transition-transform group-open:rotate-90" />
            <Target className="h-3.5 w-3.5 text-gold" strokeWidth={2} />
            <span className="hud-label !text-gold">Done-when checks ({checks.length})</span>
          </summary>
          <ul className="max-h-56 space-y-2.5 overflow-y-auto border-t border-gold/20 px-3 py-2.5">
            {checks.map((c) => (
              <li key={c.key} className="text-[12.5px]">
                <Markdown inline className="font-medium !text-parchment-dim">
                  {c.title}
                </Markdown>
                <Markdown className="mt-0.5 !text-parchment">{c.doneWhen}</Markdown>
              </li>
            ))}
          </ul>
        </details>
      )}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        {onBack && (
          <Button variant="ghost" onClick={onBack} className="mr-auto">
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
        )}
        <Button
          variant="secondary"
          aria-pressed={grade === "fail"}
          onClick={() => onGrade("fail")}
          className={clsx(onBack ? "" : "ml-auto", grade === "fail" && "!border-rust-bright !bg-rust/20 text-rust-bright")}
        >
          <X className="h-4 w-4 text-rust-bright" strokeWidth={2.4} />
          Not yet
        </Button>
        <Button
          variant="gold"
          aria-pressed={grade === "pass"}
          autoFocus
          onClick={() => onGrade("pass")}
          className={clsx(grade === "pass" && "ring-2 ring-gold-bright/60 ring-offset-2 ring-offset-ink-850")}
        >
          <Check className="h-4 w-4" strokeWidth={2.6} />
          Got it
        </Button>
      </div>
    </div>
  );
}

function SummaryStep({
  skill,
  mode,
  answers,
  grades,
  onToggle,
  onEdit,
  onSubmit,
  pending,
  error,
}: {
  skill: Skill;
  mode: "test-out" | "complete";
  answers: string[];
  grades: (RecallResult | null)[];
  onToggle: (i: number) => void;
  onEdit: (i: number) => void;
  onSubmit: () => void;
  pending: boolean;
  error: string | null;
}) {
  const passed = grades.filter((g) => g === "pass").length;
  const total = grades.length;
  const all = passed === total;
  return (
    <div className={styles.reveal}>
      <p className="hud-label">Before you submit</p>
      <h3 className="mt-2 font-display text-[22px] leading-snug text-parchment">
        {all ? (
          <>
            All {total} <span className="text-gold-bright">got it</span>
          </>
        ) : (
          <>
            {passed} of {total} got it
          </>
        )}
      </h3>
      <p className="mt-1 text-[13px] text-parchment-dim">
        {all
          ? `Submitting marks ${skill.title} learned (${mode === "test-out" ? "tested out" : "completed"}).`
          : `The attempt is saved and the skill stays unlearned. ${plural(total - passed, "question")} to work on, then try again any time.`}
      </p>

      <ol className="mt-4 space-y-2">
        {skill.recall.map((q, i) => (
          <li key={q.id || i} className="flex items-start gap-3 rounded-lg border border-ink-600 bg-ink-850/60 px-3 py-2.5">
            <button
              type="button"
              onClick={() => onToggle(i)}
              aria-pressed={grades[i] === "pass"}
              aria-label={`Question ${i + 1}: ${grades[i] === "pass" ? "got it" : "not yet"}. Click to change.`}
              title="Change grade"
              className={clsx(
                "mt-px grid h-6 w-6 shrink-0 place-items-center rounded-full border-[1.5px] transition-colors",
                grades[i] === "pass" ? "border-gold-bright bg-gold text-ink-900" : "border-rust-bright bg-rust/20 text-rust-bright",
              )}
            >
              {grades[i] === "pass" ? <Check className="h-3 w-3" strokeWidth={3} /> : <X className="h-3 w-3" strokeWidth={3} />}
            </button>
            <div className="min-w-0 flex-1">
              <Markdown className="text-[13.5px] !leading-snug !text-parchment">{q.text}</Markdown>
              {answers[i].trim() ? (
                <p className="mt-1 line-clamp-2 text-[12.5px] italic text-mist">{answers[i].trim()}</p>
              ) : (
                <p className="mt-1 text-[12px] text-mist-dim">No written answer</p>
              )}
            </div>
            <button
              type="button"
              onClick={() => onEdit(i)}
              className="shrink-0 rounded-md px-1.5 py-0.5 text-[11.5px] text-mist hover:bg-ink-700 hover:text-parchment"
            >
              Edit
            </button>
          </li>
        ))}
      </ol>

      {error && (
        <p role="alert" className="mt-3 rounded-lg border border-danger/40 bg-danger/10 px-3 py-2 text-[13px] text-danger">
          Couldn&apos;t submit: {error}
        </p>
      )}

      <div className="mt-5 flex flex-wrap items-center justify-end gap-2">
        <Button variant={all ? "gold" : "primary"} loading={pending} onClick={onSubmit}>
          {pending ? "Submitting…" : mode === "test-out" ? "Submit test-out" : "Submit answers"}
        </Button>
      </div>
    </div>
  );
}

function ResultView({
  skill,
  mode,
  grades,
  outcome,
  onClose,
}: {
  skill: Skill;
  mode: "test-out" | "complete";
  grades: (RecallResult | null)[];
  outcome: SubmitOutcome;
  onClose: () => void;
}) {
  const results = grades.map((g) => (g === "pass" ? "pass" : "fail") as RecallResult);
  const failed = skill.recall.filter((_, i) => results[i] === "fail");
  const allPassed = outcome.passed === outcome.total;

  return (
    <div className="pb-2 pt-1 text-center" role="status">
      <RecallConstellation results={results} celebrate={outcome.learned} />
      <div className={styles.headline}>
        {outcome.learned ? (
          <>
            <h3 className="mt-2 font-display text-[28px] font-medium leading-tight text-gold-bright drop-shadow-[0_0_18px_rgba(233,196,106,0.35)]">
              {mode === "test-out" ? "Skill learned — tested out" : "Skill learned"}
            </h3>
            <p className="mt-1.5 font-mono text-[12px] text-parchment-dim">
              {outcome.passed}/{outcome.total}
              {outcome.xp > 0 ? (
                <>
                  {" "}
                  · <span className="text-gold">+{outcome.xp} XP</span>
                </>
              ) : (
                <span className="text-mist"> · XP already banked from an earlier pass</span>
              )}
            </p>
            <p className="mx-auto mt-3 max-w-[42ch] text-[13.5px] leading-relaxed text-parchment-dim">
              {skill.title} is lit on the tree, and anything waiting on it is now unlocked.
            </p>
          </>
        ) : allPassed ? (
          <>
            <h3 className="mt-2 font-display text-[26px] leading-tight text-parchment">All {outcome.total} still hold</h3>
            <p className="mx-auto mt-2 max-w-[42ch] text-[13.5px] text-parchment-dim">Answers saved with the attempt.</p>
          </>
        ) : (
          <>
            <h3 className="mt-2 font-display text-[26px] leading-tight text-parchment">
              {outcome.passed} of {outcome.total} — <span className="text-rust-bright">not yet</span>
            </h3>
            <p className="mx-auto mt-2 max-w-[46ch] text-[13.5px] leading-relaxed text-parchment-dim">
              {mode === "test-out"
                ? "Good to know where the edges are. The attempt is saved; work through the items behind these, then test out again."
                : "Close. The attempt is saved; revisit the items behind these and answer again when they feel solid."}
            </p>
            <ul className="mx-auto mt-4 max-w-[52ch] space-y-1.5 text-left">
              {failed.map((q) => (
                <li
                  key={q.id}
                  className="flex items-start gap-2 rounded-lg border border-rust/35 bg-rust/[0.07] px-3 py-2 text-[13px] text-parchment"
                >
                  <X className="mt-0.5 h-3.5 w-3.5 shrink-0 text-rust-bright" strokeWidth={2.6} />
                  <Markdown inline className="!text-parchment">
                    {q.text}
                  </Markdown>
                </li>
              ))}
            </ul>
          </>
        )}
        <Button variant={outcome.learned ? "gold" : "secondary"} className="mt-6 min-w-32" autoFocus onClick={onClose}>
          {outcome.learned ? "Onward" : "Close"}
        </Button>
      </div>
    </div>
  );
}
