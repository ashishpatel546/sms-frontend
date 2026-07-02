import { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Colegios',
    short_name: 'Colegios',
    description:
      'A comprehensive school management system powered by Colegios.',
    start_url: '/',
    display: 'standalone',
    background_color: '#1e3a5f',
    theme_color: '#1e3a5f',
    orientation: 'portrait-primary',
    scope: '/',
    lang: 'en',
    categories: ['education', 'productivity'],
    // Prevents browsers from deferring to a native app store listing instead of the PWA.
    // This is required for Edge on Android to reliably fire beforeinstallprompt.
    prefer_related_applications: false,
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
