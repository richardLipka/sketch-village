// Default enemy types (SPEC §16.4). Kids can change them in the enemy editor;
// the edited list is stored in the `enemyTypes` collection and replaces this one.
//   armor 0..1 = damage reduction, coins = [min, max] dropped,
//   ranged = shoots projectiles, flying = ignores roads and melee, boss = big.

export const DEFAULT_ENEMY_TYPES = [
  { id: 'goblin', name: { cs: 'Skřet', en: 'Goblin' }, hp: 25, speed: 45, damage: 4, cooldown: 1.0, range: 25, armor: 0, coins: [1, 2], color: '#16a34a' },
  { id: 'wolf', name: { cs: 'Vlk', en: 'Wolf' }, hp: 18, speed: 80, damage: 3, cooldown: 0.7, range: 25, armor: 0, coins: [1, 2], color: '#6b7280' },
  { id: 'archer', name: { cs: 'Lučištník', en: 'Archer' }, hp: 20, speed: 40, damage: 5, cooldown: 1.5, range: 150, armor: 0, coins: [2, 2], ranged: true, color: '#9333ea' },
  { id: 'orc', name: { cs: 'Zlobr', en: 'Orc' }, hp: 90, speed: 30, damage: 10, cooldown: 1.4, range: 30, armor: 0.15, coins: [3, 5], color: '#b45309' },
  { id: 'bat', name: { cs: 'Netopýr', en: 'Bat' }, hp: 15, speed: 55, damage: 3, cooldown: 1.0, range: 25, armor: 0, coins: [1, 2], flying: true, color: '#1f2937' },
  { id: 'troll', name: { cs: 'Troll', en: 'Troll' }, hp: 400, speed: 22, damage: 25, cooldown: 2.0, range: 40, armor: 0.25, coins: [20, 20], boss: true, color: '#0f766e' },
  { id: 'dragon', name: { cs: 'Drak', en: 'Dragon' }, hp: 300, speed: 25, damage: 20, cooldown: 2.0, range: 120, armor: 0.2, coins: [20, 20], flying: true, boss: true, ranged: true, color: '#dc2626' },
];

/** The effective enemy list: the kids' edited one, or the defaults. */
export function enemyTypesOf(db) {
  return db.enemyTypes?.length ? db.enemyTypes : DEFAULT_ENEMY_TYPES;
}
