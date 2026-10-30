// Difficulty levels (SPEC §11a): one choice before a game scales the monsters,
// (and on easy their hits and the hero's lives), so the same map suits a 7-year-old and an 11-year-old. Kids' numbers in the
// studio stay as they are; the World multiplies them.

export const DIFFICULTIES = {
  easy: { icon: '🐣', enemyHp: 0.7, enemySpeed: 0.85, enemyDamage: 0.7, startCoins: 1.25, extraLives: 2 },
  normal: { icon: '⚔️', enemyHp: 1, enemySpeed: 1, enemyDamage: 1, startCoins: 1, extraLives: 0 },
  hard: { icon: '🔥', enemyHp: 1.3, enemySpeed: 1.12, enemyDamage: 1, startCoins: 0.85, extraLives: 0 },
};
export const DIFFICULTY_IDS = Object.keys(DIFFICULTIES);
export const DEFAULT_DIFFICULTY = 'normal';

export const difficultyOf = (id) => DIFFICULTIES[id] ?? DIFFICULTIES[DEFAULT_DIFFICULTY];
