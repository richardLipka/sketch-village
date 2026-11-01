import { test, expect } from '@playwright/test';
import { watchErrors, openMenu, readDb } from './helpers.js';

// Wave strength in the wave editor (SPEC §10b): every round's DSP in a table,
// all waves 10 % stronger with one press, waves generated from chosen monsters,
// and the robot finding how much stronger each wave may get.

test.skip(({ isMobile }) => isMobile, 'the wave editor is checked on the PC');

const total = async (page) => Number(await page.locator('.wave-strength-table tfoot td.num').textContent());

test('the strength table, +10 %, generated waves and the robot’s limits', async ({ page }) => {
  test.setTimeout(180_000);
  const errors = watchErrors(page);
  await openMenu(page);
  await page.getByRole('button', { name: /Mapy/ }).click();
  await page.locator('.asset-tile').first().getByRole('button', { name: /Vlny/ }).click();

  // every round with its DSP; the built-in plan gets stronger every round
  const rows = page.locator('.wave-strength-table tbody tr');
  await expect(rows).toHaveCount(20);
  await expect(rows.first()).toContainText('80');
  const changes = await rows.locator('td:nth-child(4)').allTextContents();
  expect(changes.slice(1).every((c) => c.startsWith('+'))).toBe(true);

  // all waves 10 % stronger: monsters of the same kinds added
  const before = await total(page);
  await page.getByTestId('waves-stronger').click();
  const after = await total(page);
  expect(after / before).toBeGreaterThan(1.08);
  expect(after / before).toBeLessThan(1.12);

  // a new plan: 3 rounds of goblins and spider riders, each stronger
  await page.getByTestId('waves-generate').click();
  const dialog = page.getByRole('dialog');
  for (const label of await dialog.locator('.gen-enemies label').all()) {
    if (await label.locator('input').isChecked()) await label.click();
  }
  await expect(dialog.getByText('Vyber aspoň jednu příšeru.')).toBeVisible();
  await dialog.locator('.gen-enemies label', { hasText: /^Goblin ⚡/ }).click();
  await dialog.locator('.gen-enemies label', { hasText: /Pavoučí jezdec/ }).click();
  await dialog.getByLabel('Počet kol').fill('3');
  await expect(dialog.locator('.gen-preview tbody tr')).toHaveCount(3);
  page.once('dialog', (d) => d.accept()); // "replace all waves?"
  await dialog.getByTestId('gen-go').click();
  await expect(rows).toHaveCount(3);
  const dsp = (await rows.locator('td.num').allTextContents()).filter((_, i) => i % 2 === 0).map(Number);
  expect(dsp[1]).toBeGreaterThan(dsp[0]);
  expect(dsp[2]).toBeGreaterThan(dsp[1]);
  for (const text of await rows.locator('td:nth-child(2)').allTextContents()) expect(text).toMatch(/^(\d+× (Goblin|Pavoučí jezdec)(, )?)+$/);

  // the robot finds each wave's limit
  await page.getByTestId('find-limits').click();
  await expect(page.locator('.map-test [role=status]')).toContainText('Nejmíň rezervy má vlna', { timeout: 120_000 });
  for (const cell of await rows.locator('td:nth-child(5)').allTextContents()) expect(cell).toMatch(/padne při ×[\d.]+ \(\d+ DSP\)|vydrží i ×8/);

  // saved with the map
  await page.getByRole('button', { name: /Uložit/ }).click();
  await expect.poll(async () => (await readDb(page)).maps[0].waves?.rounds?.length).toBe(3);
  expect(errors).toEqual([]);
});

test('a monster’s DSP shows in its editor and changes with its numbers', async ({ page }) => {
  await openMenu(page);
  await page.getByRole('button', { name: /Ateliér/ }).click();
  await page.getByRole('button', { name: /Nepřátelé/ }).click();
  await page.locator('.asset-tile', { hasText: /⭐ Goblin / }).locator('.tile-open').click();
  const badge = page.getByTestId('enemy-dsp');
  await expect(badge).toContainText('10');
  const hp = page.getByRole('dialog').getByLabel(/Životy|Zdraví/).first();
  await hp.fill('100');
  await expect(badge).not.toContainText(/: 10$/);
  expect(Number((await badge.locator('b').textContent()).trim())).toBeGreaterThan(20);
});
