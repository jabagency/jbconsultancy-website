import { describe, it, expect } from 'vitest';
import { absoluteUrl, href, isActivePath, joinBase, normalisePath, stripBase } from '@lib/url';

describe('joinBase', () => {
  it('is a no-op at the site root', () => {
    expect(joinBase('/', '/about/')).toBe('/about/');
    expect(joinBase('/', '/')).toBe('/');
  });

  it('prefixes a GitHub Pages project sub-path', () => {
    expect(joinBase('/jabagency/', '/about/')).toBe('/jabagency/about/');
    expect(joinBase('/jabagency', '/about/')).toBe('/jabagency/about/');
  });

  it('never emits a double slash at the join', () => {
    // The bug this guards: '/jabagency/' + '/about/' = '/jabagency//about/', which
    // GitHub Pages serves as a 404.
    for (const base of ['/jabagency', '/jabagency/', '/']) {
      expect(joinBase(base, '/about/')).not.toContain('//');
    }
  });

  it('tolerates paths given without a leading slash', () => {
    expect(joinBase('/jabagency/', 'about/')).toBe('/jabagency/about/');
  });

  it('passes external and non-http links through untouched', () => {
    for (const external of [
      'https://wa.me/919876543210',
      'http://example.com',
      '//cdn.example.com/x.js',
      'mailto:hello@jb.com',
      'tel:+919876543210',
      '#main-content',
    ]) {
      expect(joinBase('/jabagency/', external)).toBe(external);
    }
  });
});

describe('href', () => {
  it('resolves against the configured base (BASE_URL is "/" under test)', () => {
    expect(href('/services/')).toBe('/services/');
  });

  it('leaves external links alone', () => {
    expect(href('https://wa.me/919876543210')).toBe('https://wa.me/919876543210');
  });
});

describe('normalisePath', () => {
  it('strips a trailing slash but preserves the root', () => {
    expect(normalisePath('/about/')).toBe('/about');
    expect(normalisePath('/about')).toBe('/about');
    expect(normalisePath('/')).toBe('/');
  });

  it('collapses duplicate slashes and adds a missing leading slash', () => {
    expect(normalisePath('//about//team//')).toBe('/about/team');
    expect(normalisePath('about/')).toBe('/about');
  });
});

describe('isActivePath', () => {
  it('matches regardless of trailing slashes', () => {
    expect(isActivePath('/about/', '/about/')).toBe(true);
    expect(isActivePath('/about', '/about/')).toBe(true);
  });

  it('matches the root only exactly', () => {
    // Without an exact match, '/' would prefix-match everything and light up
    // "Home" on every page of the site.
    expect(isActivePath('/', '/')).toBe(true);
    expect(isActivePath('/about/', '/')).toBe(false);
    expect(isActivePath('/services/', '/')).toBe(false);
  });

  it('stays active on descendant routes', () => {
    expect(isActivePath('/services/e2e-delivery/', '/services/')).toBe(true);
  });

  it('does not match a sibling that merely shares a prefix', () => {
    // '/services-archive' must not activate '/services'.
    expect(isActivePath('/services-archive/', '/services/')).toBe(false);
  });

  it('distinguishes unrelated pages', () => {
    expect(isActivePath('/contact/', '/about/')).toBe(false);
  });
});

describe('stripBase', () => {
  it('removes the base prefix so paths are comparable to nav hrefs', () => {
    expect(stripBase('/jabagency/about/', '/jabagency/')).toBe('/about');
    expect(stripBase('/jabagency', '/jabagency/')).toBe('/');
    expect(stripBase('/jabagency/', '/jabagency/')).toBe('/');
  });

  it('is a no-op when the site is served from the root', () => {
    expect(stripBase('/about/', '/')).toBe('/about/');
  });

  it('leaves paths that merely share a prefix intact', () => {
    expect(stripBase('/jabagency-old/about/', '/jabagency/')).toBe('/jabagency-old/about');
  });
});

describe('absoluteUrl', () => {
  it('produces a fully-qualified URL for canonical and Open Graph tags', () => {
    expect(absoluteUrl('/about/', 'https://jb.example.com')).toBe('https://jb.example.com/about/');
  });

  it('accepts a URL object as the origin, as Astro.site provides', () => {
    expect(absoluteUrl('/contact/', new URL('https://jb.example.com'))).toBe(
      'https://jb.example.com/contact/',
    );
  });
});
