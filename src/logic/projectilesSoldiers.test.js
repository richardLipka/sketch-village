import { describe, it, expect } from 'vitest';
import { World } from './world.js';
import { DEFAULT_ENEMY_TYPES } from '../config/enemies.js';
import { DEFAULT_BUILDING_TYPES } from '../config/buildings.js';
import { DEFAULT_RULES } from '../config/rules.js';
import { buildingScale } from '../config/features.js';

// Projectile choice, area damage (towers and enemies) and castle soldier kinds.

const tower = DEFAULT_BUILDING_TYPES.find((t) => t.id === 'tower');
const castle = DEFAULT_BUILDING_TYPES.find((t) => t.id === 'castle');

function makeWorld({ buildingTypes = DEFAULT_BUILDING_TYPES, enemyTypes = DEFAULT_ENEMY_TYPES } = {}) {
  const cols = 80, rows = 45, cell = 16;
  const walk = new Uint8Array(cols * rows);
  for (let x = 0; x < cols; x++) for (const y of [21, 22, 23]) walk[y * cols + x] = 1;
  const open = buildingTypes.map((t) => ({ ...t, levels: t.levels.map((l) => ({ ...l, round: 1 })) }));
  return new World({
    map: { centre: { x: 1200, y: 360, radius: 60 }, caves: [{ id: 'left', x: 10, y: 360 }], spots: [{ id: 's1', x: 700, y: 320 }] },
    grid: { cols, rows, cell, walk }, enemyTypes, buildingTypes: open, seed: 7,
    rules: { ...DEFAULT_RULES, unlocks: [] },
    waves: { startCoins: 900, firstPrep: 1000, prep: 1000, rounds: [{ groups: [] }, { groups: [] }] },
  });
}
const run = (w, s, dt = 1 / 30) => { for (let t = 0; t < s && w.phase !== 'lost' && w.phase !== 'won'; t += dt) w.update(dt); };
const at = (w, type, x, y = 360) => { const e = w.spawnEnemy(type, { x, y }); e.next = { x: e.x, y: e.y }; return e; };
const freeze = (w) => { for (const t of Object.values(w.types)) t.speed = 0; };
// every projectile fired, as it is fired (they hit within a few frames)
const fired = (w) => { const out = []; const shoot = w.shoot.bind(w); w.shoot = (...a) => { shoot(...a); out.push(w.projectiles.at(-1)); }; return out; };
const buildOn = (w, type) => {
  w.hero.x = 700; w.hero.y = 360; w.hero.dead = false;
  expect(w.build('s1', type).ok).toBe(true);
  w.hero.dead = true;
  run(w, 40);
  return w.buildings[0];
};

describe('projectiles', () => {
  it('a tower shoots the projectile its type picked; without one the arrow (null)', () => {
    const w = makeWorld({ buildingTypes: [...DEFAULT_BUILDING_TYPES.filter((t) => t.id !== 'tower'), { ...tower, projectile: 'fireball' }] });
    freeze(w);
    buildOn(w, 'tower');
    const shots = fired(w);
    at(w, 'orc', 640);
    run(w, 1.5);
    expect(shots.find((p) => p.owner === 'tower')?.look).toBe('fireball');
    const plain = makeWorld();
    freeze(plain);
    buildOn(plain, 'tower');
    const plainShots = fired(plain);
    at(plain, 'orc', 640);
    run(plain, 1.5);
    expect(plainShots.find((p) => p.owner === 'tower')?.look).toBe(null);
  });

  it('an enemy shoots its own projectile', () => {
    const enemies = DEFAULT_ENEMY_TYPES.map((e) => (e.id === 'archer' ? { ...e, projectile: 'rock' } : e));
    const w = makeWorld({ enemyTypes: enemies });
    freeze(w);
    w.hero.x = 400; w.hero.y = 360;
    const shots = fired(w);
    at(w, 'archer', 300);
    run(w, 2);
    expect(shots.find((p) => p.owner === 'enemy')?.look).toBe('rock');
  });
});

describe('area damage', () => {
  it('built-in towers have none – a tower with splash hurts the whole group', () => {
    expect(tower.levels.every((l) => !l.splash)).toBe(true); // existing buildings unchanged
    const splashy = { ...tower, levels: tower.levels.map((l) => ({ ...l, splash: 40 })) };
    const w = makeWorld({ buildingTypes: [...DEFAULT_BUILDING_TYPES.filter((t) => t.id !== 'tower'), splashy] });
    freeze(w);
    buildOn(w, 'tower');
    const group = [at(w, 'orc', 640), at(w, 'orc', 652, 352), at(w, 'orc', 648, 370)];
    const far = at(w, 'orc', 560); // farther from the Town Hall: the group is shot first
    const hp = group.map((e) => e.hp), farHp = far.hp;
    run(w, 1.5);
    expect(group.every((e, i) => e.hp < hp[i])).toBe(true);
    expect(far.hp).toBe(farHp);
  });

  it('an enemy with area damage hurts every defender around its target', () => {
    const enemies = DEFAULT_ENEMY_TYPES.map((e) => (e.id === 'orc' ? { ...e, splash: 60 } : e));
    const w = makeWorld({ enemyTypes: enemies });
    freeze(w);
    const c = buildOn(w, 'castle');
    run(w, 30); // soldiers out
    const soldiers = w.soldiers.filter((s) => !s.dead);
    expect(soldiers.length).toBeGreaterThan(1);
    const before = soldiers.map((s) => s.hp);
    const orc = at(w, 'orc', soldiers[0].x + 10, soldiers[0].y);
    for (let i = 0; i < 60; i++) { w.update(1 / 30); if (w.drainEvents().some((e) => e.type === 'splash' && e.owner === 'enemy')) break; }
    const hurt = soldiers.filter((s, i) => s.dead || s.hp < before[i]);
    expect(hurt.length).toBeGreaterThan(1); // not just the one it hit
    expect(orc).toBeTruthy();
    expect(c.state).not.toBe('ruin');
  });
});

describe('castle soldiers', () => {
  const kinds = { ...castle, levels: castle.levels.map((l, i) => ({ ...l, soldierKind: i === 0 ? null : 'archer' })) };

  it('level 1 sends the default soldier; an upgraded castle turns its soldiers into the next kind, healthier', () => {
    const w = makeWorld({ buildingTypes: [...DEFAULT_BUILDING_TYPES.filter((t) => t.id !== 'castle'), kinds] });
    freeze(w);
    const c = buildOn(w, 'castle');
    run(w, 30);
    const s = w.soldiers[0];
    expect(s.look).toBe(null);
    expect(s.ranged).toBe(false);
    expect(s.maxHp).toBe(castle.levels[0].soldierHp);
    // upgrade to level 2: the soldier already out there becomes an archer
    w.hero.dead = false; w.hero.x = 700; w.hero.y = 360;
    w.townHall.level = 3;
    expect(w.upgrade('s1').ok).toBe(true);
    w.hero.dead = true;
    run(w, 40);
    expect(c.level).toBe(2);
    expect(s.look).toBe('archer');
    expect(s.lookIsEnemy).toBe(true);
    expect(s.ranged).toBe(true);
    expect(s.maxHp).toBe(castle.levels[1].soldierHp);
    expect(s.range).toBeGreaterThan(w.cfg.soldier.range);
  });

  it('a shooting enemy as a soldier shoots at the enemies', () => {
    const archers = { ...castle, levels: castle.levels.map((l) => ({ ...l, soldierKind: 'archer' })) };
    const w = makeWorld({ buildingTypes: [...DEFAULT_BUILDING_TYPES.filter((t) => t.id !== 'castle'), archers] });
    freeze(w);
    buildOn(w, 'castle');
    run(w, 30);
    const s = w.soldiers[0];
    at(w, 'orc', s.x - 60, s.y);
    let shot = false;
    for (let i = 0; i < 120 && !shot; i++) { w.update(1 / 30); shot = w.projectiles.some((p) => p.owner === 'soldier'); }
    expect(shot).toBe(true);
  });
});

describe('building size', () => {
  it('20 % bigger, +10 % per level', () => {
    expect(buildingScale(1)).toBeCloseTo(1.2);
    expect(buildingScale(2)).toBeCloseTo(1.32);
    expect(buildingScale(3)).toBeCloseTo(1.44);
    expect(buildingScale(0)).toBeCloseTo(1.2);
  });
});
