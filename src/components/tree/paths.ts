// Edge geometry for the constellation canvas. Everything is computed once per
// layout: dense polylines (so trimming at the orb rims and finding midpoints is
// exact), serialised to SVG path strings.

export interface Pt {
  x: number;
  y: number;
}

const SAMPLES_PER_SEGMENT = 18;

function sub(a: Pt, b: Pt): Pt {
  return { x: a.x - b.x, y: a.y - b.y };
}
function add(a: Pt, b: Pt): Pt {
  return { x: a.x + b.x, y: a.y + b.y };
}
function scale(a: Pt, k: number): Pt {
  return { x: a.x * k, y: a.y * k };
}
function len(a: Pt): number {
  return Math.hypot(a.x, a.y);
}
function dist(a: Pt, b: Pt): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}
function lerp(a: Pt, b: Pt, t: number): Pt {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}

/** Unit vector pointing away from the hub at the origin. */
function radial(p: Pt): Pt {
  const l = len(p);
  return l < 1e-6 ? { x: 0, y: -1 } : scale(p, 1 / l);
}

function cubicPoint(p0: Pt, c1: Pt, c2: Pt, p1: Pt, t: number): Pt {
  const u = 1 - t;
  const a = u * u * u;
  const b = 3 * u * u * t;
  const c = 3 * u * t * t;
  const d = t * t * t;
  return {
    x: a * p0.x + b * c1.x + c * c2.x + d * p1.x,
    y: a * p0.y + b * c1.y + c * c2.y + d * p1.y,
  };
}

/**
 * Smooth curve through `points` (Catmull-Rom tangents inside, radial tangents
 * at both ends, so edges leave and enter orbs pointing away from the hub like
 * branches of a tree), sampled as a polyline.
 */
export function flowThrough(points: Pt[]): Pt[] {
  if (points.length < 2) return points;
  const n = points.length;
  const tangents = points.map((p, i) => {
    if (i === 0) return scale(radial(p), dist(points[1], p));
    if (i === n - 1) return scale(radial(p), dist(p, points[n - 2]));
    return scale(sub(points[i + 1], points[i - 1]), 0.5);
  });
  const out: Pt[] = [points[0]];
  for (let i = 0; i < n - 1; i++) {
    const p0 = points[i];
    const p1 = points[i + 1];
    const c1 = add(p0, scale(tangents[i], 1 / 3));
    const c2 = sub(p1, scale(tangents[i + 1], 1 / 3));
    for (let s = 1; s <= SAMPLES_PER_SEGMENT; s++) out.push(cubicPoint(p0, c1, c2, p1, s / SAMPLES_PER_SEGMENT));
  }
  return out;
}

/**
 * An orbital arc from `a` to `b`: angle and radius interpolated around the
 * hub, so long cross-branch links sweep around the tree instead of cutting
 * straight through other branches.
 */
export function orbit(a: Pt, b: Pt): Pt[] {
  const ra = len(a);
  const rb = len(b);
  const aa = Math.atan2(a.x, -a.y);
  let da = Math.atan2(b.x, -b.y) - aa;
  if (da > Math.PI) da -= 2 * Math.PI;
  if (da < -Math.PI) da += 2 * Math.PI;
  const steps = Math.max(12, Math.min(120, Math.ceil((Math.abs(da) * Math.max(ra, rb)) / 10)));
  const out: Pt[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    // Ease the radius so the arc leaves and arrives along the rings.
    const e = t * t * (3 - 2 * t);
    const r = ra + (rb - ra) * e;
    const ang = aa + da * t;
    out.push({ x: r * Math.sin(ang), y: -r * Math.cos(ang) });
  }
  out[0] = a;
  out[out.length - 1] = b;
  return out;
}

/** Cuts `start` px off the beginning and `end` px off the end (measured as straight distance from each endpoint). */
export function trim(points: Pt[], start: number, end: number): Pt[] {
  if (points.length < 2) return points;
  const head = points[0];
  const tail = points[points.length - 1];
  let i = 1;
  while (i < points.length - 1 && dist(points[i], head) < start) i++;
  let j = points.length - 2;
  while (j > 0 && dist(points[j], tail) < end) j--;
  if (j < i - 1) return [lerp(head, tail, 0.45), lerp(head, tail, 0.55)];
  const first = cutAt(points[i - 1], points[i], head, start);
  const last = cutAt(points[j + 1], points[j], tail, end);
  return [first, ...points.slice(i, j + 1), last];
}

/** Point on segment a→b at distance `r` from `centre` (a is inside the circle, b outside). */
function cutAt(a: Pt, b: Pt, centre: Pt, r: number): Pt {
  const da = dist(a, centre);
  const db = dist(b, centre);
  if (db <= r || Math.abs(db - da) < 1e-6) return b;
  const t = Math.max(0, Math.min(1, (r - da) / (db - da)));
  return lerp(a, b, t);
}

export function pointAtFraction(points: Pt[], fraction: number): Pt {
  if (points.length === 0) return { x: 0, y: 0 };
  let total = 0;
  for (let i = 1; i < points.length; i++) total += dist(points[i - 1], points[i]);
  let target = total * fraction;
  for (let i = 1; i < points.length; i++) {
    const seg = dist(points[i - 1], points[i]);
    if (seg >= target && seg > 0) return lerp(points[i - 1], points[i], target / seg);
    target -= seg;
  }
  return points[points.length - 1];
}

export function toPath(points: Pt[]): string {
  return points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join("");
}

export function arcPath(radius: number, start: number, end: number): string {
  const a = { x: radius * Math.sin(start), y: -radius * Math.cos(start) };
  const b = { x: radius * Math.sin(end), y: -radius * Math.cos(end) };
  const large = end - start > Math.PI ? 1 : 0;
  return `M${a.x.toFixed(1)} ${a.y.toFixed(1)}A${radius} ${radius} 0 ${large} 1 ${b.x.toFixed(1)} ${b.y.toFixed(1)}`;
}

/** Annular sector between two radii and two angles (0 = up, clockwise). */
export function wedgePath(inner: number, outer: number, start: number, end: number): string {
  const p = (r: number, a: number) => `${(r * Math.sin(a)).toFixed(1)} ${(-r * Math.cos(a)).toFixed(1)}`;
  const large = end - start > Math.PI ? 1 : 0;
  return (
    `M${p(inner, start)}L${p(outer, start)}` +
    `A${outer} ${outer} 0 ${large} 1 ${p(outer, end)}` +
    `L${p(inner, end)}` +
    `A${inner} ${inner} 0 ${large} 0 ${p(inner, start)}Z`
  );
}
