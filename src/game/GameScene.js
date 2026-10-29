import Phaser from 'phaser';

// Draws the World simulation (src/logic/world.js) and forwards clicks to it.
// Camera: zoom (wheel, pinch, buttons) and drag-pan, clamped to the map.

const INK = 0x1e3a8a;
const CLICK_SLOP = 8; // px of pointer movement still counted as a click
const MIN_ZOOM = 1;
const MAX_ZOOM = 3;
const MAX_DT = 0.05; // s – avoid huge jumps after a tab switch
const HUD_EVERY = 150; // ms

const hexNum = (hex) => parseInt(hex.replace('#', ''), 16);

export default class GameScene extends Phaser.Scene {
  constructor() {
    super('game');
  }

  /**
   * data: { world, map, images: { background, hero?, townhall?, cave?, coin?, projectile?,
   *         'enemy:<typeId>'?, [decorAssetId]? }, enemyTypes, onHud(state), onEvent(e) }
   */
  init(data) {
    this.cfg = data;
    this.world = data.world;
    this.sprites = new Map(); // world entity id → { img, bar }
    this.speed = 1;
    this.paused = false;
    this.hudTimer = 0;
  }

  create() {
    const { map, images } = this.cfg;
    const { width: W, height: H } = map.world;

    for (const [key, img] of Object.entries(images)) {
      if (!img || this.textures.exists(key)) continue;
      if (img instanceof HTMLCanvasElement) this.textures.addCanvas(key, img);
      else this.textures.addImage(key, img);
    }
    this.makePlaceholders();

    this.add.image(0, 0, 'background').setOrigin(0).setDepth(-1000);

    for (const d of map.decorations) {
      if (!this.textures.exists(d.asset)) continue;
      const s = 64 * (d.scale ?? 1);
      this.add.image(d.x, d.y, d.asset).setDisplaySize(s, s).setDepth(d.y);
    }

    for (const [i, s] of map.spots.entries()) {
      const g = this.add.graphics().setDepth(-500);
      g.lineStyle(2, INK, 0.5);
      dashedRect(g, s.x - 26, s.y - 26, 52, 52, 6);
      this.add.text(s.x, s.y, String(i + 1), { fontFamily: 'Patrick Hand', fontSize: '18px', color: '#1e3a8a' }).setOrigin(0.5).setAlpha(0.45).setDepth(-500);
    }

    for (const c of map.caves) this.add.image(c.x, c.y, 'cave').setDisplaySize(64, 64).setDepth(c.y);

    const th = this.world.townHall;
    this.townHall = this.add.image(th.x, th.y, 'townhall:1').setDisplaySize(96, 96).setDepth(th.y);
    this.townHallBar = this.add.graphics().setDepth(9000);
    this.selectRing = this.add.graphics().setDepth(-300);
    this.selection = null;

    const h = this.world.hero;
    this.hero = this.add.image(h.x, h.y, 'hero').setDisplaySize(56, 56).setOrigin(0.5, 0.8).setDepth(h.y);
    this.heroBar = this.add.graphics().setDepth(9000);
    this.rangeRing = this.add.graphics().setDepth(-400);

    this.marker = this.add.text(0, 0, '✕', { fontFamily: 'Patrick Hand', fontSize: '28px', color: '#b91c1c' }).setOrigin(0.5).setVisible(false).setDepth(10000);

    const cam = this.cameras.main;
    cam.setBounds(0, 0, W, H);
    cam.setZoom(MIN_ZOOM);
    cam.centerOn(W / 2, H / 2);
    this.setupInput();
  }

  // ---------------- textures ----------------

  // Simple sketchy textures for anything the kids haven't drawn yet.
  makePlaceholders() {
    const g = this.make.graphics({ x: 0, y: 0 }, false);
    const tex = (key, size, draw) => {
      if (this.textures.exists(key)) return;
      g.clear();
      draw(g);
      g.generateTexture(key, size, size);
    };
    tex('hero', 64, (g) => {
      g.fillStyle(0xfde68a).fillCircle(32, 22, 16);
      g.lineStyle(3, INK).strokeCircle(32, 22, 16);
      g.lineBetween(32, 38, 32, 54).lineBetween(32, 44, 18, 36).lineBetween(32, 44, 46, 36);
      g.lineBetween(32, 54, 22, 63).lineBetween(32, 54, 42, 63);
      g.fillStyle(INK).fillCircle(26, 20, 2).fillCircle(38, 20, 2);
    });
    // level marks: 1–3 little stars drawn as crosses on the roof
    const stars = (g, n, cx, y) => {
      for (let i = 0; i < n; i++) {
        const x = cx + (i - (n - 1) / 2) * 12;
        g.lineStyle(2, 0xca8a04).lineBetween(x - 4, y, x + 4, y).lineBetween(x, y - 4, x, y + 4);
      }
    };
    for (let lvl = 1; lvl <= 3; lvl++) {
      tex(`townhall:${lvl}`, 96, (g) => {
        g.fillStyle(0xfffdf7).fillRect(14, 40, 68, 48);
        g.lineStyle(3, INK).strokeRect(14, 40, 68, 48);
        g.fillStyle(0xfecaca).fillTriangle(6, 42, 48, 8, 90, 42);
        g.lineStyle(3, INK).strokeTriangle(6, 42, 48, 8, 90, 42);
        g.strokeRect(40, 60, 16, 28);
        stars(g, lvl, 48, 30);
      });
      tex(`house:${lvl}`, 64, (g) => {
        g.fillStyle(0xfffdf7).fillRect(12, 30, 40, 30);
        g.lineStyle(3, INK).strokeRect(12, 30, 40, 30);
        g.fillStyle(0xfde68a).fillTriangle(6, 32, 32, 8, 58, 32);
        g.lineStyle(3, INK).strokeTriangle(6, 32, 32, 8, 58, 32);
        g.strokeRect(27, 42, 10, 18);
        stars(g, lvl, 32, 24);
      });
      tex(`tower:${lvl}`, 64, (g) => {
        g.fillStyle(0xe5e7eb).fillRect(20, 16, 24, 46);
        g.lineStyle(3, INK).strokeRect(20, 16, 24, 46);
        for (const x of [18, 28, 38]) g.fillStyle(0xe5e7eb).fillRect(x, 8, 8, 9).lineStyle(2, INK).strokeRect(x, 8, 8, 9);
        g.lineStyle(2, INK).strokeRect(29, 26, 6, 10);
        stars(g, lvl, 32, 48);
      });
      tex(`castle:${lvl}`, 64, (g) => {
        g.fillStyle(0xd6d3d1).fillRect(8, 26, 48, 34);
        g.lineStyle(3, INK).strokeRect(8, 26, 48, 34);
        for (const x of [4, 44]) g.fillStyle(0xd6d3d1).fillRect(x, 14, 16, 46).lineStyle(3, INK).strokeRect(x, 14, 16, 46);
        g.lineStyle(3, INK).beginPath().arc(32, 60, 8, Math.PI, 0).strokePath();
        g.lineStyle(2, 0xdc2626).lineBetween(32, 26, 32, 8).lineBetween(32, 8, 42, 12).lineBetween(42, 12, 32, 16);
        stars(g, lvl, 32, 38);
      });
    }
    tex('soldier', 48, (g) => {
      g.fillStyle(0xbfdbfe).fillCircle(24, 14, 9);
      g.lineStyle(2.5, INK).strokeCircle(24, 14, 9);
      g.lineBetween(24, 23, 24, 36).lineBetween(24, 27, 14, 32).lineBetween(24, 36, 17, 46).lineBetween(24, 36, 31, 46);
      g.lineStyle(2.5, 0x6b7280).lineBetween(32, 34, 40, 14); // spear
    });
    tex('cave', 64, (g) => {
      g.fillStyle(0x3f3f46).slice(32, 44, 26, Math.PI, 0, false).fillPath();
      g.fillRect(6, 44, 52, 10);
      g.lineStyle(3, 0x18181b).beginPath().arc(32, 44, 26, Math.PI, 0).strokePath();
    });
    tex('coin', 32, (g) => {
      g.fillStyle(0xfacc15).fillCircle(16, 16, 11);
      g.lineStyle(2, 0x854d0e).strokeCircle(16, 16, 11).strokeCircle(16, 16, 6);
    });
    tex('projectile', 32, (g) => {
      g.lineStyle(3, 0x78350f).lineBetween(4, 16, 26, 16);
      g.fillStyle(0x374151).fillTriangle(26, 11, 31, 16, 26, 21);
    });
    for (const t of this.cfg.enemyTypes) {
      tex(`enemy:${t.id}`, 64, (g) => {
        const col = hexNum(t.color ?? '#16a34a');
        if (t.flying) {
          g.fillStyle(col).fillTriangle(4, 22, 32, 30, 14, 44).fillTriangle(60, 22, 32, 30, 50, 44);
        }
        g.fillStyle(col).fillCircle(32, 34, 18);
        g.lineStyle(3, 0x111827).strokeCircle(32, 34, 18);
        g.fillStyle(0xffffff).fillCircle(25, 30, 5).fillCircle(39, 30, 5);
        g.fillStyle(0x111827).fillCircle(26, 31, 2).fillCircle(40, 31, 2);
        g.lineStyle(2, 0x111827).lineBetween(24, 42, 40, 42);
      });
    }
    g.destroy();
  }

  // ---------------- input ----------------

  setupInput() {
    const cam = this.cameras.main;
    this.input.addPointer(1); // second finger for pinch
    let down = null;
    let pinch = null;

    this.input.on('pointerdown', (p) => {
      const pts = this.activeTouches();
      if (pts.length === 2) {
        pinch = { d: Phaser.Math.Distance.BetweenPoints(pts[0].position, pts[1].position), zoom: cam.zoom };
        down = null;
        return;
      }
      down = { x: p.x, y: p.y, scrollX: cam.scrollX, scrollY: cam.scrollY, moved: false };
    });

    this.input.on('pointermove', (p) => {
      if (pinch) {
        const pts = this.activeTouches();
        if (pts.length === 2) {
          const d = Phaser.Math.Distance.BetweenPoints(pts[0].position, pts[1].position);
          this.setZoom(pinch.zoom * (d / pinch.d));
        }
        return;
      }
      if (!down || !p.isDown) return;
      const dx = p.x - down.x, dy = p.y - down.y;
      if (!down.moved && Math.hypot(dx, dy) > CLICK_SLOP) down.moved = true;
      if (down.moved) {
        cam.scrollX = down.scrollX - dx / cam.zoom;
        cam.scrollY = down.scrollY - dy / cam.zoom;
      }
    });

    this.input.on('pointerup', (p) => {
      if (pinch) {
        if (this.activeTouches().length < 2) pinch = null;
        return;
      }
      if (down && !down.moved && p.button === 0) this.onWorldClick(p.worldX, p.worldY);
      down = null;
    });

    this.input.on('wheel', (p, _over, _dx, dy) => {
      const before = cam.getWorldPoint(p.x, p.y);
      this.setZoom(cam.zoom * (dy > 0 ? 0.9 : 1.1));
      const after = cam.getWorldPoint(p.x, p.y);
      cam.scrollX += before.x - after.x;
      cam.scrollY += before.y - after.y;
    });
  }

  activeTouches() {
    return this.input.manager.pointers.filter((p) => p.isDown && p.wasTouch);
  }

  setZoom(z) {
    this.cameras.main.setZoom(Phaser.Math.Clamp(z, MIN_ZOOM, MAX_ZOOM));
  }

  zoomBy(f) {
    this.setZoom(this.cameras.main.zoom * f);
  }

  // click priority: enemy (attack) > Town Hall / building spot (select + walk there) > road (walk)
  onWorldClick(x, y) {
    const w = this.world;
    const enemy = w.enemyAt(x, y, 20 / this.cameras.main.zoom + 8);
    if (enemy) {
      w.attack(enemy.id);
      this.flashMarker(enemy.x, enemy.y - 30, '⚔');
      return;
    }
    if (w.isTownHallAt(x, y)) {
      this.select({ kind: 'townhall' });
      if (!w.heroNear(w.townHall, w.townHall.radius)) w.moveHeroTo(w.townHall.x, w.townHall.y);
      return;
    }
    const spot = w.spotAt(x, y);
    if (spot) {
      this.select({ kind: 'spot', id: spot.id });
      if (!w.heroNear(spot)) w.moveHeroTo(spot.x, spot.y);
      return;
    }
    this.select(null);
    const end = w.moveHeroTo(x, y);
    if (end) this.flashMarker(end.x, end.y, '✕');
  }

  select(sel) {
    this.selection = sel;
    this.cfg.onSelect?.(sel);
  }

  flashMarker(x, y, text) {
    this.tweens.killTweensOf(this.marker);
    this.marker.setText(text).setPosition(x, y).setVisible(true).setAlpha(1);
    this.tweens.add({ targets: this.marker, alpha: 0, delay: 500, duration: 400 });
  }

  // ---------------- per-frame ----------------

  update(_t, dtMs) {
    const w = this.world;
    if (!this.paused) {
      const dt = Math.min(MAX_DT, dtMs / 1000) * this.speed;
      w.update(dt);
    }
    for (const e of w.drainEvents()) this.onEvent(e);
    this.syncEntities();

    this.hudTimer -= dtMs;
    if (this.hudTimer <= 0) {
      this.hudTimer = HUD_EVERY;
      this.cfg.onHud?.(w.hud());
    }
  }

  onEvent(e) {
    if (e.type === 'hit' && e.amount) this.floatText(e.x, e.y - 24, `-${e.amount}`, e.kind === 'enemy' ? '#1e3a8a' : '#b91c1c');
    if (e.type === 'enemyDied') this.puff(e.x, e.y);
    if (e.type === 'coinPicked') this.floatText(e.x, e.y - 16, '+1', '#a16207');
    if (e.type === 'cantHit') this.cfg.onEvent?.(e);
    if (e.type === 'buildingDestroyed') { const s = this.world.spots.find((p) => p.id === e.spotId); if (s) this.puff(s.x, s.y); }
    if (['waveStart', 'roundEnd', 'won', 'lost', 'heroDown', 'heroRespawn', 'bonus', 'heroLostLife', 'built', 'upgraded', 'buildingDestroyed', 'heroUpgraded'].includes(e.type)) this.cfg.onEvent?.(e);
  }

  floatText(x, y, text, color) {
    const t = this.add.text(x, y, text, { fontFamily: 'Patrick Hand', fontSize: '20px', color, stroke: '#fffdf7', strokeThickness: 3 }).setOrigin(0.5).setDepth(9500);
    this.tweens.add({ targets: t, y: y - 26, alpha: 0, duration: 700, onComplete: () => t.destroy() });
  }

  // pencil scribble where an enemy dies
  puff(x, y) {
    const g = this.add.graphics().setDepth(9400);
    g.lineStyle(2, 0x374151, 0.8);
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2;
      g.lineBetween(x + Math.cos(a) * 6, y + Math.sin(a) * 6, x + Math.cos(a) * 20, y + Math.sin(a) * 20);
    }
    this.tweens.add({ targets: g, alpha: 0, duration: 450, onComplete: () => g.destroy() });
  }

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
      const size = type.boss ? 84 : 48;
      const s = this.sprite(e.id, () => ({
        img: this.add.image(e.x, e.y, this.textures.exists(`enemy:${type.id}`) ? `enemy:${type.id}` : 'hero').setDisplaySize(size, size).setOrigin(0.5, 0.75),
        bar: this.add.graphics().setDepth(9000),
      }));
      const bob = e.flying ? Math.sin(this.time.now / 180 + e.id) * 4 - 18 : 0;
      s.img.setPosition(e.x, e.y + bob).setDepth(e.flying ? 8000 + e.y : e.y);
      if (e.facing) s.img.setFlipX(e.facing < 0);
      s.img.setAngle(e.attacking ? Math.sin(this.time.now / 60) * 6 : 0);
      drawBar(s.bar.clear(), e.x, e.y + bob - size * 0.75 - 6, 36, e.hp / e.maxHp, 0xdc2626);
    }

    for (const b of w.buildings) {
      // show the drawing of the level being built (or the current one), at least level 1
      const shownLevel = Math.max(1, b.state === 'building' || b.state === 'upgrading' ? b.level + 1 : b.level);
      const key = `${b.type}:${shownLevel}`;
      const s = this.sprite(`b${b.id}`, () => ({
        img: this.add.image(b.x, b.y, key).setDisplaySize(64, 64).setOrigin(0.5, 0.6).setDepth(b.y),
        bar: this.add.graphics().setDepth(9000),
      }));
      if (s.img.texture.key !== key) s.img.setTexture(key).setDisplaySize(64, 64);
      s.bar.clear();
      if (b.state === 'ruin') {
        s.img.setAlpha(0.4).setTint(0x9ca3af);
        s.bar.lineStyle(3, 0x7f1d1d, 0.8).lineBetween(b.x - 22, b.y - 30, b.x + 22, b.y + 10).lineBetween(b.x + 22, b.y - 30, b.x - 22, b.y + 10);
        continue;
      }
      s.img.clearTint();
      if (b.state === 'building') s.img.setAlpha(0.35 + 0.5 * (b.progress / b.buildTime));
      else s.img.setAlpha(1);
      if (b.state === 'building' || b.state === 'upgrading') {
        drawBar(s.bar, b.x, b.y + 26, 44, b.progress / b.buildTime, 0xca8a04);
        // scaffolding lines
        s.bar.lineStyle(1.5, 0x78350f, 0.7).lineBetween(b.x - 24, b.y + 20, b.x - 24, b.y - 30).lineBetween(b.x + 24, b.y + 20, b.x + 24, b.y - 30).lineBetween(b.x - 24, b.y - 5, b.x + 24, b.y - 5);
      }
      if (b.hp < b.maxHp) drawBar(s.bar, b.x, b.y - 44, 44, b.hp / b.maxHp, 0x16a34a);
    }

    for (const so of w.soldiers) {
      const s = this.sprite(`s${so.id}`, () => ({
        img: this.add.image(so.x, so.y, 'soldier').setDisplaySize(36, 36).setOrigin(0.5, 0.85),
        bar: this.add.graphics().setDepth(9000),
      }));
      s.img.setPosition(so.x, so.y).setDepth(so.y).setFlipX(so.facing < 0);
      s.bar.clear();
      if (so.hp < so.maxHp) drawBar(s.bar, so.x, so.y - 38, 26, so.hp / so.maxHp, 0x2563eb);
    }

    for (const p of w.projectiles) {
      const s = this.sprite(`p${p.id}`, () => ({ img: this.add.image(p.x, p.y, 'projectile').setDisplaySize(26, 26).setDepth(9100) }));
      s.img.setPosition(p.x, p.y).setRotation(p.angle ?? 0);
    }

    const now = w.time;
    for (const c of w.coinsOnGround) {
      const s = this.sprite(`c${c.id}`, () => ({ img: this.add.image(c.x, c.y, 'coin').setDisplaySize(22, 22).setDepth(c.y - 1) }));
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
    this.hero.setVisible(!h.dead).setPosition(h.x, h.y).setDepth(h.y).setFlipX(h.facing < 0);
    this.hero.setAlpha(h.invuln > 0 ? (Math.floor(this.time.now / 100) % 2 ? 0.35 : 1) : 1);
    this.heroBar.clear();
    this.rangeRing.clear();
    if (!h.dead) {
      drawBar(this.heroBar, h.x, h.y - 52, 40, h.hp / h.maxHp, 0x16a34a);
      const r = w.heroStats[h.mode].range;
      this.rangeRing.lineStyle(1.5, INK, 0.25).strokeCircle(h.x, h.y, r + w.b.enemyRadius);
    }

    // town hall
    const th = w.townHall;
    const thKey = `townhall:${th.level}`;
    if (this.townHall.texture.key !== thKey) this.townHall.setTexture(thKey).setDisplaySize(96, 96);
    this.townHallBar.clear();
    drawBar(this.townHallBar, th.x, th.y - 60, 70, th.hp / th.maxHp, 0x2563eb);
    if (th.upgrade) drawBar(this.townHallBar, th.x, th.y + 40, 60, th.upgrade.progress / th.upgrade.time, 0xca8a04);
    this.townHall.setAlpha(th.hp > 0 ? 1 : 0.35);

    // selection highlight (+ the tower's range when a tower is selected)
    this.selectRing.clear();
    const sel = this.selection;
    if (sel) {
      const p = sel.kind === 'townhall' ? th : w.spots.find((s) => s.id === sel.id);
      if (p) {
        const r = sel.kind === 'townhall' ? 54 : 34;
        this.selectRing.lineStyle(3, 0xca8a04, 0.9).strokeCircle(p.x, p.y, r);
        this.selectRing.lineStyle(1.5, INK, 0.3).strokeCircle(p.x, p.y, 90 + (sel.kind === 'townhall' ? th.radius : 0));
        const b = sel.kind === 'spot' && w.buildingOn(sel.id);
        if (b && b.type === 'tower' && b.level > 0) {
          this.selectRing.lineStyle(2, 0xdc2626, 0.5).strokeCircle(b.x, b.y, w.buildingTypes.tower.levels[b.level - 1].range);
        }
      }
    }
  }
}

function drawBar(g, x, y, w, frac, color) {
  g.fillStyle(0xfffdf7, 0.9).fillRect(x - w / 2 - 1, y - 1, w + 2, 7);
  g.fillStyle(color).fillRect(x - w / 2, y, Math.max(0, w * frac), 5);
  g.lineStyle(1.5, INK).strokeRect(x - w / 2 - 1, y - 1, w + 2, 7);
}

function dashedRect(g, x, y, w, h, dash) {
  const edges = [[x, y, x + w, y], [x + w, y, x + w, y + h], [x + w, y + h, x, y + h], [x, y + h, x, y]];
  for (const [x1, y1, x2, y2] of edges) {
    const len = Math.hypot(x2 - x1, y2 - y1);
    for (let s = 0; s < len; s += dash * 2) {
      const e = Math.min(s + dash, len);
      g.lineBetween(x1 + ((x2 - x1) * s) / len, y1 + ((y2 - y1) * s) / len, x1 + ((x2 - x1) * e) / len, y1 + ((y2 - y1) * e) / len);
    }
  }
}
