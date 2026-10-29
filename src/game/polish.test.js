import { describe, it, expect } from 'vitest';
import { advanceTutorial, TUTORIAL_DONE, TUTORIAL_STEPS } from './tutorial.js';
import { soundFor } from './sound.js';

describe('tutorial', () => {
  it('advances only on the event that finishes the current tip', () => {
    let s = 0;
    s = advanceTutorial(s, { type: 'buildStart' });
    expect(s).toBe(0); // building before walking doesn't skip the walk tip
    const events = [
      { type: 'heroMoved' }, { type: 'buildStart' }, { type: 'waveStart' }, { type: 'enemyDied' },
      { type: 'coinPicked' }, { type: 'upgradeStart', townHall: true }, { type: 'modeRanged' },
    ];
    for (const [i, e] of events.entries()) {
      s = advanceTutorial(s, e);
      expect(s).toBe(i + 1);
    }
    expect(s).toBe(TUTORIAL_DONE);
    expect(advanceTutorial(s, { type: 'heroMoved' })).toBe(TUTORIAL_DONE);
  });

  it('every tip has text in both languages', async () => {
    const cs = (await import('../locales/cs.json')).default;
    const en = (await import('../locales/en.json')).default;
    for (const st of TUTORIAL_STEPS) {
      expect(cs.tips[st.id]).toBeTruthy();
      expect(en.tips[st.id]).toBeTruthy();
    }
  });
});

describe('sounds', () => {
  it('maps game events to sounds', () => {
    expect(soundFor({ type: 'heroAttack', mode: 'ranged' })).toBe('shoot');
    expect(soundFor({ type: 'heroAttack', mode: 'melee' })).toBe('hit');
    expect(soundFor({ type: 'hit', kind: 'enemy' })).toBe('enemyHit');
    expect(soundFor({ type: 'hit', kind: 'building' })).toBeNull();
    expect(soundFor({ type: 'coinPicked' })).toBe('coin');
    expect(soundFor({ type: 'won' })).toBe('won');
    expect(soundFor({ type: 'spawn' })).toBeNull();
  });
});
