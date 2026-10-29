// Weapons (SPEC §6.3). Three classes, each with its own effect:
//   melee  – sword-like, hits one enemy next to the hero, can't reach flying ones
//   ranged – bow-like, shoots an arrow at one enemy
//   magic  – shoots a spell that hurts every enemy around the target (splash)
// An equipped weapon ADDS its numbers to the hero's attack of that class
// (cooldown is added in seconds, negative = faster). Weapons drop from enemies
// in chests (weight `drop`, 0 = never) or are bought in the Town Hall shop
// (`price`, `shop`, from round `round`). Kids edit them in the weapon editor;
// the edited list is stored in the `weapons` collection.

export const WEAPON_CLASSES = ['melee', 'ranged', 'magic'];

export const DEFAULT_WEAPONS = [
  { id: 'sword', name: { cs: 'Meč', en: 'Sword' }, kind: 'melee', damage: 6, range: 0, cooldown: 0, splash: 0, price: 25, shop: true, round: 1, drop: 3 },
  { id: 'axe', name: { cs: 'Sekera', en: 'Axe' }, kind: 'melee', damage: 14, range: 5, cooldown: 0.25, splash: 0, price: 60, shop: true, round: 6, drop: 2 },
  { id: 'longbow', name: { cs: 'Dlouhý luk', en: 'Long bow' }, kind: 'ranged', damage: 2, range: 60, cooldown: 0, splash: 0, price: 30, shop: true, round: 3, drop: 3 },
  { id: 'crossbow', name: { cs: 'Kuše', en: 'Crossbow' }, kind: 'ranged', damage: 8, range: 20, cooldown: 0.3, splash: 0, price: 55, shop: true, round: 8, drop: 2 },
  { id: 'wand', name: { cs: 'Kouzelná hůlka', en: 'Magic wand' }, kind: 'magic', damage: 0, range: 0, cooldown: 0, splash: 50, price: 45, shop: true, round: 5, drop: 2 },
  { id: 'firestaff', name: { cs: 'Ohnivá hůl', en: 'Fire staff' }, kind: 'magic', damage: 8, range: 20, cooldown: -0.2, splash: 75, price: 90, shop: true, round: 12, drop: 1 },
];

/** The effective weapon list: the kids' edited one, or the defaults. */
export function weaponsOf(db) {
  return db.weapons?.length ? db.weapons : DEFAULT_WEAPONS;
}

/** Attack numbers of one class with a weapon added (weapon may be null). */
export function withWeapon(base, weapon) {
  if (!weapon) return { ...base, splash: base.splash ?? 0 };
  return {
    damage: Math.max(1, base.damage + (weapon.damage ?? 0)),
    range: Math.max(20, base.range + (weapon.range ?? 0)),
    cooldown: Math.max(0.3, +(base.cooldown + (weapon.cooldown ?? 0)).toFixed(2)),
    splash: weapon.kind === 'magic' ? Math.max(0, weapon.splash ?? 0) : 0,
  };
}
