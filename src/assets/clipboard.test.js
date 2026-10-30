import { describe, it, expect, beforeAll } from 'vitest';
import { imageFromPaste, readClipboardImage, dataImageInHtml } from './clipboard.js';

const PNG = 'data:image/png;base64,iVBORw0KGgo=';

beforeAll(() => {
  // Node has Blob but no FileReader
  globalThis.FileReader ??= class {
    readAsDataURL(blob) {
      blob.arrayBuffer().then((b) => { this.result = `data:${blob.type};base64,${Buffer.from(b).toString('base64')}`; this.onload(); });
    }
  };
});

const pasted = ({ files = [], text = '', html = '' }) => ({
  items: files.map((f) => ({ kind: 'file', type: f.type, getAsFile: () => f })),
  files,
  getData: (type) => (type === 'text/plain' ? text : type === 'text/html' ? html : ''),
});

describe('pictures from the clipboard', () => {
  it('a pasted picture file becomes a data URL', async () => {
    const file = new Blob([new Uint8Array([1, 2, 3])], { type: 'image/png' });
    expect(await imageFromPaste(pasted({ files: [file] }))).toBe('data:image/png;base64,AQID');
  });

  it('also a picture copied from a web page (HTML) or as a data URL text', async () => {
    expect(await imageFromPaste(pasted({ html: `<meta charset="utf-8"><img src="${PNG}" alt="x">` }))).toBe(PNG);
    expect(await imageFromPaste(pasted({ text: ` ${PNG} ` }))).toBe(PNG);
  });

  it('plain text is not a picture', async () => {
    expect(await imageFromPaste(pasted({ text: 'hello', html: '<b>hi</b>' }))).toBe(null);
    expect(await imageFromPaste(null)).toBe(null);
    expect(dataImageInHtml('<img src="https://x/y.png">')).toBe(null);
  });

  it('the 📋 button reads the clipboard, or says why it can’t', async () => {
    const item = (types, blobs) => ({ types, getType: async (ty) => blobs[ty] });
    const png = new Blob([new Uint8Array([9])], { type: 'image/png' });
    expect(await readClipboardImage({ read: async () => [item(['text/plain', 'image/png'], { 'image/png': png })] })).toBe('data:image/png;base64,CQ==');
    const html = new Blob([`<img src="${PNG}">`], { type: 'text/html' });
    expect(await readClipboardImage({ read: async () => [item(['text/html'], { 'text/html': html })] })).toBe(PNG);
    await expect(readClipboardImage({ read: async () => [item(['text/plain'], {})] })).rejects.toThrow('empty');
    await expect(readClipboardImage({})).rejects.toThrow('unsupported');
    const denied = Object.assign(new Error('no'), { name: 'NotAllowedError' });
    await expect(readClipboardImage({ read: async () => { throw denied; } })).rejects.toThrow('denied');
  });
});
