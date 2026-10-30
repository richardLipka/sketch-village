import { describe, it, expect } from 'vitest';
import { lean, trialOf, summarizeTrials } from './mapTest.js';
import { playGame, testMap } from '../logic/balanceBot.js';
import { defaultWaves } from '../config/waves.js';
import { DEFAULT_RULES } from '../config/rules.js';
import { DEFAULT_BUILDING_TYPES } from '../config/buildings.js';

const round = (r, length, lost = 0, livesLost = 0) => ({ round: r, length, lost, livesLost, defeated: 5 });

describe('map test report', () => {
  it('drops pictures but keeps numbers and the walk grid', () => {
    const walk = new Uint8Array([1, 0, 1]);
    const out = lean({ image: 'data:image/png;base64,xx', name: 'Goblin', hp: 30, grid: { walk }, frames: ['data:image/webp;x'] });
    expect(out).toEqual({ image: null, name: 'Goblin', hp: 30, grid: { walk }, frames: [null] });
  });

  it('verdicts: never won, won some, won without a scratch, fine', () => {
    const lostGame = { result: 'lost', round: 2, rounds: [round(1, 40, 2)] };
    const clean = { result: 'won', round: 2, rounds: [round(1, 40), round(2, 50)] };
    const scratched = { result: 'won', round: 2, rounds: [round(1, 40), round(2, 50, 1)] };
    expect(summarizeTrials([lostGame, lostGame], 2).verdict).toBe('too_hard');
    expect(summarizeTrials([lostGame, clean], 2)).toMatchObject({ verdict: 'hard', wins: 1, lostAt: [2] });
    expect(summarizeTrials([clean, clean], 2).verdict).toBe('easy');
    expect(summarizeTrials([clean, scratched], 2).verdict).toBe('ok');
  });

  it('flags short, long and tough rounds from the averages', () => {
    const g = (len, lost) => ({ result: 'won', round: 1, rounds: [round(1, len, lost)] });
    expect(summarizeTrials([g(10, 0), g(14, 0)], 1).rounds[0].flags).toEqual(['short']);
    expect(summarizeTrials([g(100, 2), g(120, 0)], 1).rounds[0]).toMatchObject({ length: 110, lost: 1, flags: ['long', 'tough'] });
  });

  it('plays a map given from outside with its own spots and waves', () => {
    const { map, grid } = testMap();
    // a smaller map: only 4 spots, renamed, and 3 short rounds
    const own = { ...map, spots: map.spots.slice(0, 4).map((s, i) => ({ ...s, id: `kid-${i}` })) };
    const waves = { ...defaultWaves(DEFAULT_RULES.balance) };
    waves.rounds = waves.rounds.slice(0, 3);
    const g = playGame({ map: own, grid, waves, buildingTypes: DEFAULT_BUILDING_TYPES, seed: 1 });
    expect(g.result).toBe('won');
    expect(g.world.buildings.some((b) => b.spotId.startsWith('kid-'))).toBe(true);
    const report = summarizeTrials([trialOf(g)], 3);
    expect(report.rounds).toHaveLength(3);
    expect(report.wins).toBe(1);
  });
});
