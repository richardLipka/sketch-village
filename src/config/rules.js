// Global game rules edited in the Rules screen – only what does not belong to one
// component: economy and timing, the hero's point system and upgrade prices,
// soldier movement, building repair, selling. Everything that belongs to a
// building, enemy, weapon or coin lives on that component (config/components.js).
// Stored as one record { id: 'rules', ... } in the `rules` collection, so it is
// part of the exported JSON; missing fields fall back to the defaults below.

import { BALANCE } from './balance.js';
import { BUILD, HERO_UPGRADE_COSTS } from './buildings.js';
import { HERO_RULES } from './heroStats.js';
import { DEFAULT_UNLOCKS } from './unlocks.js';

export const RULES_ID = 'rules';

export const DEFAULT_RULES = {
  id: RULES_ID,
  balance: { ...BALANCE },
  build: { ...BUILD, soldier: { ...BUILD.soldier } },
  heroUpgradeCosts: [...HERO_UPGRADE_COSTS],
  hero: { ...HERO_RULES },
  unlocks: DEFAULT_UNLOCKS.map((u) => ({ ...u })), // hero upgrades only; buildings have rounds per level
};

const isHeroUnlock = (u) => u.key?.startsWith('hero:');

/** Defaults overlaid with whatever a stored record defines. */
export function mergeRules(rec) {
  const d = DEFAULT_RULES;
  if (!rec) return d;
  return {
    id: RULES_ID,
    updatedAt: rec.updatedAt,
    balance: { ...d.balance, ...rec.balance },
    build: { ...d.build, ...rec.build, soldier: { ...d.build.soldier, ...rec.build?.soldier } },
    heroUpgradeCosts: rec.heroUpgradeCosts?.length ? rec.heroUpgradeCosts : d.heroUpgradeCosts,
    hero: { ...d.hero, ...rec.hero },
    unlocks: Array.isArray(rec.unlocks) ? rec.unlocks.filter(isHeroUnlock) : d.unlocks,
  };
}

export function rulesOf(db) {
  return mergeRules(db.rules?.find((r) => r.id === RULES_ID));
}
