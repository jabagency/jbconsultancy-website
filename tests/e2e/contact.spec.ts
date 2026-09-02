import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

/**
 * The contact page: validation, the honeypot, both Web3Forms outcomes, the
 * `mailto:` fallback, and the WhatsApp route.
 *
 * The Web3Forms endpoint is always mocked with `page.route` — the suite must
 * never post to a third party, and mocking is the only way to exercise the
 * failure path deterministically.
 */

const WEB3FORMS_ENDPOINT = 'https://api.web3forms.com/submit';
const TEST_ACCESS_KEY = 'e2e-test-access-key';

const VALID = {
  name: 'Priya Raman',
  email: 'priya@example.com',
  company: 'Finlane',
  message: 'We need two senior Node engineers embedded with our payments squad from October.',
} as const;

/** Fill the required fields with input that passes validateContact(). */
async function fillValidEnquiry(page: Page): Promise<void> {
  await page.fill('#name', VALID.name);
  await page.fill('#email', VALID.email);
  await page.fill('#company', VALID.company);
  await page.fill('#message', VALID.message);
}

/**
 * Pretend the site has been configured with a Web3Forms key.
 *
 * `src/data/site.ts` ships an empty key, so the built form takes the `mailto:`
 * branch. The submit handler re-reads `data-access-key` on every submit, so
 * setting it here switches the same build onto the network branch.
 */
async function configureAccessKey(page: Page): Promise<void> {
  await page.evaluate((key) => {
    document
      .querySelector<HTMLFormElement>('[data-contact-form]')
      ?.setAttribute('data-access-key', key);
  }, TEST_ACCESS_KEY);
}

const status = (page: Page) => page.locator('[data-form-status]');

test.beforeEach(async ({ page }) => {
  await page.goto('/contact/');
  await expect(page.locator('form#contact-form')).toBeVisible();
});

test.describe('form structure', () => {
  test('every control has a real label', async ({ page }) => {
    for (const [id, label] of [
      ['#name', /full name/i],
      ['#email', /work email/i],
      ['#company', /company/i],
      ['#service', /what do you need help with/i],
      ['#message', /how can we help/i],
    ] as const) {
      const control = page.locator(id);
      await expect(control).toBeVisible();
      const labelText = await page.locator(`label[for="${id.slice(1)}"]`).innerText();
      expect(labelText, `${id} should be labelled`).toMatch(label);
    }
  });

  test('the honeypot is present, empty and unreachable', async ({ page }) => {
    const honeypot = page.locator('#botcheck');

    await expect(honeypot).toHaveCount(1);
    await expect(honeypot).toHaveValue('');
    await expect(honeypot).toHaveAttribute('tabindex', '-1');

    /*
     * Deliberately positioned off-screen rather than `display: none` — bots that
     * skip hidden inputs are exactly the ones the trap needs to catch. So the
     * requirement is "no human can see or reach it", not Playwright's notion of
     * visibility: assert the box sits outside the viewport instead.
     */
    const box = await honeypot.boundingBox();
    expect(box, 'the honeypot should still occupy a layout box').not.toBeNull();
    expect(
      (box?.x ?? 0) + (box?.width ?? 0),
      'the honeypot must sit off the left edge of the viewport',
    ).toBeLessThan(0);

    // Hidden from assistive tech too, or a screen reader user is asked to fill it.
    const hiddenFromAT = await honeypot.evaluate(
      (input) => input.closest('[aria-hidden="true"]') !== null,
    );
    expect(hiddenFromAT, 'the honeypot wrapper should be aria-hidden').toBe(true);
  });

  test('the service select offers every service line', async ({ page }) => {
    const options = await page
      .locator('#service option')
      .evaluateAll((nodes) => nodes.map((node) => (node as HTMLOptionElement).value));

    // Empty prompt + four service slugs + 'other'.
    expect(options[0]).toBe('');
    expect(options).toContain('talent-acquisition');
    expect(options).toContain('e2e-delivery');
    expect(options).toContain('marketing-growth');
    expect(options).toContain('ai-engineering');
    expect(options).toContain('other');
  });

  test('the status region is a live region and starts empty', async ({ page }) => {
    await expect(status(page)).toHaveAttribute('aria-live', 'polite');
    await expect(status(page)).toBeEmpty();
  });

  test('submitting does not reload the page', async ({ page }) => {
    // A native submit would navigate and lose everything the visitor typed.
    await expect(page.locator('form#contact-form')).toHaveAttribute('novalidate', '');
    await page.evaluate(() => {
      window.sessionStorage.setItem('e2e-marker', 'set');
    });

    await page.click('#contact-submit');
    await expect(page.locator('#name-error')).not.toBeEmpty();

    const survived = await page.evaluate(() => window.sessionStorage.getItem('e2e-marker'));
    expect(survived, 'the page should not have navigated').toBe('set');
  });
});

test.describe('validation', () => {
  test('an empty submit reports every required field', async ({ page }) => {
    await page.click('#contact-submit');

    await expect(page.locator('#name-error')).not.toBeEmpty();
    await expect(page.locator('#email-error')).not.toBeEmpty();
    await expect(page.locator('#message-error')).not.toBeEmpty();

    await expect(page.locator('#name')).toHaveAttribute('aria-invalid', 'true');
    await expect(page.locator('#email')).toHaveAttribute('aria-invalid', 'true');
    await expect(page.locator('#message')).toHaveAttribute('aria-invalid', 'true');

    // Company is optional, so it must not be flagged.
    await expect(page.locator('#company')).not.toHaveAttribute('aria-invalid', 'true');
  });

  test('focus moves to the first invalid field', async ({ page }) => {
    await page.click('#contact-submit');
    await expect(page.locator('#name')).toBeFocused();
  });

  test('a malformed email is rejected on its own', async ({ page }) => {
    await fillValidEnquiry(page);
    await page.fill('#email', 'not-an-email');
    await page.click('#contact-submit');

    await expect(page.locator('#email-error')).not.toBeEmpty();
    await expect(page.locator('#email')).toHaveAttribute('aria-invalid', 'true');
    await expect(page.locator('#name-error')).toBeEmpty();
    await expect(page.locator('#message-error')).toBeEmpty();
  });

  test('a too-short message is rejected', async ({ page }) => {
    await fillValidEnquiry(page);
    await page.fill('#message', 'hi');
    await page.click('#contact-submit');

    await expect(page.locator('#message-error')).not.toBeEmpty();
  });

  test('editing a field clears its error immediately', async ({ page }) => {
    await page.click('#contact-submit');
    await expect(page.locator('#name-error')).not.toBeEmpty();

    await page.fill('#name', 'P');
    await expect(page.locator('#name-error')).toBeEmpty();
    await expect(page.locator('#name')).not.toHaveAttribute('aria-invalid', 'true');
  });

  test('nothing is sent while the form is invalid', async ({ page }) => {
    await configureAccessKey(page);

    let requests = 0;
    await page.route(WEB3FORMS_ENDPOINT, async (route) => {
      requests += 1;
      await route.fulfill({ status: 200, body: JSON.stringify({ success: true }) });
    });

    await page.click('#contact-submit');
    await expect(page.locator('#name-error')).not.toBeEmpty();
    expect(requests, 'an invalid form must not reach the network').toBe(0);
  });

  test('the character counter tracks the message', async ({ page }) => {
    await expect(page.locator('[data-char-count]')).toHaveText('0');
    await page.fill('#message', VALID.message);
    await expect(page.locator('[data-char-count]')).toHaveText(String(VALID.message.length));
  });
});

test.describe('honeypot', () => {
  test('a filled honeypot is silently discarded', async ({ page }) => {
    await configureAccessKey(page);

    let requests = 0;
    await page.route(WEB3FORMS_ENDPOINT, async (route) => {
      requests += 1;
      await route.fulfill({ status: 200, body: JSON.stringify({ success: true }) });
    });

    await fillValidEnquiry(page);
    // Bypasses the off-screen positioning the way a naive bot would.
    await page.locator('#botcheck').fill('http://spam.example.com');

    await page.click('#contact-submit');

    // The bot is shown the ordinary success state, so it learns nothing…
    await expect(status(page)).toContainText(/thank you/i);
    // …but nothing was actually sent.
    expect(requests, 'a tripped honeypot must not reach the network').toBe(0);
  });
});

test.describe('Web3Forms submission', () => {
  test('a successful send confirms and clears the form', async ({ page }) => {
    await configureAccessKey(page);

    const payloads: unknown[] = [];
    await page.route(WEB3FORMS_ENDPOINT, async (route) => {
      payloads.push(route.request().postDataJSON());
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, message: 'Email sent successfully' }),
      });
    });

    await fillValidEnquiry(page);
    await page.selectOption('#service', 'e2e-delivery');
    await page.click('#contact-submit');

    await expect(status(page)).toContainText(/thank you/i);

    expect(payloads, 'exactly one submission should be sent').toHaveLength(1);
    const payload = payloads[0] as Record<string, unknown>;
    expect(payload.access_key).toBe(TEST_ACCESS_KEY);
    expect(payload.email).toBe(VALID.email);
    expect(payload.name).toBe(VALID.name);
    expect(String(payload.message)).toContain('payments squad');

    // Cleared, so a double submit cannot resend the same enquiry.
    await expect(page.locator('#name')).toHaveValue('');
    await expect(page.locator('#message')).toHaveValue('');
    await expect(page.locator('[data-char-count]')).toHaveText('0');
  });

  test('an API rejection surfaces the reason and keeps the typed content', async ({ page }) => {
    await configureAccessKey(page);

    await page.route(WEB3FORMS_ENDPOINT, async (route) => {
      await route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({ success: false, message: 'Access key is invalid' }),
      });
    });

    await fillValidEnquiry(page);
    await page.click('#contact-submit');

    await expect(status(page)).toContainText(/access key is invalid/i);
    await expect(status(page)).toContainText(/try again/i);

    // Losing the message on a server error is the worst possible outcome.
    await expect(page.locator('#name')).toHaveValue(VALID.name);
    await expect(page.locator('#message')).toHaveValue(VALID.message);
  });

  test('a network failure is reported without losing the message', async ({ page }) => {
    await configureAccessKey(page);
    await page.route(WEB3FORMS_ENDPOINT, (route) => route.abort('connectionfailed'));

    await fillValidEnquiry(page);
    await page.click('#contact-submit');

    await expect(status(page)).toContainText(/could not reach the server/i);
    await expect(page.locator('#message')).toHaveValue(VALID.message);
  });

  test('the submit button is re-enabled after a failure', async ({ page }) => {
    await configureAccessKey(page);
    await page.route(WEB3FORMS_ENDPOINT, (route) => route.abort('connectionfailed'));

    await fillValidEnquiry(page);
    await page.click('#contact-submit');
    await expect(status(page)).toContainText(/could not reach/i);

    await expect(page.locator('#contact-submit')).toBeEnabled();
    await expect(page.locator('[data-submit-label]')).toHaveText('Send enquiry');
  });
});

test.describe('mailto fallback', () => {
  test('an unconfigured key hands off to the mail client', async ({ page }) => {
    // This is the shipped state: site.forms.web3formsKey is empty.
    const accessKey = await page.locator('[data-contact-form]').getAttribute('data-access-key');
    const contactEmail = await page
      .locator('[data-contact-form]')
      .getAttribute('data-contact-email');

    test.skip(
      accessKey !== null && accessKey.trim().length > 0,
      'a real Web3Forms key is configured, so the fallback no longer applies',
    );

    let requests = 0;
    await page.route(WEB3FORMS_ENDPOINT, async (route) => {
      requests += 1;
      await route.fulfill({ status: 200, body: JSON.stringify({ success: true }) });
    });

    await fillValidEnquiry(page);
    await page.click('#contact-submit');

    // With no key AND no email configured the form says so plainly rather than
    // pretending to send; with an email it opens the composer. Either way it
    // must never silently swallow the enquiry, and must not post anywhere.
    if (contactEmail !== null && contactEmail.length > 0) {
      await expect(status(page)).toContainText(/opening your email app/i);
    } else {
      await expect(status(page)).toContainText(/not yet connected/i);
    }
    expect(requests, 'the fallback must not post to Web3Forms').toBe(0);
  });
});

test.describe('service deep links', () => {
  test('?service= preselects the matching option', async ({ page }) => {
    await page.goto('/contact/?service=ai-engineering');
    await expect(page.locator('#service')).toHaveValue('ai-engineering');
  });

  test('an unknown ?service= value is ignored', async ({ page }) => {
    await page.goto('/contact/?service=not-a-real-service');
    await expect(page.locator('#service')).toHaveValue('');
  });

  test('the services page links through with the right slug', async ({ page }) => {
    await page.goto('/services/');
    await page
      .locator('#talent-acquisition')
      .getByRole('link', { name: /enquire about this/i })
      .click();

    // click() resolves before navigation commits, so wait for the URL first.
    await page.waitForURL(/\/contact\/\?service=talent-acquisition$/);
    expect(new URL(page.url()).searchParams.get('service')).toBe('talent-acquisition');
    await expect(page.locator('#service')).toHaveValue('talent-acquisition');
  });
});

test.describe('WhatsApp', () => {
  test('any WhatsApp link is a well-formed wa.me deep link', async ({ page }) => {
    // WhatsApp buttons are suppressed while site.contact.whatsapp is a
    // placeholder, so this asserts correctness *if* rendered rather than
    // presence — it starts enforcing the moment a real number is configured.
    const links = page.locator('a[href*="wa.me"]');
    const count = await links.count();

    for (let index = 0; index < count; index += 1) {
      const href = await links.nth(index).getAttribute('href');
      expect(href, 'wa.me link should have an href').not.toBeNull();

      const url = new URL(href ?? '');
      expect(url.origin).toBe('https://wa.me');
      // Digits only: wa.me rejects '+', spaces and dashes with an error page.
      expect(url.pathname.slice(1)).toMatch(/^\d{8,15}$/);
      // Present, but short: the prefill is text the visitor sends as their own,
      // so a scripted paragraph would have to be deleted before they can type.
      const text = url.searchParams.get('text') ?? '';
      expect(text.length).toBeGreaterThan(0);
      expect(text.length).toBeLessThanOrEqual(40);

      await expect(links.nth(index)).toHaveAttribute('target', '_blank');
      await expect(links.nth(index)).toHaveAttribute('rel', /noopener/);
    }
  });

  test('no dead placeholder contact details are rendered', async ({ page }) => {
    // The failure this guards against is shipping 'wa.me/91REPLACE_ME'.
    await expect(page.locator('body')).not.toContainText('REPLACE_ME');
  });
});
