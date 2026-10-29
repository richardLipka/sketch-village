// The game simulation (M3). Pure – no Phaser, no DOM – so it is unit-tested and
// the renderer only draws what is here.
//
//   rounds:  prep (countdown, Ready = early bonus) → wave (spawn timeline) →
//            all spawned and all dead → reward → next prep … → won
//   enemies: ground ones follow the flow field to the Town Hall, flying ones
//            fly straight; on the way they attack anything in range (hero, Town Hall)
//   hero:    walks on roads, melee or ranged (player's choice), 5 lives,
//            30 s absence after the last one, auto-attacks what is in range
//   coins:   drop on roads, must be picked up, vanish after 30 s
//   lost:    Town Hall destroyed

import { BALANCE } from '../config/balance.js';
import { worldToCell, cellCenter, nearestWalkable, isWalkable } from './pathGrid.js';
import { findPath, smoothPath, flowField } from './pathfinding.js';
import { expandRound, roundReward, hpScale } from './waves.js';

const REPATH_EVERY = 0.4;
const SEPARATION = 10; // px sideways offset range for ground enemies, so groups don't stack

export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

export class World {
  /**
   * @param {object} o
   * @param {object} o.map        map record (centre, caves, heroRespawn)
   * @param {object} o.grid       walkability grid
   * @param {object[]} o.enemyTypes
   * @param {object} o.waves      { startCoins, firstPrep, prep, rounds }
   * @param {object} o.hero       heroNumbers(): { hp, melee, ranged, armor, speed }
   * @param {object} [o.balance]
   * @param {number} [o.seed]
   */
  constructor({ map, grid, enemyTypes, waves, hero, balance = BALANCE, seed = Date.now() }) {
    this.b = balance;
    this.map = map;
    this.grid = grid;
    this.types = Object.fromEntries(enemyTypes.map((t) => [t.id, t]));
    this.waves = waves;
    this.rng = mulberry32(seed);
    this.nextId = 1;
    this.events = [];
    this.time = 0;

    const c = worldToCell(grid, map.centre.x, map.centre.y);
    this.centreCell = nearestWalkable(grid, c.cx, c.cy);
    this.flow = flowField(grid, this.centreCell);

    this.townHall = { kind: 'townhall', x: map.centre.x, y: map.centre.y, level: 1, hp: balance.townHallHp[0], maxHp: balance.townHallHp[0], radius: balance.townHallRadius };

    this.caves = map.caves.map((cv) => ({ id: cv.id, x: cv.x, y: cv.y }));
    this.caveIds = this.caves.map((cv) => cv.id);

    this.heroStats = hero;
    this.respawnPoint = this.snapToRoad(map.heroRespawn ?? { x: map.centre.x, y: map.centre.y + (map.centre.radius ?? 60) });
    this.hero = {
      kind: 'hero', ...this.respawnPoint, hp: hero.hp, maxHp: hero.hp, lives: balance.heroLives,
      mode: 'melee', path: [], target: null, cooldown: 0, invuln: 0, dead: false, respawnAt: 0, repath: 0, facing: 1,
    };

    this.enemies = [];
    this.projectiles = [];
    this.coinsOnGround = [];
    this.coins = waves.startCoins ?? balance.startCoins;
    this.round = 0; // index of the next/current round
    this.phase = 'prep';
    this.prepLeft = waves.firstPrep ?? balance.firstPrep;
    this.queue = [];
    this.waveTime = 0;
  }

  get totalRounds() { return this.waves.rounds.length; }

  emit(type, data = {}) { this.events.push({ type, ...data }); }
  drainEvents() { const e = this.events; this.events = []; return e; }

  snapToRoad(p) {
    const c = worldToCell(this.grid, p.x, p.y);
    const n = nearestWalkable(this.grid, c.cx, c.cy);
    return n ? cellCenter(this.grid, n.cx, n.cy) : { x: p.x, y: p.y };
  }

  // ---------------- player commands ----------------

  /** Start the next wave now; returns the early bonus paid. */
  callReady() {
    if (this.phase !== 'prep') return 0;
    const bonus = Math.floor(this.prepLeft * this.b.earlyBonusPerSecond);
    this.coins += bonus;
    if (bonus) this.emit('bonus', { amount: bonus });
    this.startWave();
    return bonus;
  }

  setMode(mode) { this.hero.mode = mode; }

  moveHeroTo(x, y) {
    if (this.hero.dead) return null;
    this.hero.target = null;
    return this.pathHeroTo(x, y);
  }

  attack(enemyId) {
    if (this.hero.dead) return;
    const e = this.enemies.find((x) => x.id === enemyId);
    if (!e) return;
    this.hero.target = enemyId;
    this.hero.path = [];
    this.hero.repath = 0;
  }

  enemyAt(x, y, radius = 24) {
    let best = null, bd = Infinity;
    for (const e of this.enemies) {
      const d = dist(e, { x, y }) - e.radius;
      if (d < radius && d < bd) { best = e; bd = d; }
    }
    return best;
  }

  // ---------------- main loop ----------------

  update(dt) {
    if (this.phase === 'won' || this.phase === 'lost') return;
    this.time += dt;

    if (this.phase === 'prep') {
      this.prepLeft -= dt;
      if (this.prepLeft <= 0) this.startWave();
    } else if (this.phase === 'wave') {
      this.waveTime += dt;
      while (this.queue.length && this.queue[0].t <= this.waveTime) this.spawn(this.queue.shift());
    }

    this.updateHero(dt);
    for (const e of this.enemies) this.updateEnemy(e, dt);
    this.enemies = this.enemies.filter((e) => !e.dead);
    this.updateProjectiles(dt);
    this.updateCoins(dt);

    if (this.phase === 'wave' && !this.queue.length && !this.enemies.length) this.endRound();
  }

  startWave() {
    this.phase = 'wave';
    this.waveTime = 0;
    this.queue = expandRound(this.waves.rounds[this.round], this.caveIds);
    this.emit('waveStart', { round: this.round + 1 });
  }

  endRound() {
    const reward = this.waves.rounds[this.round].reward ?? roundReward(this.b, this.round);
    this.coins += reward;
    this.emit('roundEnd', { round: this.round + 1, reward });
    this.round++;
    if (this.round >= this.totalRounds) {
      this.phase = 'won';
      this.emit('won');
    } else {
      this.phase = 'prep';
      this.prepLeft = this.waves.prep ?? this.b.prep;
    }
  }

  // ---------------- enemies ----------------

  spawn({ enemy, cave }) {
    const type = this.types[enemy];
    const c = this.caves.find((x) => x.id === cave);
    if (!type || !c) return;
    const hp = Math.round(type.hp * hpScale(this.b, this.round));
    const start = type.flying ? { x: c.x, y: c.y } : this.snapToRoad(c);
    const e = {
      id: this.nextId++, kind: 'enemy', type: type.id, x: start.x, y: start.y,
      hp, maxHp: hp, flying: !!type.flying, radius: type.boss ? this.b.bossRadius : this.b.enemyRadius,
      cooldown: 0, next: null, offset: (this.rng() * 2 - 1) * SEPARATION, dead: false, attacking: false,
    };
    this.enemies.push(e);
    this.emit('spawn', { id: e.id, enemy: type.id });
  }

  // The nearest thing an enemy can hit right now, or null.
  enemyTarget(e, type) {
    const cands = [];
    if (this.townHall.hp > 0) cands.push(this.townHall);
    if (!this.hero.dead) cands.push({ ref: this.hero, x: this.hero.x, y: this.hero.y, radius: this.b.heroRadius });
    let best = null, bd = Infinity;
    for (const c of cands) {
      const d = dist(e, c) - (c.radius ?? 0) - e.radius;
      if (d <= type.range && d < bd) { best = c.ref ?? c; bd = d; }
    }
    return best;
  }

  updateEnemy(e, dt) {
    const type = this.types[e.type];
    e.cooldown = Math.max(0, e.cooldown - dt);
    const target = this.enemyTarget(e, type);
    e.attacking = !!target;
    if (target) {
      if (e.cooldown === 0) {
        e.cooldown = type.cooldown;
        if (type.ranged) this.shoot(e, target, type.damage, 'enemy');
        else this.damage(target, type.damage);
        this.emit('enemyAttack', { id: e.id });
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

  // ---------------- damage ----------------

  damage(target, amount) {
    if (target === this.townHall) {
      this.townHall.hp = Math.max(0, this.townHall.hp - amount);
      this.emit('hit', { kind: 'townhall', x: target.x, y: target.y, amount });
      if (this.townHall.hp === 0) {
        this.phase = 'lost';
        this.emit('lost');
      }
      return;
    }
    if (target === this.hero) {
      const h = this.hero;
      if (h.dead || h.invuln > 0) return;
      const real = Math.max(1, Math.round(amount * (1 - this.heroStats.armor)));
      h.hp -= real;
      this.emit('hit', { kind: 'hero', x: h.x, y: h.y, amount: real });
      if (h.hp <= 0) this.loseLife();
      return;
    }
    if (target.kind === 'enemy') this.damageEnemy(target, amount);
  }

  damageEnemy(e, amount) {
    if (e.dead) return;
    const armor = this.types[e.type].armor ?? 0;
    const real = Math.max(1, Math.round(amount * (1 - armor)));
    e.hp -= real;
    this.emit('hit', { kind: 'enemy', id: e.id, x: e.x, y: e.y, amount: real });
    if (e.hp <= 0) this.killEnemy(e);
  }

  killEnemy(e) {
    e.dead = true;
    const [lo, hi] = this.types[e.type].coins ?? [1, 1];
    const n = lo + Math.floor(this.rng() * (hi - lo + 1));
    const spot = this.snapToRoad(e);
    for (let i = 0; i < n; i++) {
      const a = this.rng() * Math.PI * 2, r = this.rng() * 8;
      this.coinsOnGround.push({ id: this.nextId++, x: spot.x + Math.cos(a) * r, y: spot.y + Math.sin(a) * r, born: this.time });
    }
    if (this.hero.target === e.id) this.hero.target = null;
    this.emit('enemyDied', { id: e.id, x: e.x, y: e.y, coins: n });
  }

  loseLife() {
    const h = this.hero;
    h.lives--;
    this.emit('heroLostLife', { lives: h.lives });
    if (h.lives > 0) {
      h.hp = h.maxHp;
      h.invuln = this.b.hitInvulnerability;
    } else {
      h.dead = true;
      h.path = [];
      h.target = null;
      h.respawnAt = this.time + this.b.heroRespawnDelay;
      this.emit('heroDown', { respawnIn: this.b.heroRespawnDelay });
    }
  }

  // ---------------- projectiles ----------------

  shoot(from, target, damage, owner) {
    this.projectiles.push({
      id: this.nextId++, owner, x: from.x, y: from.y,
      target, damage, speed: this.b.projectileSpeed,
    });
  }

  updateProjectiles(dt) {
    for (const p of this.projectiles) {
      const t = p.target;
      const gone = t.dead || (t === this.hero && this.hero.dead) || (t === this.townHall && t.hp <= 0) || (t.kind === 'enemy' && !this.enemies.includes(t));
      if (gone) { p.done = true; continue; }
      const step = p.speed * dt;
      if (dist(p, t) <= step) {
        p.done = true;
        this.damage(t, p.damage);
      } else {
        const a = Math.atan2(t.y - p.y, t.x - p.x);
        p.x += Math.cos(a) * step;
        p.y += Math.sin(a) * step;
        p.angle = a;
      }
    }
    this.projectiles = this.projectiles.filter((p) => !p.done);
  }

  // ---------------- hero ----------------

  pathHeroTo(x, y) {
    const g = this.grid, h = this.hero;
    const tc = worldToCell(g, x, y);
    const goal = nearestWalkable(g, tc.cx, tc.cy);
    if (!goal) return null;
    const fc = worldToCell(g, h.x, h.y);
    const start = nearestWalkable(g, fc.cx, fc.cy);
    const cells = smoothPath(g, findPath(g, start, goal));
    if (!cells) return null;
    h.path = cells.slice(1).map((c) => cellCenter(g, c.cx, c.cy));
    if (goal.dist === 0 && h.path.length) h.path[h.path.length - 1] = { x, y };
    return h.path.at(-1) ?? { x: h.x, y: h.y };
  }

  heroCan(mode, enemy) {
    return !(mode === 'melee' && enemy.flying);
  }

  updateHero(dt) {
    const h = this.hero;
    if (h.dead) {
      if (this.time >= h.respawnAt) {
        Object.assign(h, { ...this.respawnPoint, dead: false, hp: h.maxHp, lives: this.b.heroLives, invuln: this.b.hitInvulnerability });
        this.emit('heroRespawn');
      }
      return;
    }
    h.invuln = Math.max(0, h.invuln - dt);
    h.cooldown = Math.max(0, h.cooldown - dt);
    const stats = this.heroStats[h.mode];

    let target = h.target ? this.enemies.find((e) => e.id === h.target) : null;
    if (h.target && !target) h.target = null;
    if (target && !this.heroCan(h.mode, target)) {
      this.emit('cantHit', { id: target.id });
      h.target = null;
      target = null;
    }

    // idle hero defends itself: auto-target the nearest hittable enemy in range
    if (!target && !h.path.length) {
      let bd = Infinity;
      for (const e of this.enemies) {
        if (!this.heroCan(h.mode, e)) continue;
        const d = dist(h, e) - e.radius;
        if (d <= stats.range && d < bd) { bd = d; target = e; }
      }
    }

    if (target) {
      const d = dist(h, target) - target.radius;
      if (d <= stats.range) {
        if (h.target === target.id) h.path = [];
        if (target.x !== h.x) h.facing = target.x < h.x ? -1 : 1;
        if (h.cooldown === 0) {
          h.cooldown = stats.cooldown;
          if (h.mode === 'ranged') this.shoot(h, target, stats.damage, 'hero');
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

    // walk
    let step = this.heroStats.speed * dt;
    while (step > 0 && h.path.length) {
      const wp = h.path[0];
      const d = dist(h, wp);
      if (Math.abs(wp.x - h.x) > 0.5) h.facing = wp.x < h.x ? -1 : 1;
      if (d <= step) {
        h.x = wp.x; h.y = wp.y;
        h.path.shift();
        step -= d;
      } else {
        this.moveToward(h, wp, step);
        step = 0;
      }
    }
  }

  // ---------------- coins ----------------

  updateCoins() {
    const h = this.hero;
    const keep = [];
    for (const c of this.coinsOnGround) {
      if (this.time - c.born >= this.b.coinLifetime) {
        this.emit('coinExpired', { id: c.id });
        continue;
      }
      if (!h.dead && dist(h, c) <= this.b.coinPickupRadius) {
        this.coins++;
        this.emit('coinPicked', { id: c.id, x: c.x, y: c.y });
        continue;
      }
      keep.push(c);
    }
    this.coinsOnGround = keep;
  }

  /** Small snapshot for the HUD. */
  hud() {
    const next = this.waves.rounds[this.round];
    return {
      phase: this.phase,
      round: Math.min(this.round + 1, this.totalRounds),
      totalRounds: this.totalRounds,
      prepLeft: Math.max(0, this.prepLeft),
      earlyBonus: this.phase === 'prep' ? Math.floor(this.prepLeft * this.b.earlyBonusPerSecond) : 0,
      coins: this.coins,
      townHall: { hp: this.townHall.hp, maxHp: this.townHall.maxHp },
      hero: { hp: Math.max(0, this.hero.hp), maxHp: this.hero.maxHp, lives: this.hero.lives, dead: this.hero.dead, respawnIn: this.hero.dead ? Math.max(0, this.hero.respawnAt - this.time) : 0, mode: this.hero.mode },
      enemiesLeft: this.enemies.length + this.queue.length,
      nextRound: this.phase === 'prep' && next ? next : null,
    };
  }
}
