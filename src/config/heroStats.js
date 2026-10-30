// Hero skill points (SPEC §6.1, §16.2). The numbers live in HERO_RULES so the
// Rules editor can change them (rules.hero); heroNumbers turns points into stats.

export const HERO_STATS = ['melee', 'ranged', 'armor', 'speed', 'magic'];

export const HERO_RULES = {
  points: 12, // skill points to distribute (10 + 2 for magic, added later)
  statMax: 5, // max points in one stat
  hp: 100,
  meleeDamage: 10, meleePerPoint: 4, meleeRange: 40, meleeCooldown: 0.8,
  rangedDamage: 5, rangedPerPoint: 2, rangedRange: 200, rangedCooldown: 1.6, rangedCooldownPerPoint: 0.1, rangedMinCooldown: 0.6,
  armorPerPoint: 0.05, armorMax: 0.6,
  speed: 90, speedPerPoint: 12,
  // magic attack – only usable with a magic weapon equipped (its splash comes from the weapon);
  // every magic point makes the spells stronger
  magicDamage: 8, magicPerPoint: 3, magicRange: 160, magicCooldown: 1.8,
};

export const HERO_POINTS = HERO_RULES.points;
export const HERO_STAT_MAX = HERO_RULES.statMax;
export const HERO_BASE_HP = HERO_RULES.hp;

export const DEFAULT_HERO_POINTS = { melee: 3, ranged: 3, armor: 2, speed: 2, magic: 2 };

/** Concrete combat numbers for a points distribution (plus Town Hall upgrade levels). */
export function heroNumbers(points, upgrades = {}, r = HERO_RULES) {
  const p = (k) => (points[k] ?? 0) + (upgrades[k] ?? 0);
  return {
    hp: r.hp,
    melee: { damage: r.meleeDamage + r.meleePerPoint * p('melee'), range: r.meleeRange, cooldown: r.meleeCooldown },
    ranged: {
      damage: r.rangedDamage + r.rangedPerPoint * p('ranged'),
      range: r.rangedRange,
      cooldown: Math.max(r.rangedMinCooldown, +(r.rangedCooldown - r.rangedCooldownPerPoint * p('ranged')).toFixed(2)),
    },
    magic: { damage: (r.magicDamage ?? 8) + (r.magicPerPoint ?? 3) * p('magic'), range: r.magicRange ?? 160, cooldown: r.magicCooldown ?? 1.8 },
    armor: Math.min(r.armorMax, +(r.armorPerPoint * p('armor')).toFixed(3)),
    speed: r.speed + r.speedPerPoint * p('speed'),
  };
}

export function pointsUsed(points) {
  return HERO_STATS.reduce((s, k) => s + (points[k] ?? 0), 0);
}

/** A stored distribution squeezed into the current limits (rules may have changed). */
export function clampPoints(points, r = HERO_RULES) {
  const out = {};
  let left = r.points;
  for (const k of HERO_STATS) {
    out[k] = Math.max(0, Math.min(points[k] ?? 0, r.statMax, left));
    left -= out[k];
  }
  return out;
}
