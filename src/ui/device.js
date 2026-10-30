// Which kind of device the game runs on, detected automatically:
//   phone  – a touch screen with a short side of at most 520 px (held sideways
//            for playing): compact controls in the thumb corners, full-screen
//            backpack and shop
//   tablet – another touch screen
//   pc     – mouse / trackpad
// A very low window (≤ 520 px) on a PC gets the phone layout too.

import { useEffect, useState } from 'react';

export const PHONE_SHORT_SIDE = 520;

export function classifyDevice({ coarse, width, height }) {
  const short = Math.min(width, height);
  if (short <= PHONE_SHORT_SIDE && (coarse || height <= PHONE_SHORT_SIDE)) return 'phone';
  return coarse ? 'tablet' : 'pc';
}

function current() {
  if (typeof window === 'undefined') return { device: 'pc', portrait: false };
  const coarse = !!window.matchMedia?.('(pointer: coarse)').matches;
  const width = window.innerWidth, height = window.innerHeight;
  return { device: classifyDevice({ coarse, width, height }), portrait: height > width };
}

/** { device, portrait } – updated when the window turns or resizes. */
export function useDevice() {
  const [state, setState] = useState(current);
  useEffect(() => {
    const update = () => setState((s) => { const n = current(); return n.device === s.device && n.portrait === s.portrait ? s : n; });
    window.addEventListener('resize', update);
    window.addEventListener('orientationchange', update);
    return () => { window.removeEventListener('resize', update); window.removeEventListener('orientationchange', update); };
  }, []);
  return state;
}
