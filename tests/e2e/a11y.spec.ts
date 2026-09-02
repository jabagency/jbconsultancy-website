/**
 * Accessibility gate.
 *
 * Three layers, because no single one is sufficient:
 *   1. axe-core over every route, for the machine-checkable WCAG rules.
 *   2. Structural invariants axe deliberately does not judge — one <h1>, an
 *      unbroken heading ladder, a skip link that is genuinely the first tab stop.
 *   3. The mobile drawer's keyboard contract, which only exists at runtime.
 */
import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

const ROUTES = ['/', '/about/', '/services/', '/capabilities/', '/contact/'];

/** WCAG 2.0 A/AA, 2.1 A/AA and the 2.2 AA additions. */
const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

/** Anything at or above 'serious' fails the build; 'minor'/'moderate' are advisory. */
const BLOCKING_IMPACTS = new Set(['serious', 'critical']);

type AxeResults = Awaited<ReturnType<InstanceType<typeof AxeBuilder>['analyze']>>;
type Violation = AxeResults['violations'][number];
type ViolationNode = Violation['nodes'][number];

/**
 * No baselines and no allow-list. Every serious/critical finding is a real
 * defect to fix at source; the design tokens in src/styles/global.css were
 * chosen to clear 4.5:1 rather than be excused here.
 */
function blockingViolations(results: AxeResults): Violation[] {
  return results.violations.filter((violation) => BLOCKING_IMPACTS.has(violation.impact ?? ''));
}

/** Flatten axe's frame-aware selector into something copy-pasteable. */
function targetOf(node: ViolationNode): string {
  return node.target
    .map((part) => (Array.isArray(part) ? part.join(' ') : String(part)))
    .join(' >>> ');
}

/**
 * Render the whole failure into the assertion message, so a CI log is enough to
 * act on without re-running the suite locally.
 */
function describeViolations(label: string, violations: Violation[]): string {
  if (violations.length === 0) return `No blocking accessibility violations on ${label}.`;

  const details = violations
    .map((violation) => {
      const targets = violation.nodes.map((node) => `      ${targetOf(node)}`).join('\n');
      return [
        `  [${violation.impact}] ${violation.id} — ${violation.help}`,
        `    ${violation.helpUrl}`,
        `    ${violation.nodes.length} failing element(s):`,
        targets,
      ].join('\n');
    })
    .join('\n');

  return `${violations.length} blocking accessibility violation(s) on ${label}:\n${details}`;
}

/**
 * Load a route and wait for it to be measurable.
 *
 * Reduced motion is emulated deliberately: it pins the `.reveal` scroll
 * animations to their finished state, so axe never samples an element that is
 * mid-fade and results do not depend on where the viewport happens to sit.
 */
async function open(page: Page, route: string): Promise<void> {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(route);
  await page.waitForLoadState('load');
  await expect(page.locator('main#main-content')).toBeVisible();
}

async function analyse(page: Page): Promise<AxeResults> {
  return new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();
}

test.describe('axe-core WCAG audit', () => {
  /*
   * Injecting and running axe over a full page against this many rule tags takes
   * ~20s on a single worker, and longer when several browsers compete for memory.
   * The default 30s per-test budget is for interaction tests, not for this.
   */
  test.describe.configure({ timeout: 150_000 });

  for (const route of ROUTES) {
    test(`${route} has no serious or critical violations`, async ({ page }) => {
      await open(page, route);

      const blocking = blockingViolations(await analyse(page));

      expect(blocking, describeViolations(route, blocking)).toEqual([]);
    });
  }

  test('the 404 page has no serious or critical violations', async ({ page }) => {
    // Audited too: it is the one page a visitor reaches by accident, and it is
    // the only one rendered from a non-200 response.
    await open(page, '/no-such-page/');

    const blocking = blockingViolations(await analyse(page));

    expect(blocking, describeViolations('/404.html', blocking)).toEqual([]);
  });
});

test.describe('document structure', () => {
  for (const route of ROUTES) {
    test(`${route} exposes one h1, a language and a working skip link`, async ({ page }) => {
      await open(page, route);

      await expect(
        page.locator('h1'),
        `${route} must have exactly one top-level heading`,
      ).toHaveCount(1);

      const lang = await page.getAttribute('html', 'lang');
      expect(lang?.trim(), `${route} must declare a non-empty <html lang>`).toBeTruthy();

      await expect(
        page.locator('main#main-content'),
        `${route} must expose main#main-content as the skip-link target`,
      ).toBeVisible();

      // Tab once from the top of the document: the skip link has to win, or a
      // keyboard visitor is forced through the whole header on every page.
      await page.keyboard.press('Tab');
      const focusedHref = await page.evaluate(
        () => document.activeElement?.getAttribute('href') ?? null,
      );
      expect(
        focusedHref?.endsWith('#main-content') ?? false,
        `the first tab stop on ${route} must be the skip link, but focus landed on ${String(focusedHref)}`,
      ).toBe(true);
    });

    test(`${route} never skips a heading level`, async ({ page }) => {
      await open(page, route);

      const headings = await page.evaluate(() =>
        Array.from(document.querySelectorAll('h1, h2, h3, h4, h5, h6')).map((heading) => ({
          level: Number(heading.tagName.slice(1)),
          text: (heading.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 60),
        })),
      );

      expect(headings.length, `${route} renders no headings at all`).toBeGreaterThan(0);

      // Jumping back up is fine (a new section); only descending by more than one
      // level leaves a gap in the outline.
      const gaps = headings.flatMap((heading, index) => {
        const previous = headings[index - 1]?.level;
        if (previous === undefined || heading.level - previous <= 1) return [];
        return [`h${previous} → h${heading.level} at “${heading.text}”`];
      });

      expect(gaps, `${route} skips heading levels: ${gaps.join('; ')}`).toEqual([]);
    });
  }
});

test.describe('mobile drawer', () => {
  /**
   * The trigger and dialog are `lg:hidden`, so they only exist below 1024px.
   * Gating on the project name rather than `browserName` is what selects the
   * Pixel 7 viewport — both projects run the same browser.
   */
  const mobileOnly = 'the drawer only renders in the mobile-chrome (Pixel 7) project';

  test('opens on click, holds focus, and Escape restores it to the trigger', async ({ page }) => {
    test.skip(test.info().project.name !== 'mobile-chrome', mobileOnly);
    await open(page, '/');

    const trigger = page.locator('[data-menu-open]');
    const dialog = page.locator('dialog#mobile-menu');

    await expect(trigger, 'the menu trigger must be reachable on mobile').toBeVisible();
    await expect(trigger).toHaveAttribute('aria-expanded', 'false');
    await expect(dialog, 'the drawer must start closed').toBeHidden();

    await trigger.click();

    await expect(
      page.locator('dialog#mobile-menu[open]'),
      'clicking the trigger must open the native dialog',
    ).toBeVisible();
    await expect(trigger, 'the trigger must report its expanded state').toHaveAttribute(
      'aria-expanded',
      'true',
    );

    const focusIsInside = await page.evaluate(() => {
      const drawer = document.querySelector('#mobile-menu');
      const focused = document.activeElement;
      return drawer !== null && focused !== null && drawer.contains(focused);
    });
    expect(focusIsInside, 'showModal() must move focus into the drawer').toBe(true);

    await page.keyboard.press('Escape');

    await expect(dialog, 'Escape must close the drawer').toBeHidden();
    await expect(
      page.locator('dialog#mobile-menu[open]'),
      'the open attribute must be gone once the drawer closes',
    ).toHaveCount(0);
    await expect(trigger, 'aria-expanded must fall back to false').toHaveAttribute(
      'aria-expanded',
      'false',
    );
    await expect(trigger, 'focus must return to the button that opened the drawer').toBeFocused();
  });

  test('the open drawer adds no serious or critical violations on /contact/', async ({ page }) => {
    test.skip(test.info().project.name !== 'mobile-chrome', mobileOnly);
    await open(page, '/contact/');

    // A modal rewrites the accessibility tree — the page behind it goes inert —
    // so the closed-drawer audit above says nothing about this state.
    await page.locator('[data-menu-open]').click();
    await expect(page.locator('dialog#mobile-menu[open]')).toBeVisible();

    const blocking = blockingViolations(await analyse(page));

    expect(blocking, describeViolations('/contact/ with the drawer open', blocking)).toEqual([]);
  });
});
