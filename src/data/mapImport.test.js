import { describe, it, expect } from 'vitest';
import { isMapFile, planMapImport, applyMapImport, resolveDuplicates } from './mapImport.js';
import { comparable } from './mergePlan.js';
import { mapPackage } from '../maps/shareMap.js';
import { parseSaveFile } from './saveFile.js';
import { migrateDb } from './migrate.js';

const pic = (n) => `data:image/png;base64,${n}`;
const T = '2026-10-30T10:00:00.000Z';
const NOW = new Date('2026-10-31T08:00:00.000Z');

// a browser with the built-ins and a few drawings of its own
const home = () => {
  const { db } = migrateDb({ settings: {}, assets: [], maps: [], themes: [], rules: [] });
  return { ...db, assets: db.assets.map((a) => (a.id === 'goblin' ? { ...a, images: [pic('our-goblin')] } : a)) };
};

// the maker's browser: the same built-ins, but the goblin drawn differently, a
// tree of their own, a hero, and a map that sends goblins and necromancers
const maker = () => {
  const db = home();
  db.assets = db.assets.map((a) => (a.id === 'goblin' ? { ...a, images: [pic('their-goblin')], updatedAt: T } : a));
  db.assets.push(
    { id: 'tree-1', category: 'decoration', name: 'Strom', images: [pic('tree')], stats: {}, createdAt: T, updatedAt: T },
    { id: 'hero-1', category: 'hero', name: 'Lara', images: [pic('lara'), null, null, null], stats: {}, createdAt: T, updatedAt: T },
  );
  const map = {
    id: 'map-1', name: 'Zelené údolí', theme: 'plains', decorations: [{ id: 'd1', asset: 'tree-1', x: 1, y: 1 }],
    waves: { startCoins: 30, rounds: [{ groups: [{ enemy: 'goblin', count: 3 }, { enemy: 'necromancer', count: 1 }] }] }, createdAt: T, updatedAt: T,
  };
  return { db: { ...db, maps: [map] }, map };
};
const fileOf = ({ db, map }) => parseSaveFile(JSON.stringify(mapPackage(map, db)));

describe('a downloaded map', () => {
  it('holds the map and everything it needs to play, but no GUI icons', () => {
    const m = maker();
    const f = fileOf(m);
    expect(isMapFile(f)).toBe(true);
    const ids = f.assets.map((a) => a.id);
    expect(ids).toEqual(expect.arrayContaining(['townhall', 'tower', 'castle', 'catapult', 'goblin', 'necromancer', 'skeleton', 'skeletonWarrior', 'tree-1', 'hero-1', 'stick', 'coin1']));
    expect(f.assets.some((a) => a.category === 'icon')).toBe(false);
    expect(ids).not.toContain('troll'); // monsters the waves don't send stay home
    expect(f.maps[0].waves.rounds).toHaveLength(1);
  });

  it('keeps the default waves it was played with', () => {
    const m = maker();
    const f = fileOf({ ...m, map: { ...m.map, waves: null } });
    expect(f.maps[0].waves.rounds).toHaveLength(20);
    expect(f.assets.map((a) => a.id)).toEqual(expect.arrayContaining(['rukh', 'goblinPack', 'dragon', 'troll']));
  });

  it('studio defaults written on save are the same thing as no value', () => {
    const a = { id: 'x', category: 'enemy', name: 'X', images: [pic(1)], stats: { hp: 25 } };
    const b = { ...a, author: '', themes: [], stats: { hp: 25, flying: false, minions: [], minionCount: 2, splash: 0 }, images: [pic(1), null] };
    expect(comparable(a)).toEqual(comparable(b));
    expect(comparable(a)).not.toEqual(comparable({ ...a, stats: { hp: 26 } }));
  });
});

describe('importing a map', () => {
  it('into a fresh browser: new things are added, the same built-ins are used as they are', () => {
    const f = fileOf(maker());
    const db = home();
    db.assets = db.assets.map((a) => (a.id === 'goblin' ? { ...a, images: [pic('their-goblin')] } : a)); // drawn the same
    const plan = planMapImport(db, f, NOW);
    expect(plan.partials).toHaveLength(0);
    expect(plan.additions.map((x) => x.record.id).sort()).toEqual(['hero-1', 'map-1', 'tree-1']);
    expect(plan.exact).toBe(f.assets.length - 2);
    expect(plan.maps).toEqual(['map-1']);
  });

  it('the same drawing under another id is used, not copied', () => {
    const f = fileOf(maker());
    const db = home();
    db.assets.push({ id: 'my-tree', category: 'decoration', name: 'Strom', images: [pic('tree')], stats: {}, createdAt: T, updatedAt: T });
    db.assets = db.assets.map((a) => (a.id === 'goblin' ? { ...a, images: [pic('their-goblin')] } : a));
    const plan = planMapImport(db, f, NOW);
    expect(plan.additions.some((x) => x.record.id === 'tree-1')).toBe(false);
    const map = plan.additions.find((x) => x.collection === 'maps').record;
    expect(map.decorations[0].asset).toBe('my-tree');
  });

  it('a partly different thing becomes a copy named after the map – and so does whatever uses it', () => {
    const f = fileOf(maker());
    // here the skeleton has other numbers: the maker's necromancer must call the maker's skeletons
    const db = home();
    db.assets = db.assets.map((a) => (a.id === 'skeleton' ? { ...a, stats: { ...a.stats, hp: 99 } } : a));
    const plan = planMapImport(db, f, NOW);
    const byLocal = Object.fromEntries(plan.partials.map((p) => [p.local.id, p]));
    expect(Object.keys(byLocal).sort()).toEqual(['goblin', 'necromancer', 'skeleton']);
    expect(byLocal.goblin.record.name).toEqual({ cs: 'Goblin (Zelené údolí)', en: 'Goblin (Zelené údolí)' });
    expect(byLocal.goblin.record.builtIn).toBeUndefined();
    expect(byLocal.goblin.diff.map((d) => d.path)).toEqual(['images']);
    expect(byLocal.necromancer.record.stats.minions).toEqual([byLocal.skeleton.record.id, 'skeletonWarrior']);
    const { db: after, summary } = applyMapImport(db, plan);
    expect(summary).toEqual({ added: 3, copies: 3, unchanged: plan.exact });
    const map = after.maps.find((m) => m.id === 'map-1');
    expect(map.waves.rounds[0].groups.map((g) => g.enemy)).toEqual([byLocal.goblin.record.id, byLocal.necromancer.record.id]);
    expect(after.assets.find((a) => a.id === 'goblin').images).toEqual([pic('our-goblin')]); // ours untouched
  });

  it('importing the same map again adds nothing', () => {
    const f = fileOf(maker());
    const once = applyMapImport(home(), planMapImport(home(), f, NOW)).db;
    const again = planMapImport(once, f, NOW);
    expect(again.additions).toHaveLength(0);
    expect(again.partials).toHaveLength(0);
    expect(again.maps).toEqual(['map-1']);
  });

  it('again adds nothing even when the changed thing comes later in the file than what calls it', () => {
    // the skeleton warrior is stored after the necromancer who calls him
    const f = fileOf(maker());
    const db = home();
    db.assets = db.assets.map((a) => (a.id === 'skeletonWarrior' ? { ...a, stats: { ...a.stats, hp: 99 } } : a));
    const plan = planMapImport(db, f, NOW);
    expect(plan.partials.map((p) => p.local.id).sort()).toEqual(['goblin', 'necromancer', 'skeletonWarrior']);
    const once = applyMapImport(db, plan).db;
    const again = planMapImport(once, f, NOW);
    expect(again.additions).toHaveLength(0);
    expect(again.partials).toHaveLength(0);
  });

  it('my own map downloaded and loaded back is the same map (its default waves were written into the file)', () => {
    const m = maker();
    const own = { ...m.map, waves: null };
    const db = { ...m.db, maps: [own] };
    const plan = planMapImport(db, fileOf({ db, map: own }), NOW);
    expect(plan.additions).toHaveLength(0);
    expect(plan.partials).toHaveLength(0);
    expect(plan.maps).toEqual(['map-1']);
  });

  it('a changed version of a map I already have becomes "name (2)"', () => {
    const m = maker();
    const db = home();
    db.assets = db.assets.map((a) => (a.id === 'goblin' ? { ...a, images: [pic('their-goblin')] } : a));
    const first = applyMapImport(db, planMapImport(db, fileOf(m), NOW)).db;
    const changed = fileOf({ ...m, map: { ...m.map, waves: { ...m.map.waves, startCoins: 99 } } });
    const plan = planMapImport(first, changed, NOW);
    expect(plan.partials.map((p) => p.record.name)).toEqual(['Zelené údolí (2)']);
    expect(plan.maps).toEqual([plan.partials[0].record.id]);
  });

  it('the kid merges the copies: keep both, keep mine, or take the map’s version', () => {
    const f = fileOf(maker());
    const db = home();
    db.assets = db.assets.map((a) => (a.id === 'skeleton' ? { ...a, stats: { ...a.stats, hp: 99 } } : a));
    const plan = planMapImport(db, f, NOW);
    const imported = applyMapImport(db, plan).db;
    const pick = { goblin: 'mine', skeleton: 'theirs', necromancer: 'both' };
    const { db: after, rename, summary } = resolveDuplicates(imported, plan, (p) => pick[p.local.id], NOW);
    expect(summary).toEqual({ both: 1, mine: 1, theirs: 1 });
    const copy = (id) => plan.partials.find((p) => p.local.id === id).record.id;
    expect(rename).toEqual({ [copy('goblin')]: 'goblin', [copy('skeleton')]: 'skeleton' });
    // the copies of the goblin and the skeleton are gone, the necromancer's copy stays
    expect(after.assets.some((a) => a.id === copy('goblin') || a.id === copy('skeleton'))).toBe(false);
    expect(after.assets.some((a) => a.id === copy('necromancer'))).toBe(true);
    // mine: our goblin stays as it was; theirs: our skeleton gets the map's numbers, keeps its id and name
    expect(after.assets.find((a) => a.id === 'goblin').images).toEqual([pic('our-goblin')]);
    const skel = after.assets.find((a) => a.id === 'skeleton');
    expect(skel).toMatchObject({ builtIn: true, stats: { hp: 18 } });
    // everything that used the dropped copies uses ours now
    expect(after.assets.find((a) => a.id === copy('necromancer')).stats.minions).toEqual(['skeleton', 'skeletonWarrior']);
    expect(after.maps.find((m) => m.id === 'map-1').waves.rounds[0].groups.map((g) => g.enemy)).toEqual(['goblin', copy('necromancer')]);
  });
});
