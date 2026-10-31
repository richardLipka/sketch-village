import { test, expect } from '@playwright/test';
import { watchErrors, openMenu, startGame, readDb, writeDb, patchSettings } from './helpers.js';

// Ending a game asks first; the map can be pulled out from under the controls
// (a paper border around it); the map editor uses the whole window and its
// rubber removes everything it is pulled over; the maps before a game slide
// sideways, so every one of them can be picked.

const PAPER = [0xef, 0xe7, 0xd3]; // the border around the map (GameScene)

/** The colours of the screen at `points` (screen px), from a screenshot. */
async function colours(page, points) {
  const shot = await page.screenshot();
  return page.evaluate(async ([b64, pts]) => {
    const img = new Image();
    img.src = `data:image/png;base64,${b64}`;
    await img.decode();
    const c = document.createElement('canvas');
    c.width = img.width; c.height = img.height;
    const g = c.getContext('2d');
    g.drawImage(img, 0, 0);
    const k = img.width / innerWidth;
    return pts.map(([x, y]) => [...g.getImageData(Math.round(x * k), Math.round(y * k), 1, 1).data].slice(0, 3));
  }, [shot.toString('base64'), points]);
}

const near = (a, b) => a.every((v, i) => Math.abs(v - b[i]) <= 6);

/** The ✕ that ends the game (on a phone it waits under ⋯). */
async function clickExit(page, isMobile) {
  if (isMobile) await page.getByTitle('Další', { exact: true }).click();
  await page.getByTitle('Konec', { exact: true }).click();
}

test('ending a game asks first; keep playing goes back to the game', async ({ page, isMobile }) => {
  const errors = watchErrors(page);
  await openMenu(page);
  await startGame(page);
  await expect(page.locator('.hud-num').first()).toBeVisible();

  await clickExit(page, isMobile);
  const ask = page.locator('.quit-ask');
  await expect(ask).toContainText('Ukončit hru?');
  await expect(ask).toContainText('kolo 1 z 20');
  await expect(page.getByText('Pauza', { exact: true })).toHaveCount(0); // the question, not the pause card
  await ask.getByRole('button', { name: /Hrát dál/ }).click();
  await expect(ask).toHaveCount(0);
  await expect(page.locator('.game-screen canvas')).toBeVisible();

  // Escape is "keep playing" too
  await clickExit(page, isMobile);
  await expect(ask).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(ask).toHaveCount(0);
  await expect(page.locator('.game-screen canvas')).toBeVisible();

  await clickExit(page, isMobile);
  await page.getByTestId('quit-yes').click();
  await expect(page.locator('.game-screen')).toHaveCount(0);
  await expect(page.getByRole('button', { name: /Začít/ })).toBeVisible();
  expect(errors).toEqual([]);
});

test('the map can be pulled out from under the controls: a paper border around it', async ({ page }) => {
  const errors = watchErrors(page);
  await openMenu(page);
  await patchSettings(page, { tutorialStep: 99 }); // no tips over the map
  await startGame(page);
  await expect(page.locator('.hud-num').first()).toBeVisible();
  const box = await page.locator('.game-screen canvas').boundingBox();
  // points along the bottom where nothing lies over the map
  const free = await page.evaluate(() => {
    const out = [];
    for (let x = 20; x < innerWidth - 20; x += 40) {
      for (const y of [innerHeight - 30, innerHeight - 90]) if (document.elementFromPoint(x, y)?.tagName === 'CANVAS') out.push([x, y]);
    }
    return out;
  });
  expect(free.length).toBeGreaterThan(2);
  expect((await colours(page, free)).some((c) => near(c, PAPER))).toBe(false); // the map down there

  // drag the map up and to the left as far as it goes: its bottom-right edge rises above the controls
  const from = { x: box.x + box.width * 0.6, y: box.y + box.height * 0.6 };
  for (let i = 0; i < 3; i++) {
    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    await page.mouse.move(from.x - box.width * 0.3, from.y - box.height * 0.3, { steps: 8 });
    await page.mouse.up();
  }
  const after = await colours(page, free);
  expect(after.filter((c) => near(c, PAPER)).length).toBeGreaterThan(free.length / 2);
  expect(errors).toEqual([]);
});

test('the map editor uses the whole window; the rubber removes everything it is pulled over', async ({ page, isMobile }) => {
  test.skip(isMobile, 'the editor is checked on the PC');
  const errors = watchErrors(page);
  await openMenu(page);
  await page.getByRole('button', { name: /Mapy/ }).click();
  await page.locator('.screen-body .asset-tile').first().click();

  // the map is wider than the old 1100 px page allowed, and nothing scrolls
  const stage = page.locator('.map-stage');
  await expect(stage).toBeVisible();
  const vp = page.viewportSize();
  const sb = await stage.boundingBox();
  expect(sb.y + sb.height).toBeLessThanOrEqual(vp.height);
  expect(await page.evaluate(() => document.documentElement.scrollHeight <= innerHeight + 1)).toBe(true);
  await page.getByRole('button', { name: /Rozmístit/ }).click();
  await page.getByRole('button', { name: /Ozdoba/ }).click();
  const side = await page.locator('.decor-side').boundingBox();
  const withPanel = await stage.boundingBox();
  expect(side.width + withPanel.width).toBeGreaterThan(vp.width * 0.8); // the window's width is used
  expect(await page.locator('.decor-group').first().evaluate((g) => getComputedStyle(g).gridTemplateColumns.split(' ').length)).toBeGreaterThan(2);

  // the rubber: one stroke over the building spots of the sample map removes all it touches
  await page.getByRole('button', { name: /Guma/ }).click();
  const map = (await readDb(page)).maps[0];
  const box = await stage.boundingBox();
  const at = (p) => ({ x: box.x + (p.x / map.world.width) * box.width, y: box.y + (p.y / map.world.height) * box.height });
  const ring = map.spots.map(at);
  await page.mouse.move(ring[0].x, ring[0].y);
  await page.mouse.down();
  for (const p of [...ring.slice(1), ring[0]]) await page.mouse.move(p.x, p.y, { steps: 6 });
  await page.mouse.up();
  await expect(page.getByRole('button', { name: /Místo na stavbu \(0\)/ })).toBeVisible();
  await expect(page.locator('.painter-status')).toContainText('Ještě chybí');
  // the Town Hall stayed (a sweep never takes it); one ↶ brings the whole stroke back
  await expect(page.locator('.painter-status')).not.toContainText(/radnic/i);
  await page.getByTitle('Zpět').click();
  await expect(page.getByRole('button', { name: new RegExp(`Místo na stavbu \\(${map.spots.length}\\)`) })).toBeVisible();
  expect(errors).toEqual([]);
});

test('many maps: they slide sideways and every one can be picked', async ({ page }) => {
  const errors = watchErrors(page);
  await openMenu(page);
  const db = await readDb(page);
  const base = db.maps.find((m) => m.valid) ?? db.maps[0];
  const extra = Array.from({ length: 8 }, (_, i) => ({ ...base, id: `copy-${i}`, name: `Mapa číslo ${i + 1}`, valid: true }));
  await writeDb(page, { ...db, maps: [...db.maps, ...extra] });
  await page.reload();
  await page.getByRole('button', { name: /Hrát/ }).click();

  const strip = page.getByRole('listbox', { name: 'Vyber mapu' });
  const last = strip.getByRole('option').last();
  await expect(last).toContainText('Mapa číslo 8');
  const inView = async (el) => {
    const s = await strip.boundingBox(), b = await el.boundingBox();
    return b.x >= s.x - 1 && b.x + b.width <= s.x + s.width + 1;
  };
  expect(await inView(last)).toBe(false);
  // one row only: every tile on the same line (the tiles lean a little, like drawn)
  const ys = await strip.getByRole('option').evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().top)));
  expect(Math.max(...ys) - Math.min(...ys)).toBeLessThan(10);

  const next = page.getByRole('button', { name: 'Posunout doprava' }).first();
  for (let i = 0; i < 10 && !(await inView(last)); i++) {
    await next.click();
    await page.waitForTimeout(400);
  }
  expect(await inView(last)).toBe(true);
  await last.click();
  await expect(last).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('.screen-head')).toContainText('Mapa číslo 8');
  await expect(page.getByRole('button', { name: 'Posunout doleva' }).first()).toBeVisible();
  expect(errors).toEqual([]);
});
