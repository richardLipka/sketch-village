import { describe, it, expect } from 'vitest';
import { celebrationHeroes, fireworkPictures, heroPicture } from './endScreen.js';

const hero = (id, img = `data:${id}`) => ({ id, category: 'hero', images: img ? [img] : [] });

describe('celebrationHeroes', () => {
  it('the played hero in the middle and three others picked at random', () => {
    const all = ['a', 'b', 'c', 'd', 'e', 'f'].map((id) => hero(id));
    const row = celebrationHeroes(all[0], all, () => 0.5);
    expect(row).toHaveLength(4);
    expect(row.filter((h) => h.played).map((h) => h.id)).toEqual(['a']);
    expect(row[2].played).toBe(true);
    expect(new Set(row.map((h) => h.id)).size).toBe(4);
    // another random → other heroes
    const other = celebrationHeroes(all[0], all, () => 0.01).map((h) => h.id).sort();
    expect(other).not.toEqual(row.map((h) => h.id).sort());
  });

  it('fewer heroes, heroes without a picture, no played hero', () => {
    expect(celebrationHeroes(hero('a'), [hero('a'), hero('b')]).map((h) => h.id).sort()).toEqual(['a', 'b']);
    expect(celebrationHeroes(hero('a'), [hero('a'), hero('b', null)]).map((h) => h.id)).toEqual(['a']);
    const alone = celebrationHeroes(null, []);
    expect(alone).toEqual([{ id: 'hero', src: null, played: true }]);
  });

  it('a hero drawn only as an animation uses its first frame', () => {
    expect(heroPicture({ images: [], anims: { walk: { frames: ['data:f1', 'data:f2'] } } })).toBe('data:f1');
  });
});

describe('fireworkPictures', () => {
  it('the drawn projectiles, and the game’s own ones that were not redrawn', () => {
    const projectiles = [{ id: 'arrow', images: ['data:kid-arrow'] }, { id: 'p1', images: ['data:star'] }, { id: 'magicBolt', images: [] }];
    const defaults = [['arrow', 'data:arrow'], ['magicBolt', 'data:bolt'], ['catapultStone', 'data:stone']];
    expect(fireworkPictures(projectiles, defaults)).toEqual(['data:kid-arrow', 'data:star', 'data:bolt', 'data:stone']);
    expect(fireworkPictures([], [])).toEqual([]);
  });
});
