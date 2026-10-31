// The game's own pictures of the permanent built-ins (config/components.js
// PERMANENT_IDS) as bitmaps, for the studio: the default projectiles drawn like
// the game draws them (game/scene/Textures.js) and the built-in surfaces
// (maps/textures.js). Shown while a kid hasn't replaced the picture; the
// drawing pad starts from it. Nothing is stored – the game draws its own.

import { GAME_LOOKS, SURFACE_NAMES } from '../config/components.js';
import { builtInTexture } from '../maps/textures.js';
import { makeCanvas } from './imageEncoding.js';

const SIZE = 64; // a projectile's picture size (assets/categories.js)
const cache = new Map();

const PROJECTILES = {
  // a wooden shaft with a grey tip and feathers
  projectile: (g) => {
    g.lineCap = 'round';
    g.strokeStyle = '#78350f'; g.lineWidth = 6;
    g.beginPath(); g.moveTo(8, 32); g.lineTo(52, 32); g.stroke();
    g.fillStyle = '#374151';
    g.beginPath(); g.moveTo(50, 21); g.lineTo(62, 32); g.lineTo(50, 43); g.closePath(); g.fill();
    g.strokeStyle = '#b91c1c'; g.lineWidth = 3;
    for (const dy of [-1, 1]) { g.beginPath(); g.moveTo(14, 32); g.lineTo(6, 32 + dy * 9); g.stroke(); }
  },
  magic: (g) => {
    g.fillStyle = 'rgba(192,132,252,0.5)'; g.beginPath(); g.arc(32, 32, 26, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#a855f7'; g.beginPath(); g.arc(32, 32, 16, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#ffffff'; g.beginPath(); g.arc(26, 26, 6, 0, Math.PI * 2); g.fill();
  },
  stone: (g) => {
    g.fillStyle = '#78716c'; g.beginPath(); g.arc(32, 32, 20, 0, Math.PI * 2); g.fill();
    g.strokeStyle = '#1e293b'; g.lineWidth = 5; g.stroke();
    g.fillStyle = '#a8a29e'; g.beginPath(); g.arc(26, 26, 6, 0, Math.PI * 2); g.fill();
  },
};

/** The game's picture of a permanent built-in as a data URL (null for anything else, or outside a browser). */
export function defaultPicture(id) {
  if (cache.has(id)) return cache.get(id);
  if (typeof document === 'undefined') return null;
  let url = null;
  if (GAME_LOOKS[id]) {
    const c = makeCanvas(SIZE, SIZE);
    PROJECTILES[GAME_LOOKS[id]](c.getContext('2d'));
    url = c.toDataURL('image/png');
  } else if (SURFACE_NAMES[id]) {
    const tex = builtInTexture(id);
    const c = makeCanvas(tex.width, tex.height);
    c.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(tex.data), tex.width, tex.height), 0, 0);
    url = c.toDataURL('image/png');
  }
  cache.set(id, url);
  return url;
}
