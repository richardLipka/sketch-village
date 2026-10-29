// Pathfinding on the walkability grid. Pure, no DOM.
//  - findPath: A* for the hero (and later soldiers), 8 directions, no corner cutting
//  - flowField: BFS distance from the village centre, shared by all ground enemies
//  - smoothPath: drop waypoints that have a clear line of sight

import { isWalkable } from './pathGrid.js';

const DIRS = [
  [1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1],
  [1, 1, Math.SQRT2], [1, -1, Math.SQRT2], [-1, 1, Math.SQRT2], [-1, -1, Math.SQRT2],
];

// Minimal binary heap keyed by f.
class Heap {
  constructor() { this.a = []; }
  get size() { return this.a.length; }
  push(n) {
    const a = this.a; a.push(n);
    let i = a.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (a[p].f <= a[i].f) break;
      [a[p], a[i]] = [a[i], a[p]]; i = p;
    }
  }
  pop() {
    const a = this.a; const top = a[0]; const last = a.pop();
    if (a.length) {
      a[0] = last;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1, r = l + 1; let m = i;
        if (l < a.length && a[l].f < a[m].f) m = l;
        if (r < a.length && a[r].f < a[m].f) m = r;
        if (m === i) break;
        [a[m], a[i]] = [a[i], a[m]]; i = m;
      }
    }
    return top;
  }
}

const canStep = (grid, x, y, dx, dy) =>
  isWalkable(grid, x + dx, y + dy) &&
  (dx === 0 || dy === 0 || (isWalkable(grid, x + dx, y) && isWalkable(grid, x, y + dy)));

/** A* from start to goal cells. Returns [{cx,cy}, …] including both ends, or null. */
export function findPath(grid, start, goal) {
  if (!isWalkable(grid, start.cx, start.cy) || !isWalkable(grid, goal.cx, goal.cy)) return null;
  const { cols } = grid;
  const idx = (x, y) => y * cols + x;
  const g = new Float64Array(grid.walk.length).fill(Infinity);
  const came = new Int32Array(grid.walk.length).fill(-1);
  const closed = new Uint8Array(grid.walk.length);
  const h = (x, y) => {
    const dx = Math.abs(x - goal.cx), dy = Math.abs(y - goal.cy);
    return Math.max(dx, dy) + (Math.SQRT2 - 1) * Math.min(dx, dy); // octile
  };
  const open = new Heap();
  g[idx(start.cx, start.cy)] = 0;
  open.push({ x: start.cx, y: start.cy, f: h(start.cx, start.cy) });

  while (open.size) {
    const { x, y } = open.pop();
    const i = idx(x, y);
    if (closed[i]) continue;
    closed[i] = 1;
    if (x === goal.cx && y === goal.cy) {
      const path = [];
      for (let c = i; c !== -1; c = came[c]) path.push({ cx: c % cols, cy: (c / cols) | 0 });
      return path.reverse();
    }
    for (const [dx, dy, cost] of DIRS) {
      if (!canStep(grid, x, y, dx, dy)) continue;
      const j = idx(x + dx, y + dy);
      const ng = g[i] + cost;
      if (ng < g[j]) {
        g[j] = ng;
        came[j] = i;
        open.push({ x: x + dx, y: y + dy, f: ng + h(x + dx, y + dy) });
      }
    }
  }
  return null;
}

/** True if a straight segment between two cells stays on walkable cells. */
export function lineOfSight(grid, a, b) {
  // sample the segment at quarter-cell steps (cheap, robust enough for a 16px grid)
  const steps = Math.ceil(Math.hypot(b.cx - a.cx, b.cy - a.cy) * 4);
  for (let s = 0; s <= steps; s++) {
    const t = steps ? s / steps : 0;
    const x = a.cx + 0.5 + (b.cx - a.cx) * t;
    const y = a.cy + 0.5 + (b.cy - a.cy) * t;
    // check the cells under a small box so the walker doesn't clip grass corners
    for (const [ox, oy] of [[-0.3, -0.3], [0.3, -0.3], [-0.3, 0.3], [0.3, 0.3]]) {
      if (!isWalkable(grid, Math.floor(x + ox), Math.floor(y + oy))) return false;
    }
  }
  return true;
}

/** Remove intermediate waypoints that can be skipped with a straight walk. */
export function smoothPath(grid, path) {
  if (!path || path.length < 3) return path;
  const out = [path[0]];
  let anchor = 0;
  for (let i = 2; i < path.length; i++) {
    if (!lineOfSight(grid, path[anchor], path[i])) {
      out.push(path[i - 1]);
      anchor = i - 1;
    }
  }
  out.push(path[path.length - 1]);
  return out;
}

/** BFS distances (in steps) from goal to every walkable cell; Infinity = unreachable. */
export function flowField(grid, goal) {
  const dist = new Float64Array(grid.walk.length).fill(Infinity);
  if (!isWalkable(grid, goal.cx, goal.cy)) return dist;
  const { cols } = grid;
  const queue = [goal.cy * cols + goal.cx];
  dist[queue[0]] = 0;
  for (let q = 0; q < queue.length; q++) {
    const i = queue[q];
    const x = i % cols, y = (i / cols) | 0;
    for (const [dx, dy] of DIRS.slice(0, 4)) {
      if (!isWalkable(grid, x + dx, y + dy)) continue;
      const j = (y + dy) * cols + x + dx;
      if (dist[j] === Infinity) { dist[j] = dist[i] + 1; queue.push(j); }
    }
  }
  return dist;
}
