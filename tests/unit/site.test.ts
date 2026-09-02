import { describe, it, expect } from 'vitest';
import { isPlaceholder, site } from '@data/site';
import { services } from '@data/services';
import { capabilities } from '@data/capabilities';
import { clientEngagements, deliveryPartners, stats } from '@data/partners';
import { isValidEmail } from '@lib/form';
import { isValidPhone } from '@lib/whatsapp';

const whatsappPending = isPlaceholder(site.contact.whatsapp);
const emailPending = isPlaceholder(site.contact.email);
const formKeyPending = site.forms.web3formsKey.trim().length === 0;

describe('site identity', () => {
  it('has a name, tagline and description', () => {
    expect(site.name).toBe('JB Consultancy');
    expect(site.tagline.length).toBeGreaterThan(10);
    expect(site.description.length).toBeGreaterThan(80);
  });

  it('has a meta description within the length search engines will show', () => {
    // Google truncates around 160 characters; well over that is wasted effort.
    expect(site.description.length).toBeLessThanOrEqual(320);
  });

  it('was founded in a plausible year', () => {
    expect(site.foundedYear).toBe(2025);
    expect(site.foundedYear).toBeLessThanOrEqual(new Date().getFullYear());
  });
});

describe('contact configuration', () => {
  /*
   * These tests enforce a contract rather than a specific value: a field is
   * either an obvious, detectable placeholder or a genuinely valid value. What
   * they rule out is the dangerous middle state — a real-looking but malformed
   * number or address that ships silently and quietly loses enquiries.
   */

  it('the WhatsApp number is either a placeholder or a valid E.164 number', () => {
    if (whatsappPending) {
      expect(isPlaceholder(site.contact.whatsapp)).toBe(true);
    } else {
      expect(isValidPhone(site.contact.whatsapp)).toBe(true);
      expect(site.contact.whatsapp).toMatch(/^\d+$/); // digits only, no '+' or spaces
    }
  });

  it('the contact email is either a placeholder or a valid address', () => {
    if (emailPending) {
      expect(isPlaceholder(site.contact.email)).toBe(true);
    } else {
      expect(isValidEmail(site.contact.email)).toBe(true);
    }
  });

  it('keeps the WhatsApp prefill short enough to send unedited', () => {
    const message = site.contact.whatsappMessage;

    // Every WhatsApp button on the site shares this one string, and it arrives
    // in the visitor's composer as words they are about to send as their own.
    // A long scripted opener makes them delete a paragraph before they can
    // type, so the cap is deliberately tight — a greeting, not a pitch.
    expect(message.trim()).toBe(message);
    expect(message.length).toBeGreaterThan(0);
    expect(message.length).toBeLessThanOrEqual(40);
    expect(message).not.toContain('\n');
  });

  it('an optional phone number, when present, is valid', () => {
    if (site.contact.phone.length > 0) {
      expect(isValidPhone(site.contact.phone)).toBe(true);
    }
  });

  it('points the form at the documented Web3Forms endpoint over HTTPS', () => {
    expect(site.forms.endpoint).toBe('https://api.web3forms.com/submit');
    expect(new URL(site.forms.endpoint).protocol).toBe('https:');
  });
});

/*
 * Go-live readiness. These are *skipped*, not failed, while the real contact
 * details are outstanding: a permanently-red suite trains people to ignore
 * failures. Skipped tests stay visible in the report as work still to do, and
 * they start enforcing the moment a real value is filled in.
 */
describe('go-live readiness', () => {
  it.skipIf(whatsappPending)('WhatsApp number is configured', () => {
    expect(isValidPhone(site.contact.whatsapp)).toBe(true);
  });

  it.skipIf(emailPending)('contact email is configured', () => {
    expect(isValidEmail(site.contact.email)).toBe(true);
  });

  it.skipIf(formKeyPending)('Web3Forms access key is configured', () => {
    expect(site.forms.web3formsKey.trim().length).toBeGreaterThan(8);
  });

  it('reports what still needs filling in', () => {
    const pending = [
      whatsappPending && 'site.contact.whatsapp',
      emailPending && 'site.contact.email',
      formKeyPending && 'site.forms.web3formsKey',
    ].filter((entry): entry is string => typeof entry === 'string');

    if (pending.length > 0) {
      console.warn(
        `\n  ⚠ ${pending.length} placeholder value(s) still to replace in src/data/site.ts:\n` +
          pending.map((key) => `      • ${key}`).join('\n') +
          '\n    Until then: the WhatsApp buttons stay hidden and the contact form\n' +
          '    falls back to a mailto: composer.\n',
      );
    }

    // Always passes — this test exists to surface the list, not to gate the build.
    expect(pending.length).toBeLessThanOrEqual(3);
  });
});

describe('navigation', () => {
  it('lists every page exactly once', () => {
    expect(site.nav.map((item) => item.href)).toEqual([
      '/',
      '/about/',
      '/services/',
      '/capabilities/',
      '/contact/',
    ]);
  });

  it('uses root-relative hrefs with a trailing slash, matching build.format', () => {
    // astro.config.mjs sets build.format: 'directory', so '/about/' resolves
    // without a redirect while '/about' would bounce.
    for (const item of site.nav) {
      expect(item.href.startsWith('/')).toBe(true);
      expect(item.href.endsWith('/')).toBe(true);
      expect(item.href).not.toMatch(/^https?:/);
    }
  });

  it('has a unique, non-empty label per entry', () => {
    const labels = site.nav.map((item) => item.label);
    expect(new Set(labels).size).toBe(labels.length);
    expect(labels.every((label) => label.trim().length > 0)).toBe(true);
  });
});

describe('services', () => {
  it('defines four service lines', () => {
    expect(services).toHaveLength(4);
  });

  it('has unique, URL-safe slugs', () => {
    const slugs = services.map((service) => service.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const slug of slugs) {
      // Slugs double as anchor ids and as contact-form select values.
      expect(slug).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
    }
  });

  it('gives every service a title, summary, body and highlights', () => {
    for (const service of services) {
      expect(service.title.length).toBeGreaterThan(5);
      expect(service.summary.length).toBeGreaterThan(20);
      expect(service.body.length).toBeGreaterThan(80);
      expect(service.highlights.length).toBeGreaterThanOrEqual(3);
      expect(service.highlights.every((h) => h.trim().length > 0)).toBe(true);
    }
  });

  it('keeps card summaries short enough not to wrap unreasonably', () => {
    for (const service of services) {
      expect(service.summary.length).toBeLessThanOrEqual(120);
    }
  });

  it('uses only icon keys the Icon component can resolve', () => {
    const available = new Set(['users', 'layers', 'trending-up', 'sparkles']);
    for (const service of services) {
      expect(available.has(service.icon)).toBe(true);
    }
  });

  it('covers the service lines named in the company brief', () => {
    const titles = services.map((s) => s.title.toLowerCase()).join(' | ');
    expect(titles).toContain('talent acquisition');
    expect(titles).toContain('end-to-end');
    expect(titles).toContain('marketing');
    expect(titles).toContain('ai');
  });
});

describe('capabilities', () => {
  it('covers the four practice areas from the brief', () => {
    expect(capabilities).toHaveLength(4);
    const areas = capabilities.map((c) => c.area);
    expect(areas).toContain('Enterprise Applications');
    expect(areas).toContain('Database & Cloud Solutions');
    expect(areas).toContain('Full Stack Engineering');
    expect(areas).toContain('AI & Next-Gen Capabilities');
  });

  it('names SAP and Oracle against the right practice areas', () => {
    const bySlug = new Map(capabilities.map((c) => [c.slug, c]));
    expect(bySlug.get('enterprise-applications')?.platform).toBe('SAP');
    expect(bySlug.get('database-cloud')?.platform).toBe('Oracle');
  });

  it('has unique slugs and at least three skills each', () => {
    const slugs = capabilities.map((c) => c.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const capability of capabilities) {
      expect(capability.skills.length).toBeGreaterThanOrEqual(3);
      expect(capability.description.length).toBeGreaterThan(40);
    }
  });

  it('lists the full-stack technologies named in the brief', () => {
    const fullStack = capabilities.find((c) => c.slug === 'full-stack');
    expect(fullStack?.skills).toEqual(
      expect.arrayContaining(['Node.js', 'React', 'Angular', 'Python', 'Java', 'Go']),
    );
  });
});

describe('partners and engagements', () => {
  it('lists Wipro and TCS as delivery partners', () => {
    expect(deliveryPartners.map((p) => p.name)).toEqual(['Wipro', 'TCS']);
  });

  it('lists the Mohalla Tech and Finlane engagements', () => {
    expect(clientEngagements.map((c) => c.name)).toEqual(['Mohalla Tech', 'Finlane']);
  });

  it('describes every organisation with a role and detail', () => {
    for (const org of [...deliveryPartners, ...clientEngagements]) {
      expect(org.role.trim().length).toBeGreaterThan(0);
      expect(org.description.length).toBeGreaterThan(40);
    }
  });

  it('quotes only stats that follow from the brief', () => {
    // The firm was established in 2025, so volume metrics would be invented.
    // This guards against someone later pasting in an unaudited "500+ placements".
    expect(stats).toHaveLength(4);
    expect(stats.map((s) => s.value)).toContain(String(site.foundedYear));
    expect(stats.every((s) => s.label.trim().length > 0)).toBe(true);
  });
});
