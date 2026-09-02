import { defineConfig, devices } from '@playwright/test';

const PORT = 4321;
const BASE_URL = `http://localhost:${PORT}`;

/**
 * E2E runs against the *built* output via `astro preview`, not the dev server,
 * so the suite exercises exactly what GitHub Pages will serve.
 *
 * `channel: 'chrome'` reuses the Chrome already installed at
 * /usr/bin/google-chrome instead of downloading Playwright's own browser.
 */
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  /*
   * Capped rather than left to Playwright's `cores / 2`. Each worker is a full
   * Chrome, and the axe-core audits hold a whole page in memory — on a machine
   * with 8GB the default oversubscribes RAM and axe runs start timing out.
   */
  workers: process.env.CI ? 1 : 2,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : [['list']],

  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },

  projects: [
    {
      name: 'desktop-chrome',
      use: { ...devices['Desktop Chrome'], channel: 'chrome' },
    },
    {
      name: 'mobile-chrome',
      use: { ...devices['Pixel 7'], channel: 'chrome' },
    },
  ],

  webServer: {
    /*
     * `preview:e2e` runs Astro's preview server programmatically instead of via
     * `astro preview`, which daemonises itself when it detects a coding agent and
     * so exits immediately — Playwright can only report that as "webServer exited
     * early". See tools/preview-server.mjs.
     */
    command: 'npm run build && npm run preview:e2e',
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    stdout: 'pipe',
    stderr: 'pipe',
  },
});
