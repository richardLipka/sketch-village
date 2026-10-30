// Default enemy types (SPEC §16.4) – the built-in enemy components; kids change
// them (and add their own) in the component editor.
//   armor 0..1 = damage reduction, coins = [min, max] dropped,
//   ranged = shoots projectiles, flying = ignores roads and melee, boss = big,
//   size = drawing / body size (1 = normal),
//   minions = enemy ids it calls (one at random each time): minionCount every
//   minionEvery s while fewer than minionMax of its minions live; minionOnDeath
//   more when it dies. Minions never call minions themselves. summons = false
//   switches the ability off (the choice of minions is kept).
//   themes = which worlds it belongs to (config/themes.js); empty = every world.

export const DEFAULT_ENEMY_TYPES = [
  { id: 'goblin', name: { cs: 'Skřet', en: 'Goblin' }, hp: 25, speed: 45, damage: 4, cooldown: 1.0, range: 25, armor: 0, coins: [1, 2], color: '#16a34a', themes: ['goblinForest', 'plains'] },
  { id: 'wolf', name: { cs: 'Vlk', en: 'Wolf' }, hp: 18, speed: 80, damage: 3, cooldown: 0.7, range: 25, armor: 0, coins: [1, 2], color: '#6b7280', themes: ['plains', 'goblinForest'] },
  { id: 'archer', name: { cs: 'Lučištník', en: 'Archer' }, hp: 20, speed: 40, damage: 5, cooldown: 1.5, range: 150, armor: 0, coins: [2, 2], ranged: true, color: '#9333ea', themes: ['plains'] },
  { id: 'orc', name: { cs: 'Zlobr', en: 'Orc' }, hp: 90, speed: 30, damage: 10, cooldown: 1.4, range: 30, armor: 0.15, coins: [3, 5], color: '#b45309', themes: ['goblinForest', 'plains'] },
  { id: 'bat', name: { cs: 'Netopýr', en: 'Bat' }, hp: 15, speed: 55, damage: 3, cooldown: 1.0, range: 25, armor: 0, coins: [1, 2], flying: true, color: '#1f2937', themes: ['graveyard', 'necromancy'] },
  { id: 'troll', name: { cs: 'Troll', en: 'Troll' }, hp: 400, speed: 22, damage: 25, cooldown: 2.0, range: 40, armor: 0.25, coins: [20, 20], boss: true, color: '#0f766e', themes: ['goblinForest'] },
  { id: 'skeleton', name: { cs: 'Kostlivec', en: 'Skeleton' }, hp: 18, speed: 42, damage: 4, cooldown: 1.1, range: 25, armor: 0, coins: [1, 1], size: 0.85, color: '#d6d3d1', themes: ['necromancy', 'graveyard'] },
  { id: 'necromancer', name: { cs: 'Nekromant', en: 'Necromancer' }, hp: 90, speed: 26, damage: 7, cooldown: 1.8, range: 140, armor: 0.1, coins: [6, 8], ranged: true, color: '#4c1d95', minions: ['skeleton'], minionCount: 2, minionEvery: 8, minionMax: 6, minionOnDeath: 0, themes: ['necromancy', 'graveyard'] },
  { id: 'spiderling', name: { cs: 'Pavoučátko', en: 'Spiderling' }, hp: 8, speed: 70, damage: 2, cooldown: 0.8, range: 22, armor: 0, coins: [0, 1], size: 0.6, color: '#a16207', themes: ['goblinForest'] },
  { id: 'spider', name: { cs: 'Pavoučice', en: 'Spider queen' }, hp: 130, speed: 32, damage: 9, cooldown: 1.2, range: 28, armor: 0.1, coins: [5, 7], size: 1.3, color: '#7c2d12', minions: ['spiderling'], minionCount: 3, minionEvery: 9, minionMax: 6, minionOnDeath: 4, themes: ['goblinForest'] },
  { id: 'dragon', name: { cs: 'Drak', en: 'Dragon' }, hp: 280, speed: 36, damage: 20, cooldown: 2.0, range: 120, armor: 0.2, coins: [20, 20], flying: true, boss: true, ranged: true, color: '#dc2626', themes: ['plains'] },
];
