import { test, expect } from '@playwright/test';
import { watchErrors, openMenu, startGame, readDb, patchSettings } from './helpers.js';
import { gameSize, startScroll } from '../src/game/viewport.js';

// The game really plays (SPEC §4a, §4c): on a phone with taps alone – build a
// tower on a spot, call the wave, survive it – and on a PC with the keyboard
// alone (no mouse): pick a spot with B, build it with Tab + Enter.

/** Where a map point is on the screen right after the game started (the camera at the village). */
async function screenPoint(page, map, p) {
  const box = await page.locator('.game-screen canvas').boundingBox();
  const vp = page.viewportSize();
  const device = await page.locator('.game-screen').evaluate((el) => (el.className.match(/device-(\w+)/) ?? [])[1] ?? 'pc');
  const size = gameSize(vp.width, vp.height, map.world.width, map.world.height, device);
  const start = startScroll(map.centre, size.width, size.height, map.world.width, map.world.height);
  const k = box.width / size.width;
  return { x: box.x + (p.x - start.x) * k, y: box.y + (p.y - start.y) * k };
}

test('a phone plays with taps alone: build a tower, call the wave, win the round', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'taps on a phone');
  test.setTimeout(120_000);
  const errors = watchErrors(page);
  await openMenu(page);
  await patchSettings(page, { tutorialStep: 99 });
  const map = (await readDb(page)).maps.find((m) => m.valid);
  await startGame(page);
  await expect(page.locator('.hud-num').first()).toBeVisible();
  const coins = async () => Number((await page.locator('.hud-num').first().textContent()).replace(/\D+/g, ''));
  const before = await coins();

  // tap building spot 1: its panel opens, the hero walks there; tap the first thing to build
  const spot = map.spots[0];
  const p = await screenPoint(page, map, spot);
  await page.touchscreen.tap(p.x, p.y);
  await expect(page.locator('.build-panel')).toBeVisible();
  const build = page.locator('.build-panel .build-option .btn.primary').first();
  await expect(build).toBeEnabled({ timeout: 20_000 }); // the hero arrived
  await build.tap();
  await expect.poll(coins).toBeLessThan(before);

  // call the wave at double speed and play it
  await page.getByRole('button', { name: 'Rychlost hry: 1×' }).tap();
  await page.getByRole('button', { name: /Připraven/ }).tap();
  await expect(page.locator('.ov-tr')).toContainText('Zbývá nepřátel');
  await expect(page.locator('.ov-tr')).toContainText('Kolo 2/20', { timeout: 90_000 });
  await expect(page.locator('.game-over')).toHaveCount(0); // not lost
  expect(errors).toEqual([]);
});

test('a PC plays with the keyboard alone: B picks a spot, Tab + Enter builds', async ({ page, isMobile }) => {
  test.skip(isMobile, 'keyboards on the PC');
  test.setTimeout(60_000);
  const errors = watchErrors(page);
  await openMenu(page);
  await patchSettings(page, { tutorialStep: 99 });
  await startGame(page);
  await expect(page.locator('.hud-num').first()).toBeVisible();
  const coins = async () => Number((await page.locator('.hud-num').first().textContent()).replace(/\D+/g, ''));
  const before = await coins();

  await page.locator('body').focus();
  await page.keyboard.press('b'); // the Town Hall first
  const panel = page.locator('.build-panel');
  await expect(panel).toHaveAttribute('aria-label', 'Radnice');
  await page.keyboard.press('b'); // building spot 1
  await expect(panel).toHaveAttribute('aria-label', 'Místo na stavbu 1');
  await expect(panel).toBeFocused();
  const build = panel.locator('.build-option .btn.primary').first();
  await expect(build).toBeEnabled({ timeout: 20_000 }); // the hero walked there
  for (let i = 0; i < 6 && !(await build.evaluate((b) => b === document.activeElement)); i++) await page.keyboard.press('Tab');
  await expect(build).toBeFocused();
  await page.keyboard.press('Enter');
  await expect.poll(coins).toBeLessThan(before);

  // walking and attacking keys don't break anything; space calls the wave
  for (const k of ['ArrowLeft', 'ArrowUp', 'd', 's', 'f']) await page.keyboard.press(k);
  await page.locator('body').focus();
  await page.keyboard.press(' ');
  await expect(page.locator('.ov-tr')).toContainText('Zbývá nepřátel');
  expect(errors).toEqual([]);
});
