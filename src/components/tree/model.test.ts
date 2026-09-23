import { describe, expect, it } from "vitest";
import { buildTreeModel, lockedRankNote, nextActionHint, openBlockingItems } from "@/components/tree/model";
import { loadContentTree } from "@/lib/content/load";
import { indexContent } from "@/lib/content/types";
import { itemRow, learnedRow, makeSnapshot, skillRow } from "@/lib/engine/__fixtures__/content";
import { computeTreeState } from "@/lib/engine/state";
import type { ProgressSnapshot } from "@/lib/progress/types";
import type { TreeData } from "@/lib/view-model";

const TODAY = "2026-09-23";
const MI = "finance.market-intelligence";
const index = indexContent(loadContentTree());

function model(snapshot: Partial<ProgressSnapshot>) {
  const data: TreeData = {
    today: TODAY,
    branches: index.tree.branches,
    skills: index.tree.skills,
    state: computeTreeState(index, makeSnapshot(snapshot), TODAY),
    notes: [],
    timeLogs: [],
    recallAttempts: [],
    verifications: [],
    activeQuest: null,
  };
  const m = buildTreeModel(data);
  const titleOf = (id: string) => m.byId.get(id)?.skill.title ?? id;
  const meta = m.byId.get(MI)!;
  return { data, meta, titleOf };
}

describe("nextActionHint with locked ranks", () => {
  const rankOne = index.skills[MI].ranks[0].items.filter((i) => !i.optional && i.type !== "habit").map((i) => itemRow(MI, i.id));

  it("names the prerequisite instead of '0 items left' when only a locked rank remains", () => {
    const { data, meta, titleOf } = model({ skills: [learnedRow("crypto.staking-metrics", "tested-out")], items: rankOne });
    expect(meta.view.state).toBe("in-progress");
    expect(openBlockingItems(meta, data)).toEqual([]);
    expect(nextActionHint(meta, data, titleOf)).toEqual({ text: "Rank 2 needs Market Structure and Derivatives", tone: "mist" });
  });

  it("keeps counting open items while there are some", () => {
    const { data, meta, titleOf } = model({ skills: [learnedRow("crypto.staking-metrics", "tested-out"), skillRow(MI, { startedAt: "2026-09-22T10:00:00Z" })] });
    expect(nextActionHint(meta, data, titleOf).text).toBe(`${rankOne.length} items left`);
  });

  it("reads 'Needs <skill>' while every rank is locked", () => {
    const { data, meta, titleOf } = model({});
    expect(nextActionHint(meta, data, titleOf)).toEqual({ text: `Needs ${titleOf("crypto.staking-metrics")}`, tone: "mist" });
  });
});

describe("lockedRankNote", () => {
  it("is null for locked or learned skills and for skills without a locked rank", () => {
    expect(lockedRankNote(model({}).meta.view, (id) => id)).toBeNull();
    const both = model({ skills: [learnedRow("crypto.staking-metrics", "tested-out"), learnedRow("finance.market-structure", "tested-out")] });
    expect(lockedRankNote(both.meta.view, both.titleOf)).toBeNull();
  });
});
