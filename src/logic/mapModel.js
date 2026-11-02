// Map (= level) record and validation (SPEC §5). Pure, no DOM.

import { newId } from '../data/saveFile.js';
import { DEFAULT_PALETTE, worldToCell, cellCenter, nearestWalkable, isWalkable } from './pathGrid.js';
import { flowField } from './pathfinding.js';

export const WORLD = { width: 1280, height: 720 };
export const MIN_SPOTS = 1; // a map may have any number of building spots in this range
export const MAX_SPOTS = 30;
export const MAX_SPOT_DISTANCE = 64; // px from a spot to the nearest path
export const CAVE_REACH = 96; // px: a click this close to a road places a cave beside it
export const CAVE_MAX_DISTANCE = 48; // px from a cave to its road
export const CAVE_MIN_CENTRE_DISTANCE = 160; // px: a cave right at the Town Hall would be no fun
export const CENTRE_RADIUS = 60;
export const CAVE_SIZE = 64; // px of a cave as placed (it can be resized like a decoration)

const CAVE_GAP = 22; // px from the road edge to the middle of a cave of CAVE_SIZE – the cave touches the road

/** A cave's size in map px: { w, h } (older caves have none: CAVE_SIZE). */
export const caveSize = (c) => ({ w: c?.w ?? CAVE_SIZE, h: c?.h ?? CAVE_SIZE });

const CAVE_EDGE = CAVE_MAX_DISTANCE - CAVE_SIZE / 2; // px a road may be away from a cave's frame (16: a usual cave's middle 48 px)

/**
 * The road cell beside a cave: the one nearest its middle among the road cells
 * its frame (CAVE_EDGE px around it) touches – so a big or stretched cave counts
 * by its edge, not its middle. null when no road touches it.
 */
export function caveRoad(grid, c) {
  const { w, h } = caveSize(c);
  const x0 = Math.max(0, Math.floor((c.x - w / 2 - CAVE_EDGE) / grid.cell)), x1 = Math.min(grid.cols - 1, Math.floor((c.x + w / 2 + CAVE_EDGE) / grid.cell));
  const y0 = Math.max(0, Math.floor((c.y - h / 2 - CAVE_EDGE) / grid.cell)), y1 = Math.min(grid.rows - 1, Math.floor((c.y + h / 2 + CAVE_EDGE) / grid.cell));
  let best = null;
  for (let cy = y0; cy <= y1; cy++) for (let cx = x0; cx <= x1; cx++) {
    if (!isWalkable(grid, cx, cy)) continue;
    const p = cellCenter(grid, cx, cy), d = Math.hypot(p.x - c.x, p.y - c.y);
    if (!best || d < best.d) best = { cx, cy, d };
  }
  return best;
}

/**
 * Where a cave clicked at `p` goes: anywhere on the map, but always right beside
 * the nearest road (on the side of the click), so it is clear where its enemies
 * walk. null when no road is within CAVE_REACH. `size` ({ w, h }): a bigger cave
 * stands further out, so that its edge (not its middle) touches the road.
 */
export function placeCave(grid, p, world = WORLD, size = null) {
  const at = worldToCell(grid, p.x, p.y);
  const { w, h } = caveSize(size);
  const extra = Math.max(0, (Math.max(w, h) - CAVE_SIZE) / 2);
  const reach = CAVE_REACH + extra;
  const n = nearestWalkable(grid, at.cx, at.cy, Math.ceil(reach / grid.cell) + 1);
  if (!n || n.dist * grid.cell > reach) return null;
  const road = cellCenter(grid, n.cx, n.cy);
  const walkAt = (x, y) => { const c = worldToCell(grid, x, y); return x >= 0 && y >= 0 && x < world.width && y < world.height && isWalkable(grid, c.cx, c.cy); };

  // which way the cave sits: towards the click, or – clicked on the road – towards the nearest grass
  let dx = p.x - road.x, dy = p.y - road.y;
  if (n.dist === 0) {
    let best = null;
    for (let r = 1; r <= 12 && !best; r++) {
      for (let a = 0; a < 16; a++) {
        const ang = (a / 16) * Math.PI * 2;
        const x = p.x + Math.cos(ang) * r * grid.cell, y = p.y + Math.sin(ang) * r * grid.cell;
        if (!walkAt(x, y)) { best = { dx: x - p.x, dy: y - p.y }; break; }
      }
    }
    if (!best) return { x: p.x, y: p.y };
    ({ dx, dy } = best);
  }
  const len = Math.hypot(dx, dy) || 1;
  dx /= len; dy /= len;
  // from the road walk out to its edge, then a little further
  const from = n.dist === 0 ? p : road;
  let x = from.x, y = from.y;
  for (let i = 0; i < 64 && walkAt(x, y); i++) { x += dx * 4; y += dy * 4; }
  const clamp = (v, max) => Math.round(Math.min(max - 20, Math.max(20, v)));
  // a bigger cave further out by how much bigger it is that way (a wide one beside a road going up and down…)
  const gap = CAVE_GAP + Math.max(0, (Math.abs(dx) * (w - CAVE_SIZE) + Math.abs(dy) * (h - CAVE_SIZE)) / 2);
  return { x: clamp(x + dx * gap, world.width), y: clamp(y + dy * gap, world.height) };
}

export function emptyMap(name = '') {
  const now = new Date().toISOString();
  return {
    id: newId(),
    name,
    author: '',
    background: null, // PNG data URL (lossless – path colour must stay exact)
    world: { ...WORLD },
    palette: { ...DEFAULT_PALETTE },
    centre: null, // { x, y, radius }
    spots: [], // [{ id, x, y }]
    caves: [], // [{ id, x, y, asset?, w?, h? }] – asset: a cave drawing or a decoration (none: the first cave drawing)
    heroRespawn: null, // unused since v1.1 – the hero always (re)spawns at the Town Hall
    decorations: [], // [{ id, asset, x, y, scale }]
    theme: null, // theme (world) id – config/themes.js
    textures: {}, // { '#rrggbb': textureId } – maps/textures.js
    waves: null, // filled in M3
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Check a map against its walkability grid.
 * @returns {{ok: boolean, problems: {key: string, params?: object}[]}} translation keys
 */
export function validateMap(map, grid) {
  const problems = [];
  const near = (p, maxPx) => {
    const { cx, cy } = worldToCell(grid, p.x, p.y);
    const n = nearestWalkable(grid, cx, cy, Math.ceil(maxPx / grid.cell) + 1);
    return n && n.dist * grid.cell <= maxPx ? n : null;
  };

  if (!grid.walk.some(Boolean)) problems.push({ key: 'no_paths' });

  let field = null;
  if (!map.centre) {
    problems.push({ key: 'no_centre' });
  } else {
    const c = near(map.centre, map.centre.radius ?? CENTRE_RADIUS);
    if (!c) problems.push({ key: 'centre_off_path' });
    else field = flowField(grid, c);
  }

  if (map.spots.length < MIN_SPOTS) problems.push({ key: 'spot_count', params: { n: map.spots.length, want: MIN_SPOTS } });
  map.spots.forEach((s, i) => {
    if (!near(s, MAX_SPOT_DISTANCE)) problems.push({ key: 'spot_far', params: { n: i + 1 } });
  });

  if (!map.caves.length) problems.push({ key: 'no_caves' });
  // caves may be anywhere – next to a road that leads to the village, not at the Town Hall
  map.caves.forEach((c, i) => {
    if (map.centre && Math.hypot(c.x - map.centre.x, c.y - map.centre.y) < CAVE_MIN_CENTRE_DISTANCE) {
      problems.push({ key: 'cave_too_close', params: { n: i + 1 } });
    }
    const cell = caveRoad(grid, c);
    if (!cell) problems.push({ key: 'cave_off_path', params: { n: i + 1 } });
    else if (field && field[cell.cy * grid.cols + cell.cx] === Infinity) problems.push({ key: 'cave_not_connected', params: { n: i + 1 } });
  });

  return { ok: problems.length === 0, problems };
}
