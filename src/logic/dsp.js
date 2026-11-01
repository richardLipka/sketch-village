// DSP – danger strength points (SPEC §10b): one number saying how hard a
// monster is to stop, so waves can be compared, generated and made stronger or
// weaker. A goblin is worth 10. Pure, unit-tested.
//
//   own DSP   = 10 × toughness^TOUGH_EXP × pace × attack × ranged × area × flying
//     toughness = health / (1 − armor) ÷ 25          how much damage it takes to stop
//     pace      = (speed ÷ 45) ^ SPEED_EXP            less time under fire when fast
//     attack    = (1 − W) + W × (damage ÷ cooldown) ÷ 4   what it breaks if it gets through
//     ranged    = 1 + RANGED × min(2, range ÷ 150)    hits buildings from out of sword reach
//     area      = 1 + min(AREA_MAX, AREA × splash px) hits several things at once
//     flying    = FLYING                               no roads, swords and catapults can't reach it
//   + minions = MINION × (the minions it calls in a lifetime) × their DSP
//     lifetime = PATH ÷ speed (10–45 s), shorter for a fragile one (× √(toughness ÷ 4)
//     below 100 health – it is shot before it calls many); calls = count × lifetime ÷ every
//     (at most MINION_CAP × the most alive at once) + those it lets out when it dies
//   wave DSP  = Σ count × DSP × the round's health growth (balance.hpScalePerRound)
//
// The constants were measured with the balance robot (npm run calibrate-dsp): how
// many of each built-in monster – and of a goblin made ranged, flying,
// area-hitting, faster, tougher, more harmful or summoning – consistently break
// the robot's defence at rounds 6 and 12, fitted so DSP ÷ 10 = what one is worth
// in goblins.

import { hpScale } from './waves.js';
import { BALANCE } from '../config/balance.js';

export const DSP_REF = { hp: 25, speed: 45, dps: 4, points: 10 }; // a goblin
// measured with the robot (scripts/calibrate-dsp.mjs): the DSP of every built-in
// monster and of the goblin variants is within ±11 % of what it is worth (5 % on average)
export const DSP_K = {
  TOUGH_EXP: 0.7, // 4× the health is worth 2.6×: a tough one still hits only as hard
  SPEED_EXP: 0.1, // twice as fast is worth only 7 % more: speed decides little once the defence is full
  ATTACK: 0.2, // W – the share of the danger that is the monster's own attack
  RANGED: 0.4, // shooting from 150 px is worth 1.4×
  AREA: 0.0035, // per px of splash radius: 80 px is worth 1.28×
  AREA_MAX: 0.6,
  FLYING: 1.3,
  MINION: 1, // every minion called counts fully
  PATH: 800, // px – a typical way from a cave to the village
  MINION_CAP: 1.5,
};

const num = (v, d = 0) => (Number.isFinite(+v) ? +v : d);

/** The parts of a monster's own DSP (without minions) – for the editor's explanation. */
export function dspParts(t, k = DSP_K) {
  const armor = Math.min(0.9, Math.max(0, num(t.armor)));
  const toughness = Math.max(1, num(t.hp, 1)) / (1 - armor) / DSP_REF.hp;
  const pace = Math.pow(Math.max(1, num(t.speed, DSP_REF.speed)) / DSP_REF.speed, k.SPEED_EXP);
  const dps = Math.max(0, num(t.damage)) / Math.max(0.1, num(t.cooldown, 1));
  const attack = (1 - k.ATTACK) + k.ATTACK * dps / DSP_REF.dps;
  const ranged = t.ranged ? 1 + k.RANGED * Math.min(2, Math.max(0, num(t.range, 150)) / 150) : 1;
  const area = 1 + Math.min(k.AREA_MAX, k.AREA * Math.max(0, num(t.splash)));
  const flying = t.flying ? k.FLYING : 1;
  const own = DSP_REF.points * Math.pow(toughness, k.TOUGH_EXP) * pace * attack * ranged * area * flying;
  return { toughness, pace, dps, attack, ranged, area, flying, own };
}

/** How many minions a summoner calls in its life (0 for others). */
export function minionCalls(t, k = DSP_K) {
  if (!t.minions?.length || t.summons === false) return 0;
  const armor = Math.min(0.9, Math.max(0, num(t.armor)));
  const toughness = Math.max(1, num(t.hp, 1)) / (1 - armor) / DSP_REF.hp;
  const life = Math.min(45, Math.max(10, k.PATH / Math.max(1, num(t.speed, DSP_REF.speed)))) * Math.min(1, Math.sqrt(toughness / 4));
  const calls = num(t.minionEvery) > 0 ? Math.max(0, num(t.minionCount, 1)) * life / num(t.minionEvery) : 0;
  return Math.min(calls, Math.max(0, num(t.minionMax, 6)) * k.MINION_CAP) + Math.max(0, num(t.minionOnDeath));
}

/**
 * A monster's DSP: its own and, for a summoner, MINION × what its minions are
 * worth. `types` = every enemy type (to look the minions up; minions never call).
 * Returns { dsp, own, minions, calls, parts }.
 */
export function monsterDsp(t, types = [], k = DSP_K) {
  const parts = dspParts(t, k);
  const calls = minionCalls(t, k);
  const kinds = calls ? t.minions.map((id) => types.find((x) => x.id === id)).filter((m) => m && m.id !== t.id) : [];
  const each = kinds.length ? kinds.reduce((a, m) => a + dspParts(m, k).own, 0) / kinds.length : 0;
  const minions = kinds.length ? k.MINION * calls * each : 0;
  return { dsp: parts.own + minions, own: parts.own, minions, calls: kinds.length ? calls : 0, parts };
}

/** { enemyId: DSP } for every type – what the wave functions look up. */
export function dspTable(types = [], k = DSP_K) {
  return Object.fromEntries(types.map((t) => [t.id, monsterDsp(t, types, k).dsp]));
}

/** A round's DSP without the round's health growth: Σ count × DSP (unknown monsters count 0). */
export function groupsDsp(groups = [], table) {
  return groups.reduce((a, g) => a + Math.max(0, num(g.count)) * (table[g.enemy] ?? 0), 0);
}

/** A round's DSP: its monsters, with the health they have in that round (0-based index). */
export function roundDsp(round, roundIndex, table, balance = BALANCE) {
  return groupsDsp(round?.groups, table) * hpScale(balance, roundIndex);
}

/**
 * Every round of a wave plan: { round, dsp, change } – change = how much
 * stronger than the round before (0.12 = +12 %; null for the first).
 */
export function wavesDsp(waves, table, balance = BALANCE) {
  let prev = null;
  return (waves?.rounds ?? []).map((r, i) => {
    const dsp = roundDsp(r, i, table, balance);
    const change = prev ? dsp / prev - 1 : null;
    prev = dsp || prev;
    return { round: i + 1, dsp, change };
  });
}

/** DSP for the eye: whole points. */
export const showDsp = (v) => Math.round(v);
