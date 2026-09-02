/**
 * Base-path-aware URL helpers.
 *
 * On GitHub Pages a project site is served from a sub-path
 * (`https://user.github.io/jabagency/`), so every internal link must be prefixed
 * with Astro's configured `base`. Hard-coding `/about/` works locally and then
 * 404s in production — the classic GitHub Pages failure. Routing every internal
 * href through `href()` makes the base a single configuration value.
 */

/** Astro/Vite injects the configured `base` here; defaults to '/' outside a build. */
const CONFIGURED_BASE: string = import.meta.env.BASE_URL ?? '/';

/**
 * Join a base path and a root-relative path into exactly one clean path.
 *
 * Pure and base-injectable so the behaviour can be tested across deployment
 * shapes without rebuilding the site.
 */
export function joinBase(base: string, path: string): string {
  // External links, anchors and protocol-relative URLs are passed through untouched.
  if (/^([a-z][a-z0-9+.-]*:|\/\/|#|mailto:|tel:)/i.test(path)) return path;

  const cleanBase = base.replace(/\/+$/, '');
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  const joined = `${cleanBase}${cleanPath}`;

  return joined.startsWith('/') ? joined : `/${joined}`;
}

/** Resolve a root-relative path against the configured base. */
export function href(path: string): string {
  return joinBase(CONFIGURED_BASE, path);
}

/**
 * Normalise a path for comparison: guarantees a leading slash, collapses
 * duplicate slashes and removes the trailing slash (except for the root).
 */
export function normalisePath(path: string): string {
  const withLeading = path.startsWith('/') ? path : `/${path}`;
  const collapsed = withLeading.replace(/\/{2,}/g, '/');
  return collapsed.length > 1 ? collapsed.replace(/\/$/, '') : '/';
}

/**
 * Is `navHref` the current page, for `aria-current` on nav links?
 *
 * The root is matched exactly — without that, '/' would prefix-match every
 * page and light up "Home" everywhere. Other entries also match their
 * descendants, so '/services/' stays current on '/services/e2e-delivery/'.
 */
export function isActivePath(currentPath: string, navHref: string): boolean {
  const current = normalisePath(currentPath);
  const target = normalisePath(stripBase(navHref, CONFIGURED_BASE));

  if (target === '/') return current === '/';
  return current === target || current.startsWith(`${target}/`);
}

/** Remove a leading base path, so hrefs and `Astro.url.pathname` are comparable. */
export function stripBase(path: string, base: string = CONFIGURED_BASE): string {
  const cleanBase = normalisePath(base);
  if (cleanBase === '/') return path;

  const normalised = normalisePath(path);
  if (normalised === cleanBase) return '/';
  return normalised.startsWith(`${cleanBase}/`) ? normalised.slice(cleanBase.length) : normalised;
}

/** Build an absolute URL, for canonical tags, Open Graph and structured data. */
export function absoluteUrl(path: string, origin: string | URL): string {
  return new URL(href(path), origin).toString();
}
