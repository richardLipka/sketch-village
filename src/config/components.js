// Components (SPEC §3.4): every game thing the kids make – heroes, enemies,
// buildings, weapons, shields, armor, coins, decorations… – is ONE record in the
// `assets` collection with its pictures AND all its properties (`stats`), edited
// together in the component editor (the studio). The engine never reads the
// pictures; the functions below turn components into the plain lists it uses.
//
//   building: stats = { features, levels, core? }  or  { variantOf: typeId }
//             (another look of an existing building type, chosen at random)
//   enemy:    stats = { hp, speed, damage, cooldown, range, armor, coins, flying, ranged, boss,
//             size, color, minions, minionCount, minionEvery, minionMax, minionOnDeath }
//   weapon / shield / armor: stats = item numbers (config/weapons.js)
//   coin:     stats = { value }
//   hero:     stats = skill points
//   texture:  a photo / drawing of a surface (grass, stones…) for the map terrain
//
// Every component may also have `themes` (config/themes.js): the worlds it
// belongs to; none = every world.
//
// Built-in components (`builtIn: true`) are added on the first start; kids can
// change them like their own and restore their default numbers.

import { DEFAULT_BUILDING_TYPES } from './buildings.js';
import { DEFAULT_ENEMY_TYPES } from './enemies.js';
import { DEFAULT_WEAPONS, isWeapon, defaultItemStats } from './weapons.js';

const STAMP = '2026-10-29T00:00:00.000Z'; // older than any edit, so edits always win a merge

const component = (category, id, name, stats, themes = []) => ({
  id, category, name, author: '', images: [], stats, themes, builtIn: true, createdAt: STAMP, updatedAt: STAMP,
});

const itemStats = (w) => (isWeapon(w)
  ? { kind: w.kind, hands: w.slot === 'twohand' ? 2 : 1, damage: w.damage, range: w.range, cooldown: w.cooldown, splash: w.splash, price: w.price, shop: w.shop, round: w.round, drop: w.drop, starter: !!w.starter }
  : { armor: w.armor, price: w.price, shop: w.shop, round: w.round, drop: w.drop, starter: !!w.starter });

export const DEFAULT_COMPONENTS = [
  ...DEFAULT_BUILDING_TYPES.map(({ id, name, themes, ...stats }) => component('building', id, name, stats, themes)),
  ...DEFAULT_ENEMY_TYPES.map(({ id, name, themes, ...stats }) => component('enemy', id, name, stats, themes)),
  ...DEFAULT_WEAPONS.map((w) => component(isWeapon(w) ? 'weapon' : w.slot, w.id, w.name, itemStats(w))),
  component('coin', 'coin1', { cs: 'Měďák', en: 'Copper coin' }, { value: 1 }),
  component('coin', 'coin5', { cs: 'Zlaťák', en: 'Gold coin' }, { value: 5 }),
];

export const defaultComponent = (id) => DEFAULT_COMPONENTS.find((c) => c.id === id) ?? null;

/** Name in the current language (built-ins have { cs, en }, kids' components a string). */
export function compName(c, lang = 'cs') {
  if (!c) return '';
  return typeof c.name === 'string' ? c.name : c.name?.[lang] ?? c.name?.cs ?? c.id;
}

/** Same name for both languages unless it is already a { cs, en } pair. */
export const bothLangs = (name) => (typeof name === 'string' ? { cs: name, en: name } : name);

const pictures = (c) => (c.images ?? []).filter(Boolean);

// ---------------- what the engine uses ----------------

/** Building types for the World + their looks (one image list per look) for drawing. */
export function buildingsOf(assets = []) {
  const all = assets.filter((a) => a.category === 'building');
  const types = all.filter((a) => !a.stats?.variantOf && a.stats?.levels?.length).map((a) => ({
    id: a.id, name: bothLangs(a.name), core: !!a.stats.core, features: a.stats.features ?? [], levels: a.stats.levels, themes: a.themes ?? [],
  }));
  const looks = {};
  for (const t of types) {
    const own = all.find((a) => a.id === t.id);
    looks[t.id] = [own, ...all.filter((a) => a.stats?.variantOf === t.id)].filter((a) => pictures(a).length).map((a) => a.images);
  }
  return { types, looks };
}

export function enemyTypesOf(assets = []) {
  return assets.filter((a) => a.category === 'enemy').map((a) => ({
    ...DEFAULT_ENEMY_STATS, ...a.stats, id: a.id, name: bothLangs(a.name), image: pictures(a)[0] ?? null, themes: a.themes ?? [],
  }));
}

export const DEFAULT_ENEMY_STATS = {
  hp: 25, speed: 45, damage: 4, cooldown: 1, range: 25, armor: 0, coins: [1, 2], flying: false, ranged: false, boss: false, size: 1, color: '#16a34a',
  minions: [], minionCount: 2, minionEvery: 8, minionMax: 6, minionOnDeath: 0,
};

/** Weapons, shields and armor as items. */
export function itemsOf(assets = []) {
  return assets.filter((a) => ['weapon', 'shield', 'armor'].includes(a.category)).map((a) => {
    const s = { ...defaultItemStats(a.category), ...a.stats };
    const base = { id: a.id, name: bothLangs(a.name), image: pictures(a)[0] ?? null, price: s.price, shop: s.shop, round: s.round, drop: s.drop, starter: !!s.starter, damage: 0, range: 0, cooldown: 0, splash: 0, armor: 0 };
    if (a.category !== 'weapon') return { ...base, slot: a.category, armor: s.armor };
    return { ...base, slot: s.hands === 2 ? 'twohand' : 'hand', kind: s.kind, damage: s.damage, range: s.range, cooldown: s.cooldown, splash: s.splash };
  });
}

/** Coin types { value, key, src? }: every coin component; circles until drawn. */
export function coinTypesOf(assets = []) {
  const coins = assets.filter((a) => a.category === 'coin').map((a) => {
    const value = Math.max(1, a.stats?.value ?? 1);
    const src = pictures(a)[0];
    return { value, key: src ? `coin:${a.id}` : value >= 5 ? 'coin5' : 'coin', src };
  });
  return coins.length ? coins : [{ value: 1, key: 'coin' }, { value: 5, key: 'coin5' }];
}
