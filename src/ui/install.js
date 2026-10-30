// Installing the game to the home screen / desktop (SPEC §2.2). Chrome and Edge
// offer a prompt we can open from a button; iPhone and iPad need the Share menu.

import { useEffect, useState } from 'react';

let deferredPrompt = null;
const listeners = new Set();
const notify = () => listeners.forEach((f) => f());

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault(); // shown from our own button instead
    deferredPrompt = e;
    notify();
  });
  window.addEventListener('appinstalled', () => { deferredPrompt = null; notify(); });
}

/** Running as an installed app (home screen icon), not in a browser tab. */
export function isStandalone(w = globalThis.window) {
  if (!w) return false;
  return !!w.navigator?.standalone || ['standalone', 'fullscreen'].some((m) => w.matchMedia?.(`(display-mode: ${m})`).matches);
}

/** iPhone / iPad (iPadOS says it's a Mac, but a Mac has no touch screen). */
export function isIos(nav = globalThis.navigator) {
  if (!nav) return false;
  return /iPad|iPhone|iPod/.test(nav.userAgent) || (/Macintosh/.test(nav.userAgent) && nav.maxTouchPoints > 1);
}

export function useInstall() {
  const [, setTick] = useState(0);
  useEffect(() => {
    const f = () => setTick((n) => n + 1);
    listeners.add(f);
    return () => listeners.delete(f);
  }, []);
  return {
    standalone: isStandalone(),
    ios: isIos(),
    canPrompt: !!deferredPrompt,
    install: async () => {
      const p = deferredPrompt;
      if (!p) return false;
      deferredPrompt = null;
      p.prompt();
      const { outcome } = await p.userChoice;
      notify();
      return outcome === 'accepted';
    },
  };
}
