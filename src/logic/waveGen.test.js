import { describe, it, expect } from 'vitest';
import { fitGroups, scaleWaves, generateWaves, genTarget, WAVE_SPAN, GEN_DEFAULTS } from './waveGen.js';
import { dspTable, wavesDsp, groupsDsp } from './dsp.js';
import { roundDuration, roundSummary } from './waves.js';
import { DEFAULT_ENEMY_TYPES } from '../config/enemies.js';
import { DEFAULT_ENEMY_STATS } from '../config/components.js';
import { defaultWaves } from '../config/waves.js';

// Waves from DSP (SPEC §10b): every wave of a map stronger or weaker by a share
// (monsters of its own kinds added or removed), and whole plans generated from
// the monsters a kid picks, stronger every round.

const types = DEFAULT_ENEMY_TYPES.map((t) => ({ ...DEFAULT_ENEMY_STATS, ...t }));
const table = dspTable(types);
const kinds = (r) => new Set(r.groups.map((g) => g.enemy));

describe('fitting a round to a strength', () => {
  const groups = [{ enemy: 'goblin', count: 10, interval: 3, delay: 0 }, { enemy: 'troll', count: 1, interval: 1, delay: 2 }];

  it('scales the counts and fills the rest with the kind that fits best: the troll stays alone', () => {
    const now = groupsDsp(groups, table);
    const up = fitGroups(groups, now * 1.1, table);
    expect(up.find((g) => g.enemy === 'troll').count).toBe(1); // +10 % isn't a second troll
    expect(Math.abs(groupsDsp(up, table) - now * 1.1)).toBeLessThanOrEqual(table.goblin / 2 + 1e-9);
    const double = fitGroups(groups, now * 2, table);
    expect(double.find((g) => g.enemy === 'troll').count).toBe(2);
    expect(double.find((g) => g.enemy === 'goblin').count).toBe(20);
  });

  it('a group keeps the time from its first to its last monster', () => {
    const up = fitGroups(groups, groupsDsp(groups, table) * 2, table);
    const g = up.find((x) => x.enemy === 'goblin');
    expect((g.count - 1) * g.interval).toBeCloseTo(9 * 3, 0);
  });

  it('never leaves a round empty; a kind that dropped to none goes', () => {
    expect(fitGroups(groups, 1, table)).toEqual([expect.objectContaining({ enemy: 'goblin', count: 1 })]);
    expect(fitGroups([], 50, table)).toEqual([]);
  });
});

describe('all waves of a map stronger or weaker', () => {
  const waves = defaultWaves();
  const before = wavesDsp(waves, table);

  for (const factor of [1.1, 0.9, 1.5]) {
    it(`×${factor}: every round about ${Math.round((factor - 1) * 100)} %, with its own kinds only`, () => {
      const scaled = scaleWaves(waves, factor, types);
      const after = wavesDsp(scaled, table);
      const errors = after.map((r, i) => r.dsp / (before[i].dsp * factor) - 1);
      for (const [i, e] of errors.entries()) expect(Math.abs(e), `round ${i + 1}`).toBeLessThan(0.1);
      expect(errors.reduce((a, e) => a + Math.abs(e), 0) / errors.length).toBeLessThan(0.03);
      for (const [i, r] of scaled.rounds.entries()) for (const k of kinds(r)) expect(kinds(waves.rounds[i]).has(k)).toBe(true);
      expect(scaled.startCoins).toBe(waves.startCoins);
    });
  }
});

describe('generating a plan', () => {
  const all = types.map((t) => t.id);

  it('makes the asked number of rounds from the chosen monsters, each stronger, close to the aim', () => {
    const waves = generateWaves({ enemies: all }, types);
    expect(waves.rounds).toHaveLength(GEN_DEFAULTS.rounds);
    const rows = wavesDsp(waves, table);
    for (const [i, r] of rows.entries()) {
      expect(r.dsp / genTarget(GEN_DEFAULTS.first, GEN_DEFAULTS.growth, i), `round ${i + 1}`).toBeGreaterThan(0.85);
      expect(r.dsp / genTarget(GEN_DEFAULTS.first, GEN_DEFAULTS.growth, i), `round ${i + 1}`).toBeLessThan(1.15);
      if (i > 0) expect(r.change, `round ${i + 1}`).toBeGreaterThan(0);
    }
    // every chosen kind has its turn, new ones come one by one (weaker first)
    const firstSeen = all.map((id) => waves.rounds.findIndex((r) => kinds(r).has(id)));
    expect(firstSeen.every((i) => i >= 0)).toBe(true);
    expect(new Set(firstSeen).size).toBeGreaterThan(10);
    // monsters come out over about WAVE_SPAN seconds
    for (const r of waves.rounds) expect(roundDuration(r)).toBeLessThanOrEqual(WAVE_SPAN + 6);
  });

  it('uses only the chosen monsters; strong ones only once the waves are big enough', () => {
    const waves = generateWaves({ enemies: ['goblin', 'orc', 'troll'], rounds: 12, first: 60, growth: 0.2 }, types);
    for (const r of waves.rounds) for (const k of kinds(r)) expect(['goblin', 'orc', 'troll']).toContain(k);
    expect(roundSummary(waves.rounds[0])).toEqual({ goblin: 6 });
    const troll = waves.rounds.findIndex((r) => kinds(r).has('troll'));
    expect(genTarget(60, 0.2, troll)).toBeGreaterThan(table.troll);
  });

  it('is the same every time; nothing to choose from = nothing made', () => {
    const a = generateWaves({ enemies: ['bat', 'goblin'], rounds: 5 }, types);
    expect(generateWaves({ enemies: ['goblin', 'bat'], rounds: 5 }, types)).toEqual(a);
    expect(generateWaves({ enemies: ['nobody'] }, types)).toBe(null);
    expect(generateWaves({ enemies: [] }, types)).toBe(null);
  });

  it('keeps the map’s start coins and preparation times', () => {
    const w = generateWaves({ enemies: ['goblin'], rounds: 2, base: { startCoins: 77, firstPrep: 33, prep: 11 } }, types);
    expect(w).toMatchObject({ startCoins: 77, firstPrep: 33, prep: 11 });
  });
});

describe('a little weaker keeps every kind', () => {
  it('5 % weaker doesn’t take a round’s boss away; a much weaker round may lose kinds', () => {
    const waves = defaultWaves();
    const scaled = scaleWaves(waves, 0.95, types);
    for (const [i, r] of scaled.rounds.entries()) expect(kinds(r), `round ${i + 1}`).toEqual(kinds(waves.rounds[i]));
    const tiny = scaleWaves(waves, 0.3, types).rounds[19];
    expect(groupsDsp(tiny.groups, table)).toBeLessThan(groupsDsp(waves.rounds[19].groups, table) * 0.45);
  });
});
