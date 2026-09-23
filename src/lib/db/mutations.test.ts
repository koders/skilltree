import { describe, expect, it } from "vitest";
import {
  evaluateRecall,
  initialRecallCards,
  learnedViaAfterRecall,
  logHabitSchema,
  logTimeSchema,
  nextRecallCard,
  questStartMonday,
  recallBlockedReason,
  saveNoteSchema,
  setItemStatusSchema,
  submitRecallSchema,
  updateQuestRunSchema,
} from "@/lib/db/mutations";
import type { RecallCardRow } from "@/lib/progress/types";

const Q = ["q1", "q2", "q3"];
const pass = (questionId: string) => ({ questionId, result: "pass" as const });
const fail = (questionId: string) => ({ questionId, result: "fail" as const });

describe("evaluateRecall", () => {
  it("counts passes over a full answer set", () => {
    expect(evaluateRecall(Q, [pass("q1"), pass("q2"), pass("q3")], "test-out")).toEqual({ passed: 3, total: 3, allPassed: true });
    expect(evaluateRecall(Q, [pass("q1"), fail("q2"), pass("q3")], "complete")).toEqual({ passed: 2, total: 3, allPassed: false });
  });

  it("requires every question for test-out and completion", () => {
    expect(() => evaluateRecall(Q, [pass("q1"), pass("q3")], "test-out")).toThrow(/missing: q2/);
    expect(() => evaluateRecall(Q, [pass("q1")], "complete")).toThrow(/missing: q2, q3/);
  });

  it("lets a review answer a subset, which never counts as all passed", () => {
    expect(evaluateRecall(Q, [pass("q2")], "review")).toEqual({ passed: 1, total: 1, allPassed: false });
  });

  it("rejects unknown and repeated questions", () => {
    expect(() => evaluateRecall(Q, [pass("q1"), pass("q2"), pass("q9")], "test-out")).toThrow(/Unknown recall question "q9"/);
    expect(() => evaluateRecall(Q, [pass("q1"), fail("q1"), pass("q2"), pass("q3")], "test-out")).toThrow(/answered twice/);
  });

  it("rejects skills without usable recall ids", () => {
    expect(() => evaluateRecall([], [pass("q1")], "test-out")).toThrow(/no Recall questions/);
    expect(() => evaluateRecall(["q1", ""], [pass("q1")], "test-out")).toThrow(/pnpm content:ids/);
  });
});

describe("learnedViaAfterRecall", () => {
  const base = { allPassed: true, current: null, isStarting: false } as const;

  it("maps a clean test-out / completion to its route", () => {
    expect(learnedViaAfterRecall({ ...base, mode: "test-out" })).toBe("tested-out");
    expect(learnedViaAfterRecall({ ...base, mode: "complete" })).toBe("completed");
  });

  it("never changes anything on a review or a miss", () => {
    expect(learnedViaAfterRecall({ ...base, mode: "review" })).toBeNull();
    expect(learnedViaAfterRecall({ ...base, mode: "test-out", allPassed: false })).toBeNull();
  });

  it("upgrades self-reported skills (stored or content starting skills)", () => {
    expect(learnedViaAfterRecall({ ...base, mode: "test-out", current: "self-reported" })).toBe("tested-out");
    expect(learnedViaAfterRecall({ ...base, mode: "test-out", isStarting: true })).toBe("tested-out");
    expect(learnedViaAfterRecall({ ...base, mode: "complete", isStarting: true })).toBe("completed");
  });

  it("keeps an existing completed / tested-out route", () => {
    expect(learnedViaAfterRecall({ ...base, mode: "test-out", current: "completed" })).toBeNull();
    expect(learnedViaAfterRecall({ ...base, mode: "complete", current: "tested-out" })).toBeNull();
  });
});

describe("Leitner cards", () => {
  const at = "2026-09-23T08:00:00.000Z";

  it("seeds box 1, due after the first interval", () => {
    expect(initialRecallCards("s.a", ["q1", "q2"], "2026-09-23", at)).toEqual([
      { skillId: "s.a", questionId: "q1", box: 1, dueOn: "2026-09-24", lastResult: "pass", lastReviewedAt: at },
      { skillId: "s.a", questionId: "q2", box: 1, dueOn: "2026-09-24", lastResult: "pass", lastReviewedAt: at },
    ]);
  });

  const card: RecallCardRow = { skillId: "s.a", questionId: "q1", box: 2, dueOn: "2026-09-23", lastResult: "pass", lastReviewedAt: null };

  it("moves up a box on pass, using that box's interval", () => {
    expect(nextRecallCard(card, "pass", "2026-09-23", at)).toMatchObject({ box: 3, dueOn: "2026-09-30", lastResult: "pass", lastReviewedAt: at });
  });

  it("caps at the last box", () => {
    expect(nextRecallCard({ ...card, box: 6 }, "pass", "2026-09-23", at)).toMatchObject({ box: 6, dueOn: "2026-11-22" });
  });

  it("drops to box 1 on fail", () => {
    expect(nextRecallCard({ ...card, box: 5 }, "fail", "2026-09-23", at)).toMatchObject({ box: 1, dueOn: "2026-09-24", lastResult: "fail" });
  });
});

describe("questStartMonday", () => {
  it("snaps to the Monday of the given week, or this week", () => {
    expect(questStartMonday("2026-09-27", "2026-01-01")).toBe("2026-09-21");
    expect(questStartMonday("2026-09-21", "2026-01-01")).toBe("2026-09-21");
    expect(questStartMonday(null, "2026-09-23")).toBe("2026-09-21");
    expect(questStartMonday(undefined, "2027-01-01")).toBe("2026-12-28");
  });
});

describe("input schemas", () => {
  it("setItemStatus: bounds minutes and statuses", () => {
    expect(setItemStatusSchema.safeParse({ skillId: "s.a", itemId: "i", status: "done", minutes: 30 }).success).toBe(true);
    expect(setItemStatusSchema.safeParse({ skillId: "s.a", itemId: "i", status: "done", minutes: 1441 }).success).toBe(false);
    expect(setItemStatusSchema.safeParse({ skillId: "s.a", itemId: "i", status: "started" }).success).toBe(false);
    expect(setItemStatusSchema.safeParse({ skillId: " ", itemId: "i", status: "todo" }).success).toBe(false);
  });

  it("logTime: normalises blanks to null and validates dates", () => {
    const parsed = logTimeSchema.parse({ activity: "do", minutes: 20, note: "   ", skillId: undefined });
    expect(parsed).toMatchObject({ skillId: null, itemId: null, questId: null, habitKey: null, note: null });
    expect(logTimeSchema.safeParse({ activity: "do", minutes: 20, loggedOn: "2026-13-01" }).success).toBe(false);
    expect(logTimeSchema.safeParse({ activity: "sleep", minutes: 20 }).success).toBe(false);
    expect(logTimeSchema.safeParse({ activity: "do", minutes: 0 }).success).toBe(false);
  });

  it("saveNote: needs an owner and an http(s) url", () => {
    expect(saveNoteSchema.safeParse({ kind: "note", body: "x" }).success).toBe(false);
    expect(saveNoteSchema.parse({ questId: "quest-a", kind: "output", body: "x", url: "" }).url).toBeNull();
    expect(saveNoteSchema.safeParse({ skillId: "s.a", kind: "note", body: "x", url: "javascript:alert(1)" }).success).toBe(false);
    expect(saveNoteSchema.parse({ skillId: "s.a", kind: "note", body: "x", url: "https://example.com" }).url).toBe("https://example.com");
  });

  it("submitRecall: at least one answer", () => {
    expect(submitRecallSchema.safeParse({ skillId: "s.a", mode: "test-out", answers: [] }).success).toBe(false);
    const parsed = submitRecallSchema.parse({ skillId: "s.a", mode: "review", answers: [{ questionId: "q1", result: "pass", answer: "" }] });
    expect(parsed.answers[0].answer).toBeNull();
  });

  it("logHabit: habit keys are owner/item", () => {
    expect(logHabitSchema.safeParse({ habitKey: "quest-a/weekly", unit: "week" }).success).toBe(true);
    expect(logHabitSchema.safeParse({ habitKey: "weekly", unit: "week" }).success).toBe(false);
    expect(logHabitSchema.safeParse({ habitKey: "quest-a/weekly", unit: "day" }).success).toBe(false);
  });

  it("updateQuestRun: needs something to change", () => {
    const runId = "00000000-0000-4000-8000-000000000001";
    expect(updateQuestRunSchema.safeParse({ runId }).success).toBe(false);
    expect(updateQuestRunSchema.safeParse({ runId, hoursPerWeek: null }).success).toBe(true);
    expect(updateQuestRunSchema.safeParse({ runId, startedOn: "2026-09-23" }).success).toBe(true);
    expect(updateQuestRunSchema.safeParse({ runId: "nope", startedOn: "2026-09-23" }).success).toBe(false);
  });
});

describe("recallBlockedReason (server-side gate for test-outs and completion checks)", () => {
  const view = { learned: false, locked: false, readyToComplete: false, canTestOut: true };

  it("lets a completion check through only when the skill is ready to complete", () => {
    expect(recallBlockedReason({ ...view, readyToComplete: true }, "complete")).toBeNull();
    // e.g. an item was undone in another tab while the answers were being written
    expect(recallBlockedReason(view, "complete")).toMatch(/rank/i);
  });

  it("lets a test-out through only when the skill can be tested out of", () => {
    expect(recallBlockedReason(view, "test-out")).toBeNull();
    expect(recallBlockedReason({ ...view, locked: true, canTestOut: false }, "test-out")).toMatch(/locked/i);
    expect(recallBlockedReason({ ...view, learned: true, canTestOut: false }, "test-out")).toMatch(/already learned/i);
    expect(recallBlockedReason({ ...view, canTestOut: false }, "test-out")).toMatch(/prerequisites/i);
  });

  it("never blocks a review", () => {
    expect(recallBlockedReason({ ...view, canTestOut: false, locked: true }, "review")).toBeNull();
  });
});
