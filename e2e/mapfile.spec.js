import fs from 'node:fs';
import { test, expect } from '@playwright/test';
import { watchErrors, openMenu, readDb, writeDb } from './helpers.js';

// Downloading one map with everything it needs and loading it into a game
// whose drawings differ (SPEC §13a): the same things are used, partly
// different ones come as copies named after the map, and the table at the end
// merges them.

const ONE_PIXEL = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

test('a map file: download, load into a game drawn differently, merge the copies', async ({ page }) => {
  const errors = watchErrors(page);
  await openMenu(page);

  // a fresh game starts with the class's drawings (public/default-data.json)
  const start = await readDb(page);
  const goblin = start.assets.find((a) => a.id === 'goblin');
  expect(goblin.images[0]).toMatch(/^data:image\/webp/);
  expect(start.assets.find((a) => a.id === 'rukh').name).toEqual({ cs: 'Rukh', en: 'Roc' });

  // ⬇ Download on the map tile
  await page.getByRole('button', { name: /Mapy/ }).click();
  const tile = page.locator('.asset-tile').first();
  const downloading = page.waitForEvent('download');
  await tile.getByTestId('map-download').click();
  const download = await downloading;
  expect(download.suggestedFilename()).toMatch(/^map-.*\.json$/);
  const file = JSON.parse(fs.readFileSync(await download.path(), 'utf8'));
  expect(file.kind).toBe('map');
  expect(file.maps).toHaveLength(1);
  const ids = file.assets.map((a) => a.id);
  expect(ids).toEqual(expect.arrayContaining(['townhall', 'castle', 'goblin', 'dragon', 'rukh', 'goblinPack']));
  expect(file.assets.some((a) => a.category === 'hero')).toBe(true);
  expect(file.assets.some((a) => a.category === 'icon')).toBe(false);
  const mapName = file.maps[0].name;

  // the same game, but someone redrew the goblin
  await writeDb(page, { ...start, assets: start.assets.map((a) => (a.id === 'goblin' ? { ...a, images: [ONE_PIXEL] } : a)) });
  await page.reload();
  await expect(page.getByRole('button', { name: /Hrát/ })).toBeVisible();
  await page.getByRole('button', { name: /Uložit a nahrát/ }).click();
  await page.locator('input[type=file]').setInputFiles({ name: 'map.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(file)) });

  // the table of copies: the goblin, the goblin king who calls goblins, the map that sends them
  const table = page.locator('.modal');
  await expect(table.getByText('Podobné věci z mapy')).toBeVisible();
  const row = table.locator('tr[data-name="Goblin"]');
  await expect(row).toContainText(`Goblin (${mapName})`);
  await expect(row).toContainText('obrázek');
  await expect(table.locator('tr[data-name="Král goblinů"]')).toBeVisible();
  // "keep both" is chosen everywhere until the kid picks
  await expect(table.locator('input[value=both]:checked')).toHaveCount(await table.locator('tbody tr').count());
  await row.getByText('Jen moje').click();
  await table.getByTestId('dup-done').click();
  await expect(page.locator('.toast:not(.toast-top)')).toContainText('Mapa nahrána');
  await expect(page.locator('.toast:not(.toast-top)')).toContainText('sloučeno: 1');

  // stored: our goblin as it was and no goblin copy; the king's copy calls our goblin
  const after = await readDb(page);
  expect(after.assets.find((a) => a.id === 'goblin').images).toEqual([ONE_PIXEL]);
  const names = after.assets.map((a) => (typeof a.name === 'string' ? a.name : a.name.cs));
  expect(names).not.toContain(`Goblin (${mapName})`);
  const king = after.assets.find((a) => a.name?.cs === `Král goblinů (${mapName})`);
  expect(king.stats.minions).toEqual(['goblin', 'orc', 'archer']);
  expect(after.maps.some((m) => m.name === `${mapName} (2)`)).toBe(true);
  expect(errors).toEqual([]);
});

test('a map file: loaded back into the same game adds nothing', async ({ page }) => {
  const errors = watchErrors(page);
  await openMenu(page);
  await page.getByRole('button', { name: /Mapy/ }).click();
  const downloading = page.waitForEvent('download');
  await page.locator('.asset-tile').first().getByTestId('map-download').click();
  const file = JSON.parse(fs.readFileSync(await (await downloading).path(), 'utf8'));
  const before = await readDb(page);

  await page.getByRole('button', { name: /←/ }).click();
  await page.getByRole('button', { name: /Uložit a nahrát/ }).click();
  await page.locator('input[type=file]').setInputFiles({ name: 'map.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(file)) });
  await expect(page.locator('.toast:not(.toast-top)')).toContainText('nové věci: 0, kopie s novým jménem: 0');
  await expect(page.locator('.modal')).toHaveCount(0);
  const after = await readDb(page);
  expect(after.assets.length).toBe(before.assets.length);
  expect(after.maps.length).toBe(before.maps.length);
  expect(errors).toEqual([]);
});
