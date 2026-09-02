/**
 * robots.txt as an endpoint rather than a file in public/.
 *
 * The `Sitemap:` directive has to be an absolute URL, and the origin is only
 * known at build time from `site` in astro.config.mjs (which GitHub Pages sets
 * via SITE_URL). Generating it here means the two can never disagree.
 */
import type { APIRoute } from 'astro';

export const GET: APIRoute = ({ site }) => {
  const sitemap = site ? new URL('sitemap-index.xml', site).href : undefined;

  const body = [
    '# JB Consultancy — all content is public marketing material.',
    'User-agent: *',
    'Allow: /',
    '',
    ...(sitemap ? [`Sitemap: ${sitemap}`, ''] : []),
  ].join('\n');

  return new Response(body, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
};
