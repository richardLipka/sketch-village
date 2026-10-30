import React, { useEffect, useRef } from 'react';

// open modals, newest last: Escape closes only the top one (a paste box or a
// cropper over the component editor must not close the editor too)
const stack = [];

/**
 * Paper-styled modal. Escape closes it when onClose is given.
 * With `header` / `footer` they stay in place and only the content between
 * them scrolls (the editor's title and its Save button are always in view);
 * `fill` lets the content arrange its own scrolling (the chronicle's list).
 */
export default function Modal({ children, onClose, wide = false, header = null, footer = null, fill = false }) {
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

  const split = header || footer || fill;
  return (
    <div className="modal-back">
      <div className={`modal sketch-card ${split ? 'modal-split' : ''}`} style={wide ? { width: 'min(960px, 100%)' } : undefined}>
        {split ? (
          <>
            {header && <div className="modal-head">{header}</div>}
            <div className={`modal-body ${fill ? 'fill' : ''}`}>{children}</div>
            {footer && <div className="modal-foot">{footer}</div>}
          </>
        ) : children}
      </div>
    </div>
  );
}
