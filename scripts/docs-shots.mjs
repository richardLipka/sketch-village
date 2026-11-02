// Screenshots of the running game for the Czech documentation (SPEC §18).
// Start the game first (npm run dev), then: npm run docs-shots [-- --url http://localhost:5173/]
// A fresh browser profile starts with the class pack, as a new computer does.
// PW_CHANNEL=chrome uses the installed Chrome.
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import path from 'node:path';

const arg = (name, def) => { const i = process.argv.indexOf(name); return i > 0 ? process.argv[i + 1] : def; };
const URL = arg('--url', 'http://localhost:5173/');
const OUT = path.resolve('docs/src/img');
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ channel: process.env.PW_CHANNEL || undefined });
const context = await browser.newContext({
  viewport: { width: 1280, height: 760 }, deviceScaleFactor: 1.5, locale: 'cs-CZ',
  permissions: ['clipboard-read', 'clipboard-write'],
});
const page = await context.newPage();
const shot = async (name, opts = {}) => {
  await page.waitForTimeout(opts.wait ?? 600);
  await page.screenshot({ path: path.join(OUT, `${name}.jpg`), type: 'jpeg', quality: 80 });
  console.log('  ', name);
};
const btn = (name) => page.getByRole('button', { name }).first();
const menu = async () => {
  await page.goto(URL);
  await btn(/Hrát/).waitFor();
};
const closeModal = () => page.keyboard.press('Escape');

await menu();
await page.waitForTimeout(2500); // the class pack is merged on the first start
await menu();
await shot('menu');

// Play: map, hero, difficulty, then a game in progress
await btn(/Hrát/).click();
await shot('play', { wait: 1200 });
await btn(/Začít/).click();
await page.locator('.hud-num').first().waitFor({ timeout: 30_000 });
await page.waitForTimeout(1500);
await page.keyboard.press('Space'); // call the first wave
await page.waitForTimeout(9000);
await shot('game');
await page.keyboard.press('i');
await shot('backpack');
await page.keyboard.press('i');
await page.getByTestId('speed').first().click(); // 2×
await page.getByTestId('speed').first().click(); // 3×
await page.locator('.round-summary').waitFor({ timeout: 120_000 });
await shot('summary', { wait: 300 });

// Studio: monsters, a monster's editor, a building's editor
await menu();
await btn(/Ateliér/).click();
await btn(/Nepřátelé/).click();
await shot('studio');
await page.locator('.asset-tile', { hasText: /Goblin/ }).first().click();
await page.locator('.modal').first().waitFor();
await page.locator('.modal-body, .modal').first().evaluate((m) => { (m.querySelector('.modal-body') ?? m).scrollTop = 900; });
await shot('enemy-editor-numbers', { wait: 500 });
await closeModal();
await btn(/Budovy/).click();
await page.locator('.asset-tile', { hasText: /Věž/ }).first().click();
await page.locator('.modal').first().waitFor();
await page.locator('.modal-body, .modal').first().evaluate((m) => { (m.querySelector('.modal-body') ?? m).scrollTop = 700; });
await shot('building-editor', { wait: 1000 });
await closeModal();

// Uploading a picture: a pale drawing on paper → crop → the paper step
await btn(/Nepřátelé/).click();
await page.locator('.asset-tile', { hasText: /Goblin/ }).first().click();
await page.evaluate(async () => {
  const c = document.createElement('canvas');
  c.width = 900; c.height = 700;
  const g = c.getContext('2d');
  g.fillStyle = '#ece6d6'; g.fillRect(0, 0, 900, 700); // paper
  g.lineWidth = 7; g.strokeStyle = '#4a4a5a'; g.lineCap = 'round';
  g.fillStyle = '#9fc59a'; // a pale crayon goblin
  g.beginPath(); g.ellipse(450, 260, 120, 110, 0, 0, Math.PI * 2); g.fill(); g.stroke();
  g.fillStyle = '#c9a07a'; g.fillRect(360, 360, 180, 200); g.strokeRect(360, 360, 180, 200);
  g.fillStyle = '#fff'; g.beginPath(); g.arc(410, 240, 22, 0, 7); g.arc(490, 240, 22, 0, 7); g.fill(); g.stroke();
  g.fillStyle = '#333'; g.beginPath(); g.arc(412, 244, 8, 0, 7); g.arc(492, 244, 8, 0, 7); g.fill();
  g.beginPath(); g.moveTo(330, 230); g.lineTo(250, 170); g.lineTo(340, 280); g.moveTo(570, 230); g.lineTo(650, 170); g.lineTo(560, 280); g.stroke();
  g.beginPath(); g.arc(450, 300, 40, 0.2, Math.PI - 0.2); g.stroke();
  g.beginPath(); g.moveTo(400, 560); g.lineTo(390, 640); g.moveTo(500, 560); g.lineTo(510, 640); g.stroke();
  const blob = await new Promise((r) => c.toBlob(r, 'image/png'));
  await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
});
await page.locator('.slot').first().getByTitle('Vložit obrázek ze schránky').click();
await page.locator('.reactEasyCrop_Container').waitFor();
await shot('crop', { wait: 1000 });
await btn(/Oříznout/).click();
await page.getByTestId('bg-preview').waitFor();
await page.getByTestId('bg-vivid').fill('50');
await shot('paper', { wait: 1200 });
await closeModal();
await closeModal();

// Maps: the list, the editor (place mode, caves), the waves
await menu();
await btn(/Mapy/).click();
await shot('maps', { wait: 1500 });
await page.locator('.asset-tile').first().getByRole('button').first().click(); // open the first map
await page.waitForTimeout(1500);
await btn(/Rozmístit/).click();
await shot('map-place', { wait: 1200 });
await btn(/Jeskyně/).click();
await shot('map-caves', { wait: 1000 });

await menu();
await btn(/Mapy/).click();
await page.locator('.asset-tile').first().getByRole('button', { name: /Vlny/ }).click();
await page.waitForTimeout(1500);
await page.getByRole('button', { name: /Kolo 2$/ }).first().click();
await page.locator('[data-testid="group-hp"]').first().fill('150');
await shot('waves-round', { wait: 800 });
await page.locator('#wave-strength-title').scrollIntoViewIfNeeded();
await page.evaluate(() => document.querySelector('#wave-strength-title').scrollIntoView({ block: 'start' }));
await shot('waves-strength', { wait: 1200 });
await btn(/Zkusit/).click();
await page.locator('.verdict').waitFor({ timeout: 120_000 });
await page.evaluate(() => document.querySelector('.map-test').scrollIntoView({ block: 'start' }));
await shot('robot', { wait: 800 });

// Save & load, library
await menu();
await btn(/Uložit a nahrát/).click();
await shot('data', { wait: 1000 });
await menu();
await btn(/Knihovna/).click();
await shot('library', { wait: 2000 });
await menu();
await btn(/Kronika/).click();
await shot('chronicle', { wait: 1500 });

await browser.close();
