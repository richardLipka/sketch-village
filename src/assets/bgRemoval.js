// Paper background removal for photographed drawings.
//
// Pure functions over RGBA pixel arrays (no DOM), so they are unit-tested.
// The paper colour is estimated from the image border (photos are lit unevenly,
// so a fixed "white" doesn't work). Pixels close to that colour become
// transparent: by default only those connected to the border (flood fill), so
// white parts *inside* a drawing (eyes, windows) survive; `inside: true` also
// clears enclosed paper areas (e.g. the gap between a hero's legs).

/** Median colour of the outermost pixel ring. */
export function estimatePaperColor(data, w, h) {
  const rs = [], gs = [], bs = [];
  const push = (x, y) => {
    const i = (y * w + x) * 4;
    rs.push(data[i]); gs.push(data[i + 1]); bs.push(data[i + 2]);
  };
  for (let x = 0; x < w; x++) { push(x, 0); push(x, h - 1); }
  for (let y = 1; y < h - 1; y++) { push(0, y); push(w - 1, y); }
  const med = (a) => { a.sort((p, q) => p - q); return a[a.length >> 1]; };
  return [med(rs), med(gs), med(bs)];
}

function colorDistance(data, i, [r, g, b]) {
  const dr = data[i] - r, dg = data[i + 1] - g, db = data[i + 2] - b;
  return Math.sqrt(dr * dr + dg * dg + db * db);
}

/**
 * Make paper pixels transparent, in place.
 * @param {Uint8ClampedArray} data RGBA
 * @param {number} w
 * @param {number} h
 * @param {{tolerance?: number, inside?: boolean, softness?: number}} opts
 *   tolerance – 0..100, how different from paper a pixel may be and still count as paper
 *   inside    – also clear paper areas not connected to the border
 *   softness  – width (in colour distance) of the semi-transparent edge band
 * @returns {number} count of fully cleared pixels
 */
export function removePaper(data, w, h, { tolerance = 35, inside = false, softness = 20 } = {}) {
  const paper = estimatePaperColor(data, w, h);
  const limit = (tolerance / 100) * 441; // 441 ≈ max RGB distance
  const n = w * h;
  const isPaper = new Uint8Array(n);
  for (let p = 0; p < n; p++) {
    if (colorDistance(data, p * 4, paper) <= limit) isPaper[p] = 1;
  }

  let clear;
  if (inside) {
    clear = isPaper;
  } else {
    // Flood fill from every border paper pixel.
    clear = new Uint8Array(n);
    const stack = [];
    const seed = (p) => { if (isPaper[p] && !clear[p]) { clear[p] = 1; stack.push(p); } };
    for (let x = 0; x < w; x++) { seed(x); seed((h - 1) * w + x); }
    for (let y = 0; y < h; y++) { seed(y * w); seed(y * w + w - 1); }
    while (stack.length) {
      const p = stack.pop();
      const x = p % w, y = (p / w) | 0;
      if (x > 0) seed(p - 1);
      if (x < w - 1) seed(p + 1);
      if (y > 0) seed(p - w);
      if (y < h - 1) seed(p + w);
    }
  }

  let cleared = 0;
  for (let p = 0; p < n; p++) {
    const i = p * 4;
    if (clear[p]) {
      data[i + 3] = 0;
      cleared++;
    } else if (softness > 0 && hasClearedNeighbour(clear, p, w, h)) {
      // Anti-alias the outline: pixels just above the threshold fade out.
      const d = colorDistance(data, i, paper) - limit;
      if (d < softness) data[i + 3] = Math.round(data[i + 3] * Math.max(0, d) / softness);
    }
  }
  return cleared;
}

function hasClearedNeighbour(clear, p, w, h) {
  const x = p % w, y = (p / w) | 0;
  return (x > 0 && clear[p - 1]) || (x < w - 1 && clear[p + 1]) ||
    (y > 0 && clear[p - w]) || (y < h - 1 && clear[p + w]);
}

/**
 * Darken and saturate the remaining strokes so faint pencil reads well in game.
 * amount 0..100. In place, ignores transparent pixels.
 */
export function boostInk(data, amount = 30) {
  if (amount <= 0) return;
  const k = 1 + amount / 50; // contrast factor up to 3
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] === 0) continue;
    for (let c = 0; c < 3; c++) {
      const v = (data[i + c] - 200) * k + 200; // pivot near paper white → strokes get darker
      data[i + c] = v < 0 ? 0 : v > 255 ? 255 : v;
    }
  }
}

/**
 * Magic-wand: clear the region of similar colour connected to (sx, sy). In place.
 * tolerance 0..100.
 */
export function floodErase(data, w, h, sx, sy, tolerance = 25) {
  const start = (sy * w + sx) * 4;
  const target = [data[start], data[start + 1], data[start + 2]];
  const targetA = data[start + 3];
  const limit = (tolerance / 100) * 441;
  const seen = new Uint8Array(w * h);
  const stack = [sy * w + sx];
  seen[sy * w + sx] = 1;
  while (stack.length) {
    const p = stack.pop();
    const i = p * 4;
    data[i + 3] = 0;
    const x = p % w, y = (p / w) | 0;
    const tryP = (q) => {
      if (seen[q]) return;
      const j = q * 4;
      const sameAlpha = (targetA === 0) === (data[j + 3] === 0);
      if (sameAlpha && (targetA === 0 || colorDistance(data, j, target) <= limit)) {
        seen[q] = 1;
        stack.push(q);
      }
    };
    if (x > 0) tryP(p - 1);
    if (x < w - 1) tryP(p + 1);
    if (y > 0) tryP(p - w);
    if (y < h - 1) tryP(p + w);
  }
}
