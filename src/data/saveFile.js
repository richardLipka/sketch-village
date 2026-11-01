// The single JSON save file (SPEC §13a) and the merge rules for importing it.
// Pure logic – the IndexedDB side lives in store.js.

export const SAVE_FORMAT = 'sketch-village';
export const SAVE_VERSION = 3; // 2: components (data/migrate.js upgrades version 1 files), 3: themes

// Collections of id-keyed records. `assets` holds all components, `themes` the
// worlds (config/themes.js); enemyTypes,
// buildingTypes and weapons are only read from version-1 files and are turned
// into components after the import (data/migrate.js).
export const COLLECTIONS = ['assets', 'maps', 'themes', 'enemyTypes', 'buildingTypes', 'rules', 'weapons'];

export function newId() {
  if (globalThis.crypto?.randomUUID) return crypto.randomUUID();
  return 'id-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
}

/**
 * `info` (optional) describes the file for the public library (data/library.js):
 * { title, description, author, thumbnail } – texts may be { cs, en }, the
 * thumbnail is a small JPEG data URL. Older games ignore it.
 */
export function buildSaveFile(db, now = new Date(), info = null) {
  const file = {
    format: SAVE_FORMAT,
    version: SAVE_VERSION,
    exportedAt: now.toISOString(),
    ...(info ? { info } : {}),
    settings: db.settings ?? {},
  };
  for (const c of COLLECTIONS) file[c] = db[c] ?? [];
  return file;
}

// Data version 4 lowered every building's HP by 20 % (data/migrate.js scales the
// browser's own data once). A backup or class pack exported before that carries
// the old HP – it is scaled when the file is read, so importing it doesn't bring
// the old numbers back (or offer them as "changes" in the import review).
export const HP_SCALE_V4 = 0.8;
export const scaleBuildingHp = (levels) => levels.map((l) => (typeof l?.hp === 'number' ? { ...l, hp: Math.max(1, Math.round(l.hp * HP_SCALE_V4)) } : l));

function upgradeBuildingHp(file) {
  if ((file.settings?.dataVersion ?? 0) >= 4) return;
  file.assets = file.assets.map((a) => (a?.category === 'building' && a.stats?.levels && !a.stats.variantOf
    ? { ...a, stats: { ...a.stats, levels: scaleBuildingHp(a.stats.levels) } } : a));
  file.buildingTypes = file.buildingTypes.map((t) => (t?.levels ? { ...t, levels: scaleBuildingHp(t.levels) } : t)); // version-1 files
  file.settings = { ...file.settings, dataVersion: 4 };
}

const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const isText = (v) => typeof v === 'string' || (isObj(v) && Object.values(v).every((x) => typeof x === 'string'));

/**
 * Records in the shapes the screens expect, so a damaged record (from an
 * edited file, a bug, another tool) can't break a screen: records without an
 * id are dropped; a component's name, pictures, numbers and worlds and a map's
 * name, world and lists are repaired. A healthy record stays the same object.
 * Returns { db, fixed } – fixed = how many records were dropped or repaired.
 */
export function cleanRecords(db) {
  let fixed = 0;
  const keep = (list, fix) => {
    const out = [];
    for (const r of Array.isArray(list) ? list : []) {
      if (!isObj(r) || typeof r.id !== 'string' || !r.id) { fixed++; continue; }
      const f = fix(r);
      if (f !== r) fixed++;
      out.push(f);
    }
    return out;
  };
  const asset = (a) => {
    const nameOk = a.name === undefined || isText(a.name);
    const imagesOk = a.images === undefined || (Array.isArray(a.images) && a.images.every((x) => x === null || typeof x === 'string'));
    const statsOk = a.stats === undefined || isObj(a.stats);
    const themesOk = a.themes === undefined || (Array.isArray(a.themes) && a.themes.every((x) => typeof x === 'string'));
    if (nameOk && imagesOk && statsOk && themesOk) return a;
    return {
      ...a,
      name: nameOk ? a.name : '',
      images: imagesOk ? a.images : (Array.isArray(a.images) ? a.images.map((x) => (typeof x === 'string' ? x : null)) : []),
      stats: statsOk ? a.stats : {},
      ...(themesOk ? {} : { themes: Array.isArray(a.themes) ? a.themes.filter((x) => typeof x === 'string') : [] }),
    };
  };
  const map = (m) => {
    const lists = ['decorations', 'spots', 'caves'].filter((k) => m[k] !== undefined && !Array.isArray(m[k]));
    const worldOk = m.world === undefined || (isObj(m.world) && m.world.width > 0 && m.world.height > 0);
    const nameOk = m.name === undefined || typeof m.name === 'string';
    if (!lists.length && worldOk && nameOk) return m;
    return { ...m, ...Object.fromEntries(lists.map((k) => [k, []])), ...(worldOk ? {} : { world: { width: 1280, height: 720 } }), ...(nameOk ? {} : { name: String(m.name ?? '') }) };
  };
  const next = { ...db, assets: keep(db.assets, asset), maps: keep(db.maps, map), themes: keep(db.themes, (t) => t) };
  return { db: next, fixed };
}

/** Validate and upgrade an imported file. Throws with a translation key on failure. */
export function parseSaveFile(json) {
  let file;
  try {
    file = typeof json === 'string' ? JSON.parse(json) : json;
  } catch {
    throw new Error('import.error_not_json');
  }
  if (!file || file.format !== SAVE_FORMAT) throw new Error('import.error_wrong_format');
  if (typeof file.version !== 'number' || file.version > SAVE_VERSION) throw new Error('import.error_newer_version');
  // Future format changes: migrate older versions here, step by step.
  for (const c of COLLECTIONS) if (!Array.isArray(file[c])) file[c] = [];
  upgradeBuildingHp(file);
  return cleanRecords(file).db;
}

/**
 * Merge an imported collection into an existing one by id.
 * New ids are added; for an existing id the newer `updatedAt` wins.
 */
export function mergeCollection(existing, incoming) {
  const byId = new Map(existing.map((r) => [r.id, r]));
  const summary = { added: 0, updated: 0, skipped: 0 };
  for (const rec of incoming) {
    if (!rec || !rec.id) { summary.skipped++; continue; }
    const cur = byId.get(rec.id);
    if (!cur) {
      byId.set(rec.id, rec);
      summary.added++;
    } else if ((rec.updatedAt ?? '') > (cur.updatedAt ?? '')) {
      byId.set(rec.id, rec);
      summary.updated++;
    } else {
      summary.skipped++;
    }
  }
  return { records: [...byId.values()], summary };
}

export function mergeSaveFile(db, file) {
  const next = { ...db };
  const summary = { added: 0, updated: 0, skipped: 0 };
  for (const c of COLLECTIONS) {
    const r = mergeCollection(db[c] ?? [], file[c] ?? []);
    next[c] = r.records;
    summary.added += r.summary.added;
    summary.updated += r.summary.updated;
    summary.skipped += r.summary.skipped;
  }
  return { db: next, summary };
}
