import { describe, it, expect } from 'vitest';
import { playGame } from './balanceBot.js';

// Balance check with the default rules: an average build order wins, and the
// buildings next to the roads survive most rounds. SV_BALANCE=1 prints a table.

const SEEDS = [1, 2, 3, 4, 5];

describe('balance (bot plays 20 rounds)', () => {
  const games = SEEDS.map((seed) => playGame({ seed }));

  if (process.env.SV_BALANCE) {
    for (const [i, g] of games.entries()) {
      console.log(`seed ${SEEDS[i]}: ${g.result} at round ${g.round}, plan steps ${g.planDone}, lives lost ${g.stats.reduce((n, s) => n + s.livesLost, 0)}, waves ${g.stats.map((s) => Math.round(s.waveLength)).join(' ')}`);
      console.table(g.stats.map((s) => ({ r: s.round, lost: s.destroyed, th: Math.round(s.minTownHall), lives: s.livesLost, len: Math.round(s.waveLength), coins: s.coins, got: s.picked, gone: s.expired, bld: s.buildings })));
    }
  }

  it('wins every seed', () => {
    for (const g of games) expect(g.result).toBe('won');
  });

  it('loses only a few buildings over the whole game', () => {
    for (const g of games) {
      const lost = g.stats.reduce((n, s) => n + s.destroyed, 0);
      expect(lost).toBeLessThanOrEqual(8);
    }
  });

  it('every wave lasts about 40–60 s (average over the seeds)', () => {
    for (let r = 0; r < 20; r++) {
      const lens = games.map((g) => g.stats[r]?.waveLength).filter((x) => x !== undefined);
      const avg = lens.reduce((a, b) => a + b, 0) / lens.length;
      expect(avg, `round ${r + 1}`).toBeGreaterThanOrEqual(40);
      expect(avg, `round ${r + 1}`).toBeLessThanOrEqual(60);
    }
  });

  it('something new unlocks after every wave', () => {
    for (const g of games) {
      // the unlock event follows the round-end record, so stats[k] holds what opened for round k + 1
      for (const s of g.stats.slice(1, 20)) expect(s.unlocked?.length, `for round ${s.round}`).toBeGreaterThan(0);
    }
  });

  it('lives matter: a hero that never goes back to heal runs out of lives', () => {
    const careless = SEEDS.map((seed) => playGame({ seed, careful: false }));
    for (const g of careless) {
      expect(g.result).toBe('lost');
      expect(g.world.lostBy).toBe('hero');
    }
  });

  it('no building is lost in the first 4 rounds', () => {
    for (const g of games) expect(g.stats.slice(0, 4).every((s) => s.destroyed === 0)).toBe(true);
  });
}, 60000);

describe('difficulty levels (bot plays 20 rounds)', () => {
  const lost = (g) => g.stats.reduce((n, s) => n + s.destroyed, 0);
  const avg = (gs, f) => gs.reduce((a, g) => a + f(g), 0) / gs.length;
  const play = (difficulty, careful = true) => SEEDS.map((seed) => playGame({ seed, difficulty, careful }));

  it('easy: the careful bot wins without losing a building; a careless one gets much further than on normal', () => {
    const easy = play('easy');
    for (const g of easy) { expect(g.result).toBe('won'); expect(lost(g)).toBe(0); }
    const careless = avg(play('easy', false), (g) => g.round);
    expect(careless).toBeGreaterThanOrEqual(17);
    expect(careless).toBeGreaterThan(avg(play('normal', false), (g) => g.round) + 2);
  });

  it('hard: the same careful bot loses many more buildings than on normal', () => {
    const hard = play('hard');
    expect(avg(hard, lost)).toBeGreaterThan(avg(play('normal'), lost) + 4);
    expect(hard.filter((g) => g.result === 'won').length).toBeGreaterThanOrEqual(3); // still winnable
  });
}, 120000);
