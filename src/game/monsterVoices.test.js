import { describe, it, expect } from 'vitest';
import { VoiceDirector } from './monsterVoices.js';

const voices = { goblin: { walk: 0.8, attack: 0.5, death: 0.6 }, bat: { death: 0.4 }, wolf: {} };
// a "random" that always says yes (0) unless told otherwise
const director = (rng = () => 0) => new VoiceDirector({ voices, rng });
const died = (enemy) => ({ type: 'enemyDied', enemy });
const hit = (enemy) => ({ type: 'enemyAttack', enemy });

describe('monster voices', () => {
  it('a death plays its recording; monsters without one stay silent', () => {
    const d = director();
    expect(d.onEvent(died('goblin'), 0)).toMatchObject({ type: 'goblin', kind: 'death' });
    expect(d.onEvent(died('wolf'), 5)).toBe(null);
  });

  it('never more than two at once, never two starts closer than 0.35 s', () => {
    const d = director();
    expect(d.onEvent(died('goblin'), 0)).not.toBe(null);
    expect(d.onEvent(died('bat'), 0.1)).toBe(null); // too soon after the last start
    expect(d.onEvent(died('bat'), 0.4)).not.toBe(null);
    expect(d.onEvent(hit('goblin'), 0.5)).toBe(null); // two are playing (goblin until 0.6, bat until 0.8)
    expect(d.onEvent(hit('goblin'), 0.85)).not.toBe(null);
  });

  it('a hundred deaths in ten seconds give only a handful of sounds', () => {
    const d = director();
    let n = 0;
    for (let i = 0; i < 100; i++) if (d.onEvent(died(i % 2 ? 'goblin' : 'bat'), i * 0.1)) n++;
    expect(n).toBeGreaterThanOrEqual(8);
    expect(n).toBeLessThanOrEqual(14);
  });

  it('attacks: only some hits and the same kind at most every 4 s', () => {
    expect(director(() => 0.9).onEvent(hit('goblin'), 0)).toBe(null); // 0.9 ≥ chance
    const d = director();
    expect(d.onEvent(hit('goblin'), 0)).not.toBe(null);
    expect(d.onEvent(hit('goblin'), 2)).toBe(null);
    expect(d.onEvent(hit('goblin'), 4.1)).not.toBe(null);
  });

  it('a new kind introduces itself with its growl, once per game', () => {
    const d = director();
    expect(d.onEvent({ type: 'spawn', enemy: 'goblin' }, 0)).toMatchObject({ kind: 'walk' });
    expect(d.onEvent({ type: 'spawn', enemy: 'goblin' }, 20)).toBe(null);
    expect(d.onEvent({ type: 'spawn', enemy: 'bat' }, 21)).toBe(null); // no growl recorded
    expect(d.onEvent({ type: 'spawn', enemy: 'goblin', summoned: true }, 40)).toBe(null);
  });

  it('an introduction waits for a free moment, but not forever', () => {
    const d = director();
    d.onEvent(died('bat'), 0);
    expect(d.onEvent({ type: 'spawn', enemy: 'goblin' }, 0.1)).toBe(null); // busy
    expect(d.tick(0.5, { goblin: 1 })).toMatchObject({ type: 'goblin', kind: 'walk' });
    const late = director();
    late.onEvent(died('goblin'), 0);
    late.onEvent({ type: 'spawn', enemy: 'goblin' }, 0.1);
    expect(late.tick(5, { goblin: 1 }, 'prep')).toBe(null); // 3 s passed: forgotten
  });

  it('growls while walking are sparse: only in a wave, one every 6 s at most, 12–18 s per kind', () => {
    const d = director();
    d.introduced.add('goblin');
    const growls = [];
    for (let t = 0; t < 120; t++) if (d.tick(t, { goblin: 5, bat: 3 })) growls.push(t);
    expect(growls.length).toBeGreaterThanOrEqual(6);
    expect(growls.length).toBeLessThanOrEqual(10);
    for (let i = 1; i < growls.length; i++) expect(growls[i] - growls[i - 1]).toBeGreaterThanOrEqual(12);
    expect(director().tick(0, { goblin: 5 }, 'prep')).toBe(null);
  });

  it('with real randomness growls stay rare across several kinds', () => {
    const many = { a: { walk: 1 }, b: { walk: 1 }, c: { walk: 1 }, d: { walk: 1 } };
    let seed = 7;
    const rng = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const d = new VoiceDirector({ voices: many, rng });
    let n = 0;
    for (let t = 0; t < 600; t++) if (d.tick(t, { a: 4, b: 4, c: 4, d: 4 })) n++;
    expect(n).toBeLessThanOrEqual(600 / 6); // never more than one every 6 s
    expect(n).toBeGreaterThan(20); // but you do hear them
  });

  it('a crowd makes the sounds quieter', () => {
    expect(director().onEvent(died('goblin'), 0, 0).volume).toBe(1);
    expect(director().onEvent(died('goblin'), 0, 60).volume).toBe(0.55);
  });
});
