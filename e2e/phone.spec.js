import { test, expect } from '@playwright/test';
import { watchErrors, openMenu, startGame } from './helpers.js';

// The phone held sideways (SPEC §4a), with a pretend iPhone notch on both
// sides and the home bar at the bottom: every control must be big enough for
// a finger, inside the safe area, and not on top of another one.
const NOTCH = { t: 0, r: 47, b: 21, l: 47 };

async function audit(page) {
  return page.evaluate((notch) => {
    const W = innerWidth, H = innerHeight;
    const visible = (el) => {
      const r = el.getBoundingClientRect();
      const s = getComputedStyle(el);
      return r.width > 0 && r.height > 0 && s.visibility !== 'hidden';
    };
    const buttons = [...document.querySelectorAll('.game-screen button')].filter(visible);
    const rect = (el) => { const r = el.getBoundingClientRect(); return { x: r.left, y: r.top, r: r.right, b: r.bottom, w: r.width, h: r.height }; };
    const name = (el) => `${el.className} "${(el.title || el.textContent).trim().slice(0, 20)}"`;
    const problems = [];
    for (const b of buttons) {
      const r = rect(b);
      if (r.w < 44 || r.h < 44) problems.push(`small ${name(b)} ${Math.round(r.w)}x${Math.round(r.h)}`);
      if (r.x < notch.l - 0.5 || r.r > W - notch.r + 0.5 || r.y < notch.t - 0.5 || r.b > H - notch.b + 0.5) problems.push(`outside the safe area ${name(b)}`);
    }
    for (let i = 0; i < buttons.length; i++) {
      for (let j = i + 1; j < buttons.length; j++) {
        const a = rect(buttons[i]), c = rect(buttons[j]);
        const ox = Math.min(a.r, c.r) - Math.max(a.x, c.x), oy = Math.min(a.b, c.b) - Math.max(a.y, c.y);
        if (ox > 1 && oy > 1) problems.push(`overlap ${name(buttons[i])} / ${name(buttons[j])}`);
      }
    }
    if (document.documentElement.scrollWidth > W + 1) problems.push('the page scrolls sideways');
    return { count: buttons.length, problems };
  }, NOTCH);
}

test.describe('phone held sideways', () => {
  test.skip(({ isMobile }) => !isMobile, 'phone layout only');

  test.beforeEach(async ({ page }) => {
    // safe-area insets as an iPhone reports them (sketch.css reads them through --sa-*)
    await page.addInitScript((n) => {
      document.addEventListener('DOMContentLoaded', () => {
        const s = document.createElement('style');
        s.textContent = `html:root { --sa-t: ${n.t}px; --sa-r: ${n.r}px; --sa-b: ${n.b}px; --sa-l: ${n.l}px; }`;
        document.head.appendChild(s);
      });
    }, NOTCH);
  });

  test('the game controls fit thumbs, the notch and each other', async ({ page }) => {
    const errors = watchErrors(page);
    await openMenu(page);
    await startGame(page);
    await expect(page.locator('.game-screen')).toHaveClass(/device-phone/);
    await page.waitForTimeout(1000);
    const plain = await audit(page);
    expect(plain.problems).toEqual([]);
    expect(plain.count).toBeGreaterThan(5);

    await page.getByTitle('Další').click(); // the ⋯ menu
    expect((await audit(page)).problems).toEqual([]);
    expect(errors).toEqual([]);
  });

  test('the menu and the save screen keep clear of the notch', async ({ page }) => {
    await openMenu(page);
    await page.getByRole('button', { name: /Uložit a nahrát/ }).click();
    const outside = await page.evaluate((n) => [...document.querySelectorAll('button')]
      .map((b) => b.getBoundingClientRect())
      .filter((r) => r.width && (r.left < n.l || r.right > innerWidth - n.r)).length, NOTCH);
    expect(outside).toBe(0);
  });
});
