// Pictures from the clipboard (SPEC §3.3): a screenshot, a picture copied in a
// browser or another app. They then go the same way as a photo or an upload –
// crop, remove paper, touch up.

export const blobToDataUrl = (blob) => new Promise((resolve, reject) => {
  const r = new FileReader();
  r.onload = () => resolve(r.result);
  r.onerror = () => reject(r.error);
  r.readAsDataURL(blob);
});

/** A picture inside pasted HTML (`<img src="data:image/…">`), or null. */
export function dataImageInHtml(html) {
  const m = /<img[^>]+src=["'](data:image\/[^"']+)["']/i.exec(html ?? '');
  return m ? m[1] : null;
}

/** The picture in a paste event (file, data URL text or HTML), or null. */
export async function imageFromPaste(clipboardData) {
  if (!clipboardData) return null;
  for (const item of clipboardData.items ?? []) {
    if (item.kind === 'file' && item.type.startsWith('image/')) {
      const file = item.getAsFile();
      if (file) return blobToDataUrl(file);
    }
  }
  for (const file of clipboardData.files ?? []) if (file.type.startsWith('image/')) return blobToDataUrl(file);
  const text = clipboardData.getData?.('text/plain')?.trim();
  if (text?.startsWith('data:image/')) return text;
  return dataImageInHtml(clipboardData.getData?.('text/html'));
}

/**
 * Read a picture straight from the clipboard (the 📋 button). Resolves to a
 * data URL; rejects with 'unsupported' (the browser can't – use Ctrl+V),
 * 'denied' or 'empty' (no picture in the clipboard).
 */
export async function readClipboardImage(clipboard = globalThis.navigator?.clipboard) {
  if (!clipboard?.read) throw new Error('unsupported');
  let items;
  try {
    items = await clipboard.read();
  } catch (e) {
    throw new Error(e?.name === 'NotAllowedError' ? 'denied' : 'unsupported');
  }
  for (const item of items) {
    const type = item.types.find((ty) => ty.startsWith('image/'));
    if (type) return blobToDataUrl(await item.getType(type));
  }
  for (const item of items) {
    if (!item.types.includes('text/html')) continue;
    const src = dataImageInHtml(await (await item.getType('text/html')).text());
    if (src) return src;
  }
  throw new Error('empty');
}
