import fs from 'node:fs';
import { test, expect } from '@playwright/test';
import { watchErrors, openMenu, readDb, writeDb } from './helpers.js';

// ⬆ Load in Maps, the studio and Save & load (SPEC §13a): a file from the
// computer or from an address; ⬇ on a studio component downloads it with
// everything it needs, and loading it into another game copies only what
// differs.

const ONE_PIXEL = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
const fileOf = async (download) => JSON.parse(fs.readFileSync(await download.path(), 'utf8'));
const asUpload = (name, data) => ({ name, mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(data)) });
const nameOf = (a) => (typeof a.name === 'string' ? a.name : a.name.cs);

test('Maps: load a map from the computer, from a library name and from an address', async ({ page, baseURL }) => {
  const errors = watchErrors(page);
  await openMenu(page);
  await page.getByRole('button', { name: /Mapy/ }).click();

  // a downloaded map, then deleted here: loading the file brings it back
  const downloading = page.waitForEvent('download');
  await page.locator('.asset-tile').first().getByTestId('map-download').click();
  const file = await fileOf(await downloading);
  const db = await readDb(page);
  await writeDb(page, { ...db, maps: db.maps.filter((m) => m.id !== file.maps[0].id) });
  await page.reload();
  await page.getByRole('button', { name: /Mapy/ }).click();
  await expect(page.locator('.asset-tile', { hasText: file.maps[0].name })).toHaveCount(0);

  await page.getByTestId('map-load').click();
  await page.getByTestId('load-file-input').setInputFiles(asUpload('map.json', file));
  await expect(page.locator('.toast')).toContainText('Mapa nahrána');
  await expect(page.locator('.asset-tile', { hasText: file.maps[0].name })).toHaveCount(1);
  await page.locator('.toast').click();

  // a library file by its name
  await page.getByTestId('map-load').click();
  await page.getByLabel(/Z adresy/).fill('goblin-forest');
  await page.getByRole('button', { name: 'Načíst' }).click();
  await expect(page.locator('.toast')).toContainText('Mapa nahrána');
  await expect(page.locator('.asset-tile', { hasText: 'Skřetí les' }).first()).toBeVisible();
  await page.locator('.toast').click();

  // a full address
  await page.getByTestId('map-load').click();
  await page.getByLabel(/Z adresy/).fill(new URL('library/spooky-graveyard.json', baseURL).href);
  await page.getByRole('button', { name: 'Načíst' }).click();
  await expect(page.locator('.toast')).toContainText('Mapa nahrána');
  await expect(page.locator('.asset-tile', { hasText: 'Strašidelný hřbitov' }).first()).toBeVisible();

  // nothing there: said in the dialog, nothing changes
  const before = (await readDb(page)).maps.length;
  await page.getByTestId('map-load').click();
  await page.getByLabel(/Z adresy/).fill(new URL('library/no-such-map.json', baseURL).href);
  await page.getByRole('button', { name: 'Načíst' }).click();
  await expect(page.getByRole('alert')).toBeVisible();
  await page.locator('.modal').getByRole('button', { name: 'Zrušit' }).click();
  expect((await readDb(page)).maps.length).toBe(before);
  expect(errors).toEqual([]);
});

test('studio: download a monster with its minions, load it into a game drawn differently', async ({ page, isMobile }) => {
  test.skip(isMobile, 'the studio is checked on the PC');
  const errors = watchErrors(page);
  await openMenu(page);
  await page.getByRole('button', { name: /Ateliér/ }).click();
  await page.getByRole('button', { name: /Nepřátelé/ }).click();
  const downloading = page.waitForEvent('download');
  await page.locator('.asset-tile', { hasText: '⭐ Nekromant' }).getByTestId('component-download').click();
  const download = await downloading;
  expect(download.suggestedFilename()).toBe('enemy-nekromant.json');
  const file = await fileOf(download);
  expect(file.kind).toBe('component');
  expect(file.assets.map((a) => a.id)).toEqual(['necromancer', 'skeleton', 'skeletonWarrior']);
  expect(file.themes.map((th) => th.id)).toEqual(expect.arrayContaining(['necromancy', 'graveyard']));

  // someone here redrew the skeleton
  const db = await readDb(page);
  await writeDb(page, { ...db, assets: db.assets.map((a) => (a.id === 'skeleton' ? { ...a, images: [ONE_PIXEL] } : a)) });
  await page.reload();
  await page.getByRole('button', { name: /Ateliér/ }).click();
  await page.getByTestId('studio-load').click();
  await page.getByTestId('load-file-input').setInputFiles(asUpload('necro.json', file));

  const table = page.locator('.modal');
  await expect(table.getByText('Podobné věci ze souboru')).toBeVisible();
  await expect(table.locator('tr[data-name="Kostlivec"]')).toContainText('Kostlivec (2)');
  await expect(table.locator('tr[data-name="Nekromant"]')).toContainText('Nekromant (2)');
  await expect(table.getByText('Jen ze souboru').first()).toBeVisible();
  await table.getByTestId('dup-done').click(); // keep both
  await expect(page.locator('.toast')).toContainText('kopie s novým jménem: 2');

  const after = await readDb(page);
  const copy = after.assets.find((a) => nameOf(a) === 'Nekromant (2)');
  const skel = after.assets.find((a) => nameOf(a) === 'Kostlivec (2)');
  expect(copy.stats.minions).toEqual([skel.id, 'skeletonWarrior']);
  expect(after.assets.find((a) => a.id === 'skeleton').images).toEqual([ONE_PIXEL]); // ours untouched
  expect(errors).toEqual([]);
});

test('Save & load: the same dialog loads a hero file into a game that lost the hero', async ({ page }) => {
  const errors = watchErrors(page);
  await openMenu(page);
  const db = await readDb(page);
  const hero = db.assets.find((a) => a.category === 'hero');
  const file = {
    format: 'sketch-village', version: 3, kind: 'component', exportedAt: new Date().toISOString(), info: { title: nameOf(hero), category: 'hero' },
    settings: { dataVersion: 4 }, assets: [hero], maps: [], themes: [], enemyTypes: [], buildingTypes: [], rules: [], weapons: [],
  };
  await writeDb(page, { ...db, assets: db.assets.filter((a) => a.id !== hero.id) });
  await page.reload();
  await page.getByRole('button', { name: /Uložit a nahrát/ }).click();
  await page.getByTestId('data-load').click();
  await page.getByTestId('load-file-input').setInputFiles(asUpload('hero.json', file));
  await expect(page.locator('.toast')).toContainText('nové věci: 1');
  expect((await readDb(page)).assets.find((a) => a.id === hero.id)?.images).toEqual(hero.images);
  expect(errors).toEqual([]);
});
