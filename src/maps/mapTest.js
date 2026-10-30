// "Let the robot try" (SPEC §10a): the balance bot (logic/balanceBot.js) plays a
// kid's own map with its waves a few times, like a careful player, and the wave
// editor shows how it went – won or lost, how long each wave took, what broke.
// The games run in a Web Worker (mapTest.worker.js) so the editor stays usable.

export const TRIAL_SEEDS = [1, 2, 3];

/** Remove pictures (data URLs) – the simulation doesn't need them. */
export function lean(v) {
  if (typeof v === 'string') return v.startsWith('data:') ? null : v;
  if (Array.isArray(v)) return v.map(lean);
  if (v && typeof v === 'object' && !ArrayBuffer.isView(v)) return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, lean(x)]));
  return v;
}

/** What one bot game leaves for the report. */
export const trialOf = (g) => ({
  result: g.result, round: g.round,
  rounds: g.stats.map((s) => ({ round: s.round, length: s.waveLength, lost: s.destroyed, livesLost: s.livesLost, defeated: s.defeated })),
});

/**
 * Sum up the trial games: per round the average wave length and what was lost,
 * and a verdict for the kid: 'too_hard' (never won), 'hard' (won some),
 * 'easy' (won every time without losing anything), otherwise 'ok'.
 * A round is flagged 'short' (< 20 s), 'long' (> 90 s) or 'tough' (a building
 * or a life lost on average).
 */
export function summarizeTrials(trials, totalRounds) {
  const wins = trials.filter((g) => g.result === 'won').length;
  const rounds = [];
  for (let r = 1; r <= totalRounds; r++) {
    const played = trials.map((g) => g.rounds.find((x) => x.round === r)).filter(Boolean);
    if (!played.length) break;
    const avg = (f) => played.reduce((a, x) => a + f(x), 0) / played.length;
    const length = Math.round(avg((x) => x.length));
    const lost = avg((x) => x.lost), livesLost = avg((x) => x.livesLost);
    const flags = [];
    if (length < 20) flags.push('short');
    if (length > 90) flags.push('long');
    if (lost >= 1 || livesLost >= 1) flags.push('tough');
    rounds.push({ round: r, length, lost: Math.round(lost * 10) / 10, livesLost: Math.round(livesLost * 10) / 10, played: played.length, flags });
  }
  const totalLost = trials.reduce((n, g) => n + g.rounds.reduce((a, x) => a + x.lost + x.livesLost, 0), 0);
  const verdict = wins === 0 ? 'too_hard' : wins < trials.length ? 'hard' : totalLost === 0 ? 'easy' : 'ok';
  const lostAt = trials.filter((g) => g.result !== 'won').map((g) => g.round);
  return { games: trials.length, wins, verdict, lostAt, rounds };
}

/** Run the trials in a worker; onProgress(done, total). Resolves to the summary. */
export function runMapTest(job, onProgress) {
  const worker = new Worker(new URL('./mapTest.worker.js', import.meta.url), { type: 'module' });
  const promise = new Promise((resolve, reject) => {
    worker.onmessage = ({ data }) => {
      if (data.type === 'progress') onProgress?.(data.done, data.total);
      else if (data.type === 'done') { worker.terminate(); resolve(summarizeTrials(data.trials, job.waves.rounds.length)); }
      else if (data.type === 'error') { worker.terminate(); reject(new Error(data.message)); }
    };
    worker.onerror = (e) => { worker.terminate(); reject(new Error(e.message)); };
  });
  worker.postMessage(lean({ ...job, seeds: TRIAL_SEEDS }));
  return { promise, cancel: () => worker.terminate() };
}
