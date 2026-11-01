import React, { useEffect, useId, useRef } from 'react';

// open modals, newest last: Escape closes only the top one (a paste box or a
// cropper over the component editor must not close the editor too)
const stack = [];

const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]):not([type=hidden]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
const focusables = (el) => [...el.querySelectorAll(FOCUSABLE)].filter((x) => !x.hidden && x.getClientRects().length);

/**
 * Paper-styled modal. Escape closes it when onClose is given.
 * With `header` / `footer` they stay in place and only the content between
 * them scrolls (the editor's title and its Save button are always in view);
 * `fill` lets the content arrange its own scrolling (the chronicle's list).
 *
 * A dialog for assistive technology (SPEC §4c): named by its first heading (or
 * `label`), focus moves into it when it opens (a field with autoFocus wins),
 * Tab stays inside, and focus goes back where it was when it closes.
 */
export default function Modal({ children, onClose, wide = false, header = null, footer = null, fill = false, label }) {
  const me = useRef({});
  const box = useRef(null);
  // where the focus was before the dialog – read while rendering, before an autoFocus field takes it
  const before = useRef(typeof document === 'undefined' ? null : document.activeElement);
  const headingId = useId();
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    const id = me.current;
    const el = box.current;
    const opener = before.current;
    stack.push(id);
    // named by its heading
    const heading = el.querySelector('h1, h2, h3');
    if (heading && !label) {
      heading.id ||= headingId;
      el.setAttribute('aria-labelledby', heading.id);
    }
    if (!el.contains(document.activeElement)) (focusables(el)[0] ?? el).focus({ preventScroll: true });
    const onKey = (e) => {
      if (stack.at(-1) !== id) return;
      if (e.key === 'Escape' && close.current) {
        e.stopImmediatePropagation();
        close.current();
      } else if (e.key === 'Tab') {
        // keep Tab inside the dialog
        const list = focusables(el);
        if (!list.length) { e.preventDefault(); return; }
        const first = list[0], last = list.at(-1);
        if (!el.contains(document.activeElement)) { e.preventDefault(); first.focus(); }
        else if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      stack.splice(stack.indexOf(id), 1);
      // back to where the kid was (when that is still on the page)
      if (opener?.isConnected && typeof opener.focus === 'function' && opener !== document.body) opener.focus({ preventScroll: true });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const split = header || footer || fill;
  return (
    <div className="modal-back">
      <div ref={box} className={`modal sketch-card ${split ? 'modal-split' : ''}`} style={wide ? { width: 'min(960px, 100%)' } : undefined}
        role="dialog" aria-modal="true" aria-label={label} tabIndex={-1}>
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
