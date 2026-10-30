import { test, expect } from '@playwright/test';
import { watchErrors, openMenu, startGame } from './helpers.js';

// GUI icons, list search, one-per-line lists on phones, projectile / soldier
// choices in the building editor (SPEC §4b, §7.1, §12b).
test.use({ permissions: ['clipboard-read', 'clipboard-write'] });

async function studio(page, tab) {
  await page.getByRole('button', { name: /Ateliér/ }).click();
  await page.getByRole('button', { name: tab }).click();
}

test('lists can be searched by name and description', async ({ page }) => {
  const errors = watchErrors(page);
  await openMenu(page);
  await studio(page, /Nepřátelé/);
  const tiles = page.locator('.screen-body .asset-tile:not(.new)');
  const all = await tiles.count();
  await page.getByRole('searchbox').fill('skret'); // without the accent
  await expect(tiles.filter({ hasText: 'Skřet' })).toHaveCount(1);
  expect(await tiles.count()).toBeLessThan(all); // only those whose name or legend says goblin
  await page.getByRole('searchbox').fill('kolace'); // from the goblin's legend: it steals cakes
  await expect(tiles).toHaveCount(1);
  await expect(tiles.first()).toContainText('Skřet');
  await page.getByTitle('Smazat hledání').click();
  await expect(tiles).toHaveCount(all);

  // a description written in the editor is found too
  await tiles.filter({ hasText: 'Vlk' }).click();
  await page.getByLabel('Popis').fill('rychlý šedý lovec');
  await page.locator('.modal-foot').getByRole('button', { name: /Uložit/ }).click();
  await page.getByRole('searchbox').fill('sedy lovec');
  await expect(tiles).toHaveCount(1);
  await expect(tiles.first()).toContainText('Vlk');

  // the chronicle has its own search
  await page.getByRole('button', { name: /←/ }).click();
  await page.getByRole('button', { name: /Kronika/ }).click();
  const cards = page.locator('.chronicle-card');
  const allCards = await cards.count();
  await page.getByRole('searchbox').fill('drak');
  await expect(cards.filter({ hasText: 'Drak' }).first()).toBeVisible();
  expect(await cards.count()).toBeLessThan(allCards);
  expect(errors).toEqual([]);
});

test('phone: every list shows one thing per line', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'phone layout');
  await openMenu(page);
  await studio(page, /Nepřátelé/);
  const boxes = await page.locator('.screen-body .asset-tile').evaluateAll((els) => els.map((e) => e.getBoundingClientRect()).map((r) => ({ x: Math.round(r.left), w: Math.round(r.width), y: Math.round(r.top) })));
  expect(boxes.length).toBeGreaterThan(3);
  expect(new Set(boxes.map((b) => b.x)).size).toBe(1); // all start at the same place
  for (let i = 1; i < boxes.length; i++) expect(boxes[i].y).toBeGreaterThan(boxes[i - 1].y); // one under another
  // a tap on the middle of a line opens it
  await page.locator('.screen-body .asset-tile:not(.new)').first().click();
  await expect(page.locator('.modal')).toBeVisible();
});

test('GUI icons: a fixed set to draw – a drawn heart shows in the game', async ({ page, isMobile }) => {
  test.skip(isMobile, 'once is enough');
  const errors = watchErrors(page);
  await openMenu(page);
  await studio(page, /Ikony/);
  await expect(page.locator('.screen-body .asset-tile.new')).toHaveCount(0); // nothing to add…
  await page.locator('.screen-body .asset-tile', { hasText: 'Srdce' }).click();
  await expect(page.locator('.modal-foot').getByRole('button', { name: /Smazat/ })).toHaveCount(0); // …or delete
  // draw it: paste a red heart-ish blob, crop, keep
  await page.evaluate(async () => {
    const c = document.createElement('canvas');
    c.width = c.height = 120;
    const g = c.getContext('2d');
    g.fillStyle = '#fff'; g.fillRect(0, 0, 120, 120);
    g.fillStyle = '#d00'; g.beginPath(); g.arc(60, 60, 40, 0, Math.PI * 2); g.fill();
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': await new Promise((r) => c.toBlob(r, 'image/png')) })]);
  });
  await page.locator('.slot').first().getByTitle('Vložit obrázek ze schránky').click();
  await page.getByRole('button', { name: /Oříznout/ }).click();
  await page.getByRole('button', { name: /Hotovo/ }).last().click();
  await page.locator('.modal-foot').getByRole('button', { name: /Uložit/ }).click();
  await page.getByRole('button', { name: /←/ }).click();
  await startGame(page);
  await expect(page.locator('.hearts img.ui-icon').first()).toBeVisible();
  expect(await page.locator('.hearts img.ui-icon').count()).toBe(5); // five lives, all drawn
  expect(errors).toEqual([]);
});

test('building editor: projectile for shooters, area damage, soldier kind per castle level', async ({ page, isMobile }) => {
  test.skip(isMobile, 'once is enough');
  await openMenu(page);
  await studio(page, /Budovy/);
  await page.locator('.screen-body .asset-tile', { hasText: 'Věž' }).click();
  await expect(page.locator('.projectile-pick')).toBeVisible();
  await expect(page.locator('.projectile-pick [aria-checked="true"]')).toContainText('šíp'); // the default arrow
  await expect(page.getByRole('row', { name: /Plošné poškození/ })).toBeVisible();
  await page.locator('.modal-foot').getByRole('button', { name: 'Zrušit' }).click();

  await page.locator('.screen-body .asset-tile', { hasText: 'Hrad' }).click();
  const kinds = page.getByRole('combobox', { name: /Kdo bojuje/ });
  await expect(kinds).toHaveCount(3); // one per level
  await kinds.nth(1).selectOption({ label: 'Skřet' });
  await page.locator('.modal-foot').getByRole('button', { name: /Uložit/ }).click();
  await page.locator('.screen-body .asset-tile', { hasText: 'Hrad' }).click();
  await expect(page.getByRole('combobox', { name: /Kdo bojuje/ }).nth(1)).toHaveValue('goblin');
});
