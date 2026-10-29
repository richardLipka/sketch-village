import React, { useState, useCallback } from 'react';
import Cropper from 'react-easy-crop';
import { useTranslation } from 'react-i18next';
import Modal from '../ui/Modal.jsx';
import { loadImage, makeCanvas } from './imageEncoding.js';

// Crop step (generalized CargoImageEditor). Outputs a lossless PNG at
// `workSize` so the background-removal step still has detail to work with;
// the final downscale + WebP encoding happens after that.
export default function AssetCropper({ image, aspect = 1, workSize = 512, onDone, onCancel }) {
  const { t } = useTranslation();
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [area, setArea] = useState(null);

  const onCropComplete = useCallback((_a, pixels) => setArea(pixels), []);

  const handleSave = async () => {
    if (!area) return;
    const img = await loadImage(image);
    // Rotate the whole image first, then cut the crop rectangle out of it
    // (react-easy-crop reports the area in rotated-image coordinates).
    const rad = (rotation * Math.PI) / 180;
    const sin = Math.abs(Math.sin(rad)), cos = Math.abs(Math.cos(rad));
    const bw = img.width * cos + img.height * sin;
    const bh = img.width * sin + img.height * cos;
    const rotated = makeCanvas(bw, bh);
    const rctx = rotated.getContext('2d');
    rctx.translate(bw / 2, bh / 2);
    rctx.rotate(rad);
    rctx.drawImage(img, -img.width / 2, -img.height / 2);

    const outW = workSize;
    const outH = Math.round(workSize / aspect);
    const out = makeCanvas(outW, outH);
    const ctx = out.getContext('2d');
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(rotated, area.x, area.y, area.width, area.height, 0, 0, outW, outH);
    onDone(out.toDataURL('image/png'));
  };

  return (
    <Modal onClose={onCancel} wide>
      <h2>{t('crop.title')}</h2>
      <div className="crop-area">
        <Cropper
          image={image}
          crop={crop}
          zoom={zoom}
          rotation={rotation}
          aspect={aspect}
          minZoom={0.5}
          maxZoom={4}
          restrictPosition={false}
          onCropChange={setCrop}
          onZoomChange={setZoom}
          onRotationChange={setRotation}
          onCropComplete={onCropComplete}
        />
      </div>
      <div className="row" style={{ marginTop: 12 }}>
        <label>🔍 <input type="range" min={0.5} max={4} step={0.05} value={zoom} onChange={(e) => setZoom(+e.target.value)} /></label>
        <label>↻ <input type="range" min={-180} max={180} step={1} value={rotation} onChange={(e) => setRotation(+e.target.value)} /></label>
        <span className="spacer" />
        <button className="btn" onClick={onCancel}>{t('common.cancel')}</button>
        <button className="btn primary" onClick={handleSave} disabled={!area}>✓ {t('crop.done')}</button>
      </div>
    </Modal>
  );
}
