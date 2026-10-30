import React, { useEffect, useRef, useState } from 'react';
import { frameAt, loadFrames, DEFAULT_FPS } from './animation.js';

// Plays an animation (frames + alignment offsets + speed) in a small square.
// Used in the component editor and the chronicle. Falls back to `still`.
export default function AnimPreview({ anim, still, size = 128, className = 'checker' }) {
  const ref = useRef(null);
  const [frames, setFrames] = useState([]);

  useEffect(() => {
    let alive = true;
    loadFrames(anim).then((f) => { if (alive) setFrames(f); });
    return () => { alive = false; };
  }, [anim]);

  useEffect(() => {
    const c = ref.current;
    if (!c || !frames.length) return undefined;
    const ctx = c.getContext('2d');
    const fps = anim?.fps ?? DEFAULT_FPS;
    const start = performance.now();
    let raf = 0, last = -1;
    const draw = (now) => {
      const i = frameAt(frames.length, fps, now - start);
      if (i !== last) {
        last = i;
        const img = frames[i];
        const k = size / (img.naturalWidth || img.width || size);
        const [dx, dy] = anim.offsets?.[i] ?? [0, 0];
        ctx.clearRect(0, 0, size, size);
        ctx.drawImage(img, dx * k, dy * k, size, size);
      }
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [frames, anim, size]);

  if (!anim?.frames?.length) {
    return still ? <img src={still} alt="" width={size} height={size} className={className} style={{ objectFit: 'contain' }} /> : null;
  }
  return <canvas ref={ref} width={size} height={size} className={className} style={{ width: size, height: size }} />;
}
