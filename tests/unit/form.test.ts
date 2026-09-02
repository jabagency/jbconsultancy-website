import { describe, it, expect } from 'vitest';
import {
  LIMITS,
  buildMailtoFallback,
  buildSubmissionPayload,
  isValidEmail,
  validateContact,
  type ContactFormValues,
} from '@lib/form';

/** A submission that passes every rule; individual tests override one field. */
const validValues: ContactFormValues = {
  name: 'Priya Raman',
  email: 'priya@finlane.com',
  company: 'Finlane',
  service: 'e2e-delivery',
  message: 'We need help scaling our payments platform ahead of a launch next quarter.',
};

const withValues = (overrides: Partial<ContactFormValues>): ContactFormValues => ({
  ...validValues,
  ...overrides,
});

describe('isValidEmail', () => {
  it.each(['priya@finlane.com', 'first.last@sub.domain.co.in', 'name+tag@company.io', 'a@b.co'])(
    'accepts %s',
    (email) => {
      expect(isValidEmail(email)).toBe(true);
    },
  );

  it.each([
    ['no at sign', 'priyafinlane.com'],
    ['no domain', 'priya@'],
    ['no local part', '@finlane.com'],
    ['no TLD', 'priya@finlane'],
    ['single-character TLD', 'priya@finlane.c'],
    ['embedded space', 'priya name@finlane.com'],
    ['two at signs', 'priya@@finlane.com'],
    ['trailing dot', 'priya@finlane.'],
    ['empty', ''],
  ])('rejects %s', (_label, email) => {
    expect(isValidEmail(email)).toBe(false);
  });

  it('rejects addresses beyond the 254-character limit', () => {
    expect(isValidEmail(`${'a'.repeat(250)}@b.co`)).toBe(false);
  });
});

describe('validateContact', () => {
  it('accepts a well-formed submission', () => {
    const result = validateContact(validValues);
    expect(result).toEqual({ valid: true, errors: {}, isBot: false });
  });

  it('flags a filled honeypot as a bot without reporting field errors', () => {
    const result = validateContact(withValues({ botcheck: 'http://spam.example' }));

    expect(result.isBot).toBe(true);
    expect(result.valid).toBe(false);
    // No errors: the UI shows an ordinary success state and simply sends nothing,
    // so the bot gets no feedback that it was detected.
    expect(result.errors).toEqual({});
  });

  it('treats a whitespace-only honeypot as human', () => {
    expect(validateContact(withValues({ botcheck: '   ' })).isBot).toBe(false);
  });

  it('requires a name of at least the minimum length', () => {
    const result = validateContact(withValues({ name: 'A' }));
    expect(result.valid).toBe(false);
    expect(result.errors.name).toMatch(/full name/i);
  });

  it('rejects a name padded only with whitespace', () => {
    expect(validateContact(withValues({ name: '   ' })).errors.name).toBeDefined();
  });

  it('rejects an over-long name', () => {
    const result = validateContact(withValues({ name: 'x'.repeat(LIMITS.name.max + 1) }));
    expect(result.errors.name).toMatch(/under 80 characters/i);
  });

  it('distinguishes a missing email from a malformed one', () => {
    expect(validateContact(withValues({ email: '' })).errors.email).toMatch(/enter your email/i);
    expect(validateContact(withValues({ email: 'nope' })).errors.email).toMatch(/valid email/i);
  });

  it('requires a message with enough substance to act on', () => {
    const result = validateContact(withValues({ message: 'Call me' }));
    expect(result.valid).toBe(false);
    expect(result.errors.message).toMatch(/at least 20 characters/i);
  });

  it('rejects an over-long message', () => {
    const result = validateContact(withValues({ message: 'x'.repeat(LIMITS.message.max + 1) }));
    expect(result.errors.message).toMatch(/under 2000 characters/i);
  });

  it('treats company as optional but length-capped', () => {
    expect(validateContact(withValues({ company: '' })).valid).toBe(true);
    expect(
      validateContact(withValues({ company: 'x'.repeat(LIMITS.company.max + 1) })).errors.company,
    ).toBeDefined();
  });

  it('reports every invalid field at once rather than one at a time', () => {
    const result = validateContact({
      name: '',
      email: 'bad',
      company: '',
      service: '',
      message: 'short',
    });

    expect(Object.keys(result.errors).sort()).toEqual(['email', 'message', 'name']);
  });
});

describe('buildSubmissionPayload', () => {
  it('includes the access key and a descriptive subject', () => {
    const payload = buildSubmissionPayload(validValues, 'key-123', 'JB Consultancy');

    expect(payload.access_key).toBe('key-123');
    expect(payload.subject).toBe('New enquiry from Priya Raman — JB Consultancy');
    expect(payload.message).toBe(validValues.message);
  });

  it('always sends an empty honeypot so Web3Forms does not reject the request', () => {
    expect(buildSubmissionPayload(validValues, 'k', 'JB').botcheck).toBe('');
  });

  it('substitutes readable defaults for omitted optional fields', () => {
    const payload = buildSubmissionPayload(
      withValues({ company: '', service: '' }),
      'k',
      'JB Consultancy',
    );

    expect(payload.company).toBe('Not provided');
    expect(payload.service).toBe('Not specified');
  });

  it('trims user input before sending', () => {
    const payload = buildSubmissionPayload(
      withValues({ name: '  Priya Raman  ', email: '  priya@finlane.com  ' }),
      'k',
      'JB',
    );

    expect(payload.name).toBe('Priya Raman');
    expect(payload.email).toBe('priya@finlane.com');
  });
});

describe('buildMailtoFallback', () => {
  it('targets the configured address and carries the enquiry in the body', () => {
    const url = buildMailtoFallback(validValues, 'hello@jb.com', 'JB Consultancy');

    expect(url.startsWith('mailto:hello@jb.com?')).toBe(true);
    expect(decodeURIComponent(url)).toContain('Priya Raman');
    expect(decodeURIComponent(url)).toContain(validValues.message);
  });

  it('encodes spaces as %20, which mail clients handle correctly', () => {
    const url = buildMailtoFallback(validValues, 'hello@jb.com', 'JB Consultancy');

    // URLSearchParams emits '+' for spaces; several desktop clients render that
    // literally in the subject line, so it must be rewritten.
    expect(url).not.toContain('+');
    expect(url).toContain('%20');
  });
});
