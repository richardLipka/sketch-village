// Package files (SPEC §13a): one map or one component downloaded with
// everything it needs, in the normal save-file format plus `kind`. Pure,
// unit-tested; the map's and the component's own rules are in
// maps/shareMap.js and assets/shareComponent.js, importing one is
// data/packageImport.js.
//
//   { format, version, kind: 'map' | 'component', exportedAt, info, settings, assets, maps, themes, … }

import { buildSaveFile } from './saveFile.js';
import { DATA_VERSION } from './migrate.js';

// the game's own GUI icons never travel with a map or a component
const NEVER = new Set(['icon']);

/** A file holding one downloaded map (Maps → ⬇, the public library – older ones have just `info` and one map). */
export const isMapFile = (file) => file?.kind === 'map' || (!file?.kind && !!file?.info && file?.maps?.length === 1);
/** A file holding one downloaded component (studio → ⬇) and what it needs. */
export const isComponentFile = (file) => file?.kind === 'component';
/** Either: imported thing by thing (data/packageImport.js). */
export const isPackageFile = (file) => isMapFile(file) || isComponentFile(file);

/**
 * The ids of `start` and of everything they refer to, again and again: the
 * minions a monster calls, the soldiers a castle sends, projectiles, the type
 * another look belongs to… (any id string inside `stats`). GUI icons never.
 */
export function withReferences(start, assets = []) {
  const byId = new Map(assets.map((a) => [a.id, a]));
  const ids = new Set();
  const add = (id) => {
    const a = byId.get(id);
    if (!a || ids.has(id) || NEVER.has(a.category)) return;
    ids.add(id);
    const refs = (v) => {
      if (typeof v === 'string') { if (byId.has(v)) add(v); return; }
      if (Array.isArray(v)) v.forEach(refs);
      else if (v && typeof v === 'object') Object.values(v).forEach(refs);
    };
    refs(a.stats);
  };
  for (const id of start) add(id);
  return ids;
}

/** The themes (worlds) the components belong to, plus `extra` theme ids – the importer matches them by id or name. */
export function themesFor(assets, themes = [], extra = []) {
  const ids = new Set([...extra, ...assets.flatMap((a) => a.themes ?? [])]);
  return themes.filter((th) => ids.has(th.id));
}

/** The file: a save file with the current numbers (nothing to upgrade when read) and its kind. */
export function buildPackage(kind, { assets = [], maps = [], themes = [] }, info, now = new Date()) {
  const file = buildSaveFile({ settings: { dataVersion: DATA_VERSION }, assets, maps, themes }, now, info);
  return { format: file.format, version: file.version, kind, ...file };
}

/** A file name from a name: ("map", "Zelené údolí") → "map-zelene-udoli.json". */
export function packageFileName(prefix, name) {
  const slug = String(name || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return `${prefix}-${slug || prefix}.json`;
}
