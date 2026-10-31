import { describe, it, expect } from 'vitest';
import { migrateDb } from './migrate.js';
import { planImport, applyImport } from './mergePlan.js';
import { planMapImport, applyMapImport, resolveDuplicates } from './mapImport.js';
import { DEFAULT_COMPONENTS, PERMANENT_IDS, GAME_LOOKS, SURFACE_NAMES, isPermanent, keepPermanent, projectilesOf } from '../config/components.js';
import { BUILT_IN_IDS } from '../maps/textures.js';
import { mapPackage } from '../maps/shareMap.js';
import { rulesOf } from '../config/rules.js';
import cs from '../locales/cs.json';
import en from '../locales/en.json';

// The game's own pictures – the default arrow, magic bolt and catapult stone,
// the built-in surfaces – are built-in components in the studio: their picture
// can be replaced, but they are never deleted.

const pic = 'data:image/png;base64,mine';
const fresh = () => migrateDb({ settings: {}, assets: [] }).db;
const ids = (db) => db.assets.map((a) => a.id);

describe('the game’s own pictures are built-in components', () => {
  it('the three default projectiles and every built-in surface', () => {
    expect(Object.keys(GAME_LOOKS)).toEqual(['arrow', 'magicBolt', 'catapultStone']);
    expect(Object.keys(SURFACE_NAMES)).toEqual(BUILT_IN_IDS); // the ids maps already use
    for (const id of PERMANENT_IDS) {
      const c = DEFAULT_COMPONENTS.find((x) => x.id === id);
      expect(c.builtIn).toBe(true);
      expect(c.category).toBe(GAME_LOOKS[id] ? 'projectile' : 'texture');
      expect(c.images).toEqual([]); // the game draws them until a kid gives one a picture
    }
    // the surfaces are called as in the map editor
    for (const id of BUILT_IN_IDS) expect(SURFACE_NAMES[id]).toEqual({ cs: cs.maps[`tex_${id}`], en: en.maps[`tex_${id}`] });
  });

  it('not the simple shapes that stand in for undrawn things', () => {
    expect(isPermanent('goblin')).toBe(false);
    expect(isPermanent('townhall')).toBe(false);
    expect(isPermanent({ id: 'grass' })).toBe(true);
  });

  it('a fresh game has them; shooters can pick them', () => {
    const db = fresh();
    for (const id of PERMANENT_IDS) expect(ids(db)).toContain(id);
    expect(projectilesOf(db.assets, 'en').map((p) => p.name)).toEqual(['Arrow', 'Magic bolt', 'Catapult stone']);
  });
});

describe('they are never deleted', () => {
  it('a screen sending the list without them gets them back – with the picture they had', () => {
    const before = fresh().assets.map((a) => (a.id === 'arrow' ? { ...a, images: [pic] } : a));
    const sent = before.filter((a) => !isPermanent(a));
    const kept = keepPermanent(sent, before);
    expect(ids({ assets: kept })).toEqual(expect.arrayContaining([...PERMANENT_IDS]));
    expect(kept.find((a) => a.id === 'arrow').images).toEqual([pic]);
    expect(keepPermanent(before, before)).toBe(before); // nothing missing: the same list
  });

  it('a stored game or a file without them: the migration puts them back, built-in', () => {
    const db = fresh();
    const gone = { ...db, assets: db.assets.filter((a) => !isPermanent(a)) }; // all already "seeded"
    const { db: back, changed } = migrateDb(gone);
    expect(changed).toBe(true);
    for (const id of PERMANENT_IDS) expect(back.assets.find((a) => a.id === id)?.builtIn).toBe(true);
    // a deleted ordinary built-in stays deleted (the kids may remove a monster)
    expect(ids(migrateDb({ ...db, assets: db.assets.filter((a) => a.id !== 'goblin') }).db)).not.toContain('goblin');
  });

  it('a changed picture survives the migration; a broken record is mended', () => {
    const db = fresh();
    const mine = db.assets.map((a) => (a.id === 'water' ? { ...a, images: [pic] } : a.id === 'sand' ? { ...a, builtIn: false, category: 'decoration' } : a));
    const { db: after } = migrateDb({ ...db, assets: mine });
    expect(after.assets.find((a) => a.id === 'water').images).toEqual([pic]);
    expect(after.assets.find((a) => a.id === 'sand')).toMatchObject({ builtIn: true, category: 'texture' });
  });

  it('importing a file without them (or replacing everything with it) keeps them', () => {
    const db = fresh();
    const file = { format: 'sketch-village', version: 3, settings: {}, assets: [{ id: 'k1', category: 'decoration', name: 'Keř', images: [pic] }], maps: [], themes: [] };
    const plan = planImport(db, file);
    const merged = applyImport(db, plan, () => true).db;
    for (const id of PERMANENT_IDS) expect(ids(merged)).toContain(id);
    // "load a file instead of everything" ends in the migration too (App.replaceDb)
    const replaced = migrateDb({ ...file, settings: { builtInsSeeded: DEFAULT_COMPONENTS.map((c) => c.id) } }).db;
    for (const id of PERMANENT_IDS) expect(ids(replaced)).toContain(id);
  });

  it('a map file with someone else’s grass: whatever the kid picks, our grass stays', () => {
    const theirs = fresh();
    theirs.assets = theirs.assets.map((a) => (a.id === 'grass' ? { ...a, images: ['data:image/png;base64,theirs'] } : a));
    const map = { id: 'm1', name: 'Louka', world: { width: 1280, height: 720 }, palette: { grass: '#7cb342', path: '#fdd835' }, decorations: [], spots: [], caves: [], textures: { '#7cb342': 'grass' } };
    const file = mapPackage(map, theirs, rulesOf({ rules: [] }).balance);
    expect(file.assets.map((a) => a.id)).toContain('grass'); // the map's surface travels with it

    for (const choice of ['both', 'mine', 'theirs']) {
      const db = fresh();
      const plan = planMapImport(db, file);
      const grass = plan.partials.find((p) => p.local.id === 'grass');
      expect(grass.record.name.cs).toBe('Tráva (Louka)'); // a copy named after the map
      const applied = applyMapImport(db, plan).db;
      const done = resolveDuplicates(applied, plan, () => choice).db;
      const ours = done.assets.find((a) => a.id === 'grass');
      expect(ours?.builtIn).toBe(true);
      expect(ours.images).toEqual(choice === 'theirs' ? ['data:image/png;base64,theirs'] : []);
    }
  });
});
