/**
 * Foreground preview server for Playwright.
 *
 * `astro preview` cannot be used here: when it detects that it was launched by a
 * coding agent it re-launches itself as a background daemon and the parent exits,
 * which Playwright can only report as "webServer exited early". Astro's
 * programmatic `preview()` is the same server without the CLI's daemon logic, so
 * this process stays in the foreground and Playwright can own its lifecycle.
 *
 * Serves ./dist, so `npm run build` must have run first.
 */
import { preview } from 'astro';

const port = Number(process.env.PORT ?? 4321);

const server = await preview({
  root: process.cwd(),
  logLevel: 'warn',
  server: { port, host: false },
});

const shutdown = async () => {
  await server.stop();
  process.exit(0);
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

// Playwright polls the base URL, so announce readiness on stdout for the log.
console.log(`preview ready on http://localhost:${port}`);
