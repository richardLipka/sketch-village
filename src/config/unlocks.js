// Progression: something new is available after every wave. Buildings carry the
// round on each of their levels (component editor); hero upgrades bought at the
// Town Hall are scheduled here (Rules editor). Keys:
//   '<buildingTypeId>:<level>'  e.g. 'tower:2' – build (level 1) or upgrade to it
//   'hero:<stat>:<level>'                      – hero upgrade
// The core building (Town Hall) uses its own id, e.g. 'townhall:2'.

export const DEFAULT_UNLOCKS = [
  { key: 'hero:ranged:1', round: 4 },
  { key: 'hero:melee:1', round: 6 },
  { key: 'hero:armor:1', round: 8 },
  { key: 'hero:speed:1', round: 10 },
  { key: 'hero:ranged:2', round: 13 },
  { key: 'hero:melee:2', round: 15 },
  { key: 'hero:armor:2', round: 17 },
  { key: 'hero:speed:2', round: 18 },
  { key: 'hero:ranged:3', round: 19 },
  { key: 'hero:melee:3', round: 19 },
  { key: 'hero:armor:3', round: 20 },
  { key: 'hero:speed:3', round: 20 },
];

/**
 * Translated name of an unlock key, e.g. "Tower level 2" / "Hero: bow +2".
 * `nameOf(typeId)` gives a building type's name in the current language.
 */
export function unlockLabel(key, t, nameOf = (id) => id) {
  const [a, b, c] = key.split(':');
  if (a === 'hero') return t('unlock.hero', { stat: t(`hero.stat_${b}`), n: c });
  return b === '1' ? nameOf(a) : t('unlock.level', { name: nameOf(a), n: b });
}
