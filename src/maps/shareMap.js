// Sharing one map (SPEC §13a): a normal save file holding just that map, its
// theme and the components it uses – decorations, terrain textures drawn in
// the studio, the enemies of its waves and the minions they call. A friend
// imports it like any save file (new things added, changes reviewed).

import { buildSaveFile } from '../data/saveFile.js';
import { DATA_VERSION } from '../data/migrate.js';
import { wavesOf } from '../config/waves.js';

export function mapPackage(map, db, balance, now = new Date()) {
  const byId = new Map((db.assets ?? []).map((a) => [a.id, a]));
  const ids = new Set();
  const add = (id) => {
    const a = byId.get(id);
    if (!a || ids.has(id)) return;
    ids.add(id);
    for (const m of a.stats?.minions ?? []) add(m); // minions of a summoner
  };
  for (const d of map.decorations ?? []) add(d.asset);
  for (const id of Object.values(map.textures ?? {})) add(id);
  for (const r of wavesOf(map, balance).rounds) for (const g of r.groups ?? []) add(g.enemy);

  const theme = (db.themes ?? []).find((th) => th.id === map.theme);
  return buildSaveFile({
    settings: { dataVersion: DATA_VERSION }, // current numbers: nothing to upgrade when it is read
    maps: [map],
    themes: theme ? [theme] : [],
    assets: (db.assets ?? []).filter((a) => ids.has(a.id)),
  }, now);
}

/** A file name from the map's name: "map-green-valley.json". */
export const mapFileName = (map) => `map-${(map.name || 'map').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'map'}.json`;
