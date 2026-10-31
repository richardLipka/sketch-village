import { describe, it, expect } from 'vitest';
import { migrateDb, DATA_VERSION } from './migrate.js';
import { DEFAULT_COMPONENTS, buildingsOf, enemyTypesOf, itemsOf } from '../config/components.js';
import { World } from '../logic/world.js';
import { DEFAULT_THEMES } from '../config/themes.js';

const pic = 'data:image/png;base64,x';
const T = '2026-10-29T12:00:00.000Z';

describe('data migration (v1 → components)', () => {
  it('a fresh browser gets the built-in components once', () => {
    const { db, changed } = migrateDb({ settings: {}, assets: [] });
    expect(changed).toBe(true);
    expect(db.assets.map((a) => a.id)).toEqual(DEFAULT_COMPONENTS.map((c) => c.id));
    expect(db.settings).toMatchObject({ dataVersion: DATA_VERSION, themesSeeded: true });
    expect(db.settings.builtInsSeeded).toHaveLength(DEFAULT_COMPONENTS.length);
    expect(db.themes.map((th) => th.id)).toEqual(DEFAULT_THEMES.map((th) => th.id));
    // running again changes nothing; deleted built-ins don't come back
    const again = migrateDb({ ...db, assets: db.assets.filter((a) => a.id !== 'goblin') });
    expect(again.changed).toBe(false);
    expect(again.db.assets.some((a) => a.id === 'goblin')).toBe(false);
  });

  it('old data becomes components, keeping the kids\' edits and drawings', () => {
    const old = {
      settings: { starterAdded: true },
      assets: [
        { id: 'd1', category: 'tower', name: 'Red tower', images: [pic, null, null] },
        { id: 'd2', category: 'enemy', name: 'Slime picture', images: [pic] },
        { id: 'd3', category: 'townhall', name: 'Our hall', images: [pic] },
      ],
      buildingTypes: [{ id: 'tower', name: { cs: 'Věž', en: 'Tower' }, levels: [{ cost: 33, time: 12, hp: 500, damage: 9, range: 180, cooldown: 1 }], updatedAt: T }],
      enemyTypes: [{ id: 'goblin', name: { cs: 'Skřet', en: 'Goblin' }, hp: 99, speed: 45, asset: 'd2', updatedAt: T }],
      weapons: [{ id: 'sword', name: { cs: 'Meč', en: 'Sword' }, kind: 'melee', damage: 50, price: 1, shop: true, round: 1, drop: 0, updatedAt: T }],
      rules: [{ id: 'rules', townHallLevels: [{ hp: 777 }], unlocks: [{ key: 'tower:1', round: 4 }, { key: 'hero:melee:1', round: 2 }], updatedAt: T }],
    };
    const { db } = migrateDb(old);
    expect(db.enemyTypes).toEqual([]);
    expect(db.buildingTypes).toEqual([]);
    expect(db.weapons).toEqual([]);
    expect(db.rules[0].townHallLevels).toBeUndefined();
    expect(db.rules[0].unlocks).toEqual([{ key: 'hero:melee:1', round: 2 }]);

    const { types, looks } = buildingsOf(db.assets);
    const tower = types.find((t) => t.id === 'tower');
    expect(tower).toMatchObject({ features: ['shoots'] });
    expect(tower.levels[0]).toMatchObject({ cost: 33, round: 4 }); // edited cost + old unlock round
    expect(looks.tower).toHaveLength(1); // the old tower drawing is a look of the tower type
    expect(types.find((t) => t.core).levels[0].hp).toBe(777);
    expect(looks.townhall).toHaveLength(1);

    const goblin = enemyTypesOf(db.assets).find((e) => e.id === 'goblin');
    expect(goblin).toMatchObject({ hp: 99, image: pic });
    expect(db.assets.some((a) => a.id === 'd2')).toBe(false); // its picture moved into the goblin component

    expect(itemsOf(db.assets).find((i) => i.id === 'sword')).toMatchObject({ damage: 50, price: 1, slot: 'hand' });
  });

  it('the migrated components play: a World runs with them', () => {
    const { db } = migrateDb({ settings: {}, assets: [] });
    const cols = 80, rows = 45;
    const walk = new Uint8Array(cols * rows).fill(1);
    const w = new World({
      map: { centre: { x: 640, y: 360 }, caves: [{ id: 'c', x: 10, y: 360 }], spots: [{ id: 's', x: 600, y: 330 }] },
      grid: { cols, rows, cell: 16, walk }, enemyTypes: enemyTypesOf(db.assets), buildingTypes: buildingsOf(db.assets).types,
      weapons: itemsOf(db.assets), waves: { rounds: [{ groups: [{ enemy: 'goblin', count: 2 }] }] },
    });
    expect(Object.keys(w.buildingTypes).sort()).toEqual(['castle', 'catapult', 'house', 'tower']);
    expect(w.coreType.id).toBe('townhall');
    expect(w.inventory).toEqual(['stick', 'shortbow']);
    for (let i = 0; i < 300; i++) w.update(1 / 30);
  });

  it('v2 → v3: new built-ins arrive in an existing browser, deleted ones stay deleted, themes are added', () => {
    // a version-2 browser: seeded once, goblin deleted by a kid, tower edited (no themes yet)
    const v2 = migrateDb({ settings: {}, assets: [] }).db;
    const old = {
      settings: { componentsSeeded: true, dataVersion: 2 },
      assets: v2.assets
        .filter((a) => ['townhall', 'house', 'tower', 'castle', 'wolf', 'orc'].includes(a.id))
        .map(({ themes, ...a }) => (a.id === 'tower' ? { ...a, name: 'Our tower' } : a)),
      maps: [], rules: [],
    };
    const { db, changed } = migrateDb(old);
    expect(changed).toBe(true);
    const ids = db.assets.map((a) => a.id);
    for (const id of ['catapult', 'skeleton', 'necromancer', 'spider', 'spiderling']) expect(ids).toContain(id);
    expect(ids).not.toContain('goblin'); // deleted in version 2: stays deleted
    expect(db.assets.find((a) => a.id === 'tower').name).toBe('Our tower');
    expect(db.assets.find((a) => a.id === 'wolf').themes).toEqual(['plains', 'goblinForest']);
    expect(db.themes).toHaveLength(DEFAULT_THEMES.length);
    expect(db.settings.componentsSeeded).toBeUndefined();
    // and again: nothing more to do; a deleted new built-in doesn't come back either
    const again = migrateDb({ ...db, assets: db.assets.filter((a) => a.id !== 'catapult'), themes: db.themes.slice(1) });
    expect(again.changed).toBe(false);
    expect(again.db.assets.some((a) => a.id === 'catapult')).toBe(false);
    expect(again.db.themes).toHaveLength(DEFAULT_THEMES.length - 1);
  });
});

describe('data version 4: buildings have 20 % less HP', async () => {
  const { migrateDb, HP_SCALE_V4 } = await import('./migrate.js');
  const { DEFAULT_COMPONENTS } = await import('../config/components.js');
  const tower = DEFAULT_COMPONENTS.find((c) => c.id === 'tower');

  it('scales the buildings of a version-3 browser once, kids’ own ones too', () => {
    const old = structuredClone(tower);
    old.stats.levels = old.stats.levels.map((l) => ({ ...l, hp: Math.round(l.hp / HP_SCALE_V4) }));
    const mine = { id: 'kid-hut', category: 'building', name: 'Hut', images: [], stats: { features: ['workers'], levels: [{ cost: 5, time: 5, hp: 100, round: 1, workers: 1 }] } };
    const look = { id: 'kid-look', category: 'building', name: 'Look', images: [], stats: { variantOf: 'tower' } };
    const seeded = DEFAULT_COMPONENTS.map((c) => c.id);
    const db = { settings: { dataVersion: 3, builtInsSeeded: seeded, themesSeeded: true }, assets: [old, mine, look], maps: [], themes: [], rules: [] };
    const once = migrateDb(db).db;
    expect(once.assets.find((a) => a.id === 'tower').stats.levels.map((l) => l.hp)).toEqual(tower.stats.levels.map((l) => l.hp));
    expect(once.assets.find((a) => a.id === 'kid-hut').stats.levels[0].hp).toBe(80);
    expect(once.assets.find((a) => a.id === 'kid-look').stats).toEqual({ variantOf: 'tower' });
    expect(once.settings.dataVersion).toBe(4);
    const twice = migrateDb(once).db; // already version 4: not again
    expect(twice.assets.find((a) => a.id === 'kid-hut').stats.levels[0].hp).toBe(80);
  });

  it('a fresh browser gets the new numbers as they are', () => {
    const fresh = migrateDb({ settings: {}, assets: [], maps: [], themes: [], rules: [] }).db;
    expect(fresh.assets.find((a) => a.id === 'tower').stats.levels.map((l) => l.hp)).toEqual(tower.stats.levels.map((l) => l.hp));
  });

  it('a new built-in takes over the component a kid already made under its name', () => {
    const seeded = DEFAULT_COMPONENTS.map((c) => c.id).filter((id) => !['goblinPack', 'skeletonWarrior', 'rukh'].includes(id));
    const base = migrateDb({ settings: {}, assets: [] }).db;
    const rukh = { id: 'uuid-rukh', category: 'enemy', name: 'Rukh', author: 'Bárník', images: [pic], stats: { hp: 150, flying: true }, updatedAt: T };
    const pack = { id: 'uuid-pack', category: 'enemy', name: 'Smečka goblinů', images: [pic], stats: { hp: 25 }, legend: { story: { cs: 'kopie', en: 'copy' }, hint: '' } };
    const warrior = { id: 'uuid-war', category: 'enemy', name: 'Kostlivý bojovník', images: [pic], stats: { hp: 18 }, legend: { story: 'Náš bojovník', hint: '' } };
    // a browser from before they were built-in: its necromancer calls the kid's warrior, a map sends the kid's roc
    const older = base.assets.filter((a) => seeded.includes(a.id)).map((a) => (a.id === 'necromancer' ? { ...a, stats: { ...a.stats, minions: ['skeleton', 'uuid-war'] } } : a));
    const map = { id: 'm', waves: { rounds: [{ groups: [{ enemy: 'uuid-rukh', count: 1 }, { enemy: 'uuid-pack', count: 2 }] }] } };
    const { db, changed } = migrateDb({ ...base, settings: { ...base.settings, builtInsSeeded: seeded }, assets: [...older, rukh, pack, warrior], maps: [map] });
    expect(changed).toBe(true);
    const got = db.assets.find((a) => a.id === 'rukh');
    expect(got).toMatchObject({ builtIn: true, author: 'Bárník', images: [pic], stats: { hp: 150, flying: true }, name: { cs: 'Rukh', en: 'Roc' } });
    expect(got.legend).toEqual(DEFAULT_COMPONENTS.find((c) => c.id === 'rukh').legend);
    expect(db.assets.find((a) => a.id === 'goblinPack').legend).toEqual(DEFAULT_COMPONENTS.find((c) => c.id === 'goblinPack').legend); // a copied legend is replaced
    expect(db.assets.find((a) => a.id === 'skeletonWarrior').legend.story).toBe('Náš bojovník'); // the kid's own is kept
    expect(db.assets.filter((a) => a.category === 'enemy' && a.id.startsWith('uuid'))).toHaveLength(0); // nothing twice
    expect(db.assets.find((a) => a.id === 'necromancer').stats.minions).toEqual(['skeleton', 'skeletonWarrior']);
    expect(db.maps[0].waves.rounds[0].groups.map((g) => g.enemy)).toEqual(['rukh', 'goblinPack']);
  });
});
