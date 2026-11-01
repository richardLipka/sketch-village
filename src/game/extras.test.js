import { describe, it, expect } from 'vitest';
import { musicBar, soundFor } from './sound.js';
import { collectionOf } from './Chronicle.jsx';
import { rangeOf, abilityLine } from './BuildPanel.jsx';
import { SPEEDS } from './GameOverlay.jsx';

// Quiet music, the chronicle's collection, the range shown while choosing a building, 3× speed.

describe('quiet music', () => {
  it('every bar: a low note and a few melody notes of the pentatonic scale, the same every time', () => {
    const PENTA = new Set([0, 2, 4, 7, 9]);
    for (let i = 0; i < 32; i++) {
      const bar = musicBar(i);
      expect(bar[0]).toMatchObject({ beat: 0, len: 4 });
      expect(bar[0].note).toBeLessThan(60);
      for (const n of bar.slice(1)) {
        expect(PENTA.has((n.note - 72) % 12)).toBe(true);
        expect(n.beat).toBeGreaterThanOrEqual(0);
        expect(n.beat).toBeLessThan(4);
      }
      expect(musicBar(i)).toEqual(bar);
    }
    expect(musicBar(1)).not.toEqual(musicBar(5)); // not one bar over and over
  });

  it('an ability has a sound', () => {
    expect(soundFor({ type: 'ability', id: 'strike' })).toBe('magic');
    expect(soundFor({ type: 'ability', id: 'heal' })).toBe('chest');
  });
});

describe('the chronicle’s collection', () => {
  it('counts the monsters met that still exist', () => {
    const enemies = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
    const c = collectionOf(enemies, ['a', 'c', 'gone', 'a']);
    expect(c).toMatchObject({ met: 2, total: 3 });
    expect([...c.ids]).toEqual(['a', 'c']);
    expect(collectionOf(enemies, undefined).met).toBe(0);
  });
});

describe('choosing a building, playing fast', () => {
  it('the range of what shoots (arrows or stones), none for the rest', () => {
    expect(rangeOf({ range: 180 })).toBe(180);
    expect(rangeOf({ lobRange: 230 })).toBe(230);
    expect(rangeOf({ workers: 1 })).toBe(null);
  });

  it('an ability in a short line; speeds 1×, 2×, 3×', () => {
    const t = (k, o) => `${k.split('_')[1]}=${o.v}`;
    expect(abilityLine({ id: 'shout', power: 0.5, radius: 160, duration: 5, cooldown: 25 }, t)).toBe('power=50 · radius=160 · duration=5 · cooldown=25');
    expect(SPEEDS).toEqual([1, 2, 3]);
  });
});
