// Every frame: the sprites follow the world – enemies, buildings, soldiers, projectiles, coins, the hero, the Town Hall, the selection.
// Methods of GameScene (../GameScene.js mixes them in); `this` is the scene.

import { hasFeature, buildingScale } from '../../config/features.js';
import { INK, BUILDING_SIZE, TOWN_HALL_SIZE, drawBar } from './draw.js';

export class Entities {
  sprite(id, create) {
    let s = this.sprites.get(id);
    if (!s) { s = create(); s.seen = true; this.sprites.set(id, s); }
    s.seen = true;
    return s;
  }

  syncEntities() {
    const w = this.world;
    for (const s of this.sprites.values()) s.seen = false;

    for (const e of w.enemies) {
      const type = w.types[e.type];
      const size = (type.boss ? 84 : 48) * (type.size ?? 1);
      const still = this.textures.exists(`enemy:${type.id}`) ? `enemy:${type.id}` : 'hero';
      const s = this.sprite(e.id, () => ({
        img: this.add.image(e.x, e.y, still).setDisplaySize(size, size).setOrigin(0.5, 0.75),
        bar: this.add.graphics().setDepth(9000),
        base: `enemy:${type.id}`, phase: Math.random() * 1000, // walkers don't step in sync
      }));
      const key = this.animKey(s, s.base, !e.attacking) ?? still;
      if (s.img.texture.key !== key) s.img.setTexture(key).setDisplaySize(size, size);
      const bob = e.flying ? Math.sin(this.time.now / 180 + e.id) * 4 - 18 : 0;
      s.img.setPosition(e.x, e.y + bob).setDepth(e.flying ? 8000 + e.y : e.y);
      if (e.facing) s.img.setFlipX(e.facing < 0);
      // without an attack animation the drawing shakes while it attacks
      const shake = e.attacking && !this.cfg.anims?.[s.base]?.attack;
      s.img.setAngle((shake ? Math.sin(this.time.now / 60) * 6 : 0) + this.jitter(e.id) * 3);
      this.bar(s.bar, e.x, e.y + bob - size * 0.75 - 6, 36, e.hp / e.maxHp, 0xdc2626);
    }

    for (const b of w.buildings) {
      // show the drawing of the level being built (or the current one), at least level 1
      const shownLevel = Math.max(1, b.state === 'building' || b.state === 'upgrading' ? b.level + 1 : b.level);
      const still = this.buildingKey(b.type, b.variant ?? 0, shownLevel);
      // buildings stand still (the wobble is for characters); 20 % bigger, +10 % per level
      const size = BUILDING_SIZE * buildingScale(shownLevel), k = size / BUILDING_SIZE;
      const s = this.sprite(`b${b.id}`, () => ({
        img: this.add.image(b.x, b.y, still).setDisplaySize(size, size).setOrigin(0.5, 0.6).setDepth(b.y),
        bar: this.add.graphics().setDepth(9000).setPosition(b.x, b.y),
      }));
      s.base = this.lookOf(still);
      const key = (b.state === 'ready' && this.animKey(s, s.base, false)) || still;
      if (s.img.texture.key !== key || s.size !== size) { s.img.setTexture(key).setDisplaySize(size, size); s.size = size; s.sig = null; }
      const busy = b.state === 'building' || b.state === 'upgrading';
      if (b.state === 'ruin') { s.img.setAlpha(0.4).setTint(0x9ca3af); } else {
        s.img.clearTint();
        s.img.setAlpha(b.state === 'building' ? 0.35 + 0.5 * (b.progress / b.buildTime) : 1);
      }
      // bars, scaffolding and the ruin cross are redrawn only when what they show changes
      const sig = `${b.state}|${busy ? Math.round((44 * b.progress) / b.buildTime) : ''}|${b.hp < b.maxHp ? Math.round((44 * b.hp) / b.maxHp) : ''}`;
      if (s.sig === sig) continue;
      s.sig = sig;
      const g = s.bar.clear();
      if (b.state === 'ruin') {
        g.lineStyle(3, 0x7f1d1d, 0.8).lineBetween(-22 * k, -30 * k, 22 * k, 10 * k).lineBetween(22 * k, -30 * k, -22 * k, 10 * k);
        continue;
      }
      if (busy) {
        drawBar(g, 0, 26 * k, 44, b.progress / b.buildTime, 0xca8a04);
        g.lineStyle(1.5, 0x78350f, 0.7).lineBetween(-24 * k, 20 * k, -24 * k, -30 * k).lineBetween(24 * k, 20 * k, 24 * k, -30 * k).lineBetween(-24 * k, -5 * k, 24 * k, -5 * k);
      }
      if (b.hp < b.maxHp) drawBar(g, 0, -44 * k, 44, b.hp / b.maxHp, 0x16a34a);
    }

    for (const so of w.soldiers) {
      // who the castle sends out: a drawn soldier, an enemy on our side (soldier-sized) or the default soldier
      const base = this.soldierBase(so);
      const s = this.sprite(`s${so.id}`, () => ({
        img: this.add.image(so.x, so.y, base).setDisplaySize(36, 36).setOrigin(0.5, 0.85),
        bar: this.add.graphics().setDepth(9000),
      }));
      s.base = base; // the kind can change when the castle is upgraded
      const soKey = this.animKey(s, base, so.path.length > 0) ?? base;
      if (s.img.texture.key !== soKey) s.img.setTexture(soKey).setDisplaySize(36, 36);
      s.img.setPosition(so.x, so.y).setDepth(so.y).setFlipX(so.facing < 0).setAngle(this.jitter(so.id) * 3);
      if (so.hp < so.maxHp) this.bar(s.bar, so.x, so.y - 38, 26, so.hp / so.maxHp, 0x2563eb);
      else s.bar.setVisible(false);
    }

    for (const p of w.projectiles) {
      // a projectile drawn in the studio when the shooter picked one, else arrow / spell / stone
      const drawn = p.look && this.textures.exists(`proj:${p.look}`) ? `proj:${p.look}` : null;
      const key = drawn ?? (p.owner === 'magic' ? 'magic' : p.owner === 'stone' ? 'stone' : 'projectile');
      const s = this.sprite(`p${p.id}`, () => ({ img: this.add.image(p.x, p.y, key).setDisplaySize(key === 'stone' ? 22 : 26, key === 'stone' ? 22 : 26).setDepth(9100) }));
      if (p.owner === 'stone') {
        // a thrown stone (or the catapult's own projectile) flies in an arc: highest half way
        const k = Math.min(1, Math.hypot(p.x - p.sx, p.y - p.sy) / p.total);
        s.img.setPosition(p.x, p.y - Math.sin(k * Math.PI) * Math.min(120, p.total * 0.45)).setRotation(this.time.now / 120);
      } else {
        s.img.setPosition(p.x, p.y).setRotation(key === 'magic' ? this.time.now / 100 : p.angle ?? 0);
      }
    }

    for (const c of w.chests) {
      const s = this.sprite(`k${c.id}`, () => ({ img: this.add.image(c.x, c.y, 'chest').setDisplaySize(34, 34).setDepth(c.y) }));
      const left = w.b.chestLifetime - (w.time - c.born);
      s.img.setAlpha(left < 5 ? (Math.floor(this.time.now / 150) % 2 ? 0.25 : 1) : 1).setAngle(Math.sin(this.time.now / 200 + c.id) * 5);
    }

    const now = w.time;
    for (const c of w.coinsOnGround) {
      const s = this.sprite(`c${c.id}`, () => {
        const key = this.textures.exists(c.key) ? c.key : 'coin';
        const size = 18 + Math.min(14, Math.log2(c.value ?? 1) * 4); // bigger coins are worth more
        return { img: this.add.image(c.x, c.y, key).setDisplaySize(size, size).setDepth(c.y - 1) };
      });
      const left = w.b.coinLifetime - (now - c.born);
      s.img.setAlpha(left < w.b.coinBlink ? (Math.floor(this.time.now / 150) % 2 ? 0.25 : 1) : 1);
    }

    for (const [id, s] of this.sprites) {
      if (s.seen) continue;
      s.img.destroy();
      s.bar?.destroy();
      this.sprites.delete(id);
    }

    // hero
    const h = w.hero;
    // a drawing for the current weapon class when the kids made one
    const heroStill = this.textures.exists(`hero:${h.mode}`) ? `hero:${h.mode}` : 'hero';
    const heroKey = this.animKey(this.heroAnim, 'hero', h.path.length > 0) ?? heroStill;
    if (this.hero.texture.key !== heroKey) this.hero.setTexture(heroKey).setDisplaySize(56, 56);
    this.hero.setVisible(!h.dead).setPosition(h.x, h.y).setDepth(h.y).setFlipX(h.facing < 0).setAngle(this.jitter(0.7) * 3);
    this.hero.setAlpha(h.invuln > 0 ? (Math.floor(this.time.now / 100) % 2 ? 0.35 : 1) : 1);
    if (h.dead) {
      this.heroBar.setVisible(false);
      this.rangeRing.setVisible(false);
    } else {
      this.bar(this.heroBar, h.x, h.y - 52, 40, h.hp / h.maxHp, h.switching > 0 ? 0x9ca3af : 0x16a34a);
      const r = w.heroStats[h.mode].range + w.b.enemyRadius;
      if (this.rangeRing.radius !== r) {
        this.rangeRing.radius = r;
        this.rangeRing.clear().lineStyle(1.5, INK, 0.25).strokeCircle(0, 0, r);
      }
      this.rangeRing.setPosition(h.x, h.y).setVisible(true);
    }

    // town hall
    const th = w.townHall;
    const thStill = this.buildingKey(th.type, this.townHallVariant, th.level);
    const thKey = (th.hp > 0 && this.animKey(this.townHallAnim, this.lookOf(thStill), false)) || thStill;
    const thSize = TOWN_HALL_SIZE * buildingScale(th.level), tk = thSize / TOWN_HALL_SIZE;
    if (this.townHall.texture.key !== thKey || this.townHall.size !== thSize) { this.townHall.setTexture(thKey).setDisplaySize(thSize, thSize); this.townHall.size = thSize; this.townHallBar.sig = null; }
    const thSig = `${Math.round((70 * th.hp) / th.maxHp)}|${th.upgrade ? Math.round((60 * th.upgrade.progress) / th.upgrade.time) : ''}`;
    if (this.townHallBar.sig !== thSig) {
      this.townHallBar.sig = thSig;
      this.townHallBar.clear();
      drawBar(this.townHallBar, th.x, th.y - 60 * tk, 70, th.hp / th.maxHp, 0x2563eb);
      if (th.upgrade) drawBar(this.townHallBar, th.x, th.y + 40 * tk, 60, th.upgrade.progress / th.upgrade.time, 0xca8a04);
      this.townHall.setAlpha(th.hp > 0 ? 1 : 0.35);
    }

    // selection highlight (+ the tower's / Town Hall's range); redrawn only when it changes
    const sel = this.selection;
    const p = sel && (sel.kind === 'townhall' ? th : w.spots.find((s) => s.id === sel.id));
    const b = sel?.kind === 'spot' && w.buildingOn(sel.id);
    const selSig = p ? `${sel.kind}|${sel.id}|${th.level}|${b ? `${b.type}${b.level}` : ''}` : '';
    if (this.selectRing.sig !== selSig) {
      this.selectRing.sig = selSig;
      const g = this.selectRing.clear();
      if (p) {
        g.lineStyle(3, 0xca8a04, 0.9).strokeCircle(p.x, p.y, sel.kind === 'townhall' ? 54 : 34);
        g.lineStyle(1.5, INK, 0.3).strokeCircle(p.x, p.y, 90 + (sel.kind === 'townhall' ? th.radius : 0));
        // the range of anything that shoots (towers, the Town Hall, new kinds)
        const type = sel.kind === 'townhall' ? w.coreType : b && w.buildingTypes[b.type];
        const stats = sel.kind === 'townhall' ? w.thLevels[th.level - 1] : b && b.level > 0 && type.levels[b.level - 1];
        if (hasFeature(type, 'shoots') && stats?.range) g.lineStyle(2, 0xdc2626, 0.5).strokeCircle(p.x, p.y, stats.range);
      }
    }
  }
}
