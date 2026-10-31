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
  await page.locator('.asset-tile', { hasText: /⭐ Goblin / }).click();
  await expect(page.locator('.modal h2').first()).toContainText('Goblin');
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
  await page.locator('.asset-tile', { hasText: /⭐ Goblin / }).click();
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
  await expect(page.locator('.modal h2').first()).toContainText('Goblin');
  await page.keyboard.press('Escape');
  await expect(page.locator('.modal')).toHaveCount(0);
});

// a WAV with a tone in the middle (silence around it)
function wav(freq, secs, rate = 22050) {
  const n = Math.round((secs + 0.6) * rate);
  const b = Buffer.alloc(44 + n * 2);
  b.write('RIFF', 0); b.writeUInt32LE(36 + n * 2, 4); b.write('WAVE', 8); b.write('fmt ', 12);
  b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22); b.writeUInt32LE(rate, 24); b.writeUInt32LE(rate * 2, 28);
  b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34); b.write('data', 36); b.writeUInt32LE(n * 2, 40);
  for (let i = Math.round(0.3 * rate); i < Math.round((0.3 + secs) * rate); i++) b.writeInt16LE(Math.round(12000 * Math.sin((2 * Math.PI * freq * i) / rate)), 44 + i * 2);
  return { name: 'sound.wav', mimeType: 'audio/wav', buffer: b };
}

test('hear the monster sounds as in the game: a little wave with a timeline', async ({ page }) => {
  test.setTimeout(90_000);
  const errors = watchErrors(page);
  await openGoblin(page);
  const rows = page.locator('.sound-row');
  for (const [i, f] of [[0, 220], [1, 440], [2, 130]]) {
    await rows.nth(i).locator('input[type=file]').setInputFiles(wav(f, 0.4));
    await expect(rows.nth(i).locator('canvas.waveform')).toBeVisible();
  }
  // ▶ shows a playhead running over the sound
  await rows.first().getByTitle('Přehrát').click();
  await expect(rows.first().locator('.waveform-box .playhead')).toBeVisible();

  await page.getByRole('button', { name: /Poslechnout jako ve hře/ }).click();
  await expect(page.getByRole('button', { name: /Zastavit/ })).toBeVisible();
  await expect(page.locator('.preview-timeline .mark', { hasText: '👾' })).toHaveCount(8);
  // the wave lasts 16 s; then the button comes back and the timeline tells what was heard
  await expect(page.getByRole('button', { name: /Poslechnout jako ve hře/ })).toBeVisible({ timeout: 25_000 });
  await expect(page.locator('.preview-summary')).toContainText(/z 12 útoků/);
  await expect(page.locator('.preview-summary')).toContainText(/z 8 porážek/);
  const played = await page.locator('.preview-timeline .mark.played').count();
  const skipped = await page.locator('.preview-timeline .mark.skipped').count();
  expect(played).toBeGreaterThan(2);
  expect(skipped).toBeGreaterThan(played); // most hits and some defeats are left out
  expect(errors).toEqual([]);
});

// draw a short stroke on the open drawing pad
async function scribble(page, dx = 0) {
  const box = await page.locator('.pad-canvas').boundingBox();
  await page.mouse.move(box.x + 60 + dx, box.y + 60);
  await page.mouse.down();
  for (let i = 1; i <= 8; i++) await page.mouse.move(box.x + 60 + dx + i * 20, box.y + 60 + i * 12);
  await page.mouse.up();
}

test('an animation made of frame panels: draw, copy, trace over the previous, paste, move, remove, keep', async ({ page }) => {
  const errors = watchErrors(page);
  await openGoblin(page);
  const anim = page.locator('.anim-editor');
  const frames = anim.locator('.frame-panels .slot:not(.adder)');
  const adder = anim.locator('.frame-panels .slot.adder');
  await expect(frames).toHaveCount(0);

  // 1st frame: drawn
  await adder.getByTitle('Nakreslit').click();
  await scribble(page);
  await page.locator('.modal').last().getByRole('button', { name: /Hotovo/ }).click();
  await expect(frames).toHaveCount(1);

  // 2nd: a copy of the last one, then changed – the previous frame shows faded underneath
  await adder.getByRole('button', { name: /kopie posledního/ }).click();
  await expect(frames).toHaveCount(2);
  await expect(frames.nth(1)).toHaveClass(/selected/);
  await frames.nth(1).getByTitle('Upravit kreslením').click();
  await expect(page.locator('.pad-underlay')).toBeVisible();
  await scribble(page, 80);
  await page.locator('.modal').last().getByRole('button', { name: /Hotovo/ }).click();

  // 3rd: pasted from the clipboard → cropped like any picture
  await page.evaluate(async () => {
    const c = document.createElement('canvas');
    c.width = c.height = 120;
    c.getContext('2d').fillRect(30, 30, 60, 60);
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': await new Promise((r) => c.toBlob(r, 'image/png')) })]);
  });
  await adder.getByTitle('Vložit obrázek ze schránky').click();
  await expect(page.locator('.reactEasyCrop_Container')).toBeVisible();
  await page.locator('.modal').last().getByRole('button', { name: 'Zrušit' }).click();

  // only the selected frame shows its tools; move and remove work on it
  await frames.nth(0).locator('.pic').click();
  await expect(frames.nth(0).getByTitle('Posunout o místo doprava')).toBeVisible();
  await expect(frames.nth(1).getByTitle('Posunout o místo doprava')).toBeHidden();
  const first = await frames.nth(0).locator('.pic img').getAttribute('src');
  await frames.nth(0).getByTitle('Posunout o místo doprava').click();
  await expect(frames.nth(1).locator('.pic img')).toHaveAttribute('src', first);
  await expect(frames.nth(1)).toHaveClass(/selected/);
  await anim.screenshot({ path: 'test-results/anim-panels.png' });
  await frames.nth(1).getByTitle('Kopírovat snímek', { exact: false }).click();
  await expect(frames).toHaveCount(3);
  await frames.nth(2).getByTitle('Smazat tento snímek').click();
  await expect(frames).toHaveCount(2);

  // saved with the component
  await page.locator('.modal').getByRole('button', { name: /Uložit/ }).last().click();
  await page.locator('.asset-tile', { hasText: /⭐ Goblin / }).click();
  await expect(page.locator('.anim-editor .frame-panels .slot:not(.adder)')).toHaveCount(2);
  expect(errors).toEqual([]);
});
