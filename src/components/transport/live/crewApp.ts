'use client';

import { useEffect, useState } from 'react';

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
  error: 'PERMISSION_DENIED' | null;
}

interface CrewBridge {
  version(): string;
  status(): void;
  start(key: string, label: string): void;
  stop(key: string): void;
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
