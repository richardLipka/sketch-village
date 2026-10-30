// Enemies: spawning from caves and summoners, minions, choosing a target, walking.
// Methods of World (../world.js mixes them in); `this` is the World.

import { worldToCell, cellCenter, isWalkable } from '../pathGrid.js';
import { hpScale } from '../waves.js';
import { dist, SEPARATION } from './shared.js';

export class Enemies {
  /** A wave entry comes out of its cave. */
  spawn({ enemy, cave }) {
    const c = this.caves.find((x) => x.id === cave);
    if (c) this.spawnEnemy(enemy, c);
  }

  /** A new enemy at `at` (ground ones step onto the nearest road); `summoner` = who called it. */
  spawnEnemy(typeId, at, summoner = null) {
    const type = this.types[typeId];
    if (!type) return null;
    const hp = Math.max(1, Math.round(type.hp * hpScale(this.b, this.round) * this.difficulty.enemyHp));
    const start = type.flying ? { x: at.x, y: at.y } : this.snapToRoad(at);
    const e = {
      id: this.nextId++, kind: 'enemy', type: type.id, x: start.x, y: start.y,
      hp, maxHp: hp, flying: !!type.flying, radius: (type.boss ? this.b.bossRadius : this.b.enemyRadius) * (type.size ?? 1),
      cooldown: 0, next: null, offset: (this.rng() * 2 - 1) * SEPARATION, dead: false, attacking: false,
      summoner: summoner?.id ?? null, summonTimer: type.minionEvery ?? 0,
    };
    this.enemies.push(e);
    this.emit('spawn', { id: e.id, enemy: type.id, summoned: !!summoner });
    return e;
  }

  /** Minion types an enemy can call, or none (minions never call minions). */
  minionsOf(e, type) {
    if (e.summoner || type.summons === false) return [];
    return (type.minions ?? []).filter((id) => this.types[id] && id !== type.id);
  }

  /** Call `n` minions around enemy `e` (one random type each). */
  callMinions(e, kinds, n) {
    for (let i = 0; i < n; i++) {
      const a = this.rng() * Math.PI * 2;
      const kind = kinds[Math.floor(this.rng() * kinds.length)];
      this.spawnEnemy(kind, { x: e.x + Math.cos(a) * 14, y: e.y + Math.sin(a) * 14 }, e);
    }
    if (n > 0) this.emit('summon', { id: e.id, x: e.x, y: e.y, count: n });
  }

  /** Summoners call minions every `minionEvery` s while fewer than `minionMax` of theirs live. */
  summon(e, type, dt) {
    const kinds = this.minionsOf(e, type);
    if (!kinds.length || !(type.minionEvery > 0)) return;
    e.summonTimer -= dt;
    if (e.summonTimer > 0) return;
    e.summonTimer = type.minionEvery;
    const alive = this.enemies.filter((m) => m.summoner === e.id && !m.dead).length;
    this.callMinions(e, kinds, Math.max(0, Math.min(type.minionCount ?? 1, (type.minionMax ?? 6) - alive)));
  }

  // The nearest thing an enemy can hit right now, or null.
  enemyTarget(e, type) {
    let best = null, bd = Infinity;
    const consider = (o, radius) => {
      const d = dist(e, o) - radius - e.radius;
      if (d <= type.range && d < bd) { best = o; bd = d; }
    };
    if (this.townHall.hp > 0) consider(this.townHall, this.townHall.radius);
    if (!this.hero.dead) consider(this.hero, this.b.heroRadius);
    for (const b of this.buildings) if (b.state !== 'ruin') consider(b, b.radius);
    for (const s of this.soldiers) consider(s, s.radius);
    return best;
  }

  updateEnemy(e, dt) {
    const type = this.types[e.type];
    e.cooldown = Math.max(0, e.cooldown - dt);
    this.summon(e, type, dt);
    const target = this.enemyTarget(e, type);
    e.attacking = !!target;
    e.victim = target;
    if (target) {
      if (e.cooldown === 0) {
        e.cooldown = type.cooldown;
        if (type.ranged) this.shoot(e, target, type.damage, 'enemy', type.splash ?? 0, type.projectile ?? null);
        else {
          this.damage(target, type.damage);
          if (type.splash > 0) this.enemySplash(target, type.splash, type.damage, target);
        }
        this.emit('enemyAttack', { id: e.id, enemy: e.type });
      }
      return;
    }

    let step = type.speed * dt;
    if (e.flying) {
      this.moveToward(e, this.townHall, step);
      return;
    }
    while (step > 0) {
      if (!e.next) e.next = this.nextWaypoint(e);
      const d = dist(e, e.next);
      if (d <= step) {
        e.x = e.next.x; e.y = e.next.y;
        step -= d;
        e.next = null;
        if (step < 1e-6) break;
      } else {
        this.moveToward(e, e.next, step);
        step = 0;
      }
    }
  }

  // Next point on the flow field: the 4-neighbour cell closer to the centre.
  nextWaypoint(e) {
    const g = this.grid;
    const { cx, cy } = worldToCell(g, e.x, e.y);
    const here = this.flow[cy * g.cols + cx];
    let best = null, bv = here;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const x = cx + dx, y = cy + dy;
      if (!isWalkable(g, x, y)) continue;
      const v = this.flow[y * g.cols + x];
      if (v < bv) { bv = v; best = { cx: x, cy: y }; }
    }
    if (!best) return { x: this.townHall.x, y: this.townHall.y }; // at the centre (or lost): head for the hall
    const p = cellCenter(g, best.cx, best.cy);
    // sideways offset perpendicular to the step, kept inside the cell
    const off = Math.max(-g.cell * 0.35, Math.min(g.cell * 0.35, e.offset));
    return best.cx !== cx ? { x: p.x, y: p.y + off } : { x: p.x + off, y: p.y };
  }

  moveToward(o, p, step) {
    const dx = p.x - o.x, dy = p.y - o.y;
    const d = Math.hypot(dx, dy);
    if (d < 1e-6) return;
    const k = Math.min(1, step / d);
    o.x += dx * k;
    o.y += dy * k;
    if (Math.abs(dx) > 0.5) o.facing = dx < 0 ? -1 : 1;
  }
}
