import { describe, it, expect } from 'vitest';
import { findWaveLimits, consistently, snapshotRounds, playRound } from './waveLimit.js';
import { startGame, stepGame } from './balanceBot.js';
import { DEFAULT_ENEMY_TYPES } from '../config/enemies.js';
import { defaultWaves } from '../config/waves.js';

// The wave limit test (SPEC §10b): the robot plays a round again from the same
// start with more and more monsters until it is consistently defeated.

describe('a copied game plays on exactly like the original', () => {
  it('the same monsters, buildings, hero and random numbers two minutes later', () => {
    const { w, bot } = startGame({ seed: 3 });
    while (w.round < 4) stepGame(w, bot);
    const w2 = w.clone(), bot2 = structuredClone(bot);
    for (let i = 0; i < 30 * 120; i++) { stepGame(w, bot); stepGame(w2, bot2); }
    const key = (x) => JSON.stringify({ t: x.time, c: x.coins, r: x.round, e: x.enemies.map((e) => [e.id, Math.round(e.x), Math.round(e.y), e.hp]), b: x.buildings.map((b) => [b.type, b.level, Math.round(b.hp)]), h: [x.hero.x, x.hero.y, x.hero.hp], rng: x.rng.state });
    expect(key(w2)).toBe(key(w));
    expect(w2.map).toBe(w.map); // the map and roads are shared, not copied
    expect(w2.enemies).not.toBe(w.enemies);
  });
});

describe('finding the limits', () => {
  it('consistently = most of the games', () => {
    expect([consistently(2, 3), consistently(1, 3), consistently(2, 2), consistently(1, 2), consistently(1, 1), consistently(0, 0)]).toEqual([true, false, true, false, true, false]);
  });

  it('the built-in waves leave the robot room: it falls only when they are clearly stronger', () => {
    const r = findWaveLimits({ enemyTypes: DEFAULT_ENEMY_TYPES }, { rounds: [0, 11] });
    expect(r.rounds.map((x) => x.round)).toEqual([1, 12]);
    for (const x of r.rounds) {
      expect(x.status, `round ${x.round}`).toBe('ok');
      expect(x.limit, `round ${x.round}`).toBeGreaterThan(1.5);
      expect(x.holds).toBeLessThan(x.limit);
      expect(x.limit / x.holds).toBeLessThanOrEqual(1.1 + 1e-9); // found to within 10 %
      expect(x.limitDsp).toBeCloseTo(x.dsp * x.limit, 6);
      expect(x.games).toBe(3);
    }
  }, 60000);

  it('a wave the robot can’t hold as it is: weaker until it holds', () => {
    const waves = defaultWaves();
    waves.rounds[1] = { groups: [{ enemy: 'orc', count: 60, interval: 0.4, delay: 0, spawn: 'all' }] };
    const r = findWaveLimits({ enemyTypes: DEFAULT_ENEMY_TYPES, waves }, { rounds: [1], seeds: [1, 2] });
    expect(r.rounds[0].status).toBe('too_hard');
    expect(r.rounds[0].limit).toBeLessThanOrEqual(1);
    // what it holds is less – or nothing at all (null: even a quarter of it breaks the robot)
    if (r.rounds[0].holds !== null) expect(r.rounds[0].holds).toBeLessThan(r.rounds[0].limit);
  }, 60000);

  it('a round the robot never reaches is said so', () => {
    const waves = defaultWaves();
    waves.rounds[0] = { groups: [{ enemy: 'troll', count: 30, interval: 0.3, delay: 0, spawn: 'all' }] };
    const r = findWaveLimits({ enemyTypes: DEFAULT_ENEMY_TYPES, waves }, { rounds: [5], seeds: [1] });
    expect(r.rounds[0]).toMatchObject({ round: 6, status: 'not_reached', limit: null, games: 0 });
  }, 60000);

  it('a round is played from its start as given', () => {
    const { snaps } = snapshotRounds({ enemyTypes: DEFAULT_ENEMY_TYPES, waves: defaultWaves() }, 1);
    expect(playRound(snaps[0], 0, defaultWaves().rounds[0])).toBe('held');
    expect(playRound(snaps[0], 0, { groups: [{ enemy: 'troll', count: 40, interval: 0.2, delay: 0, spawn: 'all' }] })).toBe('fell');
  }, 60000);
});
