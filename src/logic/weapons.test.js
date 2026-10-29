import { describe, it, expect } from 'vitest';
import { World } from './world.js';
import { DEFAULT_ENEMY_TYPES } from '../config/enemies.js';
import { DEFAULT_RULES } from '../config/rules.js';
import { DEFAULT_WEAPONS, withWeapon } from '../config/weapons.js';
import { TOWN_HALL_LEVELS } from '../config/buildings.js';

// plus-shaped roads crossing at the centre (same as the other world tests)
function makeWorld({ rounds = [{ groups: [] }, { groups: [] }], coins = 500, weapons = DEFAULT_WEAPONS } = {}) {
  const cols = 80, rows = 45, cell = 16;
  const walk = new Uint8Array(cols * rows);
  for (let x = 0; x < cols; x++) for (const y of [21, 22, 23]) walk[y * cols + x] = 1;
  for (let y = 0; y < rows; y++) for (const x of [39, 40, 41]) walk[y * cols + x] = 1;
  return new World({
    map: { centre: { x: 648, y: 360, radius: 60 }, caves: [{ id: 'left', x: 10, y: 360 }, { id: 'top', x: 648, y: 10 }], spots: [] },
    grid: { cols, rows, cell, walk }, enemyTypes: DEFAULT_ENEMY_TYPES, seed: 3, weapons,
    rules: { ...DEFAULT_RULES, unlocks: [] },
    waves: { startCoins: coins, firstPrep: 1000, prep: 1000, rounds },
  });
}
const run = (w, s, dt = 1 / 30) => { for (let t = 0; t < s && w.phase !== 'lost' && w.phase !== 'won'; t += dt) w.update(dt); };
const spawnAt = (w, type, x, y) => { w.spawn({ enemy: type, cave: 'left' }); const e = w.enemies.at(-1); e.x = x; e.y = y; return e; };

describe('weapons', () => {
  it('an equipped weapon adds to the attack of its class', () => {
    const w = makeWorld();
    const before = { ...w.heroStats.ranged };
    w.addWeapon('longbow');
    expect(w.equipped.ranged).toBe('longbow');
    expect(w.heroStats.ranged).toMatchObject({ damage: before.damage + 2, range: before.range + 60 });
    w.addWeapon('crossbow'); // second ranged weapon goes to the inventory, the first stays equipped
    expect(w.equipped.ranged).toBe('longbow');
    expect(w.equip('crossbow').ok).toBe(true);
    expect(w.heroStats.ranged.damage).toBe(before.damage + 8);
    expect(withWeapon({ damage: 5, range: 100, cooldown: 0.5 }, { kind: 'melee', damage: -20, cooldown: -2 })).toMatchObject({ damage: 1, cooldown: 0.3 });
  });

  it('magic needs a magic weapon and hurts everything around the target, flying too', () => {
    const w = makeWorld({ rounds: [{ groups: [] }] });
    expect(w.setMode('magic')).toBe(false);
    w.addWeapon('wand');
    expect(w.setMode('magic')).toBe(true);
    w.townHall.cooldown = 1e9; // keep the Town Hall's arrows out of this
    const h = w.hero;
    const a = spawnAt(w, 'goblin', h.x - 120, h.y);
    const b = spawnAt(w, 'bat', h.x - 140, h.y + 10);
    const far = spawnAt(w, 'goblin', h.x - 120, h.y - 200);
    const hp = [a.hp, b.hp, far.hp];
    w.attack(a.id);
    run(w, 0.8);
    expect(a.hp).toBeLessThan(hp[0]);
    expect(b.hp).toBeLessThan(hp[1]); // splash reached the flying bat
    expect(far.hp).toBe(hp[2]);
  });

  it('bosses drop a chest; walking over it gives a new weapon, coins when all are owned', () => {
    const w = makeWorld({ weapons: [DEFAULT_WEAPONS[0]] });
    const troll = spawnAt(w, 'troll', w.hero.x + 100, w.hero.y);
    w.damageEnemy(troll, 1e6);
    expect(w.chests).toHaveLength(1);
    const c = w.chests[0];
    w.moveHeroTo(c.x, c.y);
    run(w, 3);
    expect(w.inventory).toEqual(['sword']);
    expect(w.drainEvents().find((e) => e.type === 'chestOpened')).toMatchObject({ weapon: 'sword' });
    const coins = w.coins;
    expect(w.openChest()).toEqual({ coins: w.b.chestCoins });
    expect(w.coins).toBe(coins + w.b.chestCoins);
  });

  it('the Town Hall shop sells weapons: near, enough coins, from their round, once', () => {
    const w = makeWorld({ coins: 40 });
    expect(w.buyWeapon('axe').reason).toBe('locked'); // axe from round 6
    expect(w.buyWeapon('sword')).toEqual({ ok: true });
    expect(w.coins).toBe(15);
    expect(w.buyWeapon('sword').reason).toBe('owned');
    expect(w.buyWeapon('longbow').reason).toBe('locked'); // round 3
    w.round = 2;
    expect(w.buyWeapon('longbow').reason).toBe('coins');
    w.moveHeroTo(100, 360); run(w, 8);
    w.coins = 999;
    expect(w.buyWeapon('longbow').reason).toBe('far');
    expect(w.describeTownHall().shop.find((s) => s.id === 'sword').reason).toBe('owned');
  });
});

describe('Town Hall arrows', () => {
  it('shoots enemies in range with its level’s damage', () => {
    const w = makeWorld({ rounds: [{ groups: [] }] });
    w.hero.dead = true; w.hero.respawnAt = 1e9;
    const e = spawnAt(w, 'orc', w.townHall.x - 150, w.townHall.y);
    e.next = { x: e.x, y: e.y }; // stand still
    const shots = [];
    const shoot = w.shoot.bind(w);
    w.shoot = (from, target, dmg, owner, splash) => { if (from === w.townHall) shots.push(dmg); shoot(from, target, dmg, owner, splash); };
    run(w, 3);
    expect(shots.length).toBeGreaterThan(1);
    expect(shots[0]).toBe(TOWN_HALL_LEVELS[0].damage);
  });
});
