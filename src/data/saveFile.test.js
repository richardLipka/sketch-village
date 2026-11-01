import { describe, it, expect } from 'vitest';
import { buildSaveFile, parseSaveFile, mergeCollection, mergeSaveFile, cleanRecords } from './saveFile.js';
import { migrateDb } from './migrate.js';

describe('save file', () => {
  it('round-trips through JSON', () => {
    const db = { settings: { language: 'en' }, assets: [{ id: 'a', category: 'hero' }] };
    const file = parseSaveFile(JSON.stringify(buildSaveFile(db)));
    expect(file.assets).toEqual(db.assets);
    expect(file.maps).toEqual([]);
    expect(file.settings.language).toBe('en');
  });

  it('rejects foreign or newer files', () => {
    expect(() => parseSaveFile('nope')).toThrow('import.error_not_json');
    expect(() => parseSaveFile({ format: 'other' })).toThrow('import.error_wrong_format');
    expect(() => parseSaveFile({ format: 'sketch-village', version: 99 })).toThrow('import.error_newer_version');
  });
});

describe('merge', () => {
  it('adds new, updates newer, skips older', () => {
    const existing = [
      { id: '1', name: 'old', updatedAt: '2026-01-01' },
      { id: '2', name: 'keep', updatedAt: '2026-05-01' },
    ];
    const incoming = [
      { id: '1', name: 'new', updatedAt: '2026-02-01' },
      { id: '2', name: 'stale', updatedAt: '2026-04-01' },
      { id: '3', name: 'added', updatedAt: '2026-03-01' },
      { name: 'no id' },
    ];
    const { records, summary } = mergeCollection(existing, incoming);
    const byId = Object.fromEntries(records.map((r) => [r.id, r.name]));
    expect(byId).toEqual({ 1: 'new', 2: 'keep', 3: 'added' });
    expect(summary).toEqual({ added: 1, updated: 1, skipped: 2 });
  });

  it('merges all collections and keeps settings', () => {
    const db = { settings: { language: 'cs' }, assets: [{ id: 'a' }], maps: [] };
    const file = parseSaveFile({ format: 'sketch-village', version: 1, maps: [{ id: 'm' }] });
    const { db: next, summary } = mergeSaveFile(db, file);
    expect(next.assets).toHaveLength(1);
    expect(next.maps).toHaveLength(1);
    expect(next.settings.language).toBe('cs');
    expect(summary.added).toBe(1);
  });
});


describe('files from before data version 4 (building HP −20 %)', () => {
  const tower = { id: 'tower', category: 'building', name: 'Věž', images: [], stats: { features: ['shoots'], levels: [{ hp: 500 }, { hp: 750 }] } };
  const look = { id: 'look', category: 'building', name: 'Jiná věž', images: [], stats: { variantOf: 'tower' } };
  const file = (settings) => JSON.stringify({ format: 'sketch-village', version: 3, settings, assets: [tower, look] });

  it('an older backup or class pack gets the lower HP when it is read', () => {
    for (const settings of [{ dataVersion: 3 }, {}]) {
      const f = parseSaveFile(file(settings));
      expect(f.assets[0].stats.levels.map((l) => l.hp)).toEqual([400, 600]);
      expect(f.assets[1].stats).toEqual({ variantOf: 'tower' });
      expect(f.settings.dataVersion).toBe(4);
    }
  });

  it('a file exported after the change stays as it is', () => {
    expect(parseSaveFile(file({ dataVersion: 4 })).assets[0].stats.levels.map((l) => l.hp)).toEqual([500, 750]);
  });
});

describe('damaged records can’t break a screen', () => {
  const good = { id: 'g', category: 'hero', name: 'Lara', images: ['data:image/png;base64,x', null], stats: { attack: 3 }, themes: ['plains'] };
  const map = { id: 'm', name: 'Louka', world: { width: 1280, height: 720 }, decorations: [], spots: [], caves: [] };

  it('healthy records stay the very same objects', () => {
    const { db, fixed } = cleanRecords({ assets: [good], maps: [map], themes: [{ id: 'plains' }] });
    expect(fixed).toBe(0);
    expect(db.assets[0]).toBe(good);
    expect(db.maps[0]).toBe(map);
  });

  it('broken ones are repaired, records without an id dropped', () => {
    const { db, fixed } = cleanRecords({
      assets: [{ ...good, images: 5, name: 7, stats: [1], themes: 'plains' }, { category: 'enemy' }, null, 'x'],
      maps: [{ ...map, spots: 'a', world: null, name: 3 }],
      themes: [{ name: 'no id' }],
    });
    expect(fixed).toBe(6);
    expect(db.assets).toEqual([{ ...good, images: [], name: '', stats: {}, themes: [] }]);
    expect(db.maps[0]).toMatchObject({ spots: [], world: { width: 1280, height: 720 }, name: '3' });
    expect(db.themes).toEqual([]);
  });

  it('an imported file and the browser’s own data are repaired on the way in', () => {
    const file = parseSaveFile(JSON.stringify({ format: 'sketch-village', version: 3, settings: {}, assets: [{ ...good, images: 'oops' }], maps: [], themes: [] }));
    expect(file.assets[0].images).toEqual([]);
    const { db, changed } = migrateDb({ settings: {}, assets: [{ ...good, images: { a: 1 } }] });
    expect(changed).toBe(true);
    expect(db.assets.find((a) => a.id === 'g').images).toEqual([]);
  });
});
