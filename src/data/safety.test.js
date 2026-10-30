import { describe, it, expect } from 'vitest';
import { backupDue, unsavedDays, noteChange, noteBackup, snoozeBackup, storageStatus, REMIND_AFTER_DAYS } from './safety.js';

const DAY = 864e5;
const t0 = Date.parse('2026-10-01T10:00:00Z');
const iso = (ms) => new Date(ms).toISOString();

describe('backup reminder', () => {
  it('is quiet with nothing unsaved or changes that are still fresh', () => {
    expect(backupDue({}, t0)).toBe(false);
    expect(backupDue({ unsavedSince: iso(t0 - DAY) }, t0)).toBe(false);
  });

  it(`reminds once changes wait ${REMIND_AFTER_DAYS} days`, () => {
    const s = { unsavedSince: iso(t0 - REMIND_AFTER_DAYS * DAY) };
    expect(backupDue(s, t0)).toBe(true);
    expect(unsavedDays(s, t0)).toBe(REMIND_AFTER_DAYS);
  });

  it('"later" silences it for a day, then it comes back', () => {
    const s = { unsavedSince: iso(t0 - 5 * DAY), ...snoozeBackup(t0) };
    expect(backupDue(s, t0 + DAY / 2)).toBe(false);
    expect(backupDue(s, t0 + DAY + 1)).toBe(true);
  });

  it('notes only the first change after a backup; a backup clears it', () => {
    const first = noteChange({}, new Date(t0));
    expect(first).toEqual({ unsavedSince: iso(t0) });
    expect(noteChange(first, new Date(t0 + DAY))).toBe(null);
    const after = { ...first, ...noteBackup(new Date(t0 + 3 * DAY)) };
    expect(backupDue(after, t0 + 10 * DAY)).toBe(false);
    expect(after.lastBackupAt).toBe(iso(t0 + 3 * DAY));
  });
});

describe('storageStatus', () => {
  it('reports unsupported browsers', async () => {
    expect(await storageStatus({ storage: undefined })).toBe('unsupported');
  });
  it('asks only when told to', async () => {
    let asked = 0;
    const storage = { persisted: async () => false, persist: async () => { asked++; return true; } };
    expect(await storageStatus({ storage })).toBe('best-effort');
    expect(asked).toBe(0);
    expect(await storageStatus({ storage, ask: true })).toBe('persisted');
    expect(asked).toBe(1);
  });
  it('a refused or failing request stays best-effort', async () => {
    expect(await storageStatus({ ask: true, storage: { persisted: async () => false, persist: async () => false } })).toBe('best-effort');
    expect(await storageStatus({ storage: { persisted: async () => { throw new Error('x'); } } })).toBe('best-effort');
  });
});
