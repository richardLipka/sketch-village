// npm run wave-limits – the wave strength table (SPEC §10b, §16.5): every round
// of the built-in plan (or of a generated one, --generated) on the robot's test
// map – its monsters, its DSP, how much stronger than the round before, and the
// robot's limit: how much stronger the wave may get before the robot is
// consistently defeated (2 of 3 games). In the game the same test runs for any
// map: wave editor → 🧪 Find the limits.
//
//   node scripts/wave-limits.mjs [--generated] [--rounds 1,5,10]

import { findWaveLimits } from '../src/logic/waveLimit.js';
import { generateWaves } from '../src/logic/waveGen.js';
import { dspTable, wavesDsp } from '../src/logic/dsp.js';
import { roundSummary } from '../src/logic/waves.js';
import { defaultWaves } from '../src/config/waves.js';
import { DEFAULT_ENEMY_TYPES } from '../src/config/enemies.js';
import { DEFAULT_ENEMY_STATS } from '../src/config/components.js';

const args = process.argv.slice(2);
const at = (flag) => (args.includes(flag) ? args[args.indexOf(flag) + 1] : null);
const enemyTypes = DEFAULT_ENEMY_TYPES.map((t) => ({ ...DEFAULT_ENEMY_STATS, ...t }));
const waves = args.includes('--generated')
  ? generateWaves({ enemies: enemyTypes.map((t) => t.id) }, enemyTypes)
  : defaultWaves();
const rounds = at('--rounds')?.split(',').map((n) => +n - 1);
const t0 = Date.now();
const limits = findWaveLimits({ enemyTypes, waves }, { rounds, onProgress: (d, n) => process.stderr.write(`\r${d}/${n} rounds, ${Math.round((Date.now() - t0) / 1000)} s`) });
process.stderr.write('\n');

const table = dspTable(enemyTypes);
const strength = wavesDsp(waves, table);
const pct = (v) => (v === null ? '' : `${v >= 0 ? '+' : ''}${Math.round(v * 100)} %`);
console.log('| R | Monsters | DSP | vs previous | Robot falls at | Status |\n|---|---|---|---|---|---|');
for (const l of limits.rounds) {
  const s = strength[l.round - 1];
  const monsters = Object.entries(roundSummary(waves.rounds[l.round - 1])).map(([id, n]) => `${n} ${id}`).join(', ');
  const falls = l.limit === null ? (l.status === 'strong' ? '> ×8' : '–') : `×${l.limit} (${Math.round(l.limitDsp)})`;
  console.log(`| ${l.round} | ${monsters} | ${Math.round(s.dsp)} | ${pct(s.change)} | ${falls} | ${l.status} |`);
}
