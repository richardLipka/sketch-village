// Runtime storage in IndexedDB (localStorage is too small for many drawings).
//
// Everything is ONE record: a complete save file (data/saveFile.js) – the same
// JSON that "Download everything" gives, pictures, animations and sounds
// included as data URLs. What the browser keeps can be looked at, copied or
// replaced as a single thing.
//
// Writes are coalesced: a change starts a write at once; changes made while it
// runs are written together right after it, so a burst of edits costs one or
// two writes and the newest data always ends up stored. Every save returns a
// promise that resolves once its change is stored; `flushDb()` waits for all.

import { get, set, del } from 'idb-keyval';
import { COLLECTIONS, buildSaveFile } from './saveFile.js';

export const DB_KEY = 'sv:db';
// older versions of the game kept every collection under its own key – moved into DB_KEY once
const OLD_KEY = (c) => `sv:${c}`;
const OLD_KEYS = ['settings', ...COLLECTIONS].map(OLD_KEY);

let backend = { get, set, del };
let current = null; // the newest data (what the next write stores)
let writing = null; // the running write (a promise) or null
let dirty = false; // changed while a write was running

/** Tests run without IndexedDB: an object with async get / set / del. */
export function setBackend(b) {
  backend = b;
  current = null;
  writing = null;
  dirty = false;
}

const emptyDb = () => Object.fromEntries([['settings', {}], ...COLLECTIONS.map((c) => [c, []])]);

function dbFromFile(file) {
  const db = { settings: file.settings ?? {} };
  for (const c of COLLECTIONS) db[c] = Array.isArray(file[c]) ? file[c] : [];
  return db;
}

export async function loadDb() {
  const file = await backend.get(DB_KEY);
  if (file) {
    current = dbFromFile(file);
    return current;
  }
  // older browsers' data: one key per collection → the single record
  const db = emptyDb();
  db.settings = (await backend.get(OLD_KEY('settings'))) ?? {};
  let found = false;
  for (const c of COLLECTIONS) {
    const v = await backend.get(OLD_KEY(c));
    if (Array.isArray(v)) { db[c] = v; found = true; }
  }
  current = db;
  if (found || Object.keys(db.settings).length) {
    await backend.set(DB_KEY, buildSaveFile(db));
    // the old keys go only once the single record is really there
    if (await backend.get(DB_KEY)) for (const k of OLD_KEYS) await backend.del(k);
  }
  return current;
}

function write() {
  if (writing) { dirty = true; return writing; }
  writing = (async () => {
    try {
      do {
        dirty = false;
        await backend.set(DB_KEY, buildSaveFile(current));
      } while (dirty);
    } finally {
      writing = null;
    }
  })();
  return writing;
}

/** Wait until every change so far is stored. */
export async function flushDb() {
  while (writing) await writing;
}

export function saveDb(db) {
  current = { ...emptyDb(), ...db };
  return write();
}

export function saveCollection(name, records) {
  current = { ...(current ?? emptyDb()), [name]: records };
  return write();
}

export function saveSettings(settings) {
  current = { ...(current ?? emptyDb()), settings };
  return write();
}

export async function purgeAll() {
  await flushDb();
  current = { ...emptyDb(), settings: current?.settings ?? {} };
  await backend.del(DB_KEY);
}
