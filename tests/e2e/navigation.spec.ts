import { expect, test } from '@playwright/test';

/**
 * Navigation, routing and the mobile drawer.
 *
 * Runs against the built output served by the preview server, so a broken `base`
 * path or a page that failed to generate shows up here rather than in production.
 */

/** Mirrors `site.nav` in src/data/site.ts. Duplicated deliberately: if someone
 *  edits the nav, this test should fail and force a conscious decision. */
const NAV = [
  { label: 'Home', path: '/' },
  { label: 'About', path: '/about/' },
  { label: 'Services', path: '/services/' },
  { label: 'Capabilities', path: '/capabilities/' },
  { label: 'Contact', path: '/contact/' },
] as const;

const isMobileProject = () => test.info().project.name === 'mobile-chrome';

test.describe('routing', () => {
  for (const { path, label } of NAV) {
    test(`${label} (${path}) is served with a single h1`, async ({ page }) => {
      const response = await page.goto(path);

      expect(response, `no response for ${path}`).not.toBeNull();
      expect(response?.status(), `${path} should be served`).toBeLessThan(400);

      await expect(page.locator('h1')).toHaveCount(1);
      await expect(page.locator('h1')).not.toBeEmpty();
      await expect(page.locator('main#main-content')).toBeVisible();
    });
  }

  test('an unknown path returns the 404 page', async ({ page }) => {
    const response = await page.goto('/definitely-not-a-real-page/');

    expect(response?.status(), 'unknown paths must 404, not 200').toBe(404);
    await expect(page.locator('h1')).toContainText(/could not be found/i);
    // The 404 page must keep working navigation, or visitors are stranded.
    await expect(page.getByRole('link', { name: /back to home/i })).toBeVisible();
  });

  test('the 404 page links back into the site', async ({ page }) => {
    await page.goto('/definitely-not-a-real-page/');
    await page.getByRole('link', { name: /back to home/i }).click();
    // click() resolves before navigation commits; waitForURL is the sync point.
    await page.waitForURL((url) => url.pathname === '/');
    await expect(page.locator('h1')).toBeVisible();
  });
});

test.describe('primary navigation', () => {
  test.skip(isMobileProject, 'the desktop nav is hidden below the lg breakpoint');

  test('every nav link resolves', async ({ page }) => {
    await page.goto('/');
    const nav = page.locator('nav[aria-label="Primary"]');
    await expect(nav).toBeVisible();

    const hrefs = await nav
      .locator('a[href]')
      .evaluateAll((links) =>
        links.map((link) => (link as HTMLAnchorElement).getAttribute('href') ?? ''),
      );

    expect(hrefs, 'nav should render one link per site.nav entry').toHaveLength(NAV.length);

    for (const href of hrefs) {
      const response = await page.goto(href);
      expect(
        response?.status(),
        `${href} is linked from the nav but does not resolve`,
      ).toBeLessThan(400);
    }
  });

  test('the active item is marked with aria-current', async ({ page }) => {
    for (const { path, label } of NAV) {
      await page.goto(path);
      const nav = page.locator('nav[aria-label="Primary"]');

      const current = nav.locator('a[aria-current="page"]');
      await expect(current, `${path} should mark exactly one nav item as current`).toHaveCount(1);
      await expect(current).toHaveText(label);
    }
  });

  test('Home is only marked current on the home page', async ({ page }) => {
    // Guards the root-path special case in isActivePath(): a naive prefix match
    // lights "Home" up on every page, since every path starts with '/'.
    await page.goto('/about/');
    const home = page.locator('nav[aria-label="Primary"] a', { hasText: 'Home' });
    await expect(home).not.toHaveAttribute('aria-current', 'page');
  });

  test('clicking through the nav navigates', async ({ page }) => {
    await page.goto('/');
    const nav = page.locator('nav[aria-label="Primary"]');

    await nav.getByRole('link', { name: 'Services' }).click();
    await page.waitForURL((url) => url.pathname === '/services/');
    await expect(page.locator('h1')).toContainText(/service lines/i);
  });

  test('the header CTA reaches the contact page', async ({ page }) => {
    await page.goto('/');
    await page
      .locator('header')
      .getByRole('link', { name: /start a project/i })
      .click();
    await page.waitForURL((url) => url.pathname === '/contact/');
    await expect(page.locator('form#contact-form')).toBeVisible();
  });
});

test.describe('mobile drawer', () => {
  test.skip(() => !isMobileProject(), 'the drawer only exists below the lg breakpoint');

  test('opens, traps focus, and closes on Escape', async ({ page }) => {
    await page.goto('/');

    const trigger = page.locator('[data-menu-open]');
    const dialog = page.locator('dialog[data-menu-dialog]');

    await expect(trigger).toBeVisible();
    await expect(trigger).toHaveAttribute('aria-expanded', 'false');
    await expect(dialog).not.toHaveAttribute('open', /.*/);

    await trigger.click();
    await expect(dialog).toBeVisible();
    await expect(trigger).toHaveAttribute('aria-expanded', 'true');

    // showModal() makes the rest of the page inert; confirm focus really is
    // inside the dialog, since that is the whole reason for using <dialog>.
    const focusInDialog = await page.evaluate(() => {
      const openDialog = document.querySelector('dialog[data-menu-dialog]');
      return openDialog?.contains(document.activeElement) ?? false;
    });
    expect(focusInDialog, 'focus should move into the open drawer').toBe(true);

    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await expect(trigger).toHaveAttribute('aria-expanded', 'false');
    await expect(trigger).toBeFocused();
  });

  test('closes via the close button and restores focus', async ({ page }) => {
    await page.goto('/');

    const trigger = page.locator('[data-menu-open]');
    const dialog = page.locator('dialog[data-menu-dialog]');

    await trigger.click();
    await expect(dialog).toBeVisible();

    await page.locator('[data-menu-close]').click();
    await expect(dialog).toBeHidden();
    await expect(trigger).toBeFocused();
  });

  test('body scroll is locked while open and released on close', async ({ page }) => {
    await page.goto('/');

    const trigger = page.locator('[data-menu-open]');
    await trigger.click();
    await expect(page.locator('dialog[data-menu-dialog]')).toBeVisible();
    expect(await page.evaluate(() => document.body.style.overflow)).toBe('hidden');

    await page.keyboard.press('Escape');
    await expect(page.locator('dialog[data-menu-dialog]')).toBeHidden();
    // Polled, not sampled: the lock is released by the dialog's `close` handler,
    // which can run a tick after the dialog itself stops being visible. The
    // requirement is that scrolling comes back, not that it comes back
    // synchronously — a single read here is flaky under load.
    await expect.poll(() => page.evaluate(() => document.body.style.overflow)).toBe('');
  });

  test('every drawer link navigates and closes the drawer', async ({ page }) => {
    await page.goto('/');

    const trigger = page.locator('[data-menu-open]');
    const dialog = page.locator('dialog[data-menu-dialog]');

    await trigger.click();
    const drawerNav = dialog.locator('nav[aria-label="Site"]');
    await expect(drawerNav.locator('a[href]')).toHaveCount(NAV.length);

    await drawerNav.getByRole('link', { name: 'Capabilities' }).click();
    await page.waitForURL((url) => url.pathname === '/capabilities/');
    // A dialog left open would survive in the back/forward cache.
    await expect(page.locator('dialog[data-menu-dialog]')).toBeHidden();
  });
});

test.describe('footer', () => {
  test('links to every page and shows no placeholder contact details', async ({ page }) => {
    await page.goto('/');
    const footer = page.locator('footer');
    await expect(footer).toBeVisible();

    for (const { label } of NAV) {
      await expect(
        footer.getByRole('link', { name: label, exact: true }).first(),
        `footer should link to ${label}`,
      ).toBeVisible();
    }

    // Unconfigured contact rows are omitted rather than rendered empty.
    await expect(footer).not.toContainText('REPLACE_ME');
  });
});

test.describe('in-page anchors', () => {
  test('the services jump list targets real sections', async ({ page }) => {
    await page.goto('/services/');

    const jumpList = page.locator('nav[aria-label="Services on this page"]');
    await expect(jumpList).toBeVisible();

    const anchors = await jumpList
      .locator('a[href^="#"]')
      .evaluateAll((links) =>
        links.map((link) => (link as HTMLAnchorElement).getAttribute('href') ?? ''),
      );

    expect(anchors.length, 'expected one jump link per service').toBeGreaterThan(0);

    for (const anchor of anchors) {
      await expect(
        page.locator(anchor),
        `${anchor} is linked from the jump list but no section has that id`,
      ).toHaveCount(1);
    }
  });
});
