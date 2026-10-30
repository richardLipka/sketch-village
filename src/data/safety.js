// Keeping the kids' drawings safe (SPEC §13b). Everything lives only in this
// browser's IndexedDB, which a browser may clear (Safari: after ~7 days without
// a visit unless the game is on the home screen). So:
//  - ask the browser to keep the data ("persistent storage"),
//  - remind to download a backup when changes are a few days old and not saved.
//
// Settings used: unsavedSince (first change after the last backup), lastBackupAt,
// backupSnoozeUntil ("later" on the reminder).

import { buildSaveFile } from './saveFile.js';

const DAY = 24 * 60 * 60 * 1000;
export const REMIND_AFTER_DAYS = 2;
export const SNOOZE_DAYS = 1;

/** Should the menu remind to download a backup? */
export function backupDue(settings = {}, now = Date.now()) {
  if (!settings.unsavedSince) return false;
  if (settings.backupSnoozeUntil && now < Date.parse(settings.backupSnoozeUntil)) return false;
  return now - Date.parse(settings.unsavedSince) >= REMIND_AFTER_DAYS * DAY;
}

/** Whole days the oldest unsaved change waits for a backup. */
export const unsavedDays = (settings = {}, now = Date.now()) =>
  settings.unsavedSince ? Math.max(0, Math.floor((now - Date.parse(settings.unsavedSince)) / DAY)) : 0;

/** Settings patch after the kid changed something (null when nothing to note). */
export const noteChange = (settings = {}, now = new Date()) =>
  settings.unsavedSince ? null : { unsavedSince: now.toISOString() };

/** Settings patch after a backup was downloaded. */
export const noteBackup = (now = new Date()) => ({ unsavedSince: null, backupSnoozeUntil: null, lastBackupAt: now.toISOString() });

/** Settings patch for "remind me later". */
export const snoozeBackup = (now = Date.now()) => ({ backupSnoozeUntil: new Date(now + SNOOZE_DAYS * DAY).toISOString() });

/** Download everything as one save file (the browser saves it to Downloads). */
export function downloadSaveFile(db, language) {
  const file = buildSaveFile({ ...db, settings: { ...db.settings, language } });
  downloadJson(file, `sketch-village-${file.exportedAt.slice(0, 10)}.json`);
}

/** Let the browser save `data` as a JSON file. */
export function downloadJson(data, fileName) {
  const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

/**
 * Ask the browser to keep this site's data even when space runs low or the
 * site isn't visited for a while → 'persisted' | 'best-effort' | 'unsupported'.
 * Chrome decides silently, Firefox asks the user once, Safari keeps the data of
 * home-screen apps.
 */
export async function storageStatus({ ask = false, storage = globalThis.navigator?.storage } = {}) {
  if (!storage?.persisted) return 'unsupported';
  try {
    if (await storage.persisted()) return 'persisted';
    if (ask && storage.persist && (await storage.persist())) return 'persisted';
    return 'best-effort';
  } catch {
    return 'best-effort';
  }
}
