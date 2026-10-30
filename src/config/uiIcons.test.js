import { describe, it, expect } from 'vitest';
import { UI_ICONS, uiIconsOf, uiIconId } from './uiIcons.js';
import { DEFAULT_COMPONENTS, projectilesOf, soldierChoicesOf } from './components.js';
import { getCategory } from '../assets/categories.js';

describe('GUI icons', () => {
  it('every icon is a fixed built-in component of the studio', () => {
    for (const i of UI_ICONS) {
      const c = DEFAULT_COMPONENTS.find((x) => x.id === uiIconId(i.key));
      expect(c).toMatchObject({ category: 'icon', stats: { icon: i.key, emoji: i.emoji } });
    }
    expect(getCategory('icon').fixed).toBe(true);
  });
  it('only drawn icons replace the emoji', () => {
    const heart = { ...DEFAULT_COMPONENTS.find((x) => x.id === 'ui-heart'), images: ['data:image/png;base64,h'] };
    const coin = DEFAULT_COMPONENTS.find((x) => x.id === 'ui-coin');
    expect(uiIconsOf([heart, coin])).toEqual({ heart: 'data:image/png;base64,h' });
  });
});

describe('choices in the building and enemy editors', () => {
  const assets = [
    { id: 'p1', category: 'projectile', name: 'Fireball', images: ['data:image/png;base64,f'] },
    { id: 's1', category: 'soldier', name: 'Knight', images: [] },
    { id: 'goblin', category: 'enemy', name: { cs: 'Skřet', en: 'Goblin' }, images: [] },
  ];
  it('lists the drawn projectiles, and soldiers plus enemies for castles', () => {
    expect(projectilesOf(assets, 'en')).toEqual([{ id: 'p1', name: 'Fireball', image: 'data:image/png;base64,f' }]);
    const c = soldierChoicesOf(assets, 'en');
    expect(c.soldiers.map((s) => s.id)).toEqual(['s1']);
    expect(c.enemies.map((s) => s.name)).toEqual(['Goblin']);
  });
});
