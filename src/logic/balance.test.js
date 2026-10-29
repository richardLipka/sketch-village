import { describe, it, expect } from 'vitest';
import { playGame } from './balanceBot.js';

// Balance check with the default rules: an average build order wins, and the
// buildings next to the roads survive most rounds. SV_BALANCE=1 prints a table.

const SEEDS = [1, 2, 3, 4, 5];

describe('balance (bot plays 20 rounds)', () => {
  const games = SEEDS.map((seed) => playGame({ seed }));

  if (process.env.SV_BALANCE) {
    for (const [i, g] of games.entries()) {
      console.log(`seed ${SEEDS[i]}: ${g.result} at round ${g.round}, plan steps ${g.planDone}`);
      console.table(g.stats.map((s) => ({ r: s.round, lost: s.destroyed, th: Math.round(s.minTownHall), lives: s.livesLost, coins: s.coins, got: s.picked, gone: s.expired, bld: s.buildings })));
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

  it('no building is lost in the first 4 rounds', () => {
    for (const g of games) expect(g.stats.slice(0, 4).every((s) => s.destroyed === 0)).toBe(true);
  });
}, 60000);
