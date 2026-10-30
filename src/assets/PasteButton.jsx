import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import Modal from '../ui/Modal.jsx';
import { readClipboardImage, imageFromPaste } from './clipboard.js';

// 📋 Paste a picture from the clipboard. The button reads the clipboard at
// once where the browser allows it; otherwise (or when it refuses) a small box
// waits for Ctrl+V / ⌘V – or a long press → Paste on a phone or tablet.
export default function PasteButton({ onImage, className = 'btn icon', label }) {
  const { t } = useTranslation();
  const [catcher, setCatcher] = useState(null); // null | { reason }

  const click = async () => {
    try {
      onImage(await readClipboardImage());
    } catch (e) {
      setCatcher({ reason: e.message });
    }
  };

  return (
    <>
      <button type="button" className={className} title={t('paste.button')} onClick={click}>📋{label ? ` ${label}` : ''}</button>
      {catcher && <PasteCatcher reason={catcher.reason} onImage={(img) => { setCatcher(null); onImage(img); }} onCancel={() => setCatcher(null)} />}
    </>
  );
}

/** Waits for a paste (keyboard or long press) and hands over the picture. */
export function PasteCatcher({ reason, onImage, onCancel }) {
  const { t } = useTranslation();
  const box = useRef(null);
  const [empty, setEmpty] = useState(reason === 'empty');
  useEffect(() => {
    box.current?.focus();
    const onPaste = async (e) => {
      e.preventDefault();
      const img = await imageFromPaste(e.clipboardData);
      if (img) onImage(img);
      else setEmpty(true);
    };
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  }, [onImage]);
  return (
    <Modal onClose={onCancel}>
      <h2>📋 {t('paste.title')}</h2>
      <p>{t('paste.how')}</p>
      {/* a place to long-press → Paste on touch screens; nothing typed here is kept */}
      <div ref={box} className="paste-box" contentEditable suppressContentEditableWarning tabIndex={0} aria-label={t('paste.box')} onInput={(e) => { e.currentTarget.textContent = ''; }}>
        {t('paste.box')}
      </div>
      {empty && <p className="error-text small">{t('paste.empty')}</p>}
      <div className="row" style={{ justifyContent: 'flex-end', marginTop: 10 }}>
        <button className="btn" onClick={onCancel}>{t('common.cancel')}</button>
      </div>
    </Modal>
  );
}

/** Ctrl+V anywhere while `active` (e.g. the drawing pad is open) → onImage. Text fields keep their paste. */
export function usePasteAnywhere(active, onImage) {
  const cb = useRef(onImage);
  cb.current = onImage;
  useEffect(() => {
    if (!active) return undefined;
    const onPaste = async (e) => {
      const el = e.target;
      if (el?.closest?.('input, textarea, [contenteditable]')) return;
      const img = await imageFromPaste(e.clipboardData);
      if (img) { e.preventDefault(); cb.current(img); }
    };
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  }, [active]);
}
