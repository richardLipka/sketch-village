import React, { useEffect, useRef } from 'react';

// open modals, newest last: Escape closes only the top one (a paste box or a
// cropper over the component editor must not close the editor too)
const stack = [];

/** Paper-styled modal. Escape closes it when onClose is given. */
export default function Modal({ children, onClose, wide = false }) {
  const me = useRef({});
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    const id = me.current;
    stack.push(id);
    const onKey = (e) => {
      if (e.key === 'Escape' && stack.at(-1) === id && close.current) {
        e.stopImmediatePropagation();
        close.current();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      stack.splice(stack.indexOf(id), 1);
    };
  }, []);

  return (
    <div className="modal-back">
      <div className="modal sketch-card" style={wide ? { width: 'min(960px, 100%)' } : undefined}>
        {children}
      </div>
    </div>
  );
}
