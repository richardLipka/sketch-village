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
