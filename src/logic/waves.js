// Wave config engine: turn a round's groups into a spawn timeline. Pure.
//
// How strong a group's monsters are (SPEC §10): a group may have its own
// `attack` and `hp` in % of the monster's own numbers (200 = twice), and the
// plan its `growth` in % per round – round 1 as it is, round 2 +growth %, round
// 3 +2×growth %… All are percent of the same base, so they add up: a goblin
// group with hp 200 in round 20 of a plan growing 10 % has 200 + 190 = 390 %.

export const BOOST_LIMITS = { group: [10, 1000], growth: [0, 50] }; // % a kid may type

/** A number for the eye: at most one decimal place ("1.5", "2", "12.3"). */
export const oneDecimal = (v) => String(Math.round((Number(v) || 0) * 10) / 10);

/**
 * How much stronger a group's monsters are in round `ri` (0-based) of a plan
 * growing `growth` % per round: { hp, attack } as multipliers (1 = as drawn),
 * each at least 0.1.
 */
export function groupBoost(g, ri = 0, growth = 0) {
  const step = (Number(growth) || 0) * ri;
  // the % rounded to one decimal place, as a multiplier
  const k = (own) => Math.max(0.1, Math.round(((own == null || !Number.isFinite(+own) ? 100 : +own) + step) * 10) / 1000);
  return { hp: k(g?.hp), attack: k(g?.attack) };
}

/**
 * @param {{groups: {enemy:string,count:number,interval?:number,delay?:number,spawn?:string,hp?:number,attack?:number}[]}} round
 * @param {string[]} caveIds
 * @param {{index?:number, growth?:number}} [o]  the round's 0-based number and the plan's growth (% per round)
 * @returns {{t:number, enemy:string, cave:string, hp?:number, attack?:number}[]} sorted by time;
 *   hp / attack = multipliers, only when not 1
 */
export function expandRound(round, caveIds, { index = 0, growth = 0 } = {}) {
  const out = [];
  if (!caveIds.length) return out;
  round.groups.forEach((g, gi) => {
    const count = Math.max(0, Math.floor(g.count ?? 0));
    const fixed = g.spawn && g.spawn !== 'all' && caveIds.includes(g.spawn) ? g.spawn : null;
    const boost = groupBoost(g, index, growth);
    for (let k = 0; k < count; k++) {
      out.push({
        t: (g.delay ?? 0) + k * (g.interval ?? 1),
        enemy: g.enemy,
        // round-robin over caves; each group starts at a different cave
        cave: fixed ?? caveIds[(k + gi) % caveIds.length],
        ...(boost.hp !== 1 ? { hp: boost.hp } : {}),
        ...(boost.attack !== 1 ? { attack: boost.attack } : {}),
      });
    }
  });
  return out.sort((a, b) => a.t - b.t);
}

/** { enemyId: count } for the next-wave preview. */
export function roundSummary(round) {
  const s = {};
  for (const g of round.groups) s[g.enemy] = (s[g.enemy] ?? 0) + (g.count ?? 0);
  return s;
}

/** 1-based numbers of the caves a round's enemies come out of (for the preview). */
export function roundCaves(round, caveIds) {
  const used = new Set(expandRound(round, caveIds).map((s) => caveIds.indexOf(s.cave) + 1));
  return [...used].sort((a, b) => a - b);
}

export function roundDuration(round) {
  return Math.max(0, ...round.groups.map((g) => (g.delay ?? 0) + Math.max(0, (g.count ?? 0) - 1) * (g.interval ?? 1)));
}

export const roundReward = (balance, roundIndex) => balance.rewardBase + roundIndex + 1;
export const hpScale = (balance, roundIndex) => 1 + balance.hpScalePerRound * roundIndex;
