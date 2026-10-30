// Buildings (SPEC §7, §16.3). A building type = name + features + levels
// (index 0 = level 1). Every level: cost (to build L1 / upgrade to it), time
// (base build time, shortened by workers), hp, round (available from this round)
// and the numbers of its features (config/features.js). Rebuild after
// destruction = L1 cost, back at level 1. The Town Hall is the `core` type: it
// stands in the centre from the start, its level caps all other levels and the
// game is lost when it falls. All of this is edited in the component editor.

// global building rules (Rules editor)
export const BUILD = {
  interactRadius: 90, // hero must be this close to a spot / the Town Hall edge
  workerSpeedup: 0.15, // buildTime = base / (1 + k × workers)
  regenPerSecond: 0.01, // × maxHp
  regenDelay: 5, // s after the last hit
  buildingRadius: 26,
  sellRefund: 0.7, // share of all coins spent on a building returned when it is sold
  // aggro = patrol distance for castles saved before soldierPatrol existed
  soldier: { speed: 80, range: 30, aggro: 160, radius: 12 },
};

export const HERO_UPGRADE_COSTS = [15, 30, 50]; // level n needs Town Hall level n

// HP tuned with the balance bot (balance.test.js): buildings beside the roads
// must survive enemies walking past while the towers shoot them.
export const DEFAULT_BUILDING_TYPES = [
  {
    id: 'townhall', core: true, name: { cs: 'Radnice', en: 'Town hall' }, features: ['shoots', 'healHero'],
    levels: [
      { cost: 0, time: 0, hp: 600, round: 1, damage: 5, range: 170, cooldown: 1.2, heal: 8, healRange: 80 },
      { cost: 60, time: 20, hp: 900, round: 3, damage: 8, range: 190, cooldown: 1.1, heal: 8, healRange: 80 },
      { cost: 100, time: 30, hp: 1200, round: 11, damage: 12, range: 210, cooldown: 1.0, heal: 8, healRange: 80 },
    ],
  },
  {
    id: 'house', name: { cs: 'Dům', en: 'House' }, features: ['workers'],
    levels: [
      { cost: 20, time: 10, hp: 400, round: 1, workers: 1 },
      { cost: 30, time: 12, hp: 600, round: 7, workers: 2 },
      { cost: 45, time: 15, hp: 800, round: 14, workers: 3 },
    ],
  },
  {
    id: 'tower', name: { cs: 'Věž', en: 'Tower' }, features: ['shoots'],
    levels: [
      { cost: 30, time: 12, hp: 500, round: 1, damage: 9, range: 180, cooldown: 1.0 },
      { cost: 45, time: 14, hp: 750, round: 5, damage: 15, range: 200, cooldown: 0.9 },
      { cost: 70, time: 18, hp: 1000, round: 12, damage: 22, range: 220, cooldown: 0.75 },
    ],
  },
  {
    id: 'castle', name: { cs: 'Hrad', en: 'Castle' }, features: ['soldiers'],
    levels: [
      { cost: 40, time: 15, hp: 750, round: 2, soldierCount: 3, soldierHp: 30, soldierDamage: 6, soldierCooldown: 1.0, soldierRespawn: 12, soldierPatrol: 160 },
      { cost: 60, time: 18, hp: 1100, round: 9, soldierCount: 3, soldierHp: 45, soldierDamage: 9, soldierCooldown: 1.0, soldierRespawn: 10, soldierPatrol: 180 },
      { cost: 90, time: 22, hp: 1500, round: 16, soldierCount: 3, soldierHp: 60, soldierDamage: 12, soldierCooldown: 1.0, soldierRespawn: 8, soldierPatrol: 200 },
    ],
  },
  {
    // area attack: slow, but every stone hurts a whole group on the road
    id: 'catapult', name: { cs: 'Katapult', en: 'Catapult' }, features: ['lobs'],
    levels: [
      { cost: 45, time: 16, hp: 550, round: 6, lobDamage: 14, lobRange: 230, lobCooldown: 3.2, lobSplash: 45 },
      { cost: 65, time: 18, hp: 800, round: 10, lobDamage: 22, lobRange: 250, lobCooldown: 3.0, lobSplash: 50 },
      { cost: 95, time: 22, hp: 1100, round: 15, lobDamage: 32, lobRange: 270, lobCooldown: 2.8, lobSplash: 55 },
    ],
  },
];

export const TOWN_HALL_LEVELS = DEFAULT_BUILDING_TYPES[0].levels;
