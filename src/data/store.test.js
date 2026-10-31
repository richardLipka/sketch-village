import { describe, it, expect, beforeEach } from 'vitest';
import { setBackend, loadDb, saveCollection, saveSettings, saveDb, flushDb, purgeAll, DB_KEY } from './store.js';
import { parseSaveFile } from './saveFile.js';

// an in-memory IndexedDB stand-in that counts writes; `slow` makes a write take a while
function memory(initial = {}, slow = 0) {
  const data = new Map(Object.entries(initial));
  const b = {
    data, writes: 0,
    get: async (k) => structuredClone(data.get(k)),
    set: async (k, v) => { b.writes++; await new Promise((r) => setTimeout(r, slow)); data.set(k, structuredClone(v)); },
    del: async (k) => { data.delete(k); },
  };
  return b;
}

describe('storage: one save file in IndexedDB', () => {
  let b;
  beforeEach(() => { b = memory(); setBackend(b); });

  it('an empty browser starts empty and stores nothing until something changes', async () => {
    const db = await loadDb();
    expect(db.assets).toEqual([]);
    expect(db.settings).toEqual({});
    expect(b.writes).toBe(0);
  });

  it('everything is one record that is a valid save file, pictures included', async () => {
    await loadDb();
    const pic = 'data:image/png;base64,iVBORw0KGgo=';
    await saveCollection('assets', [{ id: 'a', category: 'hero', name: 'Rytíř', images: [pic] }]);
    await saveSettings({ language: 'en' });
    expect([...b.data.keys()]).toEqual([DB_KEY]);
    const file = parseSaveFile(JSON.stringify(b.data.get(DB_KEY)));
    expect(file.assets[0].images[0]).toBe(pic);
    expect(file.settings.language).toBe('en');
  });

  it('a burst of changes is written in at most two writes, ending with the newest data', async () => {
    b = memory({}, 20);
    setBackend(b);
    await loadDb();
    const done = [];
    for (let i = 1; i <= 10; i++) done.push(saveSettings({ n: i }));
    await Promise.all(done);
    expect(b.writes).toBeLessThanOrEqual(2);
    expect(b.data.get(DB_KEY).settings.n).toBe(10);
  });

  it('a save resolves only once its change is stored (no lost settings on a quick reload)', async () => {
    b = memory({}, 15);
    setBackend(b);
    await loadDb();
    saveCollection('maps', [{ id: 'm1' }]);
    await saveSettings({ difficulty: 'hard' });
    expect(b.data.get(DB_KEY).settings.difficulty).toBe('hard');
    expect(b.data.get(DB_KEY).maps).toEqual([{ id: 'm1' }]);
    await flushDb();
  });

  it('the data of an older version (one key per collection) moves into the single record', async () => {
    b = memory({ 'sv:settings': { language: 'en' }, 'sv:assets': [{ id: 'x' }], 'sv:maps': [{ id: 'm' }] });
    setBackend(b);
    const db = await loadDb();
    expect(db.assets).toEqual([{ id: 'x' }]);
    expect(db.settings.language).toBe('en');
    expect([...b.data.keys()]).toEqual([DB_KEY]);
    setBackend(b); // a new page load reads the single record
    expect((await loadDb()).maps).toEqual([{ id: 'm' }]);
  });

  it('saveDb replaces everything; purgeAll removes the record', async () => {
    await loadDb();
    await saveDb({ settings: { a: 1 }, assets: [{ id: 'q' }] });
    expect(b.data.get(DB_KEY).maps).toEqual([]);
    await purgeAll();
    expect(b.data.has(DB_KEY)).toBe(false);
  });
});
