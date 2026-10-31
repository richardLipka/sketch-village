import { describe, it, expect } from 'vitest';
import { gameSize, hiddenShare, mapBorder, startScroll, BORDER_SHARE } from './viewport.js';

describe('the game covers the screen', () => {
  it('a phone held sideways (wider than the map): the whole width, part of the height to drag to', () => {
    const g = gameSize(844, 390, 1280, 720, 'phone');
    expect(g.cover).toBe(true);
    expect(g.width).toBe(1280);
    expect(g.width / g.height).toBeCloseTo(844 / 390, 1); // the screen's shape: no empty bars
    expect(g.height).toBeLessThan(720);
  });
  it('a taller screen: the whole height, part of the width', () => {
    const g = gameSize(768, 1024, 1280, 720, 'tablet');
    expect(g.height).toBe(720);
    expect(g.width).toBeLessThan(1280);
  });
  it('a PC covers when only a little is hidden, else shows the whole map', () => {
    expect(gameSize(1280, 800, 1280, 720, 'pc').cover).toBe(true); // 16 : 10 hides 10 %
    expect(gameSize(1000, 1000, 1280, 720, 'pc')).toEqual({ width: 1280, height: 720, cover: false });
    expect(hiddenShare(1280, 720, 1280, 720)).toBe(0);
  });
  it('no size yet: the map', () => {
    expect(gameSize(0, 0, 1280, 720, 'phone')).toEqual({ width: 1280, height: 720, cover: false });
  });
});

describe('the paper border around the map', () => {
  it('is a share of the view on every side, so the edges can be scrolled out from under the controls', () => {
    const b = mapBorder(1280, 591);
    expect(b).toEqual({ x: Math.round(1280 * BORDER_SHARE), y: Math.round(591 * BORDER_SHARE) });
    // the bottom bar of a PC (≈ 12 % of the screen) and a phone's side columns (≈ 15 %) fit in it
    expect(BORDER_SHARE).toBeGreaterThan(0.15);
  });
  it('the game starts at the village with no border in view', () => {
    expect(startScroll({ x: 640, y: 360 }, 1280, 591, 1280, 720)).toEqual({ x: 0, y: 360 - 591 / 2 });
    expect(startScroll({ x: 40, y: 700 }, 1000, 500, 1280, 720)).toEqual({ x: 0, y: 220 }); // a corner: clamped to the map
    expect(startScroll({ x: 640, y: 360 }, 1280, 720, 1280, 720)).toEqual({ x: 0, y: 0 });
  });
});
