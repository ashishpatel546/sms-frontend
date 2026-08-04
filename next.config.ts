import type { NextConfig } from 'next';

const isDev = process.env.NODE_ENV !== 'production';

const nextConfig: NextConfig = {
  /* config options here */
  allowedDevOrigins: [
    'myrealapp.appme.in',
    'https://myrealapp.appme.in',
    '*.appme.in',
  ],
  reactCompiler: false,

  /**
   * Cache headers, written for the Cloudflare tunnel that sits in front of this
   * app (see the ingress map in CLAUDE.md).
   *
   * The zone applies a 4-hour Browser Cache TTL to static extensions, which
   * OVERRIDES the `max-age=0` the origin sends. Two consequences, both of which
   * present to a user as "the PWA won't update; only clearing site data helps":
   *
   *   sw.js            cached for 4h, so the browser never fetches a new
   *                    service worker and the app keeps running old code.
   *   /_next/static/*  fine in PRODUCTION, where filenames are content-hashed —
   *                    a new build means new URLs, and long caching is exactly
   *                    what you want. But in DEVELOPMENT Turbopack keeps
   *                    filenames stable while their contents change on every
   *                    edit, so a freshly-served HTML document points at the
   *                    same chunk URL and the browser replays a stale bundle.
   *
   * `no-store` is the one directive Cloudflare will not serve past, so it is
   * what actually reaches the device. Production keeps its long-lived caching
   * of hashed assets.
   */
  async headers() {
    return [
      {
        // The worker script must always be revalidated — everything else about
        // updating an installed PWA depends on the browser noticing a new one.
        source: '/sw.js',
        headers: [
          { key: 'Cache-Control', value: 'no-store, must-revalidate' },
          { key: 'Service-Worker-Allowed', value: '/' },
        ],
      },
      ...(isDev
        ? [
            {
              source: '/_next/static/:path*',
              headers: [
                { key: 'Cache-Control', value: 'no-store, must-revalidate' },
              ],
            },
          ]
        : []),
    ];
  },
};

export default nextConfig;
