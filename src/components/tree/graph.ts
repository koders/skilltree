// Static canvas geometry: the radial layout for the current content plus
// every edge's path. Depends on content only, so it's computed once per
// content change and shared by every progress update.

import type { Branch, ContentTree, Skill } from "@/lib/content/types";
import { layoutInputFromContent, radialLayout, type LayoutResult } from "@/lib/layout/radial";
import { flowThrough, orbit, pointAtFraction, toPath, trim, type Pt } from "./paths";

/** Node box = layout nodeSize: positions are orb centres. */
export const NODE_SIZE = 76;
/** Radius edges stop short of, around an orb. */
const EDGE_TRIM_START = 35;
const EDGE_TRIM_END = 39;
export const HUB_SIZE = 148;
const HUB_TRIM = 78;

export interface StaticEdge {
  id: string;
  source: string;
  target: string;
  kind: "requires" | "rank-requires";
  crossBranch: boolean;
  d: string;
  from: Pt;
  to: Pt;
  mid: Pt;
  /** "R2" for a rank-level prerequisite. */
  rankLabel: string | null;
}

export interface Ray {
  target: string;
  d: string;
  from: Pt;
  to: Pt;
}

export interface CanvasGraph {
  layout: LayoutResult;
  pos: Map<string, Pt>;
  depth: Map<string, number>;
  edges: StaticEdge[];
  rays: Ray[];
  /** Radius of the outer astrolabe rim. */
  rimRadius: number;
  ringGap: number;
}

export function buildCanvasGraph(branches: Branch[], skills: Skill[]): CanvasGraph {
  const tree: ContentTree = { branches, skills, quests: [], packs: [], diagnostics: [], shape: "tree" };
  const layout = radialLayout(layoutInputFromContent(tree));
  const pos = new Map<string, Pt>(layout.nodes.map((n) => [n.id, { x: n.x, y: n.y }]));
  const depth = new Map(layout.nodes.map((n) => [n.id, n.depth]));
  const skillById = new Map(skills.map((s) => [s.id, s]));

  const edges: StaticEdge[] = [];
  for (const e of layout.edges) {
    const a = pos.get(e.source);
    const b = pos.get(e.target);
    if (!a || !b) continue;
    const raw = e.crossBranch && !e.waypoints?.length ? orbit(a, b) : flowThrough([a, ...(e.waypoints ?? []), b]);
    const pts = trim(raw, EDGE_TRIM_START, EDGE_TRIM_END);
    edges.push({
      id: e.id,
      source: e.source,
      target: e.target,
      kind: e.kind,
      crossBranch: e.crossBranch,
      d: toPath(pts),
      from: pts[0],
      to: pts[pts.length - 1],
      mid: pointAtFraction(pts, 0.5),
      rankLabel: e.kind === "rank-requires" ? rankLabel(skillById.get(e.target), e.source) : null,
    });
  }

  const rays: Ray[] = layout.hubTargets.flatMap((id) => {
    const p = pos.get(id);
    if (!p) return [];
    const pts = trim([{ x: 0, y: 0 }, p], HUB_TRIM, EDGE_TRIM_END);
    return [{ target: id, d: toPath(pts), from: pts[0], to: pts[pts.length - 1] }];
  });

  const ringGap = layout.rings.length > 1 ? layout.rings[1] - layout.rings[0] : 190;
  const outer = layout.rings[layout.rings.length - 1] ?? 240;
  return { layout, pos, depth, edges, rays, rimRadius: outer + ringGap * 1.05, ringGap };
}

function rankLabel(skill: Skill | undefined, prereq: string): string | null {
  if (!skill) return null;
  const numbers = skill.ranks.filter((r) => r.requires.includes(prereq)).map((r) => r.number);
  return numbers.length > 0 ? `R${numbers.join("·")}` : null;
}

/** Middle of the widest empty wedge between branch sectors: where tier numerals go. */
export function widestGapAngle(layout: LayoutResult): number {
  const sectors = [...layout.branches].sort((a, b) => a.startAngle - b.startAngle);
  if (sectors.length === 0) return Math.PI;
  let best = { size: -1, mid: Math.PI };
  for (let i = 0; i < sectors.length; i++) {
    const end = sectors[i].endAngle;
    const nextStart = i + 1 < sectors.length ? sectors[i + 1].startAngle : sectors[0].startAngle + Math.PI * 2;
    const size = nextStart - end;
    if (size > best.size) best = { size, mid: end + size / 2 };
  }
  return best.mid;
}

export const ROMAN = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII"];
