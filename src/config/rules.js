// Game rules that kids/teachers can edit in the Rules editor (SPEC §16).
// Stored as one record { id: 'rules', ... } in the `rules` collection, so it is
// part of the exported JSON and merges like every other record. Missing fields
// fall back to the defaults below, so old save files keep working.

import { BALANCE } from './balance.js';
import { BUILD, TOWN_HALL_LEVELS, HERO_UPGRADE_COSTS } from './buildings.js';
import { HERO_RULES } from './heroStats.js';
import { DEFAULT_UNLOCKS } from './unlocks.js';

export const RULES_ID = 'rules';

export const DEFAULT_RULES = {
  id: RULES_ID,
  balance: { ...BALANCE },
  build: { ...BUILD, soldier: { ...BUILD.soldier } },
  townHallLevels: TOWN_HALL_LEVELS.map((l) => ({ ...l })),
  heroUpgradeCosts: [...HERO_UPGRADE_COSTS],
  hero: { ...HERO_RULES },
  unlocks: DEFAULT_UNLOCKS.map((u) => ({ ...u })),
};

/** Defaults overlaid with whatever a stored record defines. */
export function mergeRules(rec) {
  const d = DEFAULT_RULES;
  if (!rec) return d;
  return {
    id: RULES_ID,
    updatedAt: rec.updatedAt,
    balance: { ...d.balance, ...rec.balance },
    build: { ...d.build, ...rec.build, soldier: { ...d.build.soldier, ...rec.build?.soldier } },
    townHallLevels: rec.townHallLevels?.length ? rec.townHallLevels : d.townHallLevels,
    heroUpgradeCosts: rec.heroUpgradeCosts?.length ? rec.heroUpgradeCosts : d.heroUpgradeCosts,
    hero: { ...d.hero, ...rec.hero },
    unlocks: Array.isArray(rec.unlocks) ? rec.unlocks : d.unlocks,
  };
}

export function rulesOf(db) {
  return mergeRules(db.rules?.find((r) => r.id === RULES_ID));
}
