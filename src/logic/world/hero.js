// Walking on roads (paths for the hero and soldiers) and the hero itself.
// Methods of World (../world.js mixes them in); `this` is the World.

import { worldToCell, cellCenter, nearestWalkable } from '../pathGrid.js';
import { findPath, smoothPath } from '../pathfinding.js';
import { dist, REPATH_EVERY, HERO_GUARD_RADIUS } from './shared.js';

export class Hero {
  /** Road waypoints from a to b (world coords), or null. */
  pathBetween(a, b) {
    const g = this.grid;
    const tc = worldToCell(g, b.x, b.y);
    const goal = nearestWalkable(g, tc.cx, tc.cy);
    const fc = worldToCell(g, a.x, a.y);
    const start = nearestWalkable(g, fc.cx, fc.cy);
    if (!goal || !start) return null;
    const cells = smoothPath(g, findPath(g, start, goal));
    if (!cells) return null;
    const path = cells.slice(1).map((c) => cellCenter(g, c.cx, c.cy));
    if (goal.dist === 0 && path.length) path[path.length - 1] = { x: b.x, y: b.y };
    return path;
  }

  walk(o, step) {
    while (step > 0 && o.path.length) {
      const wp = o.path[0];
      const d = dist(o, wp);
      if (Math.abs(wp.x - o.x) > 0.5) o.facing = wp.x < o.x ? -1 : 1;
      if (d <= step) {
        o.x = wp.x; o.y = wp.y;
        o.path.shift();
        step -= d;
      } else {
        this.moveToward(o, wp, step);
        step = 0;
      }
    }
  }

  // ---------------- hero ----------------

  pathHeroTo(x, y) {
    const path = this.pathBetween(this.hero, { x, y });
    if (!path) return null;
    this.hero.path = path;
    return path.at(-1) ?? { x: this.hero.x, y: this.hero.y };
  }

  heroCan(mode, enemy) {
    return !(mode === 'melee' && enemy.flying);
  }

  updateHero(dt) {
    const h = this.hero;
    if (h.dead) {
      if (this.time >= h.respawnAt) {
        Object.assign(h, { ...this.respawnPoint, dead: false, hp: h.maxHp, invuln: this.b.hitInvulnerability, path: [], guard: null, target: null });
        this.emit('heroRespawn');
      }
      return;
    }
    h.invuln = Math.max(0, h.invuln - dt);
    h.cooldown = Math.max(0, h.cooldown - dt);
    h.switching = Math.max(0, h.switching - dt);
    const stats = this.heroStats[h.mode];

    let target = h.target ? this.enemies.find((e) => e.id === h.target) : null;
    if (h.target && !target) h.target = null;
    if (target && !this.heroCan(h.mode, target)) {
      this.emit('cantHit', { id: target.id });
      h.target = null;
      target = null;
    }

    // idle hero guards its spot: engage the nearest hittable enemy within the
    // guard radius, and walk back to the guard spot afterwards
    if (!target && !h.path.length) {
      const reach = Math.max(stats.range, HERO_GUARD_RADIUS);
      const from = h.guard ?? h;
      let bd = Infinity;
      for (const e of this.enemies) {
        if (!this.heroCan(h.mode, e)) continue;
        const d = dist(from, e) - e.radius;
        if (d <= reach && d < bd) { bd = d; target = e; }
      }
      if (target) {
        h.guard = h.guard ?? { x: h.x, y: h.y };
        h.target = target.id;
        h.repath = 0;
      } else if (h.guard) {
        if (dist(h, h.guard) > 6) this.pathHeroTo(h.guard.x, h.guard.y);
        h.guard = null;
      }
    }
    // stop chasing when the enemy runs too far from the guard spot
    if (target && h.guard && dist(h.guard, target) > HERO_GUARD_RADIUS * 1.6) {
      h.target = null;
      target = null;
    }

    if (target) {
      const d = dist(h, target) - target.radius;
      if (d <= stats.range) {
        if (h.target === target.id) h.path = [];
        if (target.x !== h.x) h.facing = target.x < h.x ? -1 : 1;
        if (h.cooldown === 0 && h.switching === 0) {
          h.cooldown = stats.cooldown;
          if (h.mode === 'magic') this.shoot(h, target, stats.damage, 'magic', stats.splash);
          else if (h.mode === 'ranged') this.shoot(h, target, stats.damage, 'hero');
          else this.damageEnemy(target, stats.damage);
          this.emit('heroAttack', { mode: h.mode });
        }
      } else if (h.target === target.id) {
        h.repath -= dt;
        if (h.repath <= 0 || !h.path.length) {
          this.pathHeroTo(target.x, target.y);
          h.repath = REPATH_EVERY;
        }
      }
    }

    this.walk(h, this.heroStats.speed * dt);
  }
}
