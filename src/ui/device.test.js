import { describe, it, expect } from 'vitest';
import { classifyDevice } from './device.js';

describe('device detection', () => {
  it('phones held sideways or upright, tablets, PCs', () => {
    expect(classifyDevice({ coarse: true, width: 844, height: 390 })).toBe('phone'); // iPhone sideways
    expect(classifyDevice({ coarse: true, width: 390, height: 844 })).toBe('phone'); // upright
    expect(classifyDevice({ coarse: true, width: 740, height: 360 })).toBe('phone'); // small Android
    expect(classifyDevice({ coarse: true, width: 1024, height: 768 })).toBe('tablet');
    expect(classifyDevice({ coarse: false, width: 1920, height: 1080 })).toBe('pc');
    expect(classifyDevice({ coarse: false, width: 1100, height: 480 })).toBe('phone'); // a very low window
  });
});
