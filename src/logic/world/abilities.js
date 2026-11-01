// The hero's special ability (config/abilities.js, SPEC §6.4): used with a
// button (E), then waits its cooldown; bought better in the Town Hall shop.
// Arrow rain is aimed: it lands on a place (within its reach of the hero).
// abilityTargets() tells who it would touch now – the game shows it before
// the ability is used. Methods of World (../world.js mixes them in); `this` is the World.

import { abilityAt } from '../../config/abilities.js';
import { dist } from './shared.js';

// a temporary soldier called by "reinforcements"
const ALLY = { hp: 70, damage: 9, cooldown: 1, patrol: 150 };
// abilities that do nothing without a monster in reach (so a press isn't wasted)
const NEEDS_ENEMY = new Set(['strike', 'shout', 'arrowRain', 'freeze']);
// arrow rain: how many arrows fly (one of them carries the hit), and over how long they leave the bow
const RAIN_ARROWS = 12;
const RAIN_SPREAD = 0.45; // s

export class Abilities {
  /** The ability's numbers now (with its upgrades), or null without one. */
  get abilityNow() { return this.ability ? abilityAt(this.ability, this.abilityLevel) : null; }

  /** Why the ability can't be used now (at the place `at`, for an aimed one), or null. */
  abilityCheck(at = null) {
    const a = this.abilityNow;
    if (!a) return 'none';
    if (this.phase === 'won' || this.phase === 'lost') return 'over';
    if (this.hero.dead) return 'dead';
    if (this.abilityLeft > 0) return 'cooldown';
    if (NEEDS_ENEMY.has(a.id) && !this.abilityTargets(at).enemies.length) return 'no_target';
    return null;
  }

  enemiesNear(p, radius) {
    return this.enemies.filter((e) => !e.dead && dist(e, p) - e.radius <= radius);
  }

  /**
   * Where an aimed ability lands: the place asked for, pulled back within its reach
   * of the hero; without a place, the spot in reach with the most monsters around.
   */
  aimSpot(at = null) {
    const a = this.abilityNow, h = this.hero;
    if (at) {
      const d = dist(at, h);
      if (d <= a.reach) return { x: at.x, y: at.y };
      return { x: h.x + ((at.x - h.x) / d) * a.reach, y: h.y + ((at.y - h.y) / d) * a.reach };
    }
    let best = null, most = 0;
    for (const e of this.enemies) {
      if (e.dead || dist(e, h) > a.reach) continue;
      const n = this.enemiesNear(e, a.radius).length;
      if (n > most) { best = e; most = n; }
    }
    return best ? { x: best.x, y: best.y } : { x: h.x, y: h.y };
  }

  /**
   * Who the ability would touch if used now: { x, y, radius, reach, enemies, friends }
   * – the centre of its area (the hero, or the aimed place), the monsters it hits or
   * slows, the hero / buildings / soldiers it helps (each { ref, x, y, r, kind, hurt }).
   */
  abilityTargets(at = null) {
    const a = this.abilityNow, h = this.hero;
    const out = { x: h.x, y: h.y, radius: a?.radius ?? 0, reach: a?.reach ?? 0, enemies: [], friends: [] };
    if (!a || h.dead) return out;
    const friend = (o, kind, r) => ({ ref: o, x: o.x, y: o.y, r, kind, hurt: o.hp < o.maxHp });
    const standing = [this.townHall, ...this.buildings].filter((b) => b.state !== 'ruin' && b.hp > 0 && (b.level ?? 1) > 0);
    switch (a.id) {
      case 'strike': {
        // the strongest monster in reach takes the blow
        const target = this.enemiesNear(h, a.radius).sort((x, y) => y.hp - x.hp)[0];
        if (target) out.enemies = [target];
        break;
      }
      case 'arrowRain':
        Object.assign(out, this.aimSpot(at));
        out.enemies = this.enemiesNear(out, a.radius);
        break;
      case 'shout':
      case 'freeze':
        out.enemies = this.enemiesNear(h, a.radius);
        break;
      case 'heal':
        out.friends = [friend(h, 'hero', 18),
          ...standing.filter((b) => dist(b, h) <= a.radius + (b.radius ?? 0)).map((b) => friend(b, 'building', b === this.townHall ? 50 : 30)),
          ...this.soldiers.filter((s) => !s.dead && dist(s, h) <= a.radius).map((s) => friend(s, 'soldier', 14))];
        break;
      case 'rally':
        out.friends = standing.filter((b) => dist(b, h) <= a.radius).map((b) => friend(b, 'building', b === this.townHall ? 50 : 30));
        break;
      case 'shield':
        out.friends = [friend(h, 'hero', 22)];
        break;
      case 'reinforcements':
        Object.assign(out, this.snapToRoad(h));
        break;
      default:
    }
    return out;
  }

  /** Use the ability; an aimed one (arrow rain) at the place `at` (none: where most monsters are). */
  useAbility(at = null) {
    const reason = this.abilityCheck(at);
    if (reason) return { ok: false, reason };
    const a = this.abilityNow;
    const h = this.hero;
    const t = this.abilityTargets(at);
    const until = this.time + a.duration;
    const healed = [];
    switch (a.id) {
      case 'strike':
        this.damageEnemy(t.enemies[0], a.power);
        break;
      case 'arrowRain':
        this.arrowRain(t, a.power, a.radius);
        break;
      case 'shout':
        for (const e of t.enemies) e.slow = { until, by: a.power };
        break;
      case 'freeze':
        for (const e of t.enemies) e.slow = { until, by: 1 };
        break;
      case 'heal': {
        for (const { ref: o } of t.friends) {
          const before = o.hp;
          o.hp = Math.min(o.maxHp, o.hp + a.power);
          if (o.hp > before) healed.push({ x: o.x, y: o.y, amount: Math.round(o.hp - before) });
        }
        break;
      }
      case 'shield':
        h.invuln = Math.max(h.invuln, a.duration);
        h.shielded = until;
        break;
      case 'rally':
        for (const f of t.friends) f.ref.rally = { until, by: a.power };
        break;
      case 'reinforcements':
        this.callAllies(a.power, until);
        break;
      default:
        return { ok: false, reason: 'none' };
    }
    this.abilityLeft = a.cooldown;
    this.emit('ability', { id: a.id, x: t.x, y: t.y, radius: a.id === 'shield' ? 0 : t.radius, healed });
    return { ok: true };
  }

  /**
   * Arrow rain: the hero shoots a volley of its own arrows (the hero's projectile)
   * at the place; they land spread over the area, and when the middle one lands
   * every monster there is hit (flying ones too).
   */
  arrowRain(at, damage, radius) {
    const h = this.hero;
    if (at.x !== h.x) h.facing = at.x < h.x ? -1 : 1;
    for (let i = 0; i < RAIN_ARROWS; i++) {
      // spread evenly over the circle (a sunflower pattern), the first one in the middle
      const r = i === 0 ? 0 : radius * 0.9 * Math.sqrt(i / RAIN_ARROWS), ang = i * 2.39996;
      const spot = { kind: 'ground', x: at.x + Math.cos(ang) * r, y: at.y + Math.sin(ang) * r * 0.8 };
      this.projectiles.push({
        id: this.nextId++, owner: 'hero', x: h.x, y: h.y - 20, target: spot, look: null, speed: this.b.projectileSpeed,
        wait: i === 0 ? RAIN_SPREAD / 2 : (i / RAIN_ARROWS) * RAIN_SPREAD,
        ...(i === 0 ? { damage, splash: radius } : { damage: 0, splash: 0, decor: true }),
      });
    }
    this.emit('heroAttack', { mode: 'ranged' });
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
    if (this.abilityLeft <= 0) return;
    this.abilityLeft = Math.max(0, this.abilityLeft - dt);
    if (this.abilityLeft === 0) this.emit('abilityReady', { id: this.ability.id, x: this.hero.x, y: this.hero.y });
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
      left: Math.ceil(this.abilityLeft), cooldown: a.cooldown, power: a.power, radius: a.radius, reach: a.reach, duration: a.duration,
    };
  }
}
