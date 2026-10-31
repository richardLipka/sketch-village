import { test, expect } from '@playwright/test';
import { watchErrors, openMenu, startGame, readDb, writeDb } from './helpers.js';

// Decorations in the map editor (SPEC §5.1): the list on the left with search,
// one click = one decoration, the selection frame with handles, Delete, filling
// a polygon; and the phone game covering the whole screen (SPEC §4a).

/** Two decoration drawings in the library, instead of the class pack's (stored straight into IndexedDB). */
async function addDecorations(page) {
  const [green, grey] = await page.evaluate(() => ['#166534', '#57534e'].map((color) => {
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const g = c.getContext('2d');
    g.fillStyle = color;
    g.beginPath(); g.arc(32, 32, 28, 0, 7); g.fill();
    return c.toDataURL('image/png');
  }));
  const file = await readDb(page);
  file.assets = file.assets.filter((a) => a.category !== 'decoration');
  file.assets.push({ id: 'tree1', category: 'decoration', name: 'Strom', description: 'zelený listnatý', images: [green] });
  file.assets.push({ id: 'rock1', category: 'decoration', name: 'Kámen', images: [grey] });
  await writeDb(page, file);
  await page.reload();
}

const storedMap = async (page) => (await readDb(page)).maps[0];

test('decorations: list on the left, one click = one, frame, resize, stretch, Delete, fill a polygon', async ({ page, isMobile }) => {
  test.skip(isMobile, 'the editor is checked on the PC');
  test.setTimeout(90_000);
  const errors = watchErrors(page);
  await openMenu(page);
  await addDecorations(page);
  await page.getByRole('button', { name: /Mapy/ }).click();
  await page.locator('.screen-body .asset-tile').first().click();
  await page.getByRole('button', { name: /Rozmístit/ }).click();
  await page.getByRole('button', { name: /🌳 Ozdoba/ }).click();

  // the list sits left of the map and can be searched
  const side = page.locator('.decor-side');
  const stage = page.locator('.map-stage');
  const sb = await side.boundingBox(), mb = await stage.boundingBox();
  expect(sb.x + sb.width).toBeLessThanOrEqual(mb.x + 1);
  await side.getByRole('searchbox').fill('listnaty'); // from the tree's description
  await expect(side.locator('.decor-tile')).toHaveCount(1);
  await side.getByRole('searchbox').fill('');
  await side.locator('.decor-tile', { hasText: 'Strom' }).click();

  // map px → screen px; a patch of grass far from roads, read from the painted map
  await stage.scrollIntoViewIfNeeded();
  const box = await stage.boundingBox();
  const grass = await page.evaluate(() => {
    const c = document.querySelector('.map-stage canvas');
    const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
    const isGrass = (x, y) => { const i = (y * c.width + x) * 4; return d[i + 1] > d[i] && d[i + 1] > 150 && d[i + 2] < 140; };
    for (let y = 120; y < c.height - 120; y += 20) {
      for (let x = 120; x < c.width - 400; x += 20) {
        let ok = true;
        for (let dy = -110; dy <= 110 && ok; dy += 10) for (let dx = -110; dx <= 330 && ok; dx += 10) ok = isGrass(x + dx, y + dy);
        if (ok) return { x, y };
      }
    }
    return null;
  });
  expect(grass).not.toBe(null);
  const at = (mx, my) => ({ x: box.x + (mx / 1280) * box.width, y: box.y + (my / 720) * box.height });

  // one click = one decoration (it used to appear only after a second click)
  let p = at(grass.x, grass.y);
  await page.mouse.click(p.x, p.y);
  await page.getByRole('button', { name: /Uložit/ }).first().click();
  await expect.poll(async () => (await storedMap(page)).decorations.length).toBe(1);
  await page.locator('.screen-body .asset-tile').first().click();
  await page.getByRole('button', { name: /Rozmístit/ }).click();
  await page.getByRole('button', { name: /🌳 Ozdoba/ }).click();
  await side.locator('.decor-tile', { hasText: 'Strom' }).click();

  // select it, pull its bottom-right corner: bigger, the same shape
  await page.mouse.click(p.x, p.y);
  await expect(side.getByRole('button', { name: /Smazat ji/ })).toBeVisible(); // selected
  const corner = at(grass.x + 32, grass.y + 32);
  await page.mouse.move(corner.x, corner.y);
  await page.mouse.down();
  await page.mouse.move(corner.x + 40, corner.y + 40, { steps: 5 });
  await page.mouse.up();
  // pull the right side: wider only
  const right = at(grass.x + 100, grass.y);
  const sizeNow = async () => {
    await page.getByRole('button', { name: /Uložit/ }).first().click();
    const d = (await storedMap(page)).decorations[0];
    await page.locator('.screen-body .asset-tile').first().click();
    await page.getByRole('button', { name: /Rozmístit/ }).click();
    await page.getByRole('button', { name: /🌳 Ozdoba/ }).click();
    return d;
  };
  const bigger = await sizeNow();
  expect(bigger.w).toBeGreaterThan(90);
  expect(Math.abs(bigger.w - bigger.h)).toBeLessThan(2);
  await page.mouse.click(at(bigger.x, bigger.y).x, at(bigger.x, bigger.y).y); // select again
  const side1 = at(bigger.x + bigger.w / 2, bigger.y);
  await page.mouse.move(side1.x, side1.y);
  await page.mouse.down();
  await page.mouse.move(right.x + 60, right.y + 30, { steps: 5 });
  await page.mouse.up();
  const stretched = await sizeNow();
  expect(stretched.w).toBeGreaterThan(bigger.w + 20);
  expect(stretched.h).toBeCloseTo(bigger.h, 0);

  // Delete removes the selected one
  await page.mouse.click(at(stretched.x, stretched.y).x, at(stretched.x, stretched.y).y);
  await page.keyboard.press('Delete');
  await page.getByRole('button', { name: /Uložit/ }).first().click();
  await expect.poll(async () => (await storedMap(page)).decorations.length).toBe(0);

  // fill a polygon with stones
  await page.locator('.screen-body .asset-tile').first().click();
  await page.getByRole('button', { name: /Rozmístit/ }).click();
  await page.getByRole('button', { name: /🌳 Ozdoba/ }).click();
  await side.getByRole('radio', { name: /Vyplnit oblast/ }).click();
  await side.locator('.decor-tile', { hasText: 'Kámen' }).click();
  for (const [dx, dy] of [[-100, -100], [300, -100], [300, 100], [-100, 100]]) {
    const q = at(grass.x + dx, grass.y + dy);
    await page.mouse.click(q.x, q.y);
  }
  await side.getByRole('button', { name: /^⬠ Vyplnit$/ }).click();
  await expect(page.getByText(/Přidán|Přidáno/)).toBeVisible();
  await page.getByRole('button', { name: /Uložit/ }).first().click();
  await expect.poll(async () => (await storedMap(page)).decorations.length).toBeGreaterThan(4);
  const filled = (await storedMap(page)).decorations;
  expect(filled.every((d) => d.asset === 'rock1' && d.x > grass.x - 101 && d.x < grass.x + 301)).toBe(true);
  expect(errors).toEqual([]);
});

test('phone: the map covers the whole screen, the controls lie over it', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'phone');
  await openMenu(page);
  await startGame(page);
  await page.waitForTimeout(800);
  const c = await page.locator('.game-screen canvas').boundingBox();
  const v = page.viewportSize();
  expect(c.x).toBeLessThanOrEqual(1);
  expect(c.y).toBeLessThanOrEqual(1);
  expect(c.x + c.width).toBeGreaterThanOrEqual(v.width - 1);
  expect(c.y + c.height).toBeGreaterThanOrEqual(v.height - 1);
  // a control at the edge is over the map
  const pause = await page.getByTitle('Pauza (P)').boundingBox();
  expect(pause.x).toBeGreaterThan(c.x);
});
