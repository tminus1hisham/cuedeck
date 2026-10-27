import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

// Builds the offline player into one self-contained public/offline.html.
// The app fills it with a show at export time; module scripts can't load from file://, so everything is inlined.
export default defineConfig({
  root: 'src/export',
  publicDir: false,
  plugins: [viteSingleFile()],
  build: {
    outDir: '../../public',
    emptyOutDir: false,
    rollupOptions: { input: fileURLToPath(new URL('./src/export/offline.html', import.meta.url)) },
  },
});
