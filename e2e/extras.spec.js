import { test, expect } from '@playwright/test';
import { watchErrors, openMenu, startGame, readDb, writeDb } from './helpers.js';

// Saving and continuing a game (SPEC §11b), 3× speed, the hero's ability (§6.4),
// quiet music, the chronicle's collection (§9a), back to the game's own
// components (§13d).

/** A key of the browser's IndexedDB store (the saved game lives beside the save file). */
const readKey = (page, key) => page.evaluate(async (k) => {
  const db = await new Promise((ok) => { const r = indexedDB.open('keyval-store'); r.onsuccess = () => ok(r.result); });
  const v = await new Promise((ok) => { const r = db.transaction('keyval').objectStore('keyval').get(k); r.onsuccess = () => ok(r.result ?? null); });
  db.close();
  return v;
}, key);

async function clickExit(page, isMobile) {
  if (isMobile) await page.getByTitle('Další', { exact: true }).click();
  await page.getByTitle('Konec', { exact: true }).click();
}

test('a game saved on leaving goes on from the play screen; 3× speed, the ability, music, the collection', async ({ page, isMobile }) => {
  test.setTimeout(120_000);
  const errors = watchErrors(page);
  await openMenu(page);
  await startGame(page);

  // speed 1× → 2× → 3× → 1×
  for (const [from, to] of [['1×', '2×'], ['2×', '3×'], ['3×', '1×']]) {
    await page.getByRole('button', { name: `Rychlost hry: ${from}` }).click();
    await expect(page.getByRole('button', { name: `Rychlost hry: ${to}` })).toBeVisible();
  }

  // the hero's ability: Lara's arrow rain, with nothing in reach it isn't wasted
  const ability = page.getByTestId('ability');
  await expect(ability).toHaveAttribute('aria-label', 'Déšť šípů (E)');
  if (!isMobile) {
    await page.keyboard.press('e');
    await expect(page.locator('.sr-live')).toHaveText('Žádná příšera v dosahu.');
  }

  // quiet music on and off (a setting)
  if (isMobile) await page.getByTitle('Další', { exact: true }).click();
  await page.getByRole('button', { name: 'Tichá hudba' }).click();
  await expect.poll(async () => (await readDb(page)).settings.music).toBe(true);
  if (isMobile) await page.getByTitle('Další', { exact: true }).click();
  await page.getByRole('button', { name: 'Tichá hudba' }).click();
  await expect.poll(async () => (await readDb(page)).settings.music).toBe(false);

  // the wave comes; goblins are met
  await page.getByRole('button', { name: /Připraven/ }).click();
  await expect(page.locator('.ov-tr')).toContainText('Zbývá nepřátel');
  await expect.poll(async () => (await readDb(page)).settings.metMonsters ?? [], { timeout: 20_000 }).toContain('goblin');

  // leave with saving: the game waits on the play screen, not in the save file
  await clickExit(page, isMobile);
  await expect(page.locator('.quit-ask')).toContainText('Hru můžeš uložit');
  await page.getByTestId('quit-save').click();
  const card = page.getByTestId('saved-game');
  await expect(card).toContainText('kolo 1 z 20');
  const saved = await readKey(page, 'sv:game');
  expect(saved.state.phase).toBe('wave');
  expect(JSON.stringify(await readDb(page))).not.toContain('"sv:game"');
  expect(Object.keys(await readDb(page))).not.toContain('state');

  // continue: the same wave goes on
  await page.getByTestId('continue').click();
  await expect(page.locator('.hud-num').first()).toBeVisible({ timeout: 30_000 });
  await expect(page.locator('.ov-tr')).toContainText('Kolo 1/20');
  await expect(page.locator('.ov-tr')).toContainText('Zbývá nepřátel');

  // the collection in the chronicle: the goblin is met
  await page.getByRole('button', { name: /Kronika/ }).first().click();
  await page.getByTestId('collection-tab').click();
  await expect(page.getByTestId('collection-count')).toContainText(/Potkal\(a\) jsi [1-9]\d* z \d+ příšer/);
  await page.keyboard.press('Escape');

  // ending without saving forgets it
  await clickExit(page, isMobile);
  await page.getByTestId('quit-yes').click();
  await expect(page.getByRole('button', { name: /Začít/ })).toBeVisible();
  await expect(page.getByTestId('saved-game')).toHaveCount(0);
  expect(await readKey(page, 'sv:game')).toBe(null);
  expect(errors).toEqual([]);
});

test('the hero’s ability is picked in the hero editor', async ({ page }) => {
  await openMenu(page);
  await page.getByRole('button', { name: /Ateliér/ }).click();
  await page.getByRole('button', { name: /Hrdinové/ }).click();
  await page.locator('.asset-tile .tile-open').first().click();
  const box = page.locator('.hero-ability');
  await box.getByRole('radio', { name: /Štít/ }).click();
  await expect(box.getByRole('radio', { name: /Štít/ })).toHaveAttribute('aria-checked', 'true');
  await box.getByLabel('⏳ Trvání (s)').fill('8');
  await page.locator('.modal').getByRole('button', { name: /Uložit/ }).last().click();
  await expect.poll(async () => (await readDb(page)).assets.find((a) => a.category === 'hero' && a.ability)?.ability).toMatchObject({ id: 'shield', duration: 8 });
});

test('back to the game’s own components: a fresh game has nothing to do; an extra monster can go', async ({ page }) => {
  const errors = watchErrors(page);
  await openMenu(page);
  await page.getByRole('button', { name: /Uložit a nahrát/ }).click();
  await page.getByTestId('reset-defaults').click();
  await expect(page.getByTestId('reset-nothing')).toBeVisible();
  await page.keyboard.press('Escape');

  // a monster that came in by mistake, and a changed goblin
  const file = await readDb(page);
  const goblin = file.assets.find((a) => a.id === 'goblin');
  file.assets = file.assets.map((a) => (a.id === 'goblin' ? { ...a, stats: { ...a.stats, hp: 999 } } : a));
  file.assets.push({ ...goblin, id: 'oops', name: 'Omylem', builtIn: false });
  await writeDb(page, file);
  await page.reload();
  await page.getByRole('button', { name: /Uložit a nahrát/ }).click();
  await page.getByTestId('reset-defaults').click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toContainText('Navíc – smazat (1)');
  await expect(dialog).toContainText('Změněné – vrátit (1)');
  await dialog.getByTestId('reset-go').click();
  await expect(dialog.getByRole('alert')).toContainText('Opravdu? Smaže se 1, vrátí 1, doplní 0.');
  await dialog.getByTestId('reset-yes').click();
  await expect.poll(async () => (await readDb(page)).assets.some((a) => a.id === 'oops')).toBe(false);
  const after = await readDb(page);
  expect(after.assets.find((a) => a.id === 'goblin').stats.hp).toBe(goblin.stats.hp);
  expect(errors).toEqual([]);
});
