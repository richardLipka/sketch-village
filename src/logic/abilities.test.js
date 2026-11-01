import { describe, it, expect } from 'vitest';
import { World } from './world.js';
import { DEFAULT_ENEMY_TYPES } from '../config/enemies.js';
import { ABILITIES, ABILITY_IDS, abilityOf, abilityAt, defaultAbilityId } from '../config/abilities.js';

// The hero's special ability (SPEC §6.4) and a saved game going on (SPEC §11b).

function testMap() {
  const cols = 80, rows = 45, cell = 16;
  const walk = new Uint8Array(cols * rows);
  for (let x = 0; x < cols; x++) for (const y of [21, 22, 23]) walk[y * cols + x] = 1;
  for (let y = 0; y < rows; y++) for (const x of [39, 40, 41]) walk[y * cols + x] = 1;
  return {
    grid: { cols, rows, cell, walk },
    map: { centre: { x: 648, y: 360, radius: 60 }, caves: [{ id: 'left', x: 10, y: 360 }, { id: 'top', x: 648, y: 10 }], heroRespawn: { x: 648, y: 420 } },
  };
}

const args = (opts = {}) => ({
  ...testMap(), enemyTypes: DEFAULT_ENEMY_TYPES, seed: 7, heroPoints: { melee: 3, ranged: 3, armor: 2, speed: 2 },
  waves: { startCoins: 40, firstPrep: 1000, prep: 1000, rounds: [{ groups: [{ enemy: 'goblin', count: 8, interval: 1 }] }, { groups: [{ enemy: 'orc', count: 3 }] }] },
  ...opts,
});
const run = (w, seconds, dt = 1 / 30) => { for (let t = 0; t < seconds && w.phase !== 'lost' && w.phase !== 'won'; t += dt) w.update(dt); };
const withAbility = (id, own = {}) => new World(args({ ability: abilityOf({ id: 'h', ability: { id, ...own } }) }));
/** A goblin right next to the hero. */
const goblinAtHero = (w, dx = 20) => w.spawnEnemy('goblin', { x: w.hero.x + dx, y: w.hero.y });

describe('abilities: the numbers', () => {
  it('eight, each with its numbers; a hero without a choice gets one by its id', () => {
    expect(ABILITY_IDS).toHaveLength(8);
    for (const a of Object.values(ABILITIES)) expect(a.cooldown).toBeGreaterThan(0);
    expect(abilityOf({ id: 'x' }).id).toBe(defaultAbilityId('x'));
    expect(new Set(['lara', 'robin', 'mage', 'goblin-hunter', 'knight'].map(defaultAbilityId)).size).toBeGreaterThan(2);
  });

  it('its own numbers within limits; upgrades make it stronger, longer and sooner ready', () => {
    const a = abilityOf({ ability: { id: 'shout', power: 0.6, cooldown: 1, radius: 'x' } });
    expect(a).toMatchObject({ id: 'shout', power: 0.6, cooldown: 3, radius: ABILITIES.shout.radius });
    const up = abilityAt(a, 2);
    expect(up.power).toBe(0.9); // a share stays below 0.9
    expect(up.cooldown).toBeLessThan(a.cooldown);
    expect(up.duration).toBeGreaterThan(a.duration);
    expect(abilityAt(abilityOf({ ability: { id: 'reinforcements' } }), 1).power).toBe(4);
  });
});

describe('abilities in the game', () => {
  it('without an ability nothing happens (the balance robot plays without)', () => {
    const w = new World(args());
    expect(w.useAbility()).toEqual({ ok: false, reason: 'none' });
    expect(w.hud().hero.ability).toBe(null);
  });

  it('strike: one big hit on the strongest monster in reach, then the cooldown', () => {
    const w = withAbility('strike', { power: 500 });
    expect(w.useAbility()).toEqual({ ok: false, reason: 'no_target' }); // nothing in reach: not wasted
    const g = goblinAtHero(w);
    expect(w.abilityTargets().enemies).toEqual([g]); // shown before: who takes the blow
    expect(w.useAbility().ok).toBe(true);
    expect(g.dead).toBe(true);
    expect(w.drainEvents().some((e) => e.type === 'ability' && e.id === 'strike')).toBe(true);
    goblinAtHero(w);
    expect(w.useAbility()).toEqual({ ok: false, reason: 'cooldown' });
    expect(w.hud().hero.ability.left).toBe(20);
    run(w, 20.1);
    expect(w.hud().hero.ability.left).toBe(0);
    expect(w.drainEvents().some((e) => e.type === 'abilityReady')).toBe(true);
  });

  it('shout slows the monsters around, freeze stops them; both wear off', () => {
    for (const [id, by] of [['shout', 0.5], ['freeze', 1]]) {
      const w = withAbility(id);
      const far = w.spawnEnemy('goblin', { x: 10, y: 360 });
      const near = goblinAtHero(w, 60);
      const plain = new World(args());
      const twin = plain.spawnEnemy('goblin', { x: near.x, y: near.y });
      w.hero.dead = plain.hero.dead = true; w.hero.respawnAt = plain.hero.respawnAt = 1e9; // nobody hits them
      w.hero.dead = false; expect(w.useAbility().ok).toBe(true); w.hero.dead = true;
      const start = { ...near };
      run(w, 1); run(plain, 1);
      const moved = Math.hypot(near.x - start.x, near.y - start.y), free = Math.hypot(twin.x - start.x, twin.y - start.y);
      expect(moved).toBeCloseTo(free * (1 - by), 0);
      expect(far.slow ?? null).toBe(null);
      run(w, 6);
      expect(near.slow).toBe(null);
    }
  });

  it('arrow rain is aimed at a place: the hero’s arrows fly there and hit every monster around it, flying ones too', () => {
    const w = withAbility('arrowRain', { power: 30, radius: 60, reach: 300 });
    const h = w.hero;
    const a = w.spawnEnemy('goblin', { x: h.x + 200, y: h.y }), b = w.spawnEnemy('bat', { x: h.x + 220, y: h.y + 20 });
    goblinAtHero(w, 20); // near the hero, outside the place
    const ha = a.hp, hb = b.hp;
    expect(w.useAbility({ x: h.x - 200, y: h.y })).toEqual({ ok: false, reason: 'no_target' }); // nobody there: not wasted
    expect(w.abilityTargets({ x: h.x + 210, y: h.y }).enemies).toEqual([a, b]);
    expect(w.useAbility({ x: h.x + 210, y: h.y }).ok).toBe(true);
    const arrows = w.projectiles.filter((p) => p.owner === 'hero');
    expect(arrows.length).toBeGreaterThan(5); // the hero's own arrows, a volley
    expect(arrows.every((p) => p.look === null)).toBe(true);
    expect(a.hp).toBe(ha); // they are still flying
    w.hero.dead = true; w.hero.respawnAt = 1e9; // the hero itself doesn't shoot meanwhile
    run(w, 1.5);
    expect(a.hp).toBeLessThan(ha);
    expect(b.hp).toBeLessThan(hb);
    expect(w.projectiles).toHaveLength(0);
  });

  it('an aimed place too far is pulled back within reach; without a place it goes where most monsters are', () => {
    const w = withAbility('arrowRain', { reach: 300, radius: 50 });
    const h = w.hero;
    const far = w.abilityTargets({ x: h.x + 1000, y: h.y });
    expect(Math.round(far.x - h.x)).toBe(300);
    expect(far.reach).toBe(300);
    w.spawnEnemy('goblin', { x: h.x + 100, y: h.y });
    for (const dy of [0, 10, 20]) w.spawnEnemy('goblin', { x: h.x - 150, y: h.y + dy });
    const auto = w.abilityTargets();
    expect(auto.enemies).toHaveLength(3);
    expect(Math.abs(auto.x - (h.x - 150))).toBeLessThan(20);
  });

  it('heal mends the hero and the buildings near it – shown before; shield keeps the hero from harm', () => {
    const w = withAbility('heal', { power: 50, radius: 400 });
    w.hero.hp = 10; w.townHall.hp = 100;
    const shown = w.abilityTargets();
    expect(shown.friends.map((f) => [f.kind, f.hurt])).toEqual([['hero', true], ['building', true]]);
    expect(withAbility('heal', { radius: 0 }).abilityTargets().friends.map((f) => f.kind)).toEqual(['hero']); // the Town Hall far away
    w.useAbility();
    expect(w.hero.hp).toBe(60);
    expect(w.townHall.hp).toBe(150);
    const e = w.drainEvents().find((x) => x.type === 'ability');
    expect(e.healed.map((x) => x.amount)).toEqual([50, 50]);
    const s = withAbility('shield', { duration: 4 });
    s.useAbility();
    const hp = s.hero.hp;
    s.damage(s.hero, 30);
    expect(s.hero.hp).toBe(hp);
  });

  it('reinforcements: soldiers fight beside the hero for a while, then go', () => {
    const w = withAbility('reinforcements', { power: 3, duration: 5 });
    w.useAbility();
    expect(w.soldiers).toHaveLength(3);
    goblinAtHero(w, 50);
    run(w, 2);
    expect(w.soldiers.length).toBeGreaterThan(0);
    run(w, 3.5);
    expect(w.soldiers).toHaveLength(0);
  });

  it('rally: the towers near the hero shoot faster', () => {
    const w = withAbility('rally', { power: 1, radius: 400 });
    w.useAbility();
    expect(w.rallyOf(w.townHall)).toBe(2);
    run(w, 9);
    expect(w.rallyOf(w.townHall)).toBe(1);
  });

  it('is bought better in the Town Hall shop, one level per Town Hall level', () => {
    const w = withAbility('strike');
    w.coins = 500;
    expect(w.describeTownHall().ability).toMatchObject({ id: 'strike', level: 0, cost: 15, reason: null });
    expect(w.upgradeAbility().ok).toBe(true);
    expect(w.abilityNow.power).toBe(150);
    expect(w.upgradeAbility()).toEqual({ ok: false, reason: 'townhall' });
  });
});

describe('a saved game goes on', () => {
  it('saved in the middle of a wave and restored, it plays on exactly as the game would have', () => {
    const w = withAbility('shout');
    w.callReady();
    run(w, 6);
    w.build(w.spots[0]?.id, 'tower');
    const saved = JSON.parse(JSON.stringify(w.saveState(), (k, v) => (v === -Infinity ? '-inf' : v)), (k, v) => (v === '-inf' ? -Infinity : v));
    expect(saved.types.goblin.image).toBeUndefined(); // no pictures in the save
    const a = World.restore(args({ ability: abilityOf({ id: 'h', ability: { id: 'shout' } }) }), saved);
    expect(a.enemies.length).toBe(w.enemies.length);
    run(w, 20); run(a, 20);
    expect(a.hud()).toEqual(w.hud());
    expect(a.enemies.map((e) => [e.id, Math.round(e.x), Math.round(e.hp)])).toEqual(w.enemies.map((e) => [e.id, Math.round(e.x), Math.round(e.hp)]));
  });
});
