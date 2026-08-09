'use client';
// React Compiler opt-out: this component uses imperative browser APIs
// (ServiceWorker, EventTarget) that the compiler cannot safely analyse.
'use no memo';

import { useEffect } from 'react';
import { captureRunningBuild } from '@/lib/app-version';

/**
 * Registers the service worker and — the harder half — makes sure an installed
 * PWA actually PICKS UP new deployments.
 *
 * Three things must be true for that, and missing any one produces the same
 * symptom: the app keeps showing old code, a refresh doesn't help, and only
 * clearing site data fixes it.
 *
 *   1. The browser must re-fetch sw.js rather than serve it from its own HTTP
 *      cache, which it will do for up to 24h. `updateViaCache: 'none'` forces a
 *      network check for the worker script itself. Without this the new worker
 *      is never even discovered.
 *   2. Something must ASK for an update. Registration happens once; an
 *      installed PWA can then run for weeks without looking again, so we check
 *      whenever the app returns to the foreground.
 *   3. A new worker must take over without waiting for every tab to close —
 *      that is what SKIP_WAITING and the reload below are for.
 */
export default function ServiceWorkerRegistrar() {
    /* Pin which build this page is running, as early as anything mounts.
       Pull-to-refresh compares against it to decide whether the app itself is
       stale — see lib/app-version.ts for why the baseline has to be taken at
       startup rather than at the moment of the check. Runs outside the service
       worker branch on purpose: a browser with no worker support goes stale in
       exactly the same way. */
    useEffect(() => {
        void captureRunningBuild();
    }, []);

    useEffect(() => {
        if (!('serviceWorker' in navigator)) return;

        // Guard against a reload loop: controllerchange can fire more than once,
        // notably on the very first registration right after clients.claim().
        let reloading = false;
        const handleControllerChange = () => {
            if (reloading) return;
            reloading = true;
            window.location.reload();
        };
        navigator.serviceWorker.addEventListener('controllerchange', handleControllerChange);

        let registration: ServiceWorkerRegistration | undefined;

        const promoteWaiting = (reg: ServiceWorkerRegistration) => {
            if (reg.waiting) reg.waiting.postMessage({ type: 'SKIP_WAITING' });
        };

        navigator.serviceWorker
            // updateViaCache: 'none' — see (1) above.
            .register('/sw.js', { updateViaCache: 'none' })
            .then((reg) => {
                registration = reg;

                // A worker already waiting at startup: let it take over now.
                promoteWaiting(reg);

                // One that installs while this page is open: same.
                reg.addEventListener('updatefound', () => {
                    const newWorker = reg.installing;
                    if (!newWorker) return;
                    newWorker.addEventListener('statechange', () => {
                        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                            newWorker.postMessage({ type: 'SKIP_WAITING' });
                        }
                    });
                });

                // Check once now too, in case this tab was restored from the
                // back/forward cache with a stale worker attached.
                reg.update().catch(() => { /* offline — we retry on focus */ });
            })
            .catch((err) => {
                console.warn('[PWA] Service Worker registration failed:', err);
            });

        // (2) Check whenever the app comes back to the foreground. That is the
        // moment a user expects an update to land, and for an installed PWA it
        // may be the only moment we ever get.
        const checkForUpdate = () => {
            if (document.visibilityState !== 'visible' || !registration) return;
            registration.update().catch(() => { /* offline — nothing to do */ });
            promoteWaiting(registration);
        };
        document.addEventListener('visibilitychange', checkForUpdate);
        window.addEventListener('focus', checkForUpdate);

        return () => {
            navigator.serviceWorker.removeEventListener('controllerchange', handleControllerChange);
            document.removeEventListener('visibilitychange', checkForUpdate);
            window.removeEventListener('focus', checkForUpdate);
        };
    }, []);

    return null;
}
