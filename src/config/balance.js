// Global game numbers (SPEC §16.1). Distances in px (1280×720 world), time in s.

export const BALANCE = {
  startCoins: 40,
  firstPrep: 45,
  prep: 20,
  rewardBase: 5, // round reward = rewardBase + round number (1-based)
  earlyBonusPerSecond: 0.5,
  hpScalePerRound: 0.04, // enemy HP × (1 + k × (round − 1))
  coinPickupRadius: 24,
  coinLifetime: 30,
  coinBlink: 5,
  heroLives: 5,
  heroRespawnDelay: 30,
  hitInvulnerability: 1.5,
  heroRadius: 14,
  townHallHp: [300, 450, 600],
  townHallRadius: 40,
  projectileSpeed: 450,
  enemyRadius: 16,
  bossRadius: 30,
};
