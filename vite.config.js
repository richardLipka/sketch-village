import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { configDefaults } from 'vitest/config';

// GitHub Pages serves the site from /<repo-name>/, so the build needs that base.
// Set VITE_BASE in CI (the deploy workflow does it); local dev uses '/'.
export default defineConfig({
  base: process.env.VITE_BASE || '/',
  plugins: [
    react(),
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
        // Phaser alone is ~1.5 MB
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        cleanupOutdatedCaches: true,
        runtimeCaching: [
          // the class pack: fresh when online, the last copy when offline
          { urlPattern: /default-data\.json$/, handler: 'NetworkFirst', options: { cacheName: 'class-pack' } },
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
  // Phaser alone is ~1.4 MB minified; it's loaded lazily, so the warning is noise.
  build: { chunkSizeWarningLimit: 1600 },
  // e2e/ holds the Playwright browser tests (npm run e2e)
  test: { exclude: [...configDefaults.exclude, 'e2e/**'] },
});
