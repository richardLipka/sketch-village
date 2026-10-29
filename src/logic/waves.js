// Wave config engine: turn a round's groups into a spawn timeline. Pure.

/**
 * @param {{groups: {enemy:string,count:number,interval?:number,delay?:number,spawn?:string}[]}} round
 * @param {string[]} caveIds
 * @returns {{t:number, enemy:string, cave:string}[]} sorted by time
 */
export function expandRound(round, caveIds) {
  const out = [];
  if (!caveIds.length) return out;
  round.groups.forEach((g, gi) => {
    const count = Math.max(0, Math.floor(g.count ?? 0));
    const fixed = g.spawn && g.spawn !== 'all' && caveIds.includes(g.spawn) ? g.spawn : null;
    for (let k = 0; k < count; k++) {
      out.push({
        t: (g.delay ?? 0) + k * (g.interval ?? 1),
        enemy: g.enemy,
        // round-robin over caves; each group starts at a different cave
        cave: fixed ?? caveIds[(k + gi) % caveIds.length],
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
