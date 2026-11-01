import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { parseSaveFile } from './saveFile.js';
import { defaultAssets, resetPlan, defaultChoice, applyReset, sameComponent } from './resetDefaults.js';
import { DEFAULT_COMPONENTS } from '../config/components.js';

// Back to the game's own components (SPEC §13d): built-ins + the class pack in the repository.

const pack = parseSaveFile(readFileSync(new URL('../../public/default-data.json', import.meta.url), 'utf8'));
const defaults = defaultAssets(pack);

describe('back to the game’s own components', () => {
  it('the defaults are the built-ins and the class pack; a fresh start has nothing to do', () => {
    for (const c of DEFAULT_COMPONENTS) expect(defaults.some((d) => d.id === c.id)).toBe(true);
    for (const a of pack.assets) expect(defaults.some((d) => d.id === a.id)).toBe(true);
    expect(resetPlan(structuredClone(defaults), defaults)).toEqual({ remove: [], restore: [], add: [] });
    expect(defaultAssets(null).length).toBe(DEFAULT_COMPONENTS.length);
  });

  it('finds what was added, changed and deleted; the time of a change doesn’t count', () => {
    const goblin = defaults.find((d) => d.id === 'goblin');
    const mine = { id: 'mine', category: 'decoration', name: 'Strom', images: ['data:x'], stats: {} };
    const pet = { id: 'pet', category: 'enemy', name: 'Pet', images: [], stats: { hp: 5 } };
    const assets = [
      ...defaults.filter((d) => d.id !== 'troll').map((d) => (d.id === goblin.id ? { ...d, stats: { ...d.stats, hp: 999 }, updatedAt: '2030-01-01' } : { ...d, updatedAt: '2031-01-01' })),
      mine, pet,
    ];
    const maps = [{ id: 'm', name: 'Les', decorations: [{ asset: 'mine', x: 1, y: 1 }] }];
    const plan = resetPlan(assets, defaults, maps);
    expect(plan.remove.map((r) => r.asset.id)).toEqual(['mine', 'pet']);
    expect(plan.remove[0].uses.maps).toEqual(['Les']); // a map uses it: not ticked at first
    expect(plan.restore.map((r) => r.asset.id)).toEqual(['goblin']);
    expect(plan.add.map((d) => d.id)).toEqual(['troll']);
    const chosen = defaultChoice(plan);
    expect([...chosen].sort()).toEqual(['goblin', 'pet', 'troll']);

    const after = applyReset(assets, plan, chosen, '2032-01-01');
    expect(after.some((a) => a.id === 'pet')).toBe(false);
    expect(after.some((a) => a.id === 'mine')).toBe(true); // kept: not ticked
    expect(after.find((a) => a.id === 'goblin').stats.hp).toBe(goblin.stats.hp);
    expect(after.find((a) => a.id === 'goblin').updatedAt).toBe('2032-01-01');
    expect(after.some((a) => a.id === 'troll')).toBe(true);
    expect(resetPlan(after, defaults, maps).remove.map((r) => r.asset.id)).toEqual(['mine']);
    expect(resetPlan(after, defaults, maps).restore).toEqual([]);
  });

  it('a component another one uses is kept at first, unless that one goes too', () => {
    const shot = { id: 'shot', category: 'projectile', name: 'S', images: [], stats: {} };
    const tower = { id: 'myTower', category: 'building', name: 'T', images: [], stats: { projectile: 'shot' } };
    const plan = resetPlan([...defaults, shot, tower], defaults);
    expect(plan.remove.find((r) => r.asset.id === 'shot').uses.components).toEqual(['myTower']);
    expect(defaultChoice(plan).has('shot')).toBe(true); // the tower goes too
    expect(sameComponent({ a: 1, b: [1, { c: 2 }] }, { b: [1, { c: 2 }], a: 1, updatedAt: 'x' })).toBe(true);
  });
});
