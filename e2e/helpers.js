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

// The browser keeps everything as one save file in IndexedDB (src/data/store.js).
const DB_KEY = 'sv:db';

/** The stored save file (null before anything was stored). */
export function readDb(page) {
  return page.evaluate(async (key) => {
    const db = await new Promise((ok) => { const r = indexedDB.open('keyval-store'); r.onsuccess = () => ok(r.result); });
    const v = await new Promise((ok) => { const r = db.transaction('keyval').objectStore('keyval').get(key); r.onsuccess = () => ok(r.result ?? null); });
    db.close();
    return v;
  }, DB_KEY);
}

/** Replace the stored save file (reload afterwards to use it). */
export function writeDb(page, file) {
  return page.evaluate(async ([key, f]) => {
    const db = await new Promise((ok) => { const r = indexedDB.open('keyval-store'); r.onsuccess = () => ok(r.result); });
    await new Promise((ok) => { const r = db.transaction('keyval', 'readwrite').objectStore('keyval').put(f, key); r.onsuccess = ok; });
    db.close();
  }, [DB_KEY, file]);
}

/** Change the stored settings, then reload. */
export async function patchSettings(page, patch) {
  const file = await readDb(page);
  await writeDb(page, { ...file, settings: { ...file.settings, ...patch } });
  await page.reload();
  await expect(page.getByRole('button', { name: /Hrát/ })).toBeVisible();
}
