import { describe, it, expect } from 'vitest';
import {
  buildWhatsAppUrl,
  formatPhoneForDisplay,
  isValidPhone,
  normalisePhone,
} from '@lib/whatsapp';

describe('normalisePhone', () => {
  it('strips spaces, hyphens, parentheses and the leading plus', () => {
    expect(normalisePhone('+91 98765-43210')).toBe('919876543210');
    expect(normalisePhone('+91 (98765) 43210')).toBe('919876543210');
    expect(normalisePhone('91.98765.43210')).toBe('919876543210');
  });

  it('drops a 00 international dialling prefix', () => {
    expect(normalisePhone('0091 98765 43210')).toBe('919876543210');
  });

  it('returns an empty string when there are no digits at all', () => {
    expect(normalisePhone('not a phone number')).toBe('');
    expect(normalisePhone('')).toBe('');
  });
});

describe('isValidPhone', () => {
  it('accepts plausible E.164 numbers', () => {
    expect(isValidPhone('+91 98765 43210')).toBe(true);
    expect(isValidPhone('+1 415 555 2671')).toBe(true);
  });

  it('rejects numbers that are too short or too long', () => {
    expect(isValidPhone('1234567')).toBe(false); // 7 digits, below the E.164 floor
    expect(isValidPhone('1234567890123456')).toBe(false); // 16 digits, above the ceiling
  });

  it('rejects placeholder and empty values', () => {
    expect(isValidPhone('91REPLACE_ME')).toBe(false);
    expect(isValidPhone('')).toBe(false);
  });
});

describe('buildWhatsAppUrl', () => {
  it('builds a bare wa.me link with digits only', () => {
    expect(buildWhatsAppUrl({ phone: '+91 98765 43210' })).toBe('https://wa.me/919876543210');
  });

  it('percent-encodes the prefilled message', () => {
    const url = buildWhatsAppUrl({
      phone: '919876543210',
      message: 'Hi JB Consultancy, I need SAP & Oracle help',
    });

    expect(url).toContain('https://wa.me/919876543210?text=');
    // Spaces must not survive as literal spaces, and '&' must not start a new param.
    expect(url).not.toMatch(/text=[^&]*\s/);
    expect(url).toContain('%26');

    // The message must round-trip back out intact.
    expect(new URL(url!).searchParams.get('text')).toBe(
      'Hi JB Consultancy, I need SAP & Oracle help',
    );
  });

  it('omits the text parameter when the message is empty or whitespace', () => {
    expect(buildWhatsAppUrl({ phone: '919876543210', message: '' })).toBe(
      'https://wa.me/919876543210',
    );
    expect(buildWhatsAppUrl({ phone: '919876543210', message: '   ' })).toBe(
      'https://wa.me/919876543210',
    );
  });

  it('returns null for an invalid number so callers can hide the button', () => {
    // The whole point: a placeholder must never render a link that lands the
    // visitor on WhatsApp's "phone number is invalid" error page.
    expect(buildWhatsAppUrl({ phone: '91REPLACE_ME' })).toBeNull();
    expect(buildWhatsAppUrl({ phone: '' })).toBeNull();
  });
});

describe('formatPhoneForDisplay', () => {
  it('groups Indian mobile numbers as +91 XXXXX XXXXX', () => {
    expect(formatPhoneForDisplay('919876543210')).toBe('+91 98765 43210');
  });

  it('falls back to a plain +digits form for other countries', () => {
    expect(formatPhoneForDisplay('14155552671')).toBe('+14155552671');
  });

  it('returns an empty string when there is nothing to show', () => {
    expect(formatPhoneForDisplay('')).toBe('');
  });
});
