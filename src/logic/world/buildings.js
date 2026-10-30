// Buildings: what the UI asks (can I build / upgrade / sell?), the commands, and the
// simulation – self-repair, building progress, and the features (FEATURE_BEHAVIOUR).
// Methods of World (../world.js mixes them in); `this` is the World.

import { hasFeature } from '../../config/features.js';
import { HERO_STATS } from '../../config/heroStats.js';
import { worldToCell } from '../pathGrid.js';
import { dist, CATAPULT_MIN_RANGE } from './shared.js';

// What each building feature (config/features.js) does every frame for a ready
// building or the Town Hall. A new feature = its numbers in features.js + one
// line here. `workers` and `income` have no frame behaviour: they are counted
// in buildSpeed and endRound.
const FEATURE_BEHAVIOUR = {
  shoots: (w, b, s, dt) => { if (s.damage > 0 && s.range > 0) w.towerShoot(b, s, dt); },
  lobs: (w, b, s, dt) => { if (s.lobDamage > 0 && s.lobRange > 0) w.catapultShoot(b, s, dt); },
  soldiers: (w, b, s, dt) => w.castleSpawn(b, s, dt),
  healHero: (w, b, s, dt) => w.healHero(b, s, dt),
};

export class Buildings {
  get workers() {
    let n = 0;
    for (const b of this.buildings) {
      const t = this.buildingTypes[b.type];
      if (b.level > 0 && b.state !== 'ruin' && hasFeature(t, 'workers')) n += t.levels[b.level - 1].workers ?? 0;
    }
    if (hasFeature(this.coreType, 'workers')) n += this.thLevels[this.townHall.level - 1].workers ?? 0;
    return n;
  }

  get buildSpeed() { return 1 + this.cfg.workerSpeedup * this.workers; }

  buildingOn(spotId) { return this.buildings.find((b) => b.spotId === spotId) ?? null; }

  heroNear(p, extra = 0) {
    return !this.hero.dead && dist(this.hero, p) <= this.cfg.interactRadius + extra;
  }

  sellCheck(b) {
    if (this.hero.dead) return 'dead';
    if (!this.heroNear(b)) return 'far';
    return null;
  }

  /** Coins returned when selling: a share of everything spent on it (a ruin gives nothing). */
  refundOf(b) {
    return b.state === 'ruin' ? 0 : Math.floor(b.invested * this.cfg.sellRefund);
  }

  /** null when allowed, otherwise a reason key. */
  buildCheck(spot, typeId) {
    const t = this.buildingTypes[typeId];
    const b = this.buildingOn(spot.id);
    if (!t) return 'unknown';
    if (b && b.state !== 'ruin') return 'occupied';
    if (b && b.type !== typeId) return 'occupied'; // a ruin is rebuilt as what it was
    if (!this.unlocked(`${typeId}:1`)) return 'locked';
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
    if (!this.unlocked(`${b.type}:${b.level + 1}`)) return 'locked';
    if (b.level >= this.townHall.level) return 'townhall';
    if (this.hero.dead) return 'dead';
    if (!this.heroNear(b)) return 'far';
    if (this.coins < t.levels[b.level].cost) return 'coins';
    return null;
  }

  townHallUpgradeCheck() {
    const th = this.townHall;
    if (th.upgrade) return 'busy';
    if (th.level >= this.thLevels.length) return 'max';
    if (!this.unlocked(`${th.type}:${th.level + 1}`)) return 'locked';
    if (this.hero.dead) return 'dead';
    if (!this.heroNear(th, th.radius)) return 'far';
    if (this.coins < this.thLevels[th.level].cost) return 'coins';
    return null;
  }

  heroUpgradeCheck(stat) {
    const lvl = this.heroUpgrades[stat];
    if (lvl >= this.heroCosts.length) return 'max';
    if (!this.unlocked(`hero:${stat}:${lvl + 1}`)) return 'locked';
    if (lvl + 1 > this.townHall.level) return 'townhall';
    if (this.hero.dead) return 'dead';
    if (!this.heroNear(this.townHall, this.townHall.radius)) return 'far';
    if (this.coins < this.heroCosts[lvl]) return 'coins';
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
      out.sell = { refund: this.refundOf(b), reason: this.sellCheck(b) };
      if (b.state === 'ruin') {
        out.options.push({ type: b.type, cost: t.levels[0].cost, rebuild: true, reason: this.buildCheck(spot, b.type), round: this.unlockRound(`${b.type}:1`) });
      } else if (b.level < t.levels.length) {
        out.upgrade = { toLevel: b.level + 1, cost: t.levels[b.level].cost, reason: this.upgradeCheck(b), stats: t.levels[b.level], round: this.unlockRound(`${b.type}:${b.level + 1}`) };
      }
    } else {
      for (const t of Object.values(this.buildingTypes)) {
        out.options.push({ type: t.id, cost: t.levels[0].cost, stats: t.levels[0], reason: this.buildCheck(spot, t.id), round: this.unlockRound(`${t.id}:1`) });
      }
    }
    return out;
  }

  describeTownHall() {
    const th = this.townHall;
    const next = this.thLevels[th.level];
    return {
      kind: 'townhall', type: th.type, level: th.level, maxLevel: this.thLevels.length, hp: Math.ceil(th.hp), maxHp: th.maxHp,
      near: this.heroNear(th, th.radius), coins: this.coins,
      progress: th.upgrade ? th.upgrade.progress / th.upgrade.time : null,
      upgrade: next ? { toLevel: th.level + 1, cost: next.cost, hp: next.hp, reason: this.townHallUpgradeCheck(), stats: next, round: this.unlockRound(`${th.type}:${th.level + 1}`) } : null,
      stats: this.thLevels[th.level - 1],
      shop: Object.values(this.weaponTypes).filter((w) => w.shop).map((w) => ({
        id: w.id, kind: w.kind, price: w.price ?? 0, round: w.round ?? 1, reason: this.shopCheck(w.id),
      })),
      heroUpgrades: HERO_STATS.map((stat) => ({
        stat, level: this.heroUpgrades[stat], maxLevel: this.heroCosts.length,
        cost: this.heroCosts[this.heroUpgrades[stat]] ?? null, reason: this.heroUpgradeCheck(stat),
        round: this.unlockRound(`hero:${stat}:${this.heroUpgrades[stat] + 1}`),
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
      level: 0, state: 'building', progress: 0, buildTime: L1.time, invested: L1.cost,
      hp: L1.hp, maxHp: L1.hp, radius: this.cfg.buildingRadius, lastHit: -Infinity, cooldown: 0, spawnTimer: 0,
      variant: this.rng(), // which of the kids' drawings of this type the renderer shows (0..1)
    };
    this.buildings.push(b);
    this.emit('buildStart', { spotId, building: typeId, rebuild: !!old });
    return { ok: true };
  }

  /** Demolish a building (or clear a ruin) for a partial refund; the spot becomes free. */
  sell(spotId) {
    const b = this.buildingOn(spotId);
    if (!b) return { ok: false, reason: 'unknown' };
    const reason = this.sellCheck(b);
    if (reason) return { ok: false, reason };
    const refund = this.refundOf(b);
    this.coins += refund;
    this.buildings = this.buildings.filter((x) => x !== b);
    this.emit('sold', { spotId, building: b.type, refund, x: b.x, y: b.y });
    return { ok: true, refund };
  }

  upgrade(spotId) {
    const b = this.buildingOn(spotId);
    if (!b) return { ok: false, reason: 'unknown' };
    const reason = this.upgradeCheck(b);
    if (reason) return { ok: false, reason };
    const next = this.buildingTypes[b.type].levels[b.level];
    this.coins -= next.cost;
    b.invested += next.cost;
    Object.assign(b, { state: 'upgrading', progress: 0, buildTime: next.time });
    this.emit('upgradeStart', { spotId, toLevel: b.level + 1 });
    return { ok: true };
  }

  upgradeTownHall() {
    const reason = this.townHallUpgradeCheck();
    if (reason) return { ok: false, reason };
    const next = this.thLevels[this.townHall.level];
    this.coins -= next.cost;
    this.townHall.upgrade = { progress: 0, time: next.time };
    this.emit('upgradeStart', { townHall: true, toLevel: this.townHall.level + 1 });
    return { ok: true };
  }

  upgradeHero(stat) {
    const reason = this.heroUpgradeCheck(stat);
    if (reason) return { ok: false, reason };
    this.coins -= this.heroCosts[this.heroUpgrades[stat]];
    this.heroUpgrades[stat]++;
    this.recalcHero();
    this.emit('heroUpgraded', { stat, level: this.heroUpgrades[stat] });
    return { ok: true };
  }

  // ---------------- buildings: simulation ----------------

  regen(o, dt) {
    if (o.hp > 0 && o.hp < o.maxHp && this.time - o.lastHit >= this.cfg.regenDelay) {
      o.hp = Math.min(o.maxHp, o.hp + o.maxHp * this.cfg.regenPerSecond * dt);
    }
  }

  updateTownHall(dt) {
    const th = this.townHall;
    this.regen(th, dt);
    // the Town Hall's features work like a building's (arrows, healing the hero…)
    if (th.hp > 0) this.useFeatures(th, this.coreType, this.thLevels[th.level - 1], dt);
    if (th.upgrade) {
      th.upgrade.progress += dt * this.buildSpeed;
      if (th.upgrade.progress >= th.upgrade.time) {
        th.upgrade = null;
        const lvl = this.thLevels[th.level];
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
        this.emit(b.level === 1 ? 'built' : 'upgraded', { spotId: b.spotId, building: b.type, level: b.level });
      }
    }
    this.regen(b, dt);
    if (b.level === 0) return; // nothing works before level 1 is finished
    this.useFeatures(b, t, t.levels[b.level - 1], dt);
  }

  /** What a ready building (or the Town Hall) does every frame, by its features. */
  useFeatures(b, type, stats, dt) {
    for (const f of type.features ?? []) FEATURE_BEHAVIOUR[f]?.(this, b, stats, dt);
  }

  healHero(b, stats, dt) {
    const h = this.hero;
    if (!h.dead && h.hp < h.maxHp && dist(h, b) <= (stats.healRange ?? 80)) h.hp = Math.min(h.maxHp, h.hp + (stats.heal ?? 0) * dt);
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
    this.shoot(b, best, stats.damage, 'tower', stats.splash ?? 0, this.typeOf(b)?.projectile ?? null);
    this.emit('buildingAttack', { id: b.id });
  }

  /**
   * Catapult: a stone at the walking enemy in range with the most other walking
   * enemies around it (ties: the one nearest to the centre). The stone flies to
   * where the enemy stood and hurts every walking enemy where it lands.
   */
  catapultShoot(b, stats, dt) {
    b.lobCooldown = Math.max(0, (b.lobCooldown ?? 0) - dt);
    if (b.lobCooldown > 0) return;
    const inRange = this.enemies.filter((e) => !e.flying && dist(b, e) <= stats.lobRange && dist(b, e) >= CATAPULT_MIN_RANGE);
    if (!inRange.length) return;
    let best = null, bn = -1, bv = Infinity;
    for (const e of inRange) {
      let n = 0;
      for (const o of inRange) if (dist(e, o) <= stats.lobSplash) n++;
      const v = this.toCentre(e);
      if (n > bn || (n === bn && v < bv)) { best = e; bn = n; bv = v; }
    }
    b.lobCooldown = stats.lobCooldown;
    this.lob(b, { x: best.x, y: best.y }, stats.lobDamage, stats.lobSplash, this.typeOf(b)?.projectile ?? null);
    this.emit('buildingAttack', { id: b.id });
  }

  castleSpawn(b, stats, dt) {
    const mine = this.soldiers.filter((s) => s.castleId === b.id);
    if (mine.length >= (stats.soldierCount ?? 3)) return;
    b.spawnTimer -= dt;
    if (b.spawnTimer > 0) return;
    b.spawnTimer = stats.soldierRespawn;
    let slot = 0;
    while (mine.some((s) => s.slot === slot)) slot++;
    const door = this.snapToRoad(b);
    const a = slot * 2.1; // spread soldiers around the castle's door
    const home = { x: door.x + Math.cos(a) * 10 * Math.min(slot, 1.5), y: door.y + Math.sin(a) * 8 * Math.min(slot, 1.5) };
    const s = {
      id: this.nextId++, kind: 'soldier', castleId: b.id, slot, x: door.x, y: door.y, home,
      cooldown: 0, radius: this.cfg.soldier.radius, target: null, path: [], repath: 0, facing: 1, dead: false,
    };
    this.equipSoldier(s, b, stats);
    s.hp = s.maxHp;
    this.soldiers.push(s);
    this.emit('soldierSpawn', { castleId: b.id });
  }

  /** The building type of a building or the Town Hall. */
  typeOf(b) { return b === this.townHall || b.kind === 'townhall' ? this.coreType : this.buildingTypes[b.type]; }

  /**
   * A soldier as its castle's level makes it (SPEC §7): the numbers of that level
   * and who it is – the level's soldierKind: a drawn soldier, or an enemy fighting
   * on our side (soldier-sized; a shooting enemy shoots, with its projectile and
   * area damage). Called when it appears and again when the castle is upgraded,
   * so the soldiers already out there are upgraded too (their health in proportion).
   */
  equipSoldier(s, castle, stats = this.levelStats(castle)) {
    const enemy = stats.soldierKind ? this.types[stats.soldierKind] : null;
    const share = s.maxHp ? s.hp / s.maxHp : 1;
    Object.assign(s, {
      level: castle.level,
      look: stats.soldierKind ?? null,
      lookIsEnemy: !!enemy,
      maxHp: stats.soldierHp, damage: stats.soldierDamage, attackCooldown: stats.soldierCooldown,
      ranged: !!enemy?.ranged,
      range: enemy?.ranged ? Math.max(this.cfg.soldier.range, enemy.range ?? 0) : this.cfg.soldier.range,
      splash: enemy?.splash ?? 0,
      projectile: enemy?.projectile ?? null,
    });
    s.hp = Math.max(1, Math.round(stats.soldierHp * share));
  }

  /** The numbers of a building's (or the Town Hall's) current level. */
  levelStats(b) {
    if (b === this.townHall) return this.thLevels[b.level - 1] ?? {};
    return this.buildingTypes[b.type]?.levels[Math.max(0, b.level - 1)] ?? {};
  }
}
