import { describe, expect, it } from "vitest";
import { remainingMinutes, skillTimeLogs } from "@/components/skill/format";
import { makeIndex, makeSnapshot, sampleSkills, testOutSession, timeLog } from "@/lib/engine/__fixtures__/content";
import { computeTreeState } from "@/lib/engine/state";
import { recallBonusFor, xpForLog } from "@/lib/engine/xp";

describe("remainingMinutes (prefill for completing an item)", () => {
  it("is the full estimate when nothing is logged yet", () => {
    expect(remainingMinutes(300, 0)).toBe(300);
  });

  it("subtracts time already logged on the item, so completing doesn't count it twice", () => {
    expect(remainingMinutes(300, 120)).toBe(180);
  });

  it("is empty once the logged time covers the estimate", () => {
    expect(remainingMinutes(300, 300)).toBeNull();
    expect(remainingMinutes(300, 420)).toBeNull();
  });

  it("is empty without a usable estimate", () => {
    expect(remainingMinutes(null, 0)).toBeNull();
    expect(remainingMinutes(undefined, 30)).toBeNull();
    expect(remainingMinutes(0, 0)).toBeNull();
  });

  it("stays inside what the minutes field accepts", () => {
    expect(remainingMinutes(3000, 0)).toBe(1440);
    expect(remainingMinutes(90.4, 0)).toBe(90);
  });
});

describe("skillTimeLogs (the rows behind the Time log header)", () => {
  const TODAY = "2026-09-23";
  const index = makeIndex({ skills: sampleSkills() });
  const logs = [
    timeLog({ skillId: "a.basics", itemId: "read-intro", activity: "read", minutes: 240, loggedOn: "2026-09-20" }),
    // Habit time is written with only a habit key.
    timeLog({ habitKey: "a.basics/monthly-check", activity: "habit", minutes: 60, loggedOn: "2026-09-21" }),
    timeLog({ skillId: "a.advanced", activity: "do", minutes: 30, loggedOn: "2026-09-21" }),
    timeLog({ habitKey: "quest-main/weekly-pod", questId: "quest-main", activity: "habit", minutes: 45, loggedOn: "2026-09-22" }),
  ];

  it("lists the same logs the engine totals, habits included", () => {
    const view = computeTreeState(index, makeSnapshot({ timeLogs: logs }), TODAY).skills["a.basics"];
    const rows = skillTimeLogs(logs, "a.basics");
    expect(rows.map((l) => l.minutes)).toEqual([240, 60]);
    expect(rows.reduce((s, l) => s + l.minutes, 0)).toBe(view.minutesLogged);
  });

  it("leaves the Recall bonus as the only difference between the header XP and the rows", () => {
    const attempts = testOutSession("a.basics", ["q1", "q2", "q3"], { createdAt: "2026-09-22T10:00:00Z" });
    const view = computeTreeState(index, makeSnapshot({ timeLogs: logs, recallAttempts: attempts }), TODAY).skills["a.basics"];
    const rowsXp = skillTimeLogs(logs, "a.basics").reduce((s, l) => s + xpForLog(l.activity, l.minutes), 0);
    expect(view.xp - rowsXp).toBe(recallBonusFor(attempts));
    expect(recallBonusFor(attempts)).toBe(30);
  });
});
