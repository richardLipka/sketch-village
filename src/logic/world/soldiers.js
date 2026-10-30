// Soldiers of castles (and a Town Hall with the soldiers feature): guard, patrol, fight.
// Methods of World (../world.js mixes them in); `this` is the World.

import { dist, REPATH_EVERY } from './shared.js';

export class Soldiers {
  /**
   * Soldiers guard their building: they fight walking enemies that come within
   * the building's patrol distance (`soldierPatrol`), never chase beyond it and
   * go back to their own starting point afterwards. With nothing to fight they
   * patrol: walk to a spot on the road inside that distance, look around for a
   * moment and walk back to the starting point.
   */
  updateSoldier(s, dt) {
    const castle = s.castleId === this.townHall.id ? this.townHall : this.buildings.find((b) => b.id === s.castleId);
    if (!castle || castle.state === 'ruin' || castle.hp <= 0) { s.dead = true; return; }
    s.cooldown = Math.max(0, s.cooldown - dt);
    const cfg = this.cfg.soldier;
    const patrol = this.levelStats(castle).soldierPatrol ?? cfg.aggro;
    const inside = (e) => !e.flying && !e.dead && dist(e, castle) <= patrol;

    let target = s.target ? this.enemies.find((e) => e.id === s.target) : null;
    if (target && !inside(target)) target = null; // out of the patrol area: let it go
    if (!target) {
      let bd = Infinity;
      for (const e of this.enemies) {
        if (!inside(e)) continue;
        const d = dist(e, s);
        if (d < bd) { bd = d; target = e; }
      }
    }
    if (target && s.target !== target.id) { s.path = []; s.patrolTo = null; }
    s.target = target?.id ?? null;

    if (target) {
      if (dist(s, target) - target.radius <= cfg.range) {
        s.path = [];
        s.facing = target.x < s.x ? -1 : 1;
        if (s.cooldown === 0) {
          s.cooldown = s.attackCooldown;
          this.damageEnemy(target, s.damage);
          this.emit('soldierAttack', { id: s.id });
        }
        return;
      }
      s.repath -= dt;
      if (s.repath <= 0 || !s.path.length) {
        s.path = this.pathBetween(s, target) ?? [];
        s.repath = REPATH_EVERY;
      }
    } else if (s.patrolTo) {
      // out on patrol: at the far point, look around, then head back
      if (!s.path.length) {
        s.lookLeft = (s.lookLeft ?? 1.5) - dt;
        if (s.lookLeft <= 0) { s.patrolTo = null; s.lookLeft = null; }
      }
    } else if (dist(s, s.home) > 3) {
      if (!s.path.length) {
        s.path = this.pathBetween(s, s.home) ?? [];
        if (s.path.length) s.path[s.path.length - 1] = { ...s.home };
      }
    } else {
      // at the starting point: after a short rest go on patrol
      s.restLeft = (s.restLeft ?? 2 + this.rng() * 3) - dt;
      if (s.restLeft <= 0) {
        s.restLeft = null;
        const a = this.rng() * Math.PI * 2, r = patrol * (0.45 + this.rng() * 0.4);
        const p = this.snapToRoad({ x: castle.x + Math.cos(a) * r, y: castle.y + Math.sin(a) * r });
        if (dist(p, castle) <= patrol && dist(p, s) > 20) {
          s.patrolTo = p;
          s.path = this.pathBetween(s, p) ?? [];
          if (!s.path.length) s.patrolTo = null;
        }
      }
    }
    this.walk(s, cfg.speed * dt);
  }
}
