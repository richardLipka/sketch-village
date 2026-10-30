import { test, expect } from '@playwright/test';
import { watchErrors, openMenu, startGame } from './helpers.js';

// Installable app (SPEC §2.2): after the first visit the service worker keeps
// the whole game – it opens and plays without internet.
test('the game opens and plays offline after the first visit', async ({ page, context, isMobile }) => {
  test.skip(isMobile, 'once is enough');
  await openMenu(page);
  await page.evaluate(async () => { await navigator.serviceWorker.ready; });
  if (!(await page.evaluate(() => !!navigator.serviceWorker.controller))) await page.reload();
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
  const manifest = await page.evaluate(async () => (await fetch(document.querySelector('link[rel=manifest]').href)).json());
  expect(manifest.icons.length).toBeGreaterThan(1);

  await context.setOffline(true);
  const errors = watchErrors(page);
  await page.reload();
  await expect(page.getByRole('button', { name: /Hrát/ })).toBeVisible();
  await startGame(page);
  await page.waitForTimeout(1500);
  expect(errors).toEqual([]);
  await context.setOffline(false);
});
