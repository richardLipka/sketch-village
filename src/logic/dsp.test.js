import { describe, it, expect } from 'vitest';
import { monsterDsp, dspTable, roundDsp, wavesDsp, groupsDsp, minionCalls } from './dsp.js';
import { DEFAULT_ENEMY_TYPES } from '../config/enemies.js';
import { DEFAULT_ENEMY_STATS } from '../config/components.js';
import { defaultWaves } from '../config/waves.js';
import { BALANCE } from '../config/balance.js';

// DSP – danger strength points (SPEC §10b): a goblin is worth 10, abilities
// multiply, summoners add their minions; the constants were measured with the
// robot, and the built-in plan gets stronger every round.

const types = DEFAULT_ENEMY_TYPES.map((t) => ({ ...DEFAULT_ENEMY_STATS, ...t }));
const goblin = types.find((t) => t.id === 'goblin');
const dsp = (t) => monsterDsp(t, types).dsp;

// how many goblins one of them is worth – measured by `npm run calibrate-dsp`
// (the robot's defence at rounds 6 and 12 breaks with N goblins or N / worth of these)
const MEASURED = { goblin: 1, wolf: 0.97, archer: 1.15, orc: 3.21, bat: 0.9, troll: 11.26, skeleton: 0.83, necromancer: 9.7, spiderling: 0.42, spider: 9.61, dragon: 15.93, rukh: 6.59 };

describe('a monster’s DSP', () => {
  it('a goblin is worth 10', () => {
    expect(dsp(goblin)).toBeCloseTo(10, 6);
    expect(dsp(types.find((t) => t.id === 'goblinPack'))).toBeCloseTo(10, 6);
  });

  it('abilities multiply: ranged, flying, area damage, armour; speed and toughness less than linearly', () => {
    expect(dsp({ ...goblin, ranged: true, range: 150 }) / 10).toBeCloseTo(1.4, 2);
    expect(dsp({ ...goblin, ranged: true, range: 300 })).toBeGreaterThan(dsp({ ...goblin, ranged: true, range: 150 }));
    expect(dsp({ ...goblin, flying: true }) / 10).toBeCloseTo(1.3, 2);
    expect(dsp({ ...goblin, splash: 80 }) / 10).toBeCloseTo(1.28, 2);
    expect(dsp({ ...goblin, splash: 1000 }) / 10).toBeCloseTo(1.6, 2); // area capped
    expect(dsp({ ...goblin, armor: 0.5 })).toBeGreaterThan(dsp(goblin));
    const fast = dsp({ ...goblin, speed: 90 }) / 10, tough = dsp({ ...goblin, hp: 100 }) / 10;
    expect(fast).toBeGreaterThan(1);
    expect(fast).toBeLessThan(1.15);
    expect(tough).toBeGreaterThan(2);
    expect(tough).toBeLessThan(4);
  });

  it('a summoner adds the minions it calls in its life; a fragile one calls fewer; minions never count their own', () => {
    const summoner = { ...goblin, id: 's', minions: ['goblin'], minionCount: 2, minionEvery: 8, minionMax: 6 };
    const tough = { ...summoner, hp: 100 };
    expect(minionCalls(summoner)).toBeLessThan(minionCalls(tough));
    const d = monsterDsp(summoner, types);
    expect(d.minions).toBeCloseTo(d.calls * 10, 6);
    expect(monsterDsp({ ...summoner, summons: false }, types).minions).toBe(0);
    expect(monsterDsp({ ...summoner, minions: ['nobody'] }, types).minions).toBe(0);
    // more die-calls (the spider queen lets her young out when she dies) add up
    expect(dsp({ ...summoner, minionOnDeath: 4 })).toBeCloseTo(dsp(summoner) + 40, 6);
  });

  it('matches what the robot measured every built-in monster to be worth (within 15 %)', () => {
    for (const [id, worth] of Object.entries(MEASURED)) {
      const t = types.find((x) => x.id === id);
      expect(dsp(t) / 10 / worth, id).toBeGreaterThan(0.85);
      expect(dsp(t) / 10 / worth, id).toBeLessThan(1.15);
    }
  });

  it('broken numbers don’t break it', () => {
    for (const t of [{}, { hp: -5 }, { hp: 'x', speed: 0, cooldown: 0 }, { armor: 5 }]) expect(Number.isFinite(monsterDsp(t, types).dsp)).toBe(true);
  });
});

describe('a wave’s DSP', () => {
  const table = dspTable(types);

  it('is the sum of its monsters with the round’s health growth', () => {
    const round = { groups: [{ enemy: 'goblin', count: 8 }, { enemy: 'troll', count: 1 }, { enemy: 'nobody', count: 5 }] };
    expect(groupsDsp(round.groups, table)).toBeCloseTo(80 + table.troll, 6);
    expect(roundDsp(round, 0, table)).toBeCloseTo(80 + table.troll, 6);
    expect(roundDsp(round, 10, table)).toBeCloseTo((80 + table.troll) * (1 + BALANCE.hpScalePerRound * 10), 6);
  });

  it('the built-in plan gets stronger every round', () => {
    const rows = wavesDsp(defaultWaves(), table);
    expect(rows).toHaveLength(20);
    expect(rows[0]).toMatchObject({ round: 1, change: null });
    expect(Math.round(rows[0].dsp)).toBe(80); // 8 goblins
    for (const r of rows.slice(1)) expect(r.change, `round ${r.round}`).toBeGreaterThanOrEqual(0.03);
    expect(rows.at(-1).dsp).toBe(Math.max(...rows.map((r) => r.dsp))); // the finale is the strongest
  });
});
