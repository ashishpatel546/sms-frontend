"use client";

import { useState, useEffect } from "react";
import { authFetch } from "@/lib/auth";
import { API_BASE_URL } from "@/lib/api";

type BannerState = 'hidden' | 'prompt' | 'denied' | 'push_blocked';

export default function NotificationPermissionBanner() {
  const [state, setState] = useState<BannerState>('hidden');
  const [isSubscribing, setIsSubscribing] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || !("Notification" in window)) return;

    const permission = Notification.permission;

    if (permission === "granted") {
      // Already granted — silently try to ensure push subscription is registered
      import("@/lib/push-notifications").then(({ subscribeToPushNotifications }) => {
        subscribeToPushNotifications().then((result) => {
          if (result.success) {
            authFetch(`${API_BASE_URL}/api/app-notifications/subscriptions`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(result.subscription),
            }).catch(() => {});
          } else if (result.reason === 'push_service_blocked') {
            // Push is blocked even though permission is granted — show helpful banner
            setState('push_blocked');
          }
        });
      });
      return;
    }

    if (permission === "denied") {
      setState('denied');
      return;
    }

    // permission === "default" — ask user to enable
    setState('prompt');
  }, []);

  const handleEnable = async () => {
    setIsSubscribing(true);
    try {
      const { requestNotificationPermission, subscribeToPushNotifications } =
        await import("@/lib/push-notifications");

      const granted = await requestNotificationPermission();
      if (!granted) {
        setState('denied');
        return;
      }

      // Permission granted — now try to get a push subscription
      const result = await subscribeToPushNotifications();
      if (result.success) {
        await authFetch(`${API_BASE_URL}/api/app-notifications/subscriptions`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(result.subscription),
        });
        setState('hidden');
      } else if (result.reason === 'push_service_blocked') {
        // Permission was granted but push service is unavailable (Brave/Firefox)
        setState('push_blocked');
      } else {
        setState('denied');
      }
    } catch (err) {
      console.error("Failed to enable notifications:", err);
    } finally {
      setIsSubscribing(false);
    }
  };

  if (state === 'hidden') return null;

  // Push service blocked (Brave FCM, Firefox, etc.)
  if (state === 'push_blocked') {
    return (
      <div className="bg-amber-50 border-b border-amber-200 text-amber-900 px-4 py-3 sm:px-6 animate-in slide-in-from-top duration-500">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-sm font-medium">
          <div className="flex items-start gap-2">
            <svg className="w-5 h-5 shrink-0 mt-0.5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>
              <strong>Push notifications blocked by your browser.</strong>
              {" "}If using <strong>Brave</strong>: go to{" "}
              <code className="bg-amber-100 border border-amber-300 px-1 rounded text-xs">brave://settings/privacy</code>
              {" "}and enable <em>"Use Google services for push messaging"</em>.
              You will still see notifications in the bell icon when using the app.
            </span>
          </div>
          <button
            onClick={() => setState('hidden')}
            aria-label="Dismiss notification"
            className="text-xs text-amber-700 underline whitespace-nowrap hover:no-underline shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 rounded"
          >
            Dismiss
          </button>
        </div>
      </div>
    );
  }

  // Permission denied in browser settings
  if (state === 'denied') {
    return (
      <div className="bg-red-50 border-b border-red-200 text-red-900 px-4 py-2.5 sm:px-6 animate-in slide-in-from-top duration-500">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2 text-sm font-medium">
          <div className="flex items-center gap-2 text-center sm:text-left">
            <svg className="w-4 h-4 shrink-0 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Notifications are blocked. To receive alerts, click the lock icon in your browser address bar and allow notifications for this site.
          </div>
          <button
            onClick={() => setState('hidden')}
            aria-label="Dismiss notification"
            className="text-xs text-red-700 underline whitespace-nowrap hover:no-underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 rounded"
          >
            Dismiss
          </button>
        </div>
      </div>
    );
  }

  // Default: prompt user to enable
  return (
    <div className="bg-brand/5 border-b border-brand/15 px-4 py-3 sm:px-6 lg:px-8 relative animate-in slide-in-from-top duration-500">
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 font-medium">
        <div className="flex items-center gap-2 text-sm sm:text-base text-center sm:text-left text-ink">
          <svg className="w-5 h-5 shrink-0 animate-pulse text-brand" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
          </svg>
          <span>
            Enable push notifications to get <strong>instant alerts</strong> for fees, attendance &amp; school announcements — even when the app is closed.
          </span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={handleEnable}
            disabled={isSubscribing}
            aria-label={isSubscribing ? "Enabling notifications…" : "Enable push notifications"}
            className="bg-brand text-white px-5 py-1.5 rounded-lg text-sm font-bold shadow hover:bg-brand-light transition-colors disabled:opacity-50 whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
          >
            {isSubscribing ? "Enabling…" : "Enable Alerts"}
          </button>
          <button
            onClick={() => setState('hidden')}
            aria-label="Dismiss notification banner"
            title="Dismiss (you can enable later from the bell icon)"
            className="p-1 text-ink-muted hover:text-ink hover:bg-surface-secondary rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
