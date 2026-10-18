/**
 * Traccar Client: the free, open-source tracking app the crew phone can use
 * to share the bus location in the background (a PWA cannot). The portal
 * never talks to the app directly; it only opens these links:
 *
 * - setup: `org.traccar.client://setup?url=…&id=…` fills the app's server
 *   address and device identifier (the vehicle's tracker key) after the
 *   crew taps OK. The same link as a QR code works from the app's own
 *   scanner (Settings → scan).
 * - start / stop: `org.traccar.client://action/start` and `…/stop`.
 *
 * Settings chosen for a school bus: a fix every 10 s with the best accuracy,
 * offline buffering, and no stop detection (it would pause at every stop).
 */

import { getEnv } from '@/lib/env';

export const TRACCAR_PLAY_URL = 'https://play.google.com/store/apps/details?id=org.traccar.client';
export const TRACCAR_APP_STORE_URL = 'https://apps.apple.com/app/traccar-client/id843156974';

const SCHEME = 'org.traccar.client://';

/** Where the app posts positions: sms-backend's public /transport/tracker. */
export function trackerServerUrl(): string {
  const api = (getEnv('API_URL') || '').replace(/\/+$/, '');
  return `${api}/transport/tracker`;
}

export function trackerSetupLink(key: string): string {
  const q = new URLSearchParams({
    url: trackerServerUrl(),
    id: key,
    accuracy: 'highest',
    interval: '10',
    distance: '0',
    angle: '0',
    heartbeat: '60',
    buffer: 'true',
    wakelock: 'true',
    stop_detection: 'false',
  });
  return `${SCHEME}setup?${q.toString()}`;
}

export const TRACKER_START_LINK = `${SCHEME}action/start`;
export const TRACKER_STOP_LINK = `${SCHEME}action/stop`;

export type Platform = 'android' | 'ios' | 'other';

export function detectPlatform(): Platform {
  if (typeof navigator === 'undefined') return 'other';
  const ua = navigator.userAgent;
  if (/android/i.test(ua)) return 'android';
  // iPadOS reports itself as a Mac with touch.
  if (/iphone|ipad|ipod/i.test(ua) || (/macintosh/i.test(ua) && navigator.maxTouchPoints > 1)) return 'ios';
  return 'other';
}
