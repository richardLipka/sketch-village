// Damage to everything, deaths and lost lives, and projectiles (arrows, magic, stones).
// Methods of World (../world.js mixes them in); `this` is the World.

import { dist } from './shared.js';

export class Combat {
  damage(target, amount) {
    switch (target.kind) {
      case 'townhall': {
        target.hp = Math.max(0, target.hp - amount);
        target.lastHit = this.time;
        this.emit('hit', { kind: 'townhall', x: target.x, y: target.y, amount });
        if (target.hp === 0) {
          this.phase = 'lost';
          this.lostBy = 'townhall';
          this.emit('lost', { reason: 'townhall' });
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
          this.emit('buildingDestroyed', { spotId: target.spotId, building: target.type });
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
    // worth n in total, paid in the biggest coins that fit (smallest coin if none fits)
    let left = n;
    while (left > 0) {
      const c = this.coinTypes.find((ct) => ct.value <= left) ?? this.coinTypes.at(-1);
      left -= c.value;
      const a = this.rng() * Math.PI * 2, r = this.rng() * 8;
      this.coinsOnGround.push({ id: this.nextId++, x: spot.x + Math.cos(a) * r, y: spot.y + Math.sin(a) * r, born: this.time, value: c.value, key: c.key });
    }
    // sometimes a weapon chest (bosses always drop one)
    const type = this.types[e.type];
    if (Object.keys(this.weaponTypes).length && (type.boss || this.rng() < this.b.chestChance)) {
      this.chests.push({ id: this.nextId++, x: spot.x, y: spot.y, born: this.time });
      this.emit('chestDropped', { x: spot.x, y: spot.y });
    }
    if (this.hero.target === e.id) this.hero.target = null;
    // a spider queen leaves her young behind
    const kinds = this.minionsOf(e, type);
    if (kinds.length && type.minionOnDeath > 0) this.callMinions(e, kinds, type.minionOnDeath);
    this.emit('enemyDied', { id: e.id, enemy: e.type, x: e.x, y: e.y, coins: n });
  }

  /** Every lost life takes the hero away for a while (back at the Town Hall); the last one loses the game. */
  loseLife() {
    const h = this.hero;
    h.lives--;
    h.hp = 0;
    h.dead = true;
    h.path = [];
    h.target = null;
    h.guard = null;
    this.emit('heroLostLife', { lives: h.lives });
    if (h.lives <= 0) {
      this.phase = 'lost';
      this.lostBy = 'hero';
      this.emit('lost', { reason: 'hero' });
      return;
    }
    h.respawnAt = this.time + this.b.heroRespawnDelay;
    this.emit('heroDown', { respawnIn: this.b.heroRespawnDelay, lives: h.lives });
  }

  // ---------------- projectiles ----------------

  // owner: 'tower' (also the Town Hall), 'hero', 'magic' (hero spell), 'enemy',
  // 'stone' (catapult - flies to a spot on the ground, see lob)
  shoot(from, target, damage, owner, splash = 0) {
    this.projectiles.push({
      id: this.nextId++, owner, x: from.x, y: from.y - (owner === 'tower' ? 30 : 0),
      target, damage, splash, speed: this.b.projectileSpeed * (owner === 'magic' ? 0.7 : 1),
    });
  }

  /** A catapult stone: flies in an arc to a spot and hurts walking enemies around it. */
  lob(from, spot, damage, splash) {
    const target = { kind: 'ground', x: spot.x, y: spot.y };
    this.projectiles.push({
      id: this.nextId++, owner: 'stone', x: from.x, y: from.y - 20, sx: from.x, sy: from.y - 20,
      total: Math.max(1, dist(from, spot)), target, damage, splash, groundOnly: true, speed: this.b.projectileSpeed * 0.55,
    });
    this.emit('lob', { x: from.x, y: from.y });
  }

  targetGone(t) {
    switch (t.kind) {
      case 'hero': return this.hero.dead;
      case 'townhall': return t.hp <= 0;
      case 'building': return t.state === 'ruin';
      case 'soldier': return t.dead;
      case 'ground': return false;
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
        if (p.splash > 0) {
          // a spell hurts every enemy around the target, flying ones too; a stone only walking ones
          for (const e of [...this.enemies]) {
            if (p.groundOnly && e.flying) continue;
            if (dist(e, t) <= p.splash + e.radius) this.damageEnemy(e, p.damage);
          }
          this.emit('splash', { x: t.x, y: t.y, radius: p.splash, owner: p.owner });
        } else {
          this.damage(t, p.damage);
        }
      } else {
        const a = Math.atan2(t.y - p.y, t.x - p.x);
        p.x += Math.cos(a) * step;
        p.y += Math.sin(a) * step;
        p.angle = a;
      }
    }
    this.projectiles = this.projectiles.filter((p) => !p.done);
  }
}
