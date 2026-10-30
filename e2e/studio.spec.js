import { test, expect } from '@playwright/test';
import { watchErrors, openMenu, startGame } from './helpers.js';

// The studio's new inputs: pictures pasted from the clipboard (SPEC §3.3) and
// monster sounds recorded with the microphone (SPEC §3.2b). Chrome's fake
// microphone plays a beep, so a real recording is made and trimmed.
test.use({
  launchOptions: { args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'] },
  permissions: ['clipboard-read', 'clipboard-write', 'microphone'],
});
test.skip(({ isMobile }) => isMobile, 'the studio is checked on the PC');

async function openGoblin(page) {
  await openMenu(page);
  await page.getByRole('button', { name: /Ateliér/ }).click();
  await page.getByRole('button', { name: /Nepřátelé/ }).click();
  await page.locator('.asset-tile', { hasText: 'Skřet' }).click();
  await expect(page.locator('.modal h2').first()).toContainText('Skřet');
}

test('a picture from the clipboard goes to cropping like a photo', async ({ page }) => {
  const errors = watchErrors(page);
  await openGoblin(page);
  await page.evaluate(async () => {
    const c = document.createElement('canvas');
    c.width = c.height = 120;
    const g = c.getContext('2d');
    g.fillStyle = '#c00';
    g.fillRect(20, 20, 80, 80);
    const blob = await new Promise((r) => c.toBlob(r, 'image/png'));
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
  });
  await page.locator('.slot').first().getByTitle('Vložit obrázek ze schránky').click();
  await expect(page.locator('.reactEasyCrop_Container')).toBeVisible();
  expect(errors).toEqual([]);
});

test('Ctrl+V on the drawing pad, and the paste box when the clipboard has no picture', async ({ page }) => {
  await openGoblin(page);
  await page.evaluate(() => navigator.clipboard.writeText('just text'));
  await page.locator('.slot').first().getByTitle('Vložit obrázek ze schránky').click();
  await expect(page.getByText('Ve schránce není obrázek')).toBeVisible();
  await page.locator('.modal').last().getByRole('button', { name: 'Zrušit' }).click();

  await page.locator('.slot').first().getByTitle(/Upravit kreslením|Nakreslit/).click();
  await page.evaluate(async () => {
    const c = document.createElement('canvas');
    c.width = c.height = 60;
    c.getContext('2d').fillRect(0, 0, 30, 30);
    const blob = await new Promise((r) => c.toBlob(r, 'image/png'));
    const dt = new DataTransfer();
    dt.items.add(new File([blob], 'p.png', { type: 'image/png' }));
    document.body.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }));
  });
  await expect(page.locator('.reactEasyCrop_Container')).toBeVisible();
});

test('record a monster sound, trim it, keep it, and the game still runs', async ({ page }) => {
  const errors = watchErrors(page);
  await openGoblin(page);
  const growl = page.locator('.sound-row').first();
  await growl.getByTitle('Nahrát mikrofonem').click();
  await expect(growl.locator('.rec-dot')).toBeVisible();
  // stops by itself after 3 s, then the silence around is cut
  await expect(growl.locator('canvas.waveform')).toBeVisible({ timeout: 10_000 });
  const [from, to] = await growl.locator('input[type=range]').evaluateAll((els) => els.map((e) => Number(e.value)));
  expect(to).toBeGreaterThan(from);
  expect(to - from).toBeLessThanOrEqual(3);
  await growl.getByTitle('Přehrát').click();
  await page.locator('.modal').getByRole('button', { name: /Uložit/ }).last().click();

  // still there after reopening
  await page.locator('.asset-tile', { hasText: 'Skřet' }).click();
  await expect(page.locator('.sound-row').first().locator('canvas.waveform')).toBeVisible();
  await page.locator('.modal').getByRole('button', { name: 'Zrušit' }).last().click();

  // a game with the recorded monster starts without trouble
  await page.getByRole('button', { name: /←/ }).click();
  await startGame(page);
  await page.waitForTimeout(1500);
  expect(errors).toEqual([]);
});

test('Escape closes only the top dialog', async ({ page }) => {
  await openGoblin(page);
  await page.evaluate(() => navigator.clipboard.writeText('just text'));
  await page.locator('.slot').first().getByTitle('Vložit obrázek ze schránky').click();
  await expect(page.getByText('Vložit obrázek', { exact: false }).first()).toBeVisible();
  await expect(page.locator('.modal')).toHaveCount(2);
  await page.keyboard.press('Escape');
  await expect(page.locator('.modal')).toHaveCount(1);
  await expect(page.locator('.modal h2').first()).toContainText('Skřet');
  await page.keyboard.press('Escape');
  await expect(page.locator('.modal')).toHaveCount(0);
});
