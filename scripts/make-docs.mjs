// The Czech documentation as a PDF (SPEC §18): docs/src/kreslena-vesnice.html →
// public/docs/kreslena-vesnice.pdf, which the website serves.
// npm run docs   (PW_CHANNEL=chrome uses the installed Chrome)
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const src = path.resolve('docs/src/kreslena-vesnice.html');
const out = path.resolve('public/docs/kreslena-vesnice.pdf');
mkdirSync(path.dirname(out), { recursive: true });

const browser = await chromium.launch({ channel: process.env.PW_CHANNEL || undefined });
const page = await browser.newPage();
await page.goto(pathToFileURL(src).href, { waitUntil: 'load' });
await page.pdf({
  path: out,
  format: 'A4',
  printBackground: true,
  preferCSSPageSize: true,
  displayHeaderFooter: true,
  headerTemplate: '<span></span>',
  footerTemplate: '<div style="width:100%;font-size:8px;color:#3e5599;text-align:center;font-family:Segoe UI,Arial">Kreslená vesnice – dokumentace · <span class="pageNumber"></span> / <span class="totalPages"></span></div>',
});
await browser.close();
console.log(path.relative('.', out));
