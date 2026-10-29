import { describe, it, expect } from 'vitest';
import { expandRound, roundSummary, roundDuration } from './waves.js';
import { World } from './world.js';
import { defaultWaves } from '../config/waves.js';
import { DEFAULT_ENEMY_TYPES } from '../config/enemies.js';
import { BALANCE } from '../config/balance.js';

describe('expandRound', () => {
  it('spreads over caves and orders by time', () => {
    const r = { groups: [{ enemy: 'a', count: 3, interval: 2 }, { enemy: 'b', count: 2, interval: 1, delay: 1, spawn: 'c2' }] };
    const out = expandRound(r, ['c1', 'c2']);
    expect(out.map((e) => [e.t, e.enemy, e.cave])).toEqual([
      [0, 'a', 'c1'], [1, 'b', 'c2'], [2, 'a', 'c2'], [2, 'b', 'c2'], [4, 'a', 'c1'],
    ]);
  });

  it('falls back to all caves for an unknown cave id and handles no caves', () => {
    const r = { groups: [{ enemy: 'a', count: 2, interval: 1, spawn: 'gone' }] };
    expect(expandRound(r, ['x', 'y']).map((e) => e.cave)).toEqual(['x', 'y']);
    expect(expandRound(r, [])).toEqual([]);
  });

  it('summarises and times a round', () => {
    const r = { groups: [{ enemy: 'a', count: 3, interval: 2 }, { enemy: 'a', count: 1, delay: 10 }] };
    expect(roundSummary(r)).toEqual({ a: 4 });
    expect(roundDuration(r)).toBe(10);
  });

  it('default plan has 20 rounds that only use known enemies', () => {
    const w = defaultWaves();
    const known = new Set(DEFAULT_ENEMY_TYPES.map((t) => t.id));
    expect(w.rounds).toHaveLength(20);
    for (const r of w.rounds) for (const g of r.groups) expect(known.has(g.enemy)).toBe(true);
  });
});

// A plus-shaped road map: 3-cell-wide roads crossing at the centre; caves at the left and top ends.
function testMap() {
  const cols = 80, rows = 45, cell = 16;
  const walk = new Uint8Array(cols * rows);
  for (let x = 0; x < cols; x++) for (const y of [21, 22, 23]) walk[y * cols + x] = 1;
  for (let y = 0; y < rows; y++) for (const x of [39, 40, 41]) walk[y * cols + x] = 1;
  const grid = { cols, rows, cell, walk };
  const map = {
    centre: { x: 648, y: 360, radius: 60 },
    caves: [{ id: 'left', x: 10, y: 360 }, { id: 'top', x: 648, y: 10 }],
    heroRespawn: { x: 648, y: 420 },
  };
  return { map, grid };
}

function makeWorld(waves, opts = {}) {
  const { map, grid } = testMap();
  return new World({
    map, grid, enemyTypes: DEFAULT_ENEMY_TYPES, seed: 42,
    heroPoints: { melee: 3, ranged: 3, armor: 2, speed: 2 },
    // long prep by default so a finished round doesn't immediately end the game
    waves: { startCoins: 40, firstPrep: 1000, prep: 1000, ...waves },
    ...opts,
  });
}

const run = (w, seconds, dt = 1 / 30) => { for (let t = 0; t < seconds && w.phase !== 'lost' && w.phase !== 'won'; t += dt) w.update(dt); };

describe('World – rounds', () => {
  it('counts down the prep time, then starts the wave', () => {
    const w = makeWorld({ firstPrep: 5, rounds: [{ groups: [{ enemy: 'goblin', count: 1 }] }] });
    expect(w.phase).toBe('prep');
    run(w, 5.1);
    expect(w.phase).toBe('wave');
  });

  it('Ready pays the early bonus', () => {
    const w = makeWorld({ firstPrep: 20, rounds: [{ groups: [{ enemy: 'goblin', count: 1 }] }] });
    const bonus = w.callReady();
    expect(bonus).toBe(10);
    expect(w.coins).toBe(50);
    expect(w.phase).toBe('wave');
    expect(w.callReady()).toBe(0); // not in prep any more
  });

  it('an empty round ends immediately with its reward, last round wins', () => {
    const w = makeWorld({ firstPrep: 5, rounds: [{ groups: [] }, { groups: [] }] });
    w.callReady(); w.update(0.01);
    expect(w.round).toBe(1);
    expect(w.coins).toBe(40 + 2 + BALANCE.rewardBase + 1); // bonus floor(5*0.5)=2 + reward 6
    w.callReady(); w.update(0.01);
    expect(w.phase).toBe('won');
  });
});

describe('World – enemies', () => {
  it('ground enemies walk the road to the Town Hall and damage it', () => {
    const w = makeWorld({ rounds: [{ groups: [{ enemy: 'wolf', count: 1, spawn: 'left' }] }] });
    w.hero.dead = true; w.hero.respawnAt = 1e9; // keep the hero out of it
    w.callReady();
    run(w, 1);
    const e = w.enemies[0];
    expect(e).toBeDefined();
    // stays on the road while walking
    for (let i = 0; i < 300; i++) {
      w.update(1 / 30);
      const cx = Math.floor(e.x / 16), cy = Math.floor(e.y / 16);
      expect(w.grid.walk[cy * 80 + cx]).toBe(1);
    }
    run(w, 30);
    expect(w.townHall.hp).toBeLessThan(w.townHall.maxHp);
  });

  it('flying enemies go straight and melee cannot hit them', () => {
    const w = makeWorld({ rounds: [{ groups: [{ enemy: 'bat', count: 1, spawn: 'left' }] }] });
    w.callReady(); w.update(0.01);
    const bat = w.enemies[0];
    expect(bat.flying).toBe(true);
    w.attack(bat.id);
    w.update(0.01);
    expect(w.hero.target).toBeNull(); // melee can't target it
    w.setMode('ranged');
    w.attack(bat.id);
    expect(w.hero.target).toBe(bat.id);
  });

  it('the game is lost when the Town Hall falls', () => {
    const w = makeWorld({ rounds: [{ groups: [{ enemy: 'troll', count: 3, interval: 1 }] }] });
    w.hero.dead = true; w.hero.respawnAt = 1e9;
    w.callReady();
    run(w, 400);
    expect(w.phase).toBe('lost');
    expect(w.townHall.hp).toBe(0);
  });

  it('enemy HP grows with the round number', () => {
    const w = makeWorld({ rounds: Array.from({ length: 10 }, () => ({ groups: [] })).concat([{ groups: [{ enemy: 'goblin', count: 1 }] }]) });
    w.round = 10;
    w.phase = 'prep';
    w.callReady(); w.update(0.01);
    expect(w.enemies[0].maxHp).toBe(Math.round(25 * 1.4));
  });
});

describe('World – hero', () => {
  it('kills a goblin in melee, coins drop on the road and are picked up', () => {
    const w = makeWorld({ rounds: [{ groups: [{ enemy: 'goblin', count: 1, spawn: 'left' }] }, { groups: [] }] });
    w.callReady();
    run(w, 0.1);
    const g = w.enemies[0];
    w.attack(g.id);
    run(w, 30);
    expect(g.dead).toBe(true);
    // walk around the spot to make sure coins get collected
    const start = w.coins;
    const drops = [...w.coinsOnGround];
    expect(drops.length + (w.coins - 40)).toBeGreaterThan(0);
    for (const c of drops) { w.moveHeroTo(c.x, c.y); run(w, 15); }
    expect(w.coinsOnGround.length).toBe(0);
    expect(w.coins).toBeGreaterThanOrEqual(start + drops.length);
  });

  it('unpicked coins vanish after 30 s', () => {
    const w = makeWorld({ rounds: [{ groups: [] }] });
    w.coinsOnGround.push({ id: 999, x: 100, y: 360, born: 0 });
    w.hero.dead = true; w.hero.respawnAt = 1e9;
    run(w, 29);
    expect(w.coinsOnGround).toHaveLength(1);
    run(w, 1.5);
    expect(w.coinsOnGround).toHaveLength(0);
  });

  it('loses lives, stays in place, then after the last life respawns 30 s later', () => {
    const w = makeWorld({ rounds: [{ groups: [] }] });
    const h = w.hero;
    h.x = 300; h.y = 360;
    for (let i = 0; i < 4; i++) { h.invuln = 0; w.damage(h, 1000); }
    expect(h.lives).toBe(1);
    expect(h.dead).toBe(false);
    expect([h.x, h.y]).toEqual([300, 360]);
    h.invuln = 0; w.damage(h, 1000);
    expect(h.dead).toBe(true);
    run(w, 29);
    expect(h.dead).toBe(true);
    run(w, 1.5);
    expect(h.dead).toBe(false);
    expect(h.lives).toBe(5);
    expect([h.x, h.y]).toEqual([w.respawnPoint.x, w.respawnPoint.y]);
  });

  it('armor reduces damage', () => {
    const w = makeWorld({ rounds: [{ groups: [] }] });
    w.damage(w.hero, 10); // armor 2 pts = 10 %
    expect(w.hero.hp).toBe(100 - 9);
  });

  it('hero walks only on roads when sent across grass', () => {
    const w = makeWorld({ rounds: [{ groups: [] }] });
    w.moveHeroTo(100, 100); // grass corner → nearest road
    for (let i = 0; i < 600; i++) {
      w.update(1 / 30);
      const cx = Math.floor(w.hero.x / 16), cy = Math.floor(w.hero.y / 16);
      expect(w.grid.walk[cy * 80 + cx]).toBe(1);
    }
  });
});

describe('World – full default game with an idle hero', () => {
  it('runs all rounds without errors until won or lost', () => {
    const w = makeWorld(defaultWaves());
    for (let i = 0; i < 20 * 60 * 30 && w.phase !== 'won' && w.phase !== 'lost'; i++) {
      if (w.phase === 'prep') w.callReady();
      w.update(1 / 30);
    }
    expect(['won', 'lost']).toContain(w.phase);
  });
});
