import { describe, it, expect } from 'vitest';
import { World } from './world.js';
import { DEFAULT_ENEMY_TYPES } from '../config/enemies.js';
import { DEFAULT_RULES } from '../config/rules.js';
import { DEFAULT_WEAPONS, withWeapon, normalizeItem } from '../config/weapons.js';
import { TOWN_HALL_LEVELS } from '../config/buildings.js';

// plus-shaped roads crossing at the centre (same as the other world tests)
function makeWorld({ rounds = [{ groups: [] }, { groups: [] }], coins = 500, weapons = DEFAULT_WEAPONS, coinTypes } = {}) {
  const cols = 80, rows = 45, cell = 16;
  const walk = new Uint8Array(cols * rows);
  for (let x = 0; x < cols; x++) for (const y of [21, 22, 23]) walk[y * cols + x] = 1;
  for (let y = 0; y < rows; y++) for (const x of [39, 40, 41]) walk[y * cols + x] = 1;
  return new World({
    map: { centre: { x: 648, y: 360, radius: 60 }, caves: [{ id: 'left', x: 10, y: 360 }, { id: 'top', x: 648, y: 10 }], spots: [] },
    grid: { cols, rows, cell, walk }, enemyTypes: DEFAULT_ENEMY_TYPES, seed: 3, weapons, coinTypes,
    rules: { ...DEFAULT_RULES, unlocks: [] },
    waves: { startCoins: coins, firstPrep: 1000, prep: 1000, rounds },
  });
}
const run = (w, s, dt = 1 / 30) => { for (let t = 0; t < s && w.phase !== 'lost' && w.phase !== 'won'; t += dt) w.update(dt); };
const spawnAt = (w, type, x, y) => { w.spawn({ enemy: type, cave: 'left' }); const e = w.enemies.at(-1); e.x = x; e.y = y; e.next = { x, y }; return e; };
const switched = (w) => run(w, w.b.weaponSwitchTime + 0.1);

describe('equipment', () => {
  it('starts with the weak sword in hand and the short bow in the backpack', () => {
    const w = makeWorld();
    expect(w.inventory).toEqual(['stick', 'shortbow']);
    expect(w.equipped).toEqual({ right: 'stick', left: null, armor: null });
    expect(w.hero.mode).toBe('melee');
  });

  it('the attack buttons take a weapon of that class into the hand; switching takes 2 s', () => {
    const w = makeWorld();
    expect(w.setMode('magic')).toBe('none');
    expect(w.setMode('ranged')).toBeNull();
    expect(w.equipped.right).toBe('shortbow');
    expect(w.hero.mode).toBe('ranged');
    expect(w.setMode('melee')).toBe('switching'); // still changing weapons
    switched(w);
    expect(w.setMode('melee')).toBeNull();
    expect(w.equipped.right).toBe('stick');
  });

  it('no attacks while changing weapons', () => {
    const w = makeWorld({ rounds: [{ groups: [] }] });
    w.townHall.cooldown = 1e9;
    w.setMode('ranged');
    const e = spawnAt(w, 'orc', w.hero.x - 120, w.hero.y);
    const hp = e.hp;
    w.attack(e.id);
    run(w, 1.5);
    expect(e.hp).toBe(hp);
    run(w, 1.5);
    expect(e.hp).toBeLessThan(hp);
  });

  it('a weapon adds to its attack; two-handed weapons push the shield off; shield and armor add armor', () => {
    const w = makeWorld();
    const base = { ...w.heroStats.melee };
    const armor0 = w.heroStats.armor;
    w.addWeapon('sword');
    w.equip('sword');
    expect(w.heroStats.melee.damage).toBe(base.damage + 6);
    w.addWeapon('woodshield'); // free left hand → put on at once
    w.addWeapon('leather');
    expect(w.equipped).toMatchObject({ left: 'woodshield', armor: 'leather' });
    expect(w.heroStats.armor).toBeCloseTo(armor0 + 0.16);
    switched(w);
    w.addWeapon('axe');
    expect(w.equip('axe').ok).toBe(true);
    expect(w.equipped.left).toBeNull(); // two-handed
    expect(w.equip('woodshield').reason).toBe('twohand');
    expect(w.heroStats.armor).toBeCloseTo(armor0 + 0.08);
    expect(w.equip('leather').ok).toBe(true); // clicking worn armor takes it off
    expect(w.equipped.armor).toBeNull();
    expect(withWeapon({ damage: 5, range: 100, cooldown: 0.5 }, { kind: 'melee', damage: -20, cooldown: -2 })).toMatchObject({ damage: 1, cooldown: 0.3 });
    expect(normalizeItem({ id: 'old', kind: 'ranged' }).slot).toBe('twohand');
  });

  it('backpack drag & drop: items go only into their own slot and come off again', () => {
    const w = makeWorld();
    for (const id of ['sword', 'axe', 'woodshield', 'leather']) w.addWeapon(id);
    w.unequip('left'); w.unequip('armor');
    expect(w.equipTo('leather', 'right').reason).toBe('wrong_slot');
    expect(w.equipTo('woodshield', 'armor').reason).toBe('wrong_slot');
    expect(w.equipTo('woodshield', 'left').ok).toBe(true);
    expect(w.equipTo('leather', 'armor').ok).toBe(true);
    const armored = w.heroStats.armor;
    expect(w.unequip('armor').ok).toBe(true);
    expect(w.heroStats.armor).toBeLessThan(armored); // the change shows in the hero's numbers
    run(w, 3);
    expect(w.equipTo('axe', 'left').ok).toBe(true); // two-handed: dropped on either hand, takes both
    expect(w.equipped).toMatchObject({ right: 'axe', left: null });
    expect(w.hud().hero.attack).toBeGreaterThan(0);
    run(w, 3);
    expect(w.unequip('right').ok).toBe(true); // bare hands
    expect(w.equipped.right).toBeNull();
    expect(w.mode).toBe('melee');
  });

  it('magic hurts everything around the target, flying too', () => {
    const w = makeWorld({ rounds: [{ groups: [] }] });
    w.addWeapon('wand');
    expect(w.setMode('magic')).toBeNull();
    switched(w);
    w.townHall.cooldown = 1e9;
    const h = w.hero;
    const a = spawnAt(w, 'goblin', h.x - 120, h.y);
    const b = spawnAt(w, 'bat', h.x - 140, h.y + 10);
    const far = spawnAt(w, 'goblin', h.x - 120, h.y - 200);
    const hp = [a.hp, b.hp, far.hp];
    w.attack(a.id);
    run(w, 0.8);
    expect(a.hp).toBeLessThan(hp[0]);
    expect(b.hp).toBeLessThan(hp[1]);
    expect(far.hp).toBe(hp[2]);
  });

  it('bosses drop a chest with a new item; coins when everything is owned', () => {
    const w = makeWorld({ weapons: [DEFAULT_WEAPONS[0], DEFAULT_WEAPONS[2]] });
    const troll = spawnAt(w, 'troll', w.hero.x + 100, w.hero.y);
    w.damageEnemy(troll, 1e6);
    expect(w.chests).toHaveLength(1);
    w.moveHeroTo(w.chests[0].x, w.chests[0].y);
    run(w, 3);
    expect(w.inventory).toEqual(['stick', 'sword']);
    const coins = w.coins;
    expect(w.openChest()).toEqual({ coins: w.b.chestCoins });
    expect(w.coins).toBe(coins + w.b.chestCoins);
  });

  it('the Town Hall shop: near, enough coins, from its round, once', () => {
    const w = makeWorld({ coins: 40 });
    expect(w.buyWeapon('axe').reason).toBe('locked');
    expect(w.buyWeapon('sword')).toEqual({ ok: true });
    expect(w.coins).toBe(15);
    expect(w.buyWeapon('sword').reason).toBe('owned');
    w.round = 2;
    expect(w.buyWeapon('longbow').reason).toBe('coins');
    w.moveHeroTo(100, 360); run(w, 8);
    w.coins = 999;
    expect(w.buyWeapon('longbow').reason).toBe('far');
  });
});

describe('Ready speeds up construction', () => {
  it('the skipped prep time is added to buildings in progress', () => {
    const w = makeWorld({ rounds: [{ groups: [] }, { groups: [] }] });
    w.prepLeft = 12;
    w.spots.push({ id: 's', index: 0, x: w.hero.x + 30, y: w.hero.y - 60 });
    expect(w.build('s', 'house').ok).toBe(true); // 10 s house
    w.callReady();
    w.update(0.01);
    expect(w.buildingOn('s').state).toBe('ready');
  });
});

describe('coins of different values', () => {
  it('drops are split into the biggest coins first and picking one up adds its value', () => {
    const w = makeWorld({ coinTypes: [{ value: 1, key: 'c1' }, { value: 5, key: 'c5' }] });
    const troll = spawnAt(w, 'troll', w.hero.x + 60, w.hero.y); // 20 coins
    const before = w.coins;
    w.damageEnemy(troll, 1e6);
    expect(w.coinsOnGround.map((c) => c.value)).toEqual([5, 5, 5, 5]);
    w.moveHeroTo(w.coinsOnGround[0].x, w.coinsOnGround[0].y);
    run(w, 3);
    expect(w.coins - before).toBe(20 + 0); // the boss chest gave an item, not coins
  });
});

describe('Town Hall arrows', () => {
  it('shoots enemies in range with its level’s damage', () => {
    const w = makeWorld({ rounds: [{ groups: [] }] });
    w.hero.dead = true; w.hero.respawnAt = 1e9;
    spawnAt(w, 'orc', w.townHall.x - 150, w.townHall.y);
    const shots = [];
    const shoot = w.shoot.bind(w);
    w.shoot = (from, target, dmg, owner, splash) => { if (from === w.townHall) shots.push(dmg); shoot(from, target, dmg, owner, splash); };
    run(w, 3);
    expect(shots.length).toBeGreaterThan(1);
    expect(shots[0]).toBe(TOWN_HALL_LEVELS[0].damage);
  });
});
