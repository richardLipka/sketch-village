import React, { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import CameraCapture from './CameraCapture.jsx';
import AssetCropper from './AssetCropper.jsx';
import BackgroundRemover from './BackgroundRemover.jsx';
import SketchPad from './SketchPad.jsx';
import PasteButton from './PasteButton.jsx';
import { normalizeAssetImage } from './imageEncoding.js';

// One drawing of an asset, with the full pipeline:
//   [photo | upload | paste] → crop → remove paper → (optional touch-up)   or   [draw]
export default function ImageSlot({ label, image, fallback, category, onChange }) {
  const { t } = useTranslation();
  const fileRef = useRef(null);
  const [stage, setStage] = useState(null); // camera | crop | bg | sketch
  const [raw, setRaw] = useState(null);

  const afterCrop = async (cropped) => {
    if (category.removeBg) {
      setRaw(cropped);
      setStage('bg');
    } else {
      onChange(await normalizeAssetImage(cropped, { size: category.size }));
      setStage(null);
    }
  };

  const onFile = (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => { setRaw(reader.result); setStage('crop'); };
    reader.readAsDataURL(file);
  };

  const shown = image || fallback;

  return (
    <div className="slot">
      {label && <div><b>{label}</b></div>}
      <div className="pic checker" style={!image && fallback ? { opacity: 0.45 } : undefined}>
        {shown ? <img src={shown} alt="" /> : <span className="muted" style={{ fontSize: 40 }}>?</span>}
      </div>
      <div className="row" style={{ justifyContent: 'center', gap: 4 }}>
        <button className="btn icon" title={t('slot.photo')} onClick={() => setStage('camera')}>📷</button>
        <button className="btn icon" title={t('slot.upload')} onClick={() => fileRef.current.click()}>📁</button>
        <PasteButton onImage={(img) => { setRaw(img); setStage('crop'); }} />
        <button className="btn icon" title={image ? t('slot.edit') : t('slot.draw')} onClick={() => setStage('sketch')}>✏️</button>
        {image && <button className="btn icon danger" title={t('slot.remove')} onClick={() => onChange(null)}>✕</button>}
      </div>
      <input ref={fileRef} type="file" accept="image/*" hidden onChange={onFile} />

      {stage === 'camera' && (
        <CameraCapture onCancel={() => setStage(null)} onCapture={(src) => { setRaw(src); setStage('crop'); }} />
      )}
      {stage === 'crop' && (
        <AssetCropper image={raw} onCancel={() => setStage(null)} onDone={afterCrop} />
      )}
      {stage === 'bg' && (
        <BackgroundRemover
          image={raw}
          size={category.size}
          onCancel={() => setStage(null)}
          onDone={(img) => { onChange(img); setStage(null); }}
        />
      )}
      {stage === 'sketch' && (
        <SketchPad
          size={category.size}
          initialImage={image || fallback}
          onCancel={() => setStage(null)}
          onSave={(img) => { onChange(img); setStage(null); }}
        />
      )}
    </div>
  );
}
