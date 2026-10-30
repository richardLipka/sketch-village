import { describe, it, expect } from 'vitest';
import { decorSize, onDecor, handleAt, handlePoints, resizeDecor, pointInPolygon, fillPolygon, seededRng, DECOR_BASE, MIN_DECOR } from './decorEdit.js';

const tree = { id: 't', asset: 'a', x: 100, y: 100, scale: 1 }; // 64 × 64

describe('a decoration’s frame', () => {
  it('older decorations are square by scale; new ones have their own width and height', () => {
    expect(decorSize(tree)).toEqual({ w: DECOR_BASE, h: DECOR_BASE });
    expect(decorSize({ ...tree, w: 30, h: 90 })).toEqual({ w: 30, h: 90 });
    expect(onDecor({ ...tree, w: 30, h: 90 }, { x: 110, y: 140 })).toBe(true);
    expect(onDecor({ ...tree, w: 30, h: 90 }, { x: 120, y: 100 })).toBe(false);
  });

  it('has 8 handles – corners and the middles of the sides', () => {
    expect(handlePoints(tree).map((h) => h.id)).toEqual(['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w']);
    expect(handleAt(tree, { x: 132, y: 131 }, 6)).toBe('se');
    expect(handleAt(tree, { x: 100, y: 68 }, 6)).toBe('n');
    expect(handleAt(tree, { x: 100, y: 100 }, 6)).toBe(null);
  });

  it('a generous reach (fingers) still picks the nearest handle and leaves the middle for moving', () => {
    expect(handleAt(tree, { x: 130, y: 128 }, 40)).toBe('se'); // the side handle 'e' is in reach too
    expect(handleAt(tree, { x: 100, y: 100 }, 40)).toBe(null); // the middle of a small one: move it
    expect(handleAt(tree, { x: 100, y: 75 }, 40)).toBe('n');
  });

  it('a corner makes it bigger or smaller keeping the shape; the opposite corner stays', () => {
    const r = resizeDecor({ ...tree, w: 40, h: 80 }, 'se', { x: 160, y: 150 }); // pulled to twice the width
    expect(r.w / r.h).toBeCloseTo(0.5);
    expect(r.x - r.w / 2).toBeCloseTo(80); // the top-left corner didn't move
    expect(r.y - r.h / 2).toBeCloseTo(60);
  });

  it('a side stretches only that side (changes the shape)', () => {
    const r = resizeDecor(tree, 'e', { x: 200, y: 999 });
    expect(r.h).toBe(64);
    expect(r.w).toBeCloseTo(132); // from the left side at 68 to 200
    expect(r.x - r.w / 2).toBeCloseTo(68);
    const up = resizeDecor(tree, 'n', { x: 0, y: 0 });
    expect(up.w).toBe(64);
    expect(up.y + up.h / 2).toBeCloseTo(132); // the bottom stays
  });

  it('never smaller than can be grabbed', () => {
    const r = resizeDecor(tree, 'se', { x: 68, y: 68 });
    expect(r.w).toBeGreaterThanOrEqual(MIN_DECOR);
    expect(r.h).toBeGreaterThanOrEqual(MIN_DECOR);
  });
});

describe('filling a polygon with decorations', () => {
  const square = [{ x: 0, y: 0 }, { x: 400, y: 0 }, { x: 400, y: 400 }, { x: 0, y: 400 }];
  const triangle = [{ x: 0, y: 0 }, { x: 400, y: 0 }, { x: 0, y: 400 }];

  it('knows inside from outside', () => {
    expect(pointInPolygon({ x: 50, y: 50 }, triangle)).toBe(true);
    expect(pointInPolygon({ x: 350, y: 350 }, triangle)).toBe(false);
  });

  it('puts everything inside, nothing where it isn’t allowed', () => {
    const roadX = (p) => !(p.x > 180 && p.x < 220);
    const trees = fillPolygon(triangle, { size: 40, density: 6, rng: seededRng(3), allowed: roadX });
    expect(trees.length).toBeGreaterThan(5);
    for (const t of trees) {
      expect(pointInPolygon(t, triangle)).toBe(true);
      expect(roadX(t)).toBe(true);
    }
  });

  it('denser = more of them', () => {
    const n = (density) => fillPolygon(square, { size: 40, density, rng: seededRng(1) }).length;
    expect(n(10)).toBeGreaterThan(n(5));
    expect(n(5)).toBeGreaterThan(n(1));
  });

  it('size variety: none = all the same, more = a wider range', () => {
    const sizes = (variety) => fillPolygon(square, { size: 40, density: 5, variety, rng: seededRng(2) }).map((t) => t.w);
    expect(new Set(sizes(0))).toEqual(new Set([40]));
    const v = sizes(0.5);
    expect(Math.min(...v)).toBeGreaterThanOrEqual(20);
    expect(Math.max(...v)).toBeLessThanOrEqual(60);
    expect(Math.max(...v) - Math.min(...v)).toBeGreaterThan(10);
  });

  it('the same polygon with the same seed fills the same way; too few corners = nothing', () => {
    expect(fillPolygon(square, { rng: seededRng(9) })).toEqual(fillPolygon(square, { rng: seededRng(9) }));
    expect(fillPolygon(square.slice(0, 2))).toEqual([]);
  });
});
