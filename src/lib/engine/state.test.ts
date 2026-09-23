import { describe, expect, it } from "vitest";
import {
  attempt,
  itemRow,
  learnedRow,
  makeBranch,
  makeIndex,
  makeQuest,
  makeSkill,
  makeSnapshot,
  note,
  sampleIndex,
  sampleSkills,
  skillRow,
  testOutSession,
  timeLog,
  verification,
} from "@/lib/engine/__fixtures__/content";
import { computeTreeState, isLearnedState } from "@/lib/engine/state";
import type { ProgressSnapshot } from "@/lib/progress/types";

const TODAY = "2026-09-23";

function tree(snapshot: Partial<ProgressSnapshot> = {}, today = TODAY) {
  return computeTreeState(sampleIndex(), makeSnapshot(snapshot), today);
}

describe("isLearnedState", () => {
  it("treats every learned route and rusty as learned", () => {
    expect(["learned", "tested-out", "self-reported", "rusty"].every((s) => isLearnedState(s as never))).toBe(true);
    expect(["locked", "available", "in-progress"].some((s) => isLearnedState(s as never))).toBe(false);
  });
});

describe("computeTreeState: skill states", () => {
  it("derives the initial states from content alone", () => {
    const t = tree();
    expect(t.today).toBe(TODAY);
    expect(Object.fromEntries(Object.entries(t.skills).map(([id, s]) => [id, s.state]))).toEqual({
      "a.start": "self-reported",
      "a.basics": "available",
      "a.advanced": "locked",
      "b.bridge": "available", // cross-branch require on a starting skill
      "b.deep": "locked",
      "b.empty": "available",
    });
    expect(t.skills["a.start"]).toMatchObject({
      learned: true,
      learnedVia: "self-reported",
      learnedAt: null,
      isStarting: true,
      progress: 1,
    });
    expect(t.skills["b.deep"]).toMatchObject({ locked: true, missingRequires: ["b.bridge", "a.basics"] });
    expect(t.skills["a.basics"]).toMatchObject({ locked: false, missingRequires: [] });
  });

  it("marks a skill in progress from a done or skipped item, a time log or startedAt", () => {
    expect(tree({ items: [itemRow("a.basics", "read-intro")] }).skills["a.basics"].state).toBe("in-progress");
    expect(tree({ items: [itemRow("a.basics", "read-intro", undefined, "skipped")] }).skills["a.basics"].state).toBe(
      "in-progress",
    );
    // Any item counts, optional or not.
    expect(tree({ items: [itemRow("a.basics", "opt-book")] }).skills["a.basics"].state).toBe("in-progress");
    expect(
      tree({ timeLogs: [timeLog({ skillId: "a.basics", minutes: 10, loggedOn: "2026-09-20" })] }).skills["a.basics"].state,
    ).toBe("in-progress");
    expect(tree({ skills: [skillRow("a.basics", { startedAt: "2026-09-20T10:00:00Z" })] }).skills["a.basics"].state).toBe(
      "in-progress",
    );
  });

  it("keeps a skill locked even with activity on it", () => {
    const t = tree({
      items: [itemRow("a.advanced", "build-thing")],
      timeLogs: [timeLog({ skillId: "a.advanced", minutes: 30, loggedOn: "2026-09-20" })],
    });
    expect(t.skills["a.advanced"].state).toBe("locked");
  });

  it("maps each learned route to its state", () => {
    const t = tree({
      skills: [
        learnedRow("a.basics", "completed", "2026-09-20T10:00:00Z"),
        learnedRow("b.bridge", "completed"),
        learnedRow("a.advanced", "tested-out"),
        learnedRow("b.empty", "self-reported"),
      ],
      // Keep a.basics' time-sensitive fact fresh so it isn't rusty.
      verifications: [verification("a.basics", "ts-fact", "2026-09-20T10:00:00Z")],
    });
    expect(t.skills["a.basics"]).toMatchObject({ state: "learned", learnedVia: "completed", learnedAt: "2026-09-20T10:00:00Z" });
    expect(t.skills["b.bridge"].state).toBe("learned");
    expect(t.skills["a.advanced"].state).toBe("tested-out");
    expect(t.skills["b.empty"].state).toBe("self-reported");
    // Both prerequisites (one cross-branch) learned → the dependant unlocks.
    expect(t.skills["b.deep"]).toMatchObject({ state: "available", locked: false, missingRequires: [] });
  });

  it("lets a progress row upgrade a starting skill, and ignores rows without a route", () => {
    expect(tree({ skills: [learnedRow("a.start", "tested-out", "2026-09-10T10:00:00Z")] }).skills["a.start"]).toMatchObject({
      state: "tested-out",
      learnedAt: "2026-09-10T10:00:00Z",
      isStarting: true,
    });
    expect(tree({ skills: [skillRow("a.start", { starred: true })] }).skills["a.start"]).toMatchObject({
      state: "self-reported",
      starred: true,
    });
  });

  it("turns a learned skill with a stale fact rusty until it is re-verified", () => {
    const learned = learnedRow("a.basics", "completed", "2026-07-01T10:00:00Z");
    const rusty = tree({ skills: [learned] });
    expect(rusty.skills["a.basics"].state).toBe("rusty");
    expect(rusty.skills["a.basics"].rust.stale.map((s) => s.itemKey)).toEqual(["a.basics/ts-fact"]);
    // Rusty still counts as learned for dependants.
    expect(rusty.skills["a.advanced"].state).toBe("available");

    const refreshed = tree({ skills: [learned], verifications: [verification("a.basics", "ts-fact", "2026-09-22T10:00:00Z")] });
    expect(refreshed.skills["a.basics"].state).toBe("learned");
    expect(refreshed.items["a.basics/ts-fact"]).toMatchObject({ asOf: "2026-09-22", stale: false });
  });

  it("turns a learned skill rusty after a failed review", () => {
    const t = tree({
      skills: [learnedRow("b.bridge", "tested-out", "2026-09-01T10:00:00Z")],
      recallAttempts: [attempt("b.bridge", "q2", "fail", { mode: "review", sessionId: "r", createdAt: "2026-09-20T10:00:00Z" })],
    });
    expect(t.skills["b.bridge"].state).toBe("rusty");
    expect(t.skills["b.bridge"].rust.failedReview).toBe(true);
  });

  it("flags stale facts on an unlearned skill without calling it rusty", () => {
    const s = tree().skills["a.basics"];
    expect(s.state).toBe("available");
    expect(s.rust).toMatchObject({ isRusty: false, nextStaleOn: "2026-11-30" });
    expect(s.rust.stale).toHaveLength(1);
  });
});

describe("computeTreeState: ranks and progress", () => {
  it("locks a rank on its own requires until they're learned", () => {
    const before = tree().skills["a.basics"].ranks[1];
    expect(before).toMatchObject({ id: "rank-2", number: 2, locked: true, missingRequires: ["b.bridge"] });
    const after = tree({ skills: [learnedRow("b.bridge", "completed")] }).skills["a.basics"].ranks[1];
    expect(after).toMatchObject({ locked: false, missingRequires: [] });
  });

  it("never locks the ranks of a learned skill", () => {
    const rank2 = tree({ skills: [learnedRow("a.basics", "tested-out", "2026-09-22T10:00:00Z")] }).skills["a.basics"].ranks[1];
    expect(rank2).toMatchObject({ locked: false, complete: true, progress: 1 });
  });

  it("counts only blocking items and weights progress by estimated minutes", () => {
    // Rank 1 blocking: read-intro 60 + do-exercise 30 (optional book and habit excluded).
    const t = tree({ items: [itemRow("a.basics", "read-intro"), itemRow("a.basics", "opt-book")] });
    const rank1 = t.skills["a.basics"].ranks[0];
    expect(rank1).toMatchObject({ blockingCount: 2, doneCount: 1, complete: false });
    expect(rank1.progress).toBeCloseTo(60 / 90);
    // Skill: 60 of (90 + 50) blocking minutes.
    expect(t.skills["a.basics"].progress).toBeCloseTo(60 / 140);
    expect(t.skills["a.basics"].ranksComplete).toBe(0);
  });

  it("completes a rank when every blocking item is done or skipped", () => {
    const t = tree({ items: [itemRow("a.basics", "read-intro"), itemRow("a.basics", "do-exercise", undefined, "skipped")] });
    expect(t.skills["a.basics"].ranks[0]).toMatchObject({ complete: true, doneCount: 2, progress: 1 });
    expect(t.skills["a.basics"].ranksComplete).toBe(1);
    expect(t.skills["a.basics"].readyToComplete).toBe(false);
  });

  it("assumes 30 minutes for an item without an estimate", () => {
    const t = tree({ skills: [learnedRow("a.basics", "completed", "2026-09-22T10:00:00Z")], items: [itemRow("a.advanced", "quick-read")] });
    expect(t.skills["a.advanced"].progress).toBeCloseTo(30 / 120);
  });

  it("treats a rank with no blocking items as complete, and the skill's progress agrees", () => {
    const skill = makeSkill({ id: "a.habits", recall: ["q1"], ranks: [{ items: [{ id: "h", type: "habit" }, { id: "o", optional: true }] }] });
    const s = computeTreeState(makeIndex({ skills: [skill] }), makeSnapshot(), TODAY).skills["a.habits"];
    expect(s.ranks[0]).toMatchObject({ complete: true, blockingCount: 0, progress: 1 });
    // Nothing left to do but Recall: the skill bar must not read 0% while its only rank reads 100%.
    expect(s.progress).toBe(1);
    expect(s.readyToComplete).toBe(true);
  });

  it("weights items with a zero or non-finite estimate like unestimated ones", () => {
    const skill = makeSkill({
      id: "a.odd",
      recall: ["q1"],
      ranks: [{ items: [{ id: "zero", minutes: 0 }, { id: "nan", minutes: Number.NaN }, { id: "half", minutes: 30 }] }],
    });
    const s = computeTreeState(makeIndex({ skills: [skill] }), makeSnapshot({ items: [itemRow("a.odd", "zero")] }), TODAY)
      .skills["a.odd"];
    expect(s.ranks[0].progress).toBeCloseTo(1 / 3);
    expect(s.progress).toBeCloseTo(1 / 3);
    expect(Number.isFinite(s.progress)).toBe(true);
  });

  it("is ready to complete once every rank is complete but not yet learned", () => {
    const done = ["read-intro", "do-exercise", "ts-fact", "ts-override"].map((id) => itemRow("a.basics", id));
    const t = tree({ items: done, skills: [learnedRow("b.bridge", "completed")] });
    expect(t.skills["a.basics"]).toMatchObject({ state: "in-progress", readyToComplete: true, progress: 1, ranksComplete: 2 });

    const learned = tree({ items: done, skills: [learnedRow("a.basics", "completed", "2026-09-22T10:00:00Z")] });
    expect(learned.skills["a.basics"].readyToComplete).toBe(false);
  });

  it("is never ready to complete without ranks, or while locked", () => {
    expect(tree().skills["b.empty"].readyToComplete).toBe(false);
    const t = tree({ items: [itemRow("b.deep", "output-note")] });
    expect(t.skills["b.deep"].ranks[0].complete).toBe(true);
    expect(t.skills["b.deep"].readyToComplete).toBe(false);
  });

  it("is not ready to complete while one of its ranks is still locked", () => {
    // Every a.basics item done, but rank 2 still requires the unlearned b.bridge.
    const done = ["read-intro", "do-exercise", "ts-fact", "ts-override"].map((id) => itemRow("a.basics", id));
    const s = tree({ items: done }).skills["a.basics"];
    expect(s.ranks[1]).toMatchObject({ locked: true, complete: true });
    expect(s.readyToComplete).toBe(false);
  });
});

describe("computeTreeState: test-out", () => {
  it("allows testing out of unlocked, unlearned skills with Recall", () => {
    const t = tree();
    expect(t.skills["a.basics"].canTestOut).toBe(true);
    expect(t.skills["a.advanced"].canTestOut).toBe(false); // locked
    expect(t.skills["b.empty"].canTestOut).toBe(false); // no Recall
  });

  it("allows upgrading a self-reported skill, but not other learned routes", () => {
    expect(tree().skills["a.start"].canTestOut).toBe(true);
    const t = tree({ skills: [learnedRow("a.start", "tested-out"), learnedRow("a.basics", "completed", "2026-09-22T10:00:00Z")] });
    expect(t.skills["a.start"].canTestOut).toBe(false);
    expect(t.skills["a.basics"].canTestOut).toBe(false);
  });

  it("reports the latest test-out session", () => {
    const t = tree({
      recallAttempts: [
        ...testOutSession("a.basics", ["q1", "q2", "q3"], { sessionId: "old", createdAt: "2026-09-01T10:00:00Z", failed: ["q3"] }),
        ...testOutSession("a.basics", ["q1", "q2"], { sessionId: "new", createdAt: "2026-09-10T10:00:00Z", failed: ["q2"] }),
        // q2 re-answered in the same session: the later answer wins, and it counts once.
        attempt("a.basics", "q2", "pass", { sessionId: "new", createdAt: "2026-09-10T10:05:00Z" }),
        attempt("a.basics", "q1", "pass", { mode: "review", sessionId: "rev", createdAt: "2026-09-15T10:00:00Z" }),
      ],
    });
    expect(t.skills["a.basics"].lastTestOut).toEqual({ at: "2026-09-10T10:05:00Z", passed: 2, total: 2 });
    expect(t.skills["a.advanced"].lastTestOut).toBeNull();
  });

  it("reports the same last test-out whatever order rows arrive in", () => {
    const at = "2026-09-10T10:00:00Z";
    // Rows come back in uuid order; ties at one instant must not be decided by position.
    const sameSession = [
      attempt("a.basics", "q1", "pass", { sessionId: "s", createdAt: at }),
      attempt("a.basics", "q1", "fail", { sessionId: "s", createdAt: at }),
      attempt("a.basics", "q2", "pass", { sessionId: "s", createdAt: at }),
    ];
    const twoSessions = [
      ...testOutSession("a.basics", ["q1", "q2", "q3"], { sessionId: "a", createdAt: at }),
      ...testOutSession("a.basics", ["q1", "q2", "q3"], { sessionId: "b", createdAt: at, failed: ["q1", "q2"] }),
    ];
    for (const rows of [sameSession, twoSessions]) {
      const forward = tree({ recallAttempts: rows }).skills["a.basics"].lastTestOut;
      const backward = tree({ recallAttempts: [...rows].reverse() }).skills["a.basics"].lastTestOut;
      expect(backward).toEqual(forward);
    }
    expect(tree({ recallAttempts: sameSession }).skills["a.basics"].lastTestOut).toEqual({ at, passed: 1, total: 2 });
  });
});

describe("computeTreeState: items", () => {
  it("builds item views with status, blocking and time-sensitive fields", () => {
    const t = tree({
      items: [itemRow("a.basics", "read-intro", "2026-09-05T10:00:00Z")],
      timeLogs: [
        timeLog({ skillId: "a.basics", itemId: "read-intro", minutes: 25, loggedOn: "2026-09-05" }),
        timeLog({ skillId: "a.basics", itemId: "read-intro", minutes: 20, loggedOn: "2026-09-06" }),
        timeLog({ skillId: "a.basics", itemId: null, minutes: 15, loggedOn: "2026-09-06" }),
      ],
      notes: [
        note({ skillId: "a.basics", itemId: "read-intro" }),
        note({ skillId: "a.basics", itemId: "read-intro", kind: "output" }),
        note({ skillId: "a.basics", itemId: null }),
      ],
    });
    expect(t.items["a.basics/read-intro"]).toEqual({
      key: "a.basics/read-intro",
      ownerId: "a.basics",
      itemId: "read-intro",
      status: "done",
      completedAt: "2026-09-05T10:00:00Z",
      minutesLogged: 45,
      blocking: true,
      asOf: null,
      lastVerifiedAt: null,
      staleOn: null,
      stale: false,
      noteCount: 1,
      outputCount: 1,
    });
    expect(t.items["a.basics/do-exercise"]).toMatchObject({ status: "todo", completedAt: null, minutesLogged: 0 });
    expect(t.items["a.basics/opt-book"].blocking).toBe(false);
    expect(t.items["a.basics/monthly-check"].blocking).toBe(false);
    expect(t.items["a.basics/ts-fact"]).toMatchObject({ asOf: "2026-06-01", staleOn: "2026-08-30", stale: true });
    // Skill totals include item-level and skill-level rows.
    expect(t.skills["a.basics"]).toMatchObject({ minutesLogged: 60, noteCount: 2, outputCount: 1 });
  });

  it("includes quest maintenance habits, with time logged against the habit key", () => {
    const t = tree({
      timeLogs: [
        timeLog({ questId: "quest-main", habitKey: "quest-main/weekly-pod", itemId: "weekly-pod", activity: "habit", minutes: 45, loggedOn: "2026-09-22" }),
      ],
      notes: [note({ questId: "quest-main", itemId: "weekly-pod", kind: "output" })],
    });
    expect(t.items["quest-main/weekly-pod"]).toMatchObject({
      ownerId: "quest-main",
      status: "todo",
      blocking: false,
      minutesLogged: 45,
      outputCount: 1,
    });
    expect(Object.keys(t.items)).toContain("quest-side/yearly-report");
  });

  it("tracks freshness of time-sensitive quest maintenance items (item As of + re-verifications)", () => {
    const quest = makeQuest({
      id: "quest-fx",
      maintenance: {
        items: [
          { id: "rates", timeSensitive: true, asOf: "2026-06-01" },
          { id: "verified", timeSensitive: true, asOf: "2026-06-01" },
          { id: "plain" },
        ],
      },
    });
    const index = makeIndex({ skills: sampleSkills(), quests: [quest] });
    const t = computeTreeState(
      index,
      makeSnapshot({ verifications: [verification("quest-fx", "verified", "2026-09-20T10:00:00Z")] }),
      TODAY,
    );
    expect(t.items["quest-fx/rates"]).toMatchObject({ asOf: "2026-06-01", staleOn: "2026-08-30", stale: true, lastVerifiedAt: null });
    expect(t.items["quest-fx/verified"]).toMatchObject({ asOf: "2026-09-20", lastVerifiedAt: "2026-09-20", stale: false });
    expect(t.items["quest-fx/plain"]).toMatchObject({ asOf: null, staleOn: null, stale: false });
  });

  it("counts time logged on a skill's own habit toward that skill", () => {
    // What logHabit writes: only habit_key is set, no skill_id.
    const t = tree({
      skills: [learnedRow("a.basics", "completed", "2026-09-22T10:00:00Z")],
      timeLogs: [
        timeLog({ habitKey: "a.basics/monthly-check", activity: "habit", minutes: 20, loggedOn: "2026-09-22", createdAt: "2026-09-22T18:00:00Z" }),
        // A habit since removed from content still belongs to its skill.
        timeLog({ habitKey: "a.basics/retired-habit", activity: "habit", minutes: 5, loggedOn: "2026-09-22" }),
        // Quest habits and unknown owners belong to no skill.
        timeLog({ habitKey: "quest-main/weekly-pod", activity: "habit", minutes: 45, loggedOn: "2026-09-22" }),
        timeLog({ habitKey: "zz.ghost/h", activity: "habit", minutes: 7, loggedOn: "2026-09-22" }),
      ],
    });
    expect(t.items["a.basics/monthly-check"].minutesLogged).toBe(20);
    expect(t.skills["a.basics"]).toMatchObject({ minutesLogged: 25, xp: 25, lastActivityAt: "2026-09-22T18:00:00Z" });
    expect(t.branches.a.xp).toBe(25);
    expect(t.xp.minutesTotal).toBe(20 + 5 + 45 + 7);
  });

  it("doesn't count a habit log twice when it also names its skill", () => {
    const t = tree({
      timeLogs: [
        timeLog({ skillId: "a.basics", itemId: "monthly-check", habitKey: "a.basics/monthly-check", activity: "habit", minutes: 20, loggedOn: "2026-09-22" }),
      ],
    });
    expect(t.skills["a.basics"].minutesLogged).toBe(20);
    expect(t.items["a.basics/monthly-check"].minutesLogged).toBe(20);
  });
});

describe("computeTreeState: xp, activity and branches", () => {
  it("attributes XP to skills and totals it in the summary", () => {
    const t = tree({
      timeLogs: [
        timeLog({ skillId: "a.basics", activity: "do", minutes: 60, loggedOn: "2026-09-21" }),
        timeLog({ skillId: "a.basics", activity: "read", minutes: 30, loggedOn: "2026-09-22" }),
        timeLog({ skillId: "b.bridge", activity: "watch", minutes: 45, loggedOn: "2026-09-22" }),
        timeLog({ skillId: null, activity: "other", minutes: 20, loggedOn: "2026-09-22" }),
      ],
      recallAttempts: testOutSession("a.basics", ["q1", "q2", "q3"], { failed: ["q3"] }),
    });
    expect(t.skills["a.basics"].xp).toBe(90 + 30 + 20);
    expect(t.skills["b.bridge"].xp).toBe(45);
    expect(t.branches.a.xp).toBe(140);
    expect(t.branches.b.xp).toBe(45);
    expect(t.xp.total).toBe(140 + 45 + 20);
    expect(t.xp.thisWeekMinutes).toBe(155);
  });

  it("finds the latest activity by instant across items, logs and attempts", () => {
    const t = tree({
      items: [itemRow("a.basics", "read-intro", "2026-09-10T12:00:00+03:00")], // 09:00Z
      timeLogs: [timeLog({ skillId: "a.basics", minutes: 10, loggedOn: "2026-09-10", createdAt: "2026-09-10T10:00:00Z" })],
      recallAttempts: [attempt("a.basics", "q1", "pass", { createdAt: "2026-09-10T09:30:00Z" })],
    });
    expect(t.skills["a.basics"].lastActivityAt).toBe("2026-09-10T10:00:00Z");
    expect(t.skills["a.advanced"].lastActivityAt).toBeNull();
  });

  it("rolls skills up into branch views", () => {
    const t = tree({
      skills: [learnedRow("a.basics", "completed", "2026-07-01T10:00:00Z")], // rusty (stale fact)
      items: [itemRow("a.advanced", "build-thing")],
    });
    expect(t.branches.a).toEqual({
      id: "a",
      total: 3,
      learned: 2, // a.start + rusty a.basics
      inProgress: 1,
      available: 0,
      locked: 0,
      rusty: 1,
      progress: (1 + 1 + 90 / 120) / 3,
      xp: 0,
    });
    expect(t.branches.b).toMatchObject({ total: 3, learned: 0, available: 2, locked: 1, progress: 0 });
  });

  it("rolls up skills missing from their branch file, and branches with no skills", () => {
    const skills = [makeSkill({ id: "x.one" }), makeSkill({ id: "x.two" }), makeSkill({ id: "y.orphan" })];
    const index = makeIndex({ skills, branches: [makeBranch("x", ["x.one", "x.gone"]), makeBranch("z", [])] });
    const t = computeTreeState(index, makeSnapshot(), TODAY);
    expect(t.branches.x.total).toBe(2);
    expect(t.branches.y.total).toBe(1);
    expect(t.branches.z).toMatchObject({ total: 0, progress: 0, xp: 0 });
  });

  it("counts each skill in exactly one branch: its own branchId", () => {
    // Branch x's file lists y.orphan, but the skill (and the layout) say it belongs to y.
    const skills = [makeSkill({ id: "x.one" }), makeSkill({ id: "y.orphan" })];
    const index = makeIndex({ skills, branches: [makeBranch("x", ["x.one", "y.orphan"]), makeBranch("y", [])] });
    const t = computeTreeState(
      index,
      makeSnapshot({ timeLogs: [timeLog({ skillId: "y.orphan", activity: "build", minutes: 30, loggedOn: "2026-09-22" })] }),
      TODAY,
    );
    expect(t.branches.x).toMatchObject({ total: 1, xp: 0 });
    expect(t.branches.y).toMatchObject({ total: 1, xp: 60 });
    expect(Object.values(t.branches).reduce((sum, b) => sum + b.total, 0)).toBe(skills.length);
  });
});

describe("computeTreeState: purity", () => {
  function busySnapshot(): ProgressSnapshot {
    return makeSnapshot({
      items: [itemRow("a.basics", "read-intro"), itemRow("b.bridge", "watch-talk", "2026-09-02T10:00:00Z", "skipped")],
      skills: [learnedRow("b.bridge", "completed", "2026-09-03T10:00:00Z"), skillRow("a.advanced", { starred: true })],
      timeLogs: [
        timeLog({ skillId: "a.basics", itemId: "read-intro", activity: "do", minutes: 45, loggedOn: "2026-09-21" }),
        timeLog({ skillId: "b.bridge", activity: "watch", minutes: 30, loggedOn: "2026-09-14" }),
        timeLog({ habitKey: "a.basics/monthly-check", activity: "habit", minutes: 15, loggedOn: "2026-09-22" }),
      ],
      notes: [note({ skillId: "a.basics", itemId: "read-intro" }), note({ skillId: "b.bridge", kind: "output" })],
      recallAttempts: [
        ...testOutSession("a.basics", ["q1", "q2", "q3"], { sessionId: "t1", createdAt: "2026-09-05T10:00:00Z", failed: ["q2"] }),
        // Same instant, opposite results: the outcome must not depend on row order.
        attempt("b.bridge", "q1", "pass", { mode: "review", sessionId: "r1", createdAt: "2026-09-20T10:00:00Z" }),
        attempt("b.bridge", "q1", "fail", { mode: "review", sessionId: "r2", createdAt: "2026-09-20T10:00:00Z" }),
      ],
      verifications: [verification("a.basics", "ts-fact", "2026-09-10T10:00:00Z")],
    });
  }

  it("doesn't mutate its inputs", () => {
    const index = sampleIndex();
    const snapshot = busySnapshot();
    const before = JSON.stringify({ index, snapshot });
    deepFreeze(index);
    deepFreeze(snapshot);
    expect(() => computeTreeState(index, snapshot, TODAY)).not.toThrow();
    expect(JSON.stringify({ index, snapshot })).toBe(before);
  });

  it("doesn't depend on the order the database returned rows in", () => {
    const snapshot = busySnapshot();
    const reversed: ProgressSnapshot = {
      ...snapshot,
      items: [...snapshot.items].reverse(),
      skills: [...snapshot.skills].reverse(),
      timeLogs: [...snapshot.timeLogs].reverse(),
      notes: [...snapshot.notes].reverse(),
      recallAttempts: [...snapshot.recallAttempts].reverse(),
      verifications: [...snapshot.verifications].reverse(),
    };
    const a = computeTreeState(sampleIndex(), snapshot, TODAY);
    const b = computeTreeState(sampleIndex(), reversed, TODAY);
    expect(b).toEqual(a);
    expect(a.skills["b.bridge"].rust.failedReview).toBe(true);
  });
});

function deepFreeze(value: unknown): void {
  if (typeof value !== "object" || value === null || Object.isFrozen(value)) return;
  Object.freeze(value);
  for (const v of Object.values(value)) deepFreeze(v);
}

describe("computeTreeState: unknown ids", () => {
  it("ignores rows for skills that aren't in content in the tree, but keeps their time in the XP summary", () => {
    const withGhosts = tree({
      items: [itemRow("zz.ghost", "x"), itemRow("a.basics", "no-such-item")],
      skills: [learnedRow("zz.ghost", "completed"), skillRow("zz.ghost", { starred: true })],
      timeLogs: [
        timeLog({ skillId: "zz.ghost", activity: "build", minutes: 600, loggedOn: "2026-09-22" }),
        timeLog({ skillId: null, activity: "read", minutes: 10, loggedOn: "2026-09-22" }),
      ],
      notes: [note({ skillId: "zz.ghost", itemId: "x" })],
      recallAttempts: testOutSession("zz.ghost", ["q1", "q2", "q3"]),
      verifications: [verification("zz.ghost", "x", "2026-09-22T10:00:00Z")],
    });
    const clean = tree({ timeLogs: [timeLog({ skillId: null, activity: "read", minutes: 10, loggedOn: "2026-09-22" })] });
    expect(withGhosts.skills["zz.ghost"]).toBeUndefined();
    expect(withGhosts.branches.zz).toBeUndefined();
    expect(withGhosts.skills).toEqual(clean.skills);
    expect(withGhosts.items).toEqual(clean.items);
    expect(withGhosts.branches).toEqual(clean.branches);
    // Logged time and passed Recall are facts: removing a skill from content must not
    // rewrite history (streaks, weekly totals) or disagree with the quest's "this week".
    expect(withGhosts.xp).toMatchObject({ minutesTotal: 610, thisWeekMinutes: 610, recallBonus: 30 });
    expect(withGhosts.xp.total).toBe(1200 + 10 + 30);
    expect(clean.xp.total).toBe(10);
  });

  it("is not fooled by ids that collide with object prototype keys", () => {
    const t = tree({ skills: [learnedRow("constructor", "completed")], items: [itemRow("toString", "x")] });
    expect(Object.hasOwn(t.skills, "constructor")).toBe(false);
    expect(Object.keys(t.skills)).toEqual(sampleSkills().map((s) => s.id));
  });
});
