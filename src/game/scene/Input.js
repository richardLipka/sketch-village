// Input: clicks on the world, drag-pan, wheel and pinch zoom.
// Methods of GameScene (../GameScene.js mixes them in); `this` is the scene.

import Phaser from '../phaser.js';

const CLICK_SLOP = 8; // px of pointer movement still counted as a click
export const MIN_ZOOM = 1;
const MAX_ZOOM = 3;

export class Input {
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
}
