// Waves made from DSP (SPEC §10b, logic/dsp.js). Pure, unit-tested.
//
//   generateWaves(options, types)        a whole plan from the monsters a kid picks:
//                                        round 1 worth `first` DSP, every next one
//                                        `growth` stronger; new kinds come in one by one
//   scaleWaves(waves, factor, types)     every round of a map ×factor (1.1 = 10 % stronger):
//                                        monsters of the kinds already in it are added
//                                        or removed, each group keeping its timing span
//   fitGroups(groups, target, table)     the groups changed to be worth `target` DSP

import { dspTable, groupsDsp } from './dsp.js';
import { hpScale } from './waves.js';
import { BALANCE } from '../config/balance.js';

export const WAVE_SPAN = 28; // s over which a generated round's monsters come out (a wave then lasts ~40–60 s)
export const GEN_DEFAULTS = { rounds: 20, first: 80, growth: 0.16 }; // ≈ the built-in plan: 80 DSP → ~1350 DSP in round 20
const MIN_INTERVAL = 0.4, MAX_INTERVAL = 12, NEW_INTERVAL = 2.4;
const MAX_SHARE = 0.6; // one monster may be at most this share of a generated round
const MIN_SHARE = 0.015; // a kind mixed in should be worth at least this share of the round
const CROWD_SHARE = 0.06; // …and one of them a crowd: at most this share each
const round2 = (v) => Math.round(v * 100) / 100;

/** The group with a new count; the time from its first to its last monster stays the same. */
function recount(g, count) {
  if (count === g.count) return g;
  const old = Math.max(1, g.count ?? 1);
  const span = (old - 1) * (g.interval ?? NEW_INTERVAL);
  const interval = count > 1 ? (span > 0 ? span / (count - 1) : g.interval > 0 && old > 1 ? g.interval : NEW_INTERVAL) : g.interval ?? NEW_INTERVAL;
  return { ...g, count, interval: round2(Math.min(MAX_INTERVAL, Math.max(MIN_INTERVAL, interval))) };
}

/**
 * The groups changed so that they are worth about `target` DSP (without the
 * round's health growth): every count scaled and rounded to whole monsters –
 * each kind keeps at least one unless the round shrinks below half (5 % weaker
 * doesn't take the roc away) – then what is still missing or too much is
 * added or taken by the kind whose whole number of monsters fits it most
 * exactly (five goblins rather than a second spider queen). So the mix stays
 * the same and a big monster comes or goes only as a whole one. At least one monster stays.
 */
export function fitGroups(groups = [], target, table) {
  const dsp = (g) => table[g.enemy] ?? 0;
  const now = groupsDsp(groups, table);
  if (!(now > 0) || !(target >= 0)) return groups;
  const k = target / now;
  const least = groups.map((g) => (k >= 0.5 && (g.count ?? 0) > 0 && dsp(g) > 0 ? 1 : 0));
  const counts = groups.map((g, i) => (dsp(g) > 0 ? Math.max(least[i], Math.round(Math.max(0, g.count ?? 0) * k)) : g.count ?? 0));
  let gap = target - groups.reduce((a, g, i) => a + counts[i] * dsp(g), 0);
  for (let pass = 0; pass < 2 * groups.length && Math.abs(gap) > 1e-9; pass++) {
    let best = -1, bestN = 0, bestErr = Math.abs(gap);
    groups.forEach((g, i) => {
      const d = dsp(g);
      if (!(d > 0)) return;
      // add when something is missing, take away (not below its least) when there is too much
      const n = gap > 0 ? Math.round(gap / d) : -Math.min(Math.round(-gap / d), counts[i] - least[i]);
      const err = Math.abs(gap - n * d);
      // the most exact fit; on a tie the bigger kind (fewer monsters)
      if (n !== 0 && (err < bestErr - 1e-9 || (Math.abs(err - bestErr) < 1e-9 && best >= 0 && d > dsp(groups[best])))) { best = i; bestN = n; bestErr = err; }
    });
    if (best < 0) break;
    counts[best] += bestN;
    gap -= bestN * dsp(groups[best]);
  }
  if (!counts.some((c) => c > 0)) {
    const weakest = groups.reduce((b, g, i) => (dsp(g) > 0 && (b < 0 || dsp(g) < dsp(groups[b])) ? i : b), -1);
    if (weakest >= 0) counts[weakest] = 1;
  }
  return groups.map((g, i) => recount(g, counts[i])).filter((g) => g.count > 0);
}

/** One round ×factor: the same kinds, more or fewer of them. */
export function scaleRound(round, factor, table) {
  return { ...round, groups: fitGroups(round.groups, groupsDsp(round.groups, table) * factor, table) };
}

/** Every round of a plan ×factor (1.1 = 10 % stronger, 0.9 = 10 % weaker). */
export function scaleWaves(waves, factor, types) {
  const table = dspTable(types);
  return { ...waves, rounds: waves.rounds.map((r) => scaleRound(r, factor, table)) };
}

/** The DSP a generated round aims at (with that round's health growth). */
export const genTarget = (first, growth, roundIndex) => first * Math.pow(1 + growth, roundIndex);

/**
 * A whole wave plan from the chosen monsters. Each round is worth
 * first × (1 + growth)^(round − 1) DSP; a monster may take at most MAX_SHARE of
 * a round, so strong ones come only when the waves are big enough; every round
 * that can, brings one kind not seen yet (weakest first), mixed with up to two
 * known ones. The same choice gives the same plan.
 */
export function generateWaves({ enemies = [], rounds = GEN_DEFAULTS.rounds, first = GEN_DEFAULTS.first, growth = GEN_DEFAULTS.growth, base = {} } = {}, types = [], balance = BALANCE) {
  const table = dspTable(types);
  const pool = [...new Set(enemies)].filter((id) => table[id] > 0).sort((a, b) => table[a] - table[b] || a.localeCompare(b));
  if (!pool.length) return null;
  const n = Math.max(1, Math.min(60, Math.round(rounds)));
  const seen = [];
  const out = [];
  for (let r = 0; r < n; r++) {
    const target = genTarget(Math.max(1, first), Math.max(-0.5, growth), r) / hpScale(balance, r);
    const fits = pool.filter((id) => table[id] <= target * MAX_SHARE);
    const allowed = fits.length ? fits : [pool[0]];
    const fresh = allowed.find((id) => !seen.includes(id));
    if (fresh) seen.push(fresh);
    // the round's kinds: the new one (or the strongest allowed) and up to two known
    // ones taking turns – those that still matter in a wave this big (stronger first),
    // so a late wave isn't padded with dozens of the weakest
    const lead = fresh ?? allowed.at(-1);
    const known = allowed.filter((id) => id !== lead && seen.includes(id));
    const matter = known.filter((id) => table[id] >= target * MIN_SHARE).reverse();
    const mates = matter.length ? matter : known.slice(-1);
    // one of them is a crowd (a kind that comes in numbers), when there is one – a wave isn't only bosses
    const crowd = mates.filter((id) => table[id] <= target * CROWD_SHARE);
    const others = mates.length
      ? [crowd.length ? crowd[r % crowd.length] : mates[r % mates.length], mates[(r + 1 + (mates.length >> 1)) % mates.length]].filter((id, i, a) => a.indexOf(id) === i)
      : [];
    const kinds = [lead, ...others].slice(0, 3);
    // budget: the lead a bit more than the rest; at least one of each
    const share = kinds.map((_, i) => (i === 0 ? 0.45 : 0.55 / (kinds.length - 1)));
    const groups = kinds.map((id, i) => ({ enemy: id, count: Math.max(1, Math.round(target * (kinds.length === 1 ? 1 : share[i]) / table[id])), interval: NEW_INTERVAL, delay: 0, spawn: 'all' }));
    const fitted = fitGroups(groups, target, table).map((g, i) => {
      // spread each group over the wave's span; a lone big one comes early, the others one after another
      const interval = g.count > 1 ? round2(Math.min(MAX_INTERVAL, Math.max(MIN_INTERVAL, WAVE_SPAN / g.count))) : NEW_INTERVAL;
      return { ...g, interval, delay: g.count === 1 ? 0 : round2(i * 2) };
    });
    out.push({ groups: fitted });
  }
  return {
    startCoins: base.startCoins ?? balance.startCoins,
    firstPrep: base.firstPrep ?? balance.firstPrep,
    prep: base.prep ?? balance.prep,
    rounds: out,
  };
}
