// DOM helpers around a map record: draw templates, read back the grid.

import { makeCanvas, loadImage } from '../assets/imageEncoding.js';
import { buildGrid } from '../logic/pathGrid.js';
import { CENTRE_RADIUS, emptyMap, validateMap } from '../logic/mapModel.js';
import { newId } from '../data/saveFile.js';

export function gridFromCanvas(canvas, palette) {
  const { width, height } = canvas;
  const data = canvas.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, width, height).data;
  return buildGrid(data, width, height, { pathColor: palette.path });
}

/** Load a map's background into a canvas (blank grass when there is none). */
export async function mapCanvas(map) {
  const { width, height } = map.world;
  const c = makeCanvas(width, height);
  const ctx = c.getContext('2d', { willReadFrequently: true });
  if (map.background) {
    ctx.drawImage(await loadImage(map.background), 0, 0, width, height);
  } else {
    ctx.fillStyle = map.palette.grass;
    ctx.fillRect(0, 0, width, height);
  }
  return c;
}

/**
 * A finished, validated sample map – added on the very first start so kids can
 * play right away (with geometric shapes until they draw their own pictures).
 */
export function starterMap(name) {
  const m = emptyMap(name);
  const canvas = drawSampleMap(m);
  m.background = canvas.toDataURL('image/png');
  m.valid = validateMap(m, gridFromCanvas(canvas, m.palette)).ok;
  return m;
}

/**
 * A copy of the map picture with procedurally rugged road edges: the border
 * between road and grass bulges and bites a few pixels following smooth noise,
 * gets a darker trodden rim and a few pebbles. Only the picture changes – the
 * walkable grid is computed from the original painting. Deterministic per seed.
 */
export function ruggedRoads(src, palette, seedText = '') {
  const { width: W, height: H } = src;
  const out = makeCanvas(W, H);
  const ctx = out.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(src, 0, 0);
  const img = ctx.getImageData(0, 0, W, H);
  const d = img.data;
  const path = rgb(palette.path), grass = rgb(palette.grass);
  const near = (i, c, tol) => Math.abs(d[i] - c[0]) + Math.abs(d[i + 1] - c[1]) + Math.abs(d[i + 2] - c[2]) < tol;

  const isPath = new Uint8Array(W * H);
  const isGrass = new Uint8Array(W * H);
  for (let p = 0; p < W * H; p++) {
    if (near(p * 4, path, 60)) isPath[p] = 1;
    else if (near(p * 4, grass, 60)) isGrass[p] = 1;
  }

  let seed = 2166136261;
  for (const ch of String(seedText)) seed = Math.imul(seed ^ ch.charCodeAt(0), 16777619);
  const hash = (x, y) => {
    let h = Math.imul(x, 374761393) + Math.imul(y, 668265263) + seed;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  };
  // smooth value noise, features about `size` px wide
  const noise = (x, y, size) => {
    const gx = x / size, gy = y / size;
    const x0 = Math.floor(gx), y0 = Math.floor(gy);
    const fx = gx - x0, fy = gy - y0;
    const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
    const a = hash(x0, y0), b = hash(x0 + 1, y0), c = hash(x0, y0 + 1), e = hash(x0 + 1, y0 + 1);
    return a + (b - a) * sx + (c - a) * sy + (a - b - c + e) * sx * sy;
  };

  const boundary = (m, p) => {
    const x = p % W, y = (p - x) / W;
    return (x > 0 && !m[p - 1]) || (x < W - 1 && !m[p + 1]) || (y > 0 && !m[p - W]) || (y < H - 1 && !m[p + W]);
  };
  const set = (p, c) => { d[p * 4] = c[0]; d[p * 4 + 1] = c[1]; d[p * 4 + 2] = c[2]; };

  // 1) bulges into the grass and bites into the road, up to ~4 px
  const next = isPath.slice();
  for (let p = 0; p < W * H; p++) {
    if (!isPath[p] || !boundary(isPath, p)) continue;
    const x = p % W, y = (p - x) / W;
    const n = noise(x, y, 9) * 2 - 1; // -1 … 1
    const r = Math.round(Math.abs(n) * 4);
    if (!r) continue;
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (dx * dx + dy * dy > r * r) continue;
        const qx = x + dx, qy = y + dy;
        if (qx < 0 || qy < 0 || qx >= W || qy >= H) continue;
        const q = qy * W + qx;
        if (n > 0 && isGrass[q]) { next[q] = 1; set(q, path); }
        else if (n < 0 && isPath[q]) { next[q] = 0; set(q, grass); }
      }
    }
  }

  // 2) a darker trodden rim along the new edge, and a few pebbles near it
  const rim = path.map((v) => Math.round(v * 0.78));
  const pebble = path.map((v) => Math.round(v * 0.6));
  for (let p = 0; p < W * H; p++) {
    if (!next[p] || !boundary(next, p)) continue;
    set(p, rim);
    const x = p % W, y = (p - x) / W;
    if (hash(x, y) < 0.012) {
      const px = x + Math.round((hash(y, x) - 0.5) * 10), py = y + Math.round((hash(x + 7, y) - 0.5) * 10);
      for (const [ox, oy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) {
        const q = (py + oy) * W + (px + ox);
        if (q >= 0 && q < W * H && next[q]) set(q, pebble);
      }
    }
  }
  ctx.putImageData(img, 0, 0);
  return out;
}

function rgb(hex) {
  const n = parseInt(hex.replace('#', ''), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

// Rough hand-drawn road: a polyline with a little wobble.
function road(ctx, pts, width) {
  ctx.lineWidth = width;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  ctx.stroke();
}

/**
 * Fill `map` with a ready-to-play sample: four roads from the edges to a ring
 * road around the centre, 10 spots outside the ring, 4 caves. Returns the canvas.
 */
export function drawSampleMap(map) {
  const { width: W, height: H } = map.world;
  const cx = W / 2, cy = H / 2;
  const c = makeCanvas(W, H);
  const ctx = c.getContext('2d');
  ctx.fillStyle = map.palette.grass;
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = map.palette.path;

  road(ctx, [[0, 140], [220, 170], [380, 260], [cx - 120, cy - 40]], 44);
  road(ctx, [[W, 120], [1050, 160], [900, 250], [cx + 120, cy - 40]], 44);
  road(ctx, [[cx - 60, H], [cx - 90, 600], [cx - 40, 500], [cx - 20, cy + 110]], 44);
  road(ctx, [[W, 600], [1060, 560], [900, 470], [cx + 120, cy + 50]], 44);
  ctx.lineWidth = 44;
  ctx.beginPath();
  ctx.ellipse(cx, cy, 140, 110, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath(); // village square
  ctx.fillStyle = map.palette.path;
  ctx.ellipse(cx, cy, 70, 50, 0, 0, Math.PI * 2);
  ctx.fill();
  road(ctx, [[cx - 140, cy], [cx + 140, cy]], 30);

  map.centre = { x: cx, y: cy, radius: CENTRE_RADIUS };
  map.spots = Array.from({ length: 10 }, (_, i) => {
    const a = (i / 10) * Math.PI * 2 + 0.3;
    return { id: newId(), x: Math.round(cx + Math.cos(a) * 205), y: Math.round(cy + Math.sin(a) * 165) };
  });
  map.caves = [
    { id: newId(), x: 20, y: 140 },
    { id: newId(), x: W - 20, y: 120 },
    { id: newId(), x: cx - 60, y: H - 20 },
    { id: newId(), x: W - 20, y: 600 },
  ];
  map.heroRespawn = { x: cx, y: cy + 40 };
  return c;
}
