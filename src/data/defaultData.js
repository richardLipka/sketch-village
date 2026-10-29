// The class pack: `public/default-data.json`, shipped with the website (SPEC §2.1).
// A teacher exports the game data, replaces that file in the repository and
// pushes – every new computer then starts with the kids' drawings and maps.

import { parseSaveFile, COLLECTIONS } from './saveFile.js';

export const DEFAULT_DATA_URL = `${import.meta.env.BASE_URL}default-data.json`;

/** The parsed class pack, or null when there is none (or it is empty / broken). */
export async function fetchDefaultData(fetchFn = globalThis.fetch) {
  try {
    const res = await fetchFn(DEFAULT_DATA_URL, { cache: 'no-cache' });
    if (!res.ok) return null;
    const file = parseSaveFile(await res.text());
    return COLLECTIONS.some((c) => file[c].length) ? file : null;
  } catch {
    return null;
  }
}
