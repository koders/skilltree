// Hand-built content and progress builders for engine tests. Every builder
// fills the full AST/row shape with neutral defaults so tests only spell out
// what they are about.

import {
  indexContent,
  SELF_REPORTED_STATUS,
  type Branch,
  type Cadence,
  type ContentIndex,
  type ContentTree,
  type Item,
  type Maintenance,
  type Quest,
  type Rank,
  type Skill,
} from "@/lib/content/types";
import {
  EMPTY_SNAPSHOT,
  type Activity,
  type HabitLogRow,
  type ItemProgressRow,
  type LearnedVia,
  type NoteKind,
  type NoteRow,
  type ProgressSnapshot,
  type RecallAttemptRow,
  type RecallMode,
  type RecallResult,
  type SkillProgressRow,
  type StoredItemStatus,
  type TimeLogRow,
  type VerificationRow,
} from "@/lib/progress/types";

// ---------------------------------------------------------------- content

export type ItemSpec = { id: string } & Partial<Omit<Item, "id" | "key" | "ownerId">>;

export function makeItem(ownerId: string, spec: ItemSpec): Item {
  const type = spec.type === undefined ? "read" : spec.type;
  return {
    key: `${ownerId}/${spec.id}`,
    ownerId,
    type,
    rawType: type,
    title: spec.id,
    minutes: 30,
    timeText: "~30 min",
    timeSensitive: false,
    optional: false,
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
    cadence: null,
    line: 0,
    ...spec,
  };
}

export interface RankSpec {
  name?: string | null;
  requires?: string[];
  items: ItemSpec[];
}

export function makeRank(ownerId: string, number: number, spec: RankSpec): Rank {
  return {
    id: `rank-${number}`,
    number,
    name: spec.name ?? null,
    requires: spec.requires ?? [],
    items: spec.items.map((it) => makeItem(ownerId, it)),
    line: 0,
  };
}

export interface SkillSpec {
  /** `branch.slug` */
  id: string;
  title?: string;
  requires?: string[];
  ranks?: RankSpec[];
  /** Recall question ids, e.g. ["q1", "q2", "q3"]. */
  recall?: string[];
  starting?: boolean;
  factsAsOf?: string | null;
}

export function makeSkill(spec: SkillSpec): Skill {
  const [branchId, ...rest] = spec.id.split(".");
  return {
    id: spec.id,
    branchId,
    slug: rest.join("."),
    title: spec.title ?? spec.id,
    requires: spec.requires ?? [],
    related: [],
    status: spec.starting ? SELF_REPORTED_STATUS : null,
    estimate: null,
    factsAsOf: spec.factsAsOf ?? null,
    why: null,
    description: null,
    ranks: (spec.ranks ?? []).map((r, i) => makeRank(spec.id, i + 1, r)),
    recall: (spec.recall ?? []).map((id, i) => ({ id, text: `Question ${id}?`, line: i })),
    sources: [],
    reviewLog: null,
    sections: [],
    extraMeta: {},
    file: `content/branches/${branchId}/${rest.join(".")}.md`,
    line: 0,
  };
}

export function makeBranch(id: string, skillIds: string[], title: string = id): Branch {
  return {
    id,
    title,
    note: null,
    description: null,
    color: null,
    order: null,
    skillIds,
    extraMeta: {},
    file: `content/branches/${id}/_branch.md`,
    line: 0,
  };
}

export interface QuestSpec {
  id: string;
  title?: string;
  maintenance?: {
    fromWeek?: number | null;
    cadence?: Cadence | null;
    items: ItemSpec[];
  };
}

export function makeQuest(spec: QuestSpec): Quest {
  const m = spec.maintenance;
  const maintenance: Maintenance | null = m
    ? {
        heading: "Maintenance",
        cadence: m.cadence ?? null,
        fromWeek: m.fromWeek ?? null,
        hoursPerWeek: null,
        description: null,
        items: m.items.map((it) => makeItem(spec.id, { type: "habit", ...it })),
        line: 0,
      }
    : null;
  return {
    id: spec.id,
    title: spec.title ?? spec.id,
    pace: null,
    weeks: null,
    hoursPerWeek: null,
    goal: null,
    stages: [],
    maintenance,
    reviewLog: null,
    sections: [],
    extraMeta: {},
    file: `content/quests/${spec.id}.md`,
    line: 0,
  };
}

/** Branches default to one per skill-id prefix, in first-seen order. */
export function makeIndex(input: {
  skills: Skill[];
  branches?: Branch[];
  quests?: Quest[];
}): ContentIndex {
  const branches = input.branches ?? inferBranches(input.skills);
  const tree: ContentTree = {
    branches,
    skills: input.skills,
    quests: input.quests ?? [],
    packs: [],
    diagnostics: [],
    shape: "tree",
  };
  return indexContent(tree);
}

function inferBranches(skills: Skill[]): Branch[] {
  const ids = new Map<string, string[]>();
  for (const s of skills) ids.set(s.branchId, [...(ids.get(s.branchId) ?? []), s.id]);
  return [...ids].map(([id, skillIds]) => makeBranch(id, skillIds));
}

// ---------------------------------------------------------------- the sample tree
//
//  alpha (a)                         beta (b)
//  a.start (self-reported) ───────▶ b.bridge
//  a.basics ──▶ a.advanced           b.bridge + a.basics ──▶ b.deep
//  a.basics rank 2 requires b.bridge b.empty (no ranks, no recall)
//
export const SAMPLE_FACTS_AS_OF = "2026-06-01";

export function sampleSkills(): Skill[] {
  return [
    makeSkill({ id: "a.start", title: "Start", starting: true, recall: ["q1", "q2", "q3"] }),
    makeSkill({
      id: "a.basics",
      title: "Basics",
      factsAsOf: SAMPLE_FACTS_AS_OF,
      recall: ["q1", "q2", "q3"],
      ranks: [
        {
          items: [
            { id: "read-intro", type: "read", minutes: 60 },
            { id: "do-exercise", type: "do", minutes: 30 },
            { id: "opt-book", type: "read", minutes: 120, optional: true },
            {
              id: "monthly-check",
              type: "habit",
              minutes: 15,
              cadence: { unit: "month", times: 1, text: "monthly" },
            },
          ],
        },
        {
          requires: ["b.bridge"],
          items: [
            { id: "ts-fact", type: "read", minutes: 30, timeSensitive: true },
            { id: "ts-override", type: "read", minutes: 20, timeSensitive: true, asOf: "2026-09-01" },
          ],
        },
      ],
    }),
    makeSkill({
      id: "a.advanced",
      title: "Advanced",
      requires: ["a.basics"],
      recall: ["q1", "q2", "q3"],
      ranks: [
        {
          items: [
            { id: "build-thing", type: "build", minutes: 90 },
            { id: "quick-read", type: "read", minutes: null },
          ],
        },
      ],
    }),
    makeSkill({
      id: "b.bridge",
      title: "Bridge",
      requires: ["a.start"],
      recall: ["q1", "q2", "q3"],
      ranks: [{ items: [{ id: "watch-talk", type: "watch", minutes: 45 }] }],
    }),
    makeSkill({
      id: "b.deep",
      title: "Deep",
      requires: ["b.bridge", "a.basics"],
      ranks: [{ items: [{ id: "output-note", type: "output", minutes: 60 }] }],
    }),
    makeSkill({ id: "b.empty", title: "Empty" }),
  ];
}

export function sampleQuests(): Quest[] {
  return [
    makeQuest({
      id: "quest-main",
      maintenance: {
        fromWeek: 3,
        cadence: { unit: "week", times: 1, text: "weekly" },
        items: [
          { id: "weekly-pod", minutes: 45 },
          { id: "twice-week", minutes: 10, cadence: { unit: "week", times: 2, text: "2× week" } },
        ],
      },
    }),
    makeQuest({
      id: "quest-side",
      maintenance: {
        fromWeek: null,
        cadence: null,
        items: [{ id: "yearly-report", minutes: 60, cadence: { unit: "year", times: 1, text: "yearly" } }, { id: "no-cadence" }],
      },
    }),
  ];
}

export function sampleIndex(): ContentIndex {
  return makeIndex({ skills: sampleSkills(), quests: sampleQuests() });
}

// ---------------------------------------------------------------- progress rows

let seq = 0;
function nextId(prefix: string): string {
  seq += 1;
  return `${prefix}-${seq}`;
}

export function makeSnapshot(partial: Partial<ProgressSnapshot> = {}): ProgressSnapshot {
  return { ...EMPTY_SNAPSHOT, ...partial };
}

export function itemRow(
  skillId: string,
  itemId: string,
  completedAt = "2026-09-01T10:00:00Z",
  status: StoredItemStatus = "done",
): ItemProgressRow {
  return { skillId, itemId, status, completedAt };
}

export function skillRow(skillId: string, partial: Partial<Omit<SkillProgressRow, "skillId">> = {}): SkillProgressRow {
  return { skillId, learnedVia: null, learnedAt: null, startedAt: null, starred: false, ...partial };
}

export function learnedRow(skillId: string, via: LearnedVia, learnedAt: string | null = "2026-09-01T10:00:00Z"): SkillProgressRow {
  return skillRow(skillId, { learnedVia: via, learnedAt });
}

export function timeLog(partial: Partial<TimeLogRow> & { minutes: number; loggedOn: string }): TimeLogRow {
  const activity: Activity = partial.activity ?? "read";
  return {
    id: nextId("log"),
    skillId: null,
    itemId: null,
    questId: null,
    habitKey: null,
    note: null,
    createdAt: `${partial.loggedOn}T09:00:00Z`,
    ...partial,
    activity,
  };
}

export function attempt(
  skillId: string,
  questionId: string,
  result: RecallResult,
  opts: { mode?: RecallMode; sessionId?: string; createdAt?: string } = {},
): RecallAttemptRow {
  return {
    id: nextId("att"),
    skillId,
    questionId,
    mode: opts.mode ?? "test-out",
    sessionId: opts.sessionId ?? "s1",
    result,
    answer: null,
    source: "app",
    createdAt: opts.createdAt ?? "2026-09-01T10:00:00Z",
  };
}

/** One test-out session answering every listed question. */
export function testOutSession(
  skillId: string,
  questionIds: string[],
  opts: { sessionId?: string; createdAt?: string; failed?: string[] } = {},
): RecallAttemptRow[] {
  return questionIds.map((q) =>
    attempt(skillId, q, opts.failed?.includes(q) ? "fail" : "pass", {
      mode: "test-out",
      sessionId: opts.sessionId ?? `test-out-${skillId}`,
      createdAt: opts.createdAt,
    }),
  );
}

export function verification(skillId: string, itemId: string, verifiedAt: string, changed = false): VerificationRow {
  return { id: nextId("ver"), skillId, itemId, verifiedAt, changed, note: null };
}

export function note(
  partial: Partial<NoteRow> & { kind?: NoteKind },
): NoteRow {
  return {
    id: nextId("note"),
    skillId: null,
    itemId: null,
    questId: null,
    kind: "note",
    title: null,
    body: "",
    url: null,
    createdAt: "2026-09-01T10:00:00Z",
    updatedAt: "2026-09-01T10:00:00Z",
    ...partial,
  };
}

export function habitLog(habitKey: string, periodStart: string, doneOn: string = periodStart): HabitLogRow {
  return {
    id: nextId("habit"),
    habitKey,
    periodStart,
    doneOn,
    minutes: null,
    note: null,
    createdAt: `${doneOn}T09:00:00Z`,
  };
}
