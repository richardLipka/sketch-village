// Animations of a component (SPEC §3.4): optional frame sequences next to the
// still picture – walking and attacking for heroes, enemies and soldiers,
// attacking and reloading for buildings. Kids draw a strip of 4–12 frames on
// one sheet of paper, photograph or open it, and the editor cuts it into
// frames; each frame can be nudged so it lines up with the previous one.
//
//   component.anims = { walk: { frames: [dataURL…], fps, offsets: [[dx, dy]…] }, attack: {…} }
//
// Without an animation the game shows the still picture, as before.

import { makeCanvas, loadImage, encodeCanvas } from './imageEncoding.js';
import { removePaper, estimatePaperColor } from './bgRemoval.js';

export const MIN_FRAMES = 4;
export const MAX_FRAMES = 12;
export const DEFAULT_FPS = 8;
export const MIN_FPS = 2;
export const MAX_FPS = 20;

/** Which animations a kind of component can have. */
export const ANIM_KINDS = { walk: '🚶', attack: '⚔️', reload: '🔄' };

/**
 * Frame number at `ms` after the start: looping, or for a one-shot the frame
 * until it is over (then null).
 */
export function frameAt(count, fps, ms, loop = true) {
  if (!count) return null;
  const i = Math.floor((Math.max(0, ms) / 1000) * fps);
  if (loop) return i % count;
  return i < count ? i : null;
}

/** Cut a w×h strip into n frames: side by side when it is wider than tall, else one under another. */
export function stripRects(w, h, n, dir = w >= h ? 'h' : 'v') {
  return Array.from({ length: n }, (_, i) => (dir === 'h'
    ? { x: Math.round((i * w) / n), y: 0, w: Math.round(((i + 1) * w) / n) - Math.round((i * w) / n), h }
    : { x: 0, y: Math.round((i * h) / n), w, h: Math.round(((i + 1) * h) / n) - Math.round((i * h) / n) }));
}

/**
 * Guess how many frames a strip has: the drawings are separated by gaps of
 * plain paper, so count the runs of columns (or rows) with ink in them.
 * Returns null when the guess is outside MIN_FRAMES..MAX_FRAMES.
 */
export function guessFrameCount({ data, width: w, height: h }, dir = w >= h ? 'h' : 'v') {
  const paper = estimatePaperColor(data, w, h);
  const ink = (x, y) => {
    const i = (y * w + x) * 4;
    return data[i + 3] > 100 && Math.abs(data[i] - paper[0]) + Math.abs(data[i + 1] - paper[1]) + Math.abs(data[i + 2] - paper[2]) > 90;
  };
  const along = dir === 'h' ? w : h, across = dir === 'h' ? h : w;
  const step = Math.max(1, Math.floor(across / 120));
  let runs = 0, inRun = false, gap = 0;
  const minGap = Math.max(2, Math.round(along / 200));
  for (let a = 0; a < along; a++) {
    let has = false;
    for (let b = 0; b < across && !has; b += step) has = dir === 'h' ? ink(a, b) : ink(b, a);
    if (has) { if (!inRun && (gap >= minGap || runs === 0)) runs++; inRun = true; gap = 0; } else { gap++; if (gap >= minGap) inRun = false; }
  }
  return runs >= MIN_FRAMES && runs <= MAX_FRAMES ? runs : null;
}

/** Is there anything to play? */
export const hasAnim = (a) => !!a?.frames?.length;

/** The first frame of any animation – the still picture of something drawn only as an animation. */
export const firstFrame = (anims) => Object.values(anims ?? {}).find(hasAnim)?.frames[0] ?? null;

// ---------------- frames as panels (pure) ----------------
// The animation editor shows the frames as panels side by side; each can be
// drawn, photographed, uploaded or pasted, copied, moved or removed. These keep
// the frames and their alignment offsets together; null = no animation left.

const withFrames = (anim, frames, offsets) => (frames.length ? { fps: anim?.fps ?? DEFAULT_FPS, ...anim, frames, offsets } : null);
const offsetsOf = (anim) => (anim?.frames ?? []).map((_, i) => anim.offsets?.[i] ?? [0, 0]);

/** A new frame at `at` (default: the end); at most MAX_FRAMES. */
export function insertFrame(anim, src, at = anim?.frames?.length ?? 0) {
  const frames = [...(anim?.frames ?? [])], offsets = offsetsOf(anim);
  if (frames.length >= MAX_FRAMES) return anim;
  frames.splice(at, 0, src);
  offsets.splice(at, 0, [0, 0]);
  return withFrames(anim, frames, offsets);
}

/** A new picture for frame i (its alignment starts over). */
export function replaceFrame(anim, i, src) {
  if (!src) return removeFrame(anim, i);
  const frames = [...anim.frames], offsets = offsetsOf(anim);
  frames[i] = src;
  offsets[i] = [0, 0];
  return withFrames(anim, frames, offsets);
}

/** A copy of frame i right after it, lined up the same – the flip-book way: copy, then change a little. */
export function duplicateFrame(anim, i) {
  if (anim.frames.length >= MAX_FRAMES) return anim;
  const frames = [...anim.frames], offsets = offsetsOf(anim);
  frames.splice(i + 1, 0, frames[i]);
  offsets.splice(i + 1, 0, [...offsets[i]]);
  return withFrames(anim, frames, offsets);
}

/** Frame i one place earlier (-1) or later (+1). */
export function moveFrame(anim, i, by) {
  const j = i + by;
  if (j < 0 || j >= anim.frames.length) return anim;
  const frames = [...anim.frames], offsets = offsetsOf(anim);
  [frames[i], frames[j]] = [frames[j], frames[i]];
  [offsets[i], offsets[j]] = [offsets[j], offsets[i]];
  return withFrames(anim, frames, offsets);
}

export function removeFrame(anim, i) {
  const frames = anim.frames.filter((_, k) => k !== i), offsets = offsetsOf(anim).filter((_, k) => k !== i);
  return withFrames(anim, frames, offsets);
}

// ---------------- canvas helpers (browser) ----------------

/** guessFrameCount for a strip picture (data URL). */
export async function guessStripFrames(src) {
  const img = await loadImage(src);
  const k = Math.min(1, 600 / Math.max(img.width, img.height)); // a smaller copy is plenty
  const c = makeCanvas(Math.round(img.width * k), Math.round(img.height * k));
  const ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(img, 0, 0, c.width, c.height);
  return guessFrameCount(ctx.getImageData(0, 0, c.width, c.height));
}

/**
 * Cut a strip picture into frames, each fitted into a size×size square (the
 * same size as the still picture), optionally with the paper removed.
 */
export async function sliceStrip(src, n, { size = 128, dir, removeBg = true } = {}) {
  const img = await loadImage(src);
  const rects = stripRects(img.width, img.height, n, dir);
  return rects.map((r) => {
    const cut = makeCanvas(r.w, r.h);
    const cctx = cut.getContext('2d', { willReadFrequently: true });
    cctx.drawImage(img, r.x, r.y, r.w, r.h, 0, 0, r.w, r.h);
    if (removeBg) {
      const data = cctx.getImageData(0, 0, r.w, r.h);
      removePaper(data.data, r.w, r.h, { tolerance: 35 });
      cctx.putImageData(data, 0, 0);
    }
    const out = makeCanvas(size, size);
    const k = Math.min(size / r.w, size / r.h);
    const w = r.w * k, h = r.h * k;
    out.getContext('2d').drawImage(cut, (size - w) / 2, (size - h) / 2, w, h);
    return encodeCanvas(out);
  });
}

/** A frame drawn with its alignment offset, on a canvas the size of the frame. */
export function composeFrame(img, offset, size = img.width) {
  const c = makeCanvas(size, size);
  const [dx, dy] = offset ?? [0, 0];
  c.getContext('2d').drawImage(img, dx, dy, size, size);
  return c;
}

/** Load all frames of an animation as images (cached per data URL). */
const imgCache = new Map();
export async function loadFrames(anim) {
  return Promise.all((anim?.frames ?? []).map(async (src) => {
    if (!imgCache.has(src)) imgCache.set(src, await loadImage(src));
    return imgCache.get(src);
  }));
}
