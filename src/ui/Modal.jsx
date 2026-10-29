import React, { useEffect } from 'react';

/** Paper-styled modal. Escape closes it when onClose is given. */
export default function Modal({ children, onClose, wide = false }) {
  useEffect(() => {
    if (!onClose) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="modal-back">
      <div className="modal sketch-card" style={wide ? { width: 'min(960px, 100%)' } : undefined}>
        {children}
      </div>
    </div>
  );
}
