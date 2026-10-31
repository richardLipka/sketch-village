// The public library (SPEC §13c): ready-made save files in `public/library/` on
// the website, listed in `public/library/index.json` (made by
// `npm run library`). The Library screen is built from that list; a link with
// `?data=<file>` opens the game with that file loaded.
//
//   ?data=green-valley                      → library/green-valley.json
//   ?data=library/green-valley.json         → the same, relative to the game
//   ?data=https://example.org/my-map.json   → a file anywhere (asked first)

import { parseSaveFile } from './saveFile.js';

export const LIBRARY_FORMAT = 'sketch-village-library';
export const LIBRARY_VERSION = 1;
export const LIBRARY_DIR = 'library/';
export const DATA_PARAM = 'data';

const siteBase = () => new URL(import.meta.env.BASE_URL, globalThis.location?.href ?? 'http://localhost/').href;

/** A text in the player's language from `{ cs, en }` (or a plain string). */
export function localText(v, lang) {
  if (!v) return '';
  return typeof v === 'string' ? v : v[lang] ?? v.cs ?? Object.values(v)[0] ?? '';
}

/** Validate the listing; entries without a file name are dropped. */
export function parseLibrary(json) {
  const lib = typeof json === 'string' ? JSON.parse(json) : json;
  if (!lib || lib.format !== LIBRARY_FORMAT || !Array.isArray(lib.files)) throw new Error('library.error_format');
  return { ...lib, files: lib.files.filter((f) => f && typeof f.file === 'string' && f.file) };
}

/**
 * The address of a data file from the `?data=` value (or a library entry's file
 * name): a bare name is a file in the library, a relative path is relative to
 * the game, a full address must be http(s). null for anything else.
 */
export function resolveDataUrl(value, base = siteBase()) {
  const v = String(value ?? '').trim();
  if (!v) return null;
  let path = v;
  if (!/^[a-z][a-z0-9+.-]*:/i.test(v) && !v.startsWith('/')) {
    if (!v.includes('/')) path = `${LIBRARY_DIR}${v}`;
    if (!/\.json$/i.test(path)) path += '.json';
  }
  try {
    const url = new URL(path, base);
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.href : null;
  } catch {
    return null;
  }
}

/** Is the address on the game's own website (no need to ask before loading)? */
export const isOwnSite = (url, base = siteBase()) => new URL(url).origin === new URL(base).origin;

/** The `?data=` value of a page address (null when there is none). */
export function dataParam(href = globalThis.location?.href) {
  try {
    return new URL(href).searchParams.get(DATA_PARAM);
  } catch {
    return null;
  }
}

/** The page address without `?data=` – shown after the file is loaded, so a reload doesn't load it again. */
export function withoutDataParam(href) {
  const url = new URL(href);
  url.searchParams.delete(DATA_PARAM);
  return url.href;
}

/** A link that opens the game with a library file loaded: …/?data=green-valley */
export function shareLink(entry, base = siteBase()) {
  const url = new URL(base);
  url.search = '';
  url.hash = '';
  url.searchParams.set(DATA_PARAM, entry.file.replace(/\.json$/i, ''));
  return url.href;
}

export async function fetchLibrary(fetchFn = globalThis.fetch, base = siteBase()) {
  const res = await fetchFn(new URL(`${LIBRARY_DIR}index.json`, base).href, { cache: 'no-cache' });
  if (!res.ok) throw new Error('library.error_missing');
  return parseLibrary(await res.text());
}

/** Fetch and validate a save file; errors are translation keys. */
export async function fetchSaveFile(url, fetchFn = globalThis.fetch) {
  let res;
  try {
    res = await fetchFn(url, { cache: 'no-cache' });
  } catch {
    throw new Error('library.error_fetch');
  }
  if (!res.ok) throw new Error('library.error_fetch');
  const text = await res.text();
  // a web page instead of the file: a missing file on a site that answers with its own page
  if (/^\s*</.test(text)) throw new Error('library.error_fetch');
  return parseSaveFile(text);
}
