// Runtime storage in IndexedDB (localStorage is too small for many drawings).
// One key per collection; the whole library is small enough to load at start.

import { get, set, del } from 'idb-keyval';
import { COLLECTIONS } from './saveFile.js';

const KEY = (c) => `sv:${c}`;

export async function loadDb() {
  const db = { settings: (await get(KEY('settings'))) ?? {} };
  for (const c of COLLECTIONS) db[c] = (await get(KEY(c))) ?? [];
  return db;
}

export async function saveCollection(name, records) {
  await set(KEY(name), records);
}

export async function saveSettings(settings) {
  await set(KEY('settings'), settings);
}

export async function saveDb(db) {
  await saveSettings(db.settings ?? {});
  for (const c of COLLECTIONS) await saveCollection(c, db[c] ?? []);
}

export async function purgeAll() {
  for (const c of COLLECTIONS) await del(KEY(c));
}
