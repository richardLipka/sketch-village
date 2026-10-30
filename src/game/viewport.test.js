import { describe, it, expect } from 'vitest';
import { gameSize, hiddenShare } from './viewport.js';

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
