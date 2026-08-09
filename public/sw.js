// Service Worker for School Management System PWA
//
// UPDATING THIS FILE: bump CACHE_NAME. The browser reinstalls the worker when
// the bytes of this file change, and the activate handler deletes every cache
// whose name doesn't match, so a bump is what actually evicts stale entries.
//
// v8 — THE BOOTSTRAP BUMP, and the last one that should ever be needed.
//
// Relying on a human to bump this line was the bug. Between v7 (31 Jul 2026)
// and now, eighteen deployments shipped byte-identical sw.js, so no installed
// PWA was ever told a new worker existed — and an installed PWA is one
// long-lived page that never re-fetches a document on its own. Phones sat on
// the 31 Jul bundle for over a week while laptops updated within minutes.
//
// Detection has moved to `/version` + `lib/app-version.ts`, which changes on
// every deployment with nobody remembering anything. This bump exists solely
// to reach the devices that are stale RIGHT NOW: changing these bytes is the
// only signal their already-installed worker still listens to, and it is what
// carries the new detection code onto them.
const CACHE_NAME = 'school-ms-v8';

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
      .then(() => self.skipWaiting()),
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
            .map((name) => caches.delete(name)),
        );
      })
      .then(() => self.clients.claim()),
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
  // Use plain `return` (no respondWith) so the browser handles the request
  // natively without SW thread overhead.
  if (url.pathname.startsWith('/api/') || url.origin !== self.location.origin) {
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
      }),
    );
    return;
  }

  // Everything from here down is the PAGE strategy, and it must apply ONLY to
  // real navigations.
  //
  // It previously applied to every remaining GET, which swept up Next's RSC
  // payload requests (`?_rsc=…`) and any other same-origin fetch and wrote them
  // into the page cache. Those then came back stale, and because a stale
  // document references chunk URLs that no longer exist, the app looked broken
  // until the user cleared site data by hand.
  if (event.request.mode !== 'navigate') return;

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Only store a response that is genuinely a page we could replay
        // offline. Caching redirects or error pages means serving them back
        // later as if they were the real thing.
        if (response.ok && response.type === 'basic' && !response.redirected) {
          const cloned = response.clone();
          caches
            .open(CACHE_NAME)
            .then((cache) => cache.put(event.request, cloned))
            .catch(() => {
              /* quota or private mode — caching is best-effort */
            });
        }
        return response;
      })
      .catch(() =>
        // Reached only when the network genuinely failed, which is the one case
        // where showing a stale page beats showing nothing.
        caches.match(event.request).then((cached) => cached || caches.match('/')),
      ),
  );
});

// Setup IndexedDB for offline notifications history
const dbPromise = new Promise((resolve) => {
  const request = indexedDB.open('SchoolMS-Notifications', 1);
  request.onupgradeneeded = (e) => {
    const db = e.target.result;
    if (!db.objectStoreNames.contains('notifications')) {
      // Create object store with timestamp as key path for easy sorting/deletion
      db.createObjectStore('notifications', { keyPath: 'timestamp' });
    }
  };
  request.onsuccess = (e) => resolve(e.target.result);
});

// Handle incoming Web Push
self.addEventListener('push', (event) => {
  if (event.data) {
    const payload = event.data.json();
    const notificationTitle = payload.title || 'New Notification';
    const notificationOptions = {
      body: payload.message,
      icon: '/icons/icon-192x192.png',
      badge: '/icons/icon-192x192.png',
      data: payload,
    };

    // Show native push popup
    event.waitUntil(
      self.registration
        .showNotification(notificationTitle, notificationOptions)
        .then(() => dbPromise)
        .then(async (db) => {
          // Save to IndexedDB
          const tx = db.transaction('notifications', 'readwrite');
          const store = tx.objectStore('notifications');
          const item = {
            title: notificationTitle,
            message: payload.message,
            timestamp: payload.timestamp || new Date().toISOString(),
          };
          store.add(item);

          // Return a promise to clean up oldest if > 10
          return new Promise((resolve, reject) => {
            const getReq = store.getAll();
            getReq.onsuccess = () => {
              const all = getReq.result;
              if (all.length > 10) {
                // Sort by timestamp asc (oldest first)
                all.sort(
                  (a, b) => new Date(a.timestamp) - new Date(b.timestamp),
                );
                // Delete oldest elements until length is 10
                let deleteTx = db.transaction('notifications', 'readwrite');
                let deleteStore = deleteTx.objectStore('notifications');
                let deletePromises = [];
                for (let i = 0; i < all.length - 10; i++) {
                  deletePromises.push(
                    new Promise((res) => {
                      const req = deleteStore.delete(all[i].timestamp);
                      req.onsuccess = res;
                    }),
                  );
                }
                Promise.all(deletePromises).then(resolve);
              } else {
                resolve();
              }
            };
            getReq.onerror = reject;
          });
        })
        .then(() => {
          const bc = new BroadcastChannel('push-notifications');
          bc.postMessage({ type: 'NEW_PUSH_NOTIFICATION' });
          bc.close();
        }),
    );
  }
});

// Handle push notification click
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  // The URL to open when the notification is clicked.
  // We open the parent-dashboard since push notifications currently target parents.
  // If there's already a window open for this origin, focus it; otherwise open a new one.
  const targetUrl = '/parent-dashboard';
  event.waitUntil(
    clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((windowClients) => {
        // Check if there's already a window open with this app
        for (let i = 0; i < windowClients.length; i++) {
          const client = windowClients[i];
          if ('focus' in client) {
            client.focus();
            // Navigate the existing window to the parent dashboard
            if (client.navigate) {
              return client.navigate(targetUrl);
            }
            return;
          }
        }
        // No window open — open a new one
        if (clients.openWindow) {
          return clients.openWindow(targetUrl);
        }
      }),
  );
});
