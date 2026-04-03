// src/lib/push-notifications.ts
import { getEnv } from './env';

export type PushSubscribeResult =
  | { success: true; subscription: PushSubscription }
  | { success: false; reason: 'permission_denied' | 'push_service_blocked' | 'not_supported' | 'unknown'; message: string };

export async function requestNotificationPermission(): Promise<boolean> {
  if (!('Notification' in window)) {
    console.warn('This browser does not support desktop notification');
    return false;
  }

  const permission = await Notification.requestPermission();
  return permission === 'granted';
}

export async function subscribeToPushNotifications(): Promise<PushSubscribeResult> {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    return {
      success: false,
      reason: 'not_supported',
      message: 'Push notifications are not supported in this browser.',
    };
  }

  try {
    const registration = await navigator.serviceWorker.ready;
    let subscription = await registration.pushManager.getSubscription();

    // Already subscribed — return the existing subscription
    if (subscription) {
      return { success: true, subscription };
    }

    const publicVapidKey = getEnv('VAPID_PUBLIC_KEY');
    if (!publicVapidKey) {
      console.error('VAPID public key not found in environment');
      return {
        success: false,
        reason: 'unknown',
        message: 'Push configuration is missing. Please contact support.',
      };
    }

    const convertedVapidKey = urlBase64ToUint8Array(publicVapidKey);

    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: convertedVapidKey,
    });

    return { success: true, subscription };
  } catch (err: any) {
    // AbortError / "Registration failed - push service error"
    // Happens in Brave when "Use Google services for push messaging" is OFF,
    // or on Firefox when the push service is unreachable.
    const isAbortOrPushServiceError =
      err?.name === 'AbortError' ||
      (err?.message || '').toLowerCase().includes('push service') ||
      (err?.message || '').toLowerCase().includes('registration failed');

    if (isAbortOrPushServiceError) {
      console.warn('Push service blocked by browser:', err);
      return {
        success: false,
        reason: 'push_service_blocked',
        message:
          'Your browser is blocking the push notification service. ' +
          'In Brave: go to brave://settings/privacy and enable "Use Google services for push messaging". ' +
          'In Firefox: ensure dom.push.enabled is true in about:config.',
      };
    }

    if (err?.name === 'NotAllowedError') {
      return {
        success: false,
        reason: 'permission_denied',
        message: 'Notification permission was denied.',
      };
    }

    console.error('Failed to subscribe to push notifications:', err);
    return {
      success: false,
      reason: 'unknown',
      message: err?.message || 'An unknown error occurred while enabling push notifications.',
    };
  }
}

// Utility function to convert VAPID key
function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}
