// Decorations on a map (SPEC §5.1) – pure geometry, unit-tested:
//   a decoration is { id, asset, x, y, w?, h?, scale? } – centre and size in map
//   px (older ones have only `scale` × DECOR_BASE, square);
//   its frame has 8 handles: corners resize keeping the shape, edge midpoints
//   stretch one side (change the shape);
//   a polygon can be filled with decorations: density + size variety;
//   the rubber removes everything it is pulled over (touchedBy, removeTouched).

export const DECOR_BASE = 64; // px of a decoration at scale 1
export const MIN_DECOR = 12; // px – smaller can't be grabbed any more
export const MAX_DECOR = 600;

/** Size of a decoration in map px. */
export function decorSize(d) {
  const s = DECOR_BASE * (d.scale ?? 1);
  return { w: d.w ?? s, h: d.h ?? s };
}

/** Is the point on the decoration (its frame, plus `pad` px around)? */
export function onDecor(d, p, pad = 0) {
  const { w, h } = decorSize(d);
  return Math.abs(p.x - d.x) <= w / 2 + pad && Math.abs(p.y - d.y) <= h / 2 + pad;
}

/**
 * What a rubber of radius `r` at `p` touches: decorations whose frame it
 * reaches, building spots and caves (markers of radius `marker`), the Town
 * Hall only with `centre` (a sweep must not take it by accident – a click on it
 * does). Returns { decorations: [i…], spots: [i…], caves: [i…], centre }.
 */
export function touchedBy(map, p, r, { marker = 28, centre = false } = {}) {
  const near = (q, reach) => Math.hypot(q.x - p.x, q.y - p.y) <= reach;
  const decorations = [];
  map.decorations.forEach((d, i) => {
    const { w, h } = decorSize(d);
    const dx = Math.max(Math.abs(p.x - d.x) - w / 2, 0), dy = Math.max(Math.abs(p.y - d.y) - h / 2, 0);
    if (Math.hypot(dx, dy) <= r) decorations.push(i);
  });
  const idx = (list) => list.flatMap((q, i) => (near(q, r + marker) ? [i] : []));
  return { decorations, spots: idx(map.spots), caves: idx(map.caves), centre: !!(centre && map.centre && near(map.centre, r + 40)) };
}

/** The map without what the rubber touched (the same map when it touched nothing). */
export function removeTouched(map, hit) {
  const n = hit.decorations.length + hit.spots.length + hit.caves.length + (hit.centre ? 1 : 0);
  if (!n) return map;
  const keep = (list, gone) => list.filter((_, i) => !gone.includes(i));
  return {
    ...map,
    decorations: keep(map.decorations, hit.decorations), spots: keep(map.spots, hit.spots), caves: keep(map.caves, hit.caves),
    ...(hit.centre ? { centre: null } : {}),
  };
}

// handle → which way it pulls: [-1 | 0 | 1 on x, -1 | 0 | 1 on y]
export const HANDLES = {
  nw: [-1, -1], n: [0, -1], ne: [1, -1], e: [1, 0], se: [1, 1], s: [0, 1], sw: [-1, 1], w: [-1, 0],
};

/** Where the 8 handles of the frame are. */
export function handlePoints(d) {
  const { w, h } = decorSize(d);
  return Object.entries(HANDLES).map(([id, [hx, hy]]) => ({ id, x: d.x + (hx * w) / 2, y: d.y + (hy * h) / 2 }));
}

/**
 * The handle under the point, or null: the nearest one within r px – but never
 * reaching the middle of a small decoration, which is for moving it.
 */
export function handleAt(d, p, r) {
  const { w, h } = decorSize(d);
  const reach = Math.min(r, Math.max(6, Math.min(w, h) / 3));
  let best = null, bd = Infinity;
  for (const hp of handlePoints(d)) {
    const dd = Math.hypot(hp.x - p.x, hp.y - p.y);
    if (dd <= reach && dd < bd) { best = hp.id; bd = dd; }
  }
  return best;
}

const clampSize = (v) => Math.max(MIN_DECOR, Math.min(MAX_DECOR, v));

/**
 * The decoration's new frame while `handle` is dragged to `p`, from its frame
 * `start` when the drag began: the opposite side stays where it was. Corners
 * keep the shape (bigger / smaller), edges stretch only their side.
 */
export function resizeDecor(start, handle, p) {
  const [hx, hy] = HANDLES[handle];
  const { w, h } = decorSize(start);
  const fixX = start.x - (hx * w) / 2, fixY = start.y - (hy * h) / 2; // the side that stays
  let nw = hx ? clampSize(Math.abs(p.x - fixX)) : w;
  let nh = hy ? clampSize(Math.abs(p.y - fixY)) : h;
  if (hx && hy) {
    // a corner: the same shape, as big as the pointer pulls (the bigger pull wins)
    const k = Math.max(nw / w, nh / h);
    nw = clampSize(w * k);
    nh = clampSize(h * k);
  }
  const x = hx ? fixX + (hx * nw) / 2 : start.x;
  const y = hy ? fixY + (hy * nh) / 2 : start.y;
  return { ...start, x: round1(x), y: round1(y), w: round1(nw), h: round1(nh), scale: undefined };
}

const round1 = (v) => Math.round(v * 10) / 10;

/** Ray casting: is the point inside the polygon [{x,y}…]? */
export function pointInPolygon(p, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i], b = poly[j];
    if ((a.y > p.y) !== (b.y > p.y) && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

/** A small seeded random generator (the same polygon fills the same way). */
export function seededRng(seed = 1) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Decorations filling a polygon, on a jittered grid.
 *   size      – the average size in px
 *   density   – 1 (sparse, gaps of about two sizes) … 10 (dense, overlapping a little)
 *   variety   – 0 … 1: how much sizes differ (0.5 = from half to one and a half)
 *   allowed(p) – false where nothing may stand (roads, markers)
 * Returns [{ x, y, w, h }].
 */
export function fillPolygon(poly, { size = DECOR_BASE, density = 5, variety = 0.3, allowed = () => true, rng = Math.random, max = 400 } = {}) {
  if (poly.length < 3) return [];
  const gap = size * (2.2 - 0.17 * Math.max(1, Math.min(10, density))); // 2.03 × size … 0.5 × size
  const xs = poly.map((p) => p.x), ys = poly.map((p) => p.y);
  const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  const out = [];
  for (let y = y0 + gap / 2; y <= y1; y += gap) {
    for (let x = x0 + gap / 2; x <= x1; x += gap) {
      const p = { x: x + (rng() - 0.5) * gap * 0.8, y: y + (rng() - 0.5) * gap * 0.8 };
      const k = 1 + (rng() * 2 - 1) * Math.max(0, Math.min(1, variety));
      if (!pointInPolygon(p, poly) || !allowed(p)) continue;
      const s = clampSize(size * k);
      out.push({ x: round1(p.x), y: round1(p.y), w: round1(s), h: round1(s) });
      if (out.length >= max) return out;
    }
  }
  // further back first, so the ones in front overlap them (like in the game)
  return out.sort((a, b) => a.y - b.y);
}
