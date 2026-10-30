import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import Modal from '../ui/Modal.jsx';
import { loadImage, makeCanvas, encodeCanvas } from './imageEncoding.js';
import { floodErase } from './bgRemoval.js';
import { floodFill, hexToRgba } from './pixelOps.js';
import PasteButton, { usePasteAnywhere } from './PasteButton.jsx';
import AssetCropper from './AssetCropper.jsx';

// Draw a new asset or touch up a photographed one (pencil, eraser, fill,
// magic-wand erase with adjustable strength, flip, crop, load a picture from
// disk, undo / redo for all of them). Works at 2× the stored size so strokes
// stay smooth, then downscales on save.

const COLORS = ['#1f2937', '#1e3a8a', '#2563eb', '#16a34a', '#65a30d', '#ca8a04', '#ea580c', '#dc2626', '#db2777', '#7c3aed', '#78350f', '#9ca3af', '#ffffff'];
const SIZES = [2, 5, 10, 18];
const UNDO_LIMIT = 25;

export default function SketchPad({ size, initialImage, onSave, onCancel }) {
  const { t } = useTranslation();
  const W = Math.max(size * 2, 256);
  const canvasRef = useRef(null);
  const drawing = useRef(null); // last point while stroking
  const undoStack = useRef([]);
  const redoStack = useRef([]);
  const [tool, setTool] = useState('pencil');
  const [color, setColor] = useState(COLORS[0]);
  const [brush, setBrush] = useState(SIZES[1]);
  const [wandStrength, setWandStrength] = useState(25); // colour tolerance of the magic wand
  const [cropSrc, setCropSrc] = useState(null); // image being cropped (current drawing or a file)
  const fileRef = useRef(null);
  const [, force] = useState(0);

  const ctx = () => canvasRef.current.getContext('2d', { willReadFrequently: true });

  useEffect(() => {
    const c = canvasRef.current;
    c.width = W;
    c.height = W;
    if (initialImage) {
      loadImage(initialImage).then((img) => {
        ctx().drawImage(img, 0, 0, W, W);
      });
    }
  }, [W, initialImage]);

  const snapshot = useCallback(() => {
    undoStack.current.push(ctx().getImageData(0, 0, W, W));
    if (undoStack.current.length > UNDO_LIMIT) undoStack.current.shift();
    redoStack.current = [];
    force((n) => n + 1);
  }, [W]);

  const undo = () => {
    const prev = undoStack.current.pop();
    if (!prev) return;
    redoStack.current.push(ctx().getImageData(0, 0, W, W));
    ctx().putImageData(prev, 0, 0);
    force((n) => n + 1);
  };
  const redo = () => {
    const next = redoStack.current.pop();
    if (!next) return;
    undoStack.current.push(ctx().getImageData(0, 0, W, W));
    ctx().putImageData(next, 0, 0);
    force((n) => n + 1);
  };

  useEffect(() => {
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') { e.preventDefault(); e.shiftKey ? redo() : undo(); }
      if ((e.ctrlKey || e.metaKey) && e.key === 'y') { e.preventDefault(); redo(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const toCanvas = (e) => {
    const r = canvasRef.current.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(W - 1, ((e.clientX - r.left) / r.width) * W)),
      y: Math.max(0, Math.min(W - 1, ((e.clientY - r.top) / r.height) * W)),
    };
  };

  const strokeTo = (from, to) => {
    const c = ctx();
    c.save();
    c.lineCap = 'round';
    c.lineJoin = 'round';
    c.lineWidth = brush * (W / 256);
    if (tool === 'eraser') {
      c.globalCompositeOperation = 'destination-out';
      c.strokeStyle = '#000';
    } else {
      c.strokeStyle = color;
    }
    c.beginPath();
    c.moveTo(from.x, from.y);
    c.lineTo(to.x + 0.01, to.y);
    c.stroke();
    c.restore();
  };

  const onPointerDown = (e) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    const p = toCanvas(e);
    snapshot();
    if (tool === 'fill' || tool === 'wand') {
      const img = ctx().getImageData(0, 0, W, W);
      const x = Math.floor(p.x), y = Math.floor(p.y);
      if (tool === 'fill') floodFill(img.data, W, W, x, y, hexToRgba(color));
      else floodErase(img.data, W, W, x, y, wandStrength);
      ctx().putImageData(img, 0, 0);
      return;
    }
    drawing.current = p;
    strokeTo(p, p);
  };

  const onPointerMove = (e) => {
    if (!drawing.current) return;
    const p = toCanvas(e);
    strokeTo(drawing.current, p);
    drawing.current = p;
  };

  const onPointerUp = () => { drawing.current = null; };

  const flip = () => {
    snapshot();
    const tmp = makeCanvas(W, W);
    tmp.getContext('2d').drawImage(canvasRef.current, 0, 0);
    const c = ctx();
    c.clearRect(0, 0, W, W);
    c.save();
    c.translate(W, 0);
    c.scale(-1, 1);
    c.drawImage(tmp, 0, 0);
    c.restore();
  };

  const clear = () => {
    snapshot();
    ctx().clearRect(0, 0, W, W);
  };

  // crop the current drawing, or a picture loaded from disk; both can be undone
  const startCrop = () => setCropSrc(canvasRef.current.toDataURL('image/png'));
  const onFile = (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setCropSrc(reader.result);
    reader.readAsDataURL(file);
  };
  // a picture from the clipboard: the 📋 button or Ctrl+V while the pad is open
  usePasteAnywhere(true, setCropSrc);
  const afterCrop = async (cropped) => {
    setCropSrc(null);
    const img = await loadImage(cropped);
    snapshot();
    ctx().clearRect(0, 0, W, W);
    ctx().drawImage(img, 0, 0, W, W);
  };

  const save = () => {
    const out = makeCanvas(size, size);
    const o = out.getContext('2d');
    o.imageSmoothingQuality = 'high';
    o.drawImage(canvasRef.current, 0, 0, size, size);
    onSave(encodeCanvas(out));
  };

  const TOOLS = [
    ['pencil', '✏️'],
    ['eraser', '🧽'],
    ['fill', '🪣'],
    ['wand', '🪄'],
  ];

  return (
    <Modal onClose={onCancel} wide>
      <h2>{t('sketch.title')}</h2>
      <div className="pad-wrap">
        <canvas
          ref={canvasRef}
          className="pad-canvas checker"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        />
        <div className="tools">
          <div className="row" style={{ gap: 6 }}>
            {TOOLS.map(([id, icon]) => (
              <button key={id} className={`btn icon ${tool === id ? 'active' : ''}`} title={t(`sketch.tool_${id}`)} onClick={() => setTool(id)}>
                {icon}
              </button>
            ))}
          </div>
          <div className="small muted">{t(`sketch.tool_${tool}`)}</div>
          {tool === 'wand' && (
            <label className="small" style={{ display: 'block' }}>
              {t('sketch.wand_strength')}: {wandStrength}
              <input type="range" min={5} max={100} value={wandStrength} onChange={(e) => setWandStrength(Number(e.target.value))} style={{ width: '100%' }} />
            </label>
          )}
          <div className="palette">
            {COLORS.map((c) => (
              <button key={c} className={`swatch ${c === color ? 'on' : ''}`} style={{ background: c }} onClick={() => { setColor(c); if (tool === 'eraser' || tool === 'wand') setTool('pencil'); }} aria-label={c} />
            ))}
          </div>
          <div className="row" style={{ gap: 6 }}>
            {SIZES.map((s) => (
              <button key={s} className={`btn icon ${brush === s ? 'active' : ''}`} onClick={() => setBrush(s)} title={`${s}`}>
                <span style={{ display: 'inline-block', width: s + 2, height: s + 2, borderRadius: '50%', background: 'var(--ink)' }} />
              </button>
            ))}
          </div>
          <div className="row" style={{ gap: 6 }}>
            <button className="btn icon" onClick={undo} disabled={!undoStack.current.length} title={t('sketch.undo')}>↶</button>
            <button className="btn icon" onClick={redo} disabled={!redoStack.current.length} title={t('sketch.redo')}>↷</button>
            <button className="btn icon" onClick={flip} title={t('sketch.flip')}>⇋</button>
            <button className="btn icon" onClick={startCrop} title={t('sketch.crop')}>✂️</button>
            <button className="btn icon" onClick={() => fileRef.current.click()} title={t('sketch.load')}>📁</button>
            <PasteButton onImage={setCropSrc} />
            <button className="btn icon danger" onClick={clear} title={t('sketch.clear')}>🗑</button>
          </div>
          <input ref={fileRef} type="file" accept="image/*" hidden onChange={onFile} />
        </div>
      </div>
      {cropSrc && <AssetCropper image={cropSrc} onCancel={() => setCropSrc(null)} onDone={afterCrop} />}
      <div className="row" style={{ marginTop: 16 }}>
        <button className="btn" onClick={onCancel}>{t('common.cancel')}</button>
        <span className="spacer" />
        <button className="btn primary" onClick={save}>✓ {t('common.done')}</button>
      </div>
    </Modal>
  );
}
