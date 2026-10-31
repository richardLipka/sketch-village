// Short-lived effects (floating numbers, rings, puffs) and bars.
// Methods of GameScene (../GameScene.js mixes them in); `this` is the scene.

import { drawBar } from './draw.js';

export class Effects {
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
}
