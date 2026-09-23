// Content validator: the authoring guide's hard requirements (errors) and
// quality checks (warnings) over a parsed ContentTree. Codes and rules are
// docs/format-spec.md §9, which encodes docs/skill-authoring-guide.md §10.
// Pure: no I/O, and `today` is injectable so staleness is testable.

import {
  ACTIVE_ITEM_TYPES,
  RESOURCE_TYPES,
  isResourceType,
  isStartingSkill,
  type Branch,
  type Cadence,
  type ContentTree,
  type Diagnostic,
  type Item,
  type Quest,
  type Rank,
  type Severity,
  type Skill,
} from "@/lib/content/types";
import {
  ESTIMATE_TOLERANCE,
  FRESHNESS_DAYS,
  ITEM_MAX_MINUTES,
  ITEM_MIN_MINUTES,
  MAX_RESOURCES_PER_ITEM,
  MIN_TEXT_LENGTH,
  RANK_MAX_MINUTES,
  RANK_MIN_MINUTES,
} from "@/lib/config";
import { diffDays, isIsoDate, localToday } from "@/lib/engine/dates";

export interface ValidateOptions {
  /** YYYY-MM-DD for the freshness check. Defaults to today in Europe/Riga. */
  today?: string;
  freshnessDays?: number;
}

export interface ValidationSummary {
  errors: number;
  warnings: number;
  byCode: Record<string, number>;
  /** Total `@search@` links still to resolve, summed from the `search-links` warnings. */
  searchLinks: number;
}

/** Recall questions per skill (guide §2.7). */
const RECALL_MIN = 3;
const RECALL_MAX = 5;
/** Guide §1: fewer skills than this and it's a skill in an existing branch. */
const BRANCH_MIN_SKILLS = 3;
/** A tangled graph can have exponentially many cycles; list this many at most. */
const MAX_CYCLES = 25;
const TITLE_MAX = 40;

const SKILL_KEYS = ["id", "requires", "related", "status", "estimate", "facts_as_of"];
const BRANCH_KEYS = ["id", "note", "color", "order"];
const QUEST_KEYS = ["id", "pace", "goal"];

const PASSIVE_DONE_WHEN = /\bI (?:understand|know|get)\b|\bI['’]m familiar\b/i;
const MARKDOWN_LINK = /\[(?:@[\w-]+@)?([^\]]*)\]\(([^)\s]*)[^)]*\)/g;

const SEVERITY_ORDER: Record<Severity, number> = { error: 0, warning: 1 };

type Loc = Pick<Diagnostic, "file" | "line" | "skillId" | "itemId" | "questId">;

/** Whoever owns an item: a skill, or a quest's maintenance section. */
interface Owner {
  kind: "skill" | "quest";
  id: string;
  file: string;
  /** Where the owner's items live: the skill heading, or the Maintenance heading. */
  line: number;
  factsAsOf: string | null;
  defaultCadence: Cadence | null;
}

interface Context {
  tree: ContentTree;
  today: string;
  freshnessDays: number;
  /** First occurrence per id; duplicates are reported separately. */
  skills: Map<string, Skill>;
  branches: Map<string, Branch>;
  /** Bundle only: the bundle's facts_as_of, which every item inherits (spec §4). */
  bundleFactsAsOf: string | null;
  /** Bundle only: URLs in the pack's Sources, which the importer copies into skills that link them (spec §8). */
  packSourceUrls: Set<string>;
}

// ---------------------------------------------------------------------------
// Public API

export function validate(tree: ContentTree, opts: ValidateOptions = {}): Diagnostic[] {
  const ctx = createContext(tree, opts);
  return sortDiagnostics([
    ...tree.diagnostics,
    ...checkDuplicateIds(tree),
    ...checkReferences(ctx),
    ...checkCycles(ctx),
    ...tree.skills.flatMap((s) => checkSkill(ctx, s)),
    ...tree.branches.flatMap((b) => checkBranch(ctx, b)),
    ...tree.quests.flatMap((q) => checkQuest(ctx, q)),
  ]);
}

export function summarize(diags: readonly Diagnostic[]): ValidationSummary {
  const summary: ValidationSummary = { errors: 0, warnings: 0, byCode: {}, searchLinks: 0 };
  for (const d of diags) {
    if (d.severity === "error") summary.errors += 1;
    else summary.warnings += 1;
    summary.byCode[d.code] = (summary.byCode[d.code] ?? 0) + 1;
    if (d.code === "search-links") summary.searchLinks += searchLinkCount(d.message);
  }
  return summary;
}

/** By file, then line, then severity (errors first); stable otherwise. */
export function sortDiagnostics(diags: readonly Diagnostic[]): Diagnostic[] {
  return [...diags].sort(
    (a, b) =>
      compareStrings(a.file ?? "", b.file ?? "") ||
      (a.line ?? 0) - (b.line ?? 0) ||
      SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity],
  );
}

// ---------------------------------------------------------------------------
// Context

function createContext(tree: ContentTree, opts: ValidateOptions): Context {
  const today = opts.today ?? localToday();
  if (!isIsoDate(today)) throw new RangeError(`validate: today must be YYYY-MM-DD, got "${today}"`);
  const skills = new Map<string, Skill>();
  for (const s of tree.skills) if (!skills.has(s.id)) skills.set(s.id, s);
  const branches = new Map<string, Branch>();
  for (const b of tree.branches) if (!branches.has(b.id)) branches.set(b.id, b);
  const isBundle = tree.shape === "bundle";
  return {
    tree,
    today,
    freshnessDays: opts.freshnessDays ?? FRESHNESS_DAYS,
    skills,
    branches,
    bundleFactsAsOf: isBundle ? (tree.packs.find((p) => p.factsAsOf !== null)?.factsAsOf ?? null) : null,
    packSourceUrls: isBundle ? new Set(tree.packs.flatMap((p) => sourcesSectionUrls(p.body))) : new Set(),
  };
}

function skillOwner(skill: Skill): Owner {
  return { kind: "skill", id: skill.id, file: skill.file, line: skill.line, factsAsOf: skill.factsAsOf, defaultCadence: null };
}

function questOwner(quest: Quest): Owner {
  return {
    kind: "quest",
    id: quest.id,
    file: quest.file,
    line: quest.maintenance?.line ?? quest.line,
    factsAsOf: null,
    defaultCadence: quest.maintenance?.cadence ?? null,
  };
}

// ---------------------------------------------------------------------------
// Ids and references

function checkDuplicateIds(tree: ContentTree): Diagnostic[] {
  const out: Diagnostic[] = [];
  for (const [dup, first] of duplicates(tree.skills, (s) => s.id)) {
    out.push(
      error(
        "duplicate-id",
        `Skill id "${dup.id}" is already used by "${truncate(first.title)}" (${where(first, dup.file)}) — give one of them a new id`,
        { file: dup.file, line: dup.line, skillId: dup.id },
      ),
    );
  }
  for (const [dup, first] of duplicates(tree.branches, (b) => b.id)) {
    out.push(
      error("duplicate-id", `Branch id "${dup.id}" is already used (${where(first, dup.file)}) — merge the two branches`, {
        file: dup.file,
        line: dup.line,
      }),
    );
  }
  for (const [dup, first] of duplicates(tree.quests, (q) => q.id)) {
    out.push(
      error("duplicate-id", `Quest id "${dup.id}" is already used (${where(first, dup.file)}) — give one of them a new id`, {
        file: dup.file,
        line: dup.line,
        questId: dup.id,
      }),
    );
  }
  for (const skill of tree.skills) {
    const owner = skillOwner(skill);
    out.push(...duplicateItemIds(owner, skill.ranks.flatMap((r) => r.items)));
    for (const [dup, first] of duplicates(skill.recall, (q) => q.id)) {
      out.push(
        error(
          "duplicate-id",
          `Recall id "${dup.id}" is already used in ${skill.id} (line ${first.line}) — give this question the next unused {#qN}`,
          { file: skill.file, line: dup.line, skillId: skill.id },
        ),
      );
    }
  }
  for (const quest of tree.quests) out.push(...duplicateItemIds(questOwner(quest), quest.maintenance?.items ?? []));
  return out;
}

function duplicateItemIds(owner: Owner, items: readonly Item[]): Diagnostic[] {
  return duplicates(items, (it) => it.id).map(([dup, first]) =>
    error(
      "duplicate-id",
      `Item id "{#${dup.id}}" on ${itemName(dup)} is already used in ${owner.id} (line ${first.line}) — pick a new id for the newer item`,
      itemLoc(owner, dup),
    ),
  );
}

function checkReferences(ctx: Context): Diagnostic[] {
  const out: Diagnostic[] = [];
  const skillIds = [...ctx.skills.keys()];
  const unknownSkill = (ref: string): string => {
    const guess = didYouMean(ref, skillIds);
    return `"${ref}", which isn't a skill id${guess ? ` (did you mean "${guess}"?)` : ""}`;
  };
  for (const skill of ctx.tree.skills) {
    const loc = { file: skill.file, line: skill.line, skillId: skill.id };
    for (const ref of skill.requires) {
      if (!ctx.skills.has(ref)) out.push(error("unresolved-ref", `${skill.id} requires ${unknownSkill(ref)}`, loc));
    }
    for (const ref of skill.related) {
      if (!ctx.skills.has(ref)) out.push(error("unresolved-ref", `${skill.id} lists as related ${unknownSkill(ref)}`, loc));
    }
    for (const r of skill.ranks) {
      for (const ref of r.requires) {
        if (!ctx.skills.has(ref)) {
          out.push(
            error("unresolved-ref", `${rankName(r)} of ${skill.id} requires ${unknownSkill(ref)}`, { ...loc, line: r.line }),
          );
        }
      }
    }
    if (!ctx.branches.has(skill.branchId)) out.push(unresolvedBranch(ctx, skill, loc));
  }
  for (const quest of ctx.tree.quests) {
    for (const st of quest.stages) {
      const loc = { file: quest.file, line: st.line, questId: quest.id };
      for (const s of st.steps) {
        const target = ctx.skills.get(s.skillId);
        if (target === undefined) {
          out.push(error("unresolved-ref", `Quest stage "${st.name}" schedules ${unknownSkill(s.skillId)}`, loc));
          continue;
        }
        const have = new Set(target.ranks.map((r) => r.number));
        for (const n of s.ranks ?? []) {
          if (have.has(n)) continue;
          const has = have.size === 0 ? "has no ranks" : `only has ${listRanks([...have])}`;
          out.push(
            error("unresolved-ref", `Quest step "${s.text}" names Rank ${n}, but ${target.id} ${has}`, {
              ...loc,
              skillId: target.id,
            }),
          );
        }
      }
    }
  }
  return out;
}

function unresolvedBranch(ctx: Context, skill: Skill, loc: Loc): Diagnostic {
  if (skill.branchId === "") {
    return error("unresolved-ref", `Skill id "${skill.id}" has no branch prefix — ids are "branch.skill-name"`, loc);
  }
  const fix =
    ctx.tree.shape === "tree"
      ? `add content/branches/${skill.branchId}/_branch.md`
      : `add a "# Branch: …" section with "- id: ${skill.branchId}"`;
  return error("unresolved-ref", `${skill.id} belongs to branch "${skill.branchId}", which doesn't exist — ${fix}`, loc);
}

// ---------------------------------------------------------------------------
// Prerequisite cycles

/** Skill-level and rank-level requires, as skill → prerequisite edges between known skills. */
function prerequisiteGraph(ctx: Context): Map<string, string[]> {
  const graph = new Map<string, string[]>();
  for (const skill of ctx.skills.values()) {
    const targets = [...skill.requires, ...skill.ranks.flatMap((r) => r.requires)].filter((id) => ctx.skills.has(id));
    graph.set(skill.id, [...new Set(targets)]);
  }
  return graph;
}

function checkCycles(ctx: Context): Diagnostic[] {
  const graph = prerequisiteGraph(ctx);
  const order = new Map([...graph.keys()].map((id, i) => [id, i]));
  const cycles: string[][] = [];
  for (const component of stronglyConnected(graph)) {
    cycles.push(...simpleCycles(component, graph, order, MAX_CYCLES + 1 - cycles.length));
    if (cycles.length > MAX_CYCLES) break;
  }
  const out = cycles.slice(0, MAX_CYCLES).map((cycle) => cycleDiagnostic(ctx, cycle));
  if (cycles.length > MAX_CYCLES) {
    const first = ctx.skills.get(cycles[0][0]);
    out.push(
      error("cycle", `More than ${MAX_CYCLES} prerequisite cycles; fix the ones listed and re-run`, {
        file: first?.file,
        line: first?.line,
        skillId: first?.id,
      }),
    );
  }
  return out;
}

function cycleDiagnostic(ctx: Context, cycle: string[]): Diagnostic {
  const start = ctx.skills.get(cycle[0]);
  const path = [...cycle, cycle[0]].join(" → ");
  const viaRanks: string[] = [];
  cycle.forEach((from, i) => {
    const to = cycle[(i + 1) % cycle.length];
    const skill = ctx.skills.get(from);
    if (skill === undefined || skill.requires.includes(to)) return;
    const r = skill.ranks.find((x) => x.requires.includes(to));
    if (r !== undefined) viaRanks.push(`${from} ${rankName(r)} requires ${to}`);
  });
  const via = viaRanks.length > 0 ? ` (${viaRanks.join("; ")})` : "";
  return error("cycle", `Prerequisite cycle: ${path}${via} — remove one of these requires`, {
    file: start?.file,
    line: start?.line,
    skillId: start?.id,
  });
}

/** Tarjan's algorithm; components come out in reverse topological order. */
function stronglyConnected(graph: Map<string, string[]>): string[][] {
  const index = new Map<string, number>();
  const low = new Map<string, number>();
  const onStack = new Set<string>();
  const stack: string[] = [];
  const components: string[][] = [];
  let counter = 0;
  const visit = (v: string): void => {
    index.set(v, counter);
    low.set(v, counter);
    counter += 1;
    stack.push(v);
    onStack.add(v);
    for (const w of graph.get(v) ?? []) {
      if (!index.has(w)) {
        visit(w);
        low.set(v, Math.min(low.get(v) ?? 0, low.get(w) ?? 0));
      } else if (onStack.has(w)) {
        low.set(v, Math.min(low.get(v) ?? 0, index.get(w) ?? 0));
      }
    }
    if (low.get(v) !== index.get(v)) return;
    const component: string[] = [];
    let w: string | undefined;
    do {
      w = stack.pop();
      if (w === undefined) break;
      onStack.delete(w);
      component.push(w);
    } while (w !== v);
    components.push(component);
  };
  for (const v of graph.keys()) if (!index.has(v)) visit(v);
  return components;
}

/**
 * Every elementary cycle inside one strongly connected component, each once:
 * a cycle is found only from its earliest skill (in source order), so it is
 * never reported again as a rotation.
 */
function simpleCycles(
  component: string[],
  graph: Map<string, string[]>,
  order: Map<string, number>,
  limit: number,
): string[][] {
  const rank = (id: string): number => order.get(id) ?? 0;
  const members = [...component].sort((a, b) => rank(a) - rank(b));
  const cycles: string[][] = [];
  members.forEach((start, i) => {
    const allowed = new Set(members.slice(i));
    const path = [start];
    const onPath = new Set(path);
    const walk = (node: string): void => {
      for (const nextId of graph.get(node) ?? []) {
        if (cycles.length >= limit) return;
        if (nextId === start) cycles.push([...path]);
        else if (allowed.has(nextId) && !onPath.has(nextId)) {
          path.push(nextId);
          onPath.add(nextId);
          walk(nextId);
          path.pop();
          onPath.delete(nextId);
        }
      }
    };
    walk(start);
  });
  return cycles;
}

// ---------------------------------------------------------------------------
// Skills, ranks, items

function checkSkill(ctx: Context, skill: Skill): Diagnostic[] {
  const out: Diagnostic[] = [];
  const loc = { file: skill.file, line: skill.line, skillId: skill.id };
  const owner = skillOwner(skill);
  const items = skill.ranks.flatMap((r) => r.items);

  if (!isStartingSkill(skill)) {
    if (!hasText(skill.why)) {
      out.push(
        error("missing-why", `${skill.id} has no Why — add a "Why: …" paragraph after the metadata (what it's for, in my world)`, loc),
      );
    }
    if (skill.estimate === null) {
      out.push(error("missing-estimate", `${skill.id} has no estimate — add "- estimate: ~N h" (total hours across ranks)`, loc));
    } else if (skill.estimate.hours === null) {
      out.push(
        error("missing-estimate", `${skill.id} has estimate "${skill.estimate.text}" with no core hours — write it as "~N h"`, loc),
      );
    }
    if (skill.ranks.length === 0) {
      out.push(error("missing-rank", `${skill.id} has no ranks — add a "Rank 1" section with its items`, loc));
    }
    if (skill.recall.length < RECALL_MIN) {
      const have = skill.recall.length === 0 ? "no Recall questions" : `only ${plural(skill.recall.length, "Recall question")}`;
      out.push(error("recall-too-few", `${skill.id} has ${have} — a Recall section needs ${RECALL_MIN}–${RECALL_MAX}`, loc));
    }
  }
  if (hasText(skill.why)) {
    const length = plainText(skill.why).length;
    if (length < MIN_TEXT_LENGTH) {
      out.push(
        warning(
          "short-why",
          `Why of ${skill.id} is ${length} characters (under ${MIN_TEXT_LENGTH}) — say what it's for and which goal or business line it serves`,
          loc,
        ),
      );
    }
  }
  if (skill.recall.length > RECALL_MAX) {
    out.push(
      warning("recall-too-many", `${skill.id} has ${skill.recall.length} Recall questions — keep the best ${RECALL_MAX}`, {
        ...loc,
        line: skill.recall[RECALL_MAX].line,
      }),
    );
  }

  out.push(...skill.ranks.flatMap((r) => checkRank(skill, r)));
  out.push(...items.flatMap((it) => [...checkItem(ctx, owner, it), ...checkSkillItem(owner, it)]));
  out.push(...checkEstimate(skill, items));
  out.push(...searchLinks(owner, items));
  if (items.some((it) => it.timeSensitive) && skill.sources.length === 0 && !linksPackSource(ctx, skill, items)) {
    out.push(
      warning(
        "no-sources",
        `${skill.id} has time-sensitive items but no Sources — add a "Sources" section with the pages behind its facts and their as-of dates`,
        loc,
      ),
    );
  }
  out.push(...unknownKeys(skill.extraMeta, SKILL_KEYS, "skill", loc));

  if (ctx.tree.shape === "tree") {
    for (const q of skill.recall) {
      if (q.id !== "") continue;
      out.push(
        error(
          "missing-recall-id",
          `Recall question "${truncate(q.text)}" has no {#qN} id — run "pnpm content:ids" or add the next unused {#qN}`,
          { ...loc, line: q.line },
        ),
      );
    }
    const expected = `content/branches/${skill.branchId}/${skill.slug}.md`;
    if (!pathMatches(skill.file, expected)) out.push(pathMismatch(skill.file, expected, `skill id "${skill.id}"`, loc));
  }
  return out;
}

function checkRank(skill: Skill, r: Rank): Diagnostic[] {
  const out: Diagnostic[] = [];
  const loc = { file: skill.file, line: r.line, skillId: skill.id };
  const label = `${rankName(r)} of ${skill.id}`;
  if (!r.items.some((it) => hasText(it.doneWhen))) {
    out.push(
      error(
        "rank-missing-done-when",
        `${label} has no "Done when:" — add an observable self-check to at least one item`,
        loc,
      ),
    );
  }
  if (!r.items.some((it) => it.type !== null && ACTIVE_ITEM_TYPES.includes(it.type))) {
    out.push(
      warning("rank-not-active", `${label} has no do / build / output item — consider a hands-on item so the rank makes me produce something`, loc),
    );
  }
  const timed = r.items.filter((it) => isBlocking(it) && it.minutes !== null);
  if (timed.length > 0) {
    const minutes = sumMinutes(timed);
    if (minutes < RANK_MIN_MINUTES || minutes > RANK_MAX_MINUTES) {
      const fix = minutes < RANK_MIN_MINUTES ? "merge it into a neighbouring rank or add depth" : "split it into two ranks";
      out.push(
        warning(
          "rank-size",
          `${label} takes ${formatMinutes(minutes)} of required work — ranks should be ${formatMinutes(RANK_MIN_MINUTES)}–${formatMinutes(RANK_MAX_MINUTES)}; ${fix}`,
          loc,
        ),
      );
    }
  }
  return out;
}

/** Rules for every item, in a skill or in a quest's maintenance section. */
function checkItem(ctx: Context, owner: Owner, item: Item): Diagnostic[] {
  const out: Diagnostic[] = [];
  const name = itemName(item);
  const loc = itemLoc(owner, item);

  if (ctx.tree.shape === "tree" && item.id === "") {
    out.push(error("missing-item-id", `${name} has no {#id} — run "pnpm content:ids" or end the line with {#kebab-case-id}`, loc));
  }
  if (item.minutes === null) {
    const message = hasText(item.timeText)
      ? `${name} has a time "${item.timeText}" that can't be read — write it as "~N min" or "~N h"`
      : `${name} has no time estimate — add " — ~N min" to the item line`;
    out.push(error("item-missing-time", message, loc));
  }
  if (item.type === "build" && !hasText(item.ifStuck)) {
    out.push(
      error(
        "build-missing-if-stuck",
        `Build item ${name} has no "If stuck:" — add a fallback (a smaller task, a simpler resource, or the question to ask)`,
        loc,
      ),
    );
  }
  if (item.timeSensitive) out.push(...checkTimeSensitive(ctx, owner, item));

  if (item.resources.length > MAX_RESOURCES_PER_ITEM) {
    out.push(
      warning(
        "too-many-resources",
        `${name} has ${item.resources.length} typed links (max ${MAX_RESOURCES_PER_ITEM}) — keep the best ${MAX_RESOURCES_PER_ITEM} or split the item`,
        loc,
      ),
    );
  }
  for (const r of item.resources) {
    if (isResourceType(r.type)) continue;
    out.push(
      warning(
        "unknown-resource-type",
        `Unknown resource type "@${r.type}@" on link "${truncate(r.title)}" in ${name} — use one of ${RESOURCE_TYPES.map((t) => `@${t}@`).join(", ")}`,
        itemLoc(owner, item, fieldLine(item, r.field)),
      ),
    );
  }
  if (hasText(item.doneWhen)) {
    const doneLoc = itemLoc(owner, item, fieldLine(item, "Done when"));
    const length = plainText(item.doneWhen).length;
    if (length < MIN_TEXT_LENGTH) {
      out.push(
        warning(
          "short-done-when",
          `"Done when" on ${name} is ${length} characters (under ${MIN_TEXT_LENGTH}) — describe something I can demonstrate: explain, compute, build or predict`,
          doneLoc,
        ),
      );
    }
    const passive = PASSIVE_DONE_WHEN.exec(item.doneWhen);
    if (passive !== null) {
      out.push(
        warning(
          "passive-done-when",
          `"Done when" on ${name} says "${passive[0]}" — rewrite it as something demonstrable, e.g. "I can explain / compute / predict …"`,
          doneLoc,
        ),
      );
    }
  }
  if (item.type === "habit" && (item.cadence ?? owner.defaultCadence) === null) {
    out.push(
      warning(
        "habit-no-cadence",
        `Habit ${name} has no cadence — add "Cadence: weekly / monthly / yearly" or say it in the title ("one episode a month")`,
        loc,
      ),
    );
  }
  return out;
}

function checkTimeSensitive(ctx: Context, owner: Owner, item: Item): Diagnostic[] {
  const out: Diagnostic[] = [];
  const name = itemName(item);
  if (!hasText(item.verify)) {
    out.push(
      error(
        "time-sensitive-missing-verify",
        `${name} is [time-sensitive] but has no "Verify:" — say exactly what to re-check`,
        itemLoc(owner, item),
      ),
    );
  }
  const asOf = item.asOf ?? owner.factsAsOf ?? ctx.bundleFactsAsOf;
  if (asOf === null) {
    // Quests have no facts_as_of key, so only the item-level fix applies there.
    const fix =
      owner.kind === "skill"
        ? `add "- facts_as_of: YYYY-MM-DD" to the skill or an "As of:" line to the item`
        : `add an "As of: YYYY-MM-DD" line to the item`;
    out.push(error("missing-facts-as-of", `${name} is [time-sensitive] but has no as-of date — ${fix}`, itemLoc(owner, item)));
  } else if (isIsoDate(asOf)) {
    const age = diffDays(asOf, ctx.today);
    if (age >= ctx.freshnessDays) {
      const what = hasText(item.verify) ? `"${truncate(item.verify, 60)}"` : "its facts";
      out.push(
        warning(
          "stale",
          `${name} was checked ${age} days ago (as of ${asOf}; stale after ${ctx.freshnessDays}) — re-check ${what} and update the as-of date`,
          itemLoc(owner, item, item.asOf === null ? item.line : fieldLine(item, "As of")),
        ),
      );
    }
  }
  return out;
}

/** Rules that only make sense for items inside a skill. */
function checkSkillItem(owner: Owner, item: Item): Diagnostic[] {
  const out: Diagnostic[] = [];
  const name = itemName(item);
  if (isBlocking(item) && item.minutes !== null && (item.minutes < ITEM_MIN_MINUTES || item.minutes > ITEM_MAX_MINUTES)) {
    const fix = item.minutes < ITEM_MIN_MINUTES ? "merge it with a neighbouring item" : "split it into smaller items";
    out.push(
      warning(
        "item-size",
        `${name} takes ${formatMinutes(item.minutes)} — items should take ${formatMinutes(ITEM_MIN_MINUTES)} to ${formatMinutes(ITEM_MAX_MINUTES)}; ${fix}`,
        itemLoc(owner, item),
      ),
    );
  }
  if (item.type === "habit" && item.cadence?.unit === "week") {
    out.push(
      warning(
        "weekly-habit-in-skill",
        `Habit ${name} repeats ${item.cadence.text} — weekly habits belong in a quest's Maintenance section; a skill only holds monthly or yearly habits`,
        itemLoc(owner, item),
      ),
    );
  }
  return out;
}

function checkEstimate(skill: Skill, items: readonly Item[]): Diagnostic[] {
  const hours = skill.estimate?.hours ?? null;
  if (hours === null || items.length === 0) return [];
  const blocking = items.filter(isBlocking);
  const minutes = sumMinutes(blocking);
  const target = hours * 60;
  if (Math.abs(minutes - target) <= target * ESTIMATE_TOLERANCE) return [];
  const untimed = blocking.filter((it) => it.minutes === null).length;
  const note = untimed > 0 ? ` (${plural(untimed, "untimed item")} not counted)` : "";
  const pct = Math.round(ESTIMATE_TOLERANCE * 100);
  return [
    warning(
      "estimate-mismatch",
      `Required items in ${skill.id} add up to ${formatMinutes(minutes)}${note}, but the estimate is ~${hours} h (outside ±${pct}%) — update the estimate or the item times`,
      { file: skill.file, line: skill.line, skillId: skill.id },
    ),
  ];
}

function searchLinks(owner: Owner, items: readonly Item[]): Diagnostic[] {
  const withSearch = items.filter((it) => it.resources.some((r) => r.type === "search"));
  const count = withSearch.reduce((n, it) => n + it.resources.filter((r) => r.type === "search").length, 0);
  if (count === 0) return [];
  const lines = [...new Set(withSearch.map((it) => it.line))];
  return [
    warning(
      "search-links",
      `${plural(count, "@search@ link")} to resolve into exact videos (${lines.length === 1 ? "line" : "lines"} ${lines.join(", ")})`,
      { file: owner.file, line: owner.line, ...(owner.kind === "skill" ? { skillId: owner.id } : { questId: owner.id }) },
    ),
  ];
}

// ---------------------------------------------------------------------------
// Branches and quests

function checkBranch(ctx: Context, b: Branch): Diagnostic[] {
  const out: Diagnostic[] = [];
  const loc = { file: b.file, line: b.line };
  const skillIds = new Set([...b.skillIds, ...ctx.tree.skills.filter((s) => s.branchId === b.id).map((s) => s.id)]);
  if (skillIds.size < BRANCH_MIN_SKILLS) {
    out.push(
      warning(
        "branch-too-small",
        `Branch "${b.id}" has ${plural(skillIds.size, "skill")} — a branch needs at least ${BRANCH_MIN_SKILLS}; add more or move ${skillIds.size === 1 ? "it" : "them"} into an existing branch`,
        loc,
      ),
    );
  }
  out.push(...unknownKeys(b.extraMeta, BRANCH_KEYS, "branch", loc));
  if (ctx.tree.shape === "tree") {
    const expected = `content/branches/${b.id}/_branch.md`;
    if (!pathMatches(b.file, expected)) out.push(pathMismatch(b.file, expected, `branch id "${b.id}"`, loc));
  }
  return out;
}

function checkQuest(ctx: Context, quest: Quest): Diagnostic[] {
  const out: Diagnostic[] = [];
  const loc = { file: quest.file, line: quest.line, questId: quest.id };
  const owner = questOwner(quest);
  const items = quest.maintenance?.items ?? [];
  out.push(...checkQuestOrder(ctx, quest));
  out.push(...items.flatMap((it) => checkItem(ctx, owner, it)));
  out.push(...searchLinks(owner, items));
  out.push(...unknownKeys(quest.extraMeta, QUEST_KEYS, "quest", loc));
  if (ctx.tree.shape === "tree") {
    const expected = `content/quests/${quest.id.replace(/^quest-/, "")}.md`;
    if (!pathMatches(quest.file, expected)) out.push(pathMismatch(quest.file, expected, `quest id "${quest.id}"`, loc));
  }
  return out;
}

/**
 * Walks the stage table in order. A prerequisite is met when it's a starting
 * skill, or when every one of its ranks was scheduled by an earlier step
 * (a whole-skill step schedules all ranks).
 */
function checkQuestOrder(ctx: Context, quest: Quest): Diagnostic[] {
  const out: Diagnostic[] = [];
  const steps = quest.stages.flatMap((st) => st.steps.map((s) => ({ stage: st, step: s })));
  const scheduled = new Map<string, Set<number>>();

  steps.forEach(({ stage: st, step: s }, i) => {
    const target = ctx.skills.get(s.skillId);
    if (target === undefined) return;
    const covered = target.ranks.filter((r) => s.ranks === null || s.ranks.includes(r.number));

    // Prerequisite id → the ranks that need it (empty = the whole skill does).
    const needs = new Map<string, Rank[]>();
    for (const id of target.requires) needs.set(id, []);
    for (const r of covered) {
      for (const id of r.requires) {
        const byRank = needs.get(id);
        if (byRank === undefined) needs.set(id, [r]);
        else if (byRank.length > 0) byRank.push(r);
      }
    }

    for (const [reqId, byRanks] of needs) {
      const req = ctx.skills.get(reqId);
      if (req === undefined || reqId === target.id || isStartingSkill(req)) continue;
      const done = scheduled.get(reqId);
      if (done !== undefined && req.ranks.every((r) => done.has(r.number))) continue;
      const why = byRanks.length > 0 ? ` (required by ${byRanks.map(rankName).join(", ")})` : "";
      out.push(
        error(
          "quest-order",
          `"${s.text}" in stage "${st.name}" comes before its prerequisite ${reqId}${why} — ${orderFix(req, done, steps.slice(i + 1))}`,
          { file: quest.file, line: st.line, questId: quest.id, skillId: target.id },
        ),
      );
    }

    const marks = scheduled.get(target.id) ?? new Set<number>();
    for (const r of covered) marks.add(r.number);
    scheduled.set(target.id, marks);
  });
  return out;
}

function orderFix(
  req: Skill,
  done: Set<number> | undefined,
  later: Array<{ stage: { name: string }; step: { skillId: string } }>,
): string {
  if (done !== undefined && done.size > 0) {
    const missing = req.ranks.filter((r) => !done.has(r.number)).map((r) => r.number);
    return `only ${listRanks([...done])} of ${req.id} ${done.size === 1 ? "is" : "are"} scheduled earlier; schedule ${listRanks(missing)} before it`;
  }
  const next = later.find((x) => x.step.skillId === req.id);
  return next !== undefined
    ? `move ${req.id} earlier (it's scheduled later, in stage "${next.stage.name}")`
    : `schedule ${req.id} in an earlier stage (it isn't in this quest)`;
}

// ---------------------------------------------------------------------------
// Shared checks

function unknownKeys(extraMeta: Record<string, string>, known: string[], what: string, loc: Loc): Diagnostic[] {
  return Object.keys(extraMeta).map((key) => {
    const guess = didYouMean(key, known);
    const hint = guess ? ` (did you mean "${guess}"?)` : "";
    return warning("unknown-key", `Unknown ${what} key "${key}"${hint} — it's kept but ignored; known keys: ${known.join(", ")}`, loc);
  });
}

function pathMismatch(file: string, expected: string, what: string, loc: Loc): Diagnostic {
  return error("path-mismatch", `${file} doesn't match its ${what}: expected ${expected} — move the file (never change an existing id)`, loc);
}

/**
 * Suffix match from `branches/` or `quests/` on, so a content directory
 * validated from another path (or with absolute paths) still passes.
 */
function pathMatches(actual: string, expected: string): boolean {
  const norm = actual.replace(/\\/g, "/").replace(/^\.\//, "");
  const tail = expected.replace(/^content\//, "");
  return norm === expected || norm === tail || norm.endsWith(`/${tail}`);
}

function linksPackSource(ctx: Context, skill: Skill, items: readonly Item[]): boolean {
  if (ctx.packSourceUrls.size === 0) return false;
  const texts = [skill.why, skill.description, ...items.flatMap((it) => [it.title, ...it.fields.map((f) => f.text)])];
  const urls = [...items.flatMap((it) => it.resources.map((r) => r.url)), ...texts.flatMap((t) => (t ? linkUrls(t) : []))];
  return urls.some((u) => ctx.packSourceUrls.has(normalizeUrl(u)));
}

/** Link URLs under any pack heading that mentions "Sources". */
function sourcesSectionUrls(markdown: string): string[] {
  const urls: string[] = [];
  let level = 0;
  for (const line of markdown.split("\n")) {
    const heading = /^(#{1,6})\s+(.*)$/.exec(line);
    if (heading !== null) {
      if (level > 0 && heading[1].length <= level) level = 0;
      if (level === 0 && /\bsources\b/i.test(heading[2])) level = heading[1].length;
      continue;
    }
    if (level > 0) urls.push(...linkUrls(line).map(normalizeUrl));
  }
  return urls;
}

// ---------------------------------------------------------------------------
// Helpers

function error(code: string, message: string, loc: Loc): Diagnostic {
  return diagnostic("error", code, message, loc);
}

function warning(code: string, message: string, loc: Loc): Diagnostic {
  return diagnostic("warning", code, message, loc);
}

/** Leaves out absent location fields so JSON output stays clean. */
function diagnostic(severity: Severity, code: string, message: string, loc: Loc): Diagnostic {
  const d: Diagnostic = { severity, code, message };
  if (loc.file !== undefined) d.file = loc.file;
  if (loc.line !== undefined) d.line = loc.line;
  if (loc.skillId !== undefined) d.skillId = loc.skillId;
  if (loc.itemId !== undefined) d.itemId = loc.itemId;
  if (loc.questId !== undefined) d.questId = loc.questId;
  return d;
}

function itemLoc(owner: Owner, item: Item, line: number = item.line): Loc {
  return {
    file: owner.file,
    line,
    ...(owner.kind === "skill" ? { skillId: owner.id } : { questId: owner.id }),
    ...(item.id !== "" ? { itemId: item.id } : {}),
  };
}

function fieldLine(item: Item, label: string): number {
  if (label.toLowerCase() === "title") return item.line;
  return item.fields.find((f) => f.label.toLowerCase() === label.toLowerCase())?.line ?? item.line;
}

function itemName(item: Item): string {
  const title = truncate(item.title);
  return title === "" ? `the item on line ${item.line}` : `"${title}"`;
}

function rankName(r: Rank): string {
  return `Rank ${r.number}`;
}

function listRanks(numbers: number[]): string {
  const sorted = [...numbers].sort((a, b) => a - b);
  return `${sorted.length === 1 ? "Rank" : "Ranks"} ${sorted.join(", ")}`;
}

/** Required for rank completion: not optional, not a habit (spec §2.4, §5). */
function isBlocking(item: Item): boolean {
  return !item.optional && item.type !== "habit";
}

function sumMinutes(items: readonly Item[]): number {
  return items.reduce((n, it) => n + (it.minutes ?? 0), 0);
}

function hasText(value: string | null): value is string {
  return value !== null && value.trim() !== "";
}

/** Markdown links reduced to their titles (typed-link prefixes dropped), whitespace collapsed. */
function plainText(markdown: string): string {
  return markdown.replace(MARKDOWN_LINK, "$1").replace(/\s+/g, " ").trim();
}

function linkUrls(markdown: string): string[] {
  return [...markdown.matchAll(MARKDOWN_LINK)].map((m) => m[2]).filter((u) => u !== "");
}

function normalizeUrl(url: string): string {
  return url.trim().replace(/\/+$/, "");
}

function truncate(text: string, max: number = TITLE_MAX): string {
  const plain = plainText(text);
  if (plain.length <= max) return plain;
  const cut = plain.slice(0, max);
  const space = cut.lastIndexOf(" ");
  const base = space > max / 2 ? cut.slice(0, space) : cut;
  return `${base.replace(/[\s,;:.—–-]+$/, "")}…`;
}

function formatMinutes(total: number): string {
  const rounded = Math.round(total);
  const h = Math.floor(rounded / 60);
  const m = rounded % 60;
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}

function plural(n: number, noun: string): string {
  return `${n} ${noun}${n === 1 ? "" : "s"}`;
}

function where(first: { file: string; line: number }, currentFile: string): string {
  return first.file === currentFile ? `line ${first.line}` : `${first.file}:${first.line}`;
}

/** Pairs of [duplicate, first occurrence]; empty ids are skipped (reported as missing ids instead). */
function duplicates<T>(list: readonly T[], key: (t: T) => string): Array<[T, T]> {
  const seen = new Map<string, T>();
  const out: Array<[T, T]> = [];
  for (const entry of list) {
    const k = key(entry);
    if (k === "") continue;
    const first = seen.get(k);
    if (first === undefined) seen.set(k, entry);
    else out.push([entry, first]);
  }
  return out;
}

function searchLinkCount(message: string): number {
  const match = /^(\d+) @search@ link/.exec(message);
  return match === null ? 1 : Number(match[1]);
}

function compareStrings(a: string, b: string): number {
  if (a === b) return 0;
  return a < b ? -1 : 1;
}

function didYouMean(name: string, candidates: readonly string[]): string | null {
  let best: string | null = null;
  let bestDistance = Infinity;
  for (const c of candidates) {
    const d = editDistance(name, c);
    if (d < bestDistance) {
      best = c;
      bestDistance = d;
    }
  }
  const threshold = Math.max(2, Math.floor(name.length / 4));
  return best !== null && bestDistance > 0 && bestDistance <= threshold ? best : null;
}

function editDistance(a: string, b: string): number {
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const row = [i];
    for (let j = 1; j <= b.length; j++) {
      row.push(Math.min(prev[j] + 1, row[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)));
    }
    prev = row;
  }
  return prev[b.length];
}
