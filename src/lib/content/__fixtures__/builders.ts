// Hand-built content ASTs for tests. Every builder returns a node that passes
// the validator on its own (no errors, no warnings), so a test can break one
// thing at a time. Ids and lines come from a counter so items never collide.

import {
  SELF_REPORTED_STATUS,
  type Branch,
  type Cadence,
  type ContentTree,
  type Item,
  type Maintenance,
  type Pack,
  type Quest,
  type QuestStage,
  type QuestStep,
  type Rank,
  type RecallQuestion,
  type Resource,
  type Skill,
} from "@/lib/content/types";

let seq = 0;
function next(): number {
  seq += 1;
  return seq;
}

/** 60 characters: comfortably above MIN_TEXT_LENGTH. */
export const LONG_WHY = "SR's formula covers every chain it tracks, so this pays off.";
export const LONG_DONE_WHEN = "I can compute the reward rate by hand and match SR's figure.";

export const MONTHLY: Cadence = { unit: "month", times: 1, text: "monthly" };
export const WEEKLY: Cadence = { unit: "week", times: 1, text: "weekly" };

export function item(overrides: Partial<Item> = {}): Item {
  const n = next();
  const type = overrides.type === undefined ? "do" : overrides.type;
  return {
    id: `item-${n}`,
    key: "",
    ownerId: "",
    type,
    rawType: type,
    title: `Item number ${n}`,
    minutes: 60,
    timeText: "~1 h",
    timeSensitive: false,
    optional: false,
    checked: false,
    fields: [],
    resources: [],
    do: null,
    skip: null,
    doneWhen: LONG_DONE_WHEN,
    ifStuck: type === "build" ? "Start from a smaller version of the task." : null,
    fastTrack: null,
    verify: null,
    asOf: null,
    cadence: type === "habit" ? MONTHLY : null,
    line: 1000 + n,
    ...overrides,
  };
}

export function habit(overrides: Partial<Item> = {}): Item {
  return item({ type: "habit", minutes: 30, timeText: "~30 min", doneWhen: null, ...overrides });
}

export function resource(type: string, title = `${type} link`, url = `https://example.com/${type}`): Resource {
  return { type, title, url, field: "Resource" };
}

export function rank(number: number, items: Item[] = [item()], overrides: Partial<Rank> = {}): Rank {
  return {
    id: `rank-${number}`,
    number,
    name: null,
    requires: [],
    items,
    line: 100 + number * 10,
    ...overrides,
  };
}

export function recall(count: number, withIds = true): RecallQuestion[] {
  return Array.from({ length: count }, (_, i) => ({
    id: withIds ? `q${i + 1}` : "",
    text: `Recall question ${i + 1}?`,
    line: 500 + i,
  }));
}

function own(items: Item[], ownerId: string): Item[] {
  return items.map((it) => (it.ownerId ? it : { ...it, ownerId, key: `${ownerId}/${it.id}` }));
}

function splitId(id: string): { branchId: string; slug: string } {
  const dot = id.indexOf(".");
  return dot < 0 ? { branchId: "", slug: id } : { branchId: id.slice(0, dot), slug: id.slice(dot + 1) };
}

export function skill(id: string, overrides: Partial<Skill> = {}): Skill {
  const { branchId, slug } = splitId(id);
  const base: Skill = {
    id,
    branchId,
    slug,
    title: `Skill ${id}`,
    requires: [],
    related: [],
    status: null,
    estimate: { text: "~1 h", hours: 1, optionalHours: null },
    factsAsOf: null,
    why: LONG_WHY,
    description: null,
    ranks: [rank(1)],
    recall: recall(3),
    sources: [],
    reviewLog: null,
    sections: [],
    extraMeta: {},
    file: `content/branches/${branchId}/${slug}.md`,
    line: 1,
    ...overrides,
  };
  return { ...base, ranks: base.ranks.map((r) => ({ ...r, items: own(r.items, id) })) };
}

/** A starting skill: learned (self-reported), with nothing but the required metadata. */
export function startingSkill(id: string, overrides: Partial<Skill> = {}): Skill {
  return skill(id, {
    status: SELF_REPORTED_STATUS,
    estimate: null,
    why: null,
    ranks: [],
    recall: [],
    ...overrides,
  });
}

export function branch(id: string, overrides: Partial<Branch> = {}): Branch {
  return {
    id,
    title: `Branch ${id}`,
    note: null,
    description: null,
    color: null,
    order: null,
    skillIds: [],
    extraMeta: {},
    file: `content/branches/${id}/_branch.md`,
    line: 1,
    ...overrides,
  };
}

export function step(skillId: string, ranks: number[] | null = null): QuestStep {
  const text = ranks === null ? skillId : `${skillId} (${ranks.length === 1 ? "Rank" : "Ranks"} ${ranks.join("–")})`;
  return { skillId, ranks, text };
}

export function stage(name: string, steps: QuestStep[], overrides: Partial<QuestStage> = {}): QuestStage {
  return { name, weekStart: 1, weekEnd: 1, steps, line: 20 + next(), ...overrides };
}

export function maintenance(items: Item[], overrides: Partial<Maintenance> = {}): Maintenance {
  return {
    heading: "Maintenance (weekly, from week 13, ~2 h/week)",
    cadence: WEEKLY,
    fromWeek: 13,
    hoursPerWeek: 2,
    description: null,
    items,
    line: 40,
    ...overrides,
  };
}

export function quest(id: string, overrides: Partial<Quest> = {}): Quest {
  const base: Quest = {
    id,
    title: `Quest ${id}`,
    pace: null,
    weeks: null,
    hoursPerWeek: null,
    goal: null,
    stages: [],
    maintenance: null,
    reviewLog: null,
    sections: [],
    extraMeta: {},
    file: `content/quests/${id.replace(/^quest-/, "")}.md`,
    line: 1,
    ...overrides,
  };
  const m = base.maintenance;
  return m === null ? base : { ...base, maintenance: { ...m, items: own(m.items, id) } };
}

export function pack(overrides: Partial<Pack> = {}): Pack {
  return {
    id: "seed",
    title: "Seed",
    frontmatter: {},
    factsAsOf: null,
    body: "",
    file: "seed.skilltree.md",
    ...overrides,
  };
}

export function tree(parts: Partial<ContentTree> = {}): ContentTree {
  return { branches: [], skills: [], quests: [], packs: [], diagnostics: [], shape: "tree", ...parts };
}

/**
 * A valid tree: one branch `b` with three skills. `replace` swaps in skills by
 * id (or adds them); every distinct branchId gets a branch so none is unresolved.
 */
export function validTree(replace: Skill[] = [], parts: Partial<ContentTree> = {}): ContentTree {
  const skills = [skill("b.one"), skill("b.two"), skill("b.three")];
  for (const s of replace) {
    const i = skills.findIndex((x) => x.id === s.id);
    if (i >= 0) skills[i] = s;
    else skills.push(s);
  }
  const branchIds = [...new Set(skills.map((s) => s.branchId))];
  const branches = branchIds.map((id) => branch(id, { skillIds: skills.filter((s) => s.branchId === id).map((s) => s.id) }));
  return tree({ branches, skills, ...parts });
}

/** Rewrites every file path to the one bundle file, as the bundle parser does. */
export function asBundle(t: ContentTree, file = "seed.skilltree.md"): ContentTree {
  return {
    ...t,
    shape: "bundle",
    skills: t.skills.map((s) => ({ ...s, file })),
    branches: t.branches.map((b) => ({ ...b, file })),
    quests: t.quests.map((q) => ({ ...q, file })),
  };
}
