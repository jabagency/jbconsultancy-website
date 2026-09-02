import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { site } from '@data/site';

/**
 * Discoverability and social-sharing metadata, asserted against the built output
 * served by `astro preview`.
 *
 * Titles and canonical URLs are derived from `src/data/site.ts` rather than
 * retyped, so renaming the company cannot leave this suite green against stale
 * expectations. Descriptions are matched on a distinctive fragment instead: they
 * are authored per page, and the fragment is what proves the *right* page's copy
 * arrived rather than a layout default.
 */

interface PageCase {
  /** Route as linked, including the trailing slash Astro generates. */
  readonly path: string;
  /** Complete `<title>`, derived from site identity. */
  readonly title: string;
  /** A phrase that appears in this page's description and no other's. */
  readonly descriptionFragment: string;
}

const PAGES = [
  {
    path: '/',
    title: `${site.name} — ${site.tagline}`,
    descriptionFragment: 'end-to-end consulting partner',
  },
  {
    path: '/about/',
    title: `About | ${site.name}`,
    descriptionFragment: 'bridges the gap between exceptional talent',
  },
  {
    path: '/services/',
    title: `Services | ${site.name}`,
    descriptionFragment: 'four service lines',
  },
  {
    path: '/capabilities/',
    title: `Capabilities | ${site.name}`,
    descriptionFragment: 'Core technology stack',
  },
  {
    path: '/contact/',
    title: `Contact | ${site.name}`,
    descriptionFragment: 'Start a conversation',
  },
] as const satisfies readonly PageCase[];

const OG_PROPERTIES = [
  'og:type',
  'og:site_name',
  'og:title',
  'og:description',
  'og:url',
  'og:image',
  'og:image:width',
  'og:image:height',
  'og:image:alt',
  'og:locale',
] as const;

const TWITTER_NAMES = [
  'twitter:card',
  'twitter:title',
  'twitter:description',
  'twitter:image',
] as const;

type JsonLd = Record<string, unknown>;

/**
 * Every `<head>` meta tag as key → content, keyed by `property` when present and
 * by `name` otherwise, which is how Open Graph and Twitter tags differ here.
 */
async function readHeadMeta(page: Page): Promise<Map<string, string>> {
  const entries = await page.locator('head meta[content]').evaluateAll((tags) =>
    tags.map((tag) => {
      const meta = tag as HTMLMetaElement;
      return [meta.getAttribute('property') ?? meta.name, meta.content] as [string, string];
    }),
  );

  return new Map(entries);
}

/** Parse every ld+json block, failing with the offending block if it is malformed. */
async function readJsonLd(page: Page): Promise<JsonLd[]> {
  const blocks = await page.locator('script[type="application/ld+json"]').allTextContents();

  return blocks.map((block, index) => {
    try {
      return JSON.parse(block) as JsonLd;
    } catch (error) {
      throw new Error(`ld+json block ${index} is not valid JSON: ${block}`, { cause: error });
    }
  });
}

test.describe('page metadata', () => {
  for (const { path, title, descriptionFragment } of PAGES) {
    test(`${path} carries a complete, correct head`, async ({ page }) => {
      const response = await page.goto(path);
      expect(response?.status(), `${path} should be served`).toBeLessThan(400);

      await expect(page).toHaveTitle(title);
      // A second <title> makes which one search engines use undefined.
      await expect(page.locator('head > title'), `${path} must have exactly one title`).toHaveCount(
        1,
      );
      await expect(page.locator('html')).toHaveAttribute('lang', 'en');

      const canonical = await page.locator('link[rel="canonical"]').getAttribute('href');
      expect(canonical, `${path} has no canonical URL`).not.toBeNull();
      expect(canonical ?? '', `${path} canonical must be absolute`).toMatch(/^https?:\/\//);
      expect(new URL(canonical ?? '').pathname, `${path} canonical points elsewhere`).toBe(path);

      const meta = await readHeadMeta(page);

      const description = meta.get('description') ?? '';
      expect(description, `${path} has an empty meta description`).not.toBe('');
      expect(description, `${path} is not describing itself`).toContain(descriptionFragment);

      for (const property of OG_PROPERTIES) {
        expect(meta.get(property), `${path} is missing ${property}`).toBeTruthy();
      }
      for (const name of TWITTER_NAMES) {
        expect(meta.get(name), `${path} is missing ${name}`).toBeTruthy();
      }

      expect(meta.get('og:type')).toBe('website');
      expect(meta.get('og:site_name')).toBe(site.name);
      expect(meta.get('og:title')).toBe(title);
      expect(meta.get('og:description')).toBe(description);
      // A canonical and an og:url that disagree split the social share count.
      expect(meta.get('og:url'), `${path} og:url must match the canonical URL`).toBe(canonical);
      expect(meta.get('og:image') ?? '').toMatch(/^https?:\/\/\S+\/og-image\.png$/);
      expect(meta.get('og:image:width')).toBe('1200');
      expect(meta.get('og:image:height')).toBe('630');
      expect(meta.get('og:locale')).toBe('en');

      expect(meta.get('twitter:card')).toBe('summary_large_image');
      expect(meta.get('twitter:title')).toBe(title);
      expect(meta.get('twitter:description')).toBe(description);
      expect(meta.get('twitter:image')).toBe(meta.get('og:image'));
    });
  }

  test('every page has its own description', async ({ page }) => {
    const descriptions: string[] = [];

    for (const { path } of PAGES) {
      await page.goto(path);
      const description = await page.locator('meta[name="description"]').getAttribute('content');
      expect(description, `${path} has no description`).toBeTruthy();
      descriptions.push(description ?? '');
    }

    // Duplicated descriptions are the real defect: they are easy to introduce by
    // omitting the prop and inheriting the site-wide default from BaseLayout.
    expect(
      new Set(descriptions).size,
      `duplicate descriptions among ${descriptions.join(' | ')}`,
    ).toBe(PAGES.length);
  });

  test('every page links its icons', async ({ page }) => {
    for (const { path } of PAGES) {
      await page.goto(path);

      await expect(
        page.locator('link[rel="icon"][href$="favicon.ico"]'),
        `${path} is missing the .ico favicon`,
      ).toHaveCount(1);
      await expect(
        page.locator('link[rel="icon"][href$="favicon-32.png"][type="image/png"]'),
        `${path} is missing the PNG favicon`,
      ).toHaveCount(1);
      await expect(
        page.locator('link[rel="apple-touch-icon"][href$="apple-touch-icon.png"]'),
        `${path} is missing the Apple touch icon`,
      ).toHaveCount(1);
      await expect(page.locator('link[rel="sitemap"]')).toHaveCount(1);
    }
  });
});

test.describe('structured data', () => {
  for (const { path } of PAGES) {
    test(`${path} emits parseable schema.org JSON`, async ({ page }) => {
      await page.goto(path);
      const graphs = await readJsonLd(page);

      expect(graphs.length, `${path} has no structured data`).toBeGreaterThan(0);
      for (const graph of graphs) {
        expect(graph['@context'], `${path} structured data is not schema.org`).toBe(
          'https://schema.org',
        );
        expect(graph['@type'], `${path} structured data has no @type`).toBeTruthy();
      }
    });
  }

  test('the home page declares the Organization, and inner pages do not repeat it', async ({
    page,
  }) => {
    await page.goto('/');
    const homeTypes = (await readJsonLd(page)).map((graph) => graph['@type']);
    expect(homeTypes).toContain('Organization');
    expect(homeTypes).toContain('WebSite');

    await page.goto('/about/');
    const aboutTypes = (await readJsonLd(page)).map((graph) => graph['@type']);
    expect(aboutTypes).toEqual(['WebSite']);
  });
});

test.describe('indexability', () => {
  test('no real page asks to be excluded from search', async ({ page }) => {
    for (const { path } of PAGES) {
      await page.goto(path);
      await expect(page.locator('meta[name="robots"]'), `${path} must stay indexable`).toHaveCount(
        0,
      );
    }
  });

  test('an unknown path serves the noindex 404 page', async ({ page }) => {
    const response = await page.goto('/definitely-not-a-page/');

    expect(response?.status(), 'unknown paths must answer 404, not 200').toBe(404);
    await expect(page).toHaveTitle(`Page not found | ${site.name}`);
    await expect(page.locator('h1')).toContainText(/could not be found/i);
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex, follow');
  });
});

test.describe('link integrity', () => {
  test('every navigation link resolves', async ({ page }) => {
    await page.goto('/');

    const hrefs = await page
      .locator('nav a[href]')
      .evaluateAll((links) =>
        links.map((link) => (link as HTMLAnchorElement).getAttribute('href') ?? ''),
      );

    const targets = [...new Set(hrefs)];
    expect(targets.length, 'no navigation links found on the home page').toBeGreaterThan(0);

    for (const target of targets) {
      // Reset between hops: consecutive links into the same document differing
      // only by fragment are same-document navigations, for which goto()
      // resolves to null and there is no status to inspect.
      await page.goto('/');

      const response = await page.goto(target);
      expect(
        response?.status(),
        `${target} is linked from a nav but does not resolve`,
      ).toBeLessThan(400);
    }
  });
});
