"use client";

// The constellation canvas: React Flow for pan/zoom/hit-testing, everything
// else drawn by our own nodes and edges. Positions come from the radial
// layout (docs/decisions.md D4); only styling depends on progress.

import "@xyflow/react/dist/base.css";
import "./canvas.css";

import {
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  useStore,
  useStoreApi,
  type EdgeTypes,
  type FitViewOptions,
  type NodeTypes,
  type Viewport,
} from "@xyflow/react";
import clsx from "clsx";
import { LocateFixed, Minus, Plus, Scan } from "lucide-react";
import { useEffect, useEffectEvent, useMemo, useRef, useState } from "react";
import type { TreeData } from "@/lib/view-model";
import { CanvasContext, type CanvasActions } from "./canvas-context";
import { buildCanvasGraph, HUB_SIZE, NODE_SIZE, widestGapAngle, type CanvasGraph } from "./graph";
import { HoverCard } from "./HoverCard";
import type { TreeModel } from "./model";
import {
  BRANCH_LABEL_H,
  BRANCH_LABEL_W,
  BranchLabelNode,
  HubNode,
  SkillNode,
  SkyNode,
  type BranchLabelFlowNode,
  type HubFlowNode,
  type SkillFlowNode,
  type SkyFlowNode,
} from "./nodes";
import { SkillEdge, type SkillFlowEdge } from "./SkillEdge";

const nodeTypes = { skill: SkillNode, hub: HubNode, branchLabel: BranchLabelNode, sky: SkyNode } satisfies NodeTypes;
const edgeTypes = { skill: SkillEdge } satisfies EdgeTypes;

type CanvasNode = SkillFlowNode | HubFlowNode | BranchLabelFlowNode | SkyFlowNode;

const PRO_OPTIONS = { hideAttribution: true };
/** Below this zoom, orb labels are too small to read: they hide and FarLabels takes over. */
const FAR_ZOOM = 0.6;
/** Most screen-space labels shown when zoomed out. */
const MAX_FAR_LABELS = 14;
/** Selecting a skill zooms in to at least this. */
const FOCUS_ZOOM = 0.95;
const SKY_ID = "__sky";
const HUB_ID = "__hub";
const BRANCH_PREFIX = "__branch-";
const STAR_LAYERS = 6;

export interface SkillCanvasProps {
  data: TreeData;
  model: TreeModel;
  /** Skills passing search + filter; null when nothing is filtered out. */
  visible: Set<string> | null;
  selectedId: string | null;
  onSelect: (skillId: string | null) => void;
  panelOpen: boolean;
}

export function SkillCanvas(props: SkillCanvasProps) {
  return (
    <ReactFlowProvider>
      <CanvasInner {...props} />
    </ReactFlowProvider>
  );
}

/** Width of the skill side panel on md+ screens (SkillPanel: min(480px, 100vw − 24px), 12px from the edge). */
const PANEL_W = 480;

/** Pixels the side panel covers on the right. Phones get a bottom sheet instead: nothing to dodge. */
function panelCover(canvasWidth: number): number {
  if (typeof window === "undefined" || window.innerWidth < 768) return 0;
  return Math.min(PANEL_W, canvasWidth - 24) + 24;
}

function CanvasInner({ data, model, visible, selectedId, onSelect, panelOpen }: SkillCanvasProps) {
  const rf = useReactFlow<CanvasNode, SkillFlowEdge>();
  const store = useStoreApi<CanvasNode, SkillFlowEdge>();
  const far = useStore((s) => s.transform[2] < FAR_ZOOM);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);
  const [hoverId, setHoverId] = useState<string | null>(null);

  const graph = useMemo(() => buildCanvasGraph(data.branches, data.skills), [data.branches, data.skills]);
  const focusId = hoverId ?? selectedId;

  const nodes = useMemo(
    () => buildNodes(graph, model, data, visible, selectedId),
    [graph, model, data, visible, selectedId],
  );
  const edges = useMemo(() => buildEdges(graph, model, visible, focusId), [graph, model, visible, focusId]);
  const fitNodes = useMemo(
    () => nodes.filter((n) => n.type !== "sky").map((n) => ({ id: n.id })),
    [nodes],
  );

  function fitPadding(): FitViewOptions["padding"] {
    // Wide screens keep the tree clear of the legend; phones stay below the HUD bar.
    const wide = window.innerWidth >= 1024;
    const narrow = window.innerWidth < 640;
    return narrow
      ? { top: "84px", bottom: "64px", left: "16px", right: "16px" }
      : { top: "56px", bottom: "32px", left: wide ? "300px" : "24px", right: wide ? "72px" : "24px" };
  }

  function fitAll(duration: number) {
    // Phones fit just the orbs: the long branch titles would shrink everything to specks.
    const narrow = window.innerWidth < 640;
    const nodes = narrow ? fitNodes.filter((n) => !n.id.startsWith(BRANCH_PREFIX)) : fitNodes;
    return rf.fitView({ nodes, padding: fitPadding(), duration, maxZoom: 1.1 });
  }

  /**
   * First view: like a game's skill screen, open on me and the skills in play
   * at a readable zoom, not the whole sky at specks. "Fit" shows everything.
   */
  function fitFrontier(duration: number) {
    const ids = model.skills
      .filter((m) => isInPlay(m.view) || model.questSkillIds.has(m.skill.id))
      .map((m) => ({ id: m.skill.id }));
    if (ids.length === 0) return fitAll(duration);
    return rf.fitView({
      nodes: [{ id: HUB_ID }, ...ids],
      padding: fitPadding(),
      duration,
      minZoom: FAR_ZOOM + 0.05,
      maxZoom: 0.8,
    });
  }

  /** Moves the viewport so a skill sits in the part of the canvas the side panel leaves visible. */
  function panTo(skillId: string, duration: number, force: boolean): Promise<boolean> {
    const p = graph.pos.get(skillId);
    if (!p) return Promise.resolve(false);
    const { width, height, transform } = store.getState();
    const [tx, ty, z] = transform;
    const cover = panelCover(width);
    if (!force) {
      const sx = p.x * z + tx;
      const sy = p.y * z + ty;
      const m = 110;
      const underHud = sx < 420 && sy < 260;
      if (z >= FOCUS_ZOOM * 0.8 && !underHud && sx > m && sx < width - cover - m && sy > m && sy < height - m) {
        return Promise.resolve(true);
      }
    }
    const zoom = z < FOCUS_ZOOM * 0.8 ? FOCUS_ZOOM : Math.min(z, 1.5);
    return rf.setCenter(p.x + cover / 2 / zoom, p.y + 40 / zoom, { zoom, duration });
  }

  // Node sizes are explicit, so the viewport can be fitted as soon as React Flow is up.
  function onInit() {
    const done = selectedId ? panTo(selectedId, 0, true) : fitFrontier(0);
    void done.then(() => setReady(true));
  }

  const onSelectionChange = useEffectEvent(() => {
    if (ready && selectedId) void panTo(selectedId, 480, false);
  });
  useEffect(() => {
    onSelectionChange();
  }, [selectedId]);

  const actions: CanvasActions = {
    select: (id) => onSelect(id),
    hover: setHoverId,
    reveal: (id) => void panTo(id, 320, false),
  };

  function onMove(_: unknown, vp: Viewport) {
    const el = wrapRef.current;
    if (!el) return;
    const x = (vp.x * 0.06).toFixed(1);
    const y = (vp.y * 0.06).toFixed(1);
    el.style.backgroundPosition = [...Array(STAR_LAYERS).fill(`${x}px ${y}px`), "0 0"].join(",");
  }

  // Zoomed out, only the skills in play (and search hits) keep a readable name.
  const farLabels = useMemo(() => {
    const out: FarLabel[] = [];
    for (const meta of model.skills) {
      const id = meta.skill.id;
      const p = graph.pos.get(id);
      if (!p || id === hoverId) continue;
      const wanted = visible ? visible.has(id) : isInPlay(meta.view) || id === selectedId || model.questSkillIds.has(id);
      if (wanted) out.push({ id, x: p.x, y: p.y, title: meta.skill.title, selected: id === selectedId });
    }
    return out.slice(0, MAX_FAR_LABELS);
  }, [model, graph, visible, selectedId, hoverId]);

  // The selected skill already has the side panel; no card on top of it.
  const hovered = hoverId && hoverId !== selectedId ? model.byId.get(hoverId) : undefined;
  const hoveredAt = hoverId ? graph.pos.get(hoverId) : undefined;
  const titleOf = (id: string) => model.byId.get(id)?.skill.title ?? id;

  return (
    <CanvasContext value={actions}>
      <div ref={wrapRef} className={clsx("starfield st-canvas relative h-full w-full overflow-hidden", far && "st-far")}>
        <div className="st-vignette pointer-events-none absolute inset-0" />
        <ReactFlow<CanvasNode, SkillFlowEdge>
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          nodesDraggable={false}
          nodesConnectable={false}
          nodesFocusable={false}
          edgesFocusable={false}
          elementsSelectable={false}
          zoomOnDoubleClick={false}
          minZoom={0.15}
          maxZoom={2}
          onInit={onInit}
          onPaneClick={() => onSelect(null)}
          onMove={onMove}
          onMoveStart={(e) => {
            // Only a user pan/zoom drops the card; our own fly-to (keyboard reveal) keeps it.
            if (e) setHoverId(null);
          }}
          proOptions={PRO_OPTIONS}
          aria-label="Skill tree canvas"
          className={clsx("transition-opacity duration-700", ready ? "opacity-100" : "opacity-0")}
        >
          {hovered && hoveredAt && (
            <HoverCard
              meta={hovered}
              at={hoveredAt}
              quest={model.questSkillIds.has(hovered.skill.id)}
              titleOf={titleOf}
            />
          )}
          <FarLabels labels={farLabels} />
          <CanvasControls onFit={() => void fitAll(450)} panelOpen={panelOpen} />
        </ReactFlow>
      </div>
    </CanvasContext>
  );
}

/** Skills I can act on right now. */
function isInPlay(v: TreeModel["skills"][number]["view"]): boolean {
  return v.state === "available" || v.state === "in-progress" || v.state === "rusty" || v.readyToComplete;
}

interface FarLabel {
  id: string;
  x: number;
  y: number;
  title: string;
  selected: boolean;
}

const FAR_LABEL_W = 132;

/** Greedy placement in priority order: a label that would overlap one already placed is dropped. */
function placeLabels(labels: FarLabel[], [tx, ty, z]: [number, number, number]) {
  const placed: { l: FarLabel; x: number; y: number; w: number; h: number }[] = [];
  const ordered = [...labels].sort((a, b) => Number(b.selected) - Number(a.selected));
  for (const l of ordered) {
    const w = Math.min(FAR_LABEL_W, l.title.length * 6.3 + 6);
    const h = l.title.length * 6.3 > FAR_LABEL_W ? 30 : 16;
    const x = l.x * z + tx;
    const y = l.y * z + ty + (NODE_SIZE / 2 + 3) * z + 3;
    const hit = placed.some((p) => Math.abs(p.x - x) * 2 < p.w + w + 4 && y < p.y + p.h + 2 && p.y < y + h + 2);
    if (!hit) placed.push({ l, x, y, w, h });
  }
  return placed;
}

function FarLabels({ labels }: { labels: FarLabel[] }) {
  const far = useStore((s) => s.transform[2] < FAR_ZOOM);
  const transform = useStore((s) => s.transform);
  if (!far) return null;
  return (
    <div className="pointer-events-none absolute inset-0 z-[5] overflow-hidden" aria-hidden>
      {placeLabels(labels, transform).map(({ l, x, y }) => (
        <span
          key={l.id}
          className={clsx(
            "st-label-text absolute line-clamp-2 -translate-x-1/2 text-center text-[11.5px] font-medium leading-[1.2]",
            l.selected ? "text-gold-bright" : "text-parchment",
          )}
          style={{ left: x, top: y, width: FAR_LABEL_W }}
        >
          {l.title}
        </span>
      ))}
    </div>
  );
}

function CanvasControls({ onFit, panelOpen }: { onFit: () => void; panelOpen: boolean }) {
  const { zoomIn, zoomOut, setCenter } = useReactFlow();
  const zoom = useStore((s) => s.transform[2]);
  const btn =
    "grid h-9 w-9 place-items-center rounded-lg text-mist transition-colors hover:bg-ink-600/70 hover:text-parchment active:scale-95";
  return (
    <div
      className={clsx(
        "panel absolute bottom-3 z-20 flex flex-col items-center p-1 transition-[right] duration-300",
        panelOpen ? "right-3 md:right-[calc(min(480px,100vw-24px)+24px)]" : "right-3",
      )}
      role="group"
      aria-label="Canvas controls"
    >
      {/* Phones pinch to zoom; they keep just fit and centre. */}
      <div className="hidden flex-col items-center sm:flex">
        <button type="button" className={btn} onClick={() => void zoomIn({ duration: 300 })} aria-label="Zoom in" title="Zoom in">
          <Plus className="h-4 w-4" strokeWidth={1.8} />
        </button>
        <div className="py-0.5 font-mono text-[10px] tabular-nums text-mist-dim">{Math.round(zoom * 100)}%</div>
        <button type="button" className={btn} onClick={() => void zoomOut({ duration: 300 })} aria-label="Zoom out" title="Zoom out">
          <Minus className="h-4 w-4" strokeWidth={1.8} />
        </button>
        <span className="my-1 h-px w-6 bg-ink-500/70" />
      </div>
      <button type="button" className={btn} onClick={onFit} aria-label="Fit the whole tree" title="Fit the whole tree">
        <Scan className="h-4 w-4" strokeWidth={1.8} />
      </button>
      <button
        type="button"
        className={btn}
        onClick={() => void setCenter(0, 0, { zoom: 1, duration: 450 })}
        aria-label="Centre on me"
        title="Centre on me"
      >
        <LocateFixed className="h-4 w-4" strokeWidth={1.8} />
      </button>
    </div>
  );
}

// ---------------------------------------------------------------- node/edge builders

function buildNodes(
  graph: CanvasGraph,
  model: TreeModel,
  data: TreeData,
  visible: Set<string> | null,
  selectedId: string | null,
): CanvasNode[] {
  const { layout } = graph;
  const size = Math.ceil((graph.rimRadius + 90) * 2);
  const outerDepth = new Map<string, number>();
  for (const n of layout.nodes) outerDepth.set(n.branchId, Math.max(outerDepth.get(n.branchId) ?? 0, n.depth));

  const sky: SkyFlowNode = {
    id: SKY_ID,
    type: "sky",
    position: { x: -size / 2, y: -size / 2 },
    width: size,
    height: size,
    zIndex: -1,
    selectable: false,
    focusable: false,
    draggable: false,
    data: {
      size,
      rings: layout.rings,
      ringGap: graph.ringGap,
      rim: graph.rimRadius,
      gapAngle: widestGapAngle(layout),
      sectors: layout.branches.map((b) => ({
        id: b.id,
        start: b.startAngle,
        end: b.endAngle,
        mid: b.midAngle,
        outer: b.outerRadius,
        outerDepth: outerDepth.get(b.id) ?? 0,
        color: model.branchColors.get(b.id) ?? "var(--mist)",
      })),
      rays: graph.rays.map((r) => {
        const meta = model.byId.get(r.target);
        return {
          ...r,
          color: meta?.color ?? "var(--mist)",
          lit: !!meta?.view.learned,
          faded: visible ? !visible.has(r.target) : false,
        };
      }),
    },
  };

  const xp = data.state.xp;
  const hub: HubFlowNode = {
    id: HUB_ID,
    type: "hub",
    position: { x: -HUB_SIZE / 2, y: -HUB_SIZE / 2 },
    width: HUB_SIZE,
    height: HUB_SIZE,
    selectable: false,
    focusable: false,
    draggable: false,
    data: { level: xp.level, progress: xp.progressToNext, total: xp.total, nextLevelAt: xp.nextLevelAt },
  };

  const labels: BranchLabelFlowNode[] = layout.branches.map((b) => {
    const branch = data.branches.find((x) => x.id === b.id);
    const stats = data.state.branches[b.id];
    const anyVisible = !visible || model.skills.some((s) => s.skill.branchId === b.id && visible.has(s.skill.id));
    // Titles on the sides run outward from their anchor instead of back across the branch.
    const side = Math.sin(b.midAngle);
    const align = side > 0.35 ? "start" : side < -0.35 ? "end" : "center";
    const x = align === "start" ? b.labelX - 40 : align === "end" ? b.labelX - BRANCH_LABEL_W + 40 : b.labelX - BRANCH_LABEL_W / 2;
    return {
      id: `${BRANCH_PREFIX}${b.id}`,
      type: "branchLabel",
      position: { x, y: b.labelY - BRANCH_LABEL_H / 2 },
      width: BRANCH_LABEL_W,
      height: BRANCH_LABEL_H,
      selectable: false,
      focusable: false,
      draggable: false,
      data: {
        title: branch?.title ?? b.id,
        color: model.branchColors.get(b.id) ?? "var(--mist)",
        learned: stats?.learned ?? 0,
        total: stats?.total ?? 0,
        dimmed: !anyVisible,
        align,
      },
    };
  });

  const skills: SkillFlowNode[] = [];
  for (const n of layout.nodes) {
    const meta = model.byId.get(n.id);
    if (!meta) continue;
    skills.push({
      id: n.id,
      type: "skill",
      position: { x: n.x - NODE_SIZE / 2, y: n.y - NODE_SIZE / 2 },
      width: NODE_SIZE,
      height: NODE_SIZE,
      zIndex: n.id === selectedId ? 2 : 1,
      draggable: false,
      data: {
        meta,
        selected: n.id === selectedId,
        dimmed: visible ? !visible.has(n.id) : false,
        matched: visible ? visible.has(n.id) : false,
        quest: model.questSkillIds.has(n.id),
        depth: n.depth,
      },
    });
  }

  return [sky, hub, ...labels, ...skills];
}

function buildEdges(
  graph: CanvasGraph,
  model: TreeModel,
  visible: Set<string> | null,
  focusId: string | null,
): SkillFlowEdge[] {
  const edges = graph.edges.map((e): SkillFlowEdge => {
    const src = model.byId.get(e.source);
    const tgt = model.byId.get(e.target);
    const powered = !!src?.view.learned;
    const faded = visible ? !(visible.has(e.source) && visible.has(e.target)) : false;
    const highlight = focusId !== null && (e.source === focusId || e.target === focusId);
    return {
      id: e.id,
      source: e.source,
      target: e.target,
      type: "skill",
      selectable: false,
      focusable: false,
      data: {
        d: e.d,
        from: e.from,
        to: e.to,
        mid: e.mid,
        sourceColor: src?.color ?? "var(--mist)",
        targetColor: tgt?.color ?? "var(--mist)",
        crossBranch: e.crossBranch,
        kind: e.kind,
        rankLabel: e.rankLabel,
        powered,
        unlock: powered && tgt?.view.state === "available",
        faded,
        highlight,
      },
    };
  });
  const weight = (e: SkillFlowEdge) =>
    e.data?.faded ? 0 : e.data?.highlight ? 3 : e.data?.powered ? 2 : 1;
  return edges.sort((a, b) => weight(a) - weight(b));
}
