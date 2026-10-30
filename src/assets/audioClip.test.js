import { describe, it, expect } from 'vitest';
import { findTrim, normalizeGain, clampTrim, waveform, recorderMime, MAX_PLAY_SECONDS } from './audioClip.js';

const RATE = 1000;
// silence, a "roar" from 0.5 s to 1.2 s, silence until 2 s
const recording = () => {
  const s = new Float32Array(2 * RATE);
  for (let i = 500; i < 1200; i++) s[i] = 0.4 * Math.sin(i / 3);
  for (let i = 0; i < s.length; i++) s[i] += (i % 7) * 0.001; // a little hiss
  return s;
};

describe('monster sound helpers', () => {
  it('cuts the silence before and after the sound (with a little padding)', () => {
    const { start, end } = findTrim(recording(), RATE);
    expect(start).toBeGreaterThan(0.4);
    expect(start).toBeLessThan(0.5);
    expect(end).toBeGreaterThan(1.15);
    expect(end).toBeLessThan(1.3);
  });

  it('keeps a silent recording whole but never longer than allowed', () => {
    expect(findTrim(new Float32Array(10 * RATE), RATE)).toEqual({ start: 0, end: MAX_PLAY_SECONDS });
  });

  it('makes quiet recordings louder, but not endlessly', () => {
    const s = recording();
    expect(normalizeGain(s, RATE, 0.5, 1.2)).toBeCloseTo(0.8 / 0.406, 1);
    expect(normalizeGain(new Float32Array(100).fill(0.01), RATE)).toBe(6);
    expect(normalizeGain(new Float32Array(100), RATE)).toBe(1);
  });

  it('keeps a hand-made trim inside the recording', () => {
    expect(clampTrim({ start: 1.9, end: 1.0 }, 2)).toEqual({ start: 1.9, end: 1.95 });
    expect(clampTrim({ start: -1, end: 9 }, 10)).toEqual({ start: 0, end: MAX_PLAY_SECONDS });
  });

  it('draws a waveform column by column', () => {
    const w = waveform(recording(), 20);
    expect(w).toHaveLength(20);
    expect(w[0][1]).toBeLessThan(0.01); // silence
    expect(w[8][1]).toBeGreaterThan(0.3); // the roar
  });

  it('picks a recording format the browser supports', () => {
    expect(recorderMime({ isTypeSupported: (m) => m === 'audio/mp4' })).toBe('audio/mp4');
    expect(recorderMime(undefined)).toBe(null);
  });
});
