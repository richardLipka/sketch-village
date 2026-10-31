// Downloading one map (SPEC §13a): a normal save file (`kind: 'map'`) holding
// that map, its theme and every component needed to play it as its maker sees
// it – the buildings of its world with all their looks, the heroes, weapons,
// shields, armor, coins, chests, soldiers, projectiles and caves, the monsters
// of its waves and whatever they call, its decorations and terrain textures.
// The game's own GUI icons stay out. A friend imports it like any save file;
// a map file is matched thing by thing (data/mapImport.js).

import { buildSaveFile } from '../data/saveFile.js';
import { DATA_VERSION } from '../data/migrate.js';
import { wavesOf } from '../config/waves.js';
import { fitsTheme } from '../config/themes.js';

export const MAP_FILE_KIND = 'map';

// kinds the game uses on every map (the first soldier / cave / chest drawing is everyone's look)
const ALWAYS = new Set(['hero', 'weapon', 'shield', 'armor', 'coin', 'chest', 'soldier', 'projectile', 'cave']);
const NEVER = new Set(['icon']);

/** The components a map needs, in the order they are stored. */
export function mapComponents(map, assets = [], balance) {
  const byId = new Map(assets.map((a) => [a.id, a]));
  const ids = new Set();
  const add = (id) => {
    const a = byId.get(id);
    if (!a || ids.has(id) || NEVER.has(a.category)) return;
    ids.add(id);
    // whatever it refers to: minions, the soldiers of a castle, projectiles, another look's type…
    const refs = (v) => {
      if (typeof v === 'string') { if (byId.has(v)) add(v); return; }
      if (Array.isArray(v)) v.forEach(refs);
      else if (v && typeof v === 'object') Object.values(v).forEach(refs);
    };
    refs(a.stats);
  };
  for (const a of assets) {
    if (ALWAYS.has(a.category)) add(a.id);
    // the buildings of the map's world (and the Town Hall) with every other look of them
    if (a.category === 'building' && !a.stats?.variantOf && (a.stats?.core || fitsTheme(a, map.theme))) add(a.id);
  }
  for (const a of assets) if (a.category === 'building' && ids.has(a.stats?.variantOf)) add(a.id);
  for (const d of map.decorations ?? []) add(d.asset);
  for (const id of Object.values(map.textures ?? {})) add(id);
  for (const r of wavesOf(map, balance).rounds) for (const g of r.groups ?? []) add(g.enemy);
  return assets.filter((a) => ids.has(a.id));
}

export function mapPackage(map, db, balance, now = new Date(), { thumbnail } = {}) {
  const theme = (db.themes ?? []).find((th) => th.id === map.theme);
  // the waves travel with the map: with the default plan the friend's game might send other monsters
  const shared = { ...map, waves: wavesOf(map, balance) };
  const file = buildSaveFile({
    settings: { dataVersion: DATA_VERSION }, // current numbers: nothing to upgrade when it is read
    maps: [shared],
    themes: theme ? [theme] : [],
    assets: mapComponents(map, db.assets, balance),
  }, now, {
    // what the public library lists (SPEC §13c)
    title: map.name || '',
    ...(map.description ? { description: map.description } : {}),
    ...(map.author ? { author: map.author } : {}),
    ...(thumbnail ? { thumbnail } : {}),
  });
  return { format: file.format, version: file.version, kind: MAP_FILE_KIND, ...file };
}

/** A file name from the map's name: "map-green-valley.json". */
export const mapFileName = (map) => `map-${(map.name || 'map').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'map'}.json`;
