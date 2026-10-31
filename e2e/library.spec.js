import { test, expect } from '@playwright/test';
import { watchErrors, openMenu, readDb } from './helpers.js';

// The public library (SPEC §13c) and the single-file storage (SPEC §13a):
// the Library screen lists public/library/index.json, loading a file imports
// it and offers to play its map; ?data=<name> opens the game with the file
// loaded; a file from another site is asked about first.

test('library: the list, loading a map, playing it', async ({ page }) => {
  const errors = watchErrors(page);
  await openMenu(page);
  await page.getByRole('button', { name: /Knihovna/ }).click();
  const forest = page.locator('.library-entry[data-file="goblin-forest.json"]');
  await expect(forest).toBeVisible();
  await expect(page.locator('.library-entry')).toHaveCount(3);
  await expect(forest.locator('img.library-thumb')).toBeVisible();

  // the filter works on title and description
  await page.getByRole('searchbox').fill('hrbitov');
  await expect(page.locator('.library-entry')).toHaveCount(1);
  await page.getByRole('searchbox').fill('');

  await forest.getByRole('button', { name: /Nahrát/ }).click();
  await expect(forest.getByRole('status')).toContainText(/Mapa nahrána – nové věci: \d+, kopie s novým jménem: 0/); // a fresh game has the same drawings
  const stored = await readDb(page);
  expect(stored.format).toBe('sketch-village'); // the browser keeps one save file
  expect(stored.maps.some((m) => m.name === 'Skřetí les')).toBe(true);
  expect(stored.assets.find((a) => a.id === 'lib-spruce')?.images[0]).toMatch(/^data:image\/png;base64,/);

  await forest.getByRole('button', { name: /Hrát tuto mapu/ }).click();
  await expect(page.locator('.screen-head')).toContainText('Skřetí les'); // the loaded map is picked
  expect(errors).toEqual([]);
});

test('a ?data= link opens the game with the file loaded and the map picked', async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto('/?data=spooky-graveyard');
  await expect(page.locator('.screen-head')).toContainText('Strašidelný hřbitov');
  await expect(page.getByRole('button', { name: /Začít/ })).toBeEnabled();
  expect(new URL(page.url()).searchParams.get('data')).toBeNull(); // a reload doesn't load it again
  expect((await readDb(page)).maps.some((m) => m.id === 'lib-spooky-graveyard')).toBe(true);

  // the same link again: everything is already there, nothing to review
  await page.goto('/?data=spooky-graveyard');
  await expect(page.locator('.screen-head')).toContainText('Strašidelný hřbitov');
  await expect(page.locator('.modal-back')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('a file from another site is asked about first; a broken link says so', async ({ page }) => {
  const errors = watchErrors(page);
  const valley = await (await page.request.get('/library/green-valley.json')).text();
  await page.route('https://example.org/**', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: valley, headers: { 'access-control-allow-origin': '*' } }));
  await page.goto('/?data=https://example.org/maps/valley.json');
  await expect(page.getByText(/example\.org/).first()).toBeVisible();
  expect((await readDb(page))?.maps?.some((m) => m.id === 'lib-green-valley') ?? false).toBe(false); // nothing loaded yet
  await page.locator('.modal-foot').getByRole('button', { name: /Nahrát/ }).click();
  await expect(page.locator('.screen-head')).toContainText('Zelené údolí');

  await page.goto('/?data=nothing-here');
  await expect(page.getByRole('status')).toContainText(/nepodařilo stáhnout/);
  expect(errors.filter((e) => !/404|Failed to load resource/.test(e))).toEqual([]);
});
