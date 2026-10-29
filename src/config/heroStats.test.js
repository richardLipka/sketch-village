import { describe, it, expect } from 'vitest';
import { heroNumbers, pointsUsed, DEFAULT_HERO_POINTS, HERO_POINTS } from './heroStats.js';

describe('hero stats', () => {
  it('default distribution uses exactly all points', () => {
    expect(pointsUsed(DEFAULT_HERO_POINTS)).toBe(HERO_POINTS);
  });

  it('matches the balance table (SPEC §16.2)', () => {
    const n = heroNumbers({ melee: 3, ranged: 3, armor: 2, speed: 2 });
    expect(n.melee.damage).toBe(22);
    expect(n.ranged).toMatchObject({ damage: 11, cooldown: 1.3, range: 200 });
    expect(n.armor).toBeCloseTo(0.1);
    expect(n.speed).toBe(114);
  });

  it('adds Town Hall upgrades and respects caps', () => {
    const n = heroNumbers({ ranged: 5, armor: 5 }, { ranged: 5, armor: 20 });
    expect(n.ranged.cooldown).toBe(0.6); // floor
    expect(n.armor).toBe(0.6); // cap
  });
});
