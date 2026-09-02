/**
 * Single source of truth for site-wide identity, contact details and navigation.
 *
 * Nothing here is duplicated in markup: components read from this module so that
 * changing a phone number or a nav label is a one-line edit in one file.
 *
 * ┌──────────────────────────────────────────────────────────────────────────┐
 * │ TODO — one placeholder value is left before going live.                  │
 * │   forms.web3formsKey free access key from https://web3forms.com          │
 * │                                                                          │
 * │ `npm test` reports it as a skipped "go-live readiness" check and warns   │
 * │ with the outstanding list; it does not fail, so the suite stays a useful │
 * │ signal. Fill the value in and its check starts enforcing immediately.    │
 * │ Until then the contact form falls back to a mailto: composer aimed at    │
 * │ contact.email — see tests/unit/site.test.ts.                             │
 * └──────────────────────────────────────────────────────────────────────────┘
 */

export interface NavItem {
  readonly label: string;
  readonly href: string;
}

export interface SocialLink {
  readonly label: string;
  readonly href: string;
}

/**
 * Marker embedded in every value that still needs a real one. Detected by
 * `isPlaceholder()` rather than by eyeballing, so the tests can enforce it.
 */
export const PLACEHOLDER_MARKER = 'REPLACE_ME';

export function isPlaceholder(value: string): boolean {
  return value.includes(PLACEHOLDER_MARKER) || value.trim().length === 0;
}

export const site = {
  name: 'JB Consultancy',
  shortName: 'JB',
  legalName: 'JB Consultancy',
  foundedYear: 2025,

  tagline: 'Empowering growth, technology and talent',
  description:
    'JB Consultancy is an end-to-end consulting partner for fast-scaling platforms, ' +
    'fintech disruptors and technology enterprises — spanning specialised staffing, ' +
    'full-cycle project delivery, and enterprise SAP, Oracle, full-stack and AI engineering.',

  contact: {
    /**
     * Digits only, country code first. Supplied as the 10-digit local number
     * 6238602522, so the Indian country code is prefixed here — wa.me rejects a
     * number without one.
     */
    whatsapp: '916238602522',
    email: 'britto@jbconsultancysolutions.com',
    /** Optional. Leave empty to hide from the UI entirely. */
    phone: '',
    addressLines: [] as readonly string[],
    /** IANA locality used for structured data; safe to leave as-is. */
    country: 'IN',
  },

  forms: {
    /**
     * Web3Forms access key. While empty the contact form degrades to a
     * `mailto:` composer instead of silently failing to deliver.
     */
    web3formsKey: '',
    endpoint: 'https://api.web3forms.com/submit',
  },

  social: [] as readonly SocialLink[],

  /** Primary navigation. Order here is the order rendered in header and footer. */
  nav: [
    { label: 'Home', href: '/' },
    { label: 'About', href: '/about/' },
    { label: 'Services', href: '/services/' },
    { label: 'Capabilities', href: '/capabilities/' },
    { label: 'Contact', href: '/contact/' },
  ] as const satisfies readonly NavItem[],
} as const;

export type Site = typeof site;
