// Drawing helpers shared by the parts of the game scene.

export const INK = 0x1e3a8a;
export const BUILDING_SIZE = 64; // px at scale 1 (features.js buildingScale: +20 %, +10 % per level)
export const TOWN_HALL_SIZE = 96;

export const hexNum = (hex) => parseInt(hex.replace('#', ''), 16);

export function drawBar(g, x, y, w, frac, color) {
  g.fillStyle(0xfffdf7, 0.9).fillRect(x - w / 2 - 1, y - 1, w + 2, 7);
  g.fillStyle(color).fillRect(x - w / 2, y, Math.max(0, w * frac), 5);
  g.lineStyle(1.5, INK).strokeRect(x - w / 2 - 1, y - 1, w + 2, 7);
}

export function dashedRect(g, x, y, w, h, dash) {
  const edges = [[x, y, x + w, y], [x + w, y, x + w, y + h], [x + w, y + h, x, y + h], [x, y + h, x, y]];
  for (const [x1, y1, x2, y2] of edges) {
    const len = Math.hypot(x2 - x1, y2 - y1);
    for (let s = 0; s < len; s += dash * 2) {
      const e = Math.min(s + dash, len);
      g.lineBetween(x1 + ((x2 - x1) * s) / len, y1 + ((y2 - y1) * s) / len, x1 + ((x2 - x1) * e) / len, y1 + ((y2 - y1) * e) / len);
    }
  }
}
