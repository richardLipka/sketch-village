// Back to the game's own components (SPEC §13d): what a fresh computer starts
// with – the built-in components plus the class pack shipped with the website
// (public/default-data.json, the one in the repository) – compared with what
// this browser has. Pure, unit-tested; the Data screen lists the plan with a
// tick per line and asks before anything is deleted.
//
//   remove   components that aren't the game's own (drawn here, loaded from a
//            file…) – each with the maps and components that use it
//   restore  the game's own components that were changed
//   add      the game's own components that are missing

import { COLLECTIONS, mergeSaveFile } from './saveFile.js';
import { migrateDb } from './migrate.js';
import { isPermanent, DEFAULT_ENEMY_STATS } from '../config/components.js';

const emptyDb = () => Object.fromEntries([['settings', {}], ...COLLECTIONS.map((c) => [c, []])]);

/** The components a fresh start has (built-ins + the class pack `pack`, or the built-ins alone). */
export function defaultAssets(pack) {
  const db = pack ? mergeSaveFile(emptyDb(), pack).db : emptyDb();
  return migrateDb(db).db.assets;
}

// what a component is, without when it was made or changed (keys sorted: the order doesn't matter)
const canon = (v) => {
  if (Array.isArray(v)) return `[${v.map(canon).join(',')}]`;
  if (v && typeof v === 'object') {
    return `{${Object.keys(v).filter((k) => k !== 'createdAt' && k !== 'updatedAt' && v[k] !== undefined).sort().map((k) => `${JSON.stringify(k)}:${canon(v[k])}`).join(',')}}`;
  }
  return JSON.stringify(v ?? null);
};
// numbers left at their defaults count as the defaults; empty picture slots as none
const norm = (a) => {
  const images = [...(a.images ?? [])];
  while (images.length && !images.at(-1)) images.pop();
  const stats = a.category === 'enemy' ? { ...DEFAULT_ENEMY_STATS, ...a.stats } : a.stats;
  return { ...a, images, stats: stats && Object.fromEntries(Object.entries(stats).filter(([, v]) => v !== false)) };
};
export const sameComponent = (a, b) => canon(norm(a)) === canon(norm(b));

/** Where component `id` is used: map names (decorations, textures) and component ids (minions, projectiles, soldiers…). */
export function usesOf(id, assets, maps = []) {
  const maps_ = maps.filter((m) => [...(m.decorations ?? []), ...(m.caves ?? [])].some((d) => d.asset === id) || Object.values(m.textures ?? {}).includes(id)).map((m) => m.name || m.id);
  const quoted = JSON.stringify(id);
  const parts = assets.filter((a) => a.id !== id && JSON.stringify(a.stats ?? {}).includes(quoted)).map((a) => a.id);
  return { maps: maps_, components: parts };
}

/** What going back to `defaults` would do to `assets`. */
export function resetPlan(assets = [], defaults = [], maps = []) {
  const def = new Map(defaults.map((d) => [d.id, d]));
  const have = new Set(assets.map((a) => a.id));
  const remove = assets.filter((a) => !def.has(a.id) && !isPermanent(a)).map((a) => ({ asset: a, uses: usesOf(a.id, assets, maps) }));
  const restore = assets.filter((a) => def.has(a.id) && !sameComponent(a, def.get(a.id))).map((a) => ({ asset: a, def: def.get(a.id) }));
  const add = defaults.filter((d) => !have.has(d.id));
  return { remove, restore, add };
}

/** The ids ticked at first: everything, except components a map or another kept component uses. */
export function defaultChoice(plan) {
  return new Set([
    ...plan.remove.filter((r) => !r.uses.maps.length && !r.uses.components.some((id) => !plan.remove.some((x) => x.asset.id === id))).map((r) => r.asset.id),
    ...plan.restore.map((r) => r.asset.id),
    ...plan.add.map((d) => d.id),
  ]);
}

/** `assets` with the ticked (`chosen` ids) lines of `plan` done. */
export function applyReset(assets, plan, chosen, now = new Date().toISOString()) {
  const drop = new Set(plan.remove.filter((r) => chosen.has(r.asset.id)).map((r) => r.asset.id));
  const back = new Map(plan.restore.filter((r) => chosen.has(r.asset.id)).map((r) => [r.asset.id, r.def]));
  // a restored component is newer than the changed one (a later merge keeps it)
  const fresh = (d) => ({ ...structuredClone(d), updatedAt: now });
  return [
    ...assets.filter((a) => !drop.has(a.id)).map((a) => (back.has(a.id) ? fresh(back.get(a.id)) : a)),
    ...plan.add.filter((d) => chosen.has(d.id)).map(fresh),
  ];
}
