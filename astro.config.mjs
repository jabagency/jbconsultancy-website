import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';

/**
 * Deployment target is configured by environment so the same source tree can be
 * built for local preview and for GitHub Pages without editing this file.
 *
 *   SITE_URL   absolute origin, required by sitemap/canonical/OG tags.
 *   BASE_PATH  sub-path the site is served from.
 *              - custom domain (`jbconsultancy.in`) ......... "/"
 *              - user/org site (`<user>.github.io`) .......... "/"
 *              - project site (`<user>.github.io/jabagency`) . "/jabagency/"
 *
 * The defaults are the production values, so a build with no environment set is
 * still correct; `.github/workflows/deploy.yml` overrides them from
 * `actions/configure-pages`, which reports the custom domain once it is saved in
 * Settings → Pages. BASE_PATH stays "/" for the custom domain, which is also
 * what local dev and the test suite expect.
 */
const SITE_URL = process.env.SITE_URL ?? 'https://jbconsultancy.in';
const BASE_PATH = process.env.BASE_PATH ?? '/';

export default defineConfig({
  site: SITE_URL,
  base: BASE_PATH,

  // Emit `about/index.html` so GitHub Pages serves `/about/` without a redirect.
  build: { format: 'directory' },

  // Astro 7 defaults this to 'jsx', which strips whitespace between inline
  // elements and silently joins words like `<em>talent</em> <span>delivery</span>`.
  // `true` compresses markup while preserving meaningful whitespace.
  compressHTML: true,

  trailingSlash: 'ignore',

  // Warm up same-origin links on hover; costs no JS on the initial render.
  prefetch: { prefetchAll: true, defaultStrategy: 'hover' },

  integrations: [
    sitemap({
      filter: (page) => !page.includes('/404'),
    }),
  ],

  vite: {
    plugins: [tailwindcss()],
  },
});
