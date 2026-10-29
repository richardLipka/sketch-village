// Shared image sizing/encoding for all assets (ported from simple_editable_train).
//
// Every asset is stored as a base64 data URL so it can travel inside the single
// JSON save file. We keep them small: downscale to the category size and encode
// as WebP (alpha-capable, much smaller than PNG), falling back to PNG.

let webpSupported = null;

function supportsWebp() {
  if (webpSupported !== null) return webpSupported;
  try {
    const c = document.createElement('canvas');
    c.width = 1;
    c.height = 1;
    webpSupported = c.toDataURL('image/webp').startsWith('data:image/webp');
  } catch {
    webpSupported = false;
  }
  return webpSupported;
}

/** Encode a canvas as a compact data URL: WebP when available, otherwise PNG. */
export function encodeCanvas(canvas, quality = 0.85) {
  if (supportsWebp()) {
    const url = canvas.toDataURL('image/webp', quality);
    if (url.startsWith('data:image/webp')) return url;
  }
  return canvas.toDataURL('image/png');
}

export function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

export function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

/**
 * Downscale an image to a square `size` canvas and re-encode.
 * `contain` letterboxes with transparent padding (default, keeps the whole
 * drawing); `cover` centre-crops.
 */
export async function normalizeAssetImage(src, { size = 128, quality = 0.85, fit = 'contain' } = {}) {
  const img = await loadImage(src);
  const iw = img.naturalWidth || img.width;
  const ih = img.naturalHeight || img.height;
  if (!iw || !ih) return src;
  const canvas = makeCanvas(size, size);
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  const scale = fit === 'cover' ? Math.max(size / iw, size / ih) : Math.min(size / iw, size / ih);
  const dw = iw * scale;
  const dh = ih * scale;
  ctx.drawImage(img, (size - dw) / 2, (size - dh) / 2, dw, dh);
  return encodeCanvas(canvas, quality);
}
