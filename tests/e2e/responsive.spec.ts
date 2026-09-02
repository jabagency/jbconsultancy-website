/**
 * Responsive layout gate.
 *
 * Every test here sets its own viewport, so running it in both Playwright
 * projects would measure the same three widths twice. It is pinned to
 * desktop-chrome and skipped elsewhere.
 *
 * The in-page probes return raw measurements rather than pre-baked strings, so
 * the failure messages are assembled once, here, instead of in four browser
 * contexts that cannot share a helper.
 */
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

const ROUTES = ['/', '/about/', '/services/', '/capabilities/', '/contact/'];

const VIEWPORTS = [
  { name: 'mobile', width: 375, height: 812 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'desktop', width: 1440, height: 900 },
] as const;

type Viewport = (typeof VIEWPORTS)[number];

const MOBILE = VIEWPORTS[0];
const DESKTOP = VIEWPORTS[2];

/** The Tailwind `lg` breakpoint, where the header swaps nav for the drawer. */
const LG_BREAKPOINT = 1024;

/** WCAG 2.2 Target Size (Minimum), and the 44px floor Button.astro promises. */
const MIN_TARGET = 24;
const MIN_PRIMARY_TARGET = 44;

/** Enough of an element to find it again in the source. */
interface ElementRef {
  readonly tag: string;
  readonly id: string;
  readonly cls: string;
}

function describe(ref: ElementRef): string {
  const id = ref.id.length > 0 ? `#${ref.id}` : '';
  const classes = ref.cls.trim().split(/\s+/).filter(Boolean);
  const shown = classes
    .slice(0, 3)
    .map((name) => `.${name}`)
    .join('');
  return `<${ref.tag}${id}${shown}${classes.length > 3 ? '…' : ''}>`;
}

function bullets(lines: string[]): string {
  return lines.map((line) => `\n  - ${line}`).join('');
}

test.beforeEach(() => {
  test.skip(
    test.info().project.name !== 'desktop-chrome',
    'viewports are set per test, so one project covers all three widths',
  );
});

/**
 * Size the window, load the route, and wait until it can be measured.
 *
 * Reduced motion holds the `.reveal` elements at their finished transform, so
 * boxes are measured where they finally sit rather than mid-animation. Waiting on
 * the webfont matters too: nearly every box here is sized by text metrics, and
 * Inter's fallback is not the same height.
 */
async function openAt(page: Page, route: string, viewport: Viewport): Promise<void> {
  await page.setViewportSize({ width: viewport.width, height: viewport.height });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(route);
  await page.waitForLoadState('load');
  await expect(page.locator('main#main-content')).toBeVisible();
  await page.evaluate(async () => {
    await document.fonts.ready;
  });
}

test.describe('horizontal overflow', () => {
  for (const viewport of VIEWPORTS) {
    for (const route of ROUTES) {
      test(`${route} does not scroll sideways at ${viewport.width}px`, async ({ page }) => {
        await openAt(page, route, viewport);

        const report = await page.evaluate(() => {
          const limit = window.innerWidth + 1;
          let widest: { el: ElementRef; right: number } | null = null;

          for (const element of Array.from(document.querySelectorAll('body *'))) {
            const rect = element.getBoundingClientRect();
            if (rect.width === 0 && rect.height === 0) continue;
            if (rect.right <= limit) continue;
            if (widest !== null && rect.right <= widest.right) continue;
            widest = {
              el: {
                tag: element.tagName.toLowerCase(),
                id: element.id,
                cls: element.getAttribute('class') ?? '',
              },
              right: rect.right,
            };
          }

          return {
            scrollWidth: document.documentElement.scrollWidth,
            innerWidth: window.innerWidth,
            widest,
          };
        });

        const culprit =
          report.widest === null
            ? 'no element reaches past the edge, so the overflow comes from a scrollable box or a margin'
            : `widest element past the edge: ${describe(report.widest.el)} with its right edge at ` +
              `${report.widest.right.toFixed(1)}px`;

        // The +1 absorbs sub-pixel rounding: a fractional layout width rounds
        // scrollWidth up, which is not a real sideways scroll.
        expect(
          report.scrollWidth,
          `${route} scrolls sideways at ${viewport.width}px — scrollWidth ${report.scrollWidth} vs ` +
            `innerWidth ${report.innerWidth}. ${culprit}`,
        ).toBeLessThanOrEqual(report.innerWidth + 1);
      });
    }
  }
});

test.describe('header navigation swap', () => {
  for (const viewport of VIEWPORTS) {
    const wide = viewport.width >= LG_BREAKPOINT;

    test(`${viewport.width}px shows ${wide ? 'the primary nav' : 'the drawer trigger'}`, async ({
      page,
    }) => {
      await openAt(page, '/', viewport);

      const primaryNav = page.locator('nav[aria-label="Primary"]');
      const trigger = page.locator('[data-menu-open]');

      if (wide) {
        await expect(
          primaryNav,
          `the primary nav must be visible at ${viewport.width}px`,
        ).toBeVisible();
        await expect(
          trigger,
          `the drawer trigger must be hidden at ${viewport.width}px`,
        ).toBeHidden();
      } else {
        await expect(
          primaryNav,
          `the primary nav must be hidden below ${LG_BREAKPOINT}px`,
        ).toBeHidden();
        await expect(
          trigger,
          `the drawer trigger must be visible at ${viewport.width}px`,
        ).toBeVisible();
      }
    });
  }
});

test.describe('target sizes', () => {
  for (const viewport of VIEWPORTS) {
    for (const route of ROUTES) {
      test(`${route} keeps its controls tappable at ${viewport.width}px`, async ({ page }) => {
        await openAt(page, route, viewport);

        const report = await page.evaluate(
          ({ min, minPrimary }) => {
            const undersized: { el: ElementRef; label: string; w: number; h: number }[] = [];
            const undersizedPrimary: typeof undersized = [];
            const selector = 'a[href], button, input, select, textarea';

            for (const control of Array.from(document.querySelectorAll(selector))) {
              // Off-screen honeypot: no visitor, pointer or keyboard, can reach it.
              if (control.id === 'botcheck') continue;
              // Visually hidden until focused, so its 1×1 box is not a target.
              if (control.classList.contains('sr-only')) continue;

              const style = getComputedStyle(control);
              if (style.display === 'none' || style.visibility === 'hidden') continue;

              // WCAG 2.2 2.5.8 exempts targets whose box is set by the line height
              // of surrounding text. Every `display: inline` control here is such a
              // text link — its height follows the font, not the author.
              if (style.display === 'inline') continue;

              const rect = control.getBoundingClientRect();
              // Not laid out at all, e.g. inside the closed drawer.
              if (rect.width === 0 && rect.height === 0) continue;

              const entry = {
                el: {
                  tag: control.tagName.toLowerCase(),
                  id: control.id,
                  cls: control.getAttribute('class') ?? '',
                },
                label: (control.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 30),
                w: rect.width,
                h: rect.height,
              };

              if (rect.width < min || rect.height < min) undersized.push(entry);
              // Button.astro bakes `min-h-11` into every variant, so the class is a
              // reliable marker for the primary controls without touching source.
              if (control.classList.contains('min-h-11') && rect.height < minPrimary) {
                undersizedPrimary.push(entry);
              }
            }

            return { undersized, undersizedPrimary };
          },
          { min: MIN_TARGET, minPrimary: MIN_PRIMARY_TARGET },
        );

        const format = (entry: { el: ElementRef; label: string; w: number; h: number }): string =>
          `${describe(entry.el)} “${entry.label}” measures ${entry.w.toFixed(1)}×${entry.h.toFixed(1)}`;

        expect(
          report.undersized.map(format),
          `controls smaller than ${MIN_TARGET}×${MIN_TARGET}px on ${route} at ${viewport.width}px:` +
            bullets(report.undersized.map(format)),
        ).toEqual([]);

        expect(
          report.undersizedPrimary.map(format),
          `min-h-11 controls shorter than ${MIN_PRIMARY_TARGET}px on ${route} at ` +
            `${viewport.width}px:${bullets(report.undersizedPrimary.map(format))}`,
        ).toEqual([]);
      });
    }
  }
});

test.describe('images', () => {
  for (const route of ROUTES) {
    test(`${route} describes or marks decorative every image`, async ({ page }) => {
      await openAt(page, route, DESKTOP);

      const problems = await page.evaluate(() => {
        const found: { el: ElementRef; control: ElementRef | null }[] = [];

        for (const image of Array.from(document.querySelectorAll('img'))) {
          const el = {
            tag: image.tagName.toLowerCase(),
            id: image.id,
            cls: image.getAttribute('class') ?? '',
          };
          const alt = image.getAttribute('alt');

          if (alt === null) {
            found.push({ el, control: null });
            continue;
          }
          if (alt.trim().length > 0) continue;
          if (image.getAttribute('aria-hidden') === 'true') continue;
          if (image.getAttribute('role') === 'presentation') continue;
          if (image.getAttribute('role') === 'none') continue;

          // A bare `alt=""` is the correct decorative marking. It only becomes a
          // bug when the image is the sole content of a control, which would then
          // be left with no accessible name.
          const control = image.closest('a[href], button');
          if (control === null) continue;

          const named =
            (control.getAttribute('aria-label') ?? '').trim().length > 0 ||
            control.hasAttribute('aria-labelledby') ||
            (control.textContent ?? '').trim().length > 0;

          if (named) continue;

          found.push({
            el,
            control: {
              tag: control.tagName.toLowerCase(),
              id: control.id,
              cls: control.getAttribute('class') ?? '',
            },
          });
        }

        return found;
      });

      const lines = problems.map((problem) =>
        problem.control === null
          ? `${describe(problem.el)} has no alt attribute at all`
          : `${describe(problem.el)} is decorative inside ${describe(problem.control)}, which has no accessible name`,
      );

      expect(
        lines,
        `images on ${route} must carry alt text or be marked decorative:${bullets(lines)}`,
      ).toEqual([]);
    });
  }
});

test.describe('fixed overlays', () => {
  test(`nothing pinned covers the ${MOBILE.width}px viewport`, async ({ page }) => {
    for (const route of ROUTES) {
      await openAt(page, route, MOBILE);

      // The WhatsApp FAB renders nothing while site.contact.whatsapp is still the
      // `91REPLACE_ME` placeholder, so it is only checked once it exists.
      const fab = page.locator('[data-whatsapp-fab]');
      if ((await fab.count()) > 0) {
        await expect(fab, `the WhatsApp FAB must be laid out on ${route}`).toBeVisible();
      }

      const covering = await page.evaluate(() => {
        // 90% of either axis is generous enough to ignore a pinned bar and still
        // catch a full-bleed overlay sitting on top of the content.
        const wideEnough = window.innerWidth * 0.9;
        const tallEnough = window.innerHeight * 0.9;
        const found: { el: ElementRef; w: number; h: number }[] = [];

        for (const element of Array.from(document.querySelectorAll('body *'))) {
          const style = getComputedStyle(element);
          if (style.position !== 'fixed') continue;
          if (style.display === 'none' || style.visibility === 'hidden') continue;

          const rect = element.getBoundingClientRect();
          if (rect.width < wideEnough || rect.height < tallEnough) continue;

          found.push({
            el: {
              tag: element.tagName.toLowerCase(),
              id: element.id,
              cls: element.getAttribute('class') ?? '',
            },
            w: rect.width,
            h: rect.height,
          });
        }

        return found;
      });

      const lines = covering.map(
        (entry) => `${describe(entry.el)} covers ${entry.w.toFixed(0)}×${entry.h.toFixed(0)}px`,
      );

      expect(
        lines,
        `fixed elements blocking the whole viewport on ${route} at ${MOBILE.width}px:${bullets(lines)}`,
      ).toEqual([]);
    }
  });
});
