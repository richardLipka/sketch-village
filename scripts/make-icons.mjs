// Renders public/icons/icon.svg into the PNG sizes the web app manifest and
// iOS need (run once after changing the SVG: node scripts/make-icons.mjs).
import { chromium } from '@playwright/test';
import fs from 'node:fs';

const svg = fs.readFileSync('public/icons/icon.svg', 'utf8');
const browser = await chromium.launch({ channel: process.env.PW_CHANNEL || undefined });
const page = await browser.newPage();
for (const [name, size] of [['icon-192.png', 192], ['icon-512.png', 512], ['apple-touch-icon.png', 180]]) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(`<style>html,body{margin:0}svg{display:block;width:${size}px;height:${size}px}</style>${svg}`);
  await page.screenshot({ path: `public/icons/${name}` });
}
await browser.close();
