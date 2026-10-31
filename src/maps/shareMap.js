// Downloading one map (SPEC §13a): a package file (`kind: 'map'`,
// data/packageFile.js) holding that map, its theme and every component needed
// to play it as its maker sees it – the buildings of its world with all their
// looks, the heroes, weapons, shields, armor, coins, chests, soldiers,
// projectiles and caves, the monsters of its waves and whatever they call, its
// decorations and terrain textures. The game's own GUI icons stay out. A
// friend imports it thing by thing (data/packageImport.js).

import { buildPackage, withReferences, themesFor, packageFileName } from '../data/packageFile.js';
import { wavesOf } from '../config/waves.js';
import { fitsTheme } from '../config/themes.js';

export const MAP_FILE_KIND = 'map';

// kinds the game uses on every map (the first soldier / cave / chest drawing is everyone's look)
const ALWAYS = new Set(['hero', 'weapon', 'shield', 'armor', 'coin', 'chest', 'soldier', 'projectile', 'cave']);

/** The components a map needs, in the order they are stored. */
export function mapComponents(map, assets = [], balance) {
  const start = [];
  for (const a of assets) {
    if (ALWAYS.has(a.category)) start.push(a.id);
    // the buildings of the map's world (and the Town Hall)
    if (a.category === 'building' && !a.stats?.variantOf && (a.stats?.core || fitsTheme(a, map.theme))) start.push(a.id);
  }
  for (const d of map.decorations ?? []) start.push(d.asset);
  for (const id of Object.values(map.textures ?? {})) start.push(id);
  for (const r of wavesOf(map, balance).rounds) for (const g of r.groups ?? []) start.push(g.enemy);
  const ids = withReferences(start, assets);
  // every other look of those buildings (and what such a look refers to)
  const looks = assets.filter((a) => a.category === 'building' && ids.has(a.stats?.variantOf)).map((a) => a.id);
  const all = withReferences([...ids, ...looks], assets);
  return assets.filter((a) => all.has(a.id));
}

export function mapPackage(map, db, balance, now = new Date(), { thumbnail } = {}) {
  const assets = mapComponents(map, db.assets, balance);
  // the waves travel with the map: with the default plan the friend's game might send other monsters
  return buildPackage(MAP_FILE_KIND, {
    maps: [{ ...map, waves: wavesOf(map, balance) }],
    themes: themesFor(assets, db.themes, map.theme ? [map.theme] : []),
    assets,
  }, {
    // what the public library lists (SPEC §13c)
    title: map.name || '',
    ...(map.description ? { description: map.description } : {}),
    ...(map.author ? { author: map.author } : {}),
    ...(thumbnail ? { thumbnail } : {}),
  }, now);
}

/** A file name from the map's name: "map-green-valley.json". */
export const mapFileName = (map) => packageFileName('map', map.name);
