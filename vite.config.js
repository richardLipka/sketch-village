import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// GitHub Pages serves the site from /<repo-name>/, so the build needs that base.
// Set VITE_BASE in CI (the deploy workflow does it); local dev uses '/'.
export default defineConfig({
  base: process.env.VITE_BASE || '/',
  plugins: [react()],
  // Keep paths as given: on some Windows setups (redirected AppData) resolving
  // the real path points Vite at a folder Node can't read.
  resolve: { preserveSymlinks: true },
  // Phaser alone is ~1.4 MB minified; it's loaded lazily, so the warning is noise.
  build: { chunkSizeWarningLimit: 1600 },
});
