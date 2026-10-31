import Phaser from './phaser.js';
import { buildingScale } from '../config/features.js';
import { frameAt } from '../assets/animation.js';
import { decorSize } from '../maps/decorEdit.js';
import { INK, TOWN_HALL_SIZE, dashedRect } from './scene/draw.js';
import { Textures } from './scene/Textures.js';
import { Input, MIN_ZOOM } from './scene/Input.js';
import { Effects } from './scene/Effects.js';
import { mapBorder, startScroll } from './viewport.js';
import { Entities } from './scene/Entities.js';

// Draws the World simulation (src/logic/world.js) and forwards clicks to it.
// Camera: zoom (wheel, pinch, buttons) and drag-pan, clamped to the map and
// a paper border around it (the controls must not hide the map's edges).
// The scene's methods live in parts by topic (./scene/*.js), mixed in at the
// bottom: Textures (placeholders), Input (clicks, pan, zoom), Effects (floating
// numbers, rings, bars), Entities (the sprites following the world each frame).

const MAX_DT = 0.05; // s – avoid huge jumps after a tab switch
const HUD_EVERY = 150; // ms

export default class GameScene extends Phaser.Scene {
  constructor() {
    super('game');
  }

  /**
   * data: { world, map, images: { background, hero?, townhall?, cave?, coin?, projectile?,
   *         'enemy:<typeId>'?, [decorAssetId]?, '<base>|<kind>|<i>' animation frames },
   *         anims: { <base>: { walk?|attack?|reload?: { n, fps } } }, enemyTypes, onHud(state), onEvent(e) }
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
    this.animClock = 0; // ms of game time (follows speed and pause) that animations run on
    this.heroAnim = {};
    this.townHallAnim = {};
  }

  // ---------------- animations ----------------
  // Something with animations (cfg.anims[base]) shows a one-shot (attack, then
  // reload) while it plays, its walk loop while it moves, otherwise its still
  // picture (null here). `state` keeps the one-shot per sprite.

  animKey(state, base, moving) {
    const info = base && this.cfg.anims?.[base];
    if (!info) return null;
    while (state.oneShot) {
      const a = info[state.oneShot.kind];
      const i = a ? frameAt(a.n, a.fps, this.animClock - state.oneShot.start, false) : null;
      if (i !== null) return `${base}|${state.oneShot.kind}|${i}`;
      const next = state.queue?.shift();
      state.oneShot = next ? { kind: next, start: this.animClock } : null;
    }
    if (moving && info.walk) return `${base}|walk|${frameAt(info.walk.n, info.walk.fps, this.animClock + (state.phase ?? 0))}`;
    return null;
  }

  playOnce(state, base, kinds) {
    const info = base && this.cfg.anims?.[base];
    const have = kinds.filter((k) => info?.[k]);
    if (!state || !have.length) return;
    state.oneShot = { kind: have[0], start: this.animClock };
    state.queue = have.slice(1);
  }

  // the look of a building texture key `type#look:level` (placeholders have none)
  lookOf(key) {
    return key.includes('#') ? key.slice(0, key.lastIndexOf(':')) : null;
  }

  // Texture of a building: one of the kids' drawings of that kind (picked by the
  // building's variant), or the geometric placeholder.
  buildingKey(type, variant, level) {
    const n = this.cfg.variants?.[type] ?? 0;
    return n ? `${type}#${Math.floor(variant * n) % n}:${level}` : `${type}:${level}`;
  }

  /** The texture (and animation base) of a soldier: its kind's, or the default soldier. */
  soldierBase(so) {
    if (!so.look) return 'soldier';
    const key = so.lookIsEnemy ? `enemy:${so.look}` : `soldier:${so.look}`;
    return this.textures.exists(key) ? key : 'soldier';
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

    // the paper border around the map: a little darker, the map framed in ink
    const paper = this.add.graphics().setDepth(-1001);
    paper.fillStyle(0xefe7d3, 1).fillRect(-2 * W, -2 * H, 5 * W, 5 * H);
    paper.fillStyle(0x1e293b, 0.12).fillRect(6, 8, W, H); // shadow
    this.add.image(0, 0, 'background').setOrigin(0).setDepth(-1000);
    this.add.graphics().setDepth(-999).lineStyle(3, INK, 0.8).strokeRect(-1.5, -1.5, W + 3, H + 3);

    for (const d of map.decorations) {
      if (!this.textures.exists(d.asset)) continue;
      const { w, h } = decorSize(d); // resized / stretched in the map editor
      this.add.image(d.x, d.y, d.asset).setDisplaySize(w, h).setDepth(d.y);
    }

    for (const [i, s] of map.spots.entries()) {
      const g = this.add.graphics().setDepth(-500);
      g.lineStyle(2, INK, 0.5);
      dashedRect(g, s.x - 26, s.y - 26, 52, 52, 6);
      this.add.text(s.x, s.y, String(i + 1), { fontFamily: 'Patrick Hand', fontSize: '18px', color: '#1e3a8a' }).setOrigin(0.5).setAlpha(0.45).setDepth(-500);
    }

    for (const c of map.caves) this.add.image(c.x, c.y, 'cave').setDisplaySize(64, 64).setDepth(c.y);

    const th = this.world.townHall;
    this.townHall = this.add.image(th.x, th.y, this.buildingKey(th.type, this.townHallVariant, 1)).setDisplaySize(TOWN_HALL_SIZE * buildingScale(1), TOWN_HALL_SIZE * buildingScale(1)).setDepth(th.y);
    this.townHallBar = this.add.graphics().setDepth(9000);
    this.selectRing = this.add.graphics().setDepth(-300);
    this.selection = null;

    const h = this.world.hero;
    this.hero = this.add.image(h.x, h.y, 'hero').setDisplaySize(56, 56).setOrigin(0.5, 0.8).setDepth(h.y);
    this.heroBar = this.add.graphics().setDepth(9000);
    this.rangeRing = this.add.graphics().setDepth(-400);

    this.marker = this.add.text(0, 0, '✕', { fontFamily: 'Patrick Hand', fontSize: '28px', color: '#b91c1c' }).setOrigin(0.5).setVisible(false).setDepth(10000);

    const cam = this.cameras.main;
    this.fitBounds();
    cam.setZoom(MIN_ZOOM);
    // when the map covers a wider / taller screen, part of it is out of view: start at the village (no border in view)
    const start = startScroll(this.world.townHall, cam.width, cam.height, W, H);
    cam.setScroll(start.x, start.y);
    this.setupInput();
  }

  /** The camera may go a border past the map's edges (after a resize too). */
  fitBounds() {
    const cam = this.cameras.main;
    const { width: W, height: H } = this.cfg.map.world;
    const b = mapBorder(cam.width, cam.height);
    cam.setBounds(-b.x, -b.y, W + 2 * b.x, H + 2 * b.y);
  }

  // ---------------- per-frame ----------------

  update(_t, dtMs) {
    const w = this.world;
    if (!this.paused) {
      const dt = Math.min(MAX_DT, dtMs / 1000) * this.speed;
      w.update(dt);
      this.animClock += dt * 1000;
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
    if (e.type === 'enemyAttack') { const sp = this.sprites.get(e.id); if (sp) this.playOnce(sp, sp.base, ['attack']); }
    // a soldier attacks with its own kind's animation (a goblin on our side, a drawn knight…)
    if (e.type === 'soldierAttack') { const sp = this.sprites.get(`s${e.id}`); if (sp) this.playOnce(sp, sp.base, ['attack']); }
    if (e.type === 'heroAttack') this.playOnce(this.heroAnim, 'hero', ['attack']);
    if (e.type === 'buildingAttack') {
      if (e.id === this.world.townHall.id) { const th = this.world.townHall; this.playOnce(this.townHallAnim, this.lookOf(this.buildingKey(th.type, this.townHallVariant, th.level)), ['attack', 'reload']); }
      else { const sp = this.sprites.get(`b${e.id}`); if (sp) this.playOnce(sp, sp.base, ['attack', 'reload']); }
    }
    if (e.type === 'splash') this.splash(e.x, e.y, e.radius, e.owner === 'stone' ? 0x78716c : e.owner === 'enemy' ? 0xdc2626 : 0xa855f7);
    if (e.type === 'summon') { this.splash(e.x, e.y, 36, 0x4c1d95); this.floatText(e.x, e.y - 36, `+${e.count}`, '#4c1d95'); }
    if (e.type === 'chestOpened') this.floatText(e.x, e.y - 24, e.weapon ? '🎁' : `+${e.coins}`, '#7c3aed');
    if (e.type === 'sold') { this.puff(e.x, e.y); if (e.refund) this.floatText(e.x, e.y - 30, `+${e.refund}`, '#a16207'); }
    if (['waveStart', 'roundEnd', 'won', 'lost', 'heroDown', 'heroRespawn', 'bonus', 'heroLostLife', 'built', 'upgraded', 'buildingDestroyed', 'sold', 'heroUpgraded', 'unlocked', 'chestOpened', 'weaponBought'].includes(e.type)) this.cfg.onEvent?.(e);
  }
}

for (const part of [Textures, Input, Effects, Entities]) {
  for (const [key, d] of Object.entries(Object.getOwnPropertyDescriptors(part.prototype))) {
    if (key === 'constructor') continue;
    if (Object.prototype.hasOwnProperty.call(GameScene.prototype, key)) throw new Error(`GameScene.${key} is defined twice`);
    Object.defineProperty(GameScene.prototype, key, d);
  }
}
