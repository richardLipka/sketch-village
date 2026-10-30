import { describe, it, expect } from 'vitest';
import { World } from './world.js';
import { DEFAULT_ENEMY_TYPES } from '../config/enemies.js';
import { DEFAULT_BUILDING_TYPES } from '../config/buildings.js';
import { DEFAULT_RULES } from '../config/rules.js';

// Summoners (necromancer, spider queen) and the catapult's area attack.

// one long road along the middle, the Town Hall at its right end
function makeWorld({ enemyTypes = DEFAULT_ENEMY_TYPES, buildingTypes = DEFAULT_BUILDING_TYPES, coins = 500 } = {}) {
  const cols = 80, rows = 45, cell = 16;
  const walk = new Uint8Array(cols * rows);
  for (let x = 0; x < cols; x++) for (const y of [21, 22, 23]) walk[y * cols + x] = 1;
  const open = buildingTypes.map((t) => ({ ...t, levels: t.levels.map((l) => ({ ...l, round: 1 })) }));
  return new World({
    map: { centre: { x: 1200, y: 360, radius: 60 }, caves: [{ id: 'left', x: 10, y: 360 }], spots: [{ id: 's1', x: 700, y: 320 }] },
    grid: { cols, rows, cell, walk }, enemyTypes, buildingTypes: open, seed: 7,
    rules: { ...DEFAULT_RULES, unlocks: [] },
    waves: { startCoins: coins, firstPrep: 1000, prep: 1000, rounds: [{ groups: [] }, { groups: [] }] },
  });
}
const run = (w, s, dt = 1 / 30) => { for (let t = 0; t < s && w.phase !== 'lost' && w.phase !== 'won'; t += dt) w.update(dt); };
const at = (w, type, x, y = 360) => { const e = w.spawnEnemy(type, { x, y }); e.next = { x: e.x, y: e.y }; return e; };
const freeze = (w) => { for (const t of Object.values(w.types)) t.speed = 0; }; // nobody walks: easier to count

describe('summoners call minions', () => {
  it('a necromancer calls skeletons every few seconds, never more than its maximum', () => {
    const w = makeWorld();
    freeze(w);
    w.hero.dead = true; // keep the hero out of it
    const nec = at(w, 'necromancer', 200);
    const type = w.types.necromancer;
    const mine = () => w.enemies.filter((e) => e.summoner === nec.id);
    run(w, type.minionEvery - 0.5);
    expect(mine()).toHaveLength(0);
    run(w, 1);
    expect(mine()).toHaveLength(type.minionCount);
    expect(mine().every((e) => e.type === 'skeleton')).toBe(true);
    run(w, type.minionEvery * 6);
    expect(mine()).toHaveLength(type.minionMax); // capped
    expect(w.drainEvents().some((e) => e.type === 'summon')).toBe(true);
  });

  it('minions never call minions, and a spider queen leaves spiderlings when she dies', () => {
    const w = makeWorld();
    freeze(w);
    w.hero.dead = true;
    const queen = at(w, 'spider', 200);
    run(w, w.types.spider.minionEvery + 0.1);
    const young = w.enemies.filter((e) => e.summoner === queen.id);
    expect(young.length).toBe(w.types.spider.minionCount);
    w.damageEnemy(queen, 99999);
    const after = w.enemies.filter((e) => e.summoner === queen.id && !e.dead);
    expect(after.length).toBe(young.length + w.types.spider.minionOnDeath);
    // a spiderling made into a summoner still can't call anything (it is a minion)
    w.types.spiderling.minions = ['spiderling', 'goblin'];
    w.types.spiderling.minionEvery = 1;
    const before = w.enemies.filter((e) => !e.dead).length;
    run(w, 3);
    expect(w.enemies.filter((e) => !e.dead).length).toBe(before);
  });

  it('several minion kinds can be mixed; unknown ids are ignored', () => {
    const types = DEFAULT_ENEMY_TYPES.map((t) => (t.id === 'necromancer' ? { ...t, minions: ['skeleton', 'bat', 'nobody'], minionCount: 6, minionMax: 6 } : t));
    const w = makeWorld({ enemyTypes: types });
    freeze(w);
    w.hero.dead = true;
    const nec = at(w, 'necromancer', 200);
    run(w, w.types.necromancer.minionEvery + 0.1);
    const kinds = new Set(w.enemies.filter((e) => e.summoner === nec.id).map((e) => e.type));
    expect(kinds.size).toBeGreaterThan(1);
    expect(kinds.has('nobody')).toBe(false);
  });

  it('a wave ends only when the minions are gone too', () => {
    const w = makeWorld();
    w.waves.rounds[0] = { groups: [{ enemy: 'necromancer', count: 1 }] };
    w.callReady();
    run(w, 12);
    expect(w.enemies.some((e) => e.summoner)).toBe(true);
    const nec = w.enemies.find((e) => e.type === 'necromancer');
    w.damageEnemy(nec, 99999);
    run(w, 0.1);
    expect(w.phase).toBe('wave'); // its skeletons are still there
  });
});

describe('catapult (area attack)', () => {
  it('throws a stone at the biggest group of walking enemies and hurts all of them, not flying ones', () => {
    const w = makeWorld();
    freeze(w);
    w.hero.dead = true;
    w.hero.x = 700; w.hero.dead = false; w.hero.y = 360;
    expect(w.build('s1', 'catapult').ok).toBe(true);
    w.hero.dead = true;
    run(w, 30); // built
    const cat = w.buildings[0];
    expect(cat.level).toBe(1);
    const lone = at(w, 'goblin', 860);
    const group = [at(w, 'orc', 540), at(w, 'orc', 548, 352), at(w, 'orc', 545, 368)];
    const bat = at(w, 'bat', 544);
    const hp = (e) => e.hp;
    const loneHp = hp(lone), batHp = hp(bat), groupHp = group.map(hp);
    let lobbed = false;
    for (let i = 0; i < 300 && !lobbed; i++) { w.update(1 / 30); lobbed = w.drainEvents().some((e) => e.type === 'splash' && e.owner === 'stone'); }
    expect(lobbed).toBe(true);
    expect(group.every((e, i) => e.hp < groupHp[i])).toBe(true); // the whole group
    expect(lone.hp).toBe(loneHp); // not the single goblin
    expect(bat.hp).toBe(batHp); // stones don't hit flying enemies
  });

  it('does not throw at enemies right next to it or at flying ones only', () => {
    const w = makeWorld();
    freeze(w);
    w.hero.x = 700; w.hero.y = 360;
    w.build('s1', 'catapult');
    w.hero.dead = true;
    run(w, 30);
    at(w, 'goblin', 700, 340); // too close
    at(w, 'bat', 600); // flying
    run(w, 10);
    expect(w.projectiles.some((p) => p.owner === 'stone')).toBe(false);
  });
});
