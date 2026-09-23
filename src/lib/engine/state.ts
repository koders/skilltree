// Derived tree state: node states, ranks, item views, branch rollups and XP
// (docs/decisions.md D3, D6; guide §7). Pure: (content, progress, today) in,
// TreeState out. Progress rows for skills that aren't in content are left out
// of skills, items and branches, but their time and Recall passes still count
// in the XP summary: they're facts, and a content edit must not rewrite them.

import { isStartingSkill, type ContentIndex, type Item, type Rank, type Skill } from "@/lib/content/types";
import { computeFreshness, computeRust, type ItemFreshness } from "@/lib/engine/rust";
import {
  LEARNED_STATES,
  type BranchView,
  type ItemView,
  type RankView,
  type SkillState,
  type SkillView,
  type TreeState,
} from "@/lib/engine/types";
import { computeXp, recallBonusFor, xpForLog } from "@/lib/engine/xp";
import type {
  ItemProgressRow,
  ItemStatus,
  LearnedVia,
  NoteRow,
  ProgressSnapshot,
  RecallAttemptRow,
  SkillProgressRow,
  TimeLogRow,
  VerificationRow,
} from "@/lib/progress/types";

/** Minutes assumed for an item without a usable estimate when weighting rank progress. */
const DEFAULT_ITEM_MINUTES = 30;

export function isLearnedState(state: SkillState): boolean {
  return LEARNED_STATES.includes(state);
}

export function computeTreeState(index: ContentIndex, snapshot: ProgressSnapshot, today: string): TreeState {
  const rows = knownRows(index, snapshot);
  const progress = indexProgress(rows, (id) => Object.hasOwn(index.skills, id));
  const learned = new Map<string, Learned>();
  for (const skill of Object.values(index.skills)) {
    learned.set(skill.id, resolveLearned(skill, progress.skillRows.get(skill.id)));
  }
  const isLearned = (id: string) => learned.get(id)?.learned ?? false;
  const hasSkill = (id: string) => Object.hasOwn(index.skills, id);
  const unlearned = (ids: string[]) => ids.filter((id) => hasSkill(id) && !isLearned(id));

  const items: Record<string, ItemView> = {};
  const skills: Record<string, SkillView> = {};
  for (const skill of Object.values(index.skills)) {
    const info = learned.get(skill.id) ?? NOT_LEARNED;
    const view = buildSkillView(skill, info, progress, unlearned, today);
    skills[skill.id] = view.skill;
    for (const item of view.items) items[item.key] = item;
  }
  for (const quest of Object.values(index.quests)) {
    const maintenance = quest.maintenance?.items ?? [];
    const verifications = progress.verificationsBySkill.get(quest.id) ?? [];
    const freshness = computeFreshness(quest.id, maintenance, null, verifications, today);
    for (const item of maintenance) {
      items[item.key] = questItemView(quest.id, item, progress, freshness[item.id]);
    }
  }

  return {
    today,
    skills,
    items,
    branches: buildBranchViews(index, skills),
    xp: computeXp(snapshot, today),
  };
}

// ---------------------------------------------------------------- progress lookups

interface ProgressIndex {
  skillRows: Map<string, SkillProgressRow>;
  /** Keyed by item key `${skillId}/${itemId}`. */
  itemRows: Map<string, ItemProgressRow>;
  logsBySkill: Map<string, TimeLogRow[]>;
  /** Minutes per item key (skill items and habit keys). */
  minutesByItem: Map<string, number>;
  notesBySkill: Map<string, NoteRow[]>;
  /** Keyed by item key `${skillId|questId}/${itemId}`. */
  notesByItem: Map<string, NoteRow[]>;
  attemptsBySkill: Map<string, RecallAttemptRow[]>;
  /** Keyed by owner: a skill id, or a quest id for maintenance items. */
  verificationsBySkill: Map<string, VerificationRow[]>;
}

function knownRows(index: ContentIndex, s: ProgressSnapshot): ProgressSnapshot {
  const known = (id: string) => Object.hasOwn(index.skills, id);
  const knownOrNone = (id: string | null) => id === null || known(id);
  // Verifications of quest maintenance items carry the quest id in skillId.
  const knownOwner = (id: string) => known(id) || Object.hasOwn(index.quests, id);
  return {
    ...s,
    items: s.items.filter((r) => known(r.skillId)),
    skills: s.skills.filter((r) => known(r.skillId)),
    timeLogs: s.timeLogs.filter((r) => knownOrNone(r.skillId)),
    notes: s.notes.filter((r) => knownOrNone(r.skillId)),
    recallAttempts: s.recallAttempts.filter((r) => known(r.skillId)),
    recallCards: s.recallCards.filter((r) => known(r.skillId)),
    verifications: s.verifications.filter((r) => knownOwner(r.skillId)),
  };
}

function indexProgress(s: ProgressSnapshot, isSkill: (id: string) => boolean): ProgressIndex {
  const minutesByItem = new Map<string, number>();
  for (const log of s.timeLogs) {
    const minutes = Number.isFinite(log.minutes) && log.minutes > 0 ? log.minutes : 0;
    for (const key of logItemKeys(log)) minutesByItem.set(key, (minutesByItem.get(key) ?? 0) + minutes);
  }
  const notesByItem = new Map<string, NoteRow[]>();
  for (const n of s.notes) {
    const owner = n.skillId ?? n.questId;
    if (owner !== null && n.itemId !== null) push(notesByItem, `${owner}/${n.itemId}`, n);
  }
  return {
    skillRows: new Map(s.skills.map((r) => [r.skillId, r])),
    itemRows: new Map(s.items.map((r) => [`${r.skillId}/${r.itemId}`, r])),
    logsBySkill: groupBy(s.timeLogs, (r) => logSkillId(r, isSkill)),
    minutesByItem,
    notesBySkill: groupBy(s.notes, (r) => r.skillId),
    notesByItem,
    attemptsBySkill: groupBy(s.recallAttempts, (r) => r.skillId),
    verificationsBySkill: groupBy(s.verifications, (r) => r.skillId),
  };
}

/**
 * The skill a time log belongs to. Habit time is written with only a habit key
 * (`${ownerId}/${itemId}`), so a skill's own habits are found by that owner.
 */
function logSkillId(log: TimeLogRow, isSkill: (id: string) => boolean): string | null {
  if (log.skillId !== null) return log.skillId;
  if (log.habitKey === null) return null;
  const slash = log.habitKey.indexOf("/");
  const owner = slash > 0 ? log.habitKey.slice(0, slash) : null;
  return owner !== null && isSkill(owner) ? owner : null;
}

/** The item keys a time log counts toward; a set so a habit log naming both routes counts once. */
function logItemKeys(log: TimeLogRow): Set<string> {
  const keys = new Set<string>();
  if (log.habitKey !== null) keys.add(log.habitKey);
  const owner = log.skillId ?? log.questId;
  if (owner !== null && log.itemId !== null) keys.add(`${owner}/${log.itemId}`);
  return keys;
}

// ---------------------------------------------------------------- skills

interface Learned {
  learned: boolean;
  learnedVia: LearnedVia | null;
  learnedAt: string | null;
}

const NOT_LEARNED: Learned = { learned: false, learnedVia: null, learnedAt: null };

function resolveLearned(skill: Skill, row: SkillProgressRow | undefined): Learned {
  if (row?.learnedVia) return { learned: true, learnedVia: row.learnedVia, learnedAt: row.learnedAt };
  if (isStartingSkill(skill)) return { learned: true, learnedVia: "self-reported", learnedAt: null };
  return NOT_LEARNED;
}

function buildSkillView(
  skill: Skill,
  learned: Learned,
  p: ProgressIndex,
  unlearned: (ids: string[]) => string[],
  today: string,
): { skill: SkillView; items: ItemView[] } {
  const row = p.skillRows.get(skill.id);
  const logs = p.logsBySkill.get(skill.id) ?? [];
  const attempts = p.attemptsBySkill.get(skill.id) ?? [];
  const notes = p.notesBySkill.get(skill.id) ?? [];
  const { rust, items: freshness } = computeRust(
    skill,
    p.verificationsBySkill.get(skill.id) ?? [],
    attempts,
    learned,
    today,
  );

  const itemViews: ItemView[] = [];
  const ranks: RankView[] = [];
  let blockingMinutes = 0;
  let clearedMinutes = 0;
  for (const rank of skill.ranks) {
    const views = rank.items.map((item) => skillItemView(skill.id, item, p, freshness[item.id]));
    itemViews.push(...views);
    const r = buildRankView(rank, views, learned, unlearned);
    ranks.push(r.view);
    blockingMinutes += r.blockingMinutes;
    clearedMinutes += r.clearedMinutes;
  }

  // A rank's requires lock just that rank (D6), but a skill whose every rank is locked
  // has nothing to work on: it's locked too, until its first rank opens.
  const allRanksLocked = ranks.length > 0 && ranks.every((r) => r.locked);
  const ownMissing = unlearned(skill.requires);
  const missingRequires = ownMissing.length > 0 || !allRanksLocked ? ownMissing : ranks[0].missingRequires;
  const locked = !learned.learned && missingRequires.length > 0;
  const started =
    itemViews.some((v) => v.status !== "todo") || logs.length > 0 || Boolean(row?.startedAt);
  const ranksComplete = ranks.filter((r) => r.complete).length;
  const allRanksComplete = ranks.length > 0 && ranksComplete === ranks.length;

  const view: SkillView = {
    id: skill.id,
    state: skillState(learned, rust.isRusty, locked, started),
    learned: learned.learned,
    learnedVia: learned.learnedVia,
    learnedAt: learned.learnedAt,
    isStarting: isStartingSkill(skill),
    starred: row?.starred ?? false,
    locked,
    missingRequires,
    ranks,
    ranksComplete,
    // Ranks with nothing blocking are complete, so the skill agrees with them rather than reading 0.
    progress: learned.learned ? 1 : blockingMinutes > 0 ? clearedMinutes / blockingMinutes : allRanksComplete ? 1 : 0,
    // A rank's requires are prerequisites of the skill as a whole (validator: cycle, quest-order).
    readyToComplete: !learned.learned && !locked && allRanksComplete && ranks.every((r) => !r.locked),
    // A test-out clears every rank, so it waits for the same prerequisites as the completion check.
    canTestOut:
      !locked &&
      ranks.every((r) => !r.locked) &&
      (!learned.learned || learned.learnedVia === "self-reported") &&
      skill.recall.length > 0,
    rust,
    minutesLogged: logs.reduce((sum, l) => sum + (Number.isFinite(l.minutes) && l.minutes > 0 ? l.minutes : 0), 0),
    xp: logs.reduce((sum, l) => sum + xpForLog(l.activity, l.minutes), 0) + recallBonusFor(attempts),
    lastActivityAt: latestTimestamp([
      ...itemViews.flatMap((v) => (v.completedAt === null ? [] : [v.completedAt])),
      ...logs.map((l) => l.createdAt),
      ...attempts.map((a) => a.createdAt),
    ]),
    lastTestOut: lastTestOut(attempts),
    noteCount: notes.filter((n) => n.kind === "note").length,
    outputCount: notes.filter((n) => n.kind === "output").length,
  };
  return { skill: view, items: itemViews };
}

function skillState(learned: Learned, isRusty: boolean, locked: boolean, started: boolean): SkillState {
  if (learned.learned) {
    if (isRusty) return "rusty";
    if (learned.learnedVia === "tested-out") return "tested-out";
    if (learned.learnedVia === "self-reported") return "self-reported";
    return "learned";
  }
  if (locked) return "locked";
  return started ? "in-progress" : "available";
}

function buildRankView(
  rank: Rank,
  views: ItemView[],
  learned: Learned,
  unlearned: (ids: string[]) => string[],
): { view: RankView; blockingMinutes: number; clearedMinutes: number } {
  const skillLearned = learned.learned;
  // A test-out or self-report clears every item without marking it done (the item stays
  // todo so it can still be worked through); count those as cleared too.
  const covered = learned.learned && learned.learnedVia !== "completed";
  let blockingCount = 0;
  let doneCount = 0;
  let blockingMinutes = 0;
  let clearedMinutes = 0;
  rank.items.forEach((item, i) => {
    if (!views[i].blocking) return;
    const minutes = weightMinutes(item.minutes);
    blockingCount += 1;
    blockingMinutes += minutes;
    if (covered || views[i].status !== "todo") {
      doneCount += 1;
      clearedMinutes += minutes;
    }
  });
  const missingRequires = unlearned(rank.requires);
  const allCleared = doneCount === blockingCount;
  const view: RankView = {
    id: rank.id,
    number: rank.number,
    name: rank.name,
    locked: !skillLearned && missingRequires.length > 0,
    missingRequires,
    complete: skillLearned || allCleared,
    doneCount,
    blockingCount,
    progress: skillLearned || allCleared ? 1 : blockingMinutes > 0 ? clearedMinutes / blockingMinutes : 0,
  };
  return { view, blockingMinutes, clearedMinutes };
}

function lastTestOut(attempts: RecallAttemptRow[]): SkillView["lastTestOut"] {
  // Within a session, a re-answered question counts once (its latest answer).
  const sessions = new Map<string, Map<string, RecallAttemptRow>>();
  for (const a of attempts) {
    if (a.mode !== "test-out") continue;
    const answers = sessions.get(a.sessionId) ?? new Map<string, RecallAttemptRow>();
    const prev = answers.get(a.questionId);
    if (prev === undefined || supersedes(a, prev)) answers.set(a.questionId, a);
    sessions.set(a.sessionId, answers);
  }
  // Rows arrive in primary-key (uuid) order, so every tie is broken on content, never on position.
  let best: { at: string; sessionId: string; passed: number; total: number } | null = null;
  for (const [sessionId, answers] of sessions) {
    const list = [...answers.values()];
    const at = latestTimestamp(list.map((a) => a.createdAt));
    if (at === null) continue;
    const later = best === null || isEarlier(best.at, at) || (!isEarlier(at, best.at) && sessionId > best.sessionId);
    if (later) best = { at, sessionId, passed: list.filter((a) => a.result === "pass").length, total: list.length };
  }
  return best === null ? null : { at: best.at, passed: best.passed, total: best.total };
}

/** A later answer wins; at the same instant a fail wins, so the outcome never depends on row order. */
function supersedes(a: RecallAttemptRow, prev: RecallAttemptRow): boolean {
  if (isEarlier(prev.createdAt, a.createdAt)) return true;
  if (isEarlier(a.createdAt, prev.createdAt)) return false;
  return a.result === "fail" && prev.result === "pass";
}

// ---------------------------------------------------------------- items

function skillItemView(skillId: string, item: Item, p: ProgressIndex, fresh: ItemFreshness | undefined): ItemView {
  // Items without an id (bundle before import) can't carry progress.
  const row = item.id === "" ? undefined : p.itemRows.get(`${skillId}/${item.id}`);
  const status: ItemStatus = row?.status ?? "todo";
  return {
    ...baseItemView(skillId, item, p),
    status,
    completedAt: row?.completedAt ?? null,
    blocking: isBlocking(item),
    ...freshnessFields(fresh),
  };
}

function questItemView(questId: string, item: Item, p: ProgressIndex, fresh: ItemFreshness | undefined): ItemView {
  return {
    ...baseItemView(questId, item, p),
    status: "todo",
    completedAt: null,
    blocking: false,
    ...freshnessFields(fresh),
  };
}

function freshnessFields(
  fresh: ItemFreshness | undefined,
): Pick<ItemView, "asOf" | "lastVerifiedAt" | "changedOn" | "staleOn" | "stale"> {
  return {
    asOf: fresh?.asOf ?? null,
    lastVerifiedAt: fresh?.lastVerifiedAt ?? null,
    changedOn: fresh?.changedOn ?? null,
    staleOn: fresh?.staleOn ?? null,
    stale: fresh?.stale ?? false,
  };
}

function baseItemView(
  ownerId: string,
  item: Item,
  p: ProgressIndex,
): Pick<ItemView, "key" | "ownerId" | "itemId" | "minutesLogged" | "noteCount" | "outputCount"> {
  const key = `${ownerId}/${item.id}`;
  const notes = item.id === "" ? [] : (p.notesByItem.get(key) ?? []);
  return {
    key: item.key,
    ownerId,
    itemId: item.id,
    minutesLogged: item.id === "" ? 0 : (p.minutesByItem.get(key) ?? 0),
    noteCount: notes.filter((n) => n.kind === "note").length,
    outputCount: notes.filter((n) => n.kind === "output").length,
  };
}

function isBlocking(item: Item): boolean {
  return !item.optional && item.type !== "habit";
}

// ---------------------------------------------------------------- branches

/**
 * Each skill rolls up into exactly one branch, its `branchId` (the id prefix,
 * as the layout uses), even when a branch file is missing, doesn't list it, or
 * lists a skill of another branch. Branches with no skills still get a view.
 */
function buildBranchViews(index: ContentIndex, skills: Record<string, SkillView>): Record<string, BranchView> {
  const members = new Map<string, SkillView[]>();
  for (const branch of index.tree.branches) members.set(branch.id, []);
  for (const skill of Object.values(index.skills)) push(members, skill.branchId, skills[skill.id]);
  const out: Record<string, BranchView> = {};
  for (const [id, views] of members) out[id] = branchView(id, views);
  return out;
}

function branchView(id: string, views: SkillView[]): BranchView {
  const count = (pred: (v: SkillView) => boolean) => views.filter(pred).length;
  return {
    id,
    total: views.length,
    learned: count((v) => isLearnedState(v.state)),
    inProgress: count((v) => v.state === "in-progress"),
    available: count((v) => v.state === "available"),
    locked: count((v) => v.state === "locked"),
    rusty: count((v) => v.state === "rusty"),
    progress: views.length > 0 ? views.reduce((sum, v) => sum + v.progress, 0) / views.length : 0,
    xp: views.reduce((sum, v) => sum + v.xp, 0),
  };
}

// ---------------------------------------------------------------- helpers

/** An estimate usable as a progress weight; missing, zero or garbage falls back to the default. */
function weightMinutes(minutes: number | null): number {
  return minutes !== null && Number.isFinite(minutes) && minutes > 0 ? minutes : DEFAULT_ITEM_MINUTES;
}

function groupBy<T>(rows: T[], key: (row: T) => string | null): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const row of rows) {
    const k = key(row);
    if (k !== null) push(map, k, row);
  }
  return map;
}

function push<T>(map: Map<string, T[]>, key: string, value: T): void {
  const list = map.get(key);
  if (list) list.push(value);
  else map.set(key, [value]);
}

/** Latest ISO timestamp by instant (not string order, since offsets may differ); invalid values are skipped. */
function latestTimestamp(values: string[]): string | null {
  let best: string | null = null;
  for (const v of values) {
    if (Number.isNaN(Date.parse(v))) continue;
    if (best === null || isEarlier(best, v)) best = v;
  }
  return best;
}

function isEarlier(a: string, b: string): boolean {
  return Date.parse(a) < Date.parse(b);
}
