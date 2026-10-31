import { test, expect } from '@playwright/test';
import { openMenu, startGame } from './helpers.js';

// Smoke crawl: open every studio category and editor, the map painter, waves,
// chronicle, rules and a game clicked all over – no error, warning or stuck step.
test.use({ actionTimeout: 4000 });
test('everything opens and works without errors or warnings', async ({ page }) => {
  test.setTimeout(240_000);
  const problems = [];
  page.on('pageerror', (e) => problems.push(`PAGEERROR ${e.message}`));
  page.on('console', (m) => { if (['error', 'warning'].includes(m.type()) && !/fonts.(googleapis|gstatic)/.test(m.location()?.url ?? '')) problems.push(`${m.type()} ${m.text().slice(0, 300)}`); });
  const step = async (label, fn) => { try { await fn(); } catch (e) { problems.push(`STEP ${label}: ${String(e.message).split('\n')[0]}`); } };
  await openMenu(page);

  // studio: every category, open the first item (or a new one), poke the editor, cancel
  await page.getByRole('button', { name: /Ateliér/ }).click();
  const tabs = page.locator('.screen-head .tabs .tab');
  await expect(tabs.first()).toBeVisible(); // the studio loads when first opened
  const n = await tabs.count();
  for (let i = 0; i < n; i++) {
    const label = (await tabs.nth(i).innerText()).split('\n')[0];
    await step(`tab ${label}`, async () => {
      await tabs.nth(i).click();
      const tiles = page.locator('.screen-body .asset-tile:not(.new)');
      if (await tiles.count()) await tiles.first().click();
      else await page.locator('.screen-body .asset-tile.new').click();
      await expect(page.locator('.modal')).toBeVisible();
      // number fields: type something odd
      const nums = page.locator('.modal input[type=number]');
      if (await nums.count()) { await nums.first().fill(''); await nums.first().fill('-5'); }
      // animation kinds
      const chips = page.locator('.anim-editor .btn.chip');
      for (let k = 0; k < await chips.count(); k++) await chips.nth(k).click();
      await page.locator('.modal-foot').getByRole('button', { name: 'Zrušit' }).click({ timeout: 3000 });
      await expect(page.locator('.modal')).toHaveCount(0);
    });
  }
  // a brand-new enemy saved with no picture
  await step('new enemy', async () => {
    await page.getByRole('button', { name: /Nepřátelé/ }).click();
    await page.locator('.screen-body .asset-tile.new').click();
    await page.locator('.modal input[type=text]').first().fill('Testík');
    await page.locator('.modal-foot').getByRole('button', { name: /Uložit/ }).click();
    await expect(page.locator('.asset-tile', { hasText: 'Testík' })).toBeVisible();
  });
  await step('themes editor', async () => {
    await page.getByRole('button', { name: /Témata/ }).click();
    await expect(page.locator('.modal')).toBeVisible();
    await page.keyboard.press('Escape');
  });
  await page.getByRole('button', { name: /←/ }).click();

  // maps: painter modes, waves, robot
  await page.getByRole('button', { name: /Mapy/ }).click();
  await step('painter', async () => {
    await page.locator('.screen-body .asset-tile').first().click();
    for (const m of [/Kreslit|🖌️/, /📍/, /🧱/]) await page.getByRole('button', { name: m }).first().click();
    const c = page.locator('canvas').first();
    const b = await c.boundingBox();
    await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2);
    await page.getByRole('button', { name: /Zrušit|←/ }).first().click();
  });
  await step('new blank map', async () => {
    await page.getByRole('button', { name: /←/ }).click().catch(() => {});
    await page.getByRole('button', { name: /Mapy/ }).click().catch(() => {});
    await page.getByRole('button', { name: /Nová prázdná|prázdn/ }).click();
    await page.waitForTimeout(500);
    await page.getByRole('button', { name: /Zrušit/ }).first().click();
  });
  await step('waves', async () => {
    await page.getByTitle('Vlny').first().click();
    await page.locator('.screen-body .sketch-card b').nth(1).click();
    await page.getByRole('button', { name: /Přidat kolo|\+ / }).last().click();
    await page.getByRole('button', { name: 'Zrušit' }).first().click();
  });
  await page.goto('/');
  await expect(page.getByRole('button', { name: /Hrát/ })).toBeVisible();

  // chronicle, rules (change + reset), play with every difficulty quickly
  await step('chronicle', async () => {
    await page.getByRole('button', { name: /Kronika/ }).click();
    const chips = page.locator('.chronicle .btn.chip');
    for (let k = 0; k < await chips.count(); k++) await chips.nth(k).click();
    await page.getByRole('button', { name: /←/ }).click();
  });
  await step('rules', async () => {
    await page.getByRole('button', { name: /Pravidla/ }).click();
    const nums = page.locator('.screen-body input[type=number]');
    await nums.first().fill('');
    await nums.nth(1).fill('9999');
    await page.getByRole('button', { name: /Uložit/ }).click();
    await page.getByRole('button', { name: /←/ }).click();
  });

  await step('game', async () => {
    await startGame(page);
    const box = await page.locator('.game-screen canvas').boundingBox();
    // click all over the map: spots, roads, the town hall
    for (let i = 0; i < 25; i++) await page.mouse.click(box.x + box.width * ((i * 37) % 100) / 100, box.y + box.height * ((i * 53) % 100) / 100);
    await page.keyboard.press('1'); await page.keyboard.press('2'); await page.keyboard.press('3');
    await page.keyboard.press('i'); await page.keyboard.press('i');
    await page.keyboard.press('p'); await page.keyboard.press('p');
    // a click above may have hit 🎒 – on a phone the backpack then covers everything: close it
    await page.keyboard.press('Escape');
    await expect(page.locator('.backpack')).toHaveCount(0);
    await page.getByTitle(/Rychlost|2×|1×/).first().click().catch(() => {});
    await page.waitForTimeout(4000);
    await page.getByTitle(/Kronika/).first().click();
    await page.keyboard.press('Escape');
    // exit and come back: a second game
    await page.getByTitle(/Konec|Odejít|✕/).first().click().catch(() => {});
    await page.getByTestId('quit-yes').click({ timeout: 3000 }).catch(() => {}); // "End the game?"
  });
  expect([...new Set(problems)]).toEqual([]);
});
