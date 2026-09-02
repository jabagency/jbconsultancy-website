/**
 * Deployment gate — what `astro build` actually wrote to dist/.
 *
 * These are the failures that only appear once the site is on GitHub Pages: a
 * route that never generated, a stripped `_astro/` directory, a sitemap that
 * advertises the 404 page, or an asset URL rebuilt against the wrong `base`.
 * Everything is asserted against the bytes on disk rather than against the
 * config that was meant to produce them.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const DIST_DIR = join(ROOT_DIR, 'dist');
const PUBLIC_DIR = join(ROOT_DIR, 'public');

assert.ok(
  existsSync(DIST_DIR),
  'dist/ does not exist — run `npm run build` before `npm run test:build`.',
);

/** The five indexable routes, as `build.format: 'directory'` lays them out. */
const ROUTES = [
  ['/', 'index.html'],
  ['/about/', 'about/index.html'],
  ['/services/', 'services/index.html'],
  ['/capabilities/', 'capabilities/index.html'],
  ['/contact/', 'contact/index.html'],
];

const HTML_FILES = [...ROUTES.map(([, file]) => file), '404.html'];

function distFile(relativePath) {
  return join(DIST_DIR, ...relativePath.split('/'));
}

function readDist(relativePath) {
  return readFileSync(distFile(relativePath), 'utf8');
}

/** Every `src`/`href` value in a document, which is where base-path bugs surface. */
function assetUrls(html) {
  return [...html.matchAll(/(?:src|href)="([^"]*)"/g)].map((match) => match[1]);
}

describe('generated pages', () => {
  for (const [route, file] of [...ROUTES, ['/404', '404.html']]) {
    test(`${route} generated ${file}`, () => {
      assert.ok(existsSync(distFile(file)), `${file} was not generated`);
      const bytes = statSync(distFile(file)).size;
      // A sub-kilobyte page means the layout rendered but the content did not.
      assert.ok(bytes > 1024, `${file} is only ${bytes} bytes — page content is missing`);
    });
  }
});

describe('GitHub Pages plumbing', () => {
  test('.nojekyll is copied through', () => {
    assert.ok(
      existsSync(join(DIST_DIR, '.nojekyll')),
      'dist/.nojekyll is missing. GitHub Pages runs Jekyll over the artefact by ' +
        'default, and Jekyll silently discards directories beginning with an ' +
        'underscore — which deletes the whole _astro/ bundle and serves the site ' +
        'with no CSS or JS.',
    );
  });

  test('CNAME is a single bare hostname', () => {
    const cname = readDist('CNAME');

    // GitHub reads this file literally: a scheme, a path or a second line makes
    // Pages reject the domain and quietly fall back to <user>.github.io, which
    // then breaks every absolute URL the build emitted.
    assert.match(
      cname,
      /^[a-z0-9][a-z0-9.-]*\.[a-z]{2,}\n?$/,
      `dist/CNAME must hold just the hostname, found ${JSON.stringify(cname)}`,
    );
  });

  test('robots.txt allows crawling and points at an absolute sitemap', () => {
    const robots = readDist('robots.txt');

    assert.match(robots, /^User-agent: \*$/m, 'robots.txt does not address all crawlers');
    assert.match(robots, /^Allow: \/$/m, 'robots.txt does not allow the site');
    // Relative Sitemap: directives are ignored, so the origin has to be baked in.
    assert.match(
      robots,
      /^Sitemap: https?:\/\/\S+\/sitemap-index\.xml$/m,
      'robots.txt needs an absolute Sitemap: URL',
    );
  });

  test('sitemap-index.xml is well-formed and references the URL set', () => {
    const index = readDist('sitemap-index.xml');

    assert.match(index, /^<\?xml version="1\.0" encoding="UTF-8"\?>/, 'missing XML declaration');
    assert.match(index, /<sitemapindex\s[^>]*xmlns="http:\/\/www\.sitemaps\.org/);
    assert.match(index, /<loc>https?:\/\/\S+\/sitemap-0\.xml<\/loc>/);
    assert.ok(index.includes('</sitemapindex>'), 'sitemapindex is not closed');
  });

  test('sitemap-0.xml lists every real route and omits the 404 page', () => {
    const sitemap = readDist('sitemap-0.xml');
    const locations = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]);

    for (const [route] of ROUTES) {
      assert.ok(
        locations.some((location) => new URL(location).pathname === route),
        `${route} is missing from the sitemap (found ${locations.join(', ')})`,
      );
    }

    assert.equal(locations.length, ROUTES.length, 'sitemap lists routes that are not expected');
    // The sitemap filter in astro.config.mjs exists solely to keep this out.
    assert.ok(!sitemap.includes('/404'), 'the 404 page must not be advertised to crawlers');
  });
});

describe('asset URLs', () => {
  test('every _astro reference is rooted at the configured base', () => {
    let bundleReferences = 0;

    for (const file of HTML_FILES) {
      for (const url of assetUrls(readDist(file))) {
        if (!url.includes('_astro')) continue;
        bundleReferences += 1;

        // '//_astro' is what a base of '/' concatenated naively produces, and the
        // browser reads it as a protocol-relative host rather than a path.
        assert.ok(!url.includes('//_astro'), `${file} has a double-slashed asset URL: ${url}`);
        assert.ok(!url.includes('undefined'), `${file} has an unresolved asset URL: ${url}`);
        assert.match(url, /^\/_astro\//, `${file} references ${url} outside the configured base`);
      }
    }

    assert.ok(bundleReferences > 0, 'no _astro assets are referenced at all — did the build run?');
  });

  test('no page hard-codes a development origin', () => {
    for (const file of HTML_FILES) {
      const html = readDist(file);
      assert.ok(
        !html.includes('http://localhost'),
        `${file} hard-codes http://localhost; canonical and OG URLs must come from SITE_URL`,
      );
    }
  });

  test('no placeholder contact detail reaches the markup', () => {
    // PLACEHOLDER_MARKER in src/data/site.ts. Contact rows and WhatsApp buttons
    // are suppressed while their values are unset, so the correct count is zero:
    // any hit means a component started rendering an unconfigured value.
    const marker = 'REPLACE_ME';

    for (const file of HTML_FILES) {
      const hits = readDist(file).split(marker).length - 1;
      assert.equal(hits, 0, `${file} leaks the ${marker} placeholder ${hits} time(s)`);
    }
  });
});

describe('_astro bundle', () => {
  const bundled = existsSync(join(DIST_DIR, '_astro')) ? readdirSync(join(DIST_DIR, '_astro')) : [];

  test('contains compiled CSS and JS', () => {
    assert.ok(
      bundled.some((name) => name.endsWith('.css')),
      'no stylesheet was emitted into dist/_astro',
    );
    assert.ok(
      bundled.some((name) => name.endsWith('.js')),
      'no script was emitted into dist/_astro',
    );
  });

  test('the stylesheet keeps var() references rather than resolving them', () => {
    const css = bundled
      .filter((name) => name.endsWith('.css'))
      .map((name) => readFileSync(join(DIST_DIR, '_astro', name), 'utf8'))
      .join('\n');

    // Tailwind v4's `@theme inline` must emit `var(--ink)` and not the literal
    // colour: the dark-mode overrides work by redefining --ink on :root, so a
    // resolved value would leave dark mode showing light-mode text colours.
    assert.ok(
      css.includes('var(--ink)'),
      'utility classes resolved --ink instead of referencing it',
    );
    assert.match(css, /:root\s*\{/, 'no :root block, so the theme variables are not declared');
  });
});

describe('public/ assets', () => {
  const publicFiles = readdirSync(PUBLIC_DIR).filter((name) =>
    statSync(join(PUBLIC_DIR, name)).isFile(),
  );

  test('public/ is not empty, so the copy check cannot pass vacuously', () => {
    assert.ok(
      publicFiles.length >= 10,
      `expected the brand assets in public/, found ${publicFiles}`,
    );
  });

  for (const name of publicFiles) {
    test(`${name} is copied to dist/ byte-for-byte`, () => {
      const target = join(DIST_DIR, name);
      assert.ok(existsSync(target), `public/${name} was not copied into dist/`);
      assert.equal(
        statSync(target).size,
        statSync(join(PUBLIC_DIR, name)).size,
        `dist/${name} differs in size from public/${name}`,
      );
    });
  }
});
