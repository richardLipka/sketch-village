import { describe, it, expect } from 'vitest';
import { DEFAULT_COMPONENTS, enemyTypesOf } from './components.js';
import { BUILT_IN_LEGENDS } from './legends.js';
import { OLD_DEFAULTS } from './oldDefaults.js';

// The chronicle's texts match the monsters: every built-in has a legend in both
// languages, the hints say what the numbers do, and no earlier text is today's.

const enemies = enemyTypesOf(DEFAULT_COMPONENTS);

describe('the chronicle’s texts', () => {
  it('every built-in monster has its story and hint in Czech and English', () => {
    for (const e of enemies) {
      for (const field of ['story', 'hint']) for (const lang of ['cs', 'en']) expect(e.legend?.[field]?.[lang], `${e.id} ${field} ${lang}`).toBeTruthy();
    }
    expect(Object.keys(BUILT_IN_LEGENDS).sort()).toEqual(enemies.map((e) => e.id).sort());
  });

  it('the hints match the numbers', () => {
    for (const e of enemies) {
      const hint = e.legend.hint.en.toLowerCase();
      if (/\bfl(y|ies)\b/.test(hint)) expect(e.flying, `${e.id} flies`).toBe(true);
      if (e.flying) expect(hint, `${e.id}`).toMatch(/fl(y|ies)/);
      if (/afar/.test(hint)) expect(e.ranged, `${e.id} shoots`).toBe(true);
      if (/armor|tough/.test(hint)) expect(e.armor, `${e.id} armor`).toBeGreaterThan(0);
      if (/\bfast\b/.test(hint)) expect(e.speed, `${e.id} speed`).toBeGreaterThanOrEqual(80);
      if (/calls|keep coming|spiderlings/.test(hint)) expect(e.minions.length > 0 || enemies.some((x) => x.minions?.includes(e.id)), `${e.id} minions`).toBe(true);
    }
  });

  it('names match the stories: the spider rider rides a spider, the goblin king is a king', () => {
    const story = (id) => enemies.find((e) => e.id === id).legend.story;
    expect(enemies.find((e) => e.id === 'wolf').name).toEqual({ cs: 'Pavoučí jezdec', en: 'Spider rider' });
    expect(story('wolf').cs).toMatch(/pavouk/);
    expect(story('wolf').en).toMatch(/spider/);
    expect(story('dragon').en).toMatch(/king/);
    expect(story('archer').en).toMatch(/shaman/i);
    expect(story('orc').en).toMatch(/hobgoblin/i);
  });

  it('today’s texts are never among the earlier ones the migration replaces', () => {
    for (const [id, fields] of Object.entries(OLD_DEFAULTS)) {
      const c = DEFAULT_COMPONENTS.find((x) => x.id === id);
      expect(c, id).toBeTruthy();
      for (const [field, langs] of Object.entries(fields)) {
        for (const [lang, texts] of Object.entries(langs)) {
          const now = field === 'name' ? c.name[lang] : c.legend[field][lang];
          expect(texts, `${id} ${field} ${lang}`).not.toContain(now);
        }
      }
    }
  });
});
