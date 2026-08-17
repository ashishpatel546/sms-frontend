import { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Colegios',
    short_name: 'Colegios',
    description:
      'A comprehensive school management system powered by Colegios.',
    start_url: '/',
    display: 'standalone',
    // The walnut rail and the paper canvas behind it. These were a navy that
    // matched no token in the app — a leftover from an earlier palette.
    //
    // A manifest is baked at install time and cannot follow the palette the way
    // <meta name="theme-color"> does (PaletteProvider rewrites that on every
    // switch). So these state the DEFAULT palette: what the splash screen shows
    // for the second before the app itself paints.
    background_color: '#f2efe9',
    theme_color: '#362b1f',
    orientation: 'portrait-primary',
    scope: '/',
    lang: 'en',
    categories: ['education', 'productivity'],
    // Prevents browsers from deferring to a native app store listing instead of the PWA.
    // This is required for Edge on Android to reliably fire beforeinstallprompt.
    prefer_related_applications: false,
    // Hint so in-scope links (e.g. the visitor-form QR pointing at /visit)
    // open in the already-installed PWA where the OS supports link capturing.
    ...({ launch_handler: { client_mode: 'navigate-existing' } } as object),
    // Use properly-sized icon files so browsers can validate installability
    icons: [
      { src: '/icons/icon-192x192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icons/icon-512x512.png', sizes: '512x512', type: 'image/png' },
      {
        src: '/icons/icon-maskable-512x512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
    shortcuts: [
      {
        name: 'Dashboard',
        url: '/dashboard',
        description: 'Go to the admin dashboard',
        icons: [{ src: '/colegios/pwa-logo.png', sizes: '192x192' }],
      },
      {
        name: 'Parent Portal',
        url: '/parent-dashboard',
        description: 'Go to the parent portal',
        icons: [{ src: '/colegios/pwa-logo.png', sizes: '192x192' }],
      },
    ],
  };
}
