// The single JSON save file (SPEC §13a) and the merge rules for importing it.
// Pure logic – the IndexedDB side lives in store.js.

export const SAVE_FORMAT = 'sketch-village';
export const SAVE_VERSION = 1;

// Collections of id-keyed records. Later milestones add their data here and
// export/import/merge picks them up automatically.
export const COLLECTIONS = ['assets', 'maps', 'enemyTypes', 'buildingTypes'];

export function newId() {
  if (globalThis.crypto?.randomUUID) return crypto.randomUUID();
  return 'id-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
}

export function buildSaveFile(db, now = new Date()) {
  const file = {
    format: SAVE_FORMAT,
    version: SAVE_VERSION,
    exportedAt: now.toISOString(),
    settings: db.settings ?? {},
  };
  for (const c of COLLECTIONS) file[c] = db[c] ?? [];
  return file;
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
  return file;
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
