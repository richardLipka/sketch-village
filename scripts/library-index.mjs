// npm run library – rebuild public/library/index.json from the save files in
// public/library/ (SPEC §13c). Every *.json there (except the index) must be a
// valid save file; its `info` gives the title, description, author and small
// picture shown in the game's Library screen. Files without `info` get the name
// of their first map (or the file name) as the title.
//
//   node scripts/library-index.mjs          write the index
//   node scripts/library-index.mjs --check  only check it is up to date (CI)

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseSaveFile } from '../src/data/saveFile.js';

export const LIBRARY = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'public', 'library');
const FORMAT = 'sketch-village-library'; // data/library.js LIBRARY_FORMAT

/** The listing entry of one save file (`raw` = its text). */
export function entryOf(file, raw) {
  const f = parseSaveFile(raw);
  const info = f.info ?? {};
  const components = f.assets.length;
  return {
    file,
    title: info.title || f.maps[0]?.name || file.replace(/\.json$/i, ''),
    ...(info.description ? { description: info.description } : {}),
    ...(info.author ? { author: info.author } : {}),
    kind: f.maps.length === 1 ? 'map' : 'pack',
    maps: f.maps.length,
    components,
    size: Buffer.byteLength(raw.replace(/\r\n/g, '\n')), // the same on every system
    ...(info.thumbnail ? { thumbnail: info.thumbnail } : {}),
  };
}

/** The whole listing, sorted by file name (the order the game shows). */
export function buildIndex(dir = LIBRARY) {
  const files = fs.readdirSync(dir).filter((n) => n.endsWith('.json') && n !== 'index.json').sort();
  return {
    format: FORMAT,
    version: 1,
    files: files.map((n) => {
      try {
        return entryOf(n, fs.readFileSync(path.join(dir, n), 'utf8'));
      } catch (e) {
        throw new Error(`${n}: not a Sketch Village save file (${e.message})`);
      }
    }),
  };
}

export const indexText = (index) => `${JSON.stringify(index, null, 2)}\n`;

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const text = indexText(buildIndex());
  const target = path.join(LIBRARY, 'index.json');
  if (process.argv.includes('--check')) {
    const cur = fs.existsSync(target) ? fs.readFileSync(target, 'utf8') : '';
    if (cur.replace(/\r\n/g, '\n') !== text) {
      console.error('public/library/index.json is out of date – run: npm run library');
      process.exit(1);
    }
    console.log('library index is up to date');
  } else {
    fs.writeFileSync(target, text);
    console.log(`wrote ${target} (${JSON.parse(text).files.length} files)`);
  }
}
