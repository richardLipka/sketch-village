import { test, expect } from '@playwright/test';
import { watchErrors, openMenu, startGame, patchSettings } from './helpers.js';

test('every menu screen opens without errors', async ({ page }) => {
  const errors = watchErrors(page);
  await openMenu(page);
  for (const [button, heading] of [
    [/Ateliér/, 'Ateliér – součásti hry'],
    [/Mapy/, 'Mapy'],
    [/Kronika/, 'Kronika'],
    [/Pravidla/, 'Pravidla hry'],
    [/Uložit a nahrát/, 'Uložit a nahrát'],
  ]) {
    await page.getByRole('button', { name: button }).click();
    await expect(page.getByRole('heading', { name: heading, exact: false }).first()).toBeVisible();
    await page.getByRole('button', { name: /←/ }).click();
    await expect(page.getByRole('button', { name: /Hrát/ })).toBeVisible();
  }
  expect(errors).toEqual([]);
});

test('a game starts, runs and pauses', async ({ page }) => {
  const errors = watchErrors(page);
  await openMenu(page);
  await startGame(page);
  await page.waitForTimeout(2500);
  const pause = page.getByTitle('Pauza (P)');
  await pause.click();
  await expect(pause).toHaveClass(/active/);
  expect(errors).toEqual([]);
});

test('import: new things are added, a changed one is reviewed', async ({ page }) => {
  const errors = watchErrors(page);
  await openMenu(page);
  await page.getByRole('button', { name: /Uložit a nahrát/ }).click();
  const file = {
    format: 'sketch-village', version: 3, exportedAt: new Date().toISOString(), settings: {},
    assets: [], maps: [], rules: [],
    themes: [
      { id: 'someone-elses-id', icon: '🏜️', name: { cs: 'Pláně', en: 'Plains' } }, // same name, another icon
      { id: 'dragon-hills', icon: '🐉', name: 'Dračí hory' }, // new
    ],
  };
  await page.locator('input[type=file]').setInputFiles({ name: 'class.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(file)) });
  const review = page.locator('.modal');
  await expect(review.getByText('Co se změnilo?')).toBeVisible();
  await expect(review.getByText('icon', { exact: true })).toBeVisible();
  await review.getByRole('button', { name: /Nechat moje/ }).click();
  await expect(page.locator('.toast:not(.toast-top)')).toContainText('1 přidáno, 0 aktualizováno, 1 necháno');
  expect(errors).toEqual([]);
});

test('backup reminder: shown for old unsaved changes, "later" hides it, a backup clears it', async ({ page }) => {
  const errors = watchErrors(page);
  await openMenu(page);
  const reminder = page.locator('.backup-reminder');
  await expect(reminder).toHaveCount(0);

  await patchSettings(page, { unsavedSince: new Date(Date.now() - 3 * 864e5).toISOString(), backupSnoozeUntil: null });
  await expect(reminder).toContainText('před 3 dny');
  await reminder.getByRole('button', { name: 'Později' }).click();
  await expect(reminder).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole('button', { name: /Hrát/ })).toBeVisible();
  await expect(reminder).toHaveCount(0);

  await patchSettings(page, { backupSnoozeUntil: null });
  const downloading = page.waitForEvent('download');
  await reminder.getByRole('button', { name: /Stáhnout zálohu/ }).click();
  const chunks = [];
  for await (const c of await (await downloading).createReadStream()) chunks.push(c);
  const file = JSON.parse(Buffer.concat(chunks).toString());
  expect(file.format).toBe('sketch-village');
  expect(file.assets.length).toBeGreaterThan(10);
  await expect(reminder).toHaveCount(0);
  await page.getByRole('button', { name: /Uložit a nahrát/ }).click();
  await expect(page.getByText(/Poslední záloha/)).toBeVisible();
  expect(errors).toEqual([]);
});

test('difficulty: the choice is kept for the next game', async ({ page }) => {
  await openMenu(page);
  await page.getByRole('button', { name: /Hrát/ }).click();
  const easy = page.getByRole('radio', { name: /Lehká/ });
  await expect(page.getByRole('radio', { name: /Normální/ })).toHaveAttribute('aria-checked', 'true');
  await easy.click();
  await expect(easy).toHaveAttribute('aria-checked', 'true');
  await page.reload();
  await page.getByRole('button', { name: /Hrát/ }).click();
  await expect(page.getByRole('radio', { name: /Lehká/ })).toHaveAttribute('aria-checked', 'true');
});

test('the robot plays a map in the wave editor and says how it went', async ({ page }) => {
  test.setTimeout(120_000);
  const errors = watchErrors(page);
  await openMenu(page);
  await page.getByRole('button', { name: /Mapy/ }).click();
  await page.getByTitle('Vlny').first().click();
  await page.getByRole('button', { name: /Zkusit/ }).click();
  await expect(page.locator('.map-test-report .verdict')).toContainText(/vyhrál|Akorát|těžké|lehké/, { timeout: 90_000 });
  await expect(page.locator('.map-test-round')).toHaveCount(20);
  await expect(page.locator('.round-test').first()).toBeVisible(); // the rounds below show the robot's times
  expect(errors).toEqual([]);
});

test('sharing one map downloads a file with just that map and what it uses', async ({ page }) => {
  await openMenu(page);
  await page.getByRole('button', { name: /Mapy/ }).click();
  const downloading = page.waitForEvent('download');
  await page.getByTitle(/Sdílet mapu/).first().click();
  const download = await downloading;
  expect(download.suggestedFilename()).toMatch(/^map-.*\.json$/);
  const chunks = [];
  for await (const c of await download.createReadStream()) chunks.push(c);
  const file = JSON.parse(Buffer.concat(chunks).toString());
  expect(file.format).toBe('sketch-village');
  expect(file.maps).toHaveLength(1);
  expect(file.assets.every((a) => a.category === 'enemy' || a.category === 'decoration' || a.category === 'texture')).toBe(true);
  expect(file.assets.length).toBeGreaterThan(0); // the enemies of its waves
});

test('keyboard: I opens and closes the backpack; no shortcuts behind an open dialog', async ({ page, isMobile }) => {
  test.skip(isMobile, 'keyboard shortcuts are for the PC');
  const errors = watchErrors(page);
  await openMenu(page);
  await startGame(page);
  await expect(page.getByTitle('Batoh (I)')).toBeVisible(); // the controls are there
  await page.keyboard.press('i');
  await expect(page.locator('.backpack')).toBeVisible();
  await page.keyboard.press('I');
  await expect(page.locator('.backpack')).toBeHidden();

  // the chronicle pauses the game; P behind it must not resume it, I must not open the backpack
  const pause = page.getByTitle('Pauza (P)');
  await page.getByTitle(/Kronika/).first().click();
  await expect(page.locator('.modal')).toBeVisible();
  await page.keyboard.press('p');
  await page.keyboard.press('i');
  await page.keyboard.press('Escape');
  await expect(page.locator('.modal')).toHaveCount(0);
  await expect(page.locator('.backpack')).toBeHidden();
  await expect(pause).not.toHaveClass(/active/); // closing the chronicle resumed it, as before
  await page.keyboard.press('p');
  await expect(pause).toHaveClass(/active/);
  expect(errors).toEqual([]);
});
