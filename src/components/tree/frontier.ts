// First view of the canvas (docs/decisions.md D4): the hub and the skills in
// play at a readable zoom. When a narrow screen can't fit them all at that
// zoom, frame the hub with the skills nearest to it; fitting everything and
// letting the zoom clamp would centre on the bounding box and push the hub
// (and most of the skills) off-screen.

export interface FrameArea {
  width: number;
  height: number;
  padding: { top: number; right: number; bottom: number; left: number };
}

interface Placed {
  id: string;
  /** Centre, in flow coordinates (the hub is at 0,0). */
  x: number;
  y: number;
}

/** Zoom at which the hub plus `skills` fill `area`. */
function zoomToFit(skills: Placed[], sizes: { node: number; hub: number }, area: FrameArea): number {
  let [x0, y0, x1, y1] = [-sizes.hub / 2, -sizes.hub / 2, sizes.hub / 2, sizes.hub / 2];
  for (const s of skills) {
    x0 = Math.min(x0, s.x - sizes.node / 2);
    y0 = Math.min(y0, s.y - sizes.node / 2);
    x1 = Math.max(x1, s.x + sizes.node / 2);
    y1 = Math.max(y1, s.y + sizes.node / 2);
  }
  const w = area.width - area.padding.left - area.padding.right;
  const h = area.height - area.padding.top - area.padding.bottom;
  return Math.min(w / (x1 - x0), h / (y1 - y0));
}

/** Ids of the in-play skills to frame with the hub: all that fit at `minZoom`, nearest to the hub first. */
export function frontierSkills(
  skills: Placed[],
  sizes: { node: number; hub: number },
  area: FrameArea,
  minZoom: number,
): string[] {
  const nearest = skills.toSorted((a, b) => Math.hypot(a.x, a.y) - Math.hypot(b.x, b.y));
  for (let n = nearest.length; n > 1; n--) {
    if (zoomToFit(nearest.slice(0, n), sizes, area) >= minZoom) return nearest.slice(0, n).map((s) => s.id);
  }
  return nearest.slice(0, 1).map((s) => s.id);
}
