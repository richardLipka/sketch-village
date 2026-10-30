import { describe, it, expect } from 'vitest';
import { World } from './world.js';
import { testMap, playGame } from './balanceBot.js';
import { DEFAULT_ENEMY_TYPES } from '../config/enemies.js';
import { defaultWaves } from '../config/waves.js';
import { DEFAULT_RULES } from '../config/rules.js';
import { DIFFICULTIES } from '../config/difficulty.js';

const make = (difficulty) => {
  const { map, grid } = testMap();
  return new World({ map, grid, enemyTypes: DEFAULT_ENEMY_TYPES, rules: DEFAULT_RULES, waves: defaultWaves(DEFAULT_RULES.balance), seed: 3, difficulty });
};

describe('difficulty', () => {
  it('scales monster health, speed and hits, start coins and lives', () => {
    const [normal, easy, hard] = ['normal', 'easy', 'hard'].map(make);
    const type = DEFAULT_ENEMY_TYPES[0];
    const hp = (w) => w.spawnEnemy(type.id, w.map.caves[0]).maxHp;
    expect(hp(easy)).toBeLessThan(hp(normal));
    expect(hp(hard)).toBeGreaterThan(hp(normal));
    expect(easy.types[type.id].speed).toBeCloseTo(type.speed * DIFFICULTIES.easy.enemySpeed);
    expect(easy.types[type.id].damage).toBeCloseTo(type.damage * DIFFICULTIES.easy.enemyDamage);
    expect(easy.coins).toBeGreaterThan(normal.coins);
    expect(hard.coins).toBeLessThan(normal.coins);
    expect(easy.hero.lives).toBe(normal.hero.lives + 2);
    expect(type.speed).toBe(DEFAULT_ENEMY_TYPES[0].speed); // the kids' numbers stay as they are
  });

  it('an unknown or missing level plays as normal', () => {
    expect(make('nonsense').coins).toBe(make(undefined).coins);
  });
});

describe('round summary', () => {
  it('every round end tells what happened in that round', () => {
    const g = playGame({ seed: 2 });
    const ends = [];
    // replay with the same seed and collect the events the summary card gets
    playGame({ seed: 2, onTick: (w) => { for (const e of w.events) if (e.type === 'roundEnd' && !ends.includes(e)) ends.push(e); } });
    expect(ends).toHaveLength(20);
    for (const e of ends) {
      expect(e.stats.defeated).toBeGreaterThan(0);
      expect(e.stats.waveTime).toBeGreaterThan(10);
      expect(e.stats).toHaveProperty('coins');
      expect(e.stats).toHaveProperty('lost');
    }
    expect(ends.reduce((n, e) => n + e.stats.lost, 0)).toBe(g.stats.reduce((n, s) => n + s.destroyed, 0));
  });
});
