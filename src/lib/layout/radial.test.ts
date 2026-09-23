import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import type { Branch, ContentTree, Rank, Skill } from "@/lib/content/types";
import { angularDistance, chordAngle, radiusToFit, separate, TAU } from "@/lib/layout/geometry";
import {
  layoutInputFromContent,
  layoutToSvg,
  polar,
  radialLayout,
  type LayoutInput,
  type LayoutOptions,
  type LayoutResult,
  type LayoutSkillInput,
} from "@/lib/layout/radial";

// ---------------------------------------------------------------- fixtures

function skill(id: string, requires: string[] = [], rankRequires: string[] = []): LayoutSkillInput {
  return { id, branchId: id.slice(0, id.indexOf(".")), requires, rankRequires };
}

function input(branches: string[], skills: LayoutSkillInput[]): LayoutInput {
  return { branches: branches.map((id) => ({ id })), skills };
}

/** Transcribed from crypto-finance-the-tie.skilltree.md (checked against the file below). */
const SEED: LayoutInput = input(
  ["swe", "finance", "crypto"],
  [
    skill("swe.react"),
    skill("swe.nextjs", ["swe.react"]),
    skill("swe.graphql"),
    skill("swe.web3-frontend", ["swe.react"]),
    skill("swe.claude-code"),
    skill("finance.money-settlement"),
    skill("finance.market-structure", ["finance.money-settlement"]),
    skill("finance.institutions", ["finance.market-structure"]),
    skill("finance.capital-formation", ["finance.market-structure"]),
    skill("finance.market-intelligence", [], ["crypto.staking-metrics", "finance.market-structure"]),
    skill("finance.regulation", ["finance.money-settlement"]),
    skill("crypto.consensus"),
    skill("crypto.eth-validators", ["crypto.consensus"]),
    skill("crypto.staking-metrics", ["crypto.eth-validators"]),
    skill("crypto.ethereum-staking", ["crypto.eth-validators", "crypto.staking-metrics"]),
    skill("crypto.solana-staking", ["crypto.staking-metrics"]),
    skill("crypto.cosmos-staking", ["crypto.consensus", "crypto.staking-metrics"]),
    skill("crypto.liquid-staking", ["crypto.ethereum-staking"]),
    skill("crypto.institutional-staking", ["crypto.liquid-staking"]),
    skill("crypto.onchain-data", [
      "swe.web3-frontend",
      "crypto.ethereum-staking",
      "crypto.solana-staking",
      "crypto.cosmos-staking",
    ]),
    skill("crypto.defi-mechanics", ["crypto.consensus"]),
    skill("crypto.onchain-yield", ["crypto.defi-mechanics", "crypto.staking-metrics"]),
    skill("crypto.defi-risk", ["crypto.onchain-yield", "crypto.liquid-staking"]),
    skill("crypto.infrastructure", ["crypto.consensus"]),
  ],
);

/**
 * Just enough of the bundle format to read ids and requires, so the
 * transcription above can't silently drift from the real seed.
 */
function extractSeedRequires(markdown: string): LayoutInput {
  const branches: string[] = [];
  const skills: LayoutSkillInput[] = [];
  let mode: "none" | "branch" | "skill" | "rank" | "other" = "none";
  let current: LayoutSkillInput | null = null;
  const list = (value: string) =>
    value
      .split(",")
      .map((v) => v.trim())
      .filter((v) => v !== "" && v !== "—" && v !== "-");
  for (const line of markdown.split("\n")) {
    if (line.startsWith("# Quest:")) break;
    if (line.startsWith("# Branch:")) mode = "branch";
    else if (line.startsWith("## ") && mode !== "none") mode = "skill";
    else if (line.startsWith("### Rank") && current) mode = "rank";
    else if (line.startsWith("### ")) mode = "other";
    const id = /^- id: (\S+)/.exec(line)?.[1];
    if (id && mode === "branch") branches.push(id);
    if (id && mode === "skill") {
      current = { id, branchId: branches[branches.length - 1], requires: [], rankRequires: [] };
      skills.push(current);
    }
    const req = /^- requires:(.*)$/.exec(line)?.[1];
    if (req !== undefined && current && mode === "skill") current.requires.push(...list(req));
    if (req !== undefined && current && mode === "rank") current.rankRequires.push(...list(req));
  }
  return input(branches, skills);
}

/** Tiny deterministic PRNG (mulberry32). */
function prng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Random prerequisite DAG: mostly same-branch requires, some cross-branch rank requires. */
function randomTree(seed: number, branchCount = 8, perBranch = 15): LayoutInput {
  const rand = prng(seed);
  const pick = (ids: string[]) => ids[Math.floor(rand() * ids.length)];
  const branches = Array.from({ length: branchCount }, (_, i) => `b${i}`);
  const skills: LayoutSkillInput[] = [];
  const earlier: string[] = [];
  for (const b of branches) {
    const own: string[] = [];
    for (let k = 0; k < perBranch; k++) {
      const requires: string[] = [];
      const rankRequires: string[] = [];
      const count = rand() < 0.2 ? 0 : 1 + Math.floor(rand() * 2);
      for (let j = 0; j < count && own.length > 0; j++) requires.push(pick(own));
      if (rand() < 0.12 && earlier.length > 0) rankRequires.push(pick(earlier));
      if (rand() < 0.05 && own.length > 0) rankRequires.push(pick(own));
      const id = `${b}.s${k}`;
      skills.push({ id, branchId: b, requires, rankRequires });
      own.push(id);
    }
    earlier.push(...own);
  }
  return input(branches, skills);
}

// ---------------------------------------------------------------- invariants

const EPS = 1e-9;

function expectValidLayout(result: LayoutResult, opts: LayoutOptions = {}, acyclic = true): void {
  const nodeSize = opts.nodeSize ?? 76;
  const minGap = opts.minGap ?? 56;
  const ringGap = opts.ringGap ?? 190;
  const byId = new Map(result.nodes.map((n) => [n.id, n]));
  const branches = new Map(result.branches.map((b) => [b.id, b]));

  for (const n of result.nodes) {
    const b = branches.get(n.branchId);
    expect(b, n.id).toBeDefined();
    if (!b) continue;
    expect(n.angle, n.id).toBeGreaterThanOrEqual(b.startAngle - EPS);
    expect(n.angle, n.id).toBeLessThanOrEqual(b.endAngle + EPS);
    expect(n.radius).toBe(result.rings[n.depth]);
    expect(Math.hypot(n.x, n.y)).toBeCloseTo(n.radius, 1);
  }

  const minDistance = nodeSize + minGap * 0.8;
  for (let i = 0; i < result.nodes.length; i++) {
    for (let j = i + 1; j < result.nodes.length; j++) {
      const a = result.nodes[i];
      const c = result.nodes[j];
      const d = Math.hypot(a.x - c.x, a.y - c.y);
      expect(d, `${a.id} vs ${c.id}`).toBeGreaterThanOrEqual(minDistance);
    }
  }

  for (let i = 1; i < result.rings.length; i++) {
    expect(result.rings[i] - result.rings[i - 1]).toBeGreaterThanOrEqual(ringGap * 0.8);
  }

  // Sectors never overlap, are in branch order clockwise, and together make at most one turn.
  const bs = result.branches;
  let turn = 0;
  for (let i = 0; i < bs.length; i++) {
    const a = bs[i];
    expect(a.startAngle).toBeLessThan(a.midAngle);
    expect(a.midAngle).toBeLessThan(a.endAngle);
    for (let j = i + 1; j < bs.length; j++) {
      const c = bs[j];
      const halfSum = (a.endAngle - a.startAngle + c.endAngle - c.startAngle) / 2;
      expect(angularDistance(a.midAngle, c.midAngle) + EPS).toBeGreaterThanOrEqual(halfSum);
    }
    if (bs.length > 1) {
      const next = bs[(i + 1) % bs.length];
      turn += (((next.midAngle - a.midAngle) % TAU) + TAU) % TAU;
    }
  }
  if (bs.length > 1) expect(turn).toBeCloseTo(TAU, 9);

  for (const e of result.edges) {
    const s = byId.get(e.source);
    const t = byId.get(e.target);
    expect(s && t, e.id).toBeTruthy();
    if (!s || !t) continue;
    expect(e.id).toBe(`${e.source}->${e.target}`);
    expect(e.crossBranch).toBe(s.branchId !== t.branchId);
    if (acyclic) expect(t.radius, e.id).toBeGreaterThan(s.radius);
    // Long same-branch edges run through reserved points that no node sits on.
    for (const w of e.waypoints ?? []) {
      for (const n of result.nodes) {
        expect(Math.hypot(n.x - w.x, n.y - w.y), `${e.id} via ${n.id}`).toBeGreaterThan(
          nodeSize / 2 + minGap / 2,
        );
      }
    }
  }

  const { minX, minY, maxX, maxY } = result.bounds;
  for (const n of result.nodes) {
    expect(n.x - nodeSize).toBeGreaterThanOrEqual(minX - 0.01);
    expect(n.x + nodeSize).toBeLessThanOrEqual(maxX + 0.01);
    expect(n.y - nodeSize).toBeGreaterThanOrEqual(minY - 0.01);
    expect(n.y + nodeSize).toBeLessThanOrEqual(maxY + 0.01);
  }
  for (const b of result.branches) {
    expect(b.labelX).toBeGreaterThanOrEqual(minX);
    expect(b.labelX).toBeLessThanOrEqual(maxX);
    expect(b.labelY).toBeGreaterThanOrEqual(minY);
    expect(b.labelY).toBeLessThanOrEqual(maxY);
  }
}

function nodeOf(result: LayoutResult, id: string) {
  const n = result.nodes.find((x) => x.id === id);
  if (!n) throw new Error(`no node ${id}`);
  return n;
}

function branchOf(result: LayoutResult, id: string) {
  const b = result.branches.find((x) => x.id === id);
  if (!b) throw new Error(`no branch ${id}`);
  return b;
}

// ---------------------------------------------------------------- tests

describe("polar", () => {
  it("puts angle 0 straight up and increases clockwise", () => {
    expect(polar(0, 100)).toEqual({ x: 0, y: -100 });
    const right = polar(Math.PI / 2, 100);
    expect(right.x).toBeCloseTo(100, 9);
    expect(right.y).toBeCloseTo(0, 9);
    const down = polar(Math.PI, 100);
    expect(down.x).toBeCloseTo(0, 9);
    expect(down.y).toBeCloseTo(100, 9);
    expect(polar(-Math.PI / 2, 100).x).toBeCloseTo(-100, 9);
    expect(polar(1, 0)).toEqual({ x: 0, y: 0 });
  });
});

describe("geometry helpers", () => {
  it("separate keeps order, spacing and bounds, and leaves distant clusters alone", () => {
    const out = separate([0, 0, 0, 5], [1, 1, 1, 1], -10, 10);
    expect(out[0]).toBeCloseTo(-1, 9);
    expect(out[1]).toBeCloseTo(0, 9);
    expect(out[2]).toBeCloseTo(1, 9);
    expect(out[3]).toBeCloseTo(5, 9);
    const clamped = separate([9, 9, 9], [1, 1, 1], 0, 10);
    expect(clamped.map((v) => Math.round(v * 1e9) / 1e9)).toEqual([7.5, 8.5, 9.5]);
    const mixed = separate([0, 0], [1, 0.5], -5, 5);
    expect(mixed[1] - mixed[0]).toBeCloseTo(0.75, 9);
    expect(separate([], [], 0, 1)).toEqual([]);
  });

  it("radiusToFit returns the smallest radius where the chord spacing fits", () => {
    const r = radiusToFit([132, 132, 132], 1);
    expect(3 * chordAngle(132, r)).toBeLessThanOrEqual(1 + 1e-9);
    expect(3 * chordAngle(132, r * 0.99)).toBeGreaterThan(1);
    expect(radiusToFit([], 1)).toBe(0);
    expect(radiusToFit([132], 4)).toBe(66);
  });
});

describe("radialLayout basics", () => {
  it("handles empty input", () => {
    const r = radialLayout({ branches: [], skills: [] });
    expect(r.nodes).toEqual([]);
    expect(r.edges).toEqual([]);
    expect(r.branches).toEqual([]);
    expect(r.rings).toEqual([]);
    expect(r.hubTargets).toEqual([]);
    expect(r.bounds).toEqual({ minX: -76, minY: -76, maxX: 76, maxY: 76 });
  });

  it("gives empty branches a sector and a label", () => {
    const r = radialLayout(input(["a", "b", "c"], []));
    expect(r.branches).toHaveLength(3);
    expectValidLayout(r);
    expect(r.branches[0].midAngle).toBeCloseTo(0, 9);
    for (const b of r.branches) expect(b.outerRadius).toBe(240);
  });

  it("is deterministic", () => {
    expect(JSON.stringify(radialLayout(SEED))).toBe(JSON.stringify(radialLayout(SEED)));
    const random = randomTree(7);
    expect(radialLayout(random)).toEqual(radialLayout(structuredClone(random)));
  });

  it("gives a single branch at most ~200°, centred straight up", () => {
    const r = radialLayout(
      input(["solo"], [skill("solo.a"), skill("solo.b", ["solo.a"]), skill("solo.c", ["solo.a"])]),
    );
    const b = r.branches[0];
    expect(b.endAngle - b.startAngle).toBeLessThanOrEqual((200 / 180) * Math.PI + EPS);
    expect(b.midAngle).toBeCloseTo(0, 9);
    expectValidLayout(r);
  });

  it("caps a dominant sector and gives the rest to the others", () => {
    const wide = Array.from({ length: 12 }, (_, i) => skill(`big.s${i}`));
    const r = radialLayout(input(["big", "small"], [...wide, skill("small.a")]));
    const [big, small] = r.branches;
    expect(big.endAngle - big.startAngle).toBeCloseTo((200 / 180) * Math.PI, 9);
    expect(small.endAngle - small.startAngle).toBeCloseTo(TAU - 2 * 0.18 - (200 / 180) * Math.PI, 9);
    expect(big.midAngle).toBeCloseTo(0, 9);
    expectValidLayout(r);
  });

  it("appends a sector for skills whose branch isn't listed", () => {
    const r = radialLayout(input(["a"], [skill("a.x"), skill("ghost.y", ["a.x"])]));
    expect(r.branches.map((b) => b.id)).toEqual(["a", "ghost"]);
    expect(nodeOf(r, "ghost.y").branchId).toBe("ghost");
    expectValidLayout(r);
  });

  it("respects custom options", () => {
    const opts: LayoutOptions = { nodeSize: 40, minGap: 20, innerRadius: 100, ringGap: 80, sectorGap: 0.3 };
    const r = radialLayout(SEED, opts);
    expect(r.rings[0]).toBeGreaterThanOrEqual(100);
    expectValidLayout(r, opts);
    const big = radialLayout(SEED, { ...opts, innerRadius: 600 });
    expect(big.rings[0]).toBe(600);
  });
});

describe("depth, edges and hub targets", () => {
  it("builds one edge per (prerequisite, dependent) with the right kind", () => {
    const r = radialLayout(
      input(
        ["a", "b"],
        [
          skill("a.root"),
          skill("a.both", ["a.root", "a.root"], ["a.root"]),
          skill("a.rank", [], ["a.root", "a.missing"]),
          skill("a.self", ["a.self", "nowhere.x"]),
          skill("b.cross", [], ["a.rank"]),
        ],
      ),
    );
    expect(r.edges.map(({ id, kind, crossBranch }) => ({ id, kind, crossBranch }))).toEqual([
      { id: "a.root->a.both", kind: "requires", crossBranch: false },
      { id: "a.root->a.rank", kind: "rank-requires", crossBranch: false },
      { id: "a.rank->b.cross", kind: "rank-requires", crossBranch: true },
    ]);
    expect(r.hubTargets).toEqual(["a.root", "a.self"]);
    expect(nodeOf(r, "b.cross").depth).toBe(2);
    expectValidLayout(r);
  });

  it("drops duplicate skill ids, keeping the first", () => {
    const r = radialLayout(input(["a"], [skill("a.x"), skill("a.y", ["a.x"]), skill("a.x", ["a.y"])]));
    expect(r.nodes.map((n) => n.id)).toEqual(["a.x", "a.y"]);
    expect(r.edges.map((e) => e.id)).toEqual(["a.x->a.y"]);
  });

  it("terminates on cycles and still places every skill", () => {
    const cyclic = input(
      ["a", "b"],
      [
        skill("a.p", ["a.q"]),
        skill("a.q", ["a.r"]),
        skill("a.r", ["a.p"]),
        skill("a.s", ["a.s"]),
        skill("b.x", [], ["b.y"]),
        skill("b.y", ["b.x"]),
        skill("b.z", ["a.p", "b.y"]),
      ],
    );
    const r = radialLayout(cyclic);
    expect(r.nodes).toHaveLength(7);
    for (const n of r.nodes) expect(Number.isFinite(n.depth)).toBe(true);
    expect(r.edges.map((e) => e.id)).toContain("a.p->a.r");
    expect(r.edges.map((e) => e.id)).toContain("b.y->b.x");
    expectValidLayout(r, {}, false);
    expect(JSON.stringify(radialLayout(cyclic))).toBe(JSON.stringify(r));
  });
});

describe("shape", () => {
  it("keeps children next to their parent instead of smearing them across the sector", () => {
    const r = radialLayout(
      input(["t"], [skill("t.root"), skill("t.a", ["t.root"]), skill("t.b", ["t.root"])]),
    );
    const root = nodeOf(r, "t.root");
    const step = chordAngle(132, r.rings[1]);
    for (const id of ["t.a", "t.b"]) {
      expect(Math.abs(nodeOf(r, id).angle - root.angle)).toBeLessThanOrEqual(step + EPS);
    }
  });

  it("does not interleave independent chains", () => {
    const r = radialLayout(
      input(
        ["t"],
        [
          skill("t.a0"),
          skill("t.b0"),
          skill("t.a1", ["t.a0"]),
          skill("t.b1", ["t.b0"]),
          skill("t.a2", ["t.a1"]),
          skill("t.b2", ["t.b1"]),
          skill("t.a3", ["t.a2"]),
          skill("t.b3", ["t.b2"]),
        ],
      ),
    );
    const signs = [0, 1, 2, 3].map((d) =>
      Math.sign(nodeOf(r, `t.a${d}`).angle - nodeOf(r, `t.b${d}`).angle),
    );
    expect(new Set(signs).size).toBe(1);
    expect(signs[0]).not.toBe(0);
  });

  it("reserves room on intermediate rings for edges that skip rings", () => {
    const r = radialLayout(
      input(
        ["t"],
        [
          skill("t.a"),
          skill("t.b", ["t.a"]),
          skill("t.c", ["t.b"]),
          skill("t.d", ["t.c", "t.a"]),
          skill("t.x", ["t.a"]),
          skill("t.y", ["t.x"]),
        ],
      ),
    );
    const long = r.edges.find((e) => e.id === "t.a->t.d");
    expect(long?.waypoints).toHaveLength(2);
    expect(r.edges.find((e) => e.id === "t.a->t.b")?.waypoints).toBeUndefined();
    expectValidLayout(r);
  });

  it("leans a node toward the sector edge that faces its cross-branch prerequisite", () => {
    const base = [skill("x.root"), skill("y.root"), skill("y.leaf", ["y.root"]), skill("z.root"), skill("z.leaf", ["z.root"])];
    const without = radialLayout(input(["x", "y", "z"], [...base, skill("x.child", ["x.root"])]));
    const withCross = radialLayout(input(["x", "y", "z"], [...base, skill("x.child", ["x.root", "y.root"])]));
    const x = branchOf(withCross, "x");
    // y is clockwise of x, so the pull is toward x's end edge (larger angles)...
    expect(nodeOf(withCross, "x.child").angle).toBeGreaterThan(nodeOf(without, "x.child").angle + 0.01);
    // ...but only a lean: the child stays much closer to its same-branch parent than to the edge.
    const child = nodeOf(withCross, "x.child").angle;
    expect(child - nodeOf(withCross, "x.root").angle).toBeLessThan(x.endAngle - child);
    expectValidLayout(withCross);
  });
});

describe("seed bundle", () => {
  it("matches the requires in crypto-finance-the-tie.skilltree.md", () => {
    const markdown = readFileSync(path.join(process.cwd(), "seed/crypto-finance-the-tie.skilltree.md"), "utf8");
    expect(extractSeedRequires(markdown)).toEqual(SEED);
  });

  it("lays out the seed as three branch trees with correct depths", () => {
    const r = radialLayout(SEED);
    expectValidLayout(r);

    const depths = Object.fromEntries(r.nodes.map((n) => [n.id, n.depth]));
    expect(depths).toEqual({
      "swe.react": 0,
      "swe.nextjs": 1,
      "swe.graphql": 0,
      "swe.web3-frontend": 1,
      "swe.claude-code": 0,
      "finance.money-settlement": 0,
      "finance.market-structure": 1,
      "finance.institutions": 2,
      "finance.capital-formation": 2,
      "finance.market-intelligence": 3,
      "finance.regulation": 1,
      "crypto.consensus": 0,
      "crypto.eth-validators": 1,
      "crypto.staking-metrics": 2,
      "crypto.ethereum-staking": 3,
      "crypto.solana-staking": 3,
      "crypto.cosmos-staking": 3,
      "crypto.liquid-staking": 4,
      "crypto.institutional-staking": 5,
      "crypto.onchain-data": 4,
      "crypto.defi-mechanics": 1,
      "crypto.onchain-yield": 3,
      "crypto.defi-risk": 5,
      "crypto.infrastructure": 1,
    });
    expect(r.rings).toHaveLength(6);
    expect(r.hubTargets).toEqual([
      "swe.react",
      "swe.graphql",
      "swe.claude-code",
      "finance.money-settlement",
      "crypto.consensus",
    ]);

    expect(r.edges).toHaveLength(27);
    expect(r.edges.filter((e) => e.crossBranch).map(({ id, kind }) => ({ id, kind }))).toEqual([
      { id: "crypto.staking-metrics->finance.market-intelligence", kind: "rank-requires" },
      { id: "swe.web3-frontend->crypto.onchain-data", kind: "requires" },
    ]);
    expect(r.edges.find((e) => e.id === "finance.market-structure->finance.market-intelligence")?.kind).toBe(
      "rank-requires",
    );

    // Biggest branch (crypto) is centred straight up; branches go clockwise in order.
    expect(branchOf(r, "crypto").midAngle).toBeCloseTo(0, 9);

    const deg = (a: number) => Math.round((a * 180) / Math.PI);
    console.log(
      [
        `rings: ${r.rings.join(", ")}`,
        ...r.branches.map(
          (b) => `branch ${b.id}: ${deg(b.startAngle)}°..${deg(b.endAngle)}° label (${b.labelX}, ${b.labelY})`,
        ),
        ...r.nodes.map(
          (n) => `${n.id.padEnd(30)} d${n.depth} ${String(deg(n.angle)).padStart(5)}°  (${n.x}, ${n.y})`,
        ),
        `bounds: ${JSON.stringify(r.bounds)}`,
      ].join("\n"),
    );
  });
});

describe("stress", () => {
  it.each([1, 2, 3, 4, 5])("8 branches × 15 skills, seed %i: valid, no overlaps, deterministic", (seed) => {
    const tree = randomTree(seed);
    const r = radialLayout(tree);
    expect(r.nodes).toHaveLength(120);
    expectValidLayout(r);
    expect(JSON.stringify(radialLayout(tree))).toBe(JSON.stringify(r));
  });
});

describe("layoutInputFromContent", () => {
  const branch = (id: string, order: number | null): Branch => ({
    id,
    title: id,
    note: null,
    description: null,
    color: null,
    order,
    skillIds: [],
    extraMeta: {},
    file: "",
    line: 1,
  });
  const rank = (n: number, requires: string[]): Rank => ({
    id: `rank-${n}`,
    number: n,
    name: null,
    requires,
    items: [],
    line: 1,
  });
  const contentSkill = (id: string, requires: string[], ranks: Rank[]): Skill => ({
    id,
    branchId: id.slice(0, id.indexOf(".")),
    slug: id.slice(id.indexOf(".") + 1),
    title: id,
    requires,
    related: [],
    status: null,
    estimate: null,
    factsAsOf: null,
    why: null,
    description: null,
    ranks,
    recall: [],
    sources: [],
    reviewLog: null,
    sections: [],
    extraMeta: {},
    file: "",
    line: 1,
  });

  it("orders branches by `order` first, then content order, and unions rank requires", () => {
    const tree: ContentTree = {
      branches: [branch("c", null), branch("b", 2), branch("a", 1), branch("d", null)],
      skills: [
        contentSkill("a.x", [], []),
        contentSkill("b.y", ["a.x"], [rank(1, ["c.z"]), rank(2, ["c.z", "a.x"])]),
        contentSkill("c.z", [], []),
      ],
      quests: [],
      packs: [],
      diagnostics: [],
      shape: "tree",
    };
    const layoutInput = layoutInputFromContent(tree);
    expect(layoutInput.branches.map((b) => b.id)).toEqual(["a", "b", "c", "d"]);
    expect(layoutInput.skills).toEqual([
      { id: "a.x", branchId: "a", requires: [], rankRequires: [] },
      { id: "b.y", branchId: "b", requires: ["a.x"], rankRequires: ["c.z", "a.x"] },
      { id: "c.z", branchId: "c", requires: [], rankRequires: [] },
    ]);
    const r = radialLayout(layoutInput);
    expect(r.edges.map((e) => `${e.id}:${e.kind}`)).toEqual(["a.x->b.y:requires", "c.z->b.y:rank-requires"]);
  });
});

describe("layoutToSvg", () => {
  it("renders an <svg> with a circle per node, the hub and escaped labels", () => {
    const r = radialLayout(SEED);
    const svg = layoutToSvg(r);
    expect(svg.startsWith("<svg")).toBe(true);
    expect(svg.trimEnd().endsWith("</svg>")).toBe(true);
    expect(svg.match(/<g><title>/g) ?? []).toHaveLength(r.nodes.length);
    expect(svg.match(/<polyline /g) ?? []).toHaveLength(r.edges.length);
    expect(svg).toContain(">crypto<");

    const tricky = layoutToSvg(radialLayout(input(["<a&b>"], [skill("<a&b>.\"x\"")])));
    expect(tricky).toContain("&lt;a&amp;b&gt;");
    expect(tricky).not.toContain("<a&b>");
  });

  it("renders empty layouts", () => {
    expect(layoutToSvg(radialLayout({ branches: [], skills: [] }))).toMatch(/^<svg[\s\S]*<\/svg>$/);
  });
});
