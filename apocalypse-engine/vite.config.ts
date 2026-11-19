import { defineConfig } from 'vitest/config';

export default defineConfig({
  base: './',
  build: { target: 'es2022', chunkSizeWarningLimit: 600, rollupOptions: {
    output: { manualChunks: { three: ['three'], rapier: ['@dimforge/rapier3d-compat'] } },
  } },
  test: {
    include: ['tests/unit/**/*.test.ts'], testTimeout: 20_000,
    reporters: ['default', 'json'], outputFile: { json: 'reports/unit-results.json' },
  },
});

