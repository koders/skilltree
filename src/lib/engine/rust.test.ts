import { describe, expect, it } from "vitest";
import { attempt, makeSkill, sampleSkills, verification } from "@/lib/engine/__fixtures__/content";
import { computeRust } from "@/lib/engine/rust";
import type { Skill } from "@/lib/content/types";

function basics(): Skill {
  const skill = sampleSkills().find((s) => s.id === "a.basics");
  if (!skill) throw new Error("fixture missing a.basics");
  return skill;
}

const LEARNED = { learned: true, learnedAt: "2026-09-01T10:00:00Z" };
const NOT_LEARNED = { learned: false, learnedAt: null };

describe("computeRust: freshness", () => {
  // a.basics facts_as_of 2026-06-01 → ts-fact goes stale on 2026-08-30 (90 days).
  // ts-override has `As of: 2026-09-01` → stale on 2026-11-30.

  it("leaves non-time-sensitive items without dates", () => {
    const { items } = computeRust(basics(), [], [], LEARNED, "2026-09-23");
    expect(items["read-intro"]).toEqual({ asOf: null, lastVerifiedAt: null, staleOn: null, stale: false });
  });

  it("inherits the skill's facts_as_of unless the item overrides it", () => {
    const { items } = computeRust(basics(), [], [], LEARNED, "2026-09-23");
    expect(items["ts-fact"]).toMatchObject({ asOf: "2026-06-01", staleOn: "2026-08-30", stale: true });
    expect(items["ts-override"]).toMatchObject({ asOf: "2026-09-01", staleOn: "2026-11-30", stale: false });
  });

  it("goes stale exactly on asOf + freshness days", () => {
    const dayBefore = computeRust(basics(), [], [], LEARNED, "2026-08-29");
    expect(dayBefore.rust.stale).toEqual([]);
    expect(dayBefore.rust.isRusty).toBe(false);
    expect(dayBefore.rust.nextStaleOn).toBe("2026-08-30");

    const onTheDay = computeRust(basics(), [], [], LEARNED, "2026-08-30");
    expect(onTheDay.rust.stale).toEqual([
      { itemId: "ts-fact", itemKey: "a.basics/ts-fact", asOf: "2026-06-01", staleSince: "2026-08-30", daysStale: 0 },
    ]);
    expect(onTheDay.rust.isRusty).toBe(true);
    expect(onTheDay.rust.nextStaleOn).toBe("2026-11-30");
  });

  it("counts days stale", () => {
    const { rust } = computeRust(basics(), [], [], LEARNED, "2026-09-23");
    expect(rust.stale[0].daysStale).toBe(24);
  });

  it("honours a custom freshness window", () => {
    const { items } = computeRust(basics(), [], [], LEARNED, "2026-07-01", 30);
    expect(items["ts-fact"]).toMatchObject({ staleOn: "2026-07-01", stale: true });
  });

  it("refreshes an item from its latest re-verification (as a Riga date)", () => {
    const rows = [
      verification("a.basics", "ts-fact", "2026-07-01T08:00:00Z"),
      // 21:30Z on the 10th is 00:30 on the 11th in Riga.
      verification("a.basics", "ts-fact", "2026-09-10T21:30:00Z", true),
    ];
    const { items, rust } = computeRust(basics(), rows, [], LEARNED, "2026-09-23");
    expect(items["ts-fact"]).toEqual({
      asOf: "2026-09-11",
      lastVerifiedAt: "2026-09-11",
      staleOn: "2026-12-10",
      stale: false,
    });
    expect(rust.isRusty).toBe(false);
    expect(rust.nextStaleOn).toBe("2026-11-30");
  });

  it("never moves the as-of date backwards for an older verification", () => {
    const rows = [verification("a.basics", "ts-override", "2026-08-01T10:00:00Z")];
    const { items } = computeRust(basics(), rows, [], LEARNED, "2026-09-23");
    expect(items["ts-override"]).toMatchObject({ asOf: "2026-09-01", lastVerifiedAt: "2026-08-01" });
  });

  it("ignores verifications for other skills or items", () => {
    const rows = [
      verification("a.advanced", "ts-fact", "2026-09-20T10:00:00Z"),
      verification("a.basics", "read-intro", "2026-09-20T10:00:00Z"),
    ];
    const { items } = computeRust(basics(), rows, [], LEARNED, "2026-09-23");
    expect(items["ts-fact"].lastVerifiedAt).toBeNull();
    expect(items["read-intro"].lastVerifiedAt).toBeNull();
  });

  it("ignores time-sensitive items with no date at all", () => {
    const skill = makeSkill({
      id: "a.undated",
      ranks: [{ items: [{ id: "ts", timeSensitive: true }] }],
    });
    const { items, rust } = computeRust(skill, [], [], LEARNED, "2030-01-01");
    expect(items.ts).toEqual({ asOf: null, lastVerifiedAt: null, staleOn: null, stale: false });
    expect(rust).toEqual({ stale: [], failedReview: false, isRusty: false, nextStaleOn: null });
  });

  it("falls back to the skill's facts_as_of when the item's As of is malformed", () => {
    const skill = makeSkill({
      id: "a.typo",
      factsAsOf: "2026-06-01",
      ranks: [{ items: [{ id: "ts", timeSensitive: true, asOf: "2026-13-45" }] }],
    });
    const { items, rust } = computeRust(skill, [], [], LEARNED, "2026-09-23");
    expect(items.ts).toMatchObject({ asOf: "2026-06-01", staleOn: "2026-08-30", stale: true });
    expect(rust.isRusty).toBe(true);
  });

  it("dates an undated item from a verification alone", () => {
    const skill = makeSkill({ id: "a.undated", ranks: [{ items: [{ id: "ts", timeSensitive: true }] }] });
    const { items } = computeRust(skill, [verification("a.undated", "ts", "2026-09-01T10:00:00Z")], [], LEARNED, "2026-09-23");
    expect(items.ts).toMatchObject({ asOf: "2026-09-01", staleOn: "2026-11-30", stale: false });
  });

  it("lists stale items on unlearned skills without making them rusty", () => {
    const { rust } = computeRust(basics(), [], [], NOT_LEARNED, "2026-09-23");
    expect(rust.stale).toHaveLength(1);
    expect(rust.isRusty).toBe(false);
  });
});

describe("computeRust: failed review", () => {
  const today = "2026-09-02";
  const fresh = makeSkill({ id: "a.fresh", recall: ["q1", "q2", "q3"] });
  const review = (q: string, result: "pass" | "fail", createdAt: string) =>
    attempt("a.fresh", q, result, { mode: "review", sessionId: createdAt, createdAt });

  it("turns a learned skill rusty when the latest review of a question failed", () => {
    const { rust } = computeRust(fresh, [], [review("q1", "fail", "2026-09-02T10:00:00Z")], LEARNED, today);
    expect(rust.failedReview).toBe(true);
    expect(rust.isRusty).toBe(true);
  });

  it("clears once that question passes a later review", () => {
    const attempts = [review("q1", "fail", "2026-09-02T10:00:00Z"), review("q1", "pass", "2026-09-03T10:00:00Z")];
    expect(computeRust(fresh, [], attempts, LEARNED, today).rust.failedReview).toBe(false);
  });

  it("stays failed while any question's latest review failed", () => {
    const attempts = [review("q1", "fail", "2026-09-02T10:00:00Z"), review("q2", "pass", "2026-09-03T10:00:00Z")];
    expect(computeRust(fresh, [], attempts, LEARNED, today).rust.failedReview).toBe(true);
  });

  it("ignores reviews from before the skill was learned", () => {
    const attempts = [review("q1", "fail", "2026-08-20T10:00:00Z")];
    expect(computeRust(fresh, [], attempts, LEARNED, today).rust.failedReview).toBe(false);
    // Unknown learn time (self-reported starting skill): every review counts.
    expect(computeRust(fresh, [], attempts, { learned: true, learnedAt: null }, today).rust.failedReview).toBe(true);
  });

  it("ignores non-review modes, other skills and questions no longer in content", () => {
    const attempts = [
      attempt("a.fresh", "q1", "fail", { mode: "test-out", createdAt: "2026-09-02T10:00:00Z" }),
      attempt("a.fresh", "q1", "fail", { mode: "complete", createdAt: "2026-09-02T10:00:00Z" }),
      attempt("a.other", "q1", "fail", { mode: "review", createdAt: "2026-09-02T10:00:00Z" }),
      review("q9", "fail", "2026-09-02T10:00:00Z"),
    ];
    expect(computeRust(fresh, [], attempts, LEARNED, today).rust.failedReview).toBe(false);
  });

  it("lets a fail win a tie with a pass at the same instant, whatever the row order", () => {
    const pass = review("q1", "pass", "2026-09-02T10:00:00Z");
    const fail = { ...review("q1", "fail", "2026-09-02T10:00:00Z"), sessionId: "other" };
    expect(computeRust(fresh, [], [pass, fail], LEARNED, today).rust.failedReview).toBe(true);
    expect(computeRust(fresh, [], [fail, pass], LEARNED, today).rust.failedReview).toBe(true);
  });

  it("counts a review made at exactly the learn time", () => {
    const attempts = [review("q1", "fail", LEARNED.learnedAt)];
    expect(computeRust(fresh, [], attempts, LEARNED, today).rust.failedReview).toBe(true);
  });

  it("reports a failed review on an unlearned skill without rust", () => {
    const { rust } = computeRust(fresh, [], [review("q1", "fail", "2026-09-02T10:00:00Z")], NOT_LEARNED, today);
    expect(rust.failedReview).toBe(true);
    expect(rust.isRusty).toBe(false);
  });
});
