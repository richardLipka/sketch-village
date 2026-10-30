// Moves data saved by older versions into components (config/components.js).
// Runs after loading the browser's data and after every import, and does
// nothing when there is nothing old left – so it is safe to run again and again.
//
//  v1 → v2: enemyTypes, buildingTypes, weapons collections and the Town Hall
//  levels / building unlock rounds in the rules become components; drawings of
//  the old house / tower / castle / townhall kinds become extra looks of those
//  building types; the built-in components are added once.
//  v2 → v3: built-in components are tracked by id (`settings.builtInsSeeded`), so
//  built-ins added in later versions (catapult, skeleton, necromancer, spider…)
//  arrive in existing browsers too – but one a kid deleted never comes back;
//  the default themes are added once; built-ins get their default themes;
//  built-in monsters get their default legends (once, when they have none).
//  Always: building levels get the numbers of features added later (e.g. the
//  soldiers' patrol distance) – a built-in its own default, otherwise the feature's.

import { DEFAULT_COMPONENTS, defaultComponent } from '../config/components.js';
import { DEFAULT_THEMES } from '../config/themes.js';
import { FEATURES } from '../config/features.js';
import { DEFAULT_BUILDING_TYPES } from '../config/buildings.js';
import { RULES_ID } from '../config/rules.js';
import { isWeapon, normalizeItem } from '../config/weapons.js';

export const DATA_VERSION = 4; // 4: buildings have 20 % less HP

// the built-ins of version 2, which seeded them all at once (`componentsSeeded`)
export const HP_SCALE_V4 = 0.8;

const V2_BUILT_INS = [
  'townhall', 'house', 'tower', 'castle', 'goblin', 'wolf', 'archer', 'orc', 'bat', 'troll', 'dragon',
  'stick', 'shortbow', 'sword', 'axe', 'longbow', 'crossbow', 'wand', 'firestaff', 'woodshield', 'ironshield', 'leather', 'chainmail',
  'coin1', 'coin5',
];

const OLD_BUILDING_KINDS = { townhall: 'townhall', house: 'house', tower: 'tower', castle: 'castle' };
const LEGACY_FEATURES = { house: ['workers'], tower: ['shoots'], castle: ['soldiers'] };

const newer = (a, b) => (a?.updatedAt ?? '') > (b?.updatedAt ?? '');

export function migrateDb(db) {
  let changed = false;
  const settings = { ...db.settings };
  const assets = [...(db.assets ?? [])];
  const byId = new Map(assets.map((a, i) => [a.id, i]));
  const upsert = (rec) => {
    const i = byId.get(rec.id);
    if (i === undefined) { byId.set(rec.id, assets.length); assets.push(rec); changed = true; return; }
    if (newer(rec, assets[i])) { assets[i] = { ...assets[i], ...rec, images: rec.images?.length ? rec.images : assets[i].images }; changed = true; }
  };
  const remove = (id) => {
    const i = byId.get(id);
    if (i === undefined) return;
    assets.splice(i, 1);
    byId.clear();
    assets.forEach((a, j) => byId.set(a.id, j));
    changed = true;
  };

  const rulesRec = db.rules?.find((r) => r.id === RULES_ID);
  const oldUnlocks = Object.fromEntries((rulesRec?.unlocks ?? []).map((u) => [u.key, u.round]));
  const soldierCount = rulesRec?.build?.soldier?.max;

  // 1) built-in components, each once (before old data, which then overrides them)
  const seeded = new Set(settings.builtInsSeeded ?? (settings.componentsSeeded ? V2_BUILT_INS : []));
  for (const c of DEFAULT_COMPONENTS) {
    if (seeded.has(c.id)) continue;
    if (!byId.has(c.id)) upsert(structuredClone(c));
    seeded.add(c.id);
    changed = true;
  }
  if (!settings.builtInsSeeded || settings.builtInsSeeded.length !== seeded.size) {
    settings.builtInsSeeded = [...seeded];
    changed = true;
  }
  delete settings.componentsSeeded;
  // built-ins from before themes / legends existed get their defaults
  for (const [i, a] of assets.entries()) {
    const def = defaultComponent(a.id);
    if (!a.builtIn || !def) continue;
    if (a.themes === undefined) { assets[i] = { ...assets[i], themes: [...(def.themes ?? [])] }; changed = true; }
    if (a.legend === undefined && def.legend) { assets[i] = { ...assets[i], legend: structuredClone(def.legend) }; changed = true; }
  }

  // 1a) numbers added to a feature later (soldierPatrol…) appear in every building level
  for (const [i, a] of assets.entries()) {
    if (a.category !== 'building' || !a.stats?.levels || a.stats.variantOf) continue;
    const def = defaultComponent(a.id)?.stats?.levels;
    let touched = false;
    const levels = a.stats.levels.map((l, n) => {
      const add = {};
      for (const f of a.stats.features ?? []) {
        for (const [k, v] of Object.entries(FEATURES[f]?.defaults ?? {})) if (l[k] === undefined) add[k] = def?.[n]?.[k] ?? v;
      }
      if (!Object.keys(add).length) return l;
      touched = true;
      return { ...l, ...add };
    });
    if (touched) { assets[i] = { ...a, stats: { ...a.stats, levels } }; changed = true; }
  }

  // 1c) data version 4: every building has 20 % less HP – the stored building
  //     types of an older browser are scaled once (new ones start with it)
  if (settings.dataVersion !== undefined && settings.dataVersion < 4) {
    for (const [i, a] of assets.entries()) {
      if (a.category !== 'building' || !a.stats?.levels || a.stats.variantOf) continue;
      const levels = a.stats.levels.map((l) => (typeof l.hp === 'number' ? { ...l, hp: Math.max(1, Math.round(l.hp * HP_SCALE_V4)) } : l));
      assets[i] = { ...a, stats: { ...a.stats, levels } };
      changed = true;
    }
  }

  // 1b) the default themes, once
  let themes = db.themes ?? [];
  if (!settings.themesSeeded) {
    const have = new Set(themes.map((th) => th.id));
    themes = [...themes, ...DEFAULT_THEMES.filter((th) => !have.has(th.id)).map((th) => structuredClone(th))];
    settings.themesSeeded = true;
    changed = true;
  }

  // 2) drawings of the old building kinds → extra looks of those building types
  for (const a of [...assets]) {
    const typeId = OLD_BUILDING_KINDS[a.category];
    if (!typeId) continue;
    const i = byId.get(a.id);
    assets[i] = { ...a, category: 'building', stats: { variantOf: typeId } };
    changed = true;
  }

  // 3) old building types (Rules editor) → building components
  const levelsWithRounds = (id, levels) => levels.map((l, n) => ({
    ...defaultComponent(id)?.stats.levels?.[n],
    ...l,
    round: oldUnlocks[`${id}:${n + 1}`] ?? l.round ?? defaultComponent(id)?.stats.levels?.[n]?.round ?? 1,
    ...(soldierCount && LEGACY_FEATURES[id]?.includes('soldiers') ? { soldierCount } : {}),
  }));
  for (const t of db.buildingTypes ?? []) {
    const base = defaultComponent(t.id);
    upsert({
      ...(base ?? { id: t.id, category: 'building', author: '', images: [], createdAt: t.updatedAt }),
      name: t.name ?? base?.name ?? t.id,
      stats: { features: t.features ?? LEGACY_FEATURES[t.id] ?? [], levels: levelsWithRounds(t.id, t.levels ?? []) },
      updatedAt: t.updatedAt ?? new Date(0).toISOString(),
    });
  }

  // 4) Town Hall levels from the old rules → the core building component
  if (rulesRec?.townHallLevels?.length) {
    const core = DEFAULT_BUILDING_TYPES.find((t) => t.core);
    const levels = rulesRec.townHallLevels.map((l, n) => ({
      ...core.levels[n] ?? core.levels.at(-1), ...l, cost: l.cost ?? 0, time: l.time ?? 0,
      round: oldUnlocks[`townhall:${n + 1}`] ?? core.levels[n]?.round ?? 1,
    }));
    if (!byId.has(core.id)) upsert(structuredClone(defaultComponent(core.id)));
    const i = byId.get(core.id);
    const cur = assets[i];
    // the old rules win over a Town Hall component nobody has edited yet
    if (cur.updatedAt === defaultComponent(core.id).updatedAt || newer(rulesRec, cur)) {
      assets[i] = { ...cur, stats: { ...cur.stats, levels }, updatedAt: rulesRec.updatedAt ?? cur.updatedAt };
      changed = true;
    }
  }

  // 5) old enemy list (enemy editor) → enemy components; a linked drawing is absorbed
  for (const e of db.enemyTypes ?? []) {
    const { id, name, asset, updatedAt, createdAt, ...stats } = e;
    const linked = asset && asset !== id ? assets[byId.get(asset)] : null;
    const base = assets[byId.get(id)] ?? defaultComponent(id);
    upsert({
      ...(base ?? { id, category: 'enemy', author: '', images: [], createdAt: createdAt ?? updatedAt }),
      name: name ?? base?.name ?? id,
      images: linked?.images ?? base?.images ?? [],
      author: linked?.author ?? base?.author ?? '',
      stats: { ...base?.stats, ...stats },
      updatedAt: updatedAt ?? new Date(0).toISOString(),
    });
    if (linked) {
      const i = byId.get(id);
      if (!assets[i].images?.length) assets[i] = { ...assets[i], images: linked.images };
      remove(linked.id);
    }
  }

  // 6) old built-in item list (weapons editor) → weapon / shield / armor components
  for (const raw of db.weapons ?? []) {
    const w = normalizeItem(raw);
    const linked = w.asset ? assets[byId.get(w.asset)] : null;
    const base = assets[byId.get(w.id)] ?? defaultComponent(w.id);
    const stats = isWeapon(w)
      ? { kind: w.kind, hands: w.slot === 'twohand' ? 2 : 1, damage: w.damage, range: w.range, cooldown: w.cooldown, splash: w.splash, price: w.price, shop: w.shop, round: w.round, drop: w.drop, starter: !!w.starter }
      : { armor: w.armor, price: w.price, shop: w.shop, round: w.round, drop: w.drop, starter: !!w.starter };
    upsert({
      ...(base ?? { id: w.id, author: '', createdAt: w.createdAt ?? w.updatedAt }),
      category: isWeapon(w) ? 'weapon' : w.slot,
      name: w.name ?? base?.name ?? w.id,
      images: linked?.images ?? base?.images ?? [],
      stats,
      updatedAt: w.updatedAt ?? new Date(0).toISOString(),
    });
  }

  // 7) the old collections and rule fields are now empty / gone
  const rules = (db.rules ?? []).map((r) => {
    if (r.id !== RULES_ID || (!r.townHallLevels && !(r.unlocks ?? []).some((u) => !u.key.startsWith('hero:')))) return r;
    changed = true;
    const { townHallLevels, ...rest } = r;
    return { ...rest, unlocks: (r.unlocks ?? []).filter((u) => u.key.startsWith('hero:')) };
  });
  if (db.enemyTypes?.length || db.buildingTypes?.length || db.weapons?.length) changed = true;
  if (settings.dataVersion !== DATA_VERSION) { settings.dataVersion = DATA_VERSION; changed = true; }

  return {
    changed,
    db: { ...db, settings, assets, rules, themes, enemyTypes: [], buildingTypes: [], weapons: [] },
  };
}
