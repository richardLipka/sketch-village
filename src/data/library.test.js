import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { resolveDataUrl, isOwnSite, dataParam, withoutDataParam, shareLink, parseLibrary, localText, fetchSaveFile, LIBRARY_FORMAT } from './library.js';
import { parseSaveFile, mergeSaveFile } from './saveFile.js';
import { planMapImport, isMapFile } from './mapImport.js';
import { migrateDb } from './migrate.js';
import { buildIndex, indexText, LIBRARY } from '../../scripts/library-index.mjs';

const SITE = 'https://richardlipka.github.io/sketch-village/';

describe('?data= links', () => {
  it('a bare name is a file of the library, a path is relative to the game', () => {
    expect(resolveDataUrl('green-valley', SITE)).toBe(`${SITE}library/green-valley.json`);
    expect(resolveDataUrl('green-valley.json', SITE)).toBe(`${SITE}library/green-valley.json`);
    expect(resolveDataUrl('library/green-valley.json', SITE)).toBe(`${SITE}library/green-valley.json`);
    expect(resolveDataUrl('packs/class-3b', SITE)).toBe(`${SITE}packs/class-3b.json`);
  });

  it('a full address must be http(s); anything else is refused', () => {
    expect(resolveDataUrl('https://example.org/maps/forest.json', SITE)).toBe('https://example.org/maps/forest.json');
    expect(resolveDataUrl('javascript:alert(1)', SITE)).toBeNull();
    expect(resolveDataUrl('data:application/json,{}', SITE)).toBeNull();
    expect(resolveDataUrl('', SITE)).toBeNull();
    expect(resolveDataUrl(null, SITE)).toBeNull();
  });

  it('files from the game\'s own site load at once, others are asked about', () => {
    expect(isOwnSite(`${SITE}library/a.json`, SITE)).toBe(true);
    expect(isOwnSite('https://example.org/a.json', SITE)).toBe(false);
  });

  it('reads the parameter, removes it after loading, makes share links', () => {
    expect(dataParam(`${SITE}?data=goblin-forest`)).toBe('goblin-forest');
    expect(dataParam(SITE)).toBeNull();
    expect(withoutDataParam(`${SITE}?data=goblin-forest&x=1`)).toBe(`${SITE}?x=1`);
    expect(shareLink({ file: 'goblin-forest.json' }, `${SITE}?data=old#top`)).toBe(`${SITE}?data=goblin-forest`);
  });

  it('a failed download is a translated error', async () => {
    await expect(fetchSaveFile('x', async () => ({ ok: false }))).rejects.toThrow('library.error_fetch');
    await expect(fetchSaveFile('x', async () => { throw new Error('offline'); })).rejects.toThrow('library.error_fetch');
    await expect(fetchSaveFile('x', async () => ({ ok: true, text: async () => '{"format":"other"}' }))).rejects.toThrow('import.error_wrong_format');
    await expect(fetchSaveFile('x', async () => ({ ok: true, text: async () => '<!doctype html><html>' }))).rejects.toThrow('library.error_fetch');
  });
});

describe('the listing', () => {
  it('drops broken entries and refuses other files', () => {
    expect(parseLibrary({ format: LIBRARY_FORMAT, files: [{ file: 'a.json' }, {}, null] }).files).toEqual([{ file: 'a.json' }]);
    expect(() => parseLibrary({ format: 'x', files: [] })).toThrow('library.error_format');
  });

  it('texts in both languages or one', () => {
    expect(localText({ cs: 'Les', en: 'Forest' }, 'en')).toBe('Forest');
    expect(localText({ cs: 'Les' }, 'en')).toBe('Les');
    expect(localText('Moje mapa', 'en')).toBe('Moje mapa');
  });
});

describe('public/library (what the website serves)', () => {
  const index = JSON.parse(fs.readFileSync(path.join(LIBRARY, 'index.json'), 'utf8'));
  const pack = parseSaveFile(fs.readFileSync(path.join(LIBRARY, '..', 'default-data.json'), 'utf8'));
  const fresh = migrateDb(mergeSaveFile({ settings: {}, assets: [], maps: [], themes: [], rules: [] }, pack).db).db;

  it('index.json is up to date with the files (run npm run library after adding one)', () => {
    expect(fs.readFileSync(path.join(LIBRARY, 'index.json'), 'utf8').replace(/\r\n/g, '\n')).toBe(indexText(buildIndex()));
    expect(parseLibrary(index).files.length).toBeGreaterThanOrEqual(3);
  });

  it('every file is one complete save file: valid maps with their pictures inside', () => {
    for (const entry of index.files) {
      const file = parseSaveFile(fs.readFileSync(path.join(LIBRARY, entry.file), 'utf8'));
      expect(localText(entry.title, 'cs')).toBeTruthy();
      expect(entry.thumbnail).toMatch(/^data:image\/jpeg;base64,/);
      for (const m of file.maps) {
        expect(m.valid).toBe(true);
        expect(m.background).toMatch(/^data:image\/png;base64,/);
        // every decoration's picture travels in the same file
        const ids = new Set(file.assets.map((a) => a.id));
        for (const d of m.decorations) expect(ids.has(d.asset)).toBe(true);
      }
      expect(isMapFile(file)).toBe(true);
      for (const a of file.assets) for (const src of a.images.filter(Boolean)) expect(src).toMatch(/^data:image\/(png|webp|jpeg);base64,/);
      // everything the map's waves send is in the file, and no GUI icons
      const ids = new Set(file.assets.map((a) => a.id));
      for (const r of file.maps[0].waves.rounds) for (const g of r.groups) expect(ids.has(g.enemy), g.enemy).toBe(true);
      expect(file.assets.some((a) => a.category === 'icon')).toBe(false);
      // a fresh game (built-ins + the class pack) gets just the map and its decorations, nothing twice
      const plan = planMapImport(fresh, file);
      expect(plan.partials).toHaveLength(0);
      expect(plan.additions.filter((x) => x.collection === 'assets').every((x) => x.record.category === 'decoration')).toBe(true);
      expect(plan.maps).toEqual(file.maps.map((m) => m.id));
    }
  });
});
