// The map editor's overlay (maps/MapPainter.jsx): the walkable grid, the
// decorations, the Town Hall circle, building spots, caves, the selection frame
// with its handles and the polygon being drawn for a fill. Pure drawing.

import { CENTRE_RADIUS } from '../logic/mapModel.js';
import { decorSize, handlePoints } from './decorEdit.js';

const HANDLE = 9; // px half-size of a frame handle as drawn

/**
 * Draw everything on top of the bitmap.
 * images: { [assetId], townhall?, cave? } loaded pictures (missing ones get an outline)
 */
export function drawOverlay(ctx, { map, grid, showGrid, images, sel, poly, centreLabel }) {
  const { width: W, height: H } = map.world;
  ctx.clearRect(0, 0, W, H);

  if (showGrid && grid) {
    ctx.fillStyle = 'rgba(30,58,138,0.22)';
    for (let y = 0; y < grid.rows; y++) for (let x = 0; x < grid.cols; x++) {
      if (grid.walk[y * grid.cols + x]) ctx.fillRect(x * grid.cell + 1, y * grid.cell + 1, grid.cell - 2, grid.cell - 2);
    }
  }

  for (const d of map.decorations) {
    const img = images[d.asset];
    const { w, h } = decorSize(d);
    if (img) ctx.drawImage(img, d.x - w / 2, d.y - h / 2, w, h);
    else { ctx.save(); ctx.strokeStyle = '#16653480'; ctx.strokeRect(d.x - w / 2, d.y - h / 2, w, h); ctx.restore(); } // still loading
  }

  ctx.lineWidth = 3;
  ctx.strokeStyle = '#1e3a8a';
  ctx.fillStyle = '#1e3a8a';
  ctx.font = '22px "Patrick Hand", cursive';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  if (map.centre) {
    ctx.save();
    ctx.setLineDash([10, 8]);
    ctx.beginPath();
    ctx.arc(map.centre.x, map.centre.y, map.centre.radius ?? CENTRE_RADIUS, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
    const img = images.townhall;
    if (img) ctx.drawImage(img, map.centre.x - 48, map.centre.y - 48, 96, 96);
    else ctx.fillText(centreLabel, map.centre.x, map.centre.y);
  }

  map.spots.forEach((s, i) => {
    ctx.save();
    ctx.setLineDash([6, 5]);
    ctx.fillStyle = 'rgba(255,253,247,0.75)';
    ctx.fillRect(s.x - 26, s.y - 26, 52, 52);
    ctx.strokeRect(s.x - 26, s.y - 26, 52, 52);
    ctx.restore();
    ctx.fillText(String(i + 1), s.x, s.y);
  });

  for (const cv of map.caves) {
    const img = images.cave;
    if (img) ctx.drawImage(img, cv.x - 32, cv.y - 32, 64, 64);
    else {
      ctx.save();
      ctx.fillStyle = '#3f3f46';
      ctx.beginPath();
      ctx.arc(cv.x, cv.y + 10, 26, Math.PI, 0);
      ctx.lineTo(cv.x + 26, cv.y + 18);
      ctx.lineTo(cv.x - 26, cv.y + 18);
      ctx.fill();
      ctx.restore();
    }
  }

  // the selected thing: a frame; a decoration also gets its 8 handles
  const picked = sel && (sel.kind === 'centre' ? map.centre : map[sel.kind]?.[sel.i]);
  if (picked) {
    ctx.save();
    ctx.strokeStyle = '#ca8a04';
    ctx.lineWidth = 3;
    ctx.setLineDash([8, 5]);
    if (sel.kind === 'decorations') {
      const { w, h } = decorSize(picked);
      ctx.strokeRect(picked.x - w / 2, picked.y - h / 2, w, h);
      ctx.setLineDash([]);
      ctx.fillStyle = '#fde68a';
      ctx.lineWidth = 2;
      for (const hp of handlePoints(picked)) {
        ctx.fillRect(hp.x - HANDLE, hp.y - HANDLE, HANDLE * 2, HANDLE * 2);
        ctx.strokeRect(hp.x - HANDLE, hp.y - HANDLE, HANDLE * 2, HANDLE * 2);
      }
    } else {
      ctx.beginPath();
      ctx.arc(picked.x, picked.y, sel.kind === 'centre' ? (picked.radius ?? CENTRE_RADIUS) + 10 : 36, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }

  // the polygon being drawn for a fill
  if (poly.length) {
    ctx.save();
    ctx.strokeStyle = '#7c3aed';
    ctx.fillStyle = 'rgba(124,58,237,0.12)';
    ctx.lineWidth = 3;
    ctx.setLineDash([10, 6]);
    ctx.beginPath();
    poly.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
    if (poly.length > 2) { ctx.closePath(); ctx.fill(); }
    ctx.stroke();
    ctx.setLineDash([]);
    poly.forEach((p, i) => {
      ctx.fillStyle = i === 0 ? '#7c3aed' : '#fff';
      ctx.beginPath();
      ctx.arc(p.x, p.y, i === 0 ? 10 : 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    });
    ctx.restore();
  }
}
