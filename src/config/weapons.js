// Equipment (SPEC §6.3): weapons, shields and armor the hero carries in the
// backpack. Each item goes into one slot:
//   hand    – one-handed weapon, right hand (the left hand stays free for a shield)
//   twohand – two-handed weapon, takes both hands (no shield)
//   shield  – left hand, adds armor
//   armor   – body, adds armor
// Weapons have a class with its own effect:
//   melee  – hits one enemy next to the hero, can't reach flying ones
//   ranged – shoots an arrow at one enemy
//   magic  – a spell that hurts every enemy around the target (splash), flying too
// The weapon in the right hand decides the hero's attack; its numbers are ADDED
// to the hero's attack of that class (cooldown in seconds, negative = faster).
// `armor` (0..1) of shields and armor is added to the hero's armor.
// Items drop from enemies in chests (weight `drop`, 0 = never) or are bought in
// the Town Hall shop (`price`, `shop`, from round `round`). `starter` items are
// in the backpack at the start. Stored in the `weapons` collection.

export const WEAPON_CLASSES = ['melee', 'ranged', 'magic'];
export const SLOTS = ['hand', 'twohand', 'shield', 'armor'];

export const DEFAULT_WEAPONS = [
  { id: 'stick', name: { cs: 'Dřevěný meč', en: 'Wooden sword' }, slot: 'hand', kind: 'melee', damage: 0, range: 0, cooldown: 0, splash: 0, armor: 0, price: 0, shop: false, round: 1, drop: 0, starter: true },
  { id: 'shortbow', name: { cs: 'Krátký luk', en: 'Short bow' }, slot: 'twohand', kind: 'ranged', damage: 0, range: 0, cooldown: 0, splash: 0, armor: 0, price: 0, shop: false, round: 1, drop: 0, starter: true },
  { id: 'sword', name: { cs: 'Meč', en: 'Sword' }, slot: 'hand', kind: 'melee', damage: 6, range: 0, cooldown: 0, splash: 0, armor: 0, price: 25, shop: true, round: 1, drop: 3 },
  { id: 'axe', name: { cs: 'Obouruční sekera', en: 'Battle axe' }, slot: 'twohand', kind: 'melee', damage: 16, range: 5, cooldown: 0.25, splash: 0, armor: 0, price: 60, shop: true, round: 6, drop: 2 },
  { id: 'longbow', name: { cs: 'Dlouhý luk', en: 'Long bow' }, slot: 'twohand', kind: 'ranged', damage: 2, range: 60, cooldown: 0, splash: 0, armor: 0, price: 30, shop: true, round: 3, drop: 3 },
  { id: 'crossbow', name: { cs: 'Kuše', en: 'Crossbow' }, slot: 'twohand', kind: 'ranged', damage: 8, range: 20, cooldown: 0.3, splash: 0, armor: 0, price: 55, shop: true, round: 8, drop: 2 },
  { id: 'wand', name: { cs: 'Kouzelná hůlka', en: 'Magic wand' }, slot: 'hand', kind: 'magic', damage: 0, range: 0, cooldown: 0, splash: 50, armor: 0, price: 45, shop: true, round: 5, drop: 2 },
  { id: 'firestaff', name: { cs: 'Ohnivá hůl', en: 'Fire staff' }, slot: 'twohand', kind: 'magic', damage: 8, range: 20, cooldown: -0.2, splash: 75, armor: 0, price: 90, shop: true, round: 12, drop: 1 },
  { id: 'woodshield', name: { cs: 'Dřevěný štít', en: 'Wooden shield' }, slot: 'shield', damage: 0, range: 0, cooldown: 0, splash: 0, armor: 0.08, price: 20, shop: true, round: 2, drop: 2 },
  { id: 'ironshield', name: { cs: 'Železný štít', en: 'Iron shield' }, slot: 'shield', damage: 0, range: 0, cooldown: 0, splash: 0, armor: 0.15, price: 50, shop: true, round: 7, drop: 1 },
  { id: 'leather', name: { cs: 'Kožená zbroj', en: 'Leather armor' }, slot: 'armor', damage: 0, range: 0, cooldown: 0, splash: 0, armor: 0.08, price: 25, shop: true, round: 4, drop: 2 },
  { id: 'chainmail', name: { cs: 'Kroužková zbroj', en: 'Chain mail' }, slot: 'armor', damage: 0, range: 0, cooldown: 0, splash: 0, armor: 0.15, price: 60, shop: true, round: 10, drop: 1 },
];

export const isWeapon = (item) => item?.slot === 'hand' || item?.slot === 'twohand';

/** Items saved before slots existed: bows were two-handed, the rest one-handed. */
export function normalizeItem(item) {
  if (item.slot) return item;
  return { ...item, slot: item.kind === 'ranged' ? 'twohand' : 'hand', armor: item.armor ?? 0 };
}

/** The built-in item list: the kids' edited one, or the defaults. */
export function weaponsOf(db) {
  return db.weapons?.length ? db.weapons.map(normalizeItem) : DEFAULT_WEAPONS;
}

/** Numbers a new drawn item starts with (stored as `stats` on the asset). */
export function defaultItemStats(category) {
  if (category === 'weapon') return { kind: 'melee', hands: 1, damage: 4, range: 0, cooldown: 0, splash: 0, price: 30, shop: true, round: 1, drop: 2 };
  return { armor: 0.08, price: 25, shop: true, round: 1, drop: 2 };
}

/** Weapons, shields and armor drawn in the studio, as items. */
export function itemsFromAssets(assets = []) {
  return assets.filter((a) => ['weapon', 'shield', 'armor'].includes(a.category) && a.images?.[0]).map((a) => {
    const s = { ...defaultItemStats(a.category), ...a.stats };
    const base = { id: a.id, name: { cs: a.name, en: a.name }, asset: a.id, price: s.price, shop: s.shop, round: s.round, drop: s.drop, damage: 0, range: 0, cooldown: 0, splash: 0, armor: 0 };
    if (a.category !== 'weapon') return { ...base, slot: a.category, armor: s.armor };
    return { ...base, slot: s.hands === 2 ? 'twohand' : 'hand', kind: s.kind, damage: s.damage, range: s.range, cooldown: s.cooldown, splash: s.splash };
  });
}

/** Everything the hero can own in a game: built-in items + drawn ones. */
export function allItemsOf(db) {
  return [...weaponsOf(db), ...itemsFromAssets(db.assets)];
}

// coins: every coin drawing has a value; without drawings a 1 and a 5 coin are drawn as circles
export const DEFAULT_COIN_TYPES = [{ value: 1, key: 'coin' }, { value: 5, key: 'coin5' }];

export function coinTypesOf(assets = []) {
  const drawn = assets.filter((a) => a.category === 'coin' && a.images?.[0]).map((a) => ({ value: Math.max(1, a.stats?.value ?? 1), key: `coin:${a.id}`, src: a.images[0] }));
  return drawn.length ? drawn : DEFAULT_COIN_TYPES;
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
