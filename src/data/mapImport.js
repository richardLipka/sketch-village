// Importing a map file (SPEC §13a): one map with everything it needs to be
// played as its maker saw it – pure, unit-tested.
//
//   planMapImport(db, file)              → { additions, partials, exact, maps }
//   applyMapImport(db, plan)             → { db, summary }
//   resolveDuplicates(db, plan, choose)  → { db, rename, summary }
//
// Every component of the file is compared with the ones here (by id, else by
// kind and name):
//   – exactly the same → the map uses the one here, nothing is added;
//   – partly the same (same name, but another picture, other numbers…) → it is
//     added as a copy with a new name made from its name and the map's name
//     ("Goblin (Zelené údolí)"), so the map plays with the maker's version;
//   – not here at all → added as it is.
// Something that calls or uses a changed thing (a necromancer whose skeleton
// is different) is a copy too – the map must get the maker's skeletons. After
// the import the kid sees the copies (ImportDuplicates) and may merge each
// one: keep both (default), keep mine or take the map's version.

import { newId, SAVE_VERSION } from './saveFile.js';
import { namesOf, diffRecords, remapIds, upgradeIncoming, comparable, sameThing } from './mergePlan.js';
import { wavesOf } from '../config/waves.js';
import { rulesOf } from '../config/rules.js';

/** A save file that holds one downloaded map (Maps → ⬇ Download, the public library). */
export const isMapFile = (file) => file?.kind === 'map' || (!!file?.info && file?.maps?.length === 1);

const textOf = (name) => (typeof name === 'string' ? name : name?.cs ?? Object.values(name ?? {})[0] ?? '');

/** "Goblin" + "Zelené údolí" → "Goblin (Zelené údolí)"; a map copy "Louka (2)". Unique among `taken` (lower-case names). */
function deriveName(name, tag, taken) {
  const one = (n) => {
    let s = tag ? `${n} (${tag})` : `${n} (2)`;
    for (let k = 2; taken.has(s.toLowerCase()); k++) s = tag ? `${n} (${tag} ${k})` : `${n} (${k + 1})`;
    taken.add(s.toLowerCase());
    return s;
  };
  if (!name || typeof name === 'string') return one(name || '?');
  const made = {}; // the same name in both languages gets the same new name
  return Object.fromEntries(Object.entries(name).map(([lang, n]) => [lang, made[n] ??= one(n)]));
}

const kindOf = (rec) => rec?.category ?? null;
/** Is `x` a copy an earlier import made of `rec` ("Goblin (Zelené údolí)")? */
const isCopyOf = (x, rec) => {
  const names = namesOf(rec);
  return namesOf(x).some((n) => names.some((m) => n.startsWith(`${m} (`)));
};

/** Pair every incoming record with one here: same id (and kind), else same kind and name. */
function pairUp(local, incoming) {
  const pairs = new Map();
  const used = new Set();
  for (const rec of incoming) {
    let cur = local.find((x) => x.id === rec.id && kindOf(x) === kindOf(rec));
    if (!cur) {
      const names = namesOf(rec);
      cur = names.length ? local.find((x) => !used.has(x.id) && kindOf(x) === kindOf(rec) && namesOf(x).some((n) => names.includes(n))) : null;
    }
    if (cur) { used.add(cur.id); pairs.set(rec.id, cur); }
  }
  return pairs;
}

export function planMapImport(db, file, now = new Date()) {
  const incoming = (file.version ?? 1) < SAVE_VERSION ? upgradeIncoming(file) : file;
  const stamp = now.toISOString();
  const localIds = new Set(['assets', 'maps', 'themes'].flatMap((c) => (db[c] ?? []).map((x) => x.id)));
  const remap = {};

  // themes are worlds: one here with the same id or name is used, a missing one is added
  const themePairs = pairUp(db.themes ?? [], incoming.themes ?? []);
  for (const [id, cur] of themePairs) remap[id] = cur.id;

  // components and maps: assume every pair is the same thing, then check each
  // against the one here – or against a copy an earlier import of this map
  // made (same content, derived name: importing twice adds nothing twice) –
  // and let the answer spread to everything that refers to it, until nothing
  // changes. One that matches nothing will be a copy.
  const assets = (incoming.assets ?? []).filter((a) => a?.id);
  const maps = (incoming.maps ?? []).filter((m) => m?.id);
  const all = [...assets, ...maps];
  const localOf = (rec) => (rec.category ? db.assets : db.maps) ?? [];
  const pairs = new Map([...pairUp(db.assets ?? [], assets), ...pairUp(db.maps ?? [], maps)]);
  for (const [id, cur] of pairs) remap[id] = cur.id;
  for (const rec of all) {
    if (!remap[rec.id] && localIds.has(rec.id)) remap[rec.id] = newId(); // an id taken by something else
  }
  // a map here without its own waves plays the default plan – the one a downloaded map carries
  const balance = rulesOf({ rules: db.rules }).balance;
  const asPlayed = (x) => (x.category || x.waves?.rounds?.length ? x : { ...x, waves: wavesOf(x, balance) });
  const sameAs = (rec, local) => {
    const mine = remapIds(rec, remap);
    const x = asPlayed(local);
    return sameThing(mine, x) || (isCopyOf(x, rec) && sameThing({ ...mine, name: x.name }, x));
  };
  const options = new Map(all.filter((rec) => pairs.has(rec.id)).map((rec) => [rec.id,
    [pairs.get(rec.id), ...localOf(rec).filter((x) => x !== pairs.get(rec.id) && kindOf(x) === kindOf(rec) && isCopyOf(x, rec))]]));
  const copyId = new Map(); // the id a copy will get – the same in every pass
  const same = new Map(); // rec.id → the thing here it is (null: none, it becomes a copy)
  for (let again = true, pass = 0; again && pass < 50; pass++) {
    again = false;
    for (const rec of all) {
      if (!options.has(rec.id)) continue;
      const hit = options.get(rec.id).find((x) => sameAs(rec, x)) ?? null;
      same.set(rec.id, hit);
      if (!hit && !copyId.has(rec.id)) copyId.set(rec.id, newId());
      const id = hit ? hit.id : copyId.get(rec.id);
      if (remap[rec.id] !== id) { remap[rec.id] = id; again = true; }
    }
  }
  const partial = new Set([...same].filter(([, hit]) => !hit).map(([id]) => id));

  const tag = textOf(maps[0]?.name) || textOf(incoming.info?.title) || 'mapa';
  const taken = new Set((db.assets ?? []).flatMap(namesOf));
  const takenMaps = new Set((db.maps ?? []).flatMap(namesOf));
  const additions = [], partials = [];
  let exact = 0;
  for (const th of incoming.themes ?? []) if (th?.id && !themePairs.has(th.id)) additions.push({ collection: 'themes', record: remapIds(th, remap) });
  for (const rec of all) {
    const collection = rec.category ? 'assets' : 'maps';
    const cur = pairs.get(rec.id);
    const record = { ...remapIds(rec, remap), id: remap[rec.id] ?? rec.id };
    if (!cur) { additions.push({ collection, record }); continue; }
    if (!partial.has(rec.id)) { exact++; continue; }
    const { builtIn: _drop, ...copy } = record;
    const name = collection === 'maps' ? deriveName(rec.name, null, takenMaps) : deriveName(rec.name, tag, taken);
    partials.push({
      collection, local: cur, original: { ...record, id: cur.id },
      record: { ...copy, name, createdAt: stamp, updatedAt: stamp },
      diff: diffRecords(comparable(cur), comparable({ ...record, id: cur.id })),
    });
  }

  // the file's maps as they are called here after the import (to open one to play)
  return { additions, partials, exact, maps: maps.map((m) => remap[m.id] ?? m.id) };
}

export function applyMapImport(db, plan) {
  const next = { ...db };
  for (const c of ['assets', 'maps', 'themes']) next[c] = [...(db[c] ?? [])];
  for (const { collection, record } of [...plan.additions, ...plan.partials]) next[collection].push(record);
  return { db: next, summary: { added: plan.additions.length, copies: plan.partials.length, unchanged: plan.exact } };
}

/**
 * The kid's choices for the copies: `choose(partial)` → 'both' (keep the copy,
 * default) | 'mine' (drop the copy, use the one here) | 'theirs' (the one here
 * becomes the map's version, the copy goes). Whatever used a dropped copy uses
 * the one here instead; `rename` says which ids went where.
 */
export function resolveDuplicates(db, plan, choose, now = new Date()) {
  const next = { ...db };
  const rename = {};
  const summary = { both: 0, mine: 0, theirs: 0 };
  for (const p of plan.partials) {
    const c = choose(p) ?? 'both';
    summary[c] = (summary[c] ?? 0) + 1;
    if (c === 'both') continue;
    rename[p.record.id] = p.local.id;
    next[p.collection] = (next[p.collection] ?? []).filter((x) => x.id !== p.record.id).map((x) => (c === 'theirs' && x.id === p.local.id
      ? { ...p.original, id: x.id, createdAt: x.createdAt, updatedAt: now.toISOString(), ...(x.builtIn ? { builtIn: true } : {}) }
      : x));
  }
  if (Object.keys(rename).length) {
    next.assets = remapIds(next.assets ?? [], rename);
    next.maps = remapIds(next.maps ?? [], rename);
  }
  return { db: next, rename, summary };
}
