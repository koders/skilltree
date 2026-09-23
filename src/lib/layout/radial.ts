// Radial "constellation" layout for the skill tree canvas (docs/decisions.md D4).
// The player is a hub at (0,0); each branch owns an angular sector; a skill's
// ring is its prerequisite depth. Pure and deterministic: same input, same
// coordinates, so nodes never jump between visits.

import type { ContentTree } from "@/lib/content/types";
import {
  TAU,
  angularDistance,
  chordAngle,
  polar,
  radiusToFit,
  separate,
  wrapFrom,
} from "@/lib/layout/geometry";

export { polar };

export interface LayoutSkillInput {
  id: string;
  branchId: string;
  requires: string[];
  rankRequires: string[];
}

export interface LayoutInput {
  /** In display order (clockwise). */
  branches: { id: string }[];
  skills: LayoutSkillInput[];
}

export interface LayoutOptions {
  /** Node diameter in px. Default 76. */
  nodeSize?: number;
  /** Minimum free space between two nodes in px. Default 56. */
  minGap?: number;
  /** Radius of ring 0 (skills with no prerequisites). Default 240. */
  innerRadius?: number;
  /** Nominal distance between rings. Default 190. */
  ringGap?: number;
  /** Radians left empty between neighbouring sectors (capped so gaps take at most half the circle). Default 0.18. */
  sectorGap?: number;
}

export interface LayoutNode {
  id: string;
  branchId: string;
  x: number;
  y: number;
  /** Radians, 0 = up, clockwise; lies within its branch's [startAngle, endAngle]. */
  angle: number;
  radius: number;
  depth: number;
}

export interface LayoutEdge {
  /** `${source}->${target}` */
  id: string;
  /** The prerequisite. */
  source: string;
  /** The dependent. */
  target: string;
  /** "requires" when skill-level; "rank-requires" when only some rank requires it. */
  kind: "requires" | "rank-requires";
  crossBranch: boolean;
  /**
   * Same-branch edges spanning more than one ring: the points (inner to
   * outer) where the edge crosses each intermediate ring. The layout keeps
   * other nodes clear of them, so draw the edge through them.
   */
  waypoints?: { x: number; y: number }[];
}

export interface LayoutBranch {
  id: string;
  /** startAngle < midAngle < endAngle; midAngle is in [−π, π). */
  startAngle: number;
  endAngle: number;
  midAngle: number;
  labelX: number;
  labelY: number;
  /** Radius of the outermost ring holding one of the branch's skills (ring 0 if it has none). */
  outerRadius: number;
}

export interface LayoutResult {
  /** In input order. */
  nodes: LayoutNode[];
  /** Grouped by dependent in input order, then prerequisite order (requires before rank requires). */
  edges: LayoutEdge[];
  branches: LayoutBranch[];
  /** Ring radius by depth. */
  rings: number[];
  /** Depth-0 skills: the ones drawn connected to the hub. */
  hubTargets: string[];
  bounds: { minX: number; minY: number; maxX: number; maxY: number };
}

const DEFAULTS: Required<LayoutOptions> = {
  nodeSize: 76,
  minGap: 56,
  innerRadius: 240,
  ringGap: 190,
  sectorGap: 0.18,
};

/** No sector (and so a lone branch) spans more than this: a full ring reads as a wheel, not a tree. */
const MAX_SECTOR = (200 / 180) * Math.PI;
/** Weight of a cross-branch prerequisite's pull toward the sector edge facing it. */
const CROSS_BRANCH_PULL = 0.25;
/** Rings stay at least this fraction of ringGap apart after growing. */
const MIN_RING_STEP = 0.8;
/** Room a virtual point on a long edge takes, as a fraction of full node spacing. */
const VIRTUAL_WIDTH = 0.25;
/** Up/down barycentre sweep pairs after the first downward placement. */
const SWEEPS = 2;
/** Branch labels sit this many ringGaps beyond the branch's outer ring. */
const LABEL_OFFSET = 0.75;

// ---------------------------------------------------------------- public API

export function layoutInputFromContent(tree: ContentTree): LayoutInput {
  const branches = tree.branches
    .map((b, index) => ({ id: b.id, order: b.order, index }))
    .sort((a, b) => {
      // Branches with an explicit `order` come first; the rest keep content order.
      if (a.order !== null && b.order !== null && a.order !== b.order) return a.order - b.order;
      if (a.order !== null && b.order === null) return -1;
      if (a.order === null && b.order !== null) return 1;
      return a.index - b.index;
    })
    .map(({ id }) => ({ id }));
  const skills = tree.skills.map((s) => ({
    id: s.id,
    branchId: s.branchId,
    requires: [...s.requires],
    rankRequires: unique(s.ranks.flatMap((r) => r.requires)),
  }));
  return { branches, skills };
}

export function radialLayout(input: LayoutInput, opts: LayoutOptions = {}): LayoutResult {
  const o = resolveOptions(opts);
  const spacing = o.nodeSize + o.minGap;
  const graph = buildGraph(input);
  const { depth, dagPrereqs } = computeDepths(graph);

  const branchIds = resolveBranches(input, graph);
  const branchIndex = new Map(branchIds.map((id, i) => [id, i]));
  const branchOf = (id: string) => branchIndex.get(graph.skills.get(id)?.branchId ?? "") ?? 0;

  const maxDepth = graph.ids.reduce((m, id) => Math.max(m, depth.get(id) ?? 0), -1);
  const plan = buildSlots(graph.ids, dagPrereqs, depth, branchOf, branchIds.length, maxDepth);
  const sectors = computeSectors(realGroups(plan), o.sectorGap);
  const rings = computeRings(plan, sectors, maxDepth, o);
  const angles = placeSlots(plan, sectors, rings, spacing);

  const at = (id: string): { x: number; y: number } => {
    const slot = plan.slots.get(id);
    const angle = angles.get(id) ?? 0;
    const p = polar(angle, slot ? rings[slot.depth] : 0);
    return { x: round2(p.x), y: round2(p.y) };
  };

  const nodes: LayoutNode[] = graph.ids.map((id) => {
    const d = depth.get(id) ?? 0;
    return {
      id,
      branchId: branchIds[branchOf(id)],
      ...at(id),
      angle: angles.get(id) ?? sectors[branchOf(id)].mid,
      radius: rings[d],
      depth: d,
    };
  });

  const edges: LayoutEdge[] = [];
  for (const id of graph.ids) {
    for (const p of graph.prereqs.get(id) ?? []) {
      const key = `${p}->${id}`;
      const edge: LayoutEdge = {
        id: key,
        source: p,
        target: id,
        kind: graph.skillLevel.has(key) ? "requires" : "rank-requires",
        crossBranch: branchOf(p) !== branchOf(id),
      };
      const via = plan.chains.get(key);
      if (via && via.length > 0) edge.waypoints = via.map(at);
      edges.push(edge);
    }
  }

  const branches: LayoutBranch[] = branchIds.map((id, b) => {
    const s = sectors[b];
    const usedDepths = graph.ids.filter((n) => branchOf(n) === b).map((n) => depth.get(n) ?? 0);
    const outerRadius =
      usedDepths.length > 0 ? rings[Math.max(...usedDepths)] : (rings[0] ?? o.innerRadius);
    const label = polar(s.mid, outerRadius + o.ringGap * LABEL_OFFSET);
    return {
      id,
      startAngle: s.start,
      endAngle: s.end,
      midAngle: s.mid,
      labelX: round2(label.x),
      labelY: round2(label.y),
      outerRadius,
    };
  });

  return {
    nodes,
    edges,
    branches,
    rings,
    hubTargets: graph.ids.filter((id) => depth.get(id) === 0),
    bounds: computeBounds(nodes, branches, o.nodeSize),
  };
}

// ---------------------------------------------------------------- graph

interface Graph {
  /** Unique skill ids in input order (later duplicates dropped). */
  ids: string[];
  skills: Map<string, LayoutSkillInput>;
  /** Known prerequisite ids, deduped, no self-links: skill requires first, then rank requires. */
  prereqs: Map<string, string[]>;
  /** `${prereq}->${dependent}` pairs that come from a skill-level `requires`. */
  skillLevel: Set<string>;
}

function buildGraph(input: LayoutInput): Graph {
  const skills = new Map<string, LayoutSkillInput>();
  for (const s of input.skills) if (!skills.has(s.id)) skills.set(s.id, s);
  const ids = [...skills.keys()];
  const prereqs = new Map<string, string[]>();
  const skillLevel = new Set<string>();
  for (const id of ids) {
    const s = skills.get(id);
    if (!s) continue;
    const known = (list: string[]) => list.filter((p) => p !== id && skills.has(p));
    const req = unique(known(s.requires));
    for (const p of req) skillLevel.add(`${p}->${id}`);
    prereqs.set(id, unique([...req, ...known(s.rankRequires)]));
  }
  return { ids, skills, prereqs, skillLevel };
}

/**
 * Longest-path depth over skill + rank requires. DFS in input order; an edge
 * into a skill still on the stack closes a cycle and is ignored, so every
 * remaining ("DAG") edge points from a smaller depth to a larger one.
 */
function computeDepths(graph: Graph): { depth: Map<string, number>; dagPrereqs: Map<string, string[]> } {
  const depth = new Map<string, number>();
  const dagPrereqs = new Map<string, string[]>();
  const onStack = new Set<string>();

  const visit = (id: string): number => {
    const known = depth.get(id);
    if (known !== undefined) return known;
    onStack.add(id);
    let d = 0;
    const kept: string[] = [];
    for (const p of graph.prereqs.get(id) ?? []) {
      if (onStack.has(p)) continue;
      kept.push(p);
      d = Math.max(d, visit(p) + 1);
    }
    onStack.delete(id);
    depth.set(id, d);
    dagPrereqs.set(id, kept);
    return d;
  };

  for (const id of graph.ids) visit(id);
  return { depth, dagPrereqs };
}

/** Branch ids in display order; skills pointing at an unlisted branch get one appended. */
function resolveBranches(input: LayoutInput, graph: Graph): string[] {
  const ids = unique(input.branches.map((b) => b.id));
  const seen = new Set(ids);
  for (const id of graph.ids) {
    const b = graph.skills.get(id)?.branchId ?? "";
    if (!seen.has(b)) {
      seen.add(b);
      ids.push(b);
    }
  }
  return ids;
}

// ---------------------------------------------------------------- slots

/**
 * A thing that takes room on a ring: a skill, or a virtual point where a
 * same-branch edge spanning several rings crosses an intermediate ring.
 * Reserving those points keeps long edges from running through other nodes
 * and lets them take part in crossing reduction (as in Sugiyama layouts).
 */
interface Slot {
  id: string;
  branch: number;
  depth: number;
  virtual: boolean;
  /** Same branch, one ring in. */
  parents: string[];
  /** Same branch, one ring out. */
  children: string[];
  /** Skills in other branches this one requires. */
  crossParents: string[];
}

interface SlotPlan {
  slots: Map<string, Slot>;
  /** groups[branch][depth] = slot ids: skills in input order, then virtual points. */
  groups: string[][][];
  /** `${prereq}->${dependent}` → the virtual points along that edge, inner to outer. */
  chains: Map<string, string[]>;
}

function buildSlots(
  ids: string[],
  dagPrereqs: Map<string, string[]>,
  depth: Map<string, number>,
  branchOf: (id: string) => number,
  branchCount: number,
  maxDepth: number,
): SlotPlan {
  const slots = new Map<string, Slot>();
  const chains = new Map<string, string[]>();
  const groups = Array.from({ length: branchCount }, () =>
    Array.from({ length: maxDepth + 1 }, (): string[] => []),
  );
  const add = (id: string, branch: number, d: number, virtual: boolean): Slot => {
    const slot: Slot = { id, branch, depth: d, virtual, parents: [], children: [], crossParents: [] };
    slots.set(id, slot);
    groups[branch][d].push(id);
    return slot;
  };
  const link = (parent: Slot, child: Slot) => {
    parent.children.push(child.id);
    child.parents.push(parent.id);
  };

  for (const id of ids) add(id, branchOf(id), depth.get(id) ?? 0, false);
  for (const id of ids) {
    const child = slots.get(id);
    if (!child) continue;
    for (const p of dagPrereqs.get(id) ?? []) {
      const parent = slots.get(p);
      if (!parent) continue;
      if (parent.branch !== child.branch) {
        child.crossParents.push(p);
        continue;
      }
      let previous = parent;
      const via: string[] = [];
      for (let d = parent.depth + 1; d < child.depth; d++) {
        const point = add(`${p}->${id}#${d}`, child.branch, d, true);
        link(previous, point);
        via.push(point.id);
        previous = point;
      }
      link(previous, child);
      if (via.length > 0) chains.set(`${p}->${id}`, via);
    }
  }
  return { slots, groups, chains };
}

function realGroups(plan: SlotPlan): string[][][] {
  return plan.groups.map((levels) => levels.map((ids) => ids.filter((id) => !plan.slots.get(id)?.virtual)));
}

// ---------------------------------------------------------------- sectors and rings

interface Sector {
  start: number;
  end: number;
  mid: number;
  size: number;
}

function branchWeight(levels: string[][]): number {
  const widest = levels.reduce((m, ids) => Math.max(m, ids.length), 0);
  const count = levels.reduce((n, ids) => n + ids.length, 0);
  // The widest level drives how much arc a branch needs; sqrt(count) keeps a
  // deep-but-narrow branch from getting a sliver.
  return Math.max(2, 0.7 * widest + 0.3 * Math.sqrt(count));
}

/**
 * Sectors clockwise in branch order, sized by weight, no wider than
 * MAX_SECTOR (the excess is shared among the rest), then rotated so the
 * widest sector is centred straight up.
 */
function computeSectors(groups: string[][][], sectorGap: number): Sector[] {
  const n = groups.length;
  if (n === 0) return [];
  const gap = Math.min(sectorGap, TAU / (2 * n));
  const weights = groups.map(branchWeight);
  const available = TAU - n * gap;

  const sizes = weights.map(() => 0);
  const capped = new Set<number>();
  for (;;) {
    const free = weights.flatMap((_, i) => (capped.has(i) ? [] : [i]));
    const remaining = available - capped.size * MAX_SECTOR;
    const total = free.reduce((sum, i) => sum + weights[i], 0);
    for (const i of free) sizes[i] = total > 0 ? (remaining * weights[i]) / total : 0;
    const over = free.filter((i) => sizes[i] > MAX_SECTOR);
    if (over.length === 0) break;
    for (const i of over) {
      capped.add(i);
      sizes[i] = MAX_SECTOR;
    }
  }

  // Angle the cap leaves unused (only possible with one branch) widens the gaps.
  const leftover = Math.max(0, available - sizes.reduce((a, b) => a + b, 0));
  const effectiveGap = gap + leftover / n;
  const local: { start: number; end: number }[] = [];
  let cursor = 0;
  for (const size of sizes) {
    const start = cursor + effectiveGap / 2;
    local.push({ start, end: start + size });
    cursor = start + size + effectiveGap / 2;
  }

  const widest = sizes.reduce((best, size, i) => (size > sizes[best] ? i : best), 0);
  const rotation = -(local[widest].start + local[widest].end) / 2;
  return local.map(({ start, end }, i) => {
    const mid = wrapFrom((start + end) / 2 + rotation, -Math.PI);
    return { start: mid - sizes[i] / 2, end: mid + sizes[i] / 2, mid, size: sizes[i] };
  });
}

/**
 * rings[d] starts at innerRadius + d·ringGap and grows until every branch's
 * depth-d slots fit in its sector at full spacing; rings stay at least
 * max(0.8·ringGap, spacing) apart so nodes on different rings can't collide.
 */
function computeRings(
  plan: SlotPlan,
  sectors: Sector[],
  maxDepth: number,
  o: Required<LayoutOptions>,
): number[] {
  const spacing = o.nodeSize + o.minGap;
  const minStep = Math.max(o.ringGap * MIN_RING_STEP, spacing);
  const rings: number[] = [];
  for (let d = 0; d <= maxDepth; d++) {
    let r = o.innerRadius + d * o.ringGap;
    plan.groups.forEach((levels, b) => {
      const widths = levels[d].map((id) => slotWidth(plan, id, spacing));
      r = Math.max(r, radiusToFit(widths, sectors[b].size));
    });
    if (d > 0) r = Math.max(r, rings[d - 1] + minStep);
    rings.push(Math.ceil(r));
  }
  return rings;
}

/** Centre-to-centre room a slot needs, in px. */
function slotWidth(plan: SlotPlan, id: string, spacing: number): number {
  return plan.slots.get(id)?.virtual ? spacing * VIRTUAL_WIDTH : spacing;
}

// ---------------------------------------------------------------- angles within sectors

/**
 * Ring-by-ring barycentre placement: a downward pass (children toward their
 * parents), then SWEEPS up/down pairs to cut crossings. The pass with the
 * fewest same-branch crossings wins; ties go to the latest downward pass, so
 * children end up near their parents.
 */
function placeSlots(plan: SlotPlan, sectors: Sector[], rings: number[], spacing: number): Map<string, number> {
  const state: SweepState = {
    angles: new Map(),
    anchors: initialAnchors(plan, sectors),
    leans: new Map(),
  };
  const maxDepth = rings.length - 1;

  const pass = (direction: "down" | "up") => {
    for (let step = 0; step <= maxDepth; step++) {
      const d = direction === "down" ? step : maxDepth - step;
      plan.groups.forEach((levels, b) => {
        const ids = levels[d];
        if (ids.length === 0) return;
        const ideals = new Map(ids.map((id) => [id, idealAngle(plan, sectors[b], id, direction, state)]));
        placeGroup(plan, sectors[b], rings[d], spacing, ids, ideals, state.angles);
      });
    }
  };

  // Sweeps can trade one crossing for another; keep the best result,
  // preferring downward passes (children near parents) on ties.
  pass("down");
  let best = new Map(state.angles);
  let bestCrossings = countCrossings(plan, state.angles);
  for (let i = 0; i < SWEEPS; i++) {
    for (const direction of ["up", "down"] as const) {
      pass(direction);
      const crossings = countCrossings(plan, state.angles);
      if (crossings < bestCrossings || (crossings === bestCrossings && direction === "down")) {
        best = new Map(state.angles);
        bestCrossings = crossings;
      }
    }
  }
  return best;
}

interface SweepState {
  angles: Map<string, number>;
  /**
   * Where a slot with no same-branch parent wants to sit: downward passes
   * read it, upward passes move it toward the slot's children.
   */
  anchors: Map<string, number>;
  /**
   * How far the last downward pass leaned each slot toward its cross-branch
   * prerequisites. Upward passes subtract it, so a lean moves a subtree once
   * instead of compounding through parents on every sweep.
   */
  leans: Map<string, number>;
}

function idealAngle(
  plan: SlotPlan,
  sector: Sector,
  id: string,
  direction: "down" | "up",
  state: SweepState,
): number {
  const slot = plan.slots.get(id);
  if (!slot) return sector.mid;
  const isRoot = slot.parents.length === 0;
  const own = () =>
    isRoot
      ? (state.anchors.get(id) ?? sector.mid)
      : (state.angles.get(id) ?? sector.mid) - (state.leans.get(id) ?? 0);

  if (direction === "up") {
    const kids = slot.children.flatMap((c) => {
      const a = state.angles.get(c);
      return a === undefined ? [] : [a - (state.leans.get(c) ?? 0)];
    });
    const ideal = kids.length > 0 ? mean(kids) : own();
    if (isRoot && kids.length > 0) state.anchors.set(id, ideal);
    // Placed lean-free now; the next downward pass leans it again.
    state.leans.set(id, 0);
    return ideal;
  }

  const parents = slot.parents.flatMap((p) => {
    const a = state.angles.get(p);
    return a === undefined ? [] : [a];
  });
  const base = parents.length > 0 ? mean(parents) : own();
  const weight = Math.max(1, parents.length);
  let sum = base * weight;
  let total = weight;
  for (const p of slot.crossParents) {
    const a = state.angles.get(p);
    if (a === undefined) continue;
    // A cross-branch prerequisite only leans the node toward the edge facing
    // the other branch; it never drags it across its own sector.
    sum += CROSS_BRANCH_PULL * nearestEdge(sector, a);
    total += CROSS_BRANCH_PULL;
  }
  const ideal = sum / total;
  state.leans.set(id, ideal - base);
  return ideal;
}

function placeGroup(
  plan: SlotPlan,
  sector: Sector,
  radius: number,
  spacing: number,
  ids: string[],
  ideals: Map<string, number>,
  angles: Map<string, number>,
): void {
  const ideal = (id: string) => ideals.get(id) ?? sector.mid;
  const order = [...ids].sort(
    (x, y) =>
      ideal(x) - ideal(y) ||
      (angles.get(x) ?? 0) - (angles.get(y) ?? 0) ||
      compareStrings(x, y),
  );
  transpose(plan, order, angles);
  const widths = order.map((id) => chordAngle(slotWidth(plan, id, spacing), radius));
  const positions = separate(order.map(ideal), widths, sector.start, sector.end);
  order.forEach((id, i) => angles.set(id, positions[i]));
}

/**
 * Adjacent-exchange refinement: swap neighbours in `order` (in place) while
 * that strictly reduces crossings with the already placed rings on either side.
 */
function transpose(plan: SlotPlan, order: string[], angles: Map<string, number>): void {
  const neighbours = (id: string) => {
    const slot = plan.slots.get(id);
    return [slot?.parents ?? [], slot?.children ?? []].map((ring) =>
      ring.flatMap((n) => {
        const a = angles.get(n);
        return a === undefined ? [] : [a];
      }),
    );
  };
  // Crossings between x's and y's edges when x sits left of y.
  const cost = (x: string, y: string) => {
    const nx = neighbours(x);
    const ny = neighbours(y);
    let c = 0;
    for (let side = 0; side < 2; side++) {
      for (const a of nx[side]) for (const b of ny[side]) if (a > b) c++;
    }
    return c;
  };
  for (let round = 0; round < order.length; round++) {
    let improved = false;
    for (let i = 0; i + 1 < order.length; i++) {
      if (cost(order[i + 1], order[i]) < cost(order[i], order[i + 1])) {
        [order[i], order[i + 1]] = [order[i + 1], order[i]];
        improved = true;
      }
    }
    if (!improved) break;
  }
}

/** Same-branch edge crossings between adjacent rings (virtual points make every edge span one ring). */
function countCrossings(plan: SlotPlan, angles: Map<string, number>): number {
  let total = 0;
  for (const levels of plan.groups) {
    for (const ids of levels) {
      const edges: [number, number][] = [];
      for (const id of ids) {
        const from = angles.get(id);
        if (from === undefined) continue;
        for (const child of plan.slots.get(id)?.children ?? []) {
          const to = angles.get(child);
          if (to !== undefined) edges.push([from, to]);
        }
      }
      for (let i = 0; i < edges.length; i++) {
        for (let j = i + 1; j < edges.length; j++) {
          if ((edges[i][0] - edges[j][0]) * (edges[i][1] - edges[j][1]) < 0) total++;
        }
      }
    }
  }
  return total;
}

/**
 * Starting anchors for skills with no same-branch prerequisite: in each
 * ring, they split their sector into shares weighted by how much of the
 * branch grows from them, and sit in the middle of their share.
 */
function initialAnchors(plan: SlotPlan, sectors: Sector[]): Map<string, number> {
  const anchors = new Map<string, number>();
  plan.groups.forEach((levels, b) => {
    const sector = sectors[b];
    for (const ids of levels) {
      const roots = ids.filter((id) => plan.slots.get(id)?.parents.length === 0);
      const weights = roots.map((id) => 1 + descendantCount(plan, id));
      const total = weights.reduce((a, w) => a + w, 0);
      let cursor = 0;
      roots.forEach((id, i) => {
        anchors.set(id, sector.start + ((cursor + weights[i] / 2) / total) * sector.size);
        cursor += weights[i];
      });
    }
  });
  return anchors;
}

/** Skills (not virtual points) reachable through same-branch children. */
function descendantCount(plan: SlotPlan, id: string): number {
  const seen = new Set<string>();
  const stack = [id];
  let count = 0;
  while (stack.length > 0) {
    const current = stack.pop() ?? "";
    for (const child of plan.slots.get(current)?.children ?? []) {
      if (seen.has(child)) continue;
      seen.add(child);
      stack.push(child);
      if (!plan.slots.get(child)?.virtual) count += 1;
    }
  }
  return count;
}

function nearestEdge(sector: Sector, angle: number): number {
  return angularDistance(angle, sector.start) <= angularDistance(angle, sector.end)
    ? sector.start
    : sector.end;
}

// ---------------------------------------------------------------- output helpers

function computeBounds(
  nodes: LayoutNode[],
  branches: LayoutBranch[],
  nodeSize: number,
): LayoutResult["bounds"] {
  // The hub at the origin is always drawn.
  let minX = -nodeSize;
  let minY = -nodeSize;
  let maxX = nodeSize;
  let maxY = nodeSize;
  const include = (x: number, y: number, padX: number, padY: number) => {
    minX = Math.min(minX, x - padX);
    minY = Math.min(minY, y - padY);
    maxX = Math.max(maxX, x + padX);
    maxY = Math.max(maxY, y + padY);
  };
  for (const n of nodes) include(n.x, n.y, nodeSize, nodeSize);
  // Labels are wider than tall; give them two node widths either side.
  for (const b of branches) include(b.labelX, b.labelY, nodeSize * 2, nodeSize);
  return { minX: round2(minX), minY: round2(minY), maxX: round2(maxX), maxY: round2(maxY) };
}

function resolveOptions(opts: LayoutOptions): Required<LayoutOptions> {
  const pick = (value: number | undefined, fallback: number, min: number) =>
    value !== undefined && Number.isFinite(value) && value >= min ? value : fallback;
  return {
    nodeSize: pick(opts.nodeSize, DEFAULTS.nodeSize, 1),
    minGap: pick(opts.minGap, DEFAULTS.minGap, 0),
    innerRadius: pick(opts.innerRadius, DEFAULTS.innerRadius, 0),
    ringGap: pick(opts.ringGap, DEFAULTS.ringGap, 0),
    sectorGap: pick(opts.sectorGap, DEFAULTS.sectorGap, 0),
  };
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}

function mean(values: number[]): number {
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function compareStrings(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100 + 0;
}

// ---------------------------------------------------------------- SVG preview

const PREVIEW_COLORS = ["#60a5fa", "#f59e0b", "#a78bfa", "#34d399", "#f472b6", "#f87171", "#22d3ee", "#a3e635"];

/**
 * A static SVG of a layout (rings, sector edges, edges, nodes, labels) for
 * eyeballing the shape outside the app. Not used by the canvas itself.
 */
export function layoutToSvg(result: LayoutResult, opts: { nodeSize?: number } = {}): string {
  const nodeSize = opts.nodeSize ?? DEFAULTS.nodeSize;
  const { minX, minY, maxX, maxY } = result.bounds;
  const color = new Map(result.branches.map((b, i) => [b.id, PREVIEW_COLORS[i % PREVIEW_COLORS.length]]));
  const pos = new Map(result.nodes.map((n) => [n.id, n]));
  const f = (v: number) => String(round2(v));
  const parts: string[] = [];

  parts.push(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${f(minX)} ${f(minY)} ${f(maxX - minX)} ${f(maxY - minY)}" width="${f((maxX - minX) / 2)}" height="${f((maxY - minY) / 2)}" font-family="system-ui, sans-serif">`,
    `<rect x="${f(minX)}" y="${f(minY)}" width="${f(maxX - minX)}" height="${f(maxY - minY)}" fill="#0b1020"/>`,
  );
  for (const r of result.rings) {
    parts.push(`<circle cx="0" cy="0" r="${f(r)}" fill="none" stroke="#1e293b" stroke-width="2"/>`);
  }
  for (const b of result.branches) {
    for (const a of [b.startAngle, b.endAngle]) {
      const p = polar(a, b.outerRadius + nodeSize);
      parts.push(`<line x1="0" y1="0" x2="${f(p.x)}" y2="${f(p.y)}" stroke="#1e293b" stroke-width="2"/>`);
    }
  }
  for (const id of result.hubTargets) {
    const n = pos.get(id);
    if (n) parts.push(`<line x1="0" y1="0" x2="${f(n.x)}" y2="${f(n.y)}" stroke="#334155" stroke-width="2"/>`);
  }
  for (const e of result.edges) {
    const s = pos.get(e.source);
    const t = pos.get(e.target);
    if (!s || !t) continue;
    const points = [s, ...(e.waypoints ?? []), t].map((p) => `${f(p.x)},${f(p.y)}`).join(" ");
    const dash = e.kind === "rank-requires" ? ' stroke-dasharray="4 8"' : e.crossBranch ? ' stroke-dasharray="14 8"' : "";
    const stroke = e.crossBranch ? "#e2e8f0" : (color.get(s.branchId) ?? "#94a3b8");
    parts.push(
      `<polyline points="${points}" fill="none" stroke="${stroke}" stroke-opacity="0.7" stroke-width="3"${dash}/>`,
    );
  }
  parts.push(`<circle cx="0" cy="0" r="${f(nodeSize * 0.6)}" fill="#f8fafc"/>`);
  for (const n of result.nodes) {
    const label = escapeXml(n.id.includes(".") ? n.id.slice(n.id.indexOf(".") + 1) : n.id);
    parts.push(
      `<g><title>${escapeXml(n.id)} (depth ${n.depth})</title>`,
      `<circle cx="${f(n.x)}" cy="${f(n.y)}" r="${f(nodeSize / 2)}" fill="#0f172a" stroke="${color.get(n.branchId) ?? "#94a3b8"}" stroke-width="5"/>`,
      `<text x="${f(n.x)}" y="${f(n.y + 4)}" font-size="11" fill="#e2e8f0" text-anchor="middle">${label}</text></g>`,
    );
  }
  for (const b of result.branches) {
    parts.push(
      `<text x="${f(b.labelX)}" y="${f(b.labelY)}" font-size="30" font-weight="700" fill="${color.get(b.id) ?? "#94a3b8"}" text-anchor="middle" dominant-baseline="middle">${escapeXml(b.id)}</text>`,
    );
  }
  parts.push("</svg>");
  return parts.join("\n");
}

function escapeXml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
