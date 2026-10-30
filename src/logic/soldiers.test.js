import { describe, it, expect } from 'vitest';
import { World } from './world.js';
import { DEFAULT_ENEMY_TYPES } from '../config/enemies.js';
import { DEFAULT_BUILDING_TYPES } from '../config/buildings.js';
import { DEFAULT_RULES } from '../config/rules.js';

// Castle soldiers patrol only up to the castle's patrol distance and come back.

const PATROL = 150;

function makeWorld() {
  const cols = 80, rows = 45, cell = 16;
  const walk = new Uint8Array(cols * rows);
  for (let x = 0; x < cols; x++) for (const y of [21, 22, 23]) walk[y * cols + x] = 1; // one long road
  const types = DEFAULT_BUILDING_TYPES.map((t) => ({
    ...t, levels: t.levels.map((l) => ({ ...l, round: 1, ...(t.id === 'castle' ? { soldierCount: 1, soldierPatrol: PATROL, soldierHp: 9999 } : {}) })),
  }));
  const w = new World({
    map: { centre: { x: 1240, y: 360, radius: 60 }, caves: [{ id: 'left', x: 10, y: 360 }], spots: [{ id: 's1', x: 640, y: 320 }] },
    grid: { cols, rows, cell, walk }, enemyTypes: DEFAULT_ENEMY_TYPES, buildingTypes: types, seed: 11,
    rules: { ...DEFAULT_RULES, unlocks: [] },
    waves: { startCoins: 500, firstPrep: 1000, prep: 1000, rounds: [{ groups: [] }, { groups: [] }] },
  });
  w.hero.x = 640; w.hero.y = 360;
  w.build('s1', 'castle');
  w.hero.dead = true; w.hero.respawnAt = Infinity;
  run(w, 40); // built, first soldier out
  return w;
}
const run = (w, s, dt = 1 / 30, each) => { for (let t = 0; t < s; t += dt) { w.update(dt); each?.(w); } };
const castleOf = (w) => w.buildings[0];
const d = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

describe('soldiers patrol around their castle', () => {
  it('fight a walking enemy inside the patrol distance', () => {
    const w = makeWorld();
    const [s] = w.soldiers;
    const e = w.spawnEnemy('goblin', { x: castleOf(w).x - 100, y: 360 });
    w.types.goblin.speed = 0;
    run(w, 6);
    expect(e.dead || e.hp < e.maxHp).toBe(true);
    expect(s.target === e.id || e.dead).toBe(true);
  });

  it('never follow an enemy beyond the patrol distance, and go back to the starting point', () => {
    const w = makeWorld();
    const [s] = w.soldiers;
    const castle = castleOf(w);
    w.types.orc.speed = 0;
    w.types.orc.damage = 0;
    const far = w.spawnEnemy('orc', { x: castle.x - PATROL - 80, y: 360 }); // outside
    let maxAway = 0;
    run(w, 12, 1 / 30, () => { maxAway = Math.max(maxAway, d(s, castle)); });
    expect(far.hp).toBe(far.maxHp); // never attacked
    expect(maxAway).toBeLessThanOrEqual(PATROL + 20);
    // an enemy walks out of the area while fighting → the soldier lets it go and returns
    const runner = w.spawnEnemy('orc', { x: castle.x - 60, y: 360 });
    run(w, 1);
    expect(s.target).toBe(runner.id);
    runner.x = castle.x - PATROL - 120; runner.next = { x: runner.x, y: runner.y };
    run(w, 1);
    expect(s.target).toBeNull();
    let back = false;
    run(w, 15, 1 / 30, () => { if (d(s, s.home) < 4) back = true; });
    expect(back).toBe(true);
  });

  it('with nothing to fight they walk patrols inside the distance and come back home', () => {
    const w = makeWorld();
    const [s] = w.soldiers;
    const castle = castleOf(w);
    let patrols = 0, wasOut = false, maxAway = 0, home = 0;
    run(w, 60, 1 / 30, () => {
      if (s.patrolTo && !wasOut) { patrols++; wasOut = true; }
      if (!s.patrolTo && wasOut && d(s, s.home) < 4) { wasOut = false; home++; }
      maxAway = Math.max(maxAway, d(s, castle));
    });
    expect(patrols).toBeGreaterThanOrEqual(2);
    expect(home).toBeGreaterThanOrEqual(1);
    expect(maxAway).toBeLessThanOrEqual(PATROL + 20);
    expect(maxAway).toBeGreaterThan(40); // it really walked out
  });
});
