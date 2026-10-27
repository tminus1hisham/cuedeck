import { defineConfig } from 'vitest/config';

// Unit tests are pure logic; keep the Cloudflare and React plugins out of them.
export default defineConfig({ test: { include: ['src/**/*.test.ts'] } });
