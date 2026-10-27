import { cloudflare } from '@cloudflare/vite-plugin';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// The Cloudflare plugin runs the relay Worker (src/worker) inside `vite dev`, so one server does everything.
export default defineConfig({
  plugins: [react(), cloudflare()],
});
