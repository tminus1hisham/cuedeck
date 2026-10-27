import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'e2e',
  timeout: 120_000,
  use: { baseURL: 'http://localhost:5179', channel: 'chrome', acceptDownloads: true },
  webServer: { command: 'npm run build:offline && npx vite --port 5179 --strictPort', url: 'http://localhost:5179', reuseExistingServer: true, timeout: 120_000 },
});
