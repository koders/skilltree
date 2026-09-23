import { describe, expect, it } from "vitest";
import { xpForLevel } from "@/lib/config";
import { attempt, makeSnapshot, testOutSession, timeLog } from "@/lib/engine/__fixtures__/content";
import { computeXp, levelForXp, recallBonusFor, xpForLog } from "@/lib/engine/xp";
import type { Activity } from "@/lib/progress/types";

const TODAY = "2026-09-23"; // Wednesday; ISO week starts 2026-09-21

describe("xpForLog", () => {
  it("weights active work above passive work", () => {
    expect(xpForLog("watch", 60)).toBe(60);
    expect(xpForLog("read", 60)).toBe(60);
    expect(xpForLog("habit", 60)).toBe(60);
    expect(xpForLog("review", 60)).toBe(60);
    expect(xpForLog("other", 60)).toBe(60);
    expect(xpForLog("do", 60)).toBe(90);
    expect(xpForLog("build", 60)).toBe(120);
    expect(xpForLog("output", 60)).toBe(120);
  });

  it("rounds to whole XP", () => {
    expect(xpForLog("do", 45)).toBe(68); // 67.5
    expect(xpForLog("do", 5)).toBe(8); // 7.5
  });

  it("earns nothing for zero, negative or non-finite minutes", () => {
    expect(xpForLog("build", 0)).toBe(0);
    expect(xpForLog("build", -30)).toBe(0);
    expect(xpForLog("build", Number.NaN)).toBe(0);
  });

  it("falls back to the base rate for an activity the config doesn't know", () => {
    expect(xpForLog("meditate" as Activity, 10)).toBe(10);
  });

  it("isn't fooled by activity names that are Object.prototype keys", () => {
    for (const name of ["toString", "constructor", "__proto__", "hasOwnProperty"]) {
      expect(xpForLog(name as Activity, 10)).toBe(10);
    }
  });
});

describe("computeXp: unknown activities", () => {
  it("files XP from unknown activities under other, so every total stays a number", () => {
    const snapshot = makeSnapshot({
      timeLogs: [
        timeLog({ activity: "constructor" as Activity, minutes: 10, loggedOn: "2026-09-22" }),
        timeLog({ activity: "__proto__" as Activity, minutes: 5, loggedOn: "2026-09-22" }),
        timeLog({ activity: "other", minutes: 1, loggedOn: "2026-09-22" }),
      ],
    });
    const xp = computeXp(snapshot, TODAY);
    expect(xp.total).toBe(16);
    expect(xp.byActivity).toEqual({ other: 16 });
    expect(Object.getPrototypeOf(xp.byActivity)).toBe(Object.prototype);
  });
});

describe("levelForXp", () => {
  it("starts at level 1", () => {
    expect(levelForXp(0)).toEqual({ level: 1, levelFloor: 0, nextLevelAt: 100, progressToNext: 0 });
    expect(levelForXp(-50).level).toBe(1);
    expect(levelForXp(Number.NaN).level).toBe(1);
  });

  it("levels up exactly at the threshold", () => {
    expect(levelForXp(99)).toMatchObject({ level: 1, progressToNext: 0.99 });
    expect(levelForXp(100)).toEqual({ level: 2, levelFloor: 100, nextLevelAt: xpForLevel(3), progressToNext: 0 });
    expect(levelForXp(xpForLevel(3) - 1).level).toBe(2);
    expect(levelForXp(xpForLevel(3)).level).toBe(3);
  });

  it("keeps progress between the floor and the next level", () => {
    for (const total of [1, 250, 1_000, 12_345, 250_000]) {
      const info = levelForXp(total);
      expect(info.levelFloor).toBeLessThanOrEqual(total);
      expect(info.nextLevelAt).toBeGreaterThan(total);
      expect(info.levelFloor).toBe(xpForLevel(info.level));
      expect(info.progressToNext).toBeGreaterThanOrEqual(0);
      expect(info.progressToNext).toBeLessThan(1);
    }
  });
});

describe("recallBonusFor", () => {
  it("pays once per question for test-out and completion passes, across sessions", () => {
    const attempts = [
      ...testOutSession("a.x", ["q1", "q2"], { sessionId: "s1", createdAt: "2026-09-01T10:00:00Z" }),
      ...testOutSession("a.x", ["q1", "q2", "q3"], { sessionId: "s2", createdAt: "2026-09-02T10:00:00Z" }),
      attempt("a.x", "q1", "pass", { mode: "complete", sessionId: "s3", createdAt: "2026-09-03T10:00:00Z" }),
    ];
    expect(recallBonusFor(attempts)).toBe(30);
  });

  it("keeps the same question id on different skills apart", () => {
    const attempts = [attempt("a.x", "q1", "pass"), attempt("a.y", "q1", "pass")];
    expect(recallBonusFor(attempts)).toBe(20);
  });

  it("pays every review pass", () => {
    const attempts = [
      attempt("a.x", "q1", "pass", { mode: "test-out" }),
      attempt("a.x", "q1", "pass", { mode: "review", sessionId: "r1" }),
      attempt("a.x", "q1", "pass", { mode: "review", sessionId: "r2" }),
    ];
    expect(recallBonusFor(attempts)).toBe(30);
  });

  it("pays nothing for failures", () => {
    expect(recallBonusFor([attempt("a.x", "q1", "fail"), attempt("a.x", "q2", "fail", { mode: "review" })])).toBe(0);
  });
});

describe("computeXp", () => {
  it("sums XP by activity and adds the recall bonus", () => {
    const snapshot = makeSnapshot({
      timeLogs: [
        timeLog({ activity: "watch", minutes: 60, loggedOn: "2026-09-21" }),
        timeLog({ activity: "do", minutes: 60, loggedOn: "2026-09-22" }),
        timeLog({ activity: "do", minutes: 30, loggedOn: "2026-09-10" }),
        timeLog({ activity: "build", minutes: 30, loggedOn: "2026-09-23" }),
      ],
      recallAttempts: testOutSession("a.x", ["q1", "q2", "q3"]),
    });
    const xp = computeXp(snapshot, TODAY);
    expect(xp.byActivity).toEqual({ watch: 60, do: 135, build: 60 });
    expect(xp.recallBonus).toBe(30);
    expect(xp.total).toBe(60 + 135 + 60 + 30);
    expect(xp.minutesTotal).toBe(180);
    expect(xp.thisWeekMinutes).toBe(150);
    expect(xp).toMatchObject(levelForXp(285));
    expect(xp.level).toBe(2);
  });

  it("returns the last 12 ISO weeks, oldest first, current included", () => {
    const xp = computeXp(makeSnapshot(), TODAY);
    expect(xp.weeks).toHaveLength(12);
    expect(xp.weeks[0].weekStart).toBe("2026-07-06");
    expect(xp.weeks[11]).toEqual({ weekStart: "2026-09-21", minutes: 0, xp: 0 });
    expect(xp.total).toBe(0);
    expect(xp.weeklyStreak).toBe(0);
  });

  it("buckets minutes by loggedOn and recall XP by the pass's Riga date", () => {
    const snapshot = makeSnapshot({
      timeLogs: [
        timeLog({ activity: "read", minutes: 40, loggedOn: "2026-09-20" }), // Sunday, previous week
        timeLog({ activity: "read", minutes: 50, loggedOn: "2026-07-05" }), // before the window
      ],
      // Sunday 22:30Z is already Monday 01:30 in Riga → counts in the current week.
      recallAttempts: [attempt("a.x", "q1", "pass", { createdAt: "2026-09-20T22:30:00Z" })],
    });
    const xp = computeXp(snapshot, TODAY);
    expect(xp.weeks[10]).toEqual({ weekStart: "2026-09-14", minutes: 40, xp: 40 });
    expect(xp.weeks[11]).toEqual({ weekStart: "2026-09-21", minutes: 0, xp: 10 });
    expect(xp.weeks.reduce((s, w) => s + w.minutes, 0)).toBe(40);
    expect(xp.minutesTotal).toBe(90);
  });

  describe("weekly streak", () => {
    const week = (monday: string, minutes: number) => timeLog({ activity: "read", minutes, loggedOn: monday });

    it("ends at the previous week while the current one doesn't qualify yet", () => {
      const logs = [week("2026-09-07", 120), week("2026-09-14", 200), week("2026-09-21", 30)];
      expect(computeXp(makeSnapshot({ timeLogs: logs }), TODAY).weeklyStreak).toBe(2);
    });

    it("includes the current week once it qualifies", () => {
      const logs = [week("2026-09-07", 120), week("2026-09-14", 200), week("2026-09-21", 120)];
      expect(computeXp(makeSnapshot({ timeLogs: logs }), TODAY).weeklyStreak).toBe(3);
    });

    it("needs the full threshold and stops at a gap", () => {
      const logs = [week("2026-08-31", 500), week("2026-09-07", 119), week("2026-09-14", 60), week("2026-09-15", 60)];
      expect(computeXp(makeSnapshot({ timeLogs: logs }), TODAY).weeklyStreak).toBe(1);
    });

    it("is zero when last week didn't qualify either", () => {
      const logs = [week("2026-09-07", 300)];
      expect(computeXp(makeSnapshot({ timeLogs: logs }), TODAY).weeklyStreak).toBe(0);
    });

    it("reaches back beyond the 12 weeks shown", () => {
      const logs = Array.from({ length: 15 }, (_, i) => {
        const d = new Date(Date.UTC(2026, 8, 21 - 7 * i)).toISOString().slice(0, 10);
        return week(d, 120);
      });
      expect(computeXp(makeSnapshot({ timeLogs: logs }), TODAY).weeklyStreak).toBe(15);
    });
  });
});
