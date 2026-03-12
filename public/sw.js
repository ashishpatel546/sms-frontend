// Service Worker for School Management System PWA
const CACHE_NAME = 'school-ms-v3';

// App shell files to cache immediately
const APP_SHELL = [
  '/',
  '/manifest.webmanifest',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
  '/apple-touch-icon.png',
];

// Install event - cache the app shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => {
        return cache.addAll(APP_SHELL);
      })
      .then(() => self.skipWaiting())
  );
});

// Allow the page to trigger immediate activation via postMessage
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter((name) => name !== CACHE_NAME)
            .map((name) => caches.delete(name))
        );
      })
      .then(() => self.clients.claim())
  );
});

// Fetch event - network-first strategy for API calls, cache-first for assets
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Skip non-GET requests
  if (event.request.method !== 'GET') return;

  // Skip API calls — always use network for fresh data.
  // Compare by origin (scheme + hostname + port) so requests to a different
  // backend port or subdomain are never served from cache.
  if (url.pathname.startsWith('/api/') || url.origin !== self.location.origin) {
    event.respondWith(
      fetch(event.request).catch(() => {
        // If offline and it's a navigation request, show the cached home page
        if (event.request.mode === 'navigate') {
          return caches.match('/');
        }
        return new Response('Offline', { status: 503 });
      })
    );
    return;
  }

  // Never intercept Next.js JS/CSS bundles — let the browser's HTTP cache handle them.
  // In production their filenames contain content hashes (immutable), so the browser
  // cache is correct and efficient. In dev the filenames are stable but content changes
  // on every rebuild, so SW caching would serve stale code after deployments.
  if (url.pathname.startsWith('/_next/')) {
    return; // no respondWith → browser handles the request natively
  }

  // Cache-first for app icons and static images (rarely change)
  if (
    url.pathname.startsWith('/icons/') ||
    url.pathname.endsWith('.png') ||
    url.pathname.endsWith('.jpg') ||
    url.pathname.endsWith('.svg') ||
    url.pathname.endsWith('.ico')
  ) {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        if (cached) return cached;
        return fetch(event.request).then((response) => {
          const cloned = response.clone();
          caches
            .open(CACHE_NAME)
            .then((cache) => cache.put(event.request, cloned));
          return response;
        });
      })
    );
    return;
  }

  // Network-first for HTML pages (so content stays fresh)
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        const cloned = response.clone();
        caches
          .open(CACHE_NAME)
          .then((cache) => cache.put(event.request, cloned));
        return response;
      })
      .catch(() =>
        caches.match(event.request).then((cached) => {
          if (cached) return cached;
          // Serve offline page fallback
          return caches.match('/');
        })
      )
  );
});
