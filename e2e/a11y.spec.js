import fs from 'node:fs';
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { openMenu, startGame, patchSettings, readDb } from './helpers.js';

// Accessibility (SPEC §4c): every screen, editor and dialog – on the PC and on
// a phone held sideways – is checked by axe-core against WCAG 2.1 A and AA,
// and the main ways in work with the keyboard alone.

const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];
const REPORT = process.env.A11Y_REPORT; // a file to write every finding to (no failing), for an audit

async function check(page, name, found) {
  const r = await new AxeBuilder({ page }).withTags(TAGS).analyze();
  for (const v of r.violations) {
    found.push({ screen: name, rule: v.id, impact: v.impact, help: v.help, nodes: v.nodes.slice(0, 6).map((n) => `${n.target.join(' ')} – ${n.failureSummary.replace(/\s+/g, ' ').slice(0, 220)}`), count: v.nodes.length });
  }
}

const back = (page) => page.getByRole('button', { name: /← Zpět/ }).click();
const cancel = (page) => page.getByRole('button', { name: 'Zrušit', exact: true }).first().click();

function verdict(found, name, isMobile) {
  if (REPORT) {
    fs.writeFileSync(`${REPORT}-${name}-${isMobile ? 'phone' : 'pc'}.json`, JSON.stringify(found, null, 2));
    return;
  }
  expect(found, found.map((f) => `${f.screen}: ${f.rule} (${f.count}) ${f.help}\n  ${f.nodes.join('\n  ')}`).join('\n')).toEqual([]);
}

test('the game: every control and dialog passes WCAG 2.1 AA checks', async ({ page, isMobile }) => {
  test.setTimeout(120_000);
  const found = [];
  await openMenu(page);
  await check(page, 'menu', found);
  await page.getByRole('button', { name: /Hrát/ }).click();
  await check(page, 'play setup', found);
  await back(page);

  await patchSettings(page, { tutorialStep: 0 }); // the tips are on screen too
  await startGame(page);
  await expect(page.locator('.hud-num').first()).toBeVisible();
  await check(page, 'game', found);
  // the first tip speaks the device's language: tap on a phone, click with a mouse
  await expect(page.locator('.coach')).toContainText(isMobile ? 'Klepni' : 'Klikni');
  await page.keyboard.press('i');
  await expect(page.locator('.backpack')).toBeVisible();
  await check(page, 'game: backpack', found);
  await page.keyboard.press('Escape');

  // the Town Hall in the middle of the map: its panel and the shop
  const box = await page.locator('.game-screen canvas').boundingBox();
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await expect(page.locator('.build-panel')).toBeVisible();
  await check(page, 'game: town hall panel', found);
  await page.getByRole('button', { name: /Obchod a vylepšení hrdiny/ }).click();
  await expect(page.locator('.shop-overlay')).toBeVisible();
  await check(page, 'game: shop', found);
  await page.locator('.shop-overlay').getByRole('button', { name: 'Hotovo' }).click();

  await page.getByRole('button', { name: /Kronika/ }).first().click();
  await check(page, 'game: chronicle', found);
  await page.keyboard.press('Escape');
  if (isMobile) await page.getByRole('button', { name: 'Další' }).click();
  await page.getByRole('button', { name: /Nápověda/ }).click();
  await expect(page.locator('.game-msg')).toBeVisible();
  await check(page, 'game: help', found);
  if (isMobile) await page.getByRole('button', { name: 'Další' }).click();
  await page.getByRole('button', { name: 'Konec' }).click();
  await check(page, 'game: quit question', found);
  await page.getByTestId('quit-yes').click();
  verdict(found, 'game', isMobile);
});

test('menus, the studio and the editors pass WCAG 2.1 AA checks', async ({ page, isMobile }) => {
  test.setTimeout(150_000);
  const found = [];
  await openMenu(page);

  // studio: every kind's list, the editors of a hero, a monster, a building, a weapon, the drawing pad
  await page.getByRole('button', { name: /Ateliér/ }).click();
  for (const [tab, label] of [[/Hrdinové/, 'hero'], [/Nepřátelé/, 'enemy'], [/Budovy/, 'building'], [/Zbraně/, 'weapon']]) {
    await page.getByRole('button', { name: tab }).click();
    await check(page, `studio: ${label}s`, found);
    await page.locator('.screen-body .asset-tile .tile-open').first().click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await check(page, `studio: ${label} editor`, found);
    if (label === 'hero') {
      await page.locator('.slot').first().getByRole('button', { name: /Nakreslit|Upravit kreslením/ }).click();
      await expect(page.getByRole('dialog')).toHaveCount(2);
      await check(page, 'studio: drawing pad', found);
      await page.keyboard.press('Escape');
    }
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toHaveCount(0);
  }
  await page.getByTestId('studio-load').click();
  await check(page, 'studio: load dialog', found);
  await page.keyboard.press('Escape');
  await back(page);

  // maps, the map editor in every mode, the wave editor
  await page.getByRole('button', { name: /Mapy/ }).click();
  await check(page, 'maps', found);
  await page.locator('.screen-body .asset-tile .tile-open').first().click();
  await check(page, 'map editor: paint', found);
  await page.getByRole('button', { name: /Rozmístit/ }).click();
  await page.getByRole('button', { name: /Ozdoba/ }).click();
  await check(page, 'map editor: decorations', found);
  await page.getByRole('button', { name: /Povrch/ }).click();
  await check(page, 'map editor: terrain', found);
  await cancel(page);
  await page.locator('.asset-tile').first().getByRole('button', { name: /Vlny/ }).click();
  await page.getByRole('button', { name: /Kolo 1$/ }).first().click();
  await check(page, 'wave editor', found);
  await cancel(page);
  await back(page);

  for (const [button, name] of [[/Knihovna/, 'library'], [/Kronika/, 'chronicle'], [/Pravidla/, 'rules'], [/Uložit a nahrát/, 'save & load']]) {
    await page.getByRole('button', { name: button }).click();
    if (name === 'library') await expect(page.locator('.library-entry').first()).toBeVisible();
    await check(page, name, found);
    await back(page);
  }

  // importing: the review of changed things
  const db = await readDb(page);
  const goblin = db.assets.find((a) => a.id === 'goblin');
  const changed = { format: 'sketch-village', version: 3, settings: {}, maps: [], themes: [], assets: [{ ...goblin, stats: { ...goblin.stats, hp: 99 }, updatedAt: new Date().toISOString() }] };
  await page.getByRole('button', { name: /Uložit a nahrát/ }).click();
  await page.getByTestId('data-load').click();
  await page.getByTestId('load-file-input').setInputFiles({ name: 'x.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(changed)) });
  await expect(page.getByRole('dialog')).toBeVisible();
  await check(page, 'import review', found);
  verdict(found, 'screens', isMobile);
});

test('the keyboard alone: open a component, the dialog keeps focus, equip from the backpack', async ({ page, isMobile }) => {
  test.skip(isMobile, 'keyboards are checked on the PC');
  await openMenu(page);
  await page.getByRole('button', { name: /Ateliér/ }).click();
  await page.getByRole('button', { name: /Nepřátelé/ }).click();

  // a tile's name is a button: focus it, Enter opens the editor as a named dialog with the focus inside
  const tile = page.locator('.asset-tile', { hasText: /Goblin/ }).first().locator('.tile-open');
  await tile.focus();
  await page.keyboard.press('Enter');
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await expect(dialog).toHaveAttribute('aria-modal', 'true');
  expect(await dialog.evaluate((d) => document.getElementById(d.getAttribute('aria-labelledby'))?.textContent)).toMatch(/Goblin/);
  expect(await dialog.evaluate((d) => d.contains(document.activeElement))).toBe(true);
  // Tab never leaves it
  for (let i = 0; i < 60; i++) await page.keyboard.press('Tab');
  expect(await dialog.evaluate((d) => d.contains(document.activeElement))).toBe(true);
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(tile).toBeFocused(); // back where it was

  // the backpack: I opens it, an item and a slot are buttons – Enter on an item, Enter on its slot
  await page.getByRole('button', { name: /← Zpět/ }).click();
  await startGame(page);
  await page.keyboard.press('i');
  const item = page.locator('.eq-item').first();
  await expect(item).toBeVisible();
  const itemName = (await item.locator('.eq-name').textContent()).trim();
  await item.focus();
  await page.keyboard.press('Enter');
  await expect(item).toHaveAttribute('aria-pressed', 'true');
  const slot = page.locator('.eq-big[data-drop=right]');
  await slot.focus();
  await page.keyboard.press('Enter');
  await expect(slot).toContainText(itemName);
  // and off again once the 2 s weapon change (game time – slower on a slow machine) is over:
  // Enter on the worn item, then "Take off into the backpack"
  await expect(page.locator('.btn.attack .switching')).toHaveCount(0, { timeout: 20_000 });
  await slot.focus();
  await page.keyboard.press('Enter');
  await page.getByRole('button', { name: /Sundat do batohu/ }).click();
  await expect(page.locator('.eq-bag')).toContainText(itemName);
});
