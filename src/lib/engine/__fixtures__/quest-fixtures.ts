// Fixtures for the quest planner tests. The seed quest mirrors
// crypto-finance-the-tie.skilltree.md (stage table, titles, requires and the
// minutes of every blocking item; quest.test.ts cross-checks them against
// the file). TreeState comes from a small stand-in for computeTreeState so
// these tests don't depend on state.ts.

import {
  indexContent,
  isStartingSkill,
  SELF_REPORTED_STATUS,
  type ContentIndex,
  type Item,
  type ItemType,
  type Quest,
  type QuestStage,
  type QuestStep,
  type Rank,
  type Skill,
} from "@/lib/content/types";
import type { ItemView, RankView, SkillState, SkillView, TreeState, XpSummary } from "@/lib/engine/types";
import {
  EMPTY_SNAPSHOT,
  type LearnedVia,
  type ProgressSnapshot,
  type QuestRunRow,
  type StoredItemStatus,
  type TimeLogRow,
} from "@/lib/progress/types";

// ---------------------------------------------------------------- content builders

export interface ItemSpec {
  id: string;
  type: ItemType | null;
  minutes: number | null;
  optional?: boolean;
  title?: string;
}

export interface RankSpec {
  number?: number;
  name?: string;
  requires?: string[];
  items: ItemSpec[];
}

export interface SkillSpec {
  id: string;
  title: string;
  requires?: string[];
  starting?: boolean;
  /** Number of Recall questions (default 3). */
  recall?: number;
  ranks?: RankSpec[];
}

export interface StageSpec {
  name: string;
  weekStart: number;
  weekEnd: number | null;
  /** As written in the table cell, e.g. "finance.market-intelligence (Rank 1)". */
  steps: string[];
}

export interface QuestSpec {
  id: string;
  title?: string;
  hoursPerWeek?: { min: number; max: number } | null;
  stages: StageSpec[];
  maintenance?: { fromWeek: number | null; items: ItemSpec[] } | null;
}

export function makeItem(ownerId: string, spec: ItemSpec): Item {
  return {
    id: spec.id,
    key: `${ownerId}/${spec.id}`,
    ownerId,
    type: spec.type,
    rawType: spec.type,
    title: spec.title ?? `Item ${spec.id}`,
    minutes: spec.minutes,
    timeText: spec.minutes === null ? null : `~${spec.minutes} min`,
    timeSensitive: false,
    optional: spec.optional ?? false,
    checked: false,
    fields: [],
    resources: [],
    do: null,
    skip: null,
    doneWhen: null,
    ifStuck: null,
    fastTrack: null,
    verify: null,
    asOf: null,
    cadence: spec.type === "habit" ? { unit: "week", times: 1, text: "weekly" } : null,
    line: 0,
  };
}

function makeRank(ownerId: string, spec: RankSpec, position: number): Rank {
  const number = spec.number ?? position + 1;
  return {
    id: `rank-${number}`,
    number,
    name: spec.name ?? null,
    requires: spec.requires ?? [],
    items: spec.items.map((it) => makeItem(ownerId, it)),
    line: 0,
  };
}

export function makeSkill(spec: SkillSpec): Skill {
  const [branchId, ...rest] = spec.id.split(".");
  const slug = rest.join(".");
  const recallCount = spec.recall ?? (spec.starting ? 0 : 3);
  return {
    id: spec.id,
    branchId,
    slug,
    title: spec.title,
    requires: spec.requires ?? [],
    related: [],
    status: spec.starting ? SELF_REPORTED_STATUS : null,
    estimate: null,
    factsAsOf: null,
    why: null,
    description: null,
    ranks: (spec.ranks ?? []).map((r, i) => makeRank(spec.id, r, i)),
    recall: Array.from({ length: recallCount }, (_, i) => ({ id: `q${i + 1}`, text: `Question ${i + 1}?`, line: 0 })),
    sources: [],
    reviewLog: null,
    sections: [],
    extraMeta: {},
    file: `content/branches/${branchId}/${slug}.md`,
    line: 0,
  };
}

/** "crypto.x", "crypto.x (Rank 1)" or "crypto.x (Ranks 1–2)". */
export function makeStep(text: string): QuestStep {
  const match = /^(\S+)(?:\s+\(Ranks?\s+(\d+)(?:\s*[–-]\s*(\d+))?\))?$/.exec(text.trim());
  if (!match) throw new Error(`Bad step "${text}"`);
  const [, skillId, from, to] = match;
  if (from === undefined) return { skillId, ranks: null, text };
  const first = Number(from);
  const last = to === undefined ? first : Number(to);
  return { skillId, ranks: Array.from({ length: last - first + 1 }, (_, i) => first + i), text };
}

function makeStage(spec: StageSpec): QuestStage {
  return {
    name: spec.name,
    weekStart: spec.weekStart,
    weekEnd: spec.weekEnd,
    steps: spec.steps.map(makeStep),
    line: 0,
  };
}

export function makeQuest(spec: QuestSpec): Quest {
  const m = spec.maintenance;
  return {
    id: spec.id,
    title: spec.title ?? spec.id,
    pace: null,
    weeks: null,
    hoursPerWeek: spec.hoursPerWeek === undefined ? { min: 4, max: 5 } : spec.hoursPerWeek,
    goal: null,
    stages: spec.stages.map(makeStage),
    maintenance: m
      ? {
          heading: "Maintenance",
          cadence: { unit: "week", times: 1, text: "weekly" },
          fromWeek: m.fromWeek,
          hoursPerWeek: 2,
          description: null,
          items: m.items.map((it) => makeItem(spec.id, it)),
          line: 0,
        }
      : null,
    reviewLog: null,
    sections: [],
    extraMeta: {},
    file: `content/quests/${spec.id.replace(/^quest-/, "")}.md`,
    line: 0,
  };
}

export function makeIndex(skills: Skill[], quests: Quest[]): ContentIndex {
  return indexContent({ branches: [], skills, quests, packs: [], diagnostics: [], shape: "tree" });
}

// ---------------------------------------------------------------- the seed quest

export const SEED_QUEST_ID = "quest-crypto-finance-the-tie";

const r = (id: string, minutes: number | null): ItemSpec => ({ id, type: "read", minutes });
const w = (id: string, minutes: number | null): ItemSpec => ({ id, type: "watch", minutes });
const d = (id: string, minutes: number | null): ItemSpec => ({ id, type: "do", minutes });
const b = (id: string, minutes: number | null): ItemSpec => ({ id, type: "build", minutes });
const o = (id: string, minutes: number | null): ItemSpec => ({ id, type: "output", minutes });
const habit = (id: string, minutes: number | null): ItemSpec => ({ id, type: "habit", minutes });
const optional = (spec: ItemSpec): ItemSpec => ({ ...spec, optional: true });

export const SEED_SKILLS: SkillSpec[] = [
  { id: "swe.react", title: "React", starting: true },
  { id: "swe.web3-frontend", title: "Web3 frontend (ethers, viem)", requires: ["swe.react"], starting: true },
  {
    id: "finance.money-settlement",
    title: "Money, Ledgers and Settlement",
    ranks: [{ items: [w("mit-sessions", 240)] }],
  },
  {
    id: "finance.market-structure",
    title: "Market Structure and Derivatives",
    requires: ["finance.money-settlement"],
    ranks: [
      {
        name: "Mechanics",
        items: [w("mit-session-17", 60), d("perps-live", 60), r("basis-trade", 45), w("options-primer", 60)],
      },
      { name: "Stress", items: [r("oct-10-crash", 45)] },
    ],
  },
  {
    id: "finance.institutions",
    title: "How Institutions Operate",
    requires: ["finance.market-structure"],
    ranks: [
      {
        items: [
          w("boyle-market-making", 60),
          r("etfs-and-treasuries", 30),
          r("money-stuff", 60),
          w("macro-context", 60),
          optional(r("optional-book", 360)),
        ],
      },
    ],
  },
  {
    id: "finance.capital-formation",
    title: "Tokenomics and Capital Formation",
    requires: ["finance.market-structure"],
    ranks: [{ items: [d("unlock-map", 30), w("deal-side", 60), d("fundraising-db", 20)] }],
  },
  {
    id: "finance.market-intelligence",
    title: "Market Intelligence with The Tie Terminal",
    ranks: [
      {
        name: "Feeds and alerts",
        requires: ["crypto.staking-metrics"],
        items: [d("news-feed", 20), d("staking-alert", 10), d("compare-datasets", 30)],
      },
      {
        name: "Research workflow",
        requires: ["finance.market-structure"],
        items: [d("screener", 20), d("chart-overlays", 45), b("dashboard", 60), d("narrative-engine", 15), o("five-bullets", 30)],
      },
    ],
  },
  {
    id: "finance.regulation",
    title: "Crypto Regulation (EU and US)",
    requires: ["finance.money-settlement"],
    ranks: [{ items: [r("eu-mica", 60), r("us", 60), d("regulation-feed", 30)] }],
  },
  {
    id: "crypto.consensus",
    title: "Consensus and Proof of Stake",
    ranks: [{ items: [w("roughgarden", 300)] }],
  },
  {
    id: "crypto.eth-validators",
    title: "Ethereum Validator Economics",
    requires: ["crypto.consensus"],
    ranks: [{ items: [r("pos-docs", 30), r("eth2book", 120), o("validator-note", 60)] }],
  },
  {
    id: "crypto.staking-metrics",
    title: "Staking Metrics (SR methodology)",
    requires: ["crypto.eth-validators"],
    ranks: [{ items: [r("sr-methodology", 90), d("real-vs-nominal", 60)] }],
  },
  {
    id: "crypto.ethereum-staking",
    title: "Ethereum Staking Today",
    requires: ["crypto.eth-validators", "crypto.staking-metrics"],
    ranks: [{ items: [r("pectra", 45), r("figment", 30), w("mev", 20), d("live-data", 60)] }],
  },
  {
    id: "crypto.solana-staking",
    title: "Solana and Delegated Proof of Stake",
    requires: ["crypto.staking-metrics"],
    ranks: [
      {
        items: [r("kiln", 45), r("inflation-debate", 60), r("value-accrual", 45), w("lightspeed", 60), d("helicon", 15)],
      },
    ],
  },
  {
    id: "crypto.cosmos-staking",
    title: "Cosmos Hub and the Cosmos SDK",
    requires: ["crypto.consensus", "crypto.staking-metrics"],
    ranks: [
      {
        items: [
          r("hub-mechanics", 30),
          r("atom-inflation", 30),
          b("pull-parameters", 60),
          r("extra-yield", 30),
          r("governance", 20),
          w("ics-explainer", 20),
        ],
      },
    ],
  },
  {
    id: "crypto.liquid-staking",
    title: "Liquid Staking and Restaking",
    requires: ["crypto.ethereum-staking"],
    ranks: [{ items: [r("lsts", 60), r("restaking", 45), optional(w("staking-insider", null))] }],
  },
  {
    id: "crypto.institutional-staking",
    title: "Institutional Staking Operations",
    requires: ["crypto.liquid-staking"],
    ranks: [{ items: [r("how-it-works", 60)] }],
  },
  {
    id: "crypto.onchain-data",
    title: "On-chain Data Engineering (staking)",
    requires: ["swe.web3-frontend", "crypto.ethereum-staking", "crypto.solana-staking", "crypto.cosmos-staking"],
    ranks: [{ items: [b("wsteth-tracker", 60), b("solana-check", 45), o("where-yield", 60)] }],
  },
  {
    id: "crypto.defi-mechanics",
    title: "DeFi Mechanics",
    requires: ["crypto.consensus"],
    ranks: [{ items: [w("finematics", 120), optional(r("optional-depth", 60))] }],
  },
  {
    id: "crypto.onchain-yield",
    title: "On-chain Yield Products",
    requires: ["crypto.defi-mechanics", "crypto.staking-metrics"],
    ranks: [{ items: [r("morpho", 30), r("pendle", 30), r("ethena", 30), r("stablecoins", 45), d("high-yield-pools", 45)] }],
  },
  {
    id: "crypto.defi-risk",
    title: "DeFi Risk",
    requires: ["crypto.onchain-yield", "crypto.liquid-staking"],
    ranks: [
      { items: [r("stream-finance", 60), d("rekt-triage", 45), b("dune-dashboard", 60), d("audit-position", 30), o("risk-checklist", 30)] },
    ],
  },
  {
    id: "crypto.infrastructure",
    title: "Chains and Infrastructure",
    requires: ["crypto.consensus"],
    ranks: [
      { items: [d("l2beat", 60), r("bridges-oracles", 120), habit("technical-depth", null), habit("annual-reports", null)] },
    ],
  },
];

export const SEED_QUEST: QuestSpec = {
  id: SEED_QUEST_ID,
  title: "Crypto & Finance for The Tie",
  hoursPerWeek: { min: 4, max: 5 },
  stages: [
    {
      name: "Foundations",
      weekStart: 1,
      weekEnd: 3,
      steps: ["crypto.consensus", "finance.money-settlement", "crypto.eth-validators"],
    },
    {
      name: "Staking",
      weekStart: 4,
      weekEnd: 7,
      steps: [
        "crypto.staking-metrics",
        "crypto.ethereum-staking",
        "crypto.solana-staking",
        "crypto.cosmos-staking",
        "crypto.liquid-staking",
        "crypto.institutional-staking",
        "finance.market-intelligence (Rank 1)",
        "crypto.onchain-data",
      ],
    },
    {
      name: "DeFi",
      weekStart: 8,
      weekEnd: 9,
      steps: ["crypto.defi-mechanics", "crypto.onchain-yield", "crypto.defi-risk"],
    },
    {
      name: "Markets",
      weekStart: 10,
      weekEnd: 12,
      steps: [
        "finance.market-structure (Ranks 1–2)",
        "finance.institutions",
        "finance.capital-formation",
        "finance.market-intelligence (Rank 2)",
      ],
    },
    { name: "Follow-on", weekStart: 13, weekEnd: null, steps: ["finance.regulation", "crypto.infrastructure"] },
  ],
  maintenance: {
    fromWeek: 13,
    items: [habit("unchained-weekly", 45), habit("bankless-episode", 60), habit("sr-journal", 15)],
  },
};

export function seedIndex(): ContentIndex {
  return makeIndex(SEED_SKILLS.map(makeSkill), [makeQuest(SEED_QUEST)]);
}

// ---------------------------------------------------------------- tree state

export interface FixtureProgress {
  /** skillId → how it was learned. Starting skills are self-reported by default. */
  learned?: Record<string, LearnedVia>;
  /** item key → stored status; absent = todo. */
  items?: Record<string, StoredItemStatus>;
}

const EMPTY_XP: XpSummary = {
  total: 0,
  level: 1,
  levelFloor: 0,
  nextLevelAt: 100,
  progressToNext: 0,
  byActivity: {},
  recallBonus: 0,
  minutesTotal: 0,
  thisWeekMinutes: 0,
  weeklyStreak: 0,
  weeks: [],
};

/**
 * A plausible TreeState following state.ts's rules: skill/rank locks from
 * unlearned known requires (never on a learned skill), rank completion from
 * blocking items, readyToComplete when unlocked with every rank complete.
 * quest.test.ts checks it against computeTreeState on the seed.
 */
export function makeTree(index: ContentIndex, today: string, progress: FixtureProgress = {}): TreeState {
  const learnedVia = (skill: Skill): LearnedVia | null =>
    progress.learned?.[skill.id] ?? (isStartingSkill(skill) ? "self-reported" : null);
  const isLearned = (id: string): boolean => {
    const skill = index.skills[id];
    return skill !== undefined && learnedVia(skill) !== null;
  };
  const unlearned = (ids: string[]): string[] => ids.filter((id) => Object.hasOwn(index.skills, id) && !isLearned(id));

  const items: Record<string, ItemView> = {};
  const skills: Record<string, SkillView> = {};
  for (const skill of index.tree.skills) {
    const via = learnedVia(skill);
    const learned = via !== null;
    const ranks: RankView[] = skill.ranks.map((rank) => {
      const blocking = rank.items.filter((it) => !it.optional && it.type !== "habit");
      const cleared = blocking.filter((it) => progress.items?.[it.key] !== undefined);
      for (const it of rank.items) items[it.key] = itemView(it, progress.items?.[it.key], today);
      const missingRequires = unlearned(rank.requires);
      return {
        id: rank.id,
        number: rank.number,
        name: rank.name,
        locked: !learned && missingRequires.length > 0,
        missingRequires,
        complete: learned || cleared.length === blocking.length,
        doneCount: cleared.length,
        blockingCount: blocking.length,
        progress: learned ? 1 : blocking.length > 0 ? cleared.length / blocking.length : 1,
      };
    });
    const missingRequires = unlearned(skill.requires);
    const locked = !learned && missingRequires.length > 0;
    const started = skill.ranks.some((rank) => rank.items.some((it) => progress.items?.[it.key] !== undefined));
    const ranksComplete = ranks.filter((rv) => rv.complete).length;
    skills[skill.id] = {
      id: skill.id,
      state: skillState(via, locked, started),
      learned,
      learnedVia: via,
      learnedAt: learned ? `${today}T12:00:00Z` : null,
      isStarting: isStartingSkill(skill),
      starred: false,
      locked,
      missingRequires,
      ranks,
      ranksComplete,
      progress: learned ? 1 : ranks.length > 0 ? ranksComplete / ranks.length : 0,
      readyToComplete: !learned && !locked && ranks.length > 0 && ranks.every((rv) => rv.complete),
      canTestOut: !locked && !learned && skill.recall.length > 0,
      rust: { stale: [], failedReview: false, isRusty: false, nextStaleOn: null },
      minutesLogged: 0,
      xp: 0,
      lastActivityAt: null,
      lastTestOut: null,
      noteCount: 0,
      outputCount: 0,
    };
  }
  return { today, skills, items, branches: {}, xp: EMPTY_XP };
}

function skillState(via: LearnedVia | null, locked: boolean, started: boolean): SkillState {
  if (via === "tested-out") return "tested-out";
  if (via === "self-reported") return "self-reported";
  if (via === "completed") return "learned";
  if (locked) return "locked";
  return started ? "in-progress" : "available";
}

function itemView(item: Item, status: StoredItemStatus | undefined, today: string): ItemView {
  return {
    key: item.key,
    ownerId: item.ownerId,
    itemId: item.id,
    status: status ?? "todo",
    completedAt: status ? `${today}T12:00:00Z` : null,
    minutesLogged: 0,
    blocking: !item.optional && item.type !== "habit",
    asOf: null,
    lastVerifiedAt: null,
    staleOn: null,
    stale: false,
    noteCount: 0,
    outputCount: 0,
  };
}

/** Marks every blocking item of these skills done (handy for "finished the stage"). */
export function allItemsDone(index: ContentIndex, skillIds: string[]): Record<string, StoredItemStatus> {
  const done: Record<string, StoredItemStatus> = {};
  for (const id of skillIds) {
    for (const rank of index.skills[id]?.ranks ?? []) {
      for (const it of rank.items) if (!it.optional && it.type !== "habit") done[it.key] = "done";
    }
  }
  return done;
}

// ---------------------------------------------------------------- progress rows

/** Monday of week 1 in most tests (2026-09-21). */
export const RUN_START = "2026-09-21";

export function makeRun(spec: Partial<QuestRunRow> = {}): QuestRunRow {
  return {
    id: "run-1",
    questId: SEED_QUEST_ID,
    status: "active",
    startedOn: RUN_START,
    hoursPerWeek: null,
    forkedFrom: null,
    definition: null,
    createdAt: "2026-09-21T08:00:00Z",
    updatedAt: "2026-09-21T08:00:00Z",
    ...spec,
  };
}

export function makeTimeLog(loggedOn: string, minutes: number, spec: Partial<TimeLogRow> = {}): TimeLogRow {
  return {
    id: `log-${loggedOn}-${minutes}`,
    skillId: null,
    itemId: null,
    questId: null,
    habitKey: null,
    activity: "read",
    minutes,
    loggedOn,
    note: null,
    createdAt: `${loggedOn}T12:00:00Z`,
    ...spec,
  };
}

export function makeSnapshot(parts: Partial<ProgressSnapshot> = {}): ProgressSnapshot {
  return { ...EMPTY_SNAPSHOT, ...parts };
}
