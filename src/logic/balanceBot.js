// A simple "average kid" bot that plays the default 20 rounds on a test map.
// Used by balance.test.js to check that the numbers in the rules are fair:
// a sensible build order should win, and buildings next to the roads should
// not all be destroyed by enemies walking past.
//
// It also plays the kids' own maps and waves ("Let the robot try" in the wave
// editor, maps/mapTest.js): the build order is then laid onto that map's spots
// (nearest to the Town Hall first) and its building kinds (by what they do).

import { World } from './world.js';
import { DEFAULT_ENEMY_TYPES } from '../config/enemies.js';
import { DEFAULT_BUILDING_TYPES } from '../config/buildings.js';
import { DEFAULT_RULES } from '../config/rules.js';
import { defaultWaves } from '../config/waves.js';

const COLS = 80, ROWS = 45, CELL = 16;

// Four roads (3 cells wide) from caves on every edge to the centre, with bends,
// and ten building spots close to the roads around the village.
export function testMap() {
  const walk = new Uint8Array(COLS * ROWS);
  const road = (x0, y0, x1, y1) => {
    for (let x = Math.min(x0, x1); x <= Math.max(x0, x1); x++) {
      for (let y = Math.min(y0, y1); y <= Math.max(y0, y1); y++) {
        for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) {
          const cx = x + dx, cy = y + dy;
          if (cx >= 0 && cy >= 0 && cx < COLS && cy < ROWS) walk[cy * COLS + cx] = 1;
        }
      }
    }
  };
  road(0, 10, 20, 10); road(20, 10, 20, 22); road(20, 22, 40, 22); // left, bends down
  road(40, 0, 40, 22); // top
  road(79, 34, 60, 34); road(60, 34, 60, 22); road(60, 22, 40, 22); // right, bends up
  road(30, 44, 30, 30); road(30, 30, 40, 30); road(40, 30, 40, 22); // bottom
  const map = {
    centre: { x: 648, y: 360, radius: 60 },
    caves: [{ id: 'l', x: 8, y: 168 }, { id: 't', x: 648, y: 8 }, { id: 'r', x: 1272, y: 552 }, { id: 'b', x: 488, y: 712 }],
    heroRespawn: { x: 648, y: 420 },
    spots: [
      [560, 410], [740, 410], [560, 305], [740, 305], [430, 305],
      [880, 305], [590, 210], [705, 210], [430, 410], [880, 410],
    ].map(([x, y], i) => ({ id: `s${i + 1}`, x, y })),
  };
  return { map, grid: { cols: COLS, rows: ROWS, cell: CELL, walk } };
}

// Build order: what an average player buys, in this order, when coins allow.
const PLAN = [
  ['build', 's1', 'tower'], ['build', 's2', 'house'], ['build', 's3', 'tower'], ['th'],
  ['build', 's4', 'castle'], ['up', 's1'], ['up', 's3'], ['hero', 'ranged'], ['build', 's5', 'tower'],
  ['build', 's6', 'catapult'], ['up', 's2'], ['th'], ['up', 's1'], ['up', 's3'], ['up', 's4'],
  ['hero', 'armor'], ['build', 's7', 'tower'], ['build', 's8', 'tower'], ['up', 's5'], ['up', 's6'],
  ['up', 's4'], ['up', 's5'], ['up', 's6'], ['build', 's9', 'castle'], ['hero', 'ranged'],
  ['up', 's7'], ['up', 's8'], ['build', 's10', 'house'], ['up', 's7'], ['up', 's8'], ['hero', 'armor'], ['hero', 'ranged'],
];

const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

// the plan's building kinds and the feature that stands in for each on other data
const ROLE_FEATURE = { tower: 'shoots', house: 'workers', castle: 'soldiers', catapult: 'lobs' };

/** The build order laid onto a map's spots and the building types it has. */
export function planFor(map, buildingTypes) {
  const centre = map.centre;
  const spots = [...map.spots].sort((a, b) => dist(a, centre) - dist(b, centre));
  const spotOf = (id) => spots[Number(id.slice(1)) - 1]?.id;
  const onSpots = buildingTypes.filter((t) => !t.core);
  const typeOf = (role) => (onSpots.find((t) => t.id === role) ?? onSpots.find((t) => t.features?.includes(ROLE_FEATURE[role])))?.id;
  return PLAN.flatMap((s) => {
    if (s[0] === 'build') {
      const spot = spotOf(s[1]), type = typeOf(s[2]);
      return spot && type ? [['build', spot, type]] : [];
    }
    if (s[0] === 'up') { const spot = spotOf(s[1]); return spot ? [['up', spot]] : []; }
    return [s];
  });
}

export const DT = 1 / 30; // s of game time per step

/**
 * A new game: the World and the bot's notes. The notes are plain data, so a
 * game can be copied at any moment (`w.clone()` + `structuredClone(bot)`) and
 * played on from there – the wave limit test does (logic/waveLimit.js).
 * careful = goes back to the Town Hall to heal when hurt; a careless bot runs out of lives.
 * map / grid / waves / enemyTypes default to the test map with the built-in plan.
 */
export function startGame({
  rules = DEFAULT_RULES, buildingTypes = DEFAULT_BUILDING_TYPES, seed = 1, careful = true,
  map: ownMap, grid: ownGrid, waves, enemyTypes = DEFAULT_ENEMY_TYPES, weapons, coinTypes, heroPoints, difficulty,
  plan = ownMap ? planFor(ownMap, buildingTypes) : PLAN,
} = {}) {
  const { map, grid } = ownMap ? { map: ownMap, grid: ownGrid } : testMap();
  const w = new World({
    map, grid, enemyTypes, buildingTypes, rules, waves: waves ?? defaultWaves(rules.balance), seed, difficulty,
    ...(weapons ? { weapons } : {}), ...(coinTypes ? { coinTypes } : {}), ...(heroPoints ? { heroPoints } : {}),
  });
  w.setMode('ranged');
  const bot = {
    plan, careful, done: plan.map(() => false), rebuilds: [], healing: false, think: 0, t: 0,
    home: { x: w.townHall.x, y: w.townHall.y + 50 },
    stats: [], cur: { destroyed: 0, minTownHall: w.townHall.hp, livesLost: 0 },
  };
  return { w, bot };
}

/** One step: the world moves on, the bot notes what happened and decides. Returns the world's events. */
export function stepGame(w, bot, dt = DT, onTick) {
  w.update(dt);
  bot.t += dt;
  onTick?.(w);
  const events = w.drainEvents();
  let cur = bot.cur;
  for (const e of events) {
    if (e.type === 'buildingDestroyed') { cur.destroyed++; bot.rebuilds.push(['build', e.spotId, e.building]); }
    if (e.type === 'heroLostLife') cur.livesLost++;
    if (e.type === 'coinPicked') cur.picked = (cur.picked ?? 0) + 1;
    if (e.type === 'coinExpired') cur.expired = (cur.expired ?? 0) + 1;
    if (e.type === 'waveStart') cur.waveStart = w.time;
    if (e.type === 'unlocked') cur.unlocked = e.keys;
    if (e.type === 'roundEnd') {
      bot.stats.push({ round: e.round, ...cur, defeated: e.stats.defeated, waveLength: w.time - cur.waveStart, coins: w.coins, buildings: w.buildings.filter((b) => b.state !== 'ruin').length });
      cur = bot.cur = { destroyed: 0, minTownHall: w.townHall.hp, livesLost: 0, picked: 0, expired: 0 };
    }
  }
  cur.minTownHall = Math.min(cur.minTownHall, w.townHall.hp);
  decide(w, bot, dt);
  return events;
}

/** Play one game; returns per-round stats and the result. */
export function playGame({ onTick, ...setup } = {}) {
  const { w, bot } = startGame(setup);
  const limit = 200 * w.totalRounds; // game seconds – a stuck game ends as 'timeout'
  while (bot.t < limit && w.phase !== 'won' && w.phase !== 'lost') stepGame(w, bot, DT, onTick);
  return { result: w.phase, round: w.round, stats: bot.stats, coins: w.coins, planDone: bot.done.filter(Boolean).length, world: w, rebuilds: bot.rebuilds };
}

// the first plan step that isn't done and isn't locked / waiting (it may still cost too much)
function nextStep(w, bot) {
  for (const [i, s] of bot.plan.entries()) {
    if (bot.done[i]) continue;
    const c = costOf(w, s);
    if (c === null) { bot.done[i] = true; continue; }
    if (c !== Infinity) return i;
  }
  return -1;
}

const targetOf = (w, s) => (s[0] === 'th' || s[0] === 'hero' ? w.townHall : w.spots.find((p) => p.id === s[1]));
function doStep(w, s) {
  if (s[0] === 'build') return w.build(s[1], s[2]);
  if (s[0] === 'up') return w.upgrade(s[1]);
  if (s[0] === 'th') return w.upgradeTownHall();
  return w.upgradeHero(s[1]);
}
const nearStep = (w, s) => (s[0] === 'th' || s[0] === 'hero' ? w.heroNear(w.townHall, w.townHall.radius) : w.heroNear(targetOf(w, s)));

// What the bot does every half second: heal, rebuild, follow the plan, hunt, loot, guard.
function decide(w, bot, dt) {
  bot.think -= dt;
  if (bot.think > 0 || w.hero.dead) return;
  bot.think = 0.5;
  const h = w.hero, home = bot.home;
  // 0) every lost life counts: when hurt, walk back to the Town Hall and heal up
  if (bot.careful && h.hp < h.maxHp * 0.4) bot.healing = true;
  if (bot.healing) {
    if (h.hp >= h.maxHp * 0.8) bot.healing = false;
    else {
      if (dist(h, home) > 30 && !h.path.length) w.moveHeroTo(home.x, home.y);
      return;
    }
  }
  const danger = w.enemies.some((e) => dist(e, h) < 160);
  // 1) rebuild ruins first, then follow the plan
  const idx = bot.rebuilds.length ? -1 : nextStep(w, bot);
  const s = bot.rebuilds[0] ?? bot.plan[idx];
  if (s) {
    const cost = costOf(w, s);
    const finish = () => { if (idx < 0) bot.rebuilds.shift(); else bot.done[idx] = true; };
    if (cost !== null && cost !== Infinity && w.coins >= cost && (!danger || w.phase === 'prep')) {
      if (nearStep(w, s)) {
        const r = doStep(w, s);
        if (r.ok || ['max', 'occupied'].includes(r.reason)) finish();
      } else if (!h.path.length) {
        const p = targetOf(w, s);
        w.moveHeroTo(p.x, p.y);
      }
      return;
    }
    if (cost === null) finish();
  }
  // 2) go after an enemy that attacks a building or soldiers away from the
  //    Town Hall (a kid clicks it), flying ones only with the bow
  if (!danger && !h.target) {
    const busy = w.enemies.filter((e) => e.attacking && e.victim?.kind !== 'hero' && dist(e, w.townHall) > 160);
    if (busy.length) {
      const e = busy.reduce((a, b) => (dist(b, h) < dist(a, h) ? b : a));
      w.attack(e.id);
      return;
    }
  }
  // 3) pick up coins and weapon chests when it is safe
  const loot = [...w.chests, ...w.coinsOnGround];
  if (!danger && loot.length && !h.path.length) {
    const c = loot.reduce((a, b) => (dist(b, h) < dist(a, h) ? b : a));
    w.moveHeroTo(c.x, c.y);
    return;
  }
  // 4) otherwise guard the Town Hall
  if (!danger && !w.coinsOnGround.length && !h.path.length && dist(h, home) > 20) w.moveHeroTo(home.x, home.y);
}

// Coins the step needs now; Infinity = not possible yet (locked, busy, needs a
// higher Town Hall, not built yet); null = never needed any more.
function costOf(w, s) {
  if (s[0] === 'build') {
    const b = w.buildingOn(s[1]);
    if (b && b.state !== 'ruin') return null;
    if (!w.unlocked(`${s[2]}:1`)) return Infinity;
    return w.buildingTypes[s[2]].levels[0].cost;
  }
  if (s[0] === 'up') {
    const b = w.buildingOn(s[1]);
    if (!b) return Infinity;
    const t = w.buildingTypes[b.type];
    if (b.level >= t.levels.length) return null;
    if (b.state !== 'ready' || b.level >= w.townHall.level || !w.unlocked(`${b.type}:${b.level + 1}`)) return Infinity;
    return t.levels[b.level].cost;
  }
  if (s[0] === 'th') {
    const lvl = w.townHall.level;
    if (lvl >= w.thLevels.length) return null;
    return w.townHall.upgrade || !w.unlocked(`townhall:${lvl + 1}`) ? Infinity : w.thLevels[lvl].cost;
  }
  const lvl = w.heroUpgrades[s[1]];
  if (lvl >= w.heroCosts.length) return null;
  return lvl + 1 > w.townHall.level || !w.unlocked(`hero:${s[1]}:${lvl + 1}`) ? Infinity : w.heroCosts[lvl];
}
