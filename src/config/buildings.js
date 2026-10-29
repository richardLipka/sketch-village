// Buildings (SPEC §7, §16.3). Level arrays: index 0 = level 1.
// cost = coins to build (L1) or upgrade to that level; time = base build time in s
// (shortened by workers); rebuild after destruction = L1 cost, back at level 1.

export const BUILD = {
  interactRadius: 90, // hero must be this close to a spot / the Town Hall edge
  workerSpeedup: 0.15, // buildTime = base / (1 + k × workers)
  regenPerSecond: 0.01, // × maxHp
  regenDelay: 5, // s after the last hit
  buildingRadius: 26,
  soldier: { speed: 80, range: 30, aggro: 150, max: 3, radius: 12 },
};

export const TOWN_HALL_LEVELS = [
  { hp: 300 },
  { cost: 60, time: 20, hp: 450 },
  { cost: 100, time: 30, hp: 600 },
];

export const HERO_UPGRADE_COSTS = [15, 30, 50]; // level n needs Town Hall level n

export const DEFAULT_BUILDING_TYPES = [
  {
    id: 'house', name: { cs: 'Dům', en: 'House' },
    levels: [
      { cost: 20, time: 10, hp: 80, workers: 1 },
      { cost: 30, time: 12, hp: 120, workers: 2 },
      { cost: 45, time: 15, hp: 160, workers: 3 },
    ],
  },
  {
    id: 'tower', name: { cs: 'Věž', en: 'Tower' },
    levels: [
      { cost: 30, time: 12, hp: 100, damage: 6, range: 180, cooldown: 1.0 },
      { cost: 45, time: 14, hp: 150, damage: 10, range: 200, cooldown: 0.9 },
      { cost: 70, time: 18, hp: 200, damage: 15, range: 220, cooldown: 0.75 },
    ],
  },
  {
    id: 'castle', name: { cs: 'Hrad', en: 'Castle' },
    levels: [
      { cost: 40, time: 15, hp: 150, soldierHp: 30, soldierDamage: 4, soldierCooldown: 1.0, soldierRespawn: 12 },
      { cost: 60, time: 18, hp: 220, soldierHp: 45, soldierDamage: 6, soldierCooldown: 1.0, soldierRespawn: 10 },
      { cost: 90, time: 22, hp: 300, soldierHp: 60, soldierDamage: 8, soldierCooldown: 1.0, soldierRespawn: 8 },
    ],
  },
];

export function buildingTypesOf(db) {
  return db.buildingTypes?.length ? db.buildingTypes : DEFAULT_BUILDING_TYPES;
}
