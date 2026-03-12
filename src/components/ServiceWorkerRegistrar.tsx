'use client';

import { useEffect } from 'react';

export default function ServiceWorkerRegistrar() {
    useEffect(() => {
        if (!('serviceWorker' in navigator)) return;

        // When a NEW service worker takes control of this page (after skipWaiting +
        // clients.claim()), reload immediately so the browser fetches fresh JS bundles.
        // This ensures PWA users always run up-to-date code after a deployment without
        // needing to manually reinstall or clear cache.
        const handleControllerChange = () => {
            window.location.reload();
        };
        navigator.serviceWorker.addEventListener('controllerchange', handleControllerChange);

        // Register the SW. After registration, explicitly check for a waiting SW and
        // prompt it to skip waiting so it activates (and fires controllerchange) right away.
        navigator.serviceWorker
            .register('/sw.js')
            .then((registration) => {
                console.log('[PWA] Service Worker registered:', registration.scope);

                // If there's already a waiting SW at registration time, activate it now.
                if (registration.waiting) {
                    registration.waiting.postMessage({ type: 'SKIP_WAITING' });
                }

                // If a new SW installs while this page is open, activate it immediately.
                registration.addEventListener('updatefound', () => {
                    const newWorker = registration.installing;
                    if (!newWorker) return;
                    newWorker.addEventListener('statechange', () => {
                        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                            // New SW is installed and waiting — tell it to take over now.
                            newWorker.postMessage({ type: 'SKIP_WAITING' });
                        }
                    });
                });
            })
            .catch((err) => {
                console.warn('[PWA] Service Worker registration failed:', err);
            });

        return () => {
            navigator.serviceWorker.removeEventListener('controllerchange', handleControllerChange);
        };
    }, []);

    return null;
}
