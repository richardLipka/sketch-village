// Default 20-round wave plan (SPEC §16.5). Each map can override it in the wave editor.
// Group: enemy, count, interval (s between two enemies), delay (s from wave start),
// spawn ('all' = spread over every cave, or a cave id).

import { BALANCE } from './balance.js';

// [enemy, count, interval, delay] – spawns spread over ~25–32 s so that a wave
// (spawning + walking + fighting) lasts about 40–60 s; checked by balance.test.js.
// Bosses come early in their wave so they don't drag it out.
// The class's monsters (config/enemies.js) all have their turn: goblin packs
// from round 6, the necromancer's skeleton warriors, the roc from round 14. The spider riders are
// faster than the old wolves, so fewer of them come late.
const PLAN = [
  [['goblin', 8, 4.0]],
  [['goblin', 10, 3.5]],
  [['goblin', 10, 3.0], ['wolf', 5, 4.0, 10]],
  [['goblin', 12, 2.5], ['archer', 3, 7.0, 8]],
  [['goblin', 10, 3.3], ['wolf', 7, 3.5, 5], ['archer', 4, 6.0, 8]],
  [['orc', 3, 6.0], ['goblinPack', 14, 2.2, 2]], // 6: the first goblin packs
  [['orc', 3, 6.0], ['wolf', 10, 2.4, 4], ['archer', 6, 4.0, 2]],
  [['spider', 1, 1, 0], ['goblin', 11, 2.5, 2], ['bat', 6, 3.0, 8]], // 8: a spider queen and her young
  [['orc', 4, 5.0], ['bat', 10, 2.8], ['archer', 7, 3.8, 3]],
  [['troll', 1, 1, 2], ['goblinPack', 12, 2.4]],
  [['goblin', 16, 2.0], ['wolf', 10, 2.9, 4], ['archer', 5, 5.0, 8]],
  [['necromancer', 1, 1, 0], ['orc', 4, 4.0, 2], ['bat', 10, 2.4, 3], ['archer', 6, 3.2, 2]], // 12: the first necromancer (skeletons and skeleton warriors)
  [['orc', 5, 4.0], ['wolf', 12, 2.2, 4], ['archer', 9, 3.0]],
  [['orc', 6, 3.5], ['goblinPack', 12, 2.4], ['bat', 14, 1.9, 3], ['rukh', 1, 1, 8]], // 14: the first roc
  [['dragon', 1, 1, 0], ['bat', 10, 1.8]], // 15: the goblin king (he calls his own goblins, hobgoblins and shamans)
  [['orc', 6, 3.0], ['goblin', 10, 2.6], ['goblinPack', 10, 2.6, 1], ['wolf', 10, 2.8, 2]],
  [['necromancer', 2, 8, 0], ['spider', 1, 1, 4], ['orc', 5, 3.0, 2], ['bat', 10, 1.8], ['archer', 8, 2.2]], // 17
  [['orc', 7, 2.8], ['wolf', 12, 2.0, 3], ['archer', 10, 2.5], ['bat', 8, 3.0, 3], ['rukh', 1, 1, 6]],
  [['troll', 1, 1, 0], ['spider', 1, 1, 4], ['orc', 8, 2.0, 2], ['bat', 16, 1.3], ['archer', 8, 2.4]], // 19: the troll and a spider queen
  [['dragon', 1, 1, 0], ['orc', 6, 2.6], ['goblinPack', 12, 1.5], ['bat', 6, 2.6], ['rukh', 1, 1, 6]], // 20: the goblin king leads
];

// stretches every spawn timeline; tuned with the bot so waves last 40–60 s now
// that the Town Hall shoots too
const SPREAD = 1.2;

export function defaultWaves(balance = BALANCE) {
  return {
    startCoins: balance.startCoins,
    firstPrep: balance.firstPrep,
    prep: balance.prep,
    rounds: PLAN.map((groups) => ({
      groups: groups.map(([enemy, count, interval, delay = 0]) => ({
        enemy, count, interval: +(interval * SPREAD).toFixed(2), delay: +(delay * SPREAD).toFixed(2), spawn: 'all',
      })),
    })),
  };
}

/** The wave config a map plays with. */
export function wavesOf(map, balance = BALANCE) {
  return map.waves?.rounds?.length ? map.waves : defaultWaves(balance);
}
