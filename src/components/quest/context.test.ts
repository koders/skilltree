import { describe, expect, it } from "vitest";
import { bankedKeys } from "@/components/quest/context";
import type { ItemView, PlanEntry, SkillView, TreeState } from "@/lib/engine/types";

const WEEK = { week: 2, weekStart: "2026-09-28", weekEnd: "2026-10-04" };

function entry(partial: Partial<PlanEntry> & Pick<PlanEntry, "key" | "week">): PlanEntry {
  return {
    kind: "item",
    skillId: "s.a",
    itemId: partial.key.split("/")[1] ?? null,
    title: partial.key,
    type: "read",
    minutes: 30,
    stageIndex: 0,
    status: "todo",
    locked: false,
    lockReason: null,
    ...partial,
  };
}

function state(items: Record<string, Partial<ItemView>>, skills: Record<string, Partial<SkillView>>): Pick<TreeState, "items" | "skills"> {
  return { items: items as Record<string, ItemView>, skills: skills as Record<string, SkillView> };
}

describe("bankedKeys", () => {
  it("keeps items of other weeks that were cleared during this week", () => {
    const plan = [
      entry({ key: "s.a/one", week: 1, status: "done" }),
      entry({ key: "s.a/two", week: 3, status: "skipped" }),
      entry({ key: "s.a/old", week: 1, status: "done" }),
      entry({ key: "s.a/open", week: 3 }),
      entry({ key: "s.a/this", week: 2, status: "done" }),
    ];
    const s = state(
      {
        "s.a/one": { completedAt: "2026-09-29T10:00:00Z" },
        "s.a/two": { completedAt: "2026-10-04T20:00:00Z" }, // 23:00 Sunday in Riga
        "s.a/old": { completedAt: "2026-09-25T10:00:00Z" },
        "s.a/this": { completedAt: "2026-09-29T10:00:00Z" },
      },
      {},
    );
    expect([...bankedKeys(plan, WEEK, s)].sort()).toEqual(["s.a/one", "s.a/two"]);
  });

  it("keeps a Recall step whose skill was learned this week, so its dialog stays open on the result", () => {
    const plan = [
      entry({ key: "s.a#recall", kind: "recall", itemId: null, type: "recall", week: 3, status: "done" }),
      entry({ key: "s.b#recall", kind: "recall", skillId: "s.b", itemId: null, type: "recall", week: 1, status: "done" }),
      entry({ key: "s.c#recall", kind: "recall", skillId: "s.c", itemId: null, type: "recall", week: 1, status: "done" }),
    ];
    const s = state(
      {},
      {
        "s.a": { learnedAt: "2026-09-30T09:00:00Z" },
        "s.b": { learnedAt: "2026-10-01T09:00:00Z" },
        "s.c": { learnedAt: "2026-09-10T09:00:00Z" },
      },
    );
    expect([...bankedKeys(plan, WEEK, s)].sort()).toEqual(["s.a#recall", "s.b#recall"]);
  });

  it("ignores open entries and skills learned without a time (starting skills)", () => {
    const plan = [
      entry({ key: "s.a#recall", kind: "recall", itemId: null, type: "recall", week: 3 }),
      entry({ key: "s.d#recall", kind: "recall", skillId: "s.d", itemId: null, type: "recall", week: 3, status: "done" }),
    ];
    const s = state({}, { "s.a": { learnedAt: "2026-09-30T09:00:00Z" }, "s.d": { learnedAt: null } });
    expect(bankedKeys(plan, WEEK, s).size).toBe(0);
  });
});
