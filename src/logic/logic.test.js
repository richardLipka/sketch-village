import { describe, it, expect } from 'vitest';
import { buildGrid, nearestWalkable, hexToRgb, DEFAULT_PALETTE } from './pathGrid.js';
import { findPath, smoothPath, flowField } from './pathfinding.js';
import { emptyMap, validateMap, placeCave } from './mapModel.js';

// Grid from ASCII art: '#' walkable, '.' blocked.
function gridFrom(rows) {
  const cols = rows[0].length;
  const walk = new Uint8Array(cols * rows.length);
  rows.forEach((r, y) => [...r].forEach((ch, x) => { walk[y * cols + x] = ch === '#' ? 1 : 0; }));
  return { cols, rows: rows.length, cell: 16, walk };
}

// RGBA bitmap: grass everywhere, path colour where paint(x,y).
function bitmap(w, h, paint) {
  const d = new Uint8ClampedArray(w * h * 4);
  const path = hexToRgb(DEFAULT_PALETTE.path), grass = hexToRgb(DEFAULT_PALETTE.grass);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const c = paint(x, y) ? path : grass;
    const i = (y * w + x) * 4;
    d[i] = c[0]; d[i + 1] = c[1]; d[i + 2] = c[2]; d[i + 3] = 255;
  }
  return d;
}

describe('buildGrid', () => {
  it('marks yellow road cells walkable and grass blocked', () => {
    // 160×64 px, horizontal road in rows 16..47 (cell rows 1–2)
    const g = buildGrid(bitmap(160, 64, (x, y) => y >= 16 && y < 48), 160, 64, { cell: 16 });
    expect(g.cols).toBe(10);
    expect(g.rows).toBe(4);
    expect(g.walk[0 * 10 + 5]).toBe(0);
    expect(g.walk[1 * 10 + 5]).toBe(1);
    expect(g.walk[2 * 10 + 5]).toBe(1);
    expect(g.walk[3 * 10 + 5]).toBe(0);
  });

  it('removes a lone stray cell', () => {
    const g = buildGrid(bitmap(160, 160, (x, y) => x >= 80 && x < 96 && y >= 80 && y < 96), 160, 160, { cell: 16 });
    expect(g.walk.some(Boolean)).toBe(false);
  });
});

describe('nearestWalkable', () => {
  it('finds the closest path cell', () => {
    const g = gridFrom(['.....', '.....', '....#']);
    expect(nearestWalkable(g, 0, 0)).toMatchObject({ cx: 4, cy: 2 });
    expect(nearestWalkable(g, 4, 2).dist).toBe(0);
  });
});

describe('findPath', () => {
  const g = gridFrom([
    '#####.',
    '....#.',
    '.####.',
    '.#....',
    '.#####',
  ]);

  it('follows the road', () => {
    const p = findPath(g, { cx: 0, cy: 0 }, { cx: 5, cy: 4 });
    expect(p[0]).toEqual({ cx: 0, cy: 0 });
    expect(p.at(-1)).toEqual({ cx: 5, cy: 4 });
    for (const c of p) expect(g.walk[c.cy * g.cols + c.cx]).toBe(1);
  });

  it('does not cut corners through grass', () => {
    const p = findPath(g, { cx: 0, cy: 0 }, { cx: 5, cy: 4 });
    for (let i = 1; i < p.length; i++) {
      const dx = p[i].cx - p[i - 1].cx, dy = p[i].cy - p[i - 1].cy;
      if (dx && dy) {
        expect(g.walk[p[i - 1].cy * g.cols + p[i].cx]).toBe(1);
        expect(g.walk[p[i].cy * g.cols + p[i - 1].cx]).toBe(1);
      }
    }
  });

  it('returns null when unreachable or off-road', () => {
    const split = gridFrom(['##.##']);
    expect(findPath(split, { cx: 0, cy: 0 }, { cx: 4, cy: 0 })).toBeNull();
    expect(findPath(split, { cx: 2, cy: 0 }, { cx: 4, cy: 0 })).toBeNull();
  });

  it('smoothPath keeps the ends and shortens a straight road', () => {
    const line = gridFrom(['##########', '##########', '##########']);
    const p = findPath(line, { cx: 0, cy: 1 }, { cx: 9, cy: 1 });
    const s = smoothPath(line, p);
    expect(s).toEqual([{ cx: 0, cy: 1 }, { cx: 9, cy: 1 }]);
  });
});

describe('flowField', () => {
  it('measures steps to the goal and leaves islands unreachable', () => {
    const g = gridFrom(['###.#']);
    const d = flowField(g, { cx: 0, cy: 0 });
    expect([...d]).toEqual([0, 1, 2, Infinity, Infinity]);
  });
});

describe('validateMap', () => {
  // 1280×720 world, cell 16 → 80×45 grid. Road: horizontal through the middle (row 22).
  const cols = 80, rows = 45;
  const walk = new Uint8Array(cols * rows);
  for (let x = 0; x < cols; x++) for (const y of [21, 22, 23]) walk[y * cols + x] = 1;
  const grid = { cols, rows, cell: 16, walk };

  const good = () => {
    const m = emptyMap('t');
    m.centre = { x: 640, y: 360, radius: 60 };
    m.spots = Array.from({ length: 10 }, (_, i) => ({ id: i, x: 300 + i * 70, y: 330 }));
    m.caves = [{ id: 'c1', x: 10, y: 360 }, { id: 'c2', x: 1270, y: 360 }];
    return m;
  };

  it('accepts a correct map', () => {
    expect(validateMap(good(), grid)).toEqual({ ok: true, problems: [] });
  });

  it('reports missing pieces and misplaced ones', () => {
    const m = good();
    m.spots = m.spots.slice(0, 3);
    m.spots[0].y = 50; // far from road
    m.caves.push({ id: 'c3', x: 640, y: 330 }); // right at the Town Hall
    m.caves.push({ id: 'c4', x: 400, y: 150 }); // far from every road
    const problems = validateMap(m, grid).problems;
    const keys = problems.map((p) => p.key);
    expect(keys).not.toContain('spot_count'); // any number of spots is fine…
    expect(keys).toContain('spot_far');
    expect(problems).toContainEqual({ key: 'cave_too_close', params: { n: 3 } });
    expect(problems).toContainEqual({ key: 'cave_off_path', params: { n: 4 } });
    expect(validateMap({ ...good(), spots: [] }, grid).problems.map((p) => p.key)).toContain('spot_count'); // …but at least one
  });

  it('accepts caves in the middle of the map, next to a road', () => {
    const m = good();
    m.caves = [{ id: 'c1', x: 250, y: 320 }, { id: 'c2', x: 1000, y: 400 }];
    expect(validateMap(m, grid)).toEqual({ ok: true, problems: [] });
  });

  it('places a cave right beside the nearest road, on the side of the click', () => {
    // road rows 21–23 → y 336..384
    const above = placeCave(grid, { x: 300, y: 290 });
    expect(above.x).toBeCloseTo(300, -1);
    expect(above.y).toBeLessThan(336); // on the grass above the road…
    expect(above.y).toBeGreaterThan(336 - 40); // …touching it
    const below = placeCave(grid, { x: 900, y: 430 });
    expect(below.y).toBeGreaterThan(384);
    expect(below.y).toBeLessThan(384 + 40);
    const onRoad = placeCave(grid, { x: 600, y: 350 }); // clicked on the road: nearest side
    expect(onRoad.y < 336 || onRoad.y > 384).toBe(true);
    expect(placeCave(grid, { x: 600, y: 100 })).toBeNull(); // no road near
    const m = good();
    m.caves = [{ id: 'a', ...above }, { id: 'b', ...below }, { id: 'c', ...onRoad, x: 200 }];
    expect(validateMap(m, grid).ok).toBe(true);
  });

  it('detects a cave not connected to the centre', () => {
    const w2 = new Uint8Array(walk);
    for (const y of [21, 22, 23]) w2[y * cols + 20] = 0; // cut the road
    const keys = validateMap(good(), { ...grid, walk: w2 }).problems.map((p) => p.key);
    expect(keys).toContain('cave_not_connected');
  });
});
