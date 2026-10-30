import { test, expect } from '@playwright/test';
import { watchErrors, openMenu, startGame } from './helpers.js';

// Fixed heads, scrolling content (SPEC §12a): on every screen with a list and
// in the dialogs, shop and backpack only the content scrolls – the title,
// tabs and main buttons stay where they are.

/** Scroll `body` to its end; the `head` must not move and the page itself must not scroll. */
async function checkFixedHead(page, head, body) {
  const before = await page.locator(head).first().boundingBox();
  const scroll = await page.locator(body).first().evaluate((el) => {
    const can = el.scrollHeight > el.clientHeight + 4;
    el.scrollTop = el.scrollHeight;
    return { can, top: el.scrollTop };
  });
  const after = await page.locator(head).first().boundingBox();
  expect(after.y).toBeCloseTo(before.y, 0);
  expect(after.y).toBeGreaterThanOrEqual(0);
  const pageScrolls = await page.evaluate(() => document.scrollingElement.scrollHeight > innerHeight + 1);
  expect(pageScrolls).toBe(false);
  return scroll;
}

test('menu screens: the head stays, only the list scrolls', async ({ page }) => {
  const errors = watchErrors(page);
  await openMenu(page);
  const screens = [[/Ateliér/, 'Ateliér'], [/Mapy/, 'Mapy'], [/Kronika/, 'Kronika'], [/Pravidla/, 'Pravidla'], [/Uložit a nahrát/, 'Uložit'], [/Hrát/, 'Hrát']];
  let scrolled = 0;
  for (const [button] of screens) {
    await page.getByRole('button', { name: button }).click();
    await expect(page.locator('.screen-head h1')).toBeVisible();
    // the chronicle scrolls its monster list, the others the screen body
    const body = (await page.locator('.chronicle-grid').count()) ? '.chronicle-grid' : '.screen-body';
    const { can, top } = await checkFixedHead(page, '.screen-head h1', body);
    if (can) { expect(top).toBeGreaterThan(0); scrolled++; }
    await expect(page.getByRole('button', { name: /←/ })).toBeInViewport();
    await page.getByRole('button', { name: /←/ }).click();
  }
  expect(scrolled).toBeGreaterThanOrEqual(3); // rules, chronicle, studio… have more than one screen of content
  expect(errors).toEqual([]);
});

test('component editor: title and Save stay in view while the content scrolls', async ({ page }) => {
  await openMenu(page);
  await page.getByRole('button', { name: /Ateliér/ }).click();
  await page.getByRole('button', { name: /Nepřátelé/ }).click();
  await page.locator('.asset-tile', { hasText: 'Skřet' }).click();
  const { can } = await checkFixedHead(page, '.modal-head h2', '.modal-body');
  expect(can).toBe(true);
  await expect(page.locator('.modal-head h2')).toBeInViewport();
  await expect(page.locator('.modal-foot').getByRole('button', { name: /Uložit/ })).toBeInViewport();
});

test('backpack: closes after a few clicks into the game, not after one', async ({ page, isMobile }) => {
  test.skip(isMobile, 'on a phone the backpack fills the screen – there is no game to click beside it');
  const errors = watchErrors(page);
  await openMenu(page);
  await startGame(page);
  const backpack = page.locator('.backpack');
  await page.getByTitle('Batoh (I)').click();
  await expect(backpack).toBeVisible();
  const canvas = page.locator('.game-screen canvas');
  const box = await canvas.boundingBox();
  const map = (dx) => page.mouse.click(box.x + box.width / 2 + dx, box.y + box.height * 0.3);
  await map(-40);
  await map(40);
  await expect(backpack).toBeVisible(); // two clicks into the game: still open
  await backpack.locator('.eq-bag').click(); // a click inside starts over
  await map(-40);
  await map(40);
  await expect(backpack).toBeVisible();
  await map(0); // the third click into the game closes it
  await expect(backpack).toBeHidden();
  expect(errors).toEqual([]);
});

test('backpack and shop: only the items scroll', async ({ page, isMobile }) => {
  await openMenu(page);
  await startGame(page);
  await page.getByTitle('Batoh (I)').click();
  await expect(page.locator('.backpack-body')).toBeVisible();
  await checkFixedHead(page, '.backpack > .row', isMobile ? '.backpack-body .eq-bag' : '.backpack-body');
  await page.locator('.backpack > .row').getByTitle('Hotovo').click();

  // the Town Hall is in the middle of the map: select it, open its shop
  const box = await page.locator('.game-screen canvas').boundingBox();
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await page.getByRole('button', { name: /Obchod a vylepšení hrdiny/ }).click();
  await expect(page.locator('.shop-overlay')).toBeVisible();
  const { can } = await checkFixedHead(page, '.shop-head', '.shop-body');
  if (isMobile) expect(can).toBe(true); // a phone can't show the whole shop at once
  await expect(page.locator('.shop-head')).toBeInViewport();
});
