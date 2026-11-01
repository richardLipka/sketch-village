// Plays the robot's games of maps/mapTest.js off the main thread: the trial
// games ("Let the robot try") or the wave limit test ("Find the limits").
import { playGame } from '../logic/balanceBot.js';
import { findWaveLimits } from '../logic/waveLimit.js';
import { trialOf } from './mapTest.js';

self.onmessage = ({ data }) => {
  const { kind, seeds, ...setup } = data;
  const progress = (done, total) => self.postMessage({ type: 'progress', done, total });
  try {
    if (kind === 'limits') {
      self.postMessage({ type: 'done', result: findWaveLimits(setup, { ...(seeds ? { seeds } : {}), onProgress: progress }) });
      return;
    }
    const trials = [];
    for (const seed of seeds) {
      trials.push(trialOf(playGame({ ...setup, seed })));
      progress(trials.length, seeds.length);
    }
    self.postMessage({ type: 'done', result: trials });
  } catch (e) {
    self.postMessage({ type: 'error', message: String(e?.message ?? e) });
  }
};
