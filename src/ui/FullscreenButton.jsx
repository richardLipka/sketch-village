import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

// Toggle browser fullscreen for the whole app (all screens stay fullscreen).
export function enterFullscreen() {
  const el = document.documentElement;
  if (!document.fullscreenElement && el.requestFullscreen) el.requestFullscreen().catch(() => {});
}

export function toggleFullscreen() {
  if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
  else enterFullscreen();
}

export function useIsFullscreen() {
  const [on, setOn] = useState(() => !!document.fullscreenElement);
  useEffect(() => {
    const f = () => setOn(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', f);
    return () => document.removeEventListener('fullscreenchange', f);
  }, []);
  return on;
}

export default function FullscreenButton({ className = 'btn icon' }) {
  const { t } = useTranslation();
  const on = useIsFullscreen();
  if (!document.documentElement.requestFullscreen) return null;
  return (
    <button className={`${className} ${on ? 'active' : ''}`} onClick={toggleFullscreen} title={t(on ? 'app.fullscreen_exit' : 'app.fullscreen')}>
      {on ? '🗗' : '⛶'}
    </button>
  );
}
