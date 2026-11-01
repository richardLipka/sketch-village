// npm run calibrate-dsp – measures the DSP constants (src/logic/dsp.js) with
// the balance robot instead of guessing them. At two moments of the built-in
// game (the start of rounds 6 and 12, the robot's defence as it is then) a
// round of N copies of one monster comes, spread over 28 s; N grows until the
// robot is consistently defeated (2 of 3 games). A monster that breaks it with
// N/3 copies is worth 3 goblins. Measured: every built-in monster and the
// goblin made ranged, flying, area-hitting, faster, tougher, more harmful or
// summoning. The constants are then fitted so the DSP of every one of them is
// as close as possible to what it was measured to be worth (log error), and
// printed with the error per monster.
//
//   node scripts/calibrate-dsp.mjs          (≈ 1–2 minutes)

import { snapshotRounds, playRound, consistently } from '../src/logic/waveLimit.js';
import { monsterDsp, DSP_K } from '../src/logic/dsp.js';
import { DEFAULT_ENEMY_TYPES } from '../src/config/enemies.js';
import { DEFAULT_ENEMY_STATS } from '../src/config/components.js';

const full = (t) => ({ ...DEFAULT_ENEMY_STATS, ...t });
const goblin = full(DEFAULT_ENEMY_TYPES.find((t) => t.id === 'goblin'));
const VARIANTS = {
  ranged: { ranged: true, range: 150 },
  flying: { flying: true },
  area80: { splash: 80 },
  fast2: { speed: 90 },
  tough4: { hp: 100 },
  harm3: { damage: 12 },
  summoner: { minions: ['goblin'], minionCount: 2, minionEvery: 8, minionMax: 6, summons: true },
};
const variants = Object.entries(VARIANTS).map(([id, v]) => full({ ...goblin, ...v, id: `cal_${id}`, themes: [] }));
const builtIns = DEFAULT_ENEMY_TYPES.map(full).filter((t) => !['goblinPack', 'skeletonWarrior'].includes(t.id)); // same numbers as goblin / skeleton
const types = [...DEFAULT_ENEMY_TYPES.map(full), ...variants];
const measured = [...builtIns, ...variants];
const SEEDS = [1, 2, 3];
const ROUNDS = [5, 11]; // 0-based: the start of rounds 6 and 12
const SPAN = 28;

const roundOf = (id, n) => ({ groups: [{ enemy: id, count: n, interval: Math.max(0.2, SPAN / n), delay: 0, spawn: 'all' }] });

function breakingCount(snaps, index, id) {
  const fails = (n) => consistently(snaps.filter((s) => playRound(s, index, roundOf(id, n)) === 'fell').length, snaps.length);
  let lo = 0, hi = 1;
  while (!fails(hi)) { lo = hi; hi *= 2; if (hi > 4096) return Infinity; }
  while (hi - lo > Math.max(1, lo * 0.04)) { const mid = Math.round((lo + hi) / 2); if (fails(mid)) hi = mid; else lo = mid; }
  return hi;
}

const t0 = Date.now();
const games = SEEDS.map((seed) => snapshotRounds({ enemyTypes: types }, seed));
const breaks = {}; // id → [N at round 6, N at round 12]
for (const index of ROUNDS) {
  const snaps = games.map((g) => g.snaps[index]).filter(Boolean);
  for (const t of measured) {
    (breaks[t.id] ??= []).push(breakingCount(snaps, index, t.id));
    console.log(`round ${index + 1}  ${t.id.padEnd(16)} breaks at ${breaks[t.id].at(-1)}  (${Math.round((Date.now() - t0) / 1000)} s)`);
  }
}
// worth = how many goblins one stands for (geometric mean over the two moments)
const worth = Object.fromEntries(measured.map((t) => [t.id, Math.sqrt(breaks[t.id].reduce((a, n, i) => a * (breaks.goblin[i] / n), 1))]));

// fit: minimise the mean squared log error of DSP/10 against the measured worth
const error = (k) => measured.reduce((a, t) => a + Math.log(monsterDsp(t, types, k).dsp / 10 / worth[t.id]) ** 2, 0) / measured.length;
const GRID = {
  TOUGH_EXP: [0.4, 1.0, 0.05], SPEED_EXP: [0, 0.6, 0.05], ATTACK: [0, 0.6, 0.05], RANGED: [0, 0.8, 0.05],
  FLYING: [1, 1.8, 0.05], MINION: [0.1, 1.2, 0.05], AREA: [0, 0.01, 0.0005],
};
let k = { ...DSP_K };
for (let pass = 0; pass < 6; pass++) {
  for (const [key, [lo, hi, step]] of Object.entries(GRID)) {
    let best = k[key], be = error(k);
    for (let v = lo; v <= hi + 1e-9; v += step) {
      const e = error({ ...k, [key]: +v.toFixed(4) });
      if (e < be) { be = e; best = +v.toFixed(4); }
    }
    k = { ...k, [key]: best };
  }
}
console.log('\nmonster           worth  DSP/10  error');
for (const t of measured) {
  const p = monsterDsp(t, types, k).dsp / 10;
  console.log(`${t.id.padEnd(16)} ${worth[t.id].toFixed(2).padStart(6)} ${p.toFixed(2).padStart(7)}  ${((p / worth[t.id] - 1) * 100).toFixed(0).padStart(4)} %`);
}
console.log(`\nfitted constants (mean log error ${Math.sqrt(error(k)).toFixed(3)}; the guessed ones had ${Math.sqrt(error(DSP_K)).toFixed(3)}):`);
console.log(Object.fromEntries(Object.keys(GRID).map((key) => [key, k[key]])));
