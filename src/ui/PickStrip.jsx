import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';

// One row of tiles to pick from (the maps and heroes before a game) that
// slides sideways: by swiping, the mouse wheel, its scrollbar or the ‹ › buttons
// at its ends (shown only when there is more that way). The picked tile is
// slid into view when the strip appears.
export default function PickStrip({ children, label, selectedKey = null }) {
  const { t } = useTranslation();
  const ref = useRef(null);
  const [ends, setEnds] = useState({ left: false, right: false });

  const measure = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const left = el.scrollLeft > 8, right = el.scrollLeft + el.clientWidth < el.scrollWidth - 8;
    setEnds((e) => (e.left === left && e.right === right ? e : { left, right }));
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    measure();
    const ro = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure);
    ro?.observe(el);
    // the wheel slides the strip while it can go that way; at its end the page scrolls on
    const onWheel = (e) => {
      if (Math.abs(e.deltaX) > Math.abs(e.deltaY) || !e.deltaY) return;
      const canGo = e.deltaY > 0 ? el.scrollLeft + el.clientWidth < el.scrollWidth - 1 : el.scrollLeft > 0;
      if (!canGo) return;
      e.preventDefault();
      el.scrollLeft += e.deltaY;
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => { ro?.disconnect(); el.removeEventListener('wheel', onWheel); };
  }, [measure]);

  // the picked one in view (a map just loaded from the library may be far right)
  useEffect(() => {
    const el = ref.current;
    const tile = selectedKey != null && el?.querySelector(`[data-key="${CSS.escape(String(selectedKey))}"]`);
    if (tile) el.scrollLeft = Math.max(0, tile.offsetLeft - (el.clientWidth - tile.offsetWidth) / 2);
    measure();
    // only when the strip appears – picking a tile must not jump the strip
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(measure, [children, measure]);

  const page = (dir) => ref.current?.scrollBy({ left: dir * ref.current.clientWidth * 0.8, behavior: 'smooth' });
  return (
    <div className="pick-strip-wrap">
      <div className="pick-strip" ref={ref} onScroll={measure} role="listbox" aria-label={label} aria-orientation="horizontal">
        {children}
      </div>
      {ends.left && <button type="button" className="btn icon strip-arrow left" onClick={() => page(-1)} aria-label={t('common.scroll_left')}>‹</button>}
      {ends.right && <button type="button" className="btn icon strip-arrow right" onClick={() => page(1)} aria-label={t('common.scroll_right')}>›</button>}
    </div>
  );
}
