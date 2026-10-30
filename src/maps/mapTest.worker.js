// Plays the trial games of maps/mapTest.js off the main thread.
import { playGame } from '../logic/balanceBot.js';
import { trialOf } from './mapTest.js';

self.onmessage = ({ data }) => {
  const { seeds, ...setup } = data;
  try {
    const trials = [];
    for (const seed of seeds) {
      trials.push(trialOf(playGame({ ...setup, seed })));
      self.postMessage({ type: 'progress', done: trials.length, total: seeds.length });
    }
    self.postMessage({ type: 'done', trials });
  } catch (e) {
    self.postMessage({ type: 'error', message: String(e?.message ?? e) });
  }
};
