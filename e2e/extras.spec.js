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
  await expect(ability).toHaveAttribute('aria-label', /^Déšť šípů \(E\) – .*🎯 320/);
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

test('moving things show which way they go: on the pictures, the frames and the drawing pad', async ({ page }) => {
  const errors = watchErrors(page);
  await openMenu(page);
  await page.getByRole('button', { name: /Ateliér/ }).click();
  await page.getByRole('button', { name: /Nepřátelé/ }).click();
  await page.locator('.asset-tile .tile-open').first().click();
  const modal = page.locator('.modal');
  await expect(modal.getByTestId('move-hint')).toContainText('jak jde doprava');
  await expect(modal.getByRole('img', { name: 'Jde tímto směrem ➜' }).first()).toBeVisible();
  await modal.getByRole('button', { name: /^(Nakreslit|Upravit kreslením)$/ }).first().click();
  await expect(page.locator('.pad-stack .move-arrow')).toBeVisible();
  await expect(page.locator('.move-hint').last()).toContainText('jak jde doprava');
  await page.keyboard.press('Escape');
  await page.keyboard.press('Escape');

  // a decoration stands still: no arrow
  await page.getByRole('button', { name: /Ozdoby/ }).click();
  await page.locator('.asset-tile .tile-open').first().click();
  await expect(page.locator('.modal').getByTestId('move-arrow')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('caves: a shape for each cave – a cave drawing or a decoration – resized by its corners', async ({ page, isMobile }) => {
  test.skip(isMobile, 'the editors are checked on the PC');
  test.setTimeout(90_000);
  const errors = watchErrors(page);
  await openMenu(page);
  await page.getByRole('button', { name: /Mapy/ }).click();
  await page.locator('.screen-body .asset-tile').first().click();
  await page.getByRole('button', { name: /Rozmístit/ }).click();
  await page.getByRole('button', { name: /🕳️ Jeskyně/ }).click();
  const panel = page.getByTestId('cave-panel');
  await expect(panel.getByRole('button', { name: 'Obvyklá jeskyně' })).toHaveAttribute('aria-pressed', 'true');
  await expect(panel).toContainText('Ozdoby jako jeskyně');
  const before = (await readDb(page)).maps[0].caves.length;

  // road pixels away from the Town Hall: a click on the road puts the cave beside it (and selects it)
  const stage = page.locator('.map-stage');
  await stage.scrollIntoViewIfNeeded();
  const box = await stage.boundingBox();
  const roads = await page.evaluate(() => {
    const c = document.querySelector('.map-stage canvas');
    const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
    const out = [];
    for (let y = 60; y < c.height - 60; y += 37) for (let x = 60; x < c.width - 60; x += 37) {
      const i = (y * c.width + x) * 4;
      if (Math.abs(d[i] - 0xf2) < 6 && Math.abs(d[i + 1] - 0xd2) < 6 && Math.abs(d[i + 2] - 0x4b) < 6 && Math.hypot(x - c.width / 2, y - c.height / 2) > 250) out.push({ x, y, w: c.width });
    }
    return out;
  });
  const del = panel.getByRole('button', { name: /Smazat jeskyni/ });
  for (const r of roads) {
    await page.mouse.click(box.x + (r.x / r.w) * box.width, box.y + (r.y / r.w) * box.width);
    if (await del.isVisible()) break;
    await page.keyboard.press('Escape');
  }
  await expect(del).toBeVisible();
  // the selected cave takes a decoration's shape
  const decor = panel.locator('.decor-group').nth(1).locator('.decor-tile').first();
  await decor.click();
  await expect(decor).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('.painter-status')).toContainText('připravená');
  await page.getByRole('button', { name: /Uložit/ }).first().click();
  const map = (await readDb(page)).maps[0];
  expect(map.caves).toHaveLength(before + 1);
  const assets = (await readDb(page)).assets;
  expect(assets.find((a) => a.id === map.caves.at(-1).asset)?.category).toBe('decoration');
  expect(errors).toEqual([]);
});

test('waves: a group made stronger in %, every round a few % stronger – one decimal place', async ({ page, isMobile }) => {
  test.skip(isMobile, 'the editors are checked on the PC');
  const errors = watchErrors(page);
  await openMenu(page);
  await page.getByRole('button', { name: /Mapy/ }).click();
  await page.getByRole('button', { name: /Vlny/ }).first().click();
  await page.getByTestId('wave-growth').fill('2.25');
  await expect(page.getByTestId('wave-growth')).toHaveValue('2.3');
  await page.getByTestId('group-hp').first().fill('200');
  await expect(page.getByTestId('group-boost').first()).toHaveText('= v tomto kole ⚔️ 100 % · ❤️ 200 %');
  await expect(page.locator('.sketch-card').filter({ hasText: 'Kolo 3' }).first()).toContainText('📈 +4.6 %');
  await page.getByRole('button', { name: /Uložit/ }).first().click();
  await expect.poll(async () => (await readDb(page)).maps[0].waves?.growth).toBe(2.3);
  const waves = (await readDb(page)).maps[0].waves;
  expect(waves.rounds[0].groups[0].hp).toBe(200);
  expect(waves.rounds[0].groups[0]).not.toHaveProperty('attack'); // 100 % isn't stored
  expect(errors).toEqual([]);
});

/** Put a value under a key of the browser's IndexedDB store. */
const writeKey = (page, key, value) => page.evaluate(async ([k, v]) => {
  const db = await new Promise((ok) => { const r = indexedDB.open('keyval-store'); r.onsuccess = () => ok(r.result); });
  await new Promise((ok) => { const r = db.transaction('keyval', 'readwrite').objectStore('keyval').put(v, k); r.onsuccess = ok; });
  db.close();
}, [key, value]);

test('a game played to its end: the victory screen and the defeat screen (SPEC §11)', async ({ page, isMobile }) => {
  test.setTimeout(120_000);
  const errors = watchErrors(page);
  await openMenu(page);
  await startGame(page);
  await page.getByRole('button', { name: /Připraven/ }).click();
  await expect(page.locator('.ov-tr')).toContainText('Zbývá nepřátel');
  await page.waitForTimeout(3000); // the first monsters come out of the caves
  await clickExit(page, isMobile);
  await page.getByTestId('quit-save').click();
  await expect(page.getByTestId('saved-game')).toBeVisible();
  const saved = await readKey(page, 'sv:game');

  // the last round with every monster gone: the game ends with a victory
  await writeKey(page, 'sv:game', { ...saved, round: saved.totalRounds, state: { ...saved.state, round: saved.totalRounds - 1, phase: 'wave', queue: [], enemies: [] } });
  await page.reload();
  await page.getByRole('button', { name: /Hrát/ }).click();
  await page.getByTestId('continue').click();
  const won = page.getByTestId('end-won');
  await expect(won).toBeVisible({ timeout: 30_000 });
  await expect(won.getByRole('heading', { name: 'Vesnice ubráněna!' })).toBeVisible();
  await expect(won.getByTestId('fireworks')).toBeAttached();
  await expect(won.locator('.end-hero.played')).toHaveCount(1);
  expect(await won.locator('.end-hero').count()).toBeGreaterThan(1); // other drawn heroes jump along
  await expect(won).toContainText(`Kolo ${saved.totalRounds} z ${saved.totalRounds}`);
  await expect.poll(() => readKey(page, 'sv:game')).toBe(null); // an ended game isn't kept
  // play again: a new game from round 1
  await won.getByRole('button', { name: /Hrát znovu/ }).click();
  await expect(page.getByTestId('end-won')).toHaveCount(0);
  await expect(page.locator('.ov-tr')).toContainText(`Kolo 1/${saved.totalRounds}`);

  // monsters at the Town Hall with almost nothing left: the game is lost
  const th = saved.state.townHall;
  const { enemies } = saved.state;
  expect(enemies.length).toBeGreaterThan(0);
  await writeKey(page, 'sv:game', { ...saved, state: { ...saved.state, townHall: { ...th, hp: 1 }, enemies: enemies.map((e) => ({ ...e, x: th.x + 30, y: th.y })) } });
  await page.reload();
  await page.getByRole('button', { name: /Hrát/ }).click();
  await page.getByTestId('continue').click();
  const lost = page.getByTestId('end-lost');
  await expect(lost).toBeVisible({ timeout: 30_000 });
  await expect(lost.getByRole('heading', { name: 'Konec hry' })).toBeVisible();
  await expect(lost).toContainText('Radnice padla!');
  await expect(lost.locator('.end-hero.sad')).toHaveCount(1);
  await expect.poll(() => readKey(page, 'sv:game')).toBe(null);
  await lost.getByRole('button', { name: 'Konec', exact: true }).click();
  await expect(page.getByRole('button', { name: /Začít/ })).toBeVisible();
  expect(errors).toEqual([]);
});
