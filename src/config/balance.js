// Global game numbers (SPEC §16.1). Distances in px (1280×720 world), time in s.

export const BALANCE = {
  startCoins: 40,
  firstPrep: 45,
  prep: 20,
  rewardBase: 10, // round reward = rewardBase + round number (1-based)
  earlyBonusPerSecond: 0.5,
  hpScalePerRound: 0.05, // enemy HP × (1 + k × (round − 1))
  coinPickupRadius: 24,
  coinLifetime: 30,
  coinBlink: 5,
  heroLives: 5,
  heroRespawnDelay: 10, // s; the hero always comes back at the Town Hall
  weaponSwitchTime: 2, // s to change the weapon in hand (no attacks meanwhile)
  chestChance: 0.02, // chance an enemy drops a weapon chest (bosses always do)
  chestLifetime: 60, // s before an unpicked chest disappears
  chestCoins: 15, // what a chest gives when the hero already owns every weapon
  hitInvulnerability: 1.5,
  heroRadius: 14,
  townHallRadius: 40,
  projectileSpeed: 450,
  enemyRadius: 16,
  bossRadius: 30,
};
