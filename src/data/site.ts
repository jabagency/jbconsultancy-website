/**
 * Single source of truth for site-wide identity, contact details and navigation.
 *
 * Nothing here is duplicated in markup: components read from this module so that
 * changing a phone number or a nav label is a one-line edit in one file.
 *
 * Every value here is real — no placeholders left. The "go-live readiness"
 * block in tests/unit/site.test.ts now enforces all three of them (WhatsApp
 * number, contact email, Web3Forms key) rather than skipping, so removing or
 * emptying one fails the suite instead of silently degrading the site.
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
    /**
     * Text prefilled in the visitor's WhatsApp composer. Deliberately just a
     * greeting: a long scripted opener arrives as a template the visitor has to
     * edit or delete before they can say anything of their own, and it is also
     * the first message that lands in our inbox. One word opens the chat and
     * leaves the conversation to them.
     */
    whatsappMessage: 'Hi',
    email: 'brito@jbconsultancies.net',
    /** Optional. Leave empty to hide from the UI entirely. */
    phone: '',
    addressLines: [] as readonly string[],
    /** IANA locality used for structured data; safe to leave as-is. */
    country: 'IN',
  },

  forms: {
    /**
     * Web3Forms access key. Public by design — it ships in the client bundle and
     * can only ever deliver to the address it was verified for, so exposure lets
     * someone email us, not redirect our mail. While empty the contact form
     * degrades to a `mailto:` composer instead of silently failing to deliver.
     *
     * That binding is also the catch: the key is tied to the address it was
     * issued against, NOT to contact.email above and not to a domain. Changing
     * contact.email changes where `mailto:` links and the footer point, but form
     * submissions keep arriving at the original inbox until a key verified
     * against the new address replaces this one.
     */
    web3formsKey: '5e0c0e3f-49d8-4fac-8bc2-401c9e5054f8',
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
