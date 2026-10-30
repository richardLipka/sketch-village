import { describe, it, expect } from 'vitest';
import { World } from './world.js';
import { DEFAULT_ENEMY_TYPES } from '../config/enemies.js';
import { TOWN_HALL_LEVELS, HERO_UPGRADE_COSTS, DEFAULT_BUILDING_TYPES } from '../config/buildings.js';
import { DEFAULT_RULES, mergeRules, rulesOf } from '../config/rules.js';
import { COLLECTIONS } from '../data/saveFile.js';
import { DEFAULT_UNLOCKS } from '../config/unlocks.js';

// Plus-shaped roads (3 cells wide) crossing at the centre; spots next to the roads.
// these tests check buildings, not the unlock schedule → everything from round 1
const OPEN = { ...DEFAULT_RULES, unlocks: [] };
const OPEN_TYPES = DEFAULT_BUILDING_TYPES.map((t) => ({ ...t, levels: t.levels.map((l) => ({ ...l, round: 1 })) }));
const withType = (id, patch) => OPEN_TYPES.map((t) => (t.id === id ? { ...t, ...patch } : t));

function makeWorld({ coins = 500, rounds = [{ groups: [] }, { groups: [] }], rules = OPEN, buildingTypes = OPEN_TYPES } = {}) {
  const cols = 80, rows = 45, cell = 16;
  const walk = new Uint8Array(cols * rows);
  for (let x = 0; x < cols; x++) for (const y of [21, 22, 23]) walk[y * cols + x] = 1;
  for (let y = 0; y < rows; y++) for (const x of [39, 40, 41]) walk[y * cols + x] = 1;
  const map = {
    centre: { x: 648, y: 360, radius: 60 },
    caves: [{ id: 'left', x: 10, y: 360 }, { id: 'top', x: 648, y: 10 }],
    heroRespawn: { x: 648, y: 420 },
    spots: [
      { id: 's1', x: 560, y: 315 }, // near the centre, left
      { id: 's2', x: 740, y: 315 }, // near the centre, right
      { id: 's3', x: 300, y: 315 }, // on the left road, far from the hero start
      { id: 's4', x: 560, y: 405 },
    ],
  };
  const w = new World({
    map, grid: { cols, rows, cell, walk }, enemyTypes: DEFAULT_ENEMY_TYPES, seed: 7, rules, buildingTypes,
    waves: { startCoins: coins, firstPrep: 10000, prep: 10000, rounds },
  });
  return w;
}

const run = (w, seconds, dt = 1 / 30) => { for (let t = 0; t < seconds && w.phase !== 'lost' && w.phase !== 'won'; t += dt) w.update(dt); };
const goTo = (w, p) => { w.moveHeroTo(p.x, p.y); run(w, 15); };
const spot = (w, id) => w.spots.find((s) => s.id === id);
const hpOf = (type, level) => DEFAULT_BUILDING_TYPES.find((t) => t.id === type).levels[level - 1].hp;

describe('building', () => {
  it('needs the hero nearby and enough coins', () => {
    const w = makeWorld({ coins: 25 });
    expect(w.build('s3', 'house')).toEqual({ ok: false, reason: 'far' });
    goTo(w, spot(w, 's1'));
    expect(w.build('s1', 'tower')).toEqual({ ok: false, reason: 'coins' });
    expect(w.build('s1', 'house')).toEqual({ ok: true });
    expect(w.coins).toBe(5);
    expect(w.build('s1', 'house').reason).toBe('occupied');
  });

  it('a house finishes after its build time and adds a worker', () => {
    const w = makeWorld();
    goTo(w, spot(w, 's1'));
    w.build('s1', 'house');
    expect(w.workers).toBe(0); // under construction
    run(w, 9.5);
    expect(w.buildingOn('s1').state).toBe('building');
    run(w, 1);
    expect(w.buildingOn('s1')).toMatchObject({ state: 'ready', level: 1, hp: hpOf('house', 1) });
    expect(w.workers).toBe(1);
  });

  it('workers speed up construction', () => {
    const w = makeWorld();
    goTo(w, spot(w, 's1'));
    w.build('s1', 'house');
    run(w, 11);
    w.build('s4', 'house');
    run(w, 11);
    expect(w.workers).toBe(2);
    goTo(w, spot(w, 's2'));
    expect(w.build('s2', 'tower').ok).toBe(true); // 12 s base / (1 + 0.15 × 2) ≈ 9.2 s
    run(w, 9.5);
    expect(w.buildingOn('s2').state).toBe('ready');
  });

  it('building upgrades are capped by the Town Hall level', () => {
    const w = makeWorld();
    goTo(w, spot(w, 's1'));
    w.build('s1', 'tower');
    run(w, 13);
    expect(w.upgrade('s1').reason).toBe('townhall');
    goTo(w, w.townHall);
    expect(w.upgradeTownHall()).toEqual({ ok: true });
    expect(w.upgradeTownHall().reason).toBe('busy');
    run(w, TOWN_HALL_LEVELS[1].time + 0.5);
    expect(w.townHall).toMatchObject({ level: 2, maxHp: TOWN_HALL_LEVELS[1].hp });
    goTo(w, spot(w, 's1'));
    expect(w.upgrade('s1')).toEqual({ ok: true });
    expect(w.upgrade('s1').reason).toBe('busy');
    run(w, 15);
    expect(w.buildingOn('s1')).toMatchObject({ level: 2, state: 'ready', maxHp: hpOf('tower', 2) });
    expect(w.upgrade('s1').reason).toBe('townhall');
  });
});

describe('town hall hero upgrades', () => {
  it('cost coins, need the hero at the Town Hall and its level', () => {
    const w = makeWorld();
    goTo(w, spot(w, 's3'));
    expect(w.upgradeHero('ranged').reason).toBe('far');
    goTo(w, w.townHall);
    const before = w.heroStats.ranged.damage;
    expect(w.upgradeHero('ranged')).toEqual({ ok: true });
    expect(w.coins).toBe(500 - HERO_UPGRADE_COSTS[0]);
    expect(w.heroStats.ranged.damage).toBe(before + 2);
    expect(w.upgradeHero('ranged').reason).toBe('townhall'); // level 2 needs Town Hall 2
    const d = w.describeTownHall();
    expect(d.heroUpgrades.find((u) => u.stat === 'ranged')).toMatchObject({ level: 1, cost: HERO_UPGRADE_COSTS[1], reason: 'townhall' });
  });
});

describe('towers', () => {
  it('shoot the enemy in range that is nearest to the centre', () => {
    const w = makeWorld({ rounds: [{ groups: [{ enemy: 'orc', count: 1, spawn: 'left' }, { enemy: 'goblin', count: 1, spawn: 'left', delay: 6 }] }, { groups: [] }] });
    w.hero.dead = true; w.hero.respawnAt = 1e9;
    // build without the hero: place a finished tower directly
    w.hero.dead = false; goTo(w, spot(w, 's3')); w.build('s3', 'tower'); run(w, 13); w.hero.dead = true; w.hero.respawnAt = 1e9;
    // record every tower shot together with the correct choice at that moment
    const tower = w.buildingOn('s3');
    const shots = [];
    const shoot = w.shoot.bind(w);
    w.shoot = (from, target, dmg, owner) => {
      if (owner === 'tower') {
        const inRange = w.enemies.filter((e) => Math.hypot(e.x - tower.x, e.y - tower.y) - e.radius <= 180);
        const best = inRange.reduce((a, b) => (w.toCentre(b) < w.toCentre(a) ? b : a));
        shots.push({ target: target.id, best: best.id, choices: inRange.length });
      }
      shoot(from, target, dmg, owner);
    };
    w.callReady();
    run(w, 40);
    expect(shots.length).toBeGreaterThan(3);
    expect(shots.some((s) => s.choices > 1)).toBe(true); // both enemies were in range at least once
    for (const s of shots) expect(s.target).toBe(s.best);
  });
});

describe('castles', () => {
  it('send up to 3 soldiers that fight ground enemies and respawn', () => {
    const w = makeWorld({ rounds: [{ groups: [{ enemy: 'goblin', count: 4, interval: 3, spawn: 'left' }] }, { groups: [] }] });
    goTo(w, spot(w, 's1'));
    w.build('s1', 'castle');
    run(w, 16);
    run(w, 30);
    expect(w.soldiers).toHaveLength(3);
    w.hero.dead = true; w.hero.respawnAt = 1e9;
    w.callReady();
    run(w, 60);
    expect(w.enemies.filter((e) => e.type === 'goblin').length).toBe(0); // soldiers + town hall dealt with them
    expect(w.round).toBe(1);
  });

  it('soldiers ignore flying enemies', () => {
    const w = makeWorld({ rounds: [{ groups: [{ enemy: 'bat', count: 1, spawn: 'left' }] }, { groups: [] }] });
    goTo(w, spot(w, 's1'));
    w.build('s1', 'castle');
    run(w, 16);
    w.hero.dead = true; w.hero.respawnAt = 1e9;
    w.callReady();
    run(w, 25);
    expect(w.soldiers.every((s) => s.target === null)).toBe(true);
  });
});

describe('damage, ruins and repair', () => {
  it('a destroyed building becomes a ruin, loses workers and is rebuilt at level 1', () => {
    const w = makeWorld();
    goTo(w, spot(w, 's1'));
    w.build('s1', 'house');
    run(w, 11);
    const b = w.buildingOn('s1');
    w.damage(b, 1000);
    expect(b.state).toBe('ruin');
    expect(w.workers).toBe(0);
    expect(w.build('s1', 'tower').reason).toBe('occupied'); // a ruin is rebuilt as what it was
    const coins = w.coins;
    expect(w.build('s1', 'house')).toEqual({ ok: true });
    expect(w.coins).toBe(coins - 20);
    run(w, 11);
    expect(w.buildingOn('s1')).toMatchObject({ level: 1, state: 'ready' });
  });

  it('buildings and the Town Hall repair themselves 5 s after the last hit', () => {
    const w = makeWorld();
    const full = TOWN_HALL_LEVELS[0].hp;
    w.damage(w.townHall, 300);
    run(w, 4.5);
    expect(w.townHall.hp).toBe(full - 300);
    run(w, 6);
    expect(w.townHall.hp).toBeGreaterThan(full - 300);
    expect(w.townHall.hp).toBeLessThan(full);
  });

  it('enemies attack buildings they pass', () => {
    const w = makeWorld({ rounds: [{ groups: [{ enemy: 'orc', count: 1, spawn: 'left' }] }, { groups: [] }] });
    goTo(w, spot(w, 's3'));
    w.build('s3', 'house');
    run(w, 11);
    goTo(w, w.townHall);
    w.hero.dead = true; w.hero.respawnAt = 1e9;
    w.callReady();
    run(w, 25);
    expect(w.buildingOn('s3').hp).toBeLessThan(hpOf('house', 1));
  });
});

describe('hero guarding', () => {
  it('an idle hero engages a nearby enemy and walks back afterwards', () => {
    const w = makeWorld({ rounds: [{ groups: [{ enemy: 'goblin', count: 1, spawn: 'left' }] }, { groups: [] }] });
    goTo(w, { x: 500, y: 360 }); // on the left road
    const home = { x: w.hero.x, y: w.hero.y };
    w.callReady();
    let engaged = false;
    for (let i = 0; i < 30 * 40 && w.enemies.length + w.queue.length; i++) {
      w.update(1 / 30);
      if (w.hero.target) engaged = true;
    }
    expect(engaged).toBe(true);
    expect(w.enemies).toHaveLength(0);
    run(w, 5);
    expect(Math.hypot(w.hero.x - home.x, w.hero.y - home.y)).toBeLessThan(8);
  });

  it('does not chase far away enemies', () => {
    const w = makeWorld({ rounds: [{ groups: [{ enemy: 'goblin', count: 1, spawn: 'top' }] }, { groups: [] }] });
    goTo(w, { x: 200, y: 360 }); // far left, the goblin walks down from the top
    w.callReady();
    run(w, 8);
    expect(w.hero.target).toBeNull();
  });
});

describe('selling', () => {
  it('returns 70 % of everything spent and frees the spot', () => {
    const w = makeWorld();
    goTo(w, spot(w, 's1'));
    w.build('s1', 'tower');
    run(w, 13);
    goTo(w, w.townHall);
    w.upgradeTownHall();
    run(w, 31);
    goTo(w, spot(w, 's1'));
    w.upgrade('s1');
    const spent = 30 + 45;
    expect(w.describeSpot('s1').sell).toEqual({ refund: Math.floor(spent * 0.7), reason: null });
    const coins = w.coins;
    expect(w.sell('s1')).toEqual({ ok: true, refund: 52 });
    expect(w.coins).toBe(coins + 52);
    expect(w.buildingOn('s1')).toBeNull();
    expect(w.build('s1', 'house').ok).toBe(true); // any type can be built again
  });

  it('needs the hero nearby; a ruin is cleared for nothing; castle soldiers leave', () => {
    const w = makeWorld();
    goTo(w, spot(w, 's1'));
    w.build('s1', 'castle');
    run(w, 30);
    expect(w.soldiers.length).toBeGreaterThan(0);
    goTo(w, spot(w, 's3'));
    expect(w.sell('s1').reason).toBe('far');
    goTo(w, spot(w, 's1'));
    w.damage(w.buildingOn('s1'), 1e6);
    const coins = w.coins;
    expect(w.sell('s1')).toEqual({ ok: true, refund: 0 });
    expect(w.coins).toBe(coins);
    run(w, 0.1);
    expect(w.soldiers).toHaveLength(0);
  });
});

describe('editable rules and components', () => {
  it('the World uses the given rules and building components instead of the defaults', () => {
    const rules = mergeRules({
      unlocks: [],
      build: { sellRefund: 0.5 },
      heroUpgradeCosts: [3],
    });
    expect(rules.build.soldier.speed).toBe(DEFAULT_RULES.build.soldier.speed); // untouched fields keep defaults
    let types = withType('townhall', { levels: [{ hp: 999, cost: 0, time: 0, round: 1 }, { cost: 1, time: 1, hp: 1500, round: 1 }] });
    types = types.map((t) => (t.id === 'castle' ? { ...t, levels: t.levels.map((l) => ({ ...l, soldierCount: 1 })) } : t));
    const w = makeWorld({ rules, buildingTypes: types });
    expect(w.townHall).toMatchObject({ hp: 999, maxHp: 999 });
    goTo(w, w.townHall);
    w.upgradeHero('melee');
    expect(w.coins).toBe(497);
    expect(w.upgradeHero('melee').reason).toBe('max');
    goTo(w, spot(w, 's1'));
    w.build('s1', 'castle');
    run(w, 40);
    expect(w.soldiers).toHaveLength(1);
    expect(w.sell('s1').refund).toBe(20);
  });

  it('hero numbers come from rules.hero; a stored hero is squeezed into the limits', () => {
    const rules = mergeRules({ hero: { points: 4, statMax: 2, hp: 250, meleePerPoint: 10 } });
    const w = new World({
      map: { centre: { x: 648, y: 360 }, caves: [], spots: [] },
      grid: { cols: 80, rows: 45, cell: 16, walk: new Uint8Array(80 * 45).fill(1) },
      enemyTypes: DEFAULT_ENEMY_TYPES, rules, heroPoints: { melee: 5, ranged: 5, armor: 0, speed: 0 },
      waves: { rounds: [{ groups: [] }] },
    });
    expect(w.heroPoints).toEqual({ melee: 2, ranged: 2, armor: 0, speed: 0 });
    expect(w.hero.maxHp).toBe(250);
    expect(w.heroStats.melee.damage).toBe(10 + 2 * 10);
  });

  it('rounds can set their own reward and prep time', () => {
    const w = makeWorld({ coins: 0, rounds: [{ groups: [], reward: 77 }, { groups: [], prep: 7 }, { groups: [] }] });
    const bonus = w.callReady();
    w.update(0.1);
    expect(w.coins - bonus).toBe(77);
    expect(w.prepLeft).toBeCloseTo(7, 0);
  });

  it('rules are a save-file collection', () => {
    expect(COLLECTIONS).toContain('rules');
    expect(rulesOf({ rules: [] })).toBe(DEFAULT_RULES);
  });
});

describe('new kinds of buildings, made only from data', () => {
  it('a market (income) pays after each round; a well (healHero) heals; features can be combined', () => {
    const market = { id: 'market', name: { cs: 'Trh', en: 'Market' }, features: ['income', 'workers'], levels: [{ cost: 10, time: 5, hp: 300, round: 1, income: 7, workers: 2 }] };
    const well = { id: 'well', name: { cs: 'Studna', en: 'Well' }, features: ['healHero'], levels: [{ cost: 10, time: 5, hp: 300, round: 1, heal: 20, healRange: 100 }] };
    const w = makeWorld({ coins: 100, rounds: [{ groups: [] }, { groups: [] }], buildingTypes: [...OPEN_TYPES, market, well] });
    expect(Object.keys(w.describeSpot('s1').options.reduce((o, x) => ({ ...o, [x.type]: 1 }), {}))).toEqual(['house', 'tower', 'castle', 'catapult', 'market', 'well']);
    goTo(w, spot(w, 's1'));
    w.build('s1', 'market');
    w.build('s4', 'well');
    run(w, 6);
    expect(w.workers).toBe(2); // features combine: the market also has workers
    w.hero.hp = 10;
    run(w, 1);
    expect(w.hero.hp).toBeGreaterThan(25); // the well heals faster than the Town Hall alone
    const coins = w.coins;
    const bonus = w.callReady();
    w.update(0.01);
    expect(w.coins - coins - bonus).toBe(w.drainEvents().find((e) => e.type === 'roundEnd').reward);
    expect(w.coins - coins - bonus).toBe(11 + 7); // round reward + market income
  });

  it('a type can have more levels, the Town Hall can get other features', () => {
    const tall = { ...OPEN_TYPES.find((t) => t.id === 'tower'), id: 'tall', levels: [...OPEN_TYPES.find((t) => t.id === 'tower').levels, { cost: 10, time: 1, hp: 2000, round: 1, damage: 50, range: 300, cooldown: 0.5 }] };
    const types = withType('townhall', { features: ['shoots', 'workers'], levels: OPEN_TYPES[0].levels.map((l) => ({ ...l, workers: 4 })) });
    const w = makeWorld({ buildingTypes: [...types, tall] });
    expect(w.workers).toBe(4);
    expect(w.describeSpot('s1').options.find((o) => o.type === 'tall')).toBeTruthy();
    expect(w.buildingTypes.tall.levels).toHaveLength(4);
  });
});

describe('unlock schedule', () => {
  it('opens something new after every wave of the default 20 (building levels + hero upgrades)', () => {
    const rounds = new Set([...DEFAULT_UNLOCKS.map((u) => u.round), ...DEFAULT_BUILDING_TYPES.flatMap((t) => t.levels.map((l) => l.round))]);
    for (let r = 1; r <= 20; r++) expect(rounds.has(r)).toBe(true);
  });

  it('locks items until their round and announces them', () => {
    const empty = Array.from({ length: 4 }, () => ({ groups: [] }));
    const w = makeWorld({ rules: DEFAULT_RULES, rounds: empty, buildingTypes: DEFAULT_BUILDING_TYPES });
    goTo(w, spot(w, 's1'));
    expect(w.build('s1', 'castle').reason).toBe('locked');
    expect(w.describeSpot('s1').options.find((o) => o.type === 'castle')).toMatchObject({ reason: 'locked', round: 2 });
    expect(w.build('s1', 'tower').ok).toBe(true);
    w.callReady();
    w.update(0.1); // empty round ends → round 2
    expect(w.drainEvents().find((e) => e.type === 'unlocked').keys).toEqual(['castle:1']);
    expect(w.hud().newThings).toEqual(['castle:1']);
    expect(w.build('s4', 'castle').reason).not.toBe('locked');
    goTo(w, w.townHall);
    expect(w.upgradeTownHall().reason).toBe('locked'); // Town Hall 2 from round 3
    w.callReady(); w.update(0.1);
    expect(w.upgradeTownHall().ok).toBe(true);
  });
});

describe('describeSpot', () => {
  it('lists build options with reasons, then upgrade info', () => {
    const w = makeWorld({ coins: 35 });
    let d = w.describeSpot('s3');
    expect(d.building).toBeNull();
    expect(d.options.map((o) => [o.type, o.reason])).toEqual([['house', 'far'], ['tower', 'far'], ['castle', 'far'], ['catapult', 'far']]);
    goTo(w, spot(w, 's3'));
    d = w.describeSpot('s3');
    expect(d.options.map((o) => o.reason)).toEqual([null, null, 'coins', 'coins']);
    w.build('s3', 'tower');
    d = w.describeSpot('s3');
    expect(d.building).toMatchObject({ type: 'tower', level: 0, state: 'building' });
    expect(d.building.progress).toBe(0);
  });
});
