// Small pixel helpers shared by the sketch pad and the map painter.

export function hexToRgba(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255, 255];
}

/** Paint-bucket fill of the connected same-colour region, in place. tolerance 0..100. */
export function floodFill(data, w, h, sx, sy, rgba, tolerance = 20) {
  const s = (sy * w + sx) * 4;
  const target = [data[s], data[s + 1], data[s + 2], data[s + 3]];
  if (target.every((v, i) => v === rgba[i])) return;
  const limit = (tolerance / 100) * 510;
  const match = (i) => {
    if (target[3] === 0) return data[i + 3] < 40; // filling a transparent area
    const dr = data[i] - target[0], dg = data[i + 1] - target[1], db = data[i + 2] - target[2], da = data[i + 3] - target[3];
    return Math.sqrt(dr * dr + dg * dg + db * db + da * da) <= limit;
  };
  const seen = new Uint8Array(w * h);
  const stack = [sy * w + sx];
  seen[sy * w + sx] = 1;
  while (stack.length) {
    const p = stack.pop();
    const i = p * 4;
    data[i] = rgba[0]; data[i + 1] = rgba[1]; data[i + 2] = rgba[2]; data[i + 3] = rgba[3];
    const x = p % w, y = (p / w) | 0;
    for (const q of [x > 0 && p - 1, x < w - 1 && p + 1, y > 0 && p - w, y < h - 1 && p + w]) {
      if (q === false || seen[q]) continue;
      if (match(q * 4)) { seen[q] = 1; stack.push(q); }
    }
  }
}
