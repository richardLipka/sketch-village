// The wave limit test (SPEC §10b): how far is every wave of a map from what a
// careful player can hold? The balance robot plays the map once per seed and
// remembers the game at the start of every round; then, from there, it plays
// each round again with more and more monsters (logic/waveGen.js scaleRound:
// the round's own kinds, +DSP) until it is consistently defeated – it loses at
// least 2 of 3 games. A round the robot can't even hold as it is gets weaker
// until it holds. Pure – runs in node (tests, scripts) and in a Web Worker
// (maps/mapTest.worker.js, the wave editor's "Find the limits").

import { startGame, stepGame } from './balanceBot.js';
import { dspTable, roundDsp } from './dsp.js';
import { scaleRound } from './waveGen.js';
import { BALANCE } from '../config/balance.js';
import { defaultWaves } from '../config/waves.js';

export const LIMIT_SEEDS = [1, 2, 3];
export const LIMIT_UP = [1.25, 1.5, 2, 3, 4, 6, 8]; // stronger and stronger until the robot falls
export const LIMIT_DOWN = [0.8, 0.6, 0.4, 0.25]; // a round it can't hold: weaker until it does
export const LIMIT_PRECISION = 0.1; // then the gap between held and fell is halved until within 10 %
const ROUND_TIME = 300; // s of game time for one round; a round that doesn't end by then counts as held

/** Play a game once and keep a copy of it at the start of every round. */
export function snapshotRounds(setup, seed) {
  const { w, bot } = startGame({ ...setup, seed });
  const snaps = [{ w: w.clone(), bot: structuredClone(bot) }];
  const limit = 200 * w.totalRounds;
  while (bot.t < limit && w.phase !== 'won' && w.phase !== 'lost') {
    for (const e of stepGame(w, bot)) {
      if (e.type === 'roundEnd' && w.phase === 'prep') snaps[w.round] = { w: w.clone(), bot: structuredClone(bot) };
    }
  }
  return { snaps, result: w.phase, round: w.round };
}

/**
 * From a copy of the game at the start of round `index`, play that round as
 * `round` (instead of the map's) – 'held' when it ends, 'fell' when the game is lost.
 */
export function playRound(snap, index, round) {
  const w = snap.w.clone(), bot = structuredClone(snap.bot);
  w.waves = { ...w.waves, rounds: w.waves.rounds.map((r, i) => (i === index ? round : r)) };
  const until = bot.t + 30 + ROUND_TIME + (w.prepLeft ?? 0);
  while (bot.t < until) {
    for (const e of stepGame(w, bot)) {
      if (e.type === 'roundEnd' && e.round === index + 1) return 'held';
    }
    if (w.phase === 'lost') return 'fell';
    if (w.phase === 'won') return 'held';
  }
  return 'held';
}

/** Consistently = most of the games: 2 of 3 (both of 2, the one of 1). */
export const consistently = (fell, games) => fell * 2 > games;

/**
 * For every round (or `rounds`, 0-based): the strength (×) at which the robot
 * is consistently defeated. Returns { rounds: [{ round, dsp, limit, holds,
 * limitDsp, status, games }], seeds } – limit = the smallest tried factor that
 * broke it (null: it held even ×8), holds = the biggest that it held; status:
 * 'too_hard' (the map's own wave breaks it), 'tight' (< ×1.25), 'ok',
 * 'strong' (held ×8), 'not_reached' (the robot lost earlier, the round wasn't
 * played). onProgress(done, total) after every round.
 */
export function findWaveLimits(setup0, { seeds = LIMIT_SEEDS, rounds, balance = setup0.rules?.balance ?? BALANCE, onProgress } = {}) {
  const waves = setup0.waves ?? defaultWaves(balance);
  const setup = { ...setup0, waves };
  const table = dspTable(setup.enemyTypes ?? []);
  const indexes = rounds ?? waves.rounds.map((_, i) => i);
  const games = seeds.map((seed) => snapshotRounds(setup, seed));
  const out = [];
  indexes.forEach((r, n) => {
    const original = waves.rounds[r];
    const dsp = roundDsp(original, r, table, balance, waves.growth);
    const snaps = games.map((g) => g.snaps[r]).filter(Boolean);
    if (!snaps.length) { out.push({ round: r + 1, dsp, limit: null, holds: null, limitDsp: null, status: 'not_reached', games: 0 }); onProgress?.(n + 1, indexes.length); return; }
    const tried = new Map(); // factor → fell consistently?
    const fails = (f) => {
      const key = Math.round(f * 1000);
      if (!tried.has(key)) {
        const round = f === 1 ? original : scaleRound(original, f, table);
        const fell = snaps.filter((s) => playRound(s, r, round) === 'fell').length;
        tried.set(key, consistently(fell, snaps.length));
      }
      return tried.get(key);
    };
    let lo = null, hi = null;
    if (fails(1)) {
      hi = 1;
      for (const f of LIMIT_DOWN) { if (!fails(f)) { lo = f; break; } hi = f; }
    } else {
      lo = 1;
      for (const f of LIMIT_UP) { if (fails(f)) { hi = f; break; } lo = f; }
    }
    if (lo !== null && hi !== null) {
      while (hi / lo > 1 + LIMIT_PRECISION) {
        const mid = Math.round(Math.sqrt(lo * hi) * 100) / 100;
        if (mid <= lo || mid >= hi) break;
        if (fails(mid)) hi = mid; else lo = mid;
      }
    }
    const status = hi === null ? 'strong' : hi <= 1 ? 'too_hard' : hi < 1.25 ? 'tight' : 'ok';
    out.push({ round: r + 1, dsp, limit: hi, holds: lo, limitDsp: hi === null ? null : dsp * hi, status, games: snaps.length });
    onProgress?.(n + 1, indexes.length);
  });
  return { rounds: out, seeds: seeds.length };
}
