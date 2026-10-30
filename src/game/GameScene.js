import Phaser from 'phaser';
import { hasFeature, shapeOf } from '../config/features.js';

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
    this.wobble = !!data.wobble; // "pencil wobble": drawings jitter a little, like a flip-book
    this.townHallVariant = Math.random();
    this.hudTimer = 0;
    this.lastHud = '';
    this.textPool = [];
    this.puffPool = [];
    this.splashPool = [];
  }

  // Texture of a building: one of the kids' drawings of that kind (picked by the
  // building's variant), or the geometric placeholder.
  buildingKey(type, variant, level) {
    const n = this.cfg.variants?.[type] ?? 0;
    return n ? `${type}#${Math.floor(variant * n) % n}:${level}` : `${type}:${level}`;
  }

  // -1..1, changes ~5× per second, different per thing (seed); 0 when wobble is off
  jitter(seed) {
    if (!this.wobble) return 0;
    const h = Math.sin(seed * 12.9898 + Math.floor(this.time.now / 190) * 78.233) * 43758.5453;
    return (h - Math.floor(h)) * 2 - 1;
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
    this.townHall = this.add.image(th.x, th.y, this.buildingKey(th.type, this.townHallVariant, 1)).setDisplaySize(96, 96).setDepth(th.y);
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

  // Simple geometric shapes for anything the kids haven't drawn yet; their
  // drawings replace them as soon as they exist. Shape tells the kind
  // (house = square, tower = triangle, castle = hexagon, town hall = circle),
  // dots tell the level.
  makePlaceholders() {
    const g = this.make.graphics({ x: 0, y: 0 }, false);
    const tex = (key, size, draw) => {
      if (this.textures.exists(key)) return;
      g.clear();
      draw(g);
      g.generateTexture(key, size, size);
    };
    const poly = (g, cx, cy, r, n, rot, fill) => {
      const pts = Array.from({ length: n }, (_, i) => {
        const a = rot + (i / n) * Math.PI * 2;
        return new Phaser.Geom.Point(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
      });
      g.fillStyle(fill).fillPoints(pts, true);
      g.lineStyle(3, INK).strokePoints(pts, true);
    };
    const dots = (g, n, cx, y) => {
      for (let i = 0; i < n; i++) g.fillStyle(INK).fillCircle(cx + (i - (n - 1) / 2) * 12, y, 4);
    };
    tex('hero', 64, (g) => {
      g.fillStyle(0x60a5fa).fillCircle(32, 32, 22);
      g.lineStyle(4, INK).strokeCircle(32, 32, 22);
      g.fillStyle(0xffffff).fillCircle(32, 32, 7);
    });
    // every building type – also new ones the kids made – gets a shape from its
    // main feature (config/features.js shapeOf) and one texture per level
    const SHAPES = {
      circle: (g, lvl) => { g.fillStyle(0xfda4af).fillCircle(48, 48, 40); g.lineStyle(4, INK).strokeCircle(48, 48, 40); dots(g, lvl, 48, 48); },
      square: (g, lvl) => { g.fillStyle(0xfde047).fillRect(10, 10, 44, 44); g.lineStyle(3, INK).strokeRect(10, 10, 44, 44); dots(g, lvl, 32, 32); },
      triangle: (g, lvl) => { poly(g, 32, 36, 28, 3, -Math.PI / 2, 0x93c5fd); dots(g, lvl, 32, 42); },
      hexagon: (g, lvl) => { poly(g, 32, 32, 27, 6, 0, 0xc4b5fd); dots(g, lvl, 32, 32); },
      diamond: (g, lvl) => { poly(g, 32, 32, 28, 4, 0, 0xfcd34d); dots(g, lvl, 32, 32); },
      pentagon: (g, lvl) => { poly(g, 32, 33, 27, 5, -Math.PI / 2, 0x86efac); dots(g, lvl, 32, 34); },
      octagon: (g, lvl) => { poly(g, 32, 32, 27, 8, Math.PI / 8, 0xd6d3d1); dots(g, lvl, 32, 32); },
    };
    for (const type of this.cfg.buildingTypes ?? []) {
      const shape = shapeOf(type);
      for (let lvl = 1; lvl <= type.levels.length; lvl++) tex(`${type.id}:${lvl}`, type.core ? 96 : 64, (g) => SHAPES[shape](g, Math.min(lvl, 5)));
    }
    tex('soldier', 48, (g) => {
      g.fillStyle(0x93c5fd).fillRect(12, 12, 24, 24);
      g.lineStyle(3, INK).strokeRect(12, 12, 24, 24);
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
    tex('coin5', 32, (g) => {
      g.fillStyle(0xf59e0b).fillCircle(16, 16, 13);
      g.lineStyle(2, 0x92400e).strokeCircle(16, 16, 13).strokeCircle(16, 16, 8);
      g.fillStyle(0xfef3c7).fillCircle(16, 16, 3);
    });
    tex('chest', 48, (g) => {
      g.fillStyle(0xb45309).fillRect(6, 16, 36, 24);
      g.lineStyle(3, 0x451a03).strokeRect(6, 16, 36, 24);
      g.fillStyle(0xd97706).fillRect(6, 10, 36, 9);
      g.lineStyle(3, 0x451a03).strokeRect(6, 10, 36, 9);
      g.fillStyle(0xfacc15).fillRect(21, 18, 6, 8);
    });
    tex('magic', 32, (g) => {
      g.fillStyle(0xc084fc, 0.5).fillCircle(16, 16, 13);
      g.fillStyle(0xa855f7).fillCircle(16, 16, 8);
      g.fillStyle(0xffffff).fillCircle(13, 13, 3);
    });
    tex('stone', 32, (g) => {
      g.fillStyle(0x78716c).fillCircle(16, 16, 10);
      g.lineStyle(3, INK).strokeCircle(16, 16, 10);
      g.fillStyle(0xa8a29e).fillCircle(13, 13, 3);
    });
    tex('projectile', 32, (g) => {
      g.lineStyle(3, 0x78350f).lineBetween(4, 16, 26, 16);
      g.fillStyle(0x374151).fillTriangle(26, 11, 31, 16, 26, 21);
    });
    // enemies: their colour; circle = walks, diamond = flies, triangle = shoots
    for (const t of this.cfg.enemyTypes) {
      tex(`enemy:${t.id}`, 64, (g) => {
        const col = hexNum(t.color ?? '#16a34a');
        if (t.flying) {
          const pts = [[32, 6], [58, 32], [32, 58], [6, 32]].map(([x, y]) => new Phaser.Geom.Point(x, y));
          g.fillStyle(col).fillPoints(pts, true);
          g.lineStyle(3, 0x111827).strokePoints(pts, true);
        } else if (t.ranged) {
          g.fillStyle(col).fillTriangle(32, 6, 60, 56, 4, 56);
          g.lineStyle(3, 0x111827).strokeTriangle(32, 6, 60, 56, 4, 56);
        } else {
          g.fillStyle(col).fillCircle(32, 32, 24);
          g.lineStyle(3, 0x111827).strokeCircle(32, 32, 24);
        }
        if (t.boss) g.lineStyle(3, 0xfacc15).strokeCircle(32, 34, 10);
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
      this.cfg.onAnyEvent?.({ type: 'selectTownHall' });
      if (!w.heroNear(w.townHall, w.townHall.radius)) w.moveHeroTo(w.townHall.x, w.townHall.y);
      return;
    }
    const spot = w.spotAt(x, y);
    if (spot) {
      this.select({ kind: 'spot', id: spot.id });
      if (!w.heroNear(spot) && w.moveHeroTo(spot.x, spot.y)) this.cfg.onAnyEvent?.({ type: 'heroMoved' });
      return;
    }
    this.select(null);
    const end = w.moveHeroTo(x, y);
    if (end) {
      this.flashMarker(end.x, end.y, '✕');
      this.cfg.onAnyEvent?.({ type: 'heroMoved' });
    }
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

    // the HUD snapshot goes to React only when something visible changed
    this.hudTimer -= dtMs;
    if (this.hudTimer <= 0) {
      this.hudTimer = HUD_EVERY;
      const hud = w.hud();
      const key = JSON.stringify(hud);
      if (key !== this.lastHud) {
        this.lastHud = key;
        this.cfg.onHud?.(hud);
      }
    }
  }

  onEvent(e) {
    this.cfg.onAnyEvent?.(e); // sounds + tutorial
    if (e.type === 'hit' && e.amount) this.floatText(e.x, e.y - 24, `-${e.amount}`, e.kind === 'enemy' ? '#1e3a8a' : '#b91c1c');
    if (e.type === 'enemyDied') this.puff(e.x, e.y);
    if (e.type === 'coinPicked') this.floatText(e.x, e.y - 16, `+${e.value ?? 1}`, '#a16207');
    if (e.type === 'cantHit') this.cfg.onEvent?.(e);
    if (e.type === 'buildingDestroyed') { const s = this.world.spots.find((p) => p.id === e.spotId); if (s) this.puff(s.x, s.y); }
    if (e.type === 'splash') this.splash(e.x, e.y, e.radius, e.owner === 'stone' ? 0x78716c : 0xa855f7);
    if (e.type === 'summon') { this.splash(e.x, e.y, 36, 0x4c1d95); this.floatText(e.x, e.y - 36, `+${e.count}`, '#4c1d95'); }
    if (e.type === 'chestOpened') this.floatText(e.x, e.y - 24, e.weapon ? '🎁' : `+${e.coins}`, '#7c3aed');
    if (e.type === 'sold') { this.puff(e.x, e.y); if (e.refund) this.floatText(e.x, e.y - 30, `+${e.refund}`, '#a16207'); }
    if (['waveStart', 'roundEnd', 'won', 'lost', 'heroDown', 'heroRespawn', 'bonus', 'heroLostLife', 'built', 'upgraded', 'buildingDestroyed', 'sold', 'heroUpgraded', 'unlocked', 'chestOpened', 'weaponBought'].includes(e.type)) this.cfg.onEvent?.(e);
  }

  // Short-lived effects come from pools: a Phaser Text renders its own canvas
  // texture, so creating and destroying one per hit is wasteful in big fights.
  pooled(pool, create) {
    const o = pool.pop() ?? create();
    return o.setVisible(true).setAlpha(1);
  }

  floatText(x, y, text, color) {
    const t = this.pooled(this.textPool, () => this.add.text(0, 0, '', { fontFamily: 'Patrick Hand', fontSize: '20px', stroke: '#fffdf7', strokeThickness: 3 }).setOrigin(0.5).setDepth(9500));
    if (t.text !== text) t.setText(text);
    if (t.style.color !== color) t.setColor(color);
    t.setPosition(x, y);
    this.tweens.add({ targets: t, y: y - 26, alpha: 0, duration: 700, onComplete: () => { t.setVisible(false); this.textPool.push(t); } });
  }

  // a ring where a spell or a catapult stone lands, or where minions are called
  // (drawn once at 0,0 with radius 50 in white, then scaled and tinted)
  splash(x, y, r, color = 0xa855f7) {
    const g = this.pooled(this.splashPool, () => {
      const n = this.add.graphics().setDepth(9300);
      n.fillStyle(0xffffff, 0.3).fillCircle(0, 0, 50);
      n.lineStyle(3, 0xffffff, 0.9).strokeCircle(0, 0, 50);
      return n;
    });
    g.setPosition(x, y).setScale(r / 50);
    if (g.ringColor !== color) {
      g.clear().fillStyle(color, 0.28).fillCircle(0, 0, 50).lineStyle(3, color, 0.85).strokeCircle(0, 0, 50);
      g.ringColor = color;
    }
    this.tweens.add({ targets: g, alpha: 0, duration: 400, onComplete: () => { g.setVisible(false); this.splashPool.push(g); } });
  }

  // pencil scribble where an enemy dies
  puff(x, y) {
    const g = this.pooled(this.puffPool, () => {
      const n = this.add.graphics().setDepth(9400);
      n.lineStyle(2, 0x374151, 0.8);
      for (let i = 0; i < 7; i++) {
        const a = (i / 7) * Math.PI * 2;
        n.lineBetween(Math.cos(a) * 6, Math.sin(a) * 6, Math.cos(a) * 20, Math.sin(a) * 20);
      }
      return n;
    });
    g.setPosition(x, y);
    this.tweens.add({ targets: g, alpha: 0, duration: 450, onComplete: () => { g.setVisible(false); this.puffPool.push(g); } });
  }

  /**
   * A health/progress bar drawn in local coordinates; it is only redrawn when the
   * shown fill changes (in whole pixels), otherwise just moved.
   */
  bar(g, x, y, width, frac, color) {
    const fill = Math.max(0, Math.round(width * frac));
    if (g.barFill !== fill || g.barColor !== color) {
      g.barFill = fill;
      g.barColor = color;
      g.clear();
      drawBar(g, 0, 0, width, fill / width, color);
    }
    g.setPosition(x, y).setVisible(true);
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
      const size = (type.boss ? 84 : 48) * (type.size ?? 1);
      const s = this.sprite(e.id, () => ({
        img: this.add.image(e.x, e.y, this.textures.exists(`enemy:${type.id}`) ? `enemy:${type.id}` : 'hero').setDisplaySize(size, size).setOrigin(0.5, 0.75),
        bar: this.add.graphics().setDepth(9000),
      }));
      const bob = e.flying ? Math.sin(this.time.now / 180 + e.id) * 4 - 18 : 0;
      s.img.setPosition(e.x, e.y + bob).setDepth(e.flying ? 8000 + e.y : e.y);
      if (e.facing) s.img.setFlipX(e.facing < 0);
      s.img.setAngle((e.attacking ? Math.sin(this.time.now / 60) * 6 : 0) + this.jitter(e.id) * 3);
      this.bar(s.bar, e.x, e.y + bob - size * 0.75 - 6, 36, e.hp / e.maxHp, 0xdc2626);
    }

    for (const b of w.buildings) {
      // show the drawing of the level being built (or the current one), at least level 1
      const shownLevel = Math.max(1, b.state === 'building' || b.state === 'upgrading' ? b.level + 1 : b.level);
      const key = this.buildingKey(b.type, b.variant ?? 0, shownLevel);
      const s = this.sprite(`b${b.id}`, () => ({
        img: this.add.image(b.x, b.y, key).setDisplaySize(64, 64).setOrigin(0.5, 0.6).setDepth(b.y),
        bar: this.add.graphics().setDepth(9000).setPosition(b.x, b.y),
      }));
      if (s.img.texture.key !== key) s.img.setTexture(key).setDisplaySize(64, 64);
      if (this.wobble || s.img.angle) s.img.setAngle(this.jitter(b.id) * 2);
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
        g.lineStyle(3, 0x7f1d1d, 0.8).lineBetween(-22, -30, 22, 10).lineBetween(22, -30, -22, 10);
        continue;
      }
      if (busy) {
        drawBar(g, 0, 26, 44, b.progress / b.buildTime, 0xca8a04);
        g.lineStyle(1.5, 0x78350f, 0.7).lineBetween(-24, 20, -24, -30).lineBetween(24, 20, 24, -30).lineBetween(-24, -5, 24, -5);
      }
      if (b.hp < b.maxHp) drawBar(g, 0, -44, 44, b.hp / b.maxHp, 0x16a34a);
    }

    for (const so of w.soldiers) {
      const s = this.sprite(`s${so.id}`, () => ({
        img: this.add.image(so.x, so.y, 'soldier').setDisplaySize(36, 36).setOrigin(0.5, 0.85),
        bar: this.add.graphics().setDepth(9000),
      }));
      s.img.setPosition(so.x, so.y).setDepth(so.y).setFlipX(so.facing < 0).setAngle(this.jitter(so.id) * 3);
      if (so.hp < so.maxHp) this.bar(s.bar, so.x, so.y - 38, 26, so.hp / so.maxHp, 0x2563eb);
      else s.bar.setVisible(false);
    }

    for (const p of w.projectiles) {
      const key = p.owner === 'magic' ? 'magic' : p.owner === 'stone' ? 'stone' : 'projectile';
      const s = this.sprite(`p${p.id}`, () => ({ img: this.add.image(p.x, p.y, key).setDisplaySize(key === 'stone' ? 22 : 26, key === 'stone' ? 22 : 26).setDepth(9100) }));
      if (key === 'stone') {
        // a stone flies in an arc: highest half way
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
    const heroKey = this.textures.exists(`hero:${h.mode}`) ? `hero:${h.mode}` : 'hero';
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
    const thKey = this.buildingKey(th.type, this.townHallVariant, th.level);
    if (this.townHall.texture.key !== thKey) this.townHall.setTexture(thKey).setDisplaySize(96, 96);
    if (this.wobble || this.townHall.angle) this.townHall.setAngle(this.jitter(0.3) * 1.5);
    const thSig = `${Math.round((70 * th.hp) / th.maxHp)}|${th.upgrade ? Math.round((60 * th.upgrade.progress) / th.upgrade.time) : ''}`;
    if (this.townHallBar.sig !== thSig) {
      this.townHallBar.sig = thSig;
      this.townHallBar.clear();
      drawBar(this.townHallBar, th.x, th.y - 60, 70, th.hp / th.maxHp, 0x2563eb);
      if (th.upgrade) drawBar(this.townHallBar, th.x, th.y + 40, 60, th.upgrade.progress / th.upgrade.time, 0xca8a04);
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
