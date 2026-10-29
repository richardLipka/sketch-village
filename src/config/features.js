// Building features (SPEC §7). A building type is a list of levels plus the
// features it has; each feature adds its own numbers to every level and its own
// behaviour in the game (src/logic/world.js). A new kind of building = a new
// combination of features, made in the component editor – no code needed.
// A new *feature* needs an entry here, its behaviour in world.js and its texts.

// numbers every building level has: [key, min, max, step]
export const LEVEL_FIELDS = [
  ['cost', 0, 999, 5],
  ['time', 1, 300, 1],
  ['hp', 1, 99999, 10],
  ['round', 1, 99, 1], // available from this round (progression)
];

export const FEATURES = {
  // houses: workers make all building and upgrading faster
  workers: { icon: '👷', fields: [['workers', 0, 20, 1]], defaults: { workers: 1 } },
  // towers (and the Town Hall): shoot the enemy in range nearest to the centre
  shoots: { icon: '🏹', fields: [['damage', 0, 500, 1], ['range', 30, 600, 10], ['cooldown', 0.1, 10, 0.05]], defaults: { damage: 8, range: 180, cooldown: 1 } },
  // castles: keep soldiers that fight ground enemies around them
  soldiers: {
    icon: '🛡️',
    fields: [['soldierCount', 1, 10, 1], ['soldierHp', 1, 999, 5], ['soldierDamage', 0, 200, 1], ['soldierCooldown', 0.1, 10, 0.1], ['soldierRespawn', 1, 120, 1]],
    defaults: { soldierCount: 3, soldierHp: 30, soldierDamage: 6, soldierCooldown: 1, soldierRespawn: 12 },
  },
  // markets, mines…: coins after every survived round
  income: { icon: '🪙', fields: [['income', 0, 200, 1]], defaults: { income: 5 } },
  // wells, temples, the Town Hall: heal the hero standing close
  healHero: { icon: '❤️', fields: [['heal', 0, 100, 1], ['healRange', 20, 400, 10]], defaults: { heal: 5, healRange: 80 } },
};

export const FEATURE_IDS = Object.keys(FEATURES);

export const hasFeature = (type, f) => !!type?.features?.includes(f);

/** A fresh level for a type with these features (numbers copied from `from` when given). */
export function newLevel(features, from = {}) {
  const lvl = { cost: 30, time: 12, hp: 400, round: 1 };
  for (const f of features) Object.assign(lvl, FEATURES[f]?.defaults);
  return { ...lvl, ...from };
}

/** Placeholder shape until a drawing exists – chosen from the main feature. */
export function shapeOf(type) {
  if (type?.core) return 'circle';
  if (hasFeature(type, 'soldiers')) return 'hexagon';
  if (hasFeature(type, 'shoots')) return 'triangle';
  if (hasFeature(type, 'workers')) return 'square';
  if (hasFeature(type, 'income')) return 'diamond';
  return 'pentagon';
}
