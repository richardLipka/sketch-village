import { describe, it, expect } from 'vitest';
import { fetchDefaultData } from './defaultData.js';
import { roundCaves } from '../logic/waves.js';
import { clampPoints, HERO_RULES } from '../config/heroStats.js';
import cs from '../locales/cs.json';
import en from '../locales/en.json';
import empty from '../../public/default-data.json';

const reply = (status, body) => async () => ({ ok: status === 200, text: async () => JSON.stringify(body) });

describe('class pack (public/default-data.json)', () => {
  it('returns the pack when it has data', async () => {
    const pack = await fetchDefaultData(reply(200, { ...empty, maps: [{ id: 'm1' }] }));
    expect(pack.maps).toHaveLength(1);
  });

  it('ignores a missing, empty or broken pack', async () => {
    expect(await fetchDefaultData(reply(404, {}))).toBeNull();
    expect(await fetchDefaultData(reply(200, empty))).toBeNull(); // the shipped placeholder
    expect(await fetchDefaultData(reply(200, { format: 'something-else' }))).toBeNull();
    expect(await fetchDefaultData(async () => { throw new Error('offline'); })).toBeNull();
  });
});

describe('small helpers', () => {
  it('roundCaves lists the caves a round really uses', () => {
    const ids = ['a', 'b', 'c'];
    expect(roundCaves({ groups: [{ enemy: 'x', count: 1, spawn: 'b' }] }, ids)).toEqual([2]);
    expect(roundCaves({ groups: [{ enemy: 'x', count: 5, spawn: 'all' }] }, ids)).toEqual([1, 2, 3]);
  });

  it('clampPoints respects the total and the per-stat max', () => {
    expect(clampPoints({ melee: 9, ranged: 9, armor: 9 }, { ...HERO_RULES, points: 7, statMax: 4 })).toEqual({ melee: 4, ranged: 3, armor: 0, speed: 0 });
  });
});

describe('translations', () => {
  const keys = (o, p = '') => Object.entries(o).flatMap(([k, v]) => (typeof v === 'object' ? keys(v, `${p}${k}.`) : [`${p}${k}`]));
  it('Czech and English have the same keys', () => {
    expect(keys(cs).sort()).toEqual(keys(en).sort());
  });
});
