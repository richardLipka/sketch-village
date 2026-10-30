// The game simulation. Pure – no Phaser, no DOM – so it is unit-tested and
// the renderer only draws what is here.
// This file holds the core (setup, rounds, events, HUD snapshot); the rest is
// split by topic into world/: equipment, buildings, soldiers, enemies, combat,
// hero, coins – mixed into World at the bottom.
//
//   rounds:    prep (countdown, Ready = early bonus) → wave (spawn timeline) →
//              all spawned and all dead → reward → next prep … → won
//   enemies:   ground ones follow the flow field to the Town Hall, flying ones fly
//              straight; on the way they attack anything in range (hero, soldiers,
//              buildings, Town Hall); summoners (necromancer, spider queen...) call
//              minions now and then and when they die
//   hero:      walks on roads, melee / ranged / magic (player's choice; magic needs
//              a magic weapon), 5 lives; every lost life = 10 s absence, then back
//              at the Town Hall, which also heals it; auto-attacks what is in range
//   equipment: backpack + right hand (weapon → attack class), left hand (shield)
//              and body armor; two-handed weapons take both hands; changing
//              weapons takes 2 s; items from chests or the Town Hall shop
//   town hall: shoots arrows like a weak tower (stronger with each level)
//   coins:     drop on roads, must be picked up, vanish after 30 s
//   buildings: built/upgraded on the spots when the hero is near; what they do
//              comes from their features (FEATURE_BEHAVIOUR in world/buildings.js): workers
//              (faster building), arrows at the enemy nearest to the centre,
//              catapult stones on the biggest group, soldiers, coins, healing;
//              slow self-repair; destroyed
//              → ruin, rebuild at level 1. Town Hall level caps building levels
//              and hero upgrades.
//   lost:      Town Hall destroyed, or the hero lost all lives

import { DEFAULT_BUILDING_TYPES } from '../config/buildings.js';
import { hasFeature } from '../config/features.js';
import { DEFAULT_RULES } from '../config/rules.js';
import { DEFAULT_WEAPONS, WEAPON_CLASSES, normalizeItem, isWeapon } from '../config/weapons.js';
import { clampPoints, HERO_STATS, DEFAULT_HERO_POINTS } from '../config/heroStats.js';
import { worldToCell, cellCenter, nearestWalkable } from './pathGrid.js';
import { flowField } from './pathfinding.js';
import { expandRound, roundReward, roundCaves } from './waves.js';
import { dist, mulberry32 } from './world/shared.js';
import { difficultyOf } from '../config/difficulty.js';
import { Equipment } from './world/equipment.js';
import { Buildings } from './world/buildings.js';
import { Soldiers } from './world/soldiers.js';
import { Enemies } from './world/enemies.js';
import { Combat } from './world/combat.js';
import { Hero } from './world/hero.js';
import { Coins } from './world/coins.js';

export { mulberry32 };

const freshRoundStats = () => ({ defeated: 0, coins: 0, lost: 0, livesLost: 0 });

export class World {
  /**
   * @param {object} o
   * @param {object} o.map            map record (centre, spots, caves, heroRespawn)
   * @param {object} o.grid           walkability grid
   * @param {object[]} o.enemyTypes
   * @param {object} o.waves          { startCoins, firstPrep, prep, rounds }
   * @param {object} [o.heroPoints]   skill points { melee, ranged, armor, speed }
   * @param {object[]} [o.buildingTypes]
   * @param {object} [o.rules]        editable rules (config/rules.js)
   * @param {object} [o.balance]      overrides rules.balance
   * @param {number} [o.seed]
   */
  constructor({ map, grid, enemyTypes, waves, heroPoints = DEFAULT_HERO_POINTS, buildingTypes = DEFAULT_BUILDING_TYPES, rules = DEFAULT_RULES, balance = rules.balance, weapons = DEFAULT_WEAPONS, coinTypes = [{ value: 1, key: 'coin' }], seed = Date.now(), difficulty }) {
    // coin denominations ({ value, key = texture }), biggest first; drops are split into them
    this.coinTypes = [...coinTypes].filter((c) => c.value > 0).sort((a, b) => b.value - a.value);
    if (!this.coinTypes.length) this.coinTypes = [{ value: 1, key: 'coin' }];
    this.b = balance;
    this.cfg = rules.build;
    this.heroCosts = rules.heroUpgradeCosts;
    this.map = map;
    this.grid = grid;
    // difficulty (easy / normal / hard) scales the monsters' health and speed
    this.difficulty = difficultyOf(difficulty);
    this.types = Object.fromEntries(enemyTypes.map((t) => [t.id, { ...t, speed: t.speed * this.difficulty.enemySpeed, damage: t.damage * this.difficulty.enemyDamage }]));
    // building types: the `core` one is the Town Hall in the centre, the rest go on spots;
    // what a building does comes from its features (config/features.js)
    this.coreType = buildingTypes.find((t) => t.core) ?? DEFAULT_BUILDING_TYPES.find((t) => t.core);
    this.thLevels = this.coreType.levels;
    this.buildingTypes = Object.fromEntries(buildingTypes.filter((t) => !t.core).map((t) => [t.id, t]));
    // unlock rounds: hero upgrades from the rules, buildings from their levels
    this.unlockAt = Object.fromEntries((rules.unlocks ?? []).filter((u) => u.key.startsWith('hero:')).map((u) => [u.key, u.round]));
    for (const t of [this.coreType, ...Object.values(this.buildingTypes)]) {
      t.levels.forEach((l, i) => { if ((l.round ?? 1) > 1) this.unlockAt[`${t.id}:${i + 1}`] = l.round; });
    }
    this.waves = waves;
    this.rng = mulberry32(seed);
    this.nextId = 1;
    this.events = [];
    this.time = 0;

    const c = worldToCell(grid, map.centre.x, map.centre.y);
    this.centreCell = nearestWalkable(grid, c.cx, c.cy);
    this.flow = flowField(grid, this.centreCell);

    const thHp = this.thLevels[0].hp;
    this.townHall = {
      kind: 'townhall', id: -1, type: this.coreType.id, x: map.centre.x, y: map.centre.y, level: 1, hp: thHp, maxHp: thHp,
      radius: balance.townHallRadius, lastHit: -Infinity, upgrade: null, // { progress, time }
      cooldown: 0, // its arrows
    };

    this.caves = map.caves.map((cv) => ({ id: cv.id, x: cv.x, y: cv.y }));
    this.caveIds = this.caves.map((cv) => cv.id);
    this.spots = (map.spots ?? []).map((s, i) => ({ id: s.id, index: i, x: s.x, y: s.y }));

    this.heroRules = rules.hero;
    this.heroPoints = clampPoints(heroPoints, this.heroRules);
    this.heroUpgrades = Object.fromEntries(HERO_STATS.map((k) => [k, 0]));
    // equipment: backpack (`inventory`) + right hand, left hand (shield) and body armor
    this.weaponTypes = Object.fromEntries(weapons.map((w) => [w.id, normalizeItem(w)]));
    const starters = weapons.filter((w) => w.starter).map((w) => w.id);
    this.inventory = [...starters];
    this.equipped = { right: null, left: null, armor: null };
    this.preferred = {}; // last weapon used per class – what the attack buttons switch to
    this.chests = [];
    // the hero starts and always comes back at the Town Hall (next to it, on the road)
    this.respawnPoint = this.snapToRoad({ x: map.centre.x, y: map.centre.y + (map.centre.radius ?? 60) });
    this.hero = {
      kind: 'hero', ...this.respawnPoint, hp: 0, maxHp: 0, lives: balance.heroLives + this.difficulty.extraLives,
      mode: 'melee', path: [], target: null, cooldown: 0, invuln: 0, dead: false, respawnAt: 0, repath: 0, facing: 1,
      switching: 0, // s left while changing weapons (no attacks, no other change)
    };
    // start with the first starter weapon in hand (melee first)
    const first = starters.map((id) => this.weaponTypes[id]).filter(isWeapon).sort((a, b) => WEAPON_CLASSES.indexOf(a.kind) - WEAPON_CLASSES.indexOf(b.kind))[0];
    if (first) this.equipped.right = first.id;
    this.recalcHero();
    this.hero.hp = this.hero.maxHp = this.heroStats.hp;

    this.enemies = [];
    this.buildings = []; // one per used spot (incl. ruins)
    this.soldiers = [];
    this.projectiles = [];
    this.coinsOnGround = [];
    this.coins = Math.round((waves.startCoins ?? balance.startCoins) * this.difficulty.startCoins);
    // what happened since the last round ended – sent with `roundEnd` for the summary card
    this.roundStats = freshRoundStats();
    this.round = 0; // index of the next/current round
    this.phase = 'prep';
    this.prepLeft = waves.firstPrep ?? balance.firstPrep;
    this.queue = [];
    this.waveTime = 0;
  }

  get totalRounds() { return this.waves.rounds.length; }

  // ---------------- progression (config/unlocks.js) ----------------

  /** Round number (1-based) from which `key` can be bought; 1 when not scheduled. */
  unlockRound(key) { return this.unlockAt[key] ?? 1; }

  /** True once the current round (the one being prepared or fought) reaches the unlock. */
  unlocked(key) { return this.unlockRound(key) <= this.round + 1; }

  emit(type, data = {}) {
    const s = this.roundStats;
    if (s) {
      if (type === 'enemyDied') s.defeated++;
      else if (type === 'coinPicked') s.coins += data.value ?? 1;
      else if (type === 'buildingDestroyed') s.lost++;
      else if (type === 'heroLostLife') s.livesLost++;
    }
    this.events.push({ ...data, type });
  }
  drainEvents() { const e = this.events; this.events = []; return e; }

  snapToRoad(p) {
    const c = worldToCell(this.grid, p.x, p.y);
    const n = nearestWalkable(this.grid, c.cx, c.cy);
    return n ? cellCenter(this.grid, n.cx, n.cy) : { x: p.x, y: p.y };
  }

  // ---------------- player commands ----------------

  /**
   * Start the next wave now; returns the early bonus paid. The skipped prep time
   * still counts for construction: buildings and upgrades in progress advance by it.
   */
  callReady() {
    if (this.phase !== 'prep') return 0;
    const skipped = Math.max(0, this.prepLeft);
    const bonus = Math.floor(skipped * this.b.earlyBonusPerSecond);
    this.coins += bonus;
    if (bonus) this.emit('bonus', { amount: bonus });
    if (skipped > 0) {
      const work = skipped * this.buildSpeed;
      for (const b of this.buildings) if (b.state === 'building' || b.state === 'upgrading') b.progress += work;
      if (this.townHall.upgrade) this.townHall.upgrade.progress += work;
    }
    this.startWave();
    return bonus;
  }

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
    // the round's reward + what buildings with `income` earn
    let income = 0;
    for (const b of this.buildings) {
      const t = this.buildingTypes[b.type];
      if (b.level > 0 && b.state !== 'ruin' && hasFeature(t, 'income')) income += t.levels[b.level - 1].income ?? 0;
    }
    if (hasFeature(this.coreType, 'income')) income += this.thLevels[this.townHall.level - 1].income ?? 0;
    const reward = (this.waves.rounds[this.round].reward ?? roundReward(this.b, this.round)) + income;
    this.coins += reward;
    this.emit('roundEnd', { round: this.round + 1, reward, income, stats: { ...this.roundStats, waveTime: Math.round(this.waveTime) } });
    this.roundStats = freshRoundStats();
    this.round++;
    if (this.round >= this.totalRounds) {
      this.phase = 'won';
      this.emit('won');
    } else {
      this.phase = 'prep';
      // a round may set its own prep time (wave editor), otherwise the map's / rules'
      this.prepLeft = this.waves.rounds[this.round].prep ?? this.waves.prep ?? this.b.prep;
      const keys = Object.keys(this.unlockAt).filter((k) => this.unlockAt[k] === this.round + 1);
      if (keys.length) this.emit('unlocked', { keys });
    }
  }

  /**
   * Small snapshot for the HUD. Only values the player sees, already rounded,
   * so two snapshots in a row are usually equal and React needn't re-render.
   */
  hud() {
    const next = this.waves.rounds[this.round];
    const h = this.hero;
    return {
      phase: this.phase,
      lostBy: this.lostBy ?? null,
      round: Math.min(this.round + 1, this.totalRounds),
      totalRounds: this.totalRounds,
      prepLeft: Math.ceil(Math.max(0, this.prepLeft)),
      earlyBonus: this.phase === 'prep' ? Math.floor(this.prepLeft * this.b.earlyBonusPerSecond) : 0,
      coins: this.coins,
      workers: this.workers,
      townHall: { hp: Math.ceil(this.townHall.hp), maxHp: this.townHall.maxHp, level: this.townHall.level },
      hero: {
        hp: Math.max(0, Math.ceil(h.hp)), maxHp: h.maxHp, lives: h.lives, dead: h.dead,
        respawnIn: h.dead ? Math.ceil(Math.max(0, h.respawnAt - this.time)) : 0, mode: h.mode,
        switching: Math.ceil(h.switching * 10) / 10,
        // what the equipment adds up to, shown in the backpack
        attack: Math.round(this.heroStats[h.mode]?.damage ?? 0),
        reach: Math.round(this.heroStats[h.mode]?.range ?? 0),
        armor: Math.round(this.heroStats.armor * 100),
      },
      inventory: [...this.inventory],
      equipped: { ...this.equipped },
      enemiesLeft: this.enemies.length + this.queue.length,
      nextRound: this.phase === 'prep' && next ? next : null,
      nextCaves: this.phase === 'prep' && next ? roundCaves(next, this.caveIds) : null,
      caveCount: this.caveIds.length,
      // what became available for this round (shown while preparing it)
      newThings: this.phase === 'prep' ? Object.keys(this.unlockAt).filter((k) => this.unlockAt[k] === this.round + 1) : [],
    };
  }
}

// The World's methods live in parts by topic (src/logic/world/*.js); they are
// mixed into the class here, getters included, so callers see one World.
for (const part of [Equipment, Buildings, Soldiers, Enemies, Combat, Hero, Coins]) {
  for (const [key, d] of Object.entries(Object.getOwnPropertyDescriptors(part.prototype))) {
    if (key === 'constructor') continue;
    if (Object.prototype.hasOwnProperty.call(World.prototype, key)) throw new Error(`World.${key} is defined twice`);
    Object.defineProperty(World.prototype, key, d);
  }
}
