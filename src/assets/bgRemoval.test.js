import { describe, it, expect } from 'vitest';
import { estimatePaperColor, removePaper, floodErase } from './bgRemoval.js';

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
