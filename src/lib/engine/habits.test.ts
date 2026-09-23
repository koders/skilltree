import { describe, expect, it } from "vitest";
import {
  habitLog,
  itemRow,
  learnedRow,
  makeIndex,
  makeQuest,
  makeSnapshot,
  sampleIndex,
} from "@/lib/engine/__fixtures__/content";
import { computeHabits, DEFAULT_HABIT_CADENCE } from "@/lib/engine/habits";
import { computeTreeState } from "@/lib/engine/state";
import type { HabitView } from "@/lib/engine/types";
import type { ProgressSnapshot } from "@/lib/progress/types";

const TODAY = "2026-09-23"; // Wednesday; week 2026-09-21..27

function habits(
  snapshot: Partial<ProgressSnapshot> = {},
  questWeeks: Record<string, number | null> = {},
  today = TODAY,
): HabitView[] {
  const index = sampleIndex();
  const snap = makeSnapshot(snapshot);
  return computeHabits(index, snap, computeTreeState(index, snap, today), questWeeks, today);
}

function byKey(list: HabitView[], key: string): HabitView {
  const found = list.find((h) => h.key === key);
  if (!found) throw new Error(`no habit ${key}`);
  return found;
}

describe("computeHabits: discovery and cadence", () => {
  it("lists quest maintenance habits in content order, then skill habits", () => {
    const list = habits();
    expect(list.map((h) => [h.key, h.ownerKind])).toEqual([
      ["quest-main/weekly-pod", "quest"],
      ["quest-main/twice-week", "quest"],
      ["quest-side/yearly-report", "quest"],
      ["quest-side/no-cadence", "quest"],
      ["a.basics/monthly-check", "skill"],
    ]);
    expect(byKey(list, "a.basics/monthly-check")).toMatchObject({ ownerId: "a.basics", itemId: "monthly-check", minutes: 15 });
  });

  it("resolves cadence: item, then maintenance section, then weekly", () => {
    const list = habits();
    expect(byKey(list, "quest-main/weekly-pod").cadence).toEqual({ unit: "week", times: 1, text: "weekly" });
    expect(byKey(list, "quest-main/twice-week").cadence).toMatchObject({ unit: "week", times: 2 });
    expect(byKey(list, "quest-side/yearly-report").cadence.unit).toBe("year");
    expect(byKey(list, "quest-side/no-cadence").cadence).toEqual(DEFAULT_HABIT_CADENCE);
    expect(byKey(list, "a.basics/monthly-check").cadence.unit).toBe("month");
  });

  it("computes the current period for each unit", () => {
    const list = habits();
    expect(byKey(list, "quest-main/weekly-pod")).toMatchObject({ periodStart: "2026-09-21", periodEnd: "2026-09-27" });
    expect(byKey(list, "a.basics/monthly-check")).toMatchObject({ periodStart: "2026-09-01", periodEnd: "2026-09-30" });
    expect(byKey(list, "quest-side/yearly-report")).toMatchObject({ periodStart: "2026-01-01", periodEnd: "2026-12-31" });
  });
});

describe("computeHabits: activation", () => {
  it("keeps quest habits inactive until the run reaches the maintenance week", () => {
    expect(byKey(habits(), "quest-main/weekly-pod")).toMatchObject({
      active: false,
      inactiveReason: "Start the quest to unlock",
    });
    expect(byKey(habits({}, { "quest-main": null }), "quest-main/weekly-pod").inactiveReason).toBe("Start the quest to unlock");
    expect(byKey(habits({}, { "quest-main": 2 }), "quest-main/weekly-pod")).toMatchObject({
      active: false,
      inactiveReason: "Starts in quest week 3",
    });
    expect(byKey(habits({}, { "quest-main": 3 }), "quest-main/weekly-pod")).toMatchObject({ active: true, inactiveReason: null });
    expect(byKey(habits({}, { "quest-main": 14 }), "quest-main/twice-week").active).toBe(true);
  });

  it("activates maintenance with no start week from quest week 1", () => {
    expect(byKey(habits({}, { "quest-side": 1 }), "quest-side/yearly-report").active).toBe(true);
    // A run that starts next Monday sits at week 0 (quest.ts): nothing is due yet.
    expect(byKey(habits({}, { "quest-side": 0 }), "quest-side/yearly-report")).toMatchObject({
      active: false,
      inactiveReason: "Starts in quest week 1",
    });
  });

  it("never activates maintenance before week 1, even when it says from week 0", () => {
    const index = makeIndex({
      skills: [],
      quests: [makeQuest({ id: "quest-zero", maintenance: { fromWeek: 0, items: [{ id: "h" }] } })],
    });
    const snap = makeSnapshot();
    const list = computeHabits(index, snap, computeTreeState(index, snap, TODAY), { "quest-zero": 0 }, TODAY);
    expect(list[0]).toMatchObject({ active: false, inactiveReason: "Starts in quest week 1" });
  });

  it("needs at least one occurrence per period even for a malformed cadence", () => {
    const index = makeIndex({
      skills: [],
      quests: [
        makeQuest({
          id: "quest-odd",
          maintenance: { items: [{ id: "nan", cadence: { unit: "week", times: Number.NaN, text: "?" } }] },
        }),
      ],
    });
    const snap = makeSnapshot({ habitLogs: [habitLog("quest-odd/nan", "2026-09-21", "2026-09-22")] });
    const [h] = computeHabits(index, snap, computeTreeState(index, snap, TODAY), {}, TODAY);
    expect(h).toMatchObject({ target: 1, doneThisPeriod: 1, complete: true, streak: 1 });
  });

  it("activates skill habits once the skill is in progress or learned", () => {
    expect(byKey(habits(), "a.basics/monthly-check")).toMatchObject({
      active: false,
      inactiveReason: "Unlocks when you start Basics",
    });
    expect(byKey(habits({ items: [itemRow("a.basics", "read-intro")] }), "a.basics/monthly-check").active).toBe(true);
    expect(byKey(habits({ skills: [learnedRow("a.basics", "completed", "2026-09-22T10:00:00Z")] }), "a.basics/monthly-check").active).toBe(
      true,
    );
    // Learned long ago → rusty (stale fact); still active.
    expect(byKey(habits({ skills: [learnedRow("a.basics", "completed", "2026-07-01T10:00:00Z")] }), "a.basics/monthly-check").active).toBe(
      true,
    );
  });

  it("sorts active habits first, keeping content order within each group", () => {
    const list = habits({ items: [itemRow("a.basics", "read-intro")] }, { "quest-side": 1, "quest-main": 1 });
    expect(list.map((h) => h.key)).toEqual([
      "quest-side/yearly-report",
      "quest-side/no-cadence",
      "a.basics/monthly-check",
      "quest-main/weekly-pod",
      "quest-main/twice-week",
    ]);
  });
});

describe("computeHabits: periods and streaks", () => {
  it("counts logs in the current period against the cadence target", () => {
    const once = habits({ habitLogs: [habitLog("quest-main/twice-week", "2026-09-21", "2026-09-22")] });
    expect(byKey(once, "quest-main/twice-week")).toMatchObject({ doneThisPeriod: 1, target: 2, complete: false });

    const twice = habits({
      habitLogs: [
        habitLog("quest-main/twice-week", "2026-09-21", "2026-09-22"),
        habitLog("quest-main/twice-week", "2026-09-21", "2026-09-23"),
      ],
    });
    expect(byKey(twice, "quest-main/twice-week")).toMatchObject({
      doneThisPeriod: 2,
      complete: true,
      streak: 1,
      lastDoneOn: "2026-09-23",
    });
  });

  it("streaks weekly: ending last week until this week is done", () => {
    const key = "quest-main/weekly-pod";
    const past = [habitLog(key, "2026-08-24"), habitLog(key, "2026-09-07"), habitLog(key, "2026-09-14", "2026-09-18")];
    const pending = byKey(habits({ habitLogs: past }), key);
    expect(pending).toMatchObject({ doneThisPeriod: 0, complete: false, streak: 2, lastDoneOn: "2026-09-18" });

    const done = byKey(habits({ habitLogs: [...past, habitLog(key, "2026-09-21", "2026-09-21")] }), key);
    expect(done).toMatchObject({ complete: true, streak: 3 });
  });

  it("breaks the streak on a period below target", () => {
    const key = "quest-main/twice-week";
    const logs = [habitLog(key, "2026-09-07"), habitLog(key, "2026-09-07", "2026-09-09"), habitLog(key, "2026-09-14")];
    expect(byKey(habits({ habitLogs: logs }), key).streak).toBe(0);
  });

  it("streaks monthly, across a year boundary", () => {
    const key = "a.basics/monthly-check";
    const logs = [habitLog(key, "2026-11-01", "2026-11-20"), habitLog(key, "2026-12-01", "2026-12-03")];
    const h = byKey(habits({ habitLogs: logs }, {}, "2027-01-15"), key);
    expect(h).toMatchObject({ periodStart: "2027-01-01", periodEnd: "2027-01-31", doneThisPeriod: 0, streak: 2 });
  });

  it("streaks yearly", () => {
    const key = "quest-side/yearly-report";
    const logs = [habitLog(key, "2024-01-01", "2024-03-01"), habitLog(key, "2025-01-01", "2025-02-10")];
    expect(byKey(habits({ habitLogs: logs }), key)).toMatchObject({ doneThisPeriod: 0, streak: 2, lastDoneOn: "2025-02-10" });
    const withThisYear = [...logs, habitLog(key, "2026-01-01", "2026-05-05")];
    expect(byKey(habits({ habitLogs: withThisYear }), key)).toMatchObject({ doneThisPeriod: 1, complete: true, streak: 3 });
  });

  it("files a log whose stored period uses another unit into the containing period", () => {
    // Written while the habit was weekly; the content now says monthly.
    const key = "a.basics/monthly-check";
    const h = byKey(habits({ habitLogs: [habitLog(key, "2026-09-07", "2026-09-08")] }), key);
    expect(h).toMatchObject({ doneThisPeriod: 1, complete: true, streak: 1 });
  });

  it("files a log by the day it was done when the stored period no longer lines up", () => {
    // Written while the habit was monthly (period 1 Sep), done on Tue 22 Sep; the content now says weekly.
    const weekly = byKey(habits({ habitLogs: [habitLog("quest-main/weekly-pod", "2026-09-01", "2026-09-22")] }), "quest-main/weekly-pod");
    expect(weekly).toMatchObject({ periodStart: "2026-09-21", doneThisPeriod: 1, complete: true, streak: 1 });

    // Written while yearly (period 1 Jan), done in September; now monthly.
    const monthly = byKey(habits({ habitLogs: [habitLog("a.basics/monthly-check", "2026-01-01", "2026-09-05")] }), "a.basics/monthly-check");
    expect(monthly).toMatchObject({ periodStart: "2026-09-01", doneThisPeriod: 1, complete: true });

    // A weekly period straddling two months, now monthly: the log goes where it was done.
    const straddle = byKey(habits({ habitLogs: [habitLog("a.basics/monthly-check", "2026-08-31", "2026-09-02")] }), "a.basics/monthly-check");
    expect(straddle).toMatchObject({ doneThisPeriod: 1, complete: true });
  });

  it("falls back to the stored period when doneOn is unusable", () => {
    const key = "quest-main/weekly-pod";
    const h = byKey(habits({ habitLogs: [{ ...habitLog(key, "2026-09-21"), doneOn: "not-a-date" }] }), key);
    expect(h).toMatchObject({ doneThisPeriod: 1, lastDoneOn: null });
  });

  it("ignores logs for habits that aren't in content", () => {
    const list = habits({ habitLogs: [habitLog("quest-ghost/foo", "2026-09-21"), habitLog("a.basics/read-intro", "2026-09-21")] });
    expect(list).toHaveLength(5);
    expect(list.every((h) => h.doneThisPeriod === 0 && h.lastDoneOn === null)).toBe(true);
  });
});
