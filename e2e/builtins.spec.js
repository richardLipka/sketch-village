import { test, expect } from '@playwright/test';
import { watchErrors, openMenu, startGame, readDb, writeDb } from './helpers.js';

// The game's own pictures – the default arrow, magic bolt, catapult stone and
// the built-in surfaces – are in the studio (SPEC §3.2): shown with the game's
// picture, a kid can draw over it or replace it, and they can't be deleted.
test.skip(({ isMobile }) => isMobile, 'the studio is checked on the PC');

const PERMANENT = ['arrow', 'magicBolt', 'catapultStone', 'grass', 'meadow', 'dirt', 'sand', 'cobble', 'stone', 'water', 'snow'];

async function openStudioTab(page, tab) {
  await page.getByRole('button', { name: /Ateliér/ }).click();
  await page.getByRole('button', { name: new RegExp(tab) }).first().click();
}

test('arrows: the game’s pictures are in the studio, can be drawn over, never deleted', async ({ page }) => {
  const errors = watchErrors(page);
  await openMenu(page);
  await openStudioTab(page, 'Šípy');
  for (const name of ['Šíp', 'Kouzelná střela', 'Kámen z katapultu']) {
    const tile = page.locator('.asset-tile', { hasText: `⭐ ${name}` });
    await expect(tile.locator('img')).toHaveAttribute('src', /^data:image\/png/); // the game's picture
  }
  const arrowTile = page.locator('.asset-tile', { hasText: '⭐ Šíp' });
  const gamePicture = await arrowTile.locator('img').getAttribute('src');

  await arrowTile.click();
  const modal = page.locator('.modal').first();
  await expect(modal.getByTestId('permanent-note')).toBeVisible();
  await expect(modal.getByRole('button', { name: /Smazat/ })).toHaveCount(0); // no delete
  await expect(modal.getByTestId('game-picture')).toBeVisible();

  // draw over the game's arrow: the pad starts from it
  await modal.locator('.slot').first().getByTitle(/Nakreslit|Upravit kreslením/).click();
  const pad = page.locator('.modal').last().locator('canvas').last();
  const box = await pad.boundingBox();
  await page.mouse.move(box.x + box.width * 0.2, box.y + box.height * 0.8);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.8, box.y + box.height * 0.2, { steps: 8 });
  await page.mouse.up();
  await page.locator('.modal').last().getByRole('button', { name: /Hotovo/ }).click();
  await expect(modal.getByTestId('game-picture')).toHaveCount(0);
  await expect(modal.getByTitle('Vrátit obrázek hry')).toBeVisible(); // ✕ brings the game's one back
  await modal.getByRole('button', { name: /Uložit/ }).click();

  const drawn = await arrowTile.locator('img').getAttribute('src');
  expect(drawn).not.toBe(gamePicture);
  const stored = (await readDb(page)).assets.find((a) => a.id === 'arrow');
  expect(stored.images[0]).toBe(drawn);
  expect(stored.builtIn).toBe(true);

  // a game with the drawn arrow runs
  await page.getByRole('button', { name: /←/ }).click();
  await startGame(page);
  await page.waitForTimeout(1500);
  expect(errors).toEqual([]);
});

test('surfaces: a photo replaces the game’s water – in the studio and the map editor', async ({ page }) => {
  const errors = watchErrors(page);
  await openMenu(page);
  await openStudioTab(page, 'Povrchy');
  await expect(page.locator('.asset-tile', { hasText: '⭐' })).toHaveCount(8);
  await page.locator('.asset-tile', { hasText: '⭐ Voda' }).click();
  const modal = page.locator('.modal').first();
  await expect(modal.getByRole('button', { name: /Smazat/ })).toHaveCount(0);

  // a "photo" of a blue carpet
  const png = await page.evaluate(async () => {
    const c = document.createElement('canvas');
    c.width = c.height = 200;
    const g = c.getContext('2d');
    g.fillStyle = '#1d4ed8'; g.fillRect(0, 0, 200, 200);
    g.fillStyle = '#facc15'; g.fillRect(40, 40, 40, 40);
    return c.toDataURL('image/png').split(',')[1];
  });
  await modal.locator('.slot input[type=file]').first().setInputFiles({ name: 'carpet.png', mimeType: 'image/png', buffer: Buffer.from(png, 'base64') });
  await page.getByRole('button', { name: /Oříznout/ }).click();
  await expect(modal.getByTitle('Vrátit obrázek hry')).toBeVisible();
  await modal.getByRole('button', { name: /Uložit/ }).click();
  const water = (await readDb(page)).assets.find((a) => a.id === 'water');
  expect(water.images[0]).toMatch(/^data:image\//);

  // the map editor's surface list shows our water
  await page.getByRole('button', { name: /←/ }).click();
  await page.getByRole('button', { name: /Mapy/ }).click();
  await page.locator('.screen-body .asset-tile').first().click();
  await page.getByRole('button', { name: /Povrch/ }).click();
  const row = page.locator('.terrain-row').first();
  await row.locator('select').selectOption('water');
  await expect(row.locator('img.tex-swatch')).toHaveAttribute('src', water.images[0]);
  expect(errors).toEqual([]);
});

test('they are never deleted: not by the studio, not by a stored game without them', async ({ page }) => {
  const errors = watchErrors(page);
  await openMenu(page);
  const db = await readDb(page);
  for (const id of PERMANENT) expect(db.assets.find((a) => a.id === id)?.builtIn).toBe(true);

  // a stored game that lost them (an old or edited file): they come back after a reload
  const arrow = { ...db.assets.find((a) => a.id === 'arrow'), images: ['data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='] };
  await writeDb(page, { ...db, assets: [...db.assets.filter((a) => !PERMANENT.includes(a.id)), arrow] });
  await page.reload();
  await expect(page.getByRole('button', { name: /Hrát/ })).toBeVisible();
  const back = await readDb(page);
  for (const id of PERMANENT) expect(back.assets.find((a) => a.id === id)?.builtIn).toBe(true);
  expect(back.assets.find((a) => a.id === 'arrow').images).toEqual(arrow.images); // the kid's picture kept

  // "delete all of this kind" keeps them, only their pictures go back to the game's
  await page.getByRole('button', { name: /Uložit a nahrát/ }).click();
  await page.locator('select').filter({ has: page.locator('option[value=projectile]') }).selectOption('projectile');
  page.once('dialog', (d) => d.accept());
  await page.getByRole('button', { name: 'Smazat druh' }).click();
  await expect.poll(async () => (await readDb(page)).assets.find((a) => a.id === 'arrow')?.images ?? 'gone').toEqual([]);
  for (const id of PERMANENT) expect((await readDb(page)).assets.some((a) => a.id === id)).toBe(true);
  expect(errors).toEqual([]);
});
