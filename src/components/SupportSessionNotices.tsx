'use client';

import { useEffect, useRef, useState } from 'react';
import { useReadOnlySession } from '@/lib/support-session';

/**
 * The two notices a platform support session needs, mounted once in the root
 * layout (same pattern as `ServiceUnavailableBanner`):
 *
 * 1. A persistent strip while a READ_ONLY support session is active, so the
 *    operator knows the ground rules before touching anything.
 * 2. A transient message whenever ANY request comes back 403 — `authFetch`
 *    dispatches `access-denied` with the server's own message, which is far
 *    more specific than the per-page "Failed to X, please try again" text
 *    (e.g. "This support session is read-only. Ask for a READ_WRITE ticket
 *    to make changes.").
 *
 * Deliberately not react-hot-toast: `<Toaster />` is mounted per-page in this
 * app, and a second mounted Toaster renders every toast twice. This stays
 * self-contained like the service-unavailable overlay.
 */
export default function SupportSessionNotices() {
  const readOnly = useReadOnlySession();
  const [denied, setDenied] = useState<string | null>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const handler = (event: Event) => {
      const message = (event as CustomEvent<{ message?: string }>).detail
        ?.message;
      if (!message) return;
      setDenied(message);
      if (hideTimer.current) clearTimeout(hideTimer.current);
      hideTimer.current = setTimeout(() => setDenied(null), 7000);
    };
    window.addEventListener('access-denied', handler);
    return () => {
      window.removeEventListener('access-denied', handler);
      if (hideTimer.current) clearTimeout(hideTimer.current);
    };
  }, []);

  return (
    <>
      {readOnly && (
        <div
          role="status"
          className="fixed inset-x-0 top-0 z-70 flex items-center justify-center gap-2 bg-amber-500 px-3 py-1.5 text-center text-[12px] font-medium text-amber-950 shadow-sm"
        >
          <span aria-hidden>👁️</span>
          <span>
            Read-only support session — you can view everything, but changes
            are disabled.
          </span>
        </div>
      )}

      {denied && (
        <div
          role="alert"
          // Below the strip when both show; centred so it works on phones.
          className={`fixed inset-x-0 z-70 flex justify-center px-4 ${
            readOnly ? 'top-10' : 'top-3'
          }`}
        >
          <button
            type="button"
            onClick={() => setDenied(null)}
            className="max-w-md rounded-xl bg-red-600 px-4 py-2.5 text-left text-[13px] leading-snug text-white shadow-lg"
          >
            <span className="font-semibold">Not allowed: </span>
            {denied}
          </button>
        </div>
      )}
    </>
  );
}
