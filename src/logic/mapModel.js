// Map (= level) record and validation (SPEC §5). Pure, no DOM.

import { newId } from '../data/saveFile.js';
import { DEFAULT_PALETTE, worldToCell, nearestWalkable } from './pathGrid.js';
import { flowField } from './pathfinding.js';

export const WORLD = { width: 1280, height: 720 };
export const SPOT_COUNT = 10;
export const MAX_SPOT_DISTANCE = 64; // px from a spot to the nearest path
export const EDGE_MARGIN = 40; // a cave must be this close to the map border
export const CENTRE_RADIUS = 60;

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
    caves: [], // [{ id, x, y, asset? }]
    heroRespawn: null, // { x, y }; null = centre
    decorations: [], // [{ id, asset, x, y, scale }]
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

  if (map.spots.length !== SPOT_COUNT) problems.push({ key: 'spot_count', params: { n: map.spots.length, want: SPOT_COUNT } });
  map.spots.forEach((s, i) => {
    if (!near(s, MAX_SPOT_DISTANCE)) problems.push({ key: 'spot_far', params: { n: i + 1 } });
  });

  if (!map.caves.length) problems.push({ key: 'no_caves' });
  map.caves.forEach((c, i) => {
    const { width, height } = map.world;
    const onEdge = c.x <= EDGE_MARGIN || c.y <= EDGE_MARGIN || c.x >= width - EDGE_MARGIN || c.y >= height - EDGE_MARGIN;
    if (!onEdge) problems.push({ key: 'cave_not_edge', params: { n: i + 1 } });
    const cell = near(c, 48);
    if (!cell) problems.push({ key: 'cave_off_path', params: { n: i + 1 } });
    else if (field && field[cell.cy * grid.cols + cell.cx] === Infinity) problems.push({ key: 'cave_not_connected', params: { n: i + 1 } });
  });

  if (map.heroRespawn && !near(map.heroRespawn, 48)) problems.push({ key: 'respawn_off_path' });

  return { ok: problems.length === 0, problems };
}
