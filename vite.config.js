import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';

// Empaqueta TODO (JS, CSS) en un solo index.html, sin CDN ni dependencias
// externas, para poder enviarlo por donde sea y que funcione sin internet.
export default defineConfig({
  plugins: [react(), viteSingleFile()],
  build: {
    target: 'es2018',
    cssCodeSplit: false,
    assetsInlineLimit: 100000000,
    chunkSizeWarningLimit: 5000,
  },
});
