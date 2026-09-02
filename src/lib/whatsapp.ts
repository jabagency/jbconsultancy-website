/**
 * WhatsApp click-to-chat link construction.
 *
 * wa.me requires a bare international number: digits only, country code first,
 * no `+`, spaces, hyphens or parentheses. Passing a formatted number yields a
 * "phone number shared via url is invalid" error page, so every number is
 * normalised here rather than at each call site.
 */

const WA_ME_ORIGIN = 'https://wa.me';

/** Shortest and longest plausible international numbers, per ITU-T E.164. */
const MIN_DIGITS = 8;
const MAX_DIGITS = 15;

export interface WhatsAppLinkOptions {
  /** Phone number in any human format; non-digits are stripped. */
  readonly phone: string;
  /** Optional message pre-filled in the user's WhatsApp composer. */
  readonly message?: string;
}

/** Strip every non-digit, and drop a leading `00` international prefix. */
export function normalisePhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  return digits.startsWith('00') ? digits.slice(2) : digits;
}

/** True when `phone` normalises to a plausible E.164 number. */
export function isValidPhone(phone: string): boolean {
  const digits = normalisePhone(phone);
  return digits.length >= MIN_DIGITS && digits.length <= MAX_DIGITS;
}

/**
 * Build a wa.me deep link, or return `null` when the number is unusable.
 *
 * Returning `null` rather than throwing lets callers hide the WhatsApp button
 * while the number is still a placeholder, instead of rendering a link that
 * lands the visitor on a WhatsApp error page.
 */
export function buildWhatsAppUrl({ phone, message }: WhatsAppLinkOptions): string | null {
  if (!isValidPhone(phone)) return null;

  const url = new URL(`${WA_ME_ORIGIN}/${normalisePhone(phone)}`);
  if (message && message.trim().length > 0) {
    url.searchParams.set('text', message.trim());
  }
  return url.toString();
}

/** Format a number for display, e.g. '919876543210' → '+91 98765 43210'. */
export function formatPhoneForDisplay(phone: string): string {
  const digits = normalisePhone(phone);
  if (digits.length !== 12 || !digits.startsWith('91')) {
    return digits.length > 0 ? `+${digits}` : '';
  }
  // Indian mobile numbers read most naturally as +91 XXXXX XXXXX.
  return `+91 ${digits.slice(2, 7)} ${digits.slice(7)}`;
}
