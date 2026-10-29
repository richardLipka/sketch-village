// Buildings (SPEC §7, §16.3). Level arrays: index 0 = level 1.
// cost = coins to build (L1) or upgrade to that level; time = base build time in s
// (shortened by workers); rebuild after destruction = L1 cost, back at level 1.

export const BUILD = {
  interactRadius: 90, // hero must be this close to a spot / the Town Hall edge
  workerSpeedup: 0.15, // buildTime = base / (1 + k × workers)
  regenPerSecond: 0.01, // × maxHp
  regenDelay: 5, // s after the last hit
  buildingRadius: 26,
  sellRefund: 0.7, // share of all coins spent on a building returned when it is sold
  soldier: { speed: 80, range: 30, aggro: 150, max: 3, radius: 12 },
};

// HP tuned with the balance bot (balance.test.js): buildings beside the roads
// must survive enemies walking past while the towers shoot them.
export const TOWN_HALL_LEVELS = [
  { hp: 600 },
  { cost: 60, time: 20, hp: 900 },
  { cost: 100, time: 30, hp: 1200 },
];

export const HERO_UPGRADE_COSTS = [15, 30, 50]; // level n needs Town Hall level n

export const DEFAULT_BUILDING_TYPES = [
  {
    id: 'house', name: { cs: 'Dům', en: 'House' },
    levels: [
      { cost: 20, time: 10, hp: 400, workers: 1 },
      { cost: 30, time: 12, hp: 600, workers: 2 },
      { cost: 45, time: 15, hp: 800, workers: 3 },
    ],
  },
  {
    id: 'tower', name: { cs: 'Věž', en: 'Tower' },
    levels: [
      { cost: 30, time: 12, hp: 500, damage: 9, range: 180, cooldown: 1.0 },
      { cost: 45, time: 14, hp: 750, damage: 15, range: 200, cooldown: 0.9 },
      { cost: 70, time: 18, hp: 1000, damage: 22, range: 220, cooldown: 0.75 },
    ],
  },
  {
    id: 'castle', name: { cs: 'Hrad', en: 'Castle' },
    levels: [
      { cost: 40, time: 15, hp: 750, soldierHp: 30, soldierDamage: 6, soldierCooldown: 1.0, soldierRespawn: 12 },
      { cost: 60, time: 18, hp: 1100, soldierHp: 45, soldierDamage: 9, soldierCooldown: 1.0, soldierRespawn: 10 },
      { cost: 90, time: 22, hp: 1500, soldierHp: 60, soldierDamage: 12, soldierCooldown: 1.0, soldierRespawn: 8 },
    ],
  },
];

export function buildingTypesOf(db) {
  return db.buildingTypes?.length ? db.buildingTypes : DEFAULT_BUILDING_TYPES;
}
