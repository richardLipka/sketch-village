// Default 20-round wave plan (SPEC §16.5). Each map can override it in the wave editor.
// Group: enemy, count, interval (s between two enemies), delay (s from wave start),
// spawn ('all' = spread over every cave, or a cave id).

import { BALANCE } from './balance.js';

// [enemy, count, interval, delay]
const PLAN = [
  [['goblin', 6, 2.0]],
  [['goblin', 8, 1.8]],
  [['goblin', 8, 1.6], ['wolf', 4, 2.0, 6]],
  [['goblin', 10, 1.5], ['archer', 3, 3.0]],
  [['goblin', 6, 1.4], ['wolf', 6, 1.4], ['archer', 4, 2.5]],
  [['goblin', 12, 1.2], ['orc', 2, 5.0, 8]],
  [['wolf', 8, 1.0], ['archer', 6, 2.0], ['orc', 2, 5.0]],
  [['goblin', 10, 1.2], ['bat', 6, 1.5, 5]],
  [['bat', 8, 1.2], ['archer', 6, 2.0], ['orc', 3, 4.0]],
  [['goblin', 10, 1.0], ['troll', 1, 1, 10]],
  [['goblin', 14, 0.9], ['wolf', 8, 1.0], ['archer', 4, 2.0]],
  [['bat', 10, 1.0], ['archer', 6, 1.8], ['orc', 4, 3.5]],
  [['wolf', 12, 0.8], ['archer', 8, 1.6], ['orc', 4, 3.0]],
  [['goblin', 10, 0.8], ['bat', 14, 0.9], ['orc', 5, 3.0]],
  [['bat', 8, 1.0], ['archer', 8, 1.5], ['dragon', 1, 1, 12]],
  [['goblin', 20, 0.6], ['wolf', 10, 0.8], ['orc', 6, 2.5]],
  [['bat', 12, 0.8], ['archer', 10, 1.2], ['orc', 6, 2.5]],
  [['wolf', 16, 0.6], ['archer', 12, 1.0], ['orc', 8, 2.0], ['bat', 8, 1.0]],
  [['bat', 20, 0.6], ['archer', 10, 1.0], ['orc', 10, 2.0]],
  [['goblin', 15, 0.6], ['bat', 10, 0.8], ['orc', 8, 2.0], ['troll', 1, 1, 15], ['dragon', 1, 1, 15]],
];

export function defaultWaves() {
  return {
    startCoins: BALANCE.startCoins,
    firstPrep: BALANCE.firstPrep,
    prep: BALANCE.prep,
    rounds: PLAN.map((groups) => ({
      groups: groups.map(([enemy, count, interval, delay = 0]) => ({ enemy, count, interval, delay, spawn: 'all' })),
    })),
  };
}

/** The wave config a map plays with. */
export function wavesOf(map) {
  return map.waves?.rounds?.length ? map.waves : defaultWaves();
}
