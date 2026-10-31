import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { configDefaults } from 'vitest/config';
import fs from 'node:fs';

// Phaser's source asks `typeof WEBGL_RENDERER` etc. to leave out what a game
// doesn't need (its own builds set these with webpack). Fold them in the build:
// both renderers stay, the sound system and debug / Facebook bits go.
const PHASER_FLAGS = { WEBGL_RENDERER: true, CANVAS_RENDERER: true, FEATURE_SOUND: false, PLUGIN_FBINSTANT: false, PLUGIN_CAMERA3D: false, WEBGL_DEBUG: false };
const PHASER_SRC = /[\\/]phaser[\\/]src[\\/].*\.js$/;
const foldFlags = (code) => code.replace(/typeof (WEBGL_RENDERER|CANVAS_RENDERER|FEATURE_SOUND|PLUGIN_FBINSTANT|PLUGIN_CAMERA3D|WEBGL_DEBUG)\b/g, (_, f) => String(PHASER_FLAGS[f]));
// the build (Rollup)…
const phaserFlags = {
  name: 'phaser-flags',
  enforce: 'pre',
  transform(code, id) {
    return PHASER_SRC.test(id) && code.includes('typeof ') ? foldFlags(code) : null;
  },
};
// …and the dev server's pre-bundling (esbuild)
const phaserFlagsEsbuild = {
  name: 'phaser-flags',
  setup(build) {
    build.onLoad({ filter: PHASER_SRC }, async ({ path }) => ({ contents: foldFlags(await fs.promises.readFile(path, 'utf8')), loader: 'js' }));
  },
};

// GitHub Pages serves the site from /<repo-name>/, so the build needs that base.
// Set VITE_BASE in CI (the deploy workflow does it); local dev uses '/'.
export default defineConfig({
  base: process.env.VITE_BASE || '/',
  plugins: [
    react(),
    phaserFlags,
    // Installable app that plays offline (SPEC §2.2): a service worker keeps
    // the whole game; a new version waits until the player reloads (ui/UpdateToast).
    VitePWA({
      registerType: 'prompt',
      injectRegister: false,
      manifest: {
        name: 'Kreslená vesnice – Sketch Village',
        short_name: 'Kreslená vesnice',
        description: 'Obrana vesnice s obrázky, které nakreslí děti. A village defense game with kid-drawn pictures.',
        lang: 'cs',
        display: 'fullscreen',
        display_override: ['fullscreen', 'standalone'],
        orientation: 'any',
        background_color: '#fbf8ef',
        theme_color: '#fbf8ef',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,png,svg,woff2}'],
        // the game chunk (mostly Phaser) is ~0.9 MB
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
        cleanupOutdatedCaches: true,
        runtimeCaching: [
          // the class pack: fresh when online, the last copy when offline
          { urlPattern: /default-data\.json$/, handler: 'NetworkFirst', options: { cacheName: 'class-pack' } },
          // the public library (SPEC §13c): the list and the files someone loaded – fresh online, kept for offline
          { urlPattern: /\/library\/[^/]+\.json$/, handler: 'NetworkFirst', options: { cacheName: 'library', expiration: { maxEntries: 60 } } },
          // handwriting fonts
          {
            urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com\//,
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'fonts', expiration: { maxEntries: 20 }, cacheableResponse: { statuses: [0, 200] } },
          },
        ],
      },
    }),
  ],
  // Keep paths as given: on some Windows setups (redirected AppData) resolving
  // the real path points Vite at a folder Node can't read.
  resolve: { preserveSymlinks: true },
  // Phaser's source is CommonJS that expects a `global` (its own builds provide one)
  define: { global: 'globalThis' },
  optimizeDeps: { esbuildOptions: { plugins: [phaserFlagsEsbuild] } },
  // the game chunk (mostly Phaser, src/game/phaser.js) is ~0.9 MB; it's loaded lazily
  build: { chunkSizeWarningLimit: 1000 },
  // e2e/ holds the Playwright browser tests (npm run e2e)
  test: { exclude: [...configDefaults.exclude, 'e2e/**'] },
});
