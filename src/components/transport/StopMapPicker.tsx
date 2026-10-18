'use client';

/**
 * Drop a pin on a stop. Tap anywhere to place it; tap again to move it.
 *
 * OpenStreetMap street tiles — free and keyless, and fine for the handful of
 * tiles an admin loads while setting up stops. (Parent-facing live maps will
 * use a self-hosted or free vector source instead; OSM's public servers are
 * not for app-scale traffic.)
 *
 * Loaded with `next/dynamic({ ssr: false })` by its parent: Leaflet touches
 * `window` at import time.
 */

import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

export interface LatLng {
  lat: number;
  lng: number;
}

const INDIA: L.LatLngExpression = [22.5, 79];

export default function StopMapPicker({
  value,
  onChange,
  others = [],
}: {
  value: LatLng | null;
  onChange: (v: LatLng) => void;
  /** The route's other stops, shown faintly so the new pin lands in context. */
  others?: (LatLng & { name: string })[];
}) {
  const el = useRef<HTMLDivElement | null>(null);
  const map = useRef<L.Map | null>(null);
  const pin = useRef<L.CircleMarker | null>(null);
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    if (!el.current || map.current) return;
    const m = L.map(el.current, { zoomControl: true, attributionControl: true });
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 19,
    }).addTo(m);

    const points: L.LatLngExpression[] = [];
    for (const o of others) {
      L.circleMarker([o.lat, o.lng], {
        radius: 6,
        color: '#5b6b86',
        weight: 2,
        fillOpacity: 0.35,
      })
        .bindTooltip(o.name)
        .addTo(m);
      points.push([o.lat, o.lng]);
    }
    if (value) points.push([value.lat, value.lng]);

    if (value) m.setView([value.lat, value.lng], 16);
    else if (points.length > 1) m.fitBounds(L.latLngBounds(points), { padding: [24, 24], maxZoom: 16 });
    else if (points.length === 1) m.setView(points[0], 15);
    else m.setView(INDIA, 5);

    m.on('click', (e: L.LeafletMouseEvent) => {
      onChangeRef.current({
        lat: Number(e.latlng.lat.toFixed(6)),
        lng: Number(e.latlng.lng.toFixed(6)),
      });
    });
    map.current = m;
    // Dialogs animate in; measure again once they have settled.
    const id = window.setTimeout(() => m.invalidateSize(), 250);
    return () => {
      window.clearTimeout(id);
      m.remove();
      map.current = null;
      pin.current = null;
    };
    // The map is built once; `value` updates are handled below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const m = map.current;
    if (!m) return;
    if (!value) {
      pin.current?.remove();
      pin.current = null;
      return;
    }
    if (!pin.current) {
      pin.current = L.circleMarker([value.lat, value.lng], {
        radius: 9,
        color: '#b26a02',
        weight: 3,
        fillColor: '#f2b33d',
        fillOpacity: 0.9,
      }).addTo(m);
    } else {
      pin.current.setLatLng([value.lat, value.lng]);
    }
  }, [value]);

  return <div ref={el} className="h-64 w-full overflow-hidden rounded-lg border border-line sm:h-72" />;
}
