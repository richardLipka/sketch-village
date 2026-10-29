import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import Modal from '../ui/Modal.jsx';
import { loadImage, makeCanvas, encodeCanvas } from './imageEncoding.js';
import { removePaper, boostInk } from './bgRemoval.js';

// Removes the paper around a photographed drawing, with live preview.
// Output: encoded image at the category's `size`.
export default function BackgroundRemover({ image, size, onDone, onCancel }) {
  const { t } = useTranslation();
  const previewRef = useRef(null);
  const sourceRef = useRef(null); // ImageData of the cropped photo
  const [tolerance, setTolerance] = useState(35);
  const [inside, setInside] = useState(false);
  const [ink, setInk] = useState(30);
  const [ready, setReady] = useState(false);

  // Work at a moderate size: enough detail, fast enough for live sliders.
  const WORK = Math.max(size * 2, 256);

  useEffect(() => {
    let alive = true;
    loadImage(image).then((img) => {
      if (!alive) return;
      const c = makeCanvas(WORK, WORK);
      const ctx = c.getContext('2d');
      ctx.drawImage(img, 0, 0, WORK, WORK);
      sourceRef.current = ctx.getImageData(0, 0, WORK, WORK);
      setReady(true);
    });
    return () => { alive = false; };
  }, [image, WORK]);

  useEffect(() => {
    if (!ready || !previewRef.current) return;
    const src = sourceRef.current;
    const data = new Uint8ClampedArray(src.data);
    removePaper(data, WORK, WORK, { tolerance, inside });
    boostInk(data, ink);
    const canvas = previewRef.current;
    canvas.width = WORK;
    canvas.height = WORK;
    canvas.getContext('2d').putImageData(new ImageData(data, WORK, WORK), 0, 0);
  }, [ready, tolerance, inside, ink, WORK]);

  const finish = (skip) => {
    const out = makeCanvas(size, size);
    const ctx = out.getContext('2d');
    ctx.imageSmoothingQuality = 'high';
    if (skip) {
      const c = makeCanvas(WORK, WORK);
      c.getContext('2d').putImageData(sourceRef.current, 0, 0);
      ctx.drawImage(c, 0, 0, size, size);
    } else {
      ctx.drawImage(previewRef.current, 0, 0, size, size);
    }
    onDone(encodeCanvas(out));
  };

  return (
    <Modal onClose={onCancel}>
      <h2>{t('bg.title')}</h2>
      <p className="muted small">{t('bg.hint')}</p>
      <canvas ref={previewRef} className="checker" style={{ width: 'min(360px, 80vw)', aspectRatio: '1', display: 'block', margin: '0 auto', border: '2px solid var(--ink)', borderRadius: 6 }} />
      <div style={{ marginTop: 12 }}>
        <label style={{ display: 'flex' }}>
          {t('bg.tolerance')}
          <input type="range" min={5} max={80} value={tolerance} onChange={(e) => setTolerance(+e.target.value)} style={{ flex: 1 }} />
        </label>
        <label style={{ display: 'flex' }}>
          {t('bg.ink')}
          <input type="range" min={0} max={100} value={ink} onChange={(e) => setInk(+e.target.value)} style={{ flex: 1 }} />
        </label>
        <label>
          <input type="checkbox" checked={inside} onChange={(e) => setInside(e.target.checked)} />
          {t('bg.inside')}
        </label>
      </div>
      <div className="row" style={{ marginTop: 16 }}>
        <button className="btn" onClick={onCancel}>{t('common.cancel')}</button>
        <span className="spacer" />
        <button className="btn" onClick={() => finish(true)} disabled={!ready}>{t('bg.skip')}</button>
        <button className="btn primary" onClick={() => finish(false)} disabled={!ready}>✓ {t('bg.done')}</button>
      </div>
    </Modal>
  );
}
