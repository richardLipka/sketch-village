import { describe, it, expect } from 'vitest';
import { fetchDefaultData } from './defaultData.js';
import { roundCaves } from '../logic/waves.js';
import { clampPoints, HERO_RULES } from '../config/heroStats.js';
import { itemsOf as itemsFromAssets, coinTypesOf, DEFAULT_COMPONENTS } from '../config/components.js';
import { parseSaveFile, mergeSaveFile } from './saveFile.js';
import { comparable, diffRecords } from './mergePlan.js';
import { migrateDb } from './migrate.js';
import cs from '../locales/cs.json';
import en from '../locales/en.json';
import shipped from '../../public/default-data.json';

const empty = { format: 'sketch-village', version: 3, settings: {}, assets: [], maps: [], themes: [], rules: [] };

const reply = (status, body) => async () => ({ ok: status === 200, text: async () => JSON.stringify(body) });

describe('class pack (public/default-data.json)', () => {
  it('returns the pack when it has data', async () => {
    const pack = await fetchDefaultData(reply(200, { ...empty, maps: [{ id: 'm1' }] }));
    expect(pack.maps).toHaveLength(1);
  });

  it('ignores a missing, empty or broken pack', async () => {
    expect(await fetchDefaultData(reply(404, {}))).toBeNull();
    expect(await fetchDefaultData(reply(200, empty))).toBeNull(); // nothing in it
    expect(await fetchDefaultData(reply(200, { format: 'something-else' }))).toBeNull();
    expect(await fetchDefaultData(async () => { throw new Error('offline'); })).toBeNull();
  });
});

describe('the shipped class pack: the class’s drawings', () => {
  const pack = parseSaveFile(JSON.stringify(shipped));
  const byId = Object.fromEntries(pack.assets.map((a) => [a.id, a]));

  it('draws every built-in monster and building, with the game’s names and legends', () => {
    for (const c of DEFAULT_COMPONENTS.filter((x) => ['enemy', 'building'].includes(x.category))) {
      const a = byId[c.id];
      expect(a?.images?.some(Boolean), c.id).toBe(true);
      expect(a.name).toEqual(c.name);
      if (c.legend) expect(a.legend).toEqual(c.legend);
      // the kids' numbers are the game's numbers (only the castle sends the drawn soldiers)
      const diff = diffRecords(comparable({ ...c, images: [], author: '' }), comparable({ ...a, images: [], author: '' }));
      expect(diff.filter((d) => !d.path.endsWith('soldierKind')), c.id).toEqual([]);
    }
    expect(pack.assets.filter((a) => a.category === 'hero').map((a) => a.name)).toEqual(['Lara', 'Robin', 'Goblinobijec', 'Čarodějka']);
    expect(pack.assets.some((a) => a.category === 'icon')).toBe(false);
  });

  it('refers only to things it holds or the game has', () => {
    const known = new Set([...pack.assets.map((a) => a.id), ...DEFAULT_COMPONENTS.map((c) => c.id)]);
    for (const a of pack.assets) {
      for (const id of a.stats?.minions ?? []) expect(known.has(id), `${a.id} → ${id}`).toBe(true);
      for (const l of a.stats?.levels ?? []) if (l.soldierKind) expect(known.has(l.soldierKind)).toBe(true);
    }
  });

  it('a fresh browser starts with it: drawn monsters, no duplicates', () => {
    const fresh = migrateDb(mergeSaveFile({ settings: {}, assets: [], maps: [], themes: [], rules: [] }, pack).db).db;
    const ids = fresh.assets.map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toEqual(expect.arrayContaining(DEFAULT_COMPONENTS.map((c) => c.id)));
    expect(fresh.assets.find((a) => a.id === 'rukh').images[0]).toMatch(/^data:image\/webp/);
  });
});

describe('small helpers', () => {
  it('roundCaves lists the caves a round really uses', () => {
    const ids = ['a', 'b', 'c'];
    expect(roundCaves({ groups: [{ enemy: 'x', count: 1, spawn: 'b' }] }, ids)).toEqual([2]);
    expect(roundCaves({ groups: [{ enemy: 'x', count: 5, spawn: 'all' }] }, ids)).toEqual([1, 2, 3]);
  });

  it('clampPoints respects the total and the per-stat max', () => {
    expect(clampPoints({ melee: 9, ranged: 9, armor: 9 }, { ...HERO_RULES, points: 7, statMax: 4 })).toEqual({ melee: 4, ranged: 3, armor: 0, speed: 0, magic: 0 });
  });
});

describe('items and coins drawn in the studio', () => {
  const pic = 'data:image/png;base64,x';
  const assets = [
    { id: 'a1', category: 'weapon', name: 'Big hammer', images: [pic], stats: { kind: 'melee', hands: 2, damage: 20, price: 70 } },
    { id: 'a2', category: 'shield', name: 'Lid', images: [pic], stats: { armor: 0.12 } },
    { id: 'a3', category: 'armor', name: 'Coat', images: [pic] },
    { id: 'a4', category: 'weapon', name: 'No picture yet', images: [null] },
    { id: 'c1', category: 'coin', name: 'Gold', images: [pic], stats: { value: 10 } },
    { id: 'c2', category: 'coin', name: 'Old coin', images: [pic] },
  ];

  it('drawn weapons, shields and armor become items with their numbers', () => {
    const items = itemsFromAssets(assets);
    expect(items.map((i) => i.id)).toEqual(['a1', 'a2', 'a3', 'a4']); // a component without a picture is still an item
    expect(items[0]).toMatchObject({ slot: 'twohand', kind: 'melee', damage: 20, price: 70, image: pic, name: { cs: 'Big hammer', en: 'Big hammer' } });
    expect(items[1]).toMatchObject({ slot: 'shield', armor: 0.12 });
    expect(items[2]).toMatchObject({ slot: 'armor', armor: 0.08 }); // defaults
    expect(items[3].image).toBeNull();
  });

  it('every coin component is a coin type with its value (circles until drawn)', () => {
    expect(coinTypesOf(assets).map((c) => [c.value, c.key])).toEqual([[10, 'coin:c1'], [1, 'coin:c2']]);
    expect(coinTypesOf([{ id: 'x', category: 'coin', images: [], stats: { value: 5 } }])[0].key).toBe('coin5');
    expect(coinTypesOf([]).map((c) => c.value)).toEqual([1, 5]);
  });
});

describe('translations', () => {
  // plural forms differ by language (Czech has few / many) – compare the base keys
  const plural = (k) => k.replace(/_(zero|one|two|few|many|other)$/, '');
  const keys = (o, p = '') => [...new Set(Object.entries(o).flatMap(([k, v]) => (typeof v === 'object' ? keys(v, `${p}${k}.`) : [`${p}${plural(k)}`])))];
  it('Czech and English have the same keys', () => {
    expect(keys(cs).sort()).toEqual(keys(en).sort());
  });
});
