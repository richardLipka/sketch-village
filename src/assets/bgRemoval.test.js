import { describe, it, expect } from 'vitest';
import { estimatePaperColor, removePaper, floodErase, vividColors } from './bgRemoval.js';

// Build a w×h RGBA image filled with `bg`, with `fg` pixels where draw(x,y) is true.
function img(w, h, bg, fg, draw) {
  const d = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const c = draw(x, y) ? fg : bg;
    const i = (y * w + x) * 4;
    d[i] = c[0]; d[i + 1] = c[1]; d[i + 2] = c[2]; d[i + 3] = 255;
  }
  return d;
}
const alpha = (d, w, x, y) => d[(y * w + x) * 4 + 3];

const PAPER = [235, 230, 220];
const INK = [30, 40, 120];

describe('estimatePaperColor', () => {
  it('finds the border colour', () => {
    const d = img(10, 10, PAPER, INK, (x, y) => x > 3 && x < 6 && y > 3 && y < 6);
    expect(estimatePaperColor(d, 10, 10)).toEqual(PAPER);
  });
});

describe('removePaper', () => {
  // Hollow ink square (ring) with paper inside it.
  const ring = (x, y) => x >= 2 && x <= 7 && y >= 2 && y <= 7 && (x === 2 || x === 7 || y === 2 || y === 7);

  it('clears outside paper but keeps enclosed paper by default', () => {
    const d = img(10, 10, PAPER, INK, ring);
    removePaper(d, 10, 10, { softness: 0 });
    expect(alpha(d, 10, 0, 0)).toBe(0);
    expect(alpha(d, 10, 2, 2)).toBe(255); // ink
    expect(alpha(d, 10, 5, 5)).toBe(255); // paper inside the ring
  });

  it('clears enclosed paper with inside: true', () => {
    const d = img(10, 10, PAPER, INK, ring);
    removePaper(d, 10, 10, { inside: true, softness: 0 });
    expect(alpha(d, 10, 5, 5)).toBe(0);
    expect(alpha(d, 10, 2, 2)).toBe(255);
  });

  it('tolerates uneven lighting', () => {
    const d = img(10, 10, PAPER, INK, ring);
    // darker paper in one corner (shadow)
    d[0] = 200; d[1] = 195; d[2] = 185;
    removePaper(d, 10, 10, { tolerance: 35, softness: 0 });
    expect(alpha(d, 10, 0, 0)).toBe(0);
  });
});

describe('floodErase', () => {
  it('erases only the connected region', () => {
    const d = img(10, 10, PAPER, INK, (x) => x === 5); // vertical line splits image
    floodErase(d, 10, 10, 0, 0, 10);
    expect(alpha(d, 10, 4, 4)).toBe(0);
    expect(alpha(d, 10, 5, 4)).toBe(255);
    expect(alpha(d, 10, 6, 4)).toBe(255);
  });
});

describe('vividColors', () => {
  it('makes colours more colourful, leaves greys and transparent pixels alone', () => {
    const d = new Uint8ClampedArray([200, 150, 150, 255, 120, 120, 120, 255, 200, 150, 150, 0]);
    vividColors(d, 50);
    expect(d[0] - d[1]).toBeGreaterThan(50); // red got redder
    expect([...d.slice(4, 8)]).toEqual([120, 120, 120, 255]);
    expect([...d.slice(8, 12)]).toEqual([200, 150, 150, 0]);
    const same = new Uint8ClampedArray([200, 150, 150, 255]);
    vividColors(same, 0);
    expect([...same]).toEqual([200, 150, 150, 255]);
  });
});
