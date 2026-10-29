// Progression: from which round each thing can be bought, so something new
// appears after every wave. Keys:
//   '<building>:<level>'  e.g. 'tower:2'   – build (level 1) or upgrade to that level
//   'townhall:<level>'                     – Town Hall upgrade to that level
//   'hero:<stat>:<level>'                  – hero upgrade bought at the Town Hall
// Anything not listed is available from round 1. The Town Hall level and coins
// still limit purchases as before. Editable in the Rules editor (rules.unlocks).

export const DEFAULT_UNLOCKS = [
  { key: 'house:1', round: 1 },
  { key: 'tower:1', round: 1 },
  { key: 'castle:1', round: 2 },
  { key: 'townhall:2', round: 3 },
  { key: 'hero:ranged:1', round: 4 },
  { key: 'tower:2', round: 5 },
  { key: 'hero:melee:1', round: 6 },
  { key: 'house:2', round: 7 },
  { key: 'hero:armor:1', round: 8 },
  { key: 'castle:2', round: 9 },
  { key: 'hero:speed:1', round: 10 },
  { key: 'townhall:3', round: 11 },
  { key: 'tower:3', round: 12 },
  { key: 'hero:ranged:2', round: 13 },
  { key: 'house:3', round: 14 },
  { key: 'hero:melee:2', round: 15 },
  { key: 'castle:3', round: 16 },
  { key: 'hero:armor:2', round: 17 },
  { key: 'hero:speed:2', round: 18 },
  { key: 'hero:ranged:3', round: 19 },
  { key: 'hero:melee:3', round: 19 },
  { key: 'hero:armor:3', round: 20 },
  { key: 'hero:speed:3', round: 20 },
];

/** Translated name of an unlock key, e.g. "Tower level 2" / "Hero: bow +2". */
export function unlockLabel(key, t) {
  const [a, b, c] = key.split(':');
  if (a === 'hero') return t('unlock.hero', { stat: t(`hero.stat_${b}`), n: c });
  if (a === 'townhall') return t('unlock.townhall', { n: b });
  return b === '1' ? t(`build.type_${a}`) : t('unlock.level', { name: t(`build.type_${a}`), n: b });
}
