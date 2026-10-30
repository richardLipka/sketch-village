// Equipment: backpack, the three slots, changing weapons, the Town Hall shop and chests.
// Methods of World (../world.js mixes them in); `this` is the World.

import { WEAPON_CLASSES, withWeapon, isWeapon } from '../../config/weapons.js';
import { heroNumbers } from '../../config/heroStats.js';

export class Equipment {
  get mode() { return this.weaponTypes[this.equipped.right]?.kind ?? 'melee'; }

  /**
   * Attack buttons: take the last used (or first owned) weapon of that class into
   * the right hand. Returns null on success or a reason: 'none', 'switching'.
   */
  setMode(kind) {
    if (this.mode === kind && this.equipped.right) return null;
    const owned = this.inventory.map((id) => this.weaponTypes[id]).filter((w) => isWeapon(w) && w.kind === kind);
    if (!owned.length) return 'none';
    const pick = owned.find((w) => w.id === this.preferred[kind]) ?? owned[0];
    const r = this.equip(pick.id);
    return r.ok ? null : r.reason;
  }

  /** Hero numbers = skill points + Town Hall upgrades + the weapon in hand + shield and armor. */
  recalcHero() {
    const base = heroNumbers(this.heroPoints, this.heroUpgrades, this.heroRules);
    const weapon = this.weaponTypes[this.equipped.right] ?? null;
    if (weapon) base[weapon.kind] = withWeapon(base[weapon.kind], weapon);
    for (const k of WEAPON_CLASSES) if (!base[k].splash) base[k].splash = 0;
    const extra = (this.weaponTypes[this.equipped.left]?.armor ?? 0) + (this.weaponTypes[this.equipped.armor]?.armor ?? 0);
    base.armor = Math.min(this.heroRules.armorMax, +(base.armor + extra).toFixed(3));
    this.heroStats = base;
    if (this.hero) this.hero.mode = weapon?.kind ?? 'melee';
  }

  /** Put an item into the backpack; a shield or armor goes on at once when that slot is free. */
  addWeapon(id) {
    const w = this.weaponTypes[id];
    if (!w || this.inventory.includes(id)) return false;
    this.inventory.push(id);
    const twoHanded = this.weaponTypes[this.equipped.right]?.slot === 'twohand';
    if (w.slot === 'shield' && !this.equipped.left && !twoHanded) this.equipped.left = id;
    if (w.slot === 'armor' && !this.equipped.armor) this.equipped.armor = id;
    this.recalcHero();
    return true;
  }

  /**
   * Put on an item from the backpack. Weapons go to the right hand (two-handed
   * ones also take the left hand, so a shield comes off) and take
   * `weaponSwitchTime` seconds, during which the hero can't attack. Clicking an
   * equipped shield or armor takes it off.
   */
  equip(id) {
    const w = this.weaponTypes[id];
    if (!w || !this.inventory.includes(id)) return { ok: false, reason: 'unknown' };
    const e = this.equipped;
    if (isWeapon(w)) {
      if (e.right === id) return { ok: true };
      if (this.hero.switching > 0) return { ok: false, reason: 'switching' };
      e.right = id;
      if (w.slot === 'twohand') e.left = null;
      this.preferred[w.kind] = id;
      this.hero.switching = this.b.weaponSwitchTime;
      this.hero.target = null;
    } else if (w.slot === 'shield') {
      if (e.left === id) e.left = null;
      else {
        if (this.weaponTypes[e.right]?.slot === 'twohand') return { ok: false, reason: 'twohand' };
        e.left = id;
      }
    } else if (w.slot === 'armor') {
      e.armor = e.armor === id ? null : id;
    }
    this.recalcHero();
    this.emit('equipped', { weapon: id });
    return { ok: true };
  }

  /** Which equipment slot an item belongs in: 'right' (weapons), 'left' (shields) or 'armor'. */
  slotOf(id) {
    const w = this.weaponTypes[id];
    if (!w) return null;
    return isWeapon(w) ? 'right' : w.slot === 'shield' ? 'left' : 'armor';
  }

  /**
   * Backpack drag & drop: put an item into a given slot. A two-handed weapon
   * dropped on the left hand goes to the right one (it takes both anyway).
   */
  equipTo(id, slot) {
    if (!this.inventory.includes(id)) return { ok: false, reason: 'unknown' };
    const want = this.slotOf(id);
    if (slot === 'left' && this.weaponTypes[id].slot === 'twohand') slot = 'right';
    if (slot !== want) return { ok: false, reason: 'wrong_slot' };
    if (this.equipped[slot] === id) return { ok: true };
    return this.equip(id);
  }

  /** Take an item off back into the backpack (the hero fights with bare hands without a weapon). */
  unequip(slot) {
    const e = this.equipped;
    if (!(slot in e)) return { ok: false, reason: 'unknown' };
    if (!e[slot]) return { ok: true };
    if (slot === 'right') {
      if (this.hero.switching > 0) return { ok: false, reason: 'switching' };
      this.hero.target = null;
    }
    e[slot] = null;
    this.recalcHero();
    this.emit('equipped', { weapon: null });
    return { ok: true };
  }

  shopCheck(id) {
    const w = this.weaponTypes[id];
    if (!w || !w.shop) return 'unknown';
    if (this.inventory.includes(id)) return 'owned';
    if ((w.round ?? 1) > this.round + 1) return 'locked';
    if (this.hero.dead) return 'dead';
    if (!this.heroNear(this.townHall, this.townHall.radius)) return 'far';
    if (this.coins < (w.price ?? 0)) return 'coins';
    return null;
  }

  buyWeapon(id) {
    const reason = this.shopCheck(id);
    if (reason) return { ok: false, reason };
    this.coins -= this.weaponTypes[id].price ?? 0;
    this.addWeapon(id);
    this.emit('weaponBought', { weapon: id });
    return { ok: true };
  }

  /** A chest gives a weapon the hero doesn't own yet (weighted by `drop`), or coins. */
  openChest() {
    const pool = Object.values(this.weaponTypes).filter((w) => (w.drop ?? 0) > 0 && !this.inventory.includes(w.id));
    const total = pool.reduce((s, w) => s + w.drop, 0);
    if (!total) {
      this.coins += this.b.chestCoins;
      return { coins: this.b.chestCoins };
    }
    let r = this.rng() * total;
    const w = pool.find((x) => (r -= x.drop) < 0) ?? pool.at(-1);
    this.addWeapon(w.id);
    return { weapon: w.id };
  }
}
