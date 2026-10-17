'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { reportLocation, TransportApiError, type LocationPoint } from '@/lib/transport-api';

/** `app` = the tracking app is sharing for this bus, so the server ignores this screen's fixes. */
export type SharingStatus = 'off' | 'starting' | 'sharing' | 'app' | 'denied' | 'unavailable' | 'unsupported' | 'finished';

const SEND_EVERY_MS = 15_000;
/** Ignore fixes this vague: they would only make the bus jump around. */
const MAX_ACCURACY_M = 300;
const MAX_BUFFER = 60;

/**
 * Shares the crew phone's position for a running trip. Fixes are buffered
 * and sent every 15 s (and right away when the screen is hidden, so the
 * last position before a lock is not lost). A plain PWA cannot report from
 * the background, so the trip screen also keeps the phone awake.
 *
 * Stops for good when the server says the trip is finished. While the
 * tracking app (Traccar Client) is sharing for the bus, the server answers
 * `trackerActive` and drops these fixes; the status becomes `app`.
 */
export function useLocationSharing(tripId: number, active: boolean) {
  const [status, setStatus] = useState<SharingStatus>('off');
  const [lastSentAt, setLastSentAt] = useState<number | null>(null);
  const [accuracy, setAccuracy] = useState<number | null>(null);
  const buffer = useRef<LocationPoint[]>([]);
  const sending = useRef(false);
  const stopped = useRef(false);
  const viaApp = useRef(false);

  const flush = useCallback(async () => {
    if (sending.current || stopped.current || buffer.current.length === 0) return;
    sending.current = true;
    const batch = buffer.current.splice(0, buffer.current.length);
    try {
      const r = await reportLocation(tripId, batch);
      viaApp.current = r.trackerActive;
      setStatus(r.trackerActive ? 'app' : 'sharing');
      setLastSentAt(Date.now());
    } catch (e) {
      if (e instanceof TransportApiError && (e.code === 'TRIP_FINISHED' || e.status === 403)) {
        stopped.current = true;
        setStatus(e.code === 'TRIP_FINISHED' ? 'finished' : 'unavailable');
      } else {
        // Offline or a blip: keep the points for the next try.
        buffer.current = [...batch, ...buffer.current].slice(-MAX_BUFFER);
      }
    } finally {
      sending.current = false;
    }
  }, [tripId]);

  useEffect(() => {
    if (!active) return;
    if (typeof navigator === 'undefined' || !('geolocation' in navigator)) {
      queueMicrotask(() => setStatus('unsupported'));
      return;
    }
    stopped.current = false;
    queueMicrotask(() => setStatus('starting'));
    let first = true;

    const watch = navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude, longitude, accuracy: acc, speed, heading } = pos.coords;
        setAccuracy(Math.round(acc));
        if (stopped.current) return;
        setStatus(viaApp.current ? 'app' : 'sharing');
        if (acc > MAX_ACCURACY_M) return;
        buffer.current.push({
          latitude,
          longitude,
          accuracy: Math.round(acc),
          ...(speed != null && speed >= 0 ? { speed } : {}),
          ...(heading != null && !Number.isNaN(heading) ? { heading } : {}),
          at: new Date(pos.timestamp).toISOString(),
        });
        if (buffer.current.length > MAX_BUFFER) buffer.current.shift();
        if (first) {
          first = false;
          void flush();
        }
      },
      (err) => {
        setStatus(err.code === err.PERMISSION_DENIED ? 'denied' : 'unavailable');
      },
      { enableHighAccuracy: true, maximumAge: 5_000, timeout: 30_000 },
    );
    const timer = window.setInterval(() => void flush(), SEND_EVERY_MS);
    const onHide = () => {
      if (document.visibilityState === 'hidden') void flush();
    };
    document.addEventListener('visibilitychange', onHide);

    return () => {
      navigator.geolocation.clearWatch(watch);
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onHide);
      void flush();
    };
  }, [active, flush]);

  return { status, lastSentAt, accuracy };
}
