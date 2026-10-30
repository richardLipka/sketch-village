// Terrain textures (SPEC §5.2). In the map editor kids paint with plain colours
// (so the bucket fills exactly and the road colour still says where enemies
// walk); every colour can then be covered by a texture in the game – grass,
// cobblestones, water… – either a built-in one drawn here or a photo / drawing
// from the studio (`texture` components).
//
//   map.textures = { '#rrggbb': textureId }   textureId = built-in id or component id
//
// Pure pixel work on ImageData-like objects ({ width, height, data }), so it is
// unit-tested; the canvas helpers are at the bottom.

import { makeCanvas, loadImage } from '../assets/imageEncoding.js';

export const TEXTURE_SIZE = 128;

// built-in textures: base colours + how they are speckled
export const BUILT_IN_TEXTURES = {
  grass: { base: [124, 179, 92], dark: [92, 145, 66], light: [158, 205, 112], blades: true },
  meadow: { base: [134, 188, 96], dark: [100, 155, 72], light: [165, 210, 120], blades: true, flowers: [[250, 204, 21], [244, 114, 182], [255, 255, 255]] },
  dirt: { base: [176, 137, 94], dark: [140, 104, 68], light: [200, 165, 120], pebbles: true },
  sand: { base: [230, 207, 150], dark: [208, 182, 124], light: [244, 228, 184] },
  cobble: { base: [158, 152, 140], dark: [104, 98, 90], light: [196, 190, 178], cobbles: true },
  stone: { base: [130, 128, 124], dark: [92, 90, 88], light: [170, 168, 162], cracks: true },
  water: { base: [76, 141, 214], dark: [52, 108, 182], light: [150, 196, 240], waves: true },
  snow: { base: [236, 242, 248], dark: [205, 216, 228], light: [255, 255, 255] },
};
export const BUILT_IN_IDS = Object.keys(BUILT_IN_TEXTURES);

function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A built-in texture as { width, height, data } (tiles seamlessly – everything wraps around). */
export function builtInTexture(id, size = TEXTURE_SIZE) {
  const spec = BUILT_IN_TEXTURES[id];
  if (!spec) return null;
  const data = new Uint8ClampedArray(size * size * 4);
  const r = rng([...id].reduce((h, c) => Math.imul(h ^ c.charCodeAt(0), 16777619), 2166136261));
  const put = (x, y, c, k = 1) => {
    const i = ((((y % size) + size) % size) * size + (((x % size) + size) % size)) * 4;
    for (let j = 0; j < 3; j++) data[i + j] = data[i + j] * (1 - k) + c[j] * k;
  };
  // base with soft noise
  for (let p = 0; p < size * size; p++) {
    const n = r();
    const c = n < 0.18 ? spec.dark : n > 0.86 ? spec.light : spec.base;
    const k = 0.35 + r() * 0.3;
    for (let j = 0; j < 3; j++) data[p * 4 + j] = spec.base[j] * (1 - k) + c[j] * k;
    data[p * 4 + 3] = 255;
  }
  const dots = (n, rad, pick) => {
    for (let i = 0; i < n; i++) {
      const cx = Math.floor(r() * size), cy = Math.floor(r() * size), c = pick();
      for (let dy = -rad; dy <= rad; dy++) for (let dx = -rad; dx <= rad; dx++) if (dx * dx + dy * dy <= rad * rad) put(cx + dx, cy + dy, c, 0.9);
    }
  };
  if (spec.blades) {
    for (let i = 0; i < size * 3; i++) {
      const x = Math.floor(r() * size), y = Math.floor(r() * size), h = 2 + Math.floor(r() * 4), c = r() < 0.5 ? spec.dark : spec.light;
      for (let k = 0; k < h; k++) put(x + (k > 2 ? 1 : 0), y - k, c, 0.8);
    }
  }
  if (spec.flowers) dots(size / 6, 1, () => spec.flowers[Math.floor(r() * spec.flowers.length)]);
  if (spec.pebbles) dots(size / 3, 1, () => (r() < 0.5 ? spec.dark : spec.light));
  if (spec.cobbles) {
    // rounded stones in rows, dark gaps between
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      const row = Math.floor(y / 16), off = row % 2 ? 10 : 0;
      const lx = (x + off) % 20, ly = y % 16;
      if (lx < 2 || ly < 2) put(x, y, spec.dark, 0.85);
      else if (lx < 4 || ly < 4) put(x, y, spec.light, 0.25);
    }
  }
  if (spec.cracks) {
    for (let i = 0; i < 9; i++) {
      let x = r() * size, y = r() * size, a = r() * Math.PI * 2;
      for (let k = 0; k < 26; k++) { put(Math.floor(x), Math.floor(y), spec.dark, 0.9); a += (r() - 0.5) * 0.9; x += Math.cos(a); y += Math.sin(a); }
    }
  }
  if (spec.waves) {
    for (let i = 0; i < 18; i++) {
      const x0 = r() * size, y0 = r() * size, len = 10 + r() * 14;
      for (let k = 0; k < len; k++) put(Math.floor(x0 + k), Math.floor(y0 + Math.sin(k / 3) * 2), spec.light, 0.8);
    }
  }
  return { width: size, height: size, data };
}

export function hexRgb(hex) {
  const n = parseInt(String(hex).replace('#', ''), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
const toHex = (r, g, b) => `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;

/**
 * The colours a map is painted with, most used first: the road and grass colours
 * always, then every other colour covering at least `minShare` of the picture
 * (bucket fills, big pencil areas). Thin pencil lines don't count.
 */
export function terrainColours(img, palette, { minShare = 0.004, max = 8 } = {}) {
  const counts = new Map();
  const { data } = img;
  let n = 0;
  for (let i = 0; i < data.length; i += 4 * 3) { // every 3rd pixel is plenty
    if (data[i + 3] < 200) continue;
    const key = (data[i] << 16) | (data[i + 1] << 8) | data[i + 2];
    counts.set(key, (counts.get(key) ?? 0) + 1);
    n++;
  }
  const fixed = [palette.path, palette.grass].map((c) => c.toLowerCase());
  const others = [...counts].filter(([, c]) => c / n >= minShare).sort((a, b) => b[1] - a[1])
    .map(([k]) => toHex((k >> 16) & 255, (k >> 8) & 255, k & 255))
    .filter((h) => !fixed.includes(h));
  return [...fixed, ...others].slice(0, max);
}

/**
 * Cover the painted colours with textures. `layers` = [{ colour: '#rrggbb', texture }]
 * with texture = { width, height, data }. A pixel takes the texture of its colour
 * – also a darker / lighter shade of it (the rugged road rim and pebbles), which
 * keeps that shading – and an in-between pixel (soft brush edge) the texture of
 * the nearest colour. Pixels far from every colour (pencil lines) stay as drawn.
 */
export function applyTextures(img, layers) {
  if (!layers.length) return img;
  const cols = layers.map((l) => ({ c: hexRgb(l.colour), t: l.texture }));
  const { width: W, height: H, data } = img;
  const out = new Uint8ClampedArray(data);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4;
      const p0 = data[i], p1 = data[i + 1], p2 = data[i + 2];
      let best = null, bd = Infinity, shade = 1;
      for (const l of cols) {
        const [c0, c1, c2] = l.c;
        // a shade s·c of the colour?
        const cc = c0 * c0 + c1 * c1 + c2 * c2 || 1;
        const s = (p0 * c0 + p1 * c1 + p2 * c2) / cc;
        if (s > 0.5 && s < 1.15) {
          const r = Math.abs(p0 - s * c0) + Math.abs(p1 - s * c1) + Math.abs(p2 - s * c2);
          if (r < 24 && r < bd) { best = l; bd = r; shade = s; continue; }
        }
        const d = Math.abs(p0 - c0) + Math.abs(p1 - c1) + Math.abs(p2 - c2);
        if (d < 90 && d + 24 < bd) { best = l; bd = d + 24; shade = 1; }
      }
      if (!best) continue;
      const t = best.t;
      const j = ((y % t.height) * t.width + (x % t.width)) * 4;
      out[i] = t.data[j] * shade;
      out[i + 1] = t.data[j + 1] * shade;
      out[i + 2] = t.data[j + 2] * shade;
    }
  }
  return { width: W, height: H, data: out };
}

// ---------------- canvas helpers (browser) ----------------

const cache = new Map(); // texture id → { width, height, data } (built-ins and loaded photos)

/** Texture pixels for an id: a built-in one, or a `texture` component's picture. */
export async function loadTexture(id, assets = []) {
  if (cache.has(id)) return cache.get(id);
  let tex = builtInTexture(id);
  if (!tex) {
    const src = assets.find((a) => a.id === id)?.images?.find(Boolean);
    if (!src) return null;
    const img = await loadImage(src);
    const c = makeCanvas(TEXTURE_SIZE, TEXTURE_SIZE);
    const ctx = c.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(img, 0, 0, TEXTURE_SIZE, TEXTURE_SIZE);
    tex = ctx.getImageData(0, 0, TEXTURE_SIZE, TEXTURE_SIZE);
  }
  cache.set(id, tex);
  return tex;
}

/** A canvas of the picture with the map's textures (or the same canvas when it has none). */
export async function texturedCanvas(src, textures = {}, assets = []) {
  const entries = Object.entries(textures).filter(([, id]) => id);
  if (!entries.length) return src;
  const layers = [];
  for (const [colour, id] of entries) {
    const texture = await loadTexture(id, assets);
    if (texture) layers.push({ colour, texture });
  }
  if (!layers.length) return src;
  const ctx = src.getContext('2d', { willReadFrequently: true });
  const done = applyTextures(ctx.getImageData(0, 0, src.width, src.height), layers);
  const out = makeCanvas(src.width, src.height);
  out.getContext('2d').putImageData(new ImageData(done.data, done.width, done.height), 0, 0);
  return out;
}

/** A small preview tile (data URL) of a texture for the picker. */
export function textureSwatch(tex, size = 48) {
  const c = makeCanvas(tex.width, tex.height);
  c.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(tex.data), tex.width, tex.height), 0, 0);
  const s = makeCanvas(size, size);
  s.getContext('2d').drawImage(c, 0, 0, tex.width / 2, tex.height / 2, 0, 0, size, size);
  return s.toDataURL();
}
