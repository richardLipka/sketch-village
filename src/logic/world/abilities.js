// The hero's special ability (config/abilities.js, SPEC §6.4): used with a
// button (E), then waits its cooldown; bought better in the Town Hall shop.
// Methods of World (../world.js mixes them in); `this` is the World.

import { abilityAt } from '../../config/abilities.js';
import { dist } from './shared.js';

// a temporary soldier called by "reinforcements"
const ALLY = { hp: 70, damage: 9, cooldown: 1, patrol: 150 };
// abilities that do nothing without a monster in reach (so a press isn't wasted)
const NEEDS_ENEMY = new Set(['strike', 'shout', 'arrowRain', 'freeze']);

export class Abilities {
  /** The ability's numbers now (with its upgrades), or null without one. */
  get abilityNow() { return this.ability ? abilityAt(this.ability, this.abilityLevel) : null; }

  /** Why the ability can't be used now, or null. */
  abilityCheck() {
    const a = this.abilityNow;
    if (!a) return 'none';
    if (this.phase === 'won' || this.phase === 'lost') return 'over';
    if (this.hero.dead) return 'dead';
    if (this.abilityLeft > 0) return 'cooldown';
    if (NEEDS_ENEMY.has(a.id) && !this.enemiesNear(this.hero, a.radius).length) return 'no_target';
    return null;
  }

  enemiesNear(p, radius) {
    return this.enemies.filter((e) => !e.dead && dist(e, p) - e.radius <= radius);
  }

  useAbility() {
    const reason = this.abilityCheck();
    if (reason) return { ok: false, reason };
    const a = this.abilityNow;
    const h = this.hero;
    const near = () => this.enemiesNear(h, a.radius);
    const until = this.time + a.duration;
    switch (a.id) {
      case 'strike': {
        // the strongest monster in reach takes one big hit
        const target = near().sort((x, y) => y.hp - x.hp)[0];
        this.damageEnemy(target, a.power);
        break;
      }
      case 'arrowRain':
        for (const e of near()) this.damageEnemy(e, a.power);
        break;
      case 'shout':
        for (const e of near()) e.slow = { until, by: a.power };
        break;
      case 'freeze':
        for (const e of near()) e.slow = { until, by: 1 };
        break;
      case 'heal': {
        h.hp = Math.min(h.maxHp, h.hp + a.power);
        for (const b of [this.townHall, ...this.buildings]) {
          if (b.state !== 'ruin' && b.hp > 0 && dist(b, h) <= a.radius + (b.radius ?? 0)) b.hp = Math.min(b.maxHp, b.hp + a.power);
        }
        for (const s of this.soldiers) if (dist(s, h) <= a.radius) s.hp = Math.min(s.maxHp, s.hp + a.power);
        break;
      }
      case 'shield':
        h.invuln = Math.max(h.invuln, a.duration);
        h.shielded = until;
        break;
      case 'rally':
        for (const b of [this.townHall, ...this.buildings]) if (dist(b, h) <= a.radius) b.rally = { until, by: a.power };
        break;
      case 'reinforcements':
        this.callAllies(a.power, until);
        break;
      default:
        return { ok: false, reason: 'none' };
    }
    this.abilityLeft = a.cooldown;
    this.emit('ability', { id: a.id, x: h.x, y: h.y, radius: a.radius });
    return { ok: true };
  }

  /** Soldiers that fight next to the hero for a while, then go. */
  callAllies(n, until) {
    const post = { ...this.snapToRoad(this.hero), state: 'ready', hp: 1, patrol: ALLY.patrol };
    for (let i = 0; i < n; i++) {
      const a = (i / Math.max(1, n)) * Math.PI * 2;
      const home = { x: post.x + Math.cos(a) * 14, y: post.y + Math.sin(a) * 10 };
      this.soldiers.push({
        id: this.nextId++, kind: 'soldier', castleId: null, post, until, slot: i, x: post.x, y: post.y, home,
        cooldown: 0, radius: this.cfg.soldier.radius, target: null, path: [], repath: 0, facing: 1, dead: false,
        level: 1, look: null, lookIsEnemy: false, hp: ALLY.hp, maxHp: ALLY.hp, damage: ALLY.damage, attackCooldown: ALLY.cooldown,
        ranged: false, range: this.cfg.soldier.range, splash: 0, projectile: null,
      });
    }
  }

  updateAbility(dt) {
    if (this.abilityLeft > 0) this.abilityLeft = Math.max(0, this.abilityLeft - dt);
  }

  /** How fast a monster moves and attacks now: 1, less while slowed, 0 frozen. */
  paceOf(e) {
    if (!e.slow) return 1;
    if (this.time >= e.slow.until) { e.slow = null; return 1; }
    return 1 - e.slow.by;
  }

  /** How much faster a building (or the Town Hall) works now: 1, more while rallied. */
  rallyOf(b) {
    if (!b.rally) return 1;
    if (this.time >= b.rally.until) { b.rally = null; return 1; }
    return 1 + b.rally.by;
  }

  abilityUpgradeCheck() {
    if (!this.ability) return 'none';
    const lvl = this.abilityLevel;
    if (lvl >= this.heroCosts.length) return 'max';
    if (!this.unlocked(`hero:ability:${lvl + 1}`)) return 'locked';
    if (lvl + 1 > this.townHall.level) return 'townhall';
    if (this.hero.dead) return 'dead';
    if (!this.heroNear(this.townHall, this.townHall.radius)) return 'far';
    if (this.coins < this.heroCosts[lvl]) return 'coins';
    return null;
  }

  upgradeAbility() {
    const reason = this.abilityUpgradeCheck();
    if (reason) return { ok: false, reason };
    this.coins -= this.heroCosts[this.abilityLevel];
    this.abilityLevel++;
    this.emit('abilityUpgraded', { id: this.ability.id, level: this.abilityLevel });
    return { ok: true };
  }

  /** The ability for the HUD (button + cooldown) and the shop. */
  abilityInfo() {
    const a = this.abilityNow;
    if (!a) return null;
    return {
      id: a.id, level: this.abilityLevel, maxLevel: this.heroCosts.length,
      left: Math.ceil(this.abilityLeft), cooldown: a.cooldown, power: a.power, radius: a.radius, duration: a.duration,
    };
  }
}
