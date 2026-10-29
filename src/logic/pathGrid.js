// Bitmap → walkability grid (SPEC §5). Pure, no DOM.
//
// A cell is walkable when at least `coverage` of its pixels are close to the
// path colour (yellow). Everything else – grass, decorations painted on the
// map, any other colour – blocks. A morphological close then open removes
// pinholes in roads and single stray cells.

export const DEFAULT_CELL = 16;
export const DEFAULT_PALETTE = { path: '#f2d24b', grass: '#8cc66a' };

export function hexToRgb(hex) {
  const n = parseInt(hex.replace('#', ''), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/**
 * @param {Uint8ClampedArray} data RGBA of the map background
 * @returns {{cols:number, rows:number, cell:number, walk:Uint8Array}}
 */
export function buildGrid(data, width, height, {
  cell = DEFAULT_CELL,
  pathColor = DEFAULT_PALETTE.path,
  tolerance = 60,
  coverage = 0.5,
  clean = true,
} = {}) {
  const cols = Math.ceil(width / cell);
  const rows = Math.ceil(height / cell);
  const [pr, pg, pb] = hexToRgb(pathColor);
  const tol2 = tolerance * tolerance;
  const hits = new Uint32Array(cols * rows);
  const totals = new Uint32Array(cols * rows);

  for (let y = 0; y < height; y++) {
    const row = ((y / cell) | 0) * cols;
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const c = row + ((x / cell) | 0);
      totals[c]++;
      const dr = data[i] - pr, dg = data[i + 1] - pg, db = data[i + 2] - pb;
      if (data[i + 3] > 128 && dr * dr + dg * dg + db * db <= tol2) hits[c]++;
    }
  }

  let walk = new Uint8Array(cols * rows);
  for (let c = 0; c < walk.length; c++) walk[c] = hits[c] >= totals[c] * coverage ? 1 : 0;
  if (clean) walk = open(close(walk, cols, rows), cols, rows);
  return { cols, rows, cell, walk };
}

// 4-neighbour dilate/erode on a grid; out-of-range cells read as 0.
function morph(src, cols, rows, dilate) {
  const out = new Uint8Array(src.length);
  const at = (x, y) => (x < 0 || y < 0 || x >= cols || y >= rows ? 0 : src[y * cols + x]);
  for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
    const n = [at(x, y), at(x - 1, y), at(x + 1, y), at(x, y - 1), at(x, y + 1)];
    out[y * cols + x] = dilate ? (n.some(Boolean) ? 1 : 0) : (n.every(Boolean) ? 1 : 0);
  }
  return out;
}

// Closing (fill pinholes) computed on a 1-cell zero-padded copy, so it neither
// grows roads along the map border nor eats roads that run off the edge.
function close(g, cols, rows) {
  const pc = cols + 2, pr = rows + 2;
  const p = new Uint8Array(pc * pr);
  for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) p[(y + 1) * pc + x + 1] = g[y * cols + x];
  // replicate the edge row/column outward so a road leaving the map stays intact
  for (let x = 0; x < pc; x++) { p[x] = p[pc + x]; p[(pr - 1) * pc + x] = p[(pr - 2) * pc + x]; }
  for (let y = 0; y < pr; y++) { p[y * pc] = p[y * pc + 1]; p[y * pc + pc - 1] = p[y * pc + pc - 2]; }
  const c = morph(morph(p, pc, pr, true), pc, pr, false);
  const out = new Uint8Array(g.length);
  for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) out[y * cols + x] = c[(y + 1) * pc + x + 1];
  return out;
}
// "Open" only removes isolated single cells – a full erode would delete
// legitimate 1-cell-wide paths, so we keep cells that have any walkable neighbour.
function open(g, cols, rows) {
  const out = new Uint8Array(g);
  for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
    const i = y * cols + x;
    if (!g[i]) continue;
    const any = (x > 0 && g[i - 1]) || (x < cols - 1 && g[i + 1]) || (y > 0 && g[i - cols]) || (y < rows - 1 && g[i + cols]);
    if (!any) out[i] = 0;
  }
  return out;
}

export const isWalkable = (grid, cx, cy) =>
  cx >= 0 && cy >= 0 && cx < grid.cols && cy < grid.rows && grid.walk[cy * grid.cols + cx] === 1;

export const worldToCell = (grid, x, y) => ({
  cx: Math.min(grid.cols - 1, Math.max(0, Math.floor(x / grid.cell))),
  cy: Math.min(grid.rows - 1, Math.max(0, Math.floor(y / grid.cell))),
});

export const cellCenter = (grid, cx, cy) => ({
  x: (cx + 0.5) * grid.cell,
  y: (cy + 0.5) * grid.cell,
});

/** Nearest walkable cell to (cx, cy) by ring search; null if none within maxRadius. */
export function nearestWalkable(grid, cx, cy, maxRadius = Math.max(grid.cols, grid.rows)) {
  if (isWalkable(grid, cx, cy)) return { cx, cy, dist: 0 };
  let best = null;
  for (let r = 1; r <= maxRadius; r++) {
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
      const x = cx + dx, y = cy + dy;
      if (!isWalkable(grid, x, y)) continue;
      const d = Math.hypot(dx, dy);
      if (!best || d < best.dist) best = { cx: x, cy: y, dist: d };
    }
    // every cell on a later ring is at least r+1 away, so best is final once best.dist <= r
    if (best && best.dist <= r) return best;
  }
  return best;
}
