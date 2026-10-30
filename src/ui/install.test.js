import { describe, it, expect } from 'vitest';
import { isIos, isStandalone } from './install.js';

describe('install helpers', () => {
  it('recognises iPhone and iPad (also iPadOS posing as a Mac)', () => {
    expect(isIos({ userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)', maxTouchPoints: 5 })).toBe(true);
    expect(isIos({ userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', maxTouchPoints: 5 })).toBe(true);
    expect(isIos({ userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', maxTouchPoints: 0 })).toBe(false);
    expect(isIos({ userAgent: 'Mozilla/5.0 (Linux; Android 15; Pixel 9)', maxTouchPoints: 5 })).toBe(false);
  });
  it('knows when it runs from the home screen', () => {
    const w = (mode, standalone) => ({ navigator: { standalone }, matchMedia: (q) => ({ matches: q.includes(mode) }) });
    expect(isStandalone(w('fullscreen'))).toBe(true);
    expect(isStandalone(w('browser'))).toBe(false);
    expect(isStandalone(w('browser', true))).toBe(true);
  });
});
