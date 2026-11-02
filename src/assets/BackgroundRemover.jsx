import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import Modal from '../ui/Modal.jsx';
import { loadImage, makeCanvas, encodeCanvas } from './imageEncoding.js';
import { removePaper, boostInk, vividColors } from './bgRemoval.js';

// Removes the paper around a photographed drawing, with live preview (SPEC §6):
// paper removal can be switched off completely, the lines darkened and the
// colours made livelier. Output: encoded image at the category's `size`.

// The preview works on the cropped picture at its own resolution (up to MAX px),
// so it is as sharp as the picture the game gets – no blurry upscaling.
const MAX = 1024;

export default function BackgroundRemover({ image, size, onDone, onCancel }) {
  const { t } = useTranslation();
  const previewRef = useRef(null);
  const sourceRef = useRef(null); // ImageData of the cropped photo
  const [removeBg, setRemoveBg] = useState(true);
  const [tolerance, setTolerance] = useState(35);
  const [inside, setInside] = useState(false);
  const [ink, setInk] = useState(30);
  const [vivid, setVivid] = useState(0);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let alive = true;
    loadImage(image).then((img) => {
      if (!alive) return;
      const iw = img.naturalWidth || img.width, ih = img.naturalHeight || img.height;
      const k = Math.min(1, MAX / Math.max(iw, ih));
      const w = Math.max(1, Math.round(iw * k)), h = Math.max(1, Math.round(ih * k));
      const c = makeCanvas(w, h);
      const ctx = c.getContext('2d');
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, 0, 0, w, h);
      sourceRef.current = ctx.getImageData(0, 0, w, h);
      setReady(true);
    });
    return () => { alive = false; };
  }, [image]);

  useEffect(() => {
    if (!ready || !previewRef.current) return;
    const src = sourceRef.current;
    const { width: w, height: h } = src;
    const data = new Uint8ClampedArray(src.data);
    if (removeBg) removePaper(data, w, h, { tolerance, inside });
    boostInk(data, ink);
    vividColors(data, vivid);
    const canvas = previewRef.current;
    canvas.width = w;
    canvas.height = h;
    canvas.getContext('2d').putImageData(new ImageData(data, w, h), 0, 0);
  }, [ready, removeBg, tolerance, inside, ink, vivid]);

  const finish = () => {
    // the whole picture, centred in the square, as the other pictures are stored
    const src = previewRef.current;
    const out = makeCanvas(size, size);
    const ctx = out.getContext('2d');
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    const k = Math.min(size / src.width, size / src.height);
    const dw = src.width * k, dh = src.height * k;
    ctx.drawImage(src, (size - dw) / 2, (size - dh) / 2, dw, dh);
    onDone(encodeCanvas(out));
  };

  const slider = (label, value, set, min, max, testid, disabled = false) => (
    <label style={{ display: 'flex', gap: 8, opacity: disabled ? 0.5 : 1 }}>
      {label}
      <input type="range" min={min} max={max} value={value} disabled={disabled} onChange={(e) => set(+e.target.value)} style={{ flex: 1 }} data-testid={testid} />
    </label>
  );

  return (
    <Modal onClose={onCancel}>
      <h2>{t('bg.title')}</h2>
      <p className="muted small">{t('bg.hint')}</p>
      <canvas ref={previewRef} className="checker" data-testid="bg-preview" style={{ width: 'min(360px, 80vw)', maxHeight: '50vh', objectFit: 'contain', display: 'block', margin: '0 auto', border: '2px solid var(--ink)', borderRadius: 6 }} />
      <div style={{ marginTop: 12 }}>
        <label>
          <input type="checkbox" checked={removeBg} onChange={(e) => setRemoveBg(e.target.checked)} data-testid="bg-remove" />
          {t('bg.remove')}
        </label>
        {slider(t('bg.tolerance'), tolerance, setTolerance, 5, 80, 'bg-tolerance', !removeBg)}
        <label style={{ opacity: removeBg ? 1 : 0.5 }}>
          <input type="checkbox" checked={inside} disabled={!removeBg} onChange={(e) => setInside(e.target.checked)} />
          {t('bg.inside')}
        </label>
        {slider(t('bg.ink'), ink, setInk, 0, 100, 'bg-ink')}
        {slider(t('bg.vivid'), vivid, setVivid, 0, 100, 'bg-vivid')}
      </div>
      <div className="row" style={{ marginTop: 16 }}>
        <button className="btn" onClick={onCancel}>{t('common.cancel')}</button>
        <span className="spacer" />
        <button className="btn primary" onClick={finish} disabled={!ready}>✓ {t('bg.done')}</button>
      </div>
    </Modal>
  );
}
