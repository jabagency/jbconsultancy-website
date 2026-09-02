import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

/**
 * Unit tests cover the pure logic in `src/lib` and the shape of `src/data`.
 * Anything requiring a rendered page lives in `tests/e2e` under Playwright.
 */
export default defineConfig({
  test: {
    include: ['tests/unit/**/*.test.ts'],
    environment: 'node',
    globals: false,
    coverage: {
      provider: 'v8',
      include: ['src/lib/**/*.ts', 'src/data/**/*.ts'],
      reporter: ['text', 'html'],
    },
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      '@data': fileURLToPath(new URL('./src/data', import.meta.url)),
      '@lib': fileURLToPath(new URL('./src/lib', import.meta.url)),
    },
  },
});
