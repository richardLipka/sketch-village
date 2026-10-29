// The game simulation. Pure – no Phaser, no DOM – so it is unit-tested and
// the renderer only draws what is here.
//
//   rounds:    prep (countdown, Ready = early bonus) → wave (spawn timeline) →
//              all spawned and all dead → reward → next prep … → won
//   enemies:   ground ones follow the flow field to the Town Hall, flying ones fly
//              straight; on the way they attack anything in range (hero, soldiers,
//              buildings, Town Hall)
//   hero:      walks on roads, melee or ranged (player's choice), 5 lives,
//              30 s absence after the last one, auto-attacks what is in range
//   coins:     drop on roads, must be picked up, vanish after 30 s
//   buildings: built/upgraded on the 10 spots when the hero is near; houses give
//              workers (faster building), towers shoot the enemy nearest to the
//              centre, castles send up to 3 soldiers; slow self-repair; destroyed
//              → ruin, rebuild at level 1. Town Hall level caps building levels
//              and hero upgrades.
//   lost:      Town Hall destroyed

import { BALANCE } from '../config/balance.js';
import { BUILD, TOWN_HALL_LEVELS, HERO_UPGRADE_COSTS, DEFAULT_BUILDING_TYPES } from '../config/buildings.js';
import { heroNumbers, HERO_STATS, DEFAULT_HERO_POINTS } from '../config/heroStats.js';
import { worldToCell, cellCenter, nearestWalkable, isWalkable } from './pathGrid.js';
import { findPath, smoothPath, flowField } from './pathfinding.js';
import { expandRound, roundReward, hpScale } from './waves.js';

const REPATH_EVERY = 0.4;
const SEPARATION = 10; // px sideways offset range for ground enemies, so groups don't stack
const HERO_GUARD_RADIUS = 130; // an idle hero engages enemies this close to where it stands

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
   * @param {object} o.map            map record (centre, spots, caves, heroRespawn)
   * @param {object} o.grid           walkability grid
   * @param {object[]} o.enemyTypes
   * @param {object} o.waves          { startCoins, firstPrep, prep, rounds }
   * @param {object} [o.heroPoints]   skill points { melee, ranged, armor, speed }
   * @param {object[]} [o.buildingTypes]
   * @param {object} [o.balance]
   * @param {number} [o.seed]
   */
  constructor({ map, grid, enemyTypes, waves, heroPoints = DEFAULT_HERO_POINTS, buildingTypes = DEFAULT_BUILDING_TYPES, balance = BALANCE, seed = Date.now() }) {
    this.b = balance;
    this.map = map;
    this.grid = grid;
    this.types = Object.fromEntries(enemyTypes.map((t) => [t.id, t]));
    this.buildingTypes = Object.fromEntries(buildingTypes.map((t) => [t.id, t]));
    this.waves = waves;
    this.rng = mulberry32(seed);
    this.nextId = 1;
    this.events = [];
    this.time = 0;

    const c = worldToCell(grid, map.centre.x, map.centre.y);
    this.centreCell = nearestWalkable(grid, c.cx, c.cy);
    this.flow = flowField(grid, this.centreCell);

    const thHp = TOWN_HALL_LEVELS[0].hp;
    this.townHall = {
      kind: 'townhall', x: map.centre.x, y: map.centre.y, level: 1, hp: thHp, maxHp: thHp,
      radius: balance.townHallRadius, lastHit: -Infinity, upgrade: null, // { progress, time }
    };

    this.caves = map.caves.map((cv) => ({ id: cv.id, x: cv.x, y: cv.y }));
    this.caveIds = this.caves.map((cv) => cv.id);
    this.spots = (map.spots ?? []).map((s, i) => ({ id: s.id, index: i, x: s.x, y: s.y }));

    this.heroPoints = heroPoints;
    this.heroUpgrades = Object.fromEntries(HERO_STATS.map((k) => [k, 0]));
    this.heroStats = heroNumbers(heroPoints);
    this.respawnPoint = this.snapToRoad(map.heroRespawn ?? { x: map.centre.x, y: map.centre.y + (map.centre.radius ?? 60) });
    this.hero = {
      kind: 'hero', ...this.respawnPoint, hp: this.heroStats.hp, maxHp: this.heroStats.hp, lives: balance.heroLives,
      mode: 'melee', path: [], target: null, cooldown: 0, invuln: 0, dead: false, respawnAt: 0, repath: 0, facing: 1,
    };

    this.enemies = [];
    this.buildings = []; // one per used spot (incl. ruins)
    this.soldiers = [];
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
    this.hero.guard = null; // a player order replaces guarding
    return this.pathHeroTo(x, y);
  }

  attack(enemyId) {
    if (this.hero.dead) return;
    const e = this.enemies.find((x) => x.id === enemyId);
    if (!e) return;
    this.hero.guard = null;
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

  spotAt(x, y, radius = 30) {
    return this.spots.find((s) => Math.abs(s.x - x) <= radius && Math.abs(s.y - y) <= radius) ?? null;
  }

  isTownHallAt(x, y) {
    return dist(this.townHall, { x, y }) <= this.townHall.radius + 10;
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
    this.updateTownHall(dt);
    for (const b of this.buildings) this.updateBuilding(b, dt);
    for (const s of this.soldiers) this.updateSoldier(s, dt);
    this.soldiers = this.soldiers.filter((s) => !s.dead);
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

  // ---------------- buildings: info for the UI ----------------

  get workers() {
    let n = 0;
    for (const b of this.buildings) {
      if (b.type === 'house' && b.level > 0 && b.state !== 'ruin') n += this.buildingTypes.house.levels[b.level - 1].workers ?? 0;
    }
    return n;
  }

  get buildSpeed() { return 1 + BUILD.workerSpeedup * this.workers; }

  buildingOn(spotId) { return this.buildings.find((b) => b.spotId === spotId) ?? null; }

  heroNear(p, extra = 0) {
    return !this.hero.dead && dist(this.hero, p) <= BUILD.interactRadius + extra;
  }

  /** null when allowed, otherwise a reason key. */
  buildCheck(spot, typeId) {
    const t = this.buildingTypes[typeId];
    const b = this.buildingOn(spot.id);
    if (!t) return 'unknown';
    if (b && b.state !== 'ruin') return 'occupied';
    if (b && b.type !== typeId) return 'occupied'; // a ruin is rebuilt as what it was
    if (this.hero.dead) return 'dead';
    if (!this.heroNear(spot)) return 'far';
    if (this.coins < t.levels[0].cost) return 'coins';
    return null;
  }

  upgradeCheck(b) {
    const t = this.buildingTypes[b.type];
    if (b.state === 'ruin') return 'ruin';
    if (b.state !== 'ready') return 'busy';
    if (b.level >= t.levels.length) return 'max';
    if (b.level >= this.townHall.level) return 'townhall';
    if (this.hero.dead) return 'dead';
    if (!this.heroNear(b)) return 'far';
    if (this.coins < t.levels[b.level].cost) return 'coins';
    return null;
  }

  townHallUpgradeCheck() {
    const th = this.townHall;
    if (th.upgrade) return 'busy';
    if (th.level >= TOWN_HALL_LEVELS.length) return 'max';
    if (this.hero.dead) return 'dead';
    if (!this.heroNear(th, th.radius)) return 'far';
    if (this.coins < TOWN_HALL_LEVELS[th.level].cost) return 'coins';
    return null;
  }

  heroUpgradeCheck(stat) {
    const lvl = this.heroUpgrades[stat];
    if (lvl >= HERO_UPGRADE_COSTS.length) return 'max';
    if (lvl + 1 > this.townHall.level) return 'townhall';
    if (this.hero.dead) return 'dead';
    if (!this.heroNear(this.townHall, this.townHall.radius)) return 'far';
    if (this.coins < HERO_UPGRADE_COSTS[lvl]) return 'coins';
    return null;
  }

  /** Everything the build panel needs for one spot. */
  describeSpot(spotId) {
    const spot = this.spots.find((s) => s.id === spotId);
    if (!spot) return null;
    const b = this.buildingOn(spotId);
    const out = { kind: 'spot', id: spotId, index: spot.index, near: this.heroNear(spot), building: null, options: [], upgrade: null };
    if (b) {
      const t = this.buildingTypes[b.type];
      out.building = {
        type: b.type, level: b.level, maxLevel: t.levels.length, state: b.state,
        hp: Math.ceil(b.hp), maxHp: b.maxHp, progress: b.state === 'building' || b.state === 'upgrading' ? b.progress / b.buildTime : null,
        stats: b.level ? t.levels[b.level - 1] : null,
      };
      if (b.state === 'ruin') {
        out.options.push({ type: b.type, cost: t.levels[0].cost, rebuild: true, reason: this.buildCheck(spot, b.type) });
      } else if (b.level < t.levels.length) {
        out.upgrade = { toLevel: b.level + 1, cost: t.levels[b.level].cost, reason: this.upgradeCheck(b), stats: t.levels[b.level] };
      }
    } else {
      for (const t of Object.values(this.buildingTypes)) {
        out.options.push({ type: t.id, cost: t.levels[0].cost, stats: t.levels[0], reason: this.buildCheck(spot, t.id) });
      }
    }
    return out;
  }

  describeTownHall() {
    const th = this.townHall;
    const next = TOWN_HALL_LEVELS[th.level];
    return {
      kind: 'townhall', level: th.level, maxLevel: TOWN_HALL_LEVELS.length, hp: Math.ceil(th.hp), maxHp: th.maxHp,
      near: this.heroNear(th, th.radius),
      progress: th.upgrade ? th.upgrade.progress / th.upgrade.time : null,
      upgrade: next ? { toLevel: th.level + 1, cost: next.cost, hp: next.hp, reason: this.townHallUpgradeCheck() } : null,
      heroUpgrades: HERO_STATS.map((stat) => ({
        stat, level: this.heroUpgrades[stat], maxLevel: HERO_UPGRADE_COSTS.length,
        cost: HERO_UPGRADE_COSTS[this.heroUpgrades[stat]] ?? null, reason: this.heroUpgradeCheck(stat),
      })),
    };
  }

  // ---------------- buildings: commands ----------------

  build(spotId, typeId) {
    const spot = this.spots.find((s) => s.id === spotId);
    if (!spot) return { ok: false, reason: 'unknown' };
    const reason = this.buildCheck(spot, typeId);
    if (reason) return { ok: false, reason };
    const t = this.buildingTypes[typeId];
    const L1 = t.levels[0];
    this.coins -= L1.cost;
    const old = this.buildingOn(spotId);
    if (old) this.buildings = this.buildings.filter((b) => b !== old);
    const b = {
      id: this.nextId++, kind: 'building', type: typeId, spotId, x: spot.x, y: spot.y,
      level: 0, state: 'building', progress: 0, buildTime: L1.time,
      hp: L1.hp, maxHp: L1.hp, radius: BUILD.buildingRadius, lastHit: -Infinity, cooldown: 0, spawnTimer: 0,
    };
    this.buildings.push(b);
    this.emit('buildStart', { spotId, type: typeId, rebuild: !!old });
    return { ok: true };
  }

  upgrade(spotId) {
    const b = this.buildingOn(spotId);
    if (!b) return { ok: false, reason: 'unknown' };
    const reason = this.upgradeCheck(b);
    if (reason) return { ok: false, reason };
    const next = this.buildingTypes[b.type].levels[b.level];
    this.coins -= next.cost;
    Object.assign(b, { state: 'upgrading', progress: 0, buildTime: next.time });
    this.emit('upgradeStart', { spotId, toLevel: b.level + 1 });
    return { ok: true };
  }

  upgradeTownHall() {
    const reason = this.townHallUpgradeCheck();
    if (reason) return { ok: false, reason };
    const next = TOWN_HALL_LEVELS[this.townHall.level];
    this.coins -= next.cost;
    this.townHall.upgrade = { progress: 0, time: next.time };
    this.emit('upgradeStart', { townHall: true, toLevel: this.townHall.level + 1 });
    return { ok: true };
  }

  upgradeHero(stat) {
    const reason = this.heroUpgradeCheck(stat);
    if (reason) return { ok: false, reason };
    this.coins -= HERO_UPGRADE_COSTS[this.heroUpgrades[stat]];
    this.heroUpgrades[stat]++;
    this.heroStats = heroNumbers(this.heroPoints, this.heroUpgrades);
    this.emit('heroUpgraded', { stat, level: this.heroUpgrades[stat] });
    return { ok: true };
  }

  // ---------------- buildings: simulation ----------------

  regen(o, dt) {
    if (o.hp > 0 && o.hp < o.maxHp && this.time - o.lastHit >= BUILD.regenDelay) {
      o.hp = Math.min(o.maxHp, o.hp + o.maxHp * BUILD.regenPerSecond * dt);
    }
  }

  updateTownHall(dt) {
    const th = this.townHall;
    this.regen(th, dt);
    if (th.upgrade) {
      th.upgrade.progress += dt * this.buildSpeed;
      if (th.upgrade.progress >= th.upgrade.time) {
        th.upgrade = null;
        const lvl = TOWN_HALL_LEVELS[th.level];
        th.level++;
        th.hp += lvl.hp - th.maxHp;
        th.maxHp = lvl.hp;
        this.emit('upgraded', { townHall: true, level: th.level });
      }
    }
  }

  updateBuilding(b, dt) {
    if (b.state === 'ruin') return;
    const t = this.buildingTypes[b.type];
    if (b.state === 'building' || b.state === 'upgrading') {
      b.progress += dt * this.buildSpeed;
      if (b.progress >= b.buildTime) {
        const lvl = t.levels[b.level];
        b.level++;
        b.hp = b.state === 'building' ? lvl.hp : b.hp + (lvl.hp - b.maxHp);
        b.maxHp = lvl.hp;
        b.state = 'ready';
        this.emit(b.level === 1 ? 'built' : 'upgraded', { spotId: b.spotId, type: b.type, level: b.level });
      }
    }
    this.regen(b, dt);
    if (b.level === 0) return; // nothing works before level 1 is finished
    const stats = t.levels[b.level - 1];
    if (b.type === 'tower') this.towerShoot(b, stats, dt);
    if (b.type === 'castle') this.castleSpawn(b, stats, dt);
  }

  // distance along the road (ground) or straight (flying) to the Town Hall
  toCentre(e) {
    if (e.flying) return dist(e, this.townHall);
    const { cx, cy } = worldToCell(this.grid, e.x, e.y);
    const v = this.flow[cy * this.grid.cols + cx];
    return v === Infinity ? dist(e, this.townHall) : v * this.grid.cell;
  }

  towerShoot(b, stats, dt) {
    b.cooldown = Math.max(0, b.cooldown - dt);
    if (b.cooldown > 0) return;
    let best = null, bv = Infinity;
    for (const e of this.enemies) {
      if (dist(b, e) - e.radius > stats.range) continue;
      const v = this.toCentre(e);
      if (v < bv) { bv = v; best = e; }
    }
    if (!best) return;
    b.cooldown = stats.cooldown;
    this.shoot(b, best, stats.damage, 'tower');
  }

  castleSpawn(b, stats, dt) {
    const mine = this.soldiers.filter((s) => s.castleId === b.id);
    if (mine.length >= BUILD.soldier.max) return;
    b.spawnTimer -= dt;
    if (b.spawnTimer > 0) return;
    b.spawnTimer = stats.soldierRespawn;
    const slot = [0, 1, 2].find((k) => !mine.some((s) => s.slot === k)) ?? 0;
    const door = this.snapToRoad(b);
    const home = { x: door.x + (slot - 1) * 10, y: door.y + (slot === 1 ? -6 : 6) };
    this.soldiers.push({
      id: this.nextId++, kind: 'soldier', castleId: b.id, slot, x: door.x, y: door.y, home,
      hp: stats.soldierHp, maxHp: stats.soldierHp, damage: stats.soldierDamage, attackCooldown: stats.soldierCooldown,
      cooldown: 0, radius: BUILD.soldier.radius, target: null, path: [], repath: 0, facing: 1, dead: false,
    });
    this.emit('soldierSpawn', { castleId: b.id });
  }

  updateSoldier(s, dt) {
    const castle = this.buildings.find((b) => b.id === s.castleId);
    if (!castle || castle.state === 'ruin') { s.dead = true; return; }
    s.cooldown = Math.max(0, s.cooldown - dt);
    const cfg = BUILD.soldier;

    // keep the current target while it is alive and not too far from home
    let target = s.target ? this.enemies.find((e) => e.id === s.target && !e.flying) : null;
    if (target && dist(target, s.home) > cfg.aggro * 1.5) target = null;
    if (!target) {
      let bd = Infinity;
      for (const e of this.enemies) {
        if (e.flying) continue;
        const d = dist(e, s.home);
        if (d <= cfg.aggro && d < bd) { bd = d; target = e; }
      }
    }
    s.target = target?.id ?? null;

    if (target) {
      if (dist(s, target) - target.radius <= cfg.range) {
        s.path = [];
        s.facing = target.x < s.x ? -1 : 1;
        if (s.cooldown === 0) {
          s.cooldown = s.attackCooldown;
          this.damageEnemy(target, s.damage);
        }
        return;
      }
      s.repath -= dt;
      if (s.repath <= 0 || !s.path.length) {
        s.path = this.pathBetween(s, target) ?? [];
        s.repath = REPATH_EVERY;
      }
    } else if (dist(s, s.home) > 3 && !s.path.length) {
      s.path = this.pathBetween(s, s.home) ?? [];
      if (s.path.length) s.path[s.path.length - 1] = { ...s.home };
    }
    this.walk(s, cfg.speed * dt);
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
    switch (target.kind) {
      case 'townhall': {
        target.hp = Math.max(0, target.hp - amount);
        target.lastHit = this.time;
        this.emit('hit', { kind: 'townhall', x: target.x, y: target.y, amount });
        if (target.hp === 0) {
          this.phase = 'lost';
          this.emit('lost');
        }
        return;
      }
      case 'hero': {
        const h = this.hero;
        if (h.dead || h.invuln > 0) return;
        const real = Math.max(1, Math.round(amount * (1 - this.heroStats.armor)));
        h.hp -= real;
        this.emit('hit', { kind: 'hero', x: h.x, y: h.y, amount: real });
        if (h.hp <= 0) this.loseLife();
        return;
      }
      case 'building': {
        if (target.state === 'ruin') return;
        target.hp = Math.max(0, target.hp - amount);
        target.lastHit = this.time;
        this.emit('hit', { kind: 'building', x: target.x, y: target.y, amount });
        if (target.hp === 0) {
          Object.assign(target, { state: 'ruin', level: 0, progress: 0 });
          this.emit('buildingDestroyed', { spotId: target.spotId, type: target.type });
        }
        return;
      }
      case 'soldier': {
        if (target.dead) return;
        target.hp -= amount;
        this.emit('hit', { kind: 'soldier', x: target.x, y: target.y, amount });
        if (target.hp <= 0) target.dead = true;
        return;
      }
      case 'enemy':
        this.damageEnemy(target, amount);
    }
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
      id: this.nextId++, owner, x: from.x, y: from.y - (owner === 'tower' ? 30 : 0),
      target, damage, speed: this.b.projectileSpeed,
    });
  }

  targetGone(t) {
    switch (t.kind) {
      case 'hero': return this.hero.dead;
      case 'townhall': return t.hp <= 0;
      case 'building': return t.state === 'ruin';
      case 'soldier': return t.dead;
      default: return t.dead || !this.enemies.includes(t);
    }
  }

  updateProjectiles(dt) {
    for (const p of this.projectiles) {
      const t = p.target;
      if (this.targetGone(t)) { p.done = true; continue; }
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

  // ---------------- walking on roads ----------------

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

    this.walk(h, this.heroStats.speed * dt);
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
      workers: this.workers,
      townHall: { hp: Math.ceil(this.townHall.hp), maxHp: this.townHall.maxHp, level: this.townHall.level },
      hero: { hp: Math.max(0, this.hero.hp), maxHp: this.hero.maxHp, lives: this.hero.lives, dead: this.hero.dead, respawnIn: this.hero.dead ? Math.max(0, this.hero.respawnAt - this.time) : 0, mode: this.hero.mode },
      enemiesLeft: this.enemies.length + this.queue.length,
      nextRound: this.phase === 'prep' && next ? next : null,
    };
  }
}
