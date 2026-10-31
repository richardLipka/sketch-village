import { describe, it, expect } from 'vitest';
import { componentWithNeeds, componentPackage, componentFileName, canShare } from './shareComponent.js';
import { isComponentFile, isMapFile, isPackageFile, withReferences, packageFileName } from '../data/packageFile.js';
import { planPackageImport, applyPackageImport, resolveDuplicates } from '../data/packageImport.js';
import { parseSaveFile } from '../data/saveFile.js';
import { migrateDb } from '../data/migrate.js';

// Downloading one component with everything it needs (SPEC §13a) and loading
// it into another game: the same things are used, partly different ones come
// as copies, the table merges them.

const pic = (c) => `data:image/png;base64,${c}`;
const asset = (id, category, stats = {}, extra = {}) => ({ id, category, name: id, images: [], stats, ...extra });
const db = {
  themes: [{ id: 'graveyard', icon: '🪦', name: 'Graveyard' }, { id: 'plains', icon: '🌾', name: 'Plains' }],
  assets: [
    asset('necro', 'enemy', { minions: ['skel', 'warrior'], projectile: 'bolt' }, { themes: ['graveyard'] }),
    asset('skel', 'enemy'), asset('warrior', 'enemy', { minions: ['skel'] }), asset('bolt', 'projectile'),
    asset('castle', 'building', { levels: [{ soldierKind: 'knight' }, { soldierKind: 'skel' }], projectile: 'bolt' }),
    asset('knight', 'soldier'),
    asset('castle2', 'building', { variantOf: 'castle' }, { images: [pic('c2')] }),
    asset('tower', 'building', { levels: [{}] }), asset('tower2', 'building', { variantOf: 'tower' }),
    asset('hero1', 'hero', { attack: 3 }), asset('ui-heart', 'icon', { icon: 'heart' }),
    asset('lonely', 'decoration', { note: 'ui-heart' }),
  ],
  maps: [],
};
const ids = (list) => list.map((a) => a.id);

describe('what a component needs', () => {
  it('a summoner: its minions and theirs, its projectile', () => {
    expect(ids(componentWithNeeds(db.assets[0], db.assets))).toEqual(['necro', 'skel', 'warrior', 'bolt']);
  });
  it('a castle: the soldiers of every level (drawn ones or monsters), its projectile and its other looks', () => {
    expect(ids(componentWithNeeds(db.assets.find((a) => a.id === 'castle'), db.assets))).toEqual(['castle', 'skel', 'bolt', 'knight', 'castle2']);
  });
  it('another look: the building it belongs to, not that building’s other looks', () => {
    expect(ids(componentWithNeeds(db.assets.find((a) => a.id === 'tower2'), db.assets))).toEqual(['tower2', 'tower']);
  });
  it('a hero alone; a GUI icon never travels (not even as a reference)', () => {
    expect(ids(componentWithNeeds(db.assets.find((a) => a.id === 'hero1'), db.assets))).toEqual(['hero1']);
    expect(ids(componentWithNeeds(db.assets.find((a) => a.id === 'lonely'), db.assets))).toEqual(['lonely']);
    expect(canShare(db.assets.find((a) => a.id === 'ui-heart'))).toBe(false);
    expect(componentWithNeeds(db.assets.find((a) => a.id === 'ui-heart'), db.assets)).toEqual([]);
    expect([...withReferences(['ui-heart'], db.assets)]).toEqual([]);
  });
  it('the built-in necromancer calls skeletons and skeleton warriors', () => {
    const built = migrateDb({ settings: {}, assets: [] }).db;
    expect(ids(componentWithNeeds(built.assets.find((a) => a.id === 'necromancer'), built.assets))).toEqual(['necromancer', 'skeleton', 'skeletonWarrior']);
  });
});

describe('the component file', () => {
  it('is a save file of kind "component" with its worlds and a title', () => {
    const f = componentPackage({ ...db.assets[0], author: 'Ema' }, db, 'cs', new Date('2026-11-01T00:00:00Z'));
    expect(f).toMatchObject({ format: 'sketch-village', kind: 'component', info: { title: 'necro', category: 'enemy', author: 'Ema' }, settings: { dataVersion: 4 }, maps: [] });
    expect(f.themes.map((t) => t.id)).toEqual(['graveyard']);
    expect(isComponentFile(f) && isPackageFile(f) && !isMapFile(f)).toBe(true);
    expect(isComponentFile(parseSaveFile(JSON.stringify(f)))).toBe(true); // survives reading
  });
  it('is named by its kind and name', () => {
    expect(componentFileName({ category: 'enemy', name: { cs: 'Král goblinů', en: 'Goblin king' } }, 'en')).toBe('enemy-goblin-king.json');
    expect(packageFileName('hero', 'Žluťoučký kůň')).toBe('hero-zlutoucky-kun.json');
    expect(packageFileName('hero', '')).toBe('hero-hero.json');
  });
});

describe('loading a component file', () => {
  const fresh = () => migrateDb({ settings: {}, assets: [] }).db;

  it('into a game that has the same things: nothing is added', () => {
    const game = fresh();
    const f = componentPackage(game.assets.find((a) => a.id === 'necromancer'), game, 'cs');
    const plan = planPackageImport(fresh(), f);
    expect(plan).toMatchObject({ source: 'component', additions: [], partials: [], exact: 3, maps: [] });
  });

  it('a redrawn skeleton: a copy named after the maker, the necromancer copied to call it; the table merges', () => {
    const theirs = fresh();
    theirs.assets = theirs.assets.map((a) => (a.id === 'skeleton' ? { ...a, images: [pic('bones')] } : a));
    const f = componentPackage({ ...theirs.assets.find((a) => a.id === 'necromancer'), author: 'Ema' }, theirs, 'cs');
    const mine = fresh();
    const plan = planPackageImport(mine, f);
    expect(plan.partials.map((p) => p.record.name.cs).sort()).toEqual(['Kostlivec (Ema)', 'Nekromant (Ema)']);
    const necroCopy = plan.partials.find((p) => p.local.id === 'necromancer').record;
    const skelCopy = plan.partials.find((p) => p.local.id === 'skeleton').record;
    expect(necroCopy.stats.minions).toEqual([skelCopy.id, 'skeletonWarrior']); // the warrior is the same: ours is used
    const applied = applyPackageImport(mine, plan).db;
    // "only mine" for both: nothing new stays, our necromancer is untouched
    const done = resolveDuplicates(applied, plan, () => 'mine').db;
    expect(done.assets.length).toBe(mine.assets.length);
    expect(done.assets.find((a) => a.id === 'skeleton').images).toEqual([]);
  });

  it('no maker’s name: the copy gets a number', () => {
    const theirs = fresh();
    theirs.assets = theirs.assets.map((a) => (a.id === 'arrow' ? { ...a, images: [pic('arrow')] } : a));
    const plan = planPackageImport(fresh(), componentPackage(theirs.assets.find((a) => a.id === 'arrow'), theirs, 'cs'));
    expect(plan.partials.map((p) => p.record.name)).toEqual([{ cs: 'Šíp (2)', en: 'Arrow (2)' }]);
  });
});
