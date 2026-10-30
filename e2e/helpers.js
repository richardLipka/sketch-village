import { expect } from '@playwright/test';

/** Collect uncaught errors and console errors in the page (the test expects none). */
export function watchErrors(page) {
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => {
    // the handwriting fonts may be unreachable on a CI runner or offline – not the game's fault
    const text = `${m.text()} ${m.location()?.url ?? ''}`;
    if (m.type() === 'error' && !/fonts\.(googleapis|gstatic)|ERR_INTERNET_DISCONNECTED/.test(text)) errors.push(m.text());
  });
  return errors;
}

export async function openMenu(page) {
  await page.goto('/');
  await expect(page.getByRole('button', { name: /Hrát/ })).toBeVisible();
}

export async function startGame(page) {
  await page.getByRole('button', { name: /Hrát/ }).click();
  await page.getByRole('button', { name: /Začít/ }).click();
  await expect(page.locator('.game-screen canvas')).toBeVisible();
}

/** Change the stored settings (IndexedDB via idb-keyval), then reload. */
export async function patchSettings(page, patch) {
  await page.evaluate(async (p) => {
    const db = await new Promise((ok, fail) => {
      const r = indexedDB.open('keyval-store');
      r.onsuccess = () => ok(r.result);
      r.onerror = () => fail(r.error);
    });
    const store = () => db.transaction('keyval', 'readwrite').objectStore('keyval');
    const cur = await new Promise((ok) => { const r = store().get('sv:settings'); r.onsuccess = () => ok(r.result ?? {}); });
    await new Promise((ok) => { const r = store().put({ ...cur, ...p }, 'sv:settings'); r.onsuccess = ok; });
    db.close();
  }, patch);
  await page.reload();
  await expect(page.getByRole('button', { name: /Hrát/ })).toBeVisible();
}
