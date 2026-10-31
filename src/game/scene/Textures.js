// Placeholder textures: geometric shapes for everything not drawn yet.
// Methods of GameScene (../GameScene.js mixes them in); `this` is the scene.

import Phaser from '../phaser.js';
import { shapeOf } from '../../config/features.js';
import { INK, hexNum } from './draw.js';

export class Textures {
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
}
