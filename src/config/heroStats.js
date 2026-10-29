// Hero skill points (SPEC §6.1, §16.2).

export const HERO_POINTS = 10;
export const HERO_STAT_MAX = 5;
export const HERO_BASE_HP = 100;
export const HERO_STATS = ['melee', 'ranged', 'armor', 'speed'];

export const DEFAULT_HERO_POINTS = { melee: 3, ranged: 3, armor: 2, speed: 2 };

/** Concrete combat numbers for a points distribution (plus Town Hall upgrade levels). */
export function heroNumbers(points, upgrades = {}) {
  const p = (k) => (points[k] ?? 0) + (upgrades[k] ?? 0);
  return {
    hp: HERO_BASE_HP,
    melee: { damage: 10 + 4 * p('melee'), range: 40, cooldown: 0.8 },
    ranged: { damage: 5 + 2 * p('ranged'), range: 200, cooldown: Math.max(0.6, +(1.6 - 0.1 * p('ranged')).toFixed(2)) },
    armor: Math.min(0.6, 0.05 * p('armor')),
    speed: 90 + 12 * p('speed'),
  };
}

export function pointsUsed(points) {
  return HERO_STATS.reduce((s, k) => s + (points[k] ?? 0), 0);
}
