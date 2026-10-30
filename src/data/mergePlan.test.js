import { describe, it, expect } from 'vitest';
import { planImport, applyImport, diffRecords, stable } from './mergePlan.js';
import { buildSaveFile, parseSaveFile } from './saveFile.js';
import { migrateDb } from './migrate.js';

const pic = (n) => `data:image/png;base64,${n}`;
const T1 = '2026-10-30T10:00:00.000Z', T2 = '2026-10-31T10:00:00.000Z';

// a browser with everything a kid can make: drawings with animations and a
// legend, a themed map with textures and waves, own theme, edited rules, settings
function richDb() {
  const base = migrateDb({ settings: {}, assets: [] }).db;
  const knight = { id: 'k-1', category: 'hero', name: 'Knight Kuba', author: 'Kuba', images: [pic('hero')], stats: { melee: 3, ranged: 3, armor: 2, speed: 2 }, anims: { walk: { frames: [pic('w1'), pic('w2'), pic('w3'), pic('w4')], fps: 8, offsets: [[0, 0], [1, 0], [0, 0], [0, 1]] } }, createdAt: T1, updatedAt: T1 };
  const slime = { id: 'e-1', category: 'enemy', name: 'Slime', images: [pic('slime')], themes: ['th-1'], legend: { story: 'Sticky.', hint: 'Use fire.' }, stats: { hp: 40, speed: 30, minions: ['goblin'], summons: true }, createdAt: T1, updatedAt: T1 };
  const tree = { id: 'd-1', category: 'decoration', name: 'Oak', images: [pic('oak')], createdAt: T1, updatedAt: T1 };
  const theme = { id: 'th-1', icon: '🍄', name: 'Mushroom land', createdAt: T1, updatedAt: T1 };
  const map = { id: 'm-1', name: 'Swamp', background: pic('bg'), theme: 'th-1', textures: { '#8cc66a': 'meadow' }, decorations: [{ id: 'x', asset: 'd-1', x: 5, y: 5, scale: 1 }], spots: [{ id: 's', x: 1, y: 2 }], caves: [], waves: { rounds: [{ groups: [{ enemy: 'e-1', count: 3 }] }] }, createdAt: T1, updatedAt: T1 };
  return {
    ...base,
    assets: [...base.assets, knight, slime, tree],
    themes: [...base.themes, theme],
    maps: [map],
    rules: [{ id: 'rules', balance: { startCoins: 99 }, updatedAt: T1 }],
    settings: { ...base.settings, wobble: true, muted: true, tutorialStep: 4 },
  };
}
const exported = (db, language = 'en') => parseSaveFile(JSON.stringify(buildSaveFile({ ...db, settings: { ...db.settings, language } })));

describe('export → import', () => {
  it('everything comes back in an empty browser: drawings, animations, legends, maps, themes, rules, settings', () => {
    const db = richDb();
    const empty = migrateDb({ settings: {}, assets: [] }).db;
    const plan = planImport(empty, exported(db), { language: 'cs' });
    const { db: out, language } = applyImport(empty, plan, () => true);
    for (const id of ['k-1', 'e-1', 'd-1']) expect(stable(out.assets.find((a) => a.id === id))).toBe(stable(db.assets.find((a) => a.id === id)));
    expect(stable(out.maps)).toBe(stable(db.maps));
    expect(out.themes.find((t) => t.id === 'th-1').name).toBe('Mushroom land');
    expect(out.rules[0].balance.startCoins).toBe(99);
    expect(out.settings).toMatchObject({ wobble: true, muted: true, tutorialStep: 4 });
    expect(language).toBe('en');
  });

  it('the same data again: nothing to add or ask', () => {
    const db = richDb();
    const plan = planImport(db, exported(db, 'cs'), { language: 'cs' });
    expect(plan.additions).toHaveLength(0);
    expect(plan.changes).toHaveLength(0);
    expect(plan.unchanged).toBeGreaterThan(30);
  });
});

describe('merging by name, with a review of changes', () => {
  it('finds elements by name, lists what changed, and points references at the local copies', () => {
    const mine = richDb();
    // the same things made on another computer: other ids, a changed slime, a new bat drawing
    const other = richDb();
    other.assets = other.assets.map((a) => (a.id === 'e-1' ? { ...a, id: 'e-9', stats: { ...a.stats, hp: 55 }, images: [pic('slime2')], updatedAt: T2 } : a.id === 'd-1' ? { ...a, id: 'd-9' } : a));
    other.assets.push({ id: 'n-1', category: 'enemy', name: 'Ghost', images: [pic('ghost')], stats: { hp: 20 }, createdAt: T2, updatedAt: T2 });
    other.maps = other.maps.map((m) => ({ ...m, id: 'm-9', decorations: [{ id: 'x', asset: 'd-9', x: 5, y: 5, scale: 1 }], waves: { rounds: [{ groups: [{ enemy: 'e-9', count: 3 }] }] } }));
    const plan = planImport(mine, exported(other), { language: 'en' });

    expect(plan.additions.map((a) => a.record.name)).toEqual(['Ghost']); // only the really new one
    const slime = plan.changes.find((c) => c.id === 'e-1');
    expect(slime).toBeTruthy(); // found by name although the id differs
    expect(slime.diff).toEqual(expect.arrayContaining([
      { path: 'stats.hp', from: 40, to: 55 },
      { path: 'images', from: [pic('slime')], to: [pic('slime2')] },
    ]));
    // the map matched by name has no real change: its decoration / wave references point at our oak and slime
    expect(plan.changes.find((c) => c.collection === 'maps')).toBeUndefined();
    expect(plan.changes.some((c) => c.id === 'd-1')).toBe(false); // same oak
  });

  it('accept or keep each change; accept all / keep all', () => {
    const mine = richDb();
    const other = richDb();
    other.assets = other.assets.map((a) => (a.id === 'e-1' ? { ...a, stats: { ...a.stats, hp: 77 } } : a.id === 'k-1' ? { ...a, author: 'Ema' } : a));
    const plan = planImport(mine, exported(other, 'cs'), { language: 'cs' });
    expect(plan.changes.map((c) => c.id).sort()).toEqual(['e-1', 'k-1']);

    const some = applyImport(mine, plan, (c) => c.id === 'e-1');
    expect(some.db.assets.find((a) => a.id === 'e-1').stats.hp).toBe(77);
    expect(some.db.assets.find((a) => a.id === 'k-1').author).toBe('Kuba');
    expect(some.summary).toMatchObject({ updated: 1, kept: 1 });

    expect(applyImport(mine, plan, () => true).db.assets.find((a) => a.id === 'k-1').author).toBe('Ema');
    const none = applyImport(mine, plan, () => false);
    expect(none.db.assets.find((a) => a.id === 'e-1').stats.hp).toBe(40);
    expect(none.summary).toMatchObject({ updated: 0, kept: 2 });
  });

  it('settings and the language are a change to review too', () => {
    const mine = richDb();
    const other = { ...richDb(), settings: { ...richDb().settings, wobble: false } };
    const plan = planImport(mine, exported(other, 'en'), { language: 'cs' });
    const s = plan.changes.find((c) => c.collection === 'settings');
    expect(s.diff).toEqual(expect.arrayContaining([{ path: 'wobble', from: true, to: false }, { path: 'language', from: 'cs', to: 'en' }]));
    const { db, language } = applyImport(mine, plan, () => true);
    expect(db.settings.wobble).toBe(false);
    expect(language).toBe('en');
  });

  it('an old version-1 file still imports (its enemy list becomes components)', () => {
    const mine = migrateDb({ settings: {}, assets: [] }).db;
    const v1 = parseSaveFile({ format: 'sketch-village', version: 1, settings: {}, assets: [], maps: [], enemyTypes: [{ id: 'goblin', name: { cs: 'Skřet', en: 'Goblin' }, hp: 99, updatedAt: T2 }] });
    const plan = planImport(mine, v1);
    const gob = plan.changes.find((c) => c.id === 'goblin');
    expect(gob.diff).toEqual(expect.arrayContaining([{ path: 'stats.hp', from: 25, to: 99 }]));
    expect(plan.additions).toHaveLength(0); // no built-ins smuggled in
  });

  it('diffs go down to single numbers', () => {
    expect(diffRecords({ id: 1, stats: { levels: [{ cost: 1 }, { cost: 2 }] } }, { id: 2, stats: { levels: [{ cost: 1 }, { cost: 3 }] } }))
      .toEqual([{ path: 'stats.levels[1].cost', from: 2, to: 3 }]);
  });
});
