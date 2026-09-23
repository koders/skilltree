import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { RECALL_STEP_MINUTES } from "@/lib/config";
import type { ContentIndex } from "@/lib/content/types";
import { addDays } from "@/lib/engine/dates";
import { computeTreeState } from "@/lib/engine/state";
import {
  activeQuestWeeks,
  buildPlan,
  computeQuestView,
  computeQuestViews,
  currentRun,
} from "@/lib/engine/quest";
import type { PlanEntry, QuestView } from "@/lib/engine/types";
import type { ItemProgressRow, LearnedVia, SkillProgressRow, StoredItemStatus } from "@/lib/progress/types";
import {
  allItemsDone,
  makeIndex,
  makeQuest,
  makeRun,
  makeSkill,
  makeSnapshot,
  makeTimeLog,
  makeTree,
  RUN_START,
  SEED_QUEST,
  SEED_QUEST_ID,
  SEED_SKILLS,
  seedIndex,
  type FixtureProgress,
} from "@/lib/engine/__fixtures__/quest-fixtures";

const TODAY = "2026-09-23"; // Wednesday of week 1 when the run starts on RUN_START

/** A day inside quest week `week` of a run starting on RUN_START (Wednesday). */
function dayOfWeek(week: number): string {
  return addDays(RUN_START, (week - 1) * 7 + 2);
}

function seedQuest(index: ContentIndex) {
  return index.quests[SEED_QUEST_ID];
}

function seedPlan(progress: FixtureProgress = {}, capacity = 300): PlanEntry[] {
  const index = seedIndex();
  return buildPlan(index, seedQuest(index), makeTree(index, TODAY, progress), capacity);
}

function seedView(options: { progress?: FixtureProgress; runs?: ReturnType<typeof makeRun>[]; today?: string } = {}): QuestView {
  const index = seedIndex();
  const today = options.today ?? TODAY;
  const snapshot = makeSnapshot({ questRuns: options.runs ?? [] });
  return computeQuestView(index, SEED_QUEST_ID, snapshot, makeTree(index, today, options.progress), today);
}

function entry(plan: PlanEntry[], key: string): PlanEntry {
  const found = plan.find((e) => e.key === key);
  if (!found) throw new Error(`No plan entry ${key}`);
  return found;
}

const keys = (entries: PlanEntry[]): string[] => entries.map((e) => e.key);
const weeksByKey = (entries: PlanEntry[]): Record<string, number> =>
  Object.fromEntries(entries.map((e) => [e.key, e.week]));

const STAGE_1_SKILLS = ["crypto.consensus", "finance.money-settlement", "crypto.eth-validators"];

// ---------------------------------------------------------------- fixture vs seed

interface SeedRankFacts {
  number: number;
  requires: string[];
  blockingMinutes: number[];
}

interface SeedSkillFacts {
  title: string;
  requires: string[];
  ranks: SeedRankFacts[];
  recallCount: number;
}

function readSeed(): string {
  return fs.readFileSync(path.join(process.cwd(), "crypto-finance-the-tie.skilltree.md"), "utf8");
}

function toMinutes(amount: string, unit: string): number {
  return Math.round(Number(amount) * (unit === "h" ? 60 : 1));
}

/** Just enough of the bundle format to cross-check the hand-written fixture. */
function seedSkillFacts(text: string): Record<string, SeedSkillFacts> {
  const facts: Record<string, SeedSkillFacts> = {};
  let title: string | null = null;
  let current: SeedSkillFacts | null = null;
  let rank: SeedRankFacts | null = null;
  let inRecall = false;
  const idList = (value: string) => (value.trim() === "—" ? [] : value.split(",").map((s) => s.trim()));
  for (const line of text.split("\n")) {
    if (line.startsWith("# ")) {
      current = null;
      title = null;
    } else if (line.startsWith("## ")) {
      title = line.slice(3).trim();
      current = null;
      rank = null;
      inRecall = false;
    } else if (line.startsWith("### ")) {
      const heading = /^### Rank (\d+)/.exec(line);
      rank = heading && current ? { number: Number(heading[1]), requires: [], blockingMinutes: [] } : null;
      if (rank && current) current.ranks.push(rank);
      inRecall = line.trim() === "### Recall";
    } else if (line.startsWith("- id: ") && title) {
      current = { title, requires: [], ranks: [], recallCount: 0 };
      facts[line.slice(6).trim()] = current;
    } else if (line.startsWith("- requires: ") && current) {
      if (rank) rank.requires = idList(line.slice(12));
      else current.requires = idList(line.slice(12));
    } else if (current && inRecall && line.startsWith("- ")) {
      current.recallCount += 1;
    } else if (rank) {
      const item = /^- \[[ x]\] \[(\w+)\]((?: \[[\w-]+\])*) (.*)$/.exec(line);
      if (!item) continue;
      const [, type, flags, rest] = item;
      const optional = flags.includes("[optional]") || /^Optional\b/.test(rest);
      if (type === "habit" || optional) continue;
      const times = [...rest.matchAll(/ — ~(\d+(?:\.\d+)?) (h|min)/g)];
      const last = times[times.length - 1];
      rank.blockingMinutes.push(last ? toMinutes(last[1], last[2]) : NaN);
    }
  }
  return facts;
}

describe("quest fixtures mirror the seed bundle", () => {
  const seed = readSeed();

  it("transcribes the stage table exactly", () => {
    const rows = seed
      .split("\n")
      .filter((l) => /^\| \d/.test(l))
      .map((l) => {
        const [weeks, name, skills] = l.split("|").slice(1, 4).map((s) => s.trim());
        const m = /^(\d+)(?:–(\d+))?(\+)?$/.exec(weeks);
        if (!m) throw new Error(`Bad weeks cell ${weeks}`);
        const weekStart = Number(m[1]);
        const weekEnd = m[3] ? null : m[2] ? Number(m[2]) : weekStart;
        return { name, weekStart, weekEnd, steps: skills.split("→").map((s) => s.trim()) };
      });
    expect(rows).toEqual(SEED_QUEST.stages);
  });

  it("transcribes titles, requires and each rank's requires and blocking item minutes", () => {
    const facts = seedSkillFacts(seed);
    const index = seedIndex();
    for (const spec of SEED_SKILLS) {
      const skill = index.skills[spec.id];
      const ranks = skill.ranks.map((r) => ({
        number: r.number,
        requires: r.requires,
        blockingMinutes: r.items.filter((it) => !it.optional && it.type !== "habit").map((it) => it.minutes),
      }));
      const fact = facts[spec.id];
      expect({ id: spec.id, title: skill.title, requires: skill.requires, ranks }).toEqual({
        id: spec.id,
        title: fact?.title,
        requires: fact?.requires,
        ranks: fact?.ranks,
      });
      // Only "has Recall" matters to the plan; the seed's non-starting skills all have 3–5 questions.
      expect(skill.recall.length > 0).toBe((fact?.recallCount ?? 0) > 0);
    }
  });

  it("covers every skill the seed quest names", () => {
    const named = SEED_QUEST.stages.flatMap((s) => s.steps.map((step) => step.split(" ")[0]));
    const facts = seedSkillFacts(seed);
    for (const id of named) {
      expect(facts[id], id).toBeDefined();
      expect(seedIndex().skills[id], id).toBeDefined();
    }
  });
});

// ---------------------------------------------------------------- buildPlan

describe("buildPlan on the seed quest", () => {
  it("spreads Foundations over weeks 1–3 by cumulative minutes", () => {
    const plan = seedPlan().filter((e) => e.stageIndex === 0);
    // 795 min over 3 weeks → 265 min/week; an entry lands where it starts.
    expect(plan.map((e) => [e.key, e.minutes, e.week])).toEqual([
      ["crypto.consensus/roughgarden", 300, 1],
      ["crypto.consensus#recall", RECALL_STEP_MINUTES, 2],
      ["finance.money-settlement/mit-sessions", 240, 2],
      ["finance.money-settlement#recall", RECALL_STEP_MINUTES, 3],
      ["crypto.eth-validators/pos-docs", 30, 3],
      ["crypto.eth-validators/eth2book", 120, 3],
      ["crypto.eth-validators/validator-note", 60, 3],
      ["crypto.eth-validators#recall", RECALL_STEP_MINUTES, 3],
    ]);
  });

  it("builds recall steps that close each skill", () => {
    const recall = entry(seedPlan(), "crypto.consensus#recall");
    expect(recall).toMatchObject({
      kind: "recall",
      skillId: "crypto.consensus",
      itemId: null,
      type: "recall",
      title: "Answer Recall: Consensus and Proof of Stake",
      minutes: RECALL_STEP_MINUTES,
      stageIndex: 0,
    });
    const item = entry(seedPlan(), "crypto.eth-validators/validator-note");
    expect(item).toMatchObject({ kind: "item", itemId: "validator-note", type: "output", minutes: 60 });
  });

  it("keeps weeks within each bounded stage and in order", () => {
    const plan = seedPlan();
    const index = seedIndex();
    for (const [i, stage] of seedQuest(index).stages.entries()) {
      const weeks = plan.filter((e) => e.stageIndex === i).map((e) => e.week);
      expect(weeks.length).toBeGreaterThan(0);
      expect(weeks).toEqual([...weeks].sort((a, b) => a - b));
      expect(weeks[0]).toBe(stage.weekStart);
      if (stage.weekEnd !== null) expect(Math.max(...weeks)).toBe(stage.weekEnd);
    }
    expect(plan).toHaveLength(83);
    expect(new Set(keys(plan)).size).toBe(plan.length);
  });

  it("excludes optional items and habits", () => {
    const planned = new Set(keys(seedPlan()));
    expect(planned.has("finance.institutions/optional-book")).toBe(false);
    expect(planned.has("crypto.liquid-staking/staking-insider")).toBe(false);
    expect(planned.has("crypto.infrastructure/technical-depth")).toBe(false);
    expect(planned.has("crypto.infrastructure/l2beat")).toBe(true);
  });

  it("splits a skill across stages and closes it with Recall in the last one", () => {
    const plan = seedPlan().filter((e) => e.skillId === "finance.market-intelligence");
    expect(plan.map((e) => [e.key, e.stageIndex, e.week])).toEqual([
      ["finance.market-intelligence/news-feed", 1, 7],
      ["finance.market-intelligence/staking-alert", 1, 7],
      ["finance.market-intelligence/compare-datasets", 1, 7],
      ["finance.market-intelligence/screener", 3, 12],
      ["finance.market-intelligence/chart-overlays", 3, 12],
      ["finance.market-intelligence/dashboard", 3, 12],
      ["finance.market-intelligence/narrative-engine", 3, 12],
      ["finance.market-intelligence/five-bullets", 3, 12],
      ["finance.market-intelligence#recall", 3, 12],
    ]);
  });

  it("schedules a multi-rank step as one skill, Recall after its last rank", () => {
    const plan = seedPlan().filter((e) => e.skillId === "finance.market-structure");
    expect(keys(plan).at(-1)).toBe("finance.market-structure#recall");
    expect(plan.map((e) => e.week)).toEqual([10, 10, 10, 10, 10, 10]);
    const markets = weeksByKey(seedPlan().filter((e) => e.stageIndex === 3));
    expect(markets["finance.institutions/boyle-market-making"]).toBe(11);
    expect(markets["finance.capital-formation/deal-side"]).toBe(11);
    expect(markets["finance.capital-formation/fundraising-db"]).toBe(12);
  });

  it("fills the open-ended follow-on stage at the weekly capacity", () => {
    // Follow-on is exactly 6 h: at 5 h/week it spans weeks 13–14.
    const at5h = seedPlan({}, 300).filter((e) => e.stageIndex === 4);
    expect(at5h.reduce((sum, e) => sum + e.minutes, 0)).toBe(360);
    expect(weeksByKey(at5h)).toEqual({
      "finance.regulation/eu-mica": 13,
      "finance.regulation/us": 13,
      "finance.regulation/regulation-feed": 13,
      "finance.regulation#recall": 13,
      "crypto.infrastructure/l2beat": 13,
      "crypto.infrastructure/bridges-oracles": 13,
      "crypto.infrastructure#recall": 14,
    });
    const at6h = seedPlan({}, 360).filter((e) => e.stageIndex === 4);
    expect(new Set(at6h.map((e) => e.week))).toEqual(new Set([13]));
    const at2h = seedPlan({}, 120).filter((e) => e.stageIndex === 4);
    expect(at2h.map((e) => e.week)).toEqual([13, 13, 14, 14, 14, 14, 15]);
  });

  it("does not let the weekly capacity move bounded stages", () => {
    const a = seedPlan({}, 120).filter((e) => e.stageIndex < 4);
    const b = seedPlan({}, 600).filter((e) => e.stageIndex < 4);
    expect(a.map((e) => e.week)).toEqual(b.map((e) => e.week));
  });
});

describe("buildPlan statuses and locks", () => {
  it("takes item status from the tree and leaves recall todo", () => {
    const plan = seedPlan({
      items: { "crypto.consensus/roughgarden": "done", "finance.money-settlement/mit-sessions": "skipped" },
    });
    expect(entry(plan, "crypto.consensus/roughgarden").status).toBe("done");
    expect(entry(plan, "finance.money-settlement/mit-sessions").status).toBe("skipped");
    expect(entry(plan, "crypto.consensus#recall").status).toBe("todo");
    expect(entry(plan, "crypto.eth-validators/pos-docs").status).toBe("todo");
  });

  it("clears every entry of a learned skill, whatever the route", () => {
    const plan = seedPlan({ learned: { "crypto.consensus": "completed", "crypto.eth-validators": "tested-out" } });
    for (const e of plan.filter((p) => p.skillId === "crypto.consensus" || p.skillId === "crypto.eth-validators")) {
      expect(e).toMatchObject({ status: "done", locked: false, lockReason: null });
    }
    expect(entry(plan, "finance.money-settlement/mit-sessions").status).toBe("todo");
  });

  it("never locks a skill learned before its prerequisites", () => {
    const plan = seedPlan({ learned: { "crypto.eth-validators": "tested-out" } });
    expect(entry(plan, "crypto.eth-validators/pos-docs")).toMatchObject({ status: "done", locked: false });
    expect(entry(plan, "crypto.eth-validators#recall")).toMatchObject({ status: "done", locked: false });
  });

  it("explains skill-level locks with prerequisite titles", () => {
    const plan = seedPlan();
    expect(entry(plan, "crypto.eth-validators/pos-docs")).toMatchObject({
      locked: true,
      lockReason: "Learn Consensus and Proof of Stake first",
    });
    expect(entry(plan, "crypto.ethereum-staking/pectra").lockReason).toBe(
      "Learn Ethereum Validator Economics and Staking Metrics (SR methodology) first",
    );
    // swe.web3-frontend is a starting skill, so it isn't missing.
    expect(entry(plan, "crypto.onchain-data/wsteth-tracker").lockReason).toBe(
      "Learn Ethereum Staking Today, Solana and Delegated Proof of Stake and Cosmos Hub and the Cosmos SDK first",
    );
    expect(entry(plan, "crypto.eth-validators#recall").lockReason).toBe("Learn Consensus and Proof of Stake first");
  });

  it("explains rank-level locks", () => {
    const plan = seedPlan();
    expect(entry(plan, "finance.market-intelligence/news-feed")).toMatchObject({
      locked: true,
      lockReason: "Rank 1 needs Staking Metrics (SR methodology)",
    });
    expect(entry(plan, "finance.market-intelligence/screener").lockReason).toBe(
      "Rank 2 needs Market Structure and Derivatives",
    );
    const unlocked = seedPlan({ learned: { "crypto.staking-metrics": "completed" } });
    expect(entry(unlocked, "finance.market-intelligence/news-feed")).toMatchObject({ locked: false, lockReason: null });
    expect(entry(unlocked, "finance.market-intelligence/screener").locked).toBe(true);
  });

  it("locks the recall step until the skill's items are cleared", () => {
    expect(entry(seedPlan(), "crypto.consensus#recall")).toMatchObject({
      locked: true,
      lockReason: "Finish the skill's items first",
    });
    const ready = seedPlan({ items: { "crypto.consensus/roughgarden": "skipped" } });
    expect(entry(ready, "crypto.consensus#recall")).toMatchObject({ locked: false, lockReason: null });
    // A split skill is ready only once both of its ranks are cleared.
    const bothRanks = seedPlan({
      learned: { "crypto.staking-metrics": "completed" },
      items: allItemsDone(seedIndex(), ["finance.market-intelligence"]),
    });
    expect(entry(bothRanks, "finance.market-intelligence#recall").locked).toBe(false);
    const rankOne = seedPlan({
      learned: { "crypto.staking-metrics": "completed" },
      items: {
        "finance.market-intelligence/news-feed": "done",
        "finance.market-intelligence/staking-alert": "done",
        "finance.market-intelligence/compare-datasets": "done",
      },
    });
    expect(entry(rankOne, "finance.market-intelligence#recall").lockReason).toBe("Finish the skill's items first");
  });
});

describe("buildPlan edge cases", () => {
  const skills = [
    makeSkill({
      id: "x.alpha",
      title: "Alpha",
      ranks: [
        {
          items: [
            { id: "a1", type: "do", minutes: null, title: "Try **it** in [the sandbox](https://example.com)" },
            { id: "a2", type: "read", minutes: 60, optional: true },
            { id: "a3", type: "habit", minutes: 45 },
            { id: "a4", type: null, minutes: 20 },
          ],
        },
      ],
    }),
    makeSkill({ id: "x.starter", title: "Starter", starting: true, recall: 2, ranks: [{ items: [{ id: "s1", type: "read", minutes: 30 }] }] }),
    makeSkill({ id: "x.norecall", title: "No Recall", recall: 0, ranks: [{ items: [{ id: "n1", type: "watch", minutes: 30 }] }] }),
    makeSkill({
      id: "x.beta",
      title: "Beta",
      ranks: [{ items: [{ id: "b1", type: "read", minutes: 40 }] }, { items: [{ id: "b2", type: "build", minutes: 50 }] }],
    }),
    makeSkill({ id: "x.bare", title: "Bare" }),
    makeSkill({ id: "x.zero", title: "Zero", ranks: [{ items: [{ id: "z1", type: "do", minutes: 0 }] }], recall: 0 }),
  ];
  const quest = makeQuest({
    id: "quest-edge",
    stages: [
      { name: "A", weekStart: 1, weekEnd: 2, steps: ["x.alpha", "x.ghost", "x.starter", "x.norecall", "x.beta (Rank 3)"] },
      { name: "B", weekStart: 3, weekEnd: 3, steps: ["x.beta (Rank 2)", "x.beta (Ranks 1–2)", "x.beta (Rank 1)", "x.alpha", "x.bare"] },
      { name: "C", weekStart: 4, weekEnd: 5, steps: ["x.zero"] },
      { name: "D", weekStart: 6, weekEnd: null, steps: ["x.ghost"] },
    ],
  });
  const index = makeIndex(skills, [quest]);
  const plan = buildPlan(index, quest, makeTree(index, TODAY), 300);

  it("skips unknown skills and ranks, and never repeats a scheduled rank or recall", () => {
    expect(plan.map((e) => [e.key, e.stageIndex, e.week])).toEqual([
      ["x.alpha/a1", 0, 1],
      ["x.alpha/a4", 0, 1],
      ["x.alpha#recall", 0, 1],
      ["x.starter/s1", 0, 2],
      ["x.norecall/n1", 0, 2],
      ["x.beta/b2", 1, 3],
      ["x.beta/b1", 1, 3],
      ["x.beta#recall", 1, 3],
      ["x.bare#recall", 1, 3],
      ["x.zero/z1", 2, 4],
    ]);
  });

  it("defaults missing minutes and types, and keeps inline markdown titles", () => {
    expect(entry(plan, "x.alpha/a1")).toMatchObject({
      minutes: 30,
      type: "do",
      title: "Try **it** in [the sandbox](https://example.com)",
    });
    expect(entry(plan, "x.alpha/a4")).toMatchObject({ minutes: 20, type: "do" });
  });

  it("adds no recall step for starting skills or skills without questions", () => {
    expect(entry(plan, "x.starter/s1").status).toBe("done");
    expect(plan.some((e) => e.key === "x.starter#recall" || e.key === "x.norecall#recall")).toBe(false);
  });

  it("handles empty and zero-minute stages", () => {
    const view = computeQuestView(index, "quest-edge", makeSnapshot(), makeTree(index, TODAY), TODAY);
    expect(view.stages.map((s) => [s.plannedMinutes, s.progress])).toEqual([
      [125, 30 / 125],
      [120, 0],
      [0, 0],
      [0, 0],
    ]);
  });
});

// ---------------------------------------------------------------- runs

describe("currentRun", () => {
  it("prefers the active run, then the most recently updated paused run", () => {
    const runs = [
      makeRun({ id: "other", questId: "quest-other", updatedAt: "2026-09-30T00:00:00Z" }),
      makeRun({ id: "done", status: "completed", updatedAt: "2026-09-29T00:00:00Z" }),
      makeRun({ id: "active", status: "active", updatedAt: "2026-09-22T00:00:00Z" }),
      makeRun({ id: "paused", status: "paused", updatedAt: "2026-09-25T00:00:00Z" }),
      makeRun({ id: "paused-old", status: "paused", updatedAt: "2026-09-24T00:00:00Z" }),
    ];
    expect(currentRun(makeSnapshot({ questRuns: runs }), SEED_QUEST_ID)?.id).toBe("active");
    const noActive = runs.filter((r) => r.id !== "active");
    expect(currentRun(makeSnapshot({ questRuns: noActive }), SEED_QUEST_ID)?.id).toBe("paused");
  });

  it("falls back to the latest completed run, ignoring abandoned ones", () => {
    const snapshot = makeSnapshot({
      questRuns: [
        makeRun({ id: "old", status: "completed", updatedAt: "2026-01-01T00:00:00Z" }),
        makeRun({ id: "gave-up", status: "abandoned", updatedAt: "2026-09-01T00:00:00Z" }),
        makeRun({ id: "new", status: "completed", updatedAt: "2026-06-01T00:00:00Z" }),
      ],
    });
    expect(currentRun(snapshot, SEED_QUEST_ID)?.id).toBe("new");
    expect(currentRun(makeSnapshot({ questRuns: [makeRun({ status: "abandoned" })] }), SEED_QUEST_ID)).toBeNull();
    expect(currentRun(makeSnapshot(), SEED_QUEST_ID)).toBeNull();
  });
});

// ---------------------------------------------------------------- computeQuestView

describe("computeQuestView", () => {
  it("shows a not-started quest with a plan but no week", () => {
    const view = seedView({ runs: [makeRun({ status: "abandoned" })] });
    expect(view).toMatchObject({
      questId: SEED_QUEST_ID,
      run: null,
      status: "not-started",
      currentWeek: null,
      thisWeek: null,
      paceWeeks: null,
      progress: 0,
      maintenance: { active: false, fromWeek: 13 },
    });
    expect(view.plan).toHaveLength(83);
    expect(view.nextUp?.key).toBe("crypto.consensus/roughgarden");
    expect(view.stages.some((s) => s.isCurrent)).toBe(false);
  });

  it("shows this week's slice in week 1", () => {
    const view = seedView({ runs: [makeRun()] });
    expect(view.status).toBe("active");
    expect(view.currentWeek).toBe(1);
    expect(view.thisWeek).toMatchObject({
      week: 1,
      weekStart: "2026-09-21",
      weekEnd: "2026-09-27",
      carryOver: [],
      getAhead: [],
      minutesLogged: 0,
      targetMinutes: { min: 240, max: 300 },
    });
    expect(keys(view.thisWeek?.entries ?? [])).toEqual(["crypto.consensus/roughgarden"]);
    expect(view.paceWeeks).toBe(0);
    expect(view.stages.map((s) => s.isCurrent)).toEqual([true, false, false, false, false]);
  });

  it("carries unfinished earlier weeks over", () => {
    const view = seedView({ runs: [makeRun()], today: dayOfWeek(3) });
    expect(view.currentWeek).toBe(3);
    expect(keys(view.thisWeek?.carryOver ?? [])).toEqual([
      "crypto.consensus/roughgarden",
      "crypto.consensus#recall",
      "finance.money-settlement/mit-sessions",
    ]);
    expect(keys(view.thisWeek?.entries ?? [])).toEqual([
      "finance.money-settlement#recall",
      "crypto.eth-validators/pos-docs",
      "crypto.eth-validators/eth2book",
      "crypto.eth-validators/validator-note",
      "crypto.eth-validators#recall",
    ]);
    expect(view.thisWeek?.getAhead).toEqual([]);
    expect(view.paceWeeks).toBe(-2);
  });

  it("offers get-ahead entries once this week and carry-over are cleared", () => {
    const partial = seedView({
      runs: [makeRun()],
      today: dayOfWeek(2),
      progress: { items: { "crypto.consensus/roughgarden": "done" } },
    });
    expect(partial.thisWeek?.carryOver).toEqual([]);
    expect(keys(partial.thisWeek?.entries ?? [])).toEqual([
      "crypto.consensus#recall",
      "finance.money-settlement/mit-sessions",
    ]);
    expect(partial.thisWeek?.getAhead).toEqual([]);
    expect(partial.nextUp?.key).toBe("crypto.consensus#recall");

    const cleared = seedView({
      runs: [makeRun()],
      today: dayOfWeek(2),
      progress: {
        learned: { "crypto.consensus": "completed" },
        items: { "finance.money-settlement/mit-sessions": "skipped" },
      },
    });
    expect(keys(cleared.thisWeek?.getAhead ?? [])).toEqual([
      "finance.money-settlement#recall",
      "crypto.eth-validators/pos-docs",
      "crypto.eth-validators/eth2book",
      "crypto.eth-validators/validator-note",
      "crypto.eth-validators#recall",
    ]);
    expect(cleared.paceWeeks).toBe(1);
  });

  it("measures pace ahead of and behind the plan", () => {
    const learned = Object.fromEntries(STAGE_1_SKILLS.map((id) => [id, "completed" as const]));
    const ahead = seedView({ runs: [makeRun()], progress: { learned } });
    expect(ahead.paceWeeks).toBe(3);
    expect(ahead.nextUp?.key).toBe("crypto.staking-metrics/sr-methodology");
    expect(ahead.stages[0]).toMatchObject({ plannedMinutes: 795, doneMinutes: 795, progress: 1 });
    expect(ahead.progress).toBeCloseTo(795 / 3760);

    const behind = seedView({ runs: [makeRun()], today: dayOfWeek(6), progress: { learned } });
    expect(behind.paceWeeks).toBe(-2);
    expect(behind.stages.map((s) => s.isCurrent)).toEqual([false, true, false, false, false]);
  });

  it("is never behind once everything is done", () => {
    const allLearned = Object.fromEntries(SEED_SKILLS.map((s) => [s.id, "completed" as const]));
    const early = seedView({ runs: [makeRun()], today: dayOfWeek(10), progress: { learned: allLearned } });
    expect(early.paceWeeks).toBe(5);
    expect(early.progress).toBe(1);
    expect(early.nextUp).toBeNull();
    const late = seedView({ runs: [makeRun()], today: dayOfWeek(20), progress: { learned: allLearned } });
    expect(late.paceWeeks).toBe(0);
    expect(late.stages.map((s) => s.isCurrent)).toEqual([false, false, false, false, true]);
    expect(late.thisWeek?.entries).toEqual([]);
  });

  it("marks stage steps complete by learned skill or listed ranks", () => {
    const index = seedIndex();
    const view = seedView({
      runs: [makeRun()],
      progress: {
        learned: { "crypto.consensus": "self-reported" },
        items: {
          ...allItemsDone(index, ["finance.market-structure"]),
          "finance.money-settlement/mit-sessions": "done",
          "finance.market-intelligence/news-feed": "done",
          "finance.market-intelligence/staking-alert": "done",
          "finance.market-intelligence/compare-datasets": "skipped",
        },
      },
    });
    const complete = (stage: number) => view.stages[stage].steps.map((s) => s.complete);
    // money-settlement has all items done but no Recall yet: a whole-skill step needs the skill learned.
    expect(complete(0)).toEqual([true, false, false]);
    expect(view.stages[1].steps[6]).toEqual({
      skillId: "finance.market-intelligence",
      ranks: [1],
      text: "finance.market-intelligence (Rank 1)",
      complete: true,
    });
    // (Ranks 1–2) covers the whole skill and carries its Recall step, so items alone aren't enough.
    expect(view.stages[3].steps[0]).toMatchObject({ ranks: [1, 2], complete: false });
    expect(view.stages[3].steps[3]).toMatchObject({ ranks: [2], complete: false });
    expect(view.stages[0]).toMatchObject({ doneMinutes: 300 + 15 + 240, plannedMinutes: 795 });
    expect(view.stages[1].doneMinutes).toBe(60);
  });

  it("waits at week 0 for a run that starts in the future", () => {
    const view = seedView({ runs: [makeRun({ startedOn: "2026-10-05" })] });
    expect(view.currentWeek).toBe(0);
    expect(view.status).toBe("active");
    expect(view.thisWeek).toMatchObject({ week: 0, weekStart: "2026-09-21", entries: [], carryOver: [] });
    expect(keys(view.thisWeek?.getAhead ?? [])).toEqual([
      "crypto.consensus/roughgarden",
      "crypto.consensus#recall",
      "finance.money-settlement/mit-sessions",
      "finance.money-settlement#recall",
      "crypto.eth-validators/pos-docs",
    ]);
    expect(view.paceWeeks).toBe(0);
    expect(view.stages.some((s) => s.isCurrent)).toBe(false);
    expect(view.maintenance.active).toBe(false);
  });

  it("uses the run's hours per week for capacity and target", () => {
    const view = seedView({ runs: [makeRun({ hoursPerWeek: 2 })] });
    expect(view.thisWeek?.targetMinutes).toEqual({ min: 120, max: 120 });
    expect(view.plan.filter((e) => e.stageIndex === 4).map((e) => e.week)).toEqual([13, 13, 14, 14, 14, 14, 15]);
    expect(view.plan.filter((e) => e.stageIndex === 0).map((e) => e.week)).toEqual([1, 2, 2, 3, 3, 3, 3, 3]);
  });

  it("has no target when neither run nor quest sets hours, and plans at 5 h/week", () => {
    const quest = makeQuest({ ...SEED_QUEST, hoursPerWeek: null });
    const index = makeIndex(SEED_SKILLS.map(makeSkill), [quest]);
    const view = computeQuestView(
      index,
      SEED_QUEST_ID,
      makeSnapshot({ questRuns: [makeRun()] }),
      makeTree(index, TODAY),
      TODAY,
    );
    expect(view.thisWeek?.targetMinutes).toBeNull();
    expect(view.plan.filter((e) => e.stageIndex === 4).map((e) => e.week)).toEqual([13, 13, 13, 13, 13, 13, 14]);
  });

  it("sums time logged in the current ISO week only", () => {
    const index = seedIndex();
    const today = dayOfWeek(2); // 2026-09-30, week of 09-28 … 10-04
    const snapshot = makeSnapshot({
      questRuns: [makeRun()],
      timeLogs: [
        makeTimeLog("2026-09-27", 50),
        makeTimeLog("2026-09-28", 30),
        makeTimeLog("2026-10-04", 45, { activity: "habit", questId: SEED_QUEST_ID }),
        makeTimeLog("2026-10-05", 60),
      ],
    });
    const view = computeQuestView(index, SEED_QUEST_ID, snapshot, makeTree(index, today), today);
    expect(view.thisWeek).toMatchObject({ weekStart: "2026-09-28", weekEnd: "2026-10-04", minutesLogged: 75 });
  });

  it("turns maintenance on from its start week while the run is active", () => {
    expect(seedView({ runs: [makeRun()], today: dayOfWeek(12) }).maintenance).toEqual({ active: false, fromWeek: 13 });
    expect(seedView({ runs: [makeRun()], today: dayOfWeek(13) }).maintenance).toEqual({ active: true, fromWeek: 13 });
    expect(seedView({ runs: [makeRun({ status: "paused" })], today: dayOfWeek(14) }).maintenance).toEqual({
      active: false,
      fromWeek: 13,
    });
    const always = makeQuest({ ...SEED_QUEST, maintenance: { fromWeek: null, items: [] } });
    const none = makeQuest({ ...SEED_QUEST, id: "quest-none", maintenance: null });
    const index = makeIndex(SEED_SKILLS.map(makeSkill), [always, none]);
    const snapshot = makeSnapshot({ questRuns: [makeRun(), makeRun({ id: "run-2", questId: "quest-none" })] });
    const tree = makeTree(index, TODAY);
    expect(computeQuestView(index, SEED_QUEST_ID, snapshot, tree, TODAY).maintenance).toEqual({
      active: true,
      fromWeek: null,
    });
    expect(computeQuestView(index, "quest-none", snapshot, tree, TODAY).maintenance).toEqual({
      active: false,
      fromWeek: null,
    });
  });

  it("keeps a completed run's status", () => {
    const view = seedView({ runs: [makeRun({ status: "completed" })], today: dayOfWeek(14) });
    expect(view.status).toBe("completed");
    expect(view.currentWeek).toBe(14);
    expect(view.maintenance.active).toBe(false);
  });

  it("rejects an unknown quest id", () => {
    const index = seedIndex();
    expect(() => computeQuestView(index, "quest-nope", makeSnapshot(), makeTree(index, TODAY), TODAY)).toThrow(
      /quest-nope/,
    );
  });
});

describe("computeQuestViews and activeQuestWeeks", () => {
  const second = makeQuest({ id: "quest-second", stages: [{ name: "Only", weekStart: 1, weekEnd: 1, steps: ["crypto.consensus"] }] });
  const third = makeQuest({ id: "quest-third", stages: [] });
  const index = makeIndex(SEED_SKILLS.map(makeSkill), [makeQuest(SEED_QUEST), second, third]);

  it("returns one view per quest in content order", () => {
    const snapshot = makeSnapshot({
      questRuns: [makeRun(), makeRun({ id: "run-2", questId: "quest-second", status: "paused" })],
    });
    const views = computeQuestViews(index, snapshot, makeTree(index, dayOfWeek(4)), dayOfWeek(4));
    expect(views.map((v) => [v.questId, v.status, v.currentWeek])).toEqual([
      [SEED_QUEST_ID, "active", 4],
      ["quest-second", "paused", 4],
      ["quest-third", "not-started", null],
    ]);
    expect(activeQuestWeeks(views)).toEqual({
      [SEED_QUEST_ID]: 4,
      "quest-second": null,
      "quest-third": null,
    });
  });

  it("reports week 0 for an active run that hasn't begun", () => {
    const snapshot = makeSnapshot({ questRuns: [makeRun({ startedOn: "2026-10-05" })] });
    const views = computeQuestViews(index, snapshot, makeTree(index, TODAY), TODAY);
    expect(activeQuestWeeks(views)[SEED_QUEST_ID]).toBe(0);
    expect(activeQuestWeeks([])).toEqual({});
  });
});

// ---------------------------------------------------------------- hardening (review round)

function deepFreeze<T>(value: T): T {
  if (typeof value === "object" && value !== null && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
}

describe("quest weeks are ISO weeks", () => {
  it("normalises a run that doesn't start on a Monday to its ISO week", () => {
    // Imported runs aren't forced onto a Monday; week 1 is the ISO week of startedOn.
    const thursday = makeRun({ startedOn: "2026-09-24" });
    const sameWeek = seedView({ runs: [thursday], today: "2026-09-23" });
    expect(sameWeek.currentWeek).toBe(1);
    expect(keys(sameWeek.thisWeek?.entries ?? [])).toEqual(["crypto.consensus/roughgarden"]);
    const nextMonday = seedView({ runs: [thursday], today: "2026-09-28" });
    expect(nextMonday.currentWeek).toBe(2);
    expect(nextMonday.thisWeek).toMatchObject({ week: 2, weekStart: "2026-09-28", weekEnd: "2026-10-04" });
  });

  it("turns the week over on Monday, not on Sunday", () => {
    expect(seedView({ runs: [makeRun()], today: "2026-09-27" }).currentWeek).toBe(1);
    expect(seedView({ runs: [makeRun()], today: "2026-09-28" }).currentWeek).toBe(2);
    expect(seedView({ runs: [makeRun()], today: "2026-09-20" }).currentWeek).toBe(0);
  });

  it("switches the current stage exactly at stage boundaries", () => {
    const current = (week: number) =>
      seedView({ runs: [makeRun()], today: addDays(RUN_START, (week - 1) * 7) }).stages.findIndex((s) => s.isCurrent);
    expect([3, 4, 7, 8, 9, 10, 12, 13, 40].map(current)).toEqual([0, 1, 1, 2, 2, 3, 3, 4, 4]);
  });

  it("treats an unreadable start date as no week rather than NaN", () => {
    const view = seedView({ runs: [makeRun({ startedOn: "not-a-date" })] });
    expect(view).toMatchObject({ status: "active", currentWeek: null, thisWeek: null, paceWeeks: null });
    expect(view.maintenance.active).toBe(false);
    expect(activeQuestWeeks([view])).toEqual({ [SEED_QUEST_ID]: null });
  });
});

describe("currentRun picks one run deterministically", () => {
  it("prefers the active run over a more recently touched paused one", () => {
    const snapshot = makeSnapshot({
      questRuns: [
        makeRun({ id: "paused", status: "paused", updatedAt: "2026-09-25T00:00:00Z" }),
        makeRun({ id: "active", status: "active", updatedAt: "2026-09-22T00:00:00Z" }),
      ],
    });
    expect(currentRun(snapshot, SEED_QUEST_ID)?.id).toBe("active");
    const view = computeQuestView(seedIndex(), SEED_QUEST_ID, snapshot, makeTree(seedIndex(), TODAY), TODAY);
    expect(view.status).toBe("active");
    expect(activeQuestWeeks([view])[SEED_QUEST_ID]).toBe(1);
  });

  it("breaks timestamp ties by id, whatever order the rows arrive in", () => {
    const at = "2026-09-21T08:00:00Z";
    const a = makeRun({ id: "a", status: "paused", createdAt: at, updatedAt: at });
    const b = makeRun({ id: "b", status: "paused", createdAt: at, updatedAt: at });
    expect(currentRun(makeSnapshot({ questRuns: [a, b] }), SEED_QUEST_ID)?.id).toBe("b");
    expect(currentRun(makeSnapshot({ questRuns: [b, a] }), SEED_QUEST_ID)?.id).toBe("b");
  });
});

describe("plan fidelity", () => {
  it("keeps a skipped item skipped once its skill is learned", () => {
    const plan = seedPlan({
      learned: { "finance.market-structure": "tested-out" },
      items: { "finance.market-structure/basis-trade": "skipped" },
    });
    expect(entry(plan, "finance.market-structure/basis-trade").status).toBe("skipped");
    expect(entry(plan, "finance.market-structure/perps-live").status).toBe("done");
    expect(entry(plan, "finance.market-structure#recall").status).toBe("done");
  });

  it("does not mistake prototype keys for skills or quests", () => {
    const quest = makeQuest({
      id: "quest-proto",
      stages: [{ name: "A", weekStart: 1, weekEnd: 1, steps: ["constructor", "toString", "crypto.consensus"] }],
    });
    const index = makeIndex(SEED_SKILLS.map(makeSkill), [quest]);
    const tree = makeTree(index, TODAY);
    const view = computeQuestView(index, "quest-proto", makeSnapshot(), tree, TODAY);
    expect(keys(view.plan)).toEqual(["crypto.consensus/roughgarden", "crypto.consensus#recall"]);
    expect(view.stages[0].steps.map((s) => s.complete)).toEqual([false, false, false]);
    expect(() => computeQuestView(index, "constructor", makeSnapshot(), tree, TODAY)).toThrow(/Unknown quest/);
    expect(() => computeQuestView(index, "__proto__", makeSnapshot(), tree, TODAY)).toThrow(/Unknown quest/);
  });

  it("does not mutate its inputs and is deterministic", () => {
    const index = deepFreeze(seedIndex());
    const snapshot = deepFreeze(
      makeSnapshot({
        questRuns: [makeRun({ id: "p", status: "paused" }), makeRun({ id: "c", status: "completed" }), makeRun()],
        timeLogs: [makeTimeLog(TODAY, 30)],
      }),
    );
    const tree = deepFreeze(makeTree(index, TODAY, { items: { "crypto.consensus/roughgarden": "done" } }));
    const first = computeQuestViews(index, snapshot, tree, TODAY);
    expect(computeQuestViews(index, snapshot, tree, TODAY)).toEqual(first);
    expect(first[0].plan).toHaveLength(83);
  });
});

describe("progress without planned minutes", () => {
  const quest = makeQuest({
    id: "quest-zero",
    stages: [
      { name: "Zero", weekStart: 1, weekEnd: 1, steps: ["x.zero"] },
      { name: "Known", weekStart: 2, weekEnd: 2, steps: ["x.known"] },
      { name: "Ghost", weekStart: 3, weekEnd: 3, steps: ["x.ghost"] },
    ],
  });
  const index = makeIndex(
    [
      makeSkill({ id: "x.zero", title: "Zero", recall: 0, ranks: [{ items: [{ id: "z1", type: "do", minutes: 0 }] }] }),
      makeSkill({ id: "x.known", title: "Known", starting: true }),
    ],
    [quest],
  );
  const view = (items: FixtureProgress["items"] = {}) =>
    computeQuestView(index, "quest-zero", makeSnapshot(), makeTree(index, TODAY, { items }), TODAY);

  it("counts cleared entries when every entry is zero minutes", () => {
    expect(view().stages[0].progress).toBe(0);
    expect(view().progress).toBe(0);
    expect(view({ "x.zero/z1": "done" }).stages[0].progress).toBe(1);
    expect(view({ "x.zero/z1": "done" }).progress).toBe(1);
  });

  it("shows a stage with no entries as done once its steps are complete", () => {
    // A starting skill has no ranks, so the stage plans nothing but its step is complete.
    expect(view().stages[1]).toMatchObject({ plannedMinutes: 0, progress: 1 });
    expect(view().stages[1].steps[0].complete).toBe(true);
    expect(view().stages[2]).toMatchObject({ plannedMinutes: 0, progress: 0 });
  });
});

describe("stage step completion follows the plan", () => {
  const marketsSteps = (progress: FixtureProgress) => seedView({ runs: [makeRun()], progress }).stages[3].steps;

  it("needs the skill learned for a rank-limited step that ends with its Recall", () => {
    const index = seedIndex();
    // (Ranks 1–2) covers the whole skill, so its Recall step is planned under it.
    const itemsOnly = marketsSteps({ items: allItemsDone(index, ["finance.market-structure"]) });
    expect(itemsOnly[0]).toMatchObject({ text: "finance.market-structure (Ranks 1–2)", complete: false });
    const learned = marketsSteps({ learned: { "finance.market-structure": "completed" } });
    expect(learned[0].complete).toBe(true);
    // market-intelligence Rank 2 closes the skill (Rank 1 was planned in Staking).
    const rankTwoDone = marketsSteps({ items: allItemsDone(index, ["finance.market-intelligence"]) });
    expect(rankTwoDone[3]).toMatchObject({ ranks: [2], complete: false });
  });

  it("marks a rank-limited step that doesn't close the skill complete from its ranks", () => {
    const steps = seedView({
      runs: [makeRun()],
      progress: { items: allItemsDone(seedIndex(), ["finance.market-intelligence"]) },
    }).stages[1].steps;
    expect(steps[6]).toMatchObject({ ranks: [1], complete: true });
  });
});

describe("with the real computeTreeState", () => {
  it("gives the same quest view as the fixture's stand-in tree", () => {
    const index = seedIndex();
    const today = dayOfWeek(5);
    const at = "2026-10-01T10:00:00Z";
    const learned: Record<string, LearnedVia> = {
      "crypto.consensus": "completed",
      "finance.money-settlement": "tested-out",
      "crypto.eth-validators": "completed",
    };
    const items: Record<string, StoredItemStatus> = {
      "crypto.staking-metrics/sr-methodology": "done",
      "crypto.staking-metrics/real-vs-nominal": "skipped",
      "finance.market-intelligence/news-feed": "done",
      "finance.market-structure/perps-live": "done",
    };
    const skillRows: SkillProgressRow[] = Object.entries(learned).map(([skillId, learnedVia]) => ({
      skillId,
      learnedVia,
      learnedAt: at,
      startedAt: null,
      starred: false,
    }));
    const itemRows: ItemProgressRow[] = Object.entries(items).map(([key, status]) => {
      const [skillId, itemId] = key.split("/");
      return { skillId, itemId, status, completedAt: at };
    });
    const snapshot = makeSnapshot({ questRuns: [makeRun()], skills: skillRows, items: itemRows });

    const real = computeQuestView(index, SEED_QUEST_ID, snapshot, computeTreeState(index, snapshot, today), today);
    const standIn = computeQuestView(index, SEED_QUEST_ID, snapshot, makeTree(index, today, { learned, items }), today);
    expect(real).toEqual(standIn);
    expect(real.nextUp?.key).toBe("crypto.staking-metrics#recall");
    expect(entry(real.plan, "crypto.staking-metrics/real-vs-nominal").status).toBe("skipped");
    expect(entry(real.plan, "crypto.ethereum-staking/pectra").lockReason).toBe(
      "Learn Staking Metrics (SR methodology) first",
    );
  });
});
