// Importing a save file (SPEC §13a) as a reviewed merge – pure, unit-tested.
//
//   planImport(db, file, { language })  →  { additions, changes, unchanged, maps }
//   applyImport(db, plan, accept)       →  { db, language?, summary }
//
// Elements (components, maps, themes, the rules, the settings) are found by id,
// and when the id is not there by NAME (components also by kind), so the same
// drawing made on two computers is recognised. New elements are added; an
// element that exists and differs is a *change*: the kid sees what changed
// (numbers, names, pictures…) and accepts or keeps their own version (or all
// at once). References inside the imported data to an element matched by name
// (decorations on a map, minions, looks, themes) are pointed at the local copy.

import { migrateDb } from './migrate.js';
import { DEFAULT_COMPONENTS } from '../config/components.js';
import { SAVE_VERSION } from './saveFile.js';

export const REVIEW_COLLECTIONS = ['themes', 'assets', 'maps', 'rules'];
/** Settings that travel with the save file (the rest is the browser's own bookkeeping). */
export const PREF_KEYS = ['language', 'wobble', 'muted', 'tutorialStep', 'difficulty'];

const IGNORE = new Set(['id', 'createdAt', 'updatedAt', 'builtIn', 'valid']);
const MAX_DIFFS = 60;

const isObj = (v) => v !== null && typeof v === 'object';
/** JSON with sorted keys – equal data from two computers compares equal. */
export function stable(v) {
  if (Array.isArray(v)) return `[${v.map(stable).join(',')}]`;
  if (isObj(v)) return `{${Object.keys(v).sort().filter((k) => v[k] !== undefined).map((k) => `${JSON.stringify(k)}:${stable(v[k])}`).join(',')}}`;
  return JSON.stringify(v ?? null);
}
const same = (a, b) => stable(a) === stable(b);

/** Lower-case names of a record (built-ins have one per language). */
export function namesOf(rec) {
  const n = rec?.name;
  if (!n) return [];
  return (typeof n === 'string' ? [n] : Object.values(n)).map((s) => String(s).trim().toLowerCase()).filter(Boolean);
}

/**
 * What differs between two records, as [{ path, from, to }]: nested objects
 * and lists are followed down to single numbers / texts / pictures.
 */
export function diffRecords(a, b, path = '', out = [], depth = 0) {
  if (out.length >= MAX_DIFFS || same(a, b)) return out;
  const flatList = (v) => Array.isArray(v) && v.every((x) => !isObj(x));
  if (isObj(a) && isObj(b) && depth < 6 && !flatList(a) && !flatList(b)) {
    const keys = Array.isArray(a) && Array.isArray(b)
      ? Array.from({ length: Math.max(a.length, b.length) }, (_, i) => i)
      : [...new Set([...Object.keys(a), ...Object.keys(b)])];
    for (const k of keys) {
      if (depth === 0 && IGNORE.has(k)) continue;
      const p = Array.isArray(a) ? `${path}[${k}]` : path ? `${path}.${k}` : String(k);
      diffRecords(a?.[k], b?.[k], p, out, depth + 1);
    }
    return out;
  }
  out.push({ path, from: a, to: b });
  return out;
}

/** Replace every string equal to a remapped id, anywhere inside `v`. */
function remapIds(v, remap) {
  if (typeof v === 'string') return remap[v] ?? v;
  if (Array.isArray(v)) return v.map((x) => remapIds(x, remap));
  if (isObj(v)) return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, remapIds(x, remap)]));
  return v;
}

const pickPrefs = (s = {}) => Object.fromEntries(PREF_KEYS.filter((k) => s[k] !== undefined).map((k) => [k, s[k]]));

export function planImport(db, file, { language } = {}) {
  // older files: their enemy / building / weapon lists become components first
  // (without adding the built-ins – the importing browser has its own)
  let incoming = file;
  if ((file.version ?? 1) < SAVE_VERSION) {
    const settings = { builtInsSeeded: DEFAULT_COMPONENTS.map((c) => c.id), themesSeeded: true };
    incoming = { ...migrateDb({ ...file, settings }).db, settings: file.settings };
  }

  // 1) match every incoming element to a local one: by id, else by name (and kind)
  const matches = []; // { collection, local, rec }
  const remap = {};
  for (const c of REVIEW_COLLECTIONS) {
    const local = db[c] ?? [];
    const used = new Set();
    for (const rec of incoming[c] ?? []) {
      if (!rec?.id) continue;
      let cur = local.find((x) => x.id === rec.id);
      if (!cur) {
        const names = namesOf(rec);
        cur = names.length ? local.find((x) => !used.has(x.id) && (c !== 'assets' || x.category === rec.category) && namesOf(x).some((n) => names.includes(n))) : null;
        if (cur) remap[rec.id] = cur.id;
      }
      if (cur) used.add(cur.id);
      matches.push({ collection: c, local: cur ?? null, rec });
    }
  }

  // 2) additions and changes (with references pointed at the local copies)
  const additions = [], changes = [];
  let unchanged = 0;
  for (const { collection, local, rec: raw } of matches) {
    const rec = remapIds(raw, remap);
    if (!local) { additions.push({ collection, record: rec }); continue; }
    const diff = diffRecords(local, rec);
    if (!diff.length) { unchanged++; continue; }
    changes.push({ collection, id: local.id, name: local.name ?? rec.name, category: local.category, local, record: rec, diff });
  }

  // 3) the settings that travel with the file
  const mine = { wobble: false, muted: false, tutorialStep: 0, difficulty: 'normal', ...pickPrefs(db.settings), ...(language ? { language } : {}) };
  const theirs = pickPrefs(incoming.settings);
  const prefDiff = diffRecords(Object.fromEntries(Object.keys(theirs).map((k) => [k, mine[k]])), theirs);
  if (prefDiff.length) changes.push({ collection: 'settings', id: 'settings', name: null, local: mine, record: theirs, diff: prefDiff });

  // the file's maps as they are called here after the import (to open one to play)
  const maps = matches.filter((m) => m.collection === 'maps').map((m) => m.local?.id ?? m.rec.id);

  return { additions, changes, unchanged, maps };
}

/** Apply a plan; `accept(change)` decides each change (true = take the imported version). */
export function applyImport(db, plan, accept) {
  const next = { ...db, settings: { ...db.settings } };
  for (const c of REVIEW_COLLECTIONS) next[c] = [...(db[c] ?? [])];
  const summary = { added: 0, updated: 0, kept: 0, unchanged: plan.unchanged };
  let language;
  for (const { collection, record } of plan.additions) { next[collection].push(record); summary.added++; }
  for (const ch of plan.changes) {
    if (!accept(ch)) { summary.kept++; continue; }
    summary.updated++;
    if (ch.collection === 'settings') {
      const { language: lang, ...rest } = ch.record;
      Object.assign(next.settings, rest);
      if (lang) language = lang;
      continue;
    }
    const list = next[ch.collection];
    const i = list.findIndex((x) => x.id === ch.id);
    const keep = { id: ch.local.id, createdAt: ch.local.createdAt, ...(ch.local.builtIn ? { builtIn: true } : {}) };
    list[i] = { ...ch.record, ...keep, updatedAt: new Date().toISOString() };
  }
  return { db: next, language, summary };
}
