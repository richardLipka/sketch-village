import { describe, it, expect } from 'vitest';
import { builtInTexture, BUILT_IN_IDS, applyTextures, terrainColours, hexRgb } from './textures.js';

const PALETTE = { path: '#f2d24b', grass: '#8cc66a' };

// a W×H picture: left half road, right half grass, a dark pencil line, a blue pond
function picture(W = 40, H = 20) {
  const data = new Uint8ClampedArray(W * H * 4);
  const set = (x, y, [r, g, b]) => { const i = (y * W + x) * 4; data[i] = r; data[i + 1] = g; data[i + 2] = b; data[i + 3] = 255; };
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) set(x, y, x < W / 2 ? hexRgb(PALETTE.path) : hexRgb(PALETTE.grass));
  for (let y = 0; y < H; y++) set(25, y, [31, 41, 55]); // pencil
  for (let y = 2; y < 8; y++) for (let x = 30; x < 38; x++) set(x, y, [37, 99, 235]); // pond
  set(5, 5, hexRgb(PALETTE.path).map((v) => Math.round(v * 0.78))); // the rugged road rim
  return { width: W, height: H, data };
}
const px = (img, x, y) => Array.from(img.data.slice((y * img.width + x) * 4, (y * img.width + x) * 4 + 3));

describe('terrain textures', () => {
  it('built-in textures are deterministic and opaque', () => {
    for (const id of BUILT_IN_IDS) {
      const a = builtInTexture(id, 32), b = builtInTexture(id, 32);
      expect(a.data).toEqual(b.data);
      for (let i = 3; i < a.data.length; i += 4) expect(a.data[i]).toBe(255);
    }
    expect(builtInTexture('nothing')).toBeNull();
  });

  it('finds the colours a map is painted with: road and grass first, then big areas', () => {
    const cols = terrainColours(picture(), PALETTE, { minShare: 0.04 }); // tiny test picture: pencil 2.5 %, pond 6 %
    expect(cols.slice(0, 2)).toEqual([PALETTE.path, PALETTE.grass]);
    expect(cols).toContain('#2563eb'); // the pond
    expect(cols).not.toContain('#1f2937'); // a thin pencil line isn't terrain
  });

  it('covers a colour with its texture, tiled, keeps the rim shading and leaves pencil lines', () => {
    const img = picture();
    const cobble = builtInTexture('cobble', 8);
    const out = applyTextures(img, [{ colour: PALETTE.path, texture: cobble }]);
    // road pixels = texture pixels (tiled every 8 px)
    expect(px(out, 1, 1)).toEqual(Array.from(cobble.data.slice((1 * 8 + 1) * 4, (1 * 8 + 1) * 4 + 3)));
    expect(px(out, 9, 1)).toEqual(px(out, 1, 1));
    // the darker rim stays darker: texture × 0.78
    const t = Array.from(cobble.data.slice((5 * 8 + 5) * 4, (5 * 8 + 5) * 4 + 3));
    px(out, 5, 5).forEach((v, k) => expect(Math.abs(v - t[k] * 0.78)).toBeLessThanOrEqual(1));
    // grass (not textured), pencil and pond unchanged
    expect(px(out, 30, 15)).toEqual(hexRgb(PALETTE.grass));
    expect(px(out, 25, 3)).toEqual([31, 41, 55]);
    expect(px(out, 32, 4)).toEqual([37, 99, 235]);
    // the original picture is untouched (the walkable grid is computed from it)
    expect(px(img, 1, 1)).toEqual(hexRgb(PALETTE.path));
  });

  it('several colours at once; nothing to do without layers', () => {
    const img = picture();
    const out = applyTextures(img, [{ colour: PALETTE.grass, texture: builtInTexture('grass', 16) }, { colour: '#2563eb', texture: builtInTexture('water', 16) }]);
    expect(px(out, 30, 15)).not.toEqual(hexRgb(PALETTE.grass));
    expect(px(out, 32, 4)).not.toEqual([37, 99, 235]);
    expect(px(out, 1, 1)).toEqual(hexRgb(PALETTE.path));
    expect(applyTextures(img, [])).toBe(img);
  });
});
