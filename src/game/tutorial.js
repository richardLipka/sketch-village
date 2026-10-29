// First-game tips (SPEC §12): a short sequence of hints. Each step is finished
// by a World event (or the player's action); then the next tip shows. Pure –
// GameView keeps the current step index and stores it in settings.

export const TUTORIAL_STEPS = [
  { id: 'walk', done: (e) => e.type === 'heroMoved' },
  { id: 'build', done: (e) => e.type === 'buildStart' },
  { id: 'ready', done: (e) => e.type === 'waveStart' },
  { id: 'fight', done: (e) => e.type === 'enemyDied' },
  { id: 'coins', done: (e) => e.type === 'coinPicked' },
  { id: 'townhall', done: (e) => e.type === 'selectTownHall' || (e.type === 'upgradeStart' && e.townHall) || e.type === 'heroUpgraded' },
  { id: 'bow', done: (e) => e.type === 'modeRanged' || e.type === 'roundEnd' },
];

export const TUTORIAL_DONE = TUTORIAL_STEPS.length;

/** Next step index after an event (unchanged when the event doesn't finish the step). */
export function advanceTutorial(step, e) {
  if (step >= TUTORIAL_DONE) return step;
  return TUTORIAL_STEPS[step].done(e) ? step + 1 : step;
}
