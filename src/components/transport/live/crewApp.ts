'use client';

import { useEffect, useState } from 'react';
import useSWR from 'swr';

/**
 * Our Android crew app (sms-crew-app) shows the portal in a WebView and
 * exposes `window.ColegiosCrew`, so the trip screen can share the bus
 * location in the background with the screen locked. Every call answers
 * with a `colegios-crew` event on window carrying the app's status. The
 * app posts positions to /transport/tracker with the vehicle's tracker
 * key, the same way Traccar Client does.
 */
export interface CrewAppStatus {
  app: string;
  /** Sharing right now, for the bus with `key`. */
  tracking: boolean;
  key: string | null;
  /** Location allowed "All the time" (needed with the screen locked). */
  backgroundLocation: boolean;
  /** Exempt from battery optimisation, so the phone does not stop it. */
  batteryUnrestricted: boolean;
  /** This install's Firebase token (crew push), null when unavailable. */
  pushToken: string | null;
  /** The phone lets the app show notifications. */
  notifications: boolean;
  error: 'PERMISSION_DENIED' | null;
}

interface CrewBridge {
  version(): string;
  status(): void;
  start(key: string, label: string): void;
  stop(key: string): void;
  enablePush(): void;
  /** Last token from the status, or '' (synchronous, for logout). */
  pushToken(): string;
  fixBattery(): void;
  openAppSettings(): void;
  changeSchool(): void;
}

const EVENT = 'colegios-crew';

export function crewApp(): CrewBridge | null {
  if (typeof window === 'undefined') return null;
  return (window as unknown as { ColegiosCrew?: CrewBridge }).ColegiosCrew ?? null;
}

/** True inside the crew app. Client-only (false during server render). */
export function useInCrewApp(): boolean {
  const [inApp, setInApp] = useState(false);
  useEffect(() => {
    queueMicrotask(() => setInApp(crewApp() !== null));
  }, []);
  return inApp;
}

/** The app's latest status; asks for it on mount. Null until it answers. */
export function useCrewAppStatus(): CrewAppStatus | null {
  const [status, setStatus] = useState<CrewAppStatus | null>(null);
  useEffect(() => {
    const app = crewApp();
    if (!app) return;
    const on = (e: Event) => setStatus((e as CustomEvent<CrewAppStatus>).detail);
    window.addEventListener(EVENT, on);
    app.status();
    return () => window.removeEventListener(EVENT, on);
  }, []);
  return status;
}

/**
 * The app is not in a store: each portal serves its build from
 * public/downloads/ (written by sms-crew-app `scripts/release.sh`). The
 * stage portal offers the test build, production the real one; the app
 * reads the same file to offer updates.
 */
export interface CrewAppRelease {
  versionCode: number;
  versionName: string;
  /** Path of the APK on this portal. */
  apk: string;
  /** Bytes. */
  size: number;
}

export function crewAppChannel(): 'crew' | 'crew-test' | 'crew-dev' {
  const host = typeof window === 'undefined' ? '' : window.location.hostname;
  if (host.endsWith('.test.colegios.in')) return 'crew-test';
  if (host.endsWith('.colegios.in')) return 'crew';
  return 'crew-dev';
}

async function fetchCrewAppRelease(): Promise<CrewAppRelease | null> {
  const r = await fetch(`/downloads/${crewAppChannel()}.json`, { cache: 'no-store' });
  return r.ok ? r.json() : null;
}

/** The build on offer here: undefined while loading, null when there is none. */
export function useCrewAppRelease(): CrewAppRelease | null | undefined {
  const { data, error } = useSWR('crew-app-release', fetchCrewAppRelease, { revalidateOnFocus: false });
  return error ? null : data;
}
