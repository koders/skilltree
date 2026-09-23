// Small geometry helpers for the radial layout (docs/decisions.md D4).
// Angle convention everywhere: radians, 0 = straight up (screen −y),
// increasing clockwise, so x = r·sin(a) and y = −r·cos(a).

export const TAU = Math.PI * 2;

export interface Point {
  x: number;
  y: number;
}

export function polar(angle: number, radius: number): Point {
  // `+ 0` turns -0 into 0 so results compare and serialise cleanly.
  return { x: radius * Math.sin(angle) + 0, y: -radius * Math.cos(angle) + 0 };
}

/** Shortest unsigned distance between two angles, in [0, π]. */
export function angularDistance(a: number, b: number): number {
  const d = Math.abs(a - b) % TAU;
  return d > Math.PI ? TAU - d : d;
}

/** `angle` shifted by whole turns into [from, from + 2π). */
export function wrapFrom(angle: number, from: number): number {
  return angle - Math.floor((angle - from) / TAU) * TAU;
}

/**
 * Angle between two points on a circle of `radius` whose straight-line
 * distance is `distance`. Uses the chord, not the arc, so spacing holds
 * exactly even on small rings.
 */
export function chordAngle(distance: number, radius: number): number {
  if (radius <= 0) return Math.PI;
  return 2 * Math.asin(Math.min(1, distance / (2 * radius)));
}

/**
 * Smallest radius at which items `widths` px wide (centre-to-centre spacing
 * of neighbours is the mean of their widths) fit side by side inside
 * `sector` radians, with half an item of padding at each edge so items in
 * neighbouring sectors on the same ring never touch.
 */
export function radiusToFit(widths: readonly number[], sector: number): number {
  if (widths.length === 0) return 0;
  if (sector <= 0) return Number.POSITIVE_INFINITY;
  const need = (r: number) => widths.reduce((sum, w) => sum + chordAngle(w, r), 0);
  const total = widths.reduce((sum, w) => sum + w, 0);
  // chordAngle(w, r) ≥ w / r, so total / sector is a lower bound.
  let lo = Math.max(total / sector, Math.max(...widths) / 2);
  if (need(lo) <= sector) return lo;
  let hi = lo * 2;
  while (need(hi) > sector) hi *= 2;
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    if (need(mid) <= sector) hi = mid;
    else lo = mid;
  }
  return hi;
}

/**
 * 1-D placement of items with angular `widths`, in the order given: each
 * position as close as possible (least squares) to its ideal, neighbours at
 * least the mean of their widths apart, every item inside [start, end]
 * including half its width. The order is fixed; ideals out of order simply
 * pull their items together.
 *
 * Subtracting the cumulative spacing turns this into isotonic regression,
 * solved by pool-adjacent-violators: overlapping runs merge into one block
 * centred on the mean of their ideals, so separate clusters stay where they
 * want to be instead of the whole group being smeared or re-centred.
 */
export function separate(
  ideals: readonly number[],
  widths: readonly number[],
  start: number,
  end: number,
): number[] {
  const n = ideals.length;
  const offsets: number[] = [];
  for (let i = 0; i < n; i++) {
    offsets.push(i === 0 ? 0 : offsets[i - 1] + (widths[i - 1] + widths[i]) / 2);
  }

  const blocks: { size: number; sum: number }[] = [];
  for (let i = 0; i < n; i++) {
    let block = { size: 1, sum: ideals[i] - offsets[i] };
    for (;;) {
      const prev = blocks[blocks.length - 1];
      if (!prev || prev.sum / prev.size <= block.sum / block.size) break;
      blocks.pop();
      block = { size: prev.size + block.size, sum: prev.sum + block.sum };
    }
    blocks.push(block);
  }
  const out: number[] = [];
  for (const b of blocks) for (let k = 0; k < b.size; k++) out.push(b.sum / b.size + offsets[out.length]);

  // Forward then backward pass keeps the spacing; when the widths sum to at
  // most end − start, both bounds hold afterwards.
  for (let i = 0; i < n; i++) {
    const min = i === 0 ? start + widths[0] / 2 : out[i - 1] + (widths[i - 1] + widths[i]) / 2;
    out[i] = Math.max(out[i], min);
  }
  for (let i = n - 1; i >= 0; i--) {
    const max = i === n - 1 ? end - widths[i] / 2 : out[i + 1] - (widths[i] + widths[i + 1]) / 2;
    out[i] = Math.min(out[i], max);
  }
  return out;
}
