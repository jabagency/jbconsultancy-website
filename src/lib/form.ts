/**
 * Contact form validation and payload shaping.
 *
 * Deliberately free of DOM access so it can be unit-tested directly and reused
 * by the browser island in ContactForm.astro without a rendering step.
 */
import { isValidPhone } from '@lib/whatsapp';

export interface ContactFormValues {
  readonly name: string;
  readonly email: string;
  readonly phone: string;
  readonly company: string;
  readonly service: string;
  readonly message: string;
  /** Honeypot. Real users never see this field, so any content means a bot. */
  readonly botcheck?: string;
}

/** Field name → human-readable error, for fields that failed validation. */
export type FieldErrors = Partial<Record<keyof ContactFormValues, string>>;

export interface ValidationResult {
  readonly valid: boolean;
  readonly errors: FieldErrors;
  /** True when the honeypot was filled — reject silently, do not show an error. */
  readonly isBot: boolean;
}

export const LIMITS = {
  name: { min: 2, max: 80 },
  email: { max: 254 },
  /**
   * Cap on the typed string, not on the digit count — the number itself is
   * checked with `isValidPhone` (8–15 digits, per ITU-T E.164). The allowance
   * above 15 leaves room for the separators people naturally type, as in
   * '+91 (98765) 43210'.
   */
  phone: { max: 24 },
  company: { max: 120 },
  message: { min: 20, max: 2000 },
} as const;

/**
 * Pragmatic email check: a single `@`, a non-empty local part, and a dotted
 * domain with a 2+ character TLD. Deliberately not RFC 5322 — that grammar
 * accepts addresses no mail provider issues, and the real proof of validity is
 * the visitor receiving our reply.
 */
const EMAIL_PATTERN = /^[^\s@]+@[^\s@.]+(?:\.[^\s@.]+)*\.[a-z]{2,}$/i;

export function isValidEmail(email: string): boolean {
  const trimmed = email.trim();
  return trimmed.length <= LIMITS.email.max && EMAIL_PATTERN.test(trimmed);
}

/**
 * Characters a phone number may legitimately contain. Checked before the digit
 * count so that 'call me' fails with "use digits" rather than with a length
 * complaint — `isValidPhone` strips non-digits, so on its own it would report a
 * confusing error for input that was never a number at all.
 */
const PHONE_PATTERN = /^\+?[\d\s().-]+$/;

export function validateContact(values: ContactFormValues): ValidationResult {
  // A filled honeypot short-circuits everything: we report "valid" so the caller
  // can show an ordinary success state, but flag isBot so nothing is sent.
  if (values.botcheck && values.botcheck.trim().length > 0) {
    return { valid: false, errors: {}, isBot: true };
  }

  const errors: FieldErrors = {};
  const name = values.name.trim();
  const message = values.message.trim();
  const company = values.company.trim();

  if (name.length < LIMITS.name.min) {
    errors.name = 'Please enter your full name.';
  } else if (name.length > LIMITS.name.max) {
    errors.name = `Please keep your name under ${LIMITS.name.max} characters.`;
  }

  if (values.email.trim().length === 0) {
    errors.email = 'Please enter your email address.';
  } else if (!isValidEmail(values.email)) {
    errors.email = 'Please enter a valid email address, for example name@company.com.';
  }

  const phone = values.phone.trim();
  if (phone.length === 0) {
    errors.phone = 'Please enter your phone number.';
  } else if (phone.length > LIMITS.phone.max) {
    errors.phone = `Please keep your phone number under ${LIMITS.phone.max} characters.`;
  } else if (!PHONE_PATTERN.test(phone)) {
    errors.phone = 'Please use digits only, with optional spaces, +, ( ) or -.';
  } else if (!isValidPhone(phone)) {
    // 8–15 digits. The usual failure is a local number typed without a country
    // code, which we cannot dial, so the message names that explicitly.
    errors.phone = 'Please enter a complete number, including your country code.';
  }

  if (company.length > LIMITS.company.max) {
    errors.company = `Please keep your company name under ${LIMITS.company.max} characters.`;
  }

  if (message.length < LIMITS.message.min) {
    errors.message = `Please tell us a little more — at least ${LIMITS.message.min} characters.`;
  } else if (message.length > LIMITS.message.max) {
    errors.message = `Please keep your message under ${LIMITS.message.max} characters.`;
  }

  return { valid: Object.keys(errors).length === 0, errors, isBot: false };
}

/** Shape the Web3Forms request body. `accessKey` is the account's public key. */
export function buildSubmissionPayload(
  values: ContactFormValues,
  accessKey: string,
  siteName: string,
): Record<string, string> {
  return {
    access_key: accessKey,
    subject: `New enquiry from ${values.name.trim()} — ${siteName}`,
    from_name: siteName,
    name: values.name.trim(),
    email: values.email.trim(),
    phone: values.phone.trim(),
    company: values.company.trim() || 'Not provided',
    service: values.service || 'Not specified',
    message: values.message.trim(),
    botcheck: '',
  };
}

/**
 * Fallback used when no Web3Forms key is configured: a `mailto:` URL that opens
 * the visitor's mail client with the enquiry pre-composed. Not as good as a
 * real submission, but it never loses an enquiry to a silent failure.
 */
export function buildMailtoFallback(
  values: ContactFormValues,
  toAddress: string,
  siteName: string,
): string {
  const lines = [
    `Name: ${values.name.trim()}`,
    `Email: ${values.email.trim()}`,
    `Phone: ${values.phone.trim()}`,
    `Company: ${values.company.trim() || 'Not provided'}`,
    `Service of interest: ${values.service || 'Not specified'}`,
    '',
    values.message.trim(),
  ];

  const url = new URL(`mailto:${toAddress}`);
  url.searchParams.set('subject', `New enquiry from ${values.name.trim()} — ${siteName}`);
  url.searchParams.set('body', lines.join('\n'));
  // mailto bodies conventionally use %20 rather than '+' for spaces; URLSearchParams
  // emits '+', which several desktop mail clients render literally.
  return url.toString().replace(/\+/g, '%20');
}
