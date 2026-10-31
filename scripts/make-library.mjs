// npm run make-library – (re)draw the example files of the public library
// (public/library/*.json, SPEC §13c) in a headless browser and rebuild the
// listing. Only needed when scripts/library/maker.js changes; files that
// teachers or kids add to public/library are left alone (npm run library
// refreshes the listing for them).

import fs from 'node:fs';
import path from 'node:path';
import { createServer } from 'vite';
import { chromium } from '@playwright/test';
import { LIBRARY, buildIndex, indexText } from './library-index.mjs';

const server = await createServer({ server: { port: 5199, strictPort: false }, logLevel: 'error' });
await server.listen();
const url = server.resolvedUrls.local[0];
// PW_CHANNEL=chrome uses the installed Chrome (like the browser tests)
const browser = await chromium.launch({ channel: process.env.PW_CHANNEL || undefined });
try {
  const page = await browser.newPage();
  page.on('pageerror', (e) => console.error('page error:', e.message));
  await page.goto(url);
  const made = await page.evaluate(async () => (await import('/scripts/library/maker.js')).makeLibrary());
  fs.mkdirSync(LIBRARY, { recursive: true });
  let bad = false;
  for (const m of made) {
    const text = `${JSON.stringify(m.file, null, 2)}\n`;
    fs.writeFileSync(path.join(LIBRARY, m.name), text);
    const ok = m.problems.length === 0;
    if (!ok) bad = true;
    console.log(`${m.name}: ${Math.round(text.length / 1024)} kB, ${m.spots} spots, ${m.decorations} decorations, ${ok ? 'valid' : `PROBLEMS ${JSON.stringify(m.problems)}`}, robot: ${m.results.join(' ')}`);
  }
  fs.writeFileSync(path.join(LIBRARY, 'index.json'), indexText(buildIndex()));
  console.log('index.json written');
  if (bad) process.exitCode = 1;
} finally {
  await browser.close();
  await server.close();
}
