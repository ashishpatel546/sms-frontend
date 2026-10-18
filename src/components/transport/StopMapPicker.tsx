'use client';

/**
 * Set a stop's location: search for the area or address, use this device's
 * location, or tap the map to drop the pin (tap again to move it).
 *
 * OpenStreetMap street tiles and Nominatim search — free and keyless, and
 * fine for the handful of tiles and searches an admin makes while setting up
 * stops. Nominatim allows about one search a second, so it runs on Enter or
 * the Search button, never on every keystroke. (Parent-facing live maps will
 * use a self-hosted or free vector source instead; OSM's public servers are
 * not for app-scale traffic.)
 *
 * Loaded with `next/dynamic({ ssr: false })` by its parent: Leaflet touches
 * `window` at import time.
 */

import { useEffect, useRef, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { LocateFixed, Search } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/Field';

export interface LatLng {
  lat: number;
  lng: number;
}

interface Place {
  lat: number;
  lng: number;
  name: string;
}

const INDIA: L.LatLngExpression = [22.5, 79];
const round = (n: number) => Number(n.toFixed(6));

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
  const t = useTranslations('transport.stopForm');
  const locale = useLocale();
  const el = useRef<HTMLDivElement | null>(null);
  const map = useRef<L.Map | null>(null);
  const pin = useRef<L.CircleMarker | null>(null);
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [places, setPlaces] = useState<Place[] | null>(null);
  const [locating, setLocating] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  useEffect(() => {
    if (!el.current || map.current) return;
    const m = L.map(el.current, { zoomControl: true, attributionControl: true });
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 19,
    }).addTo(m);
    el.current.style.cursor = 'crosshair';

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
      onChangeRef.current({ lat: round(e.latlng.lat), lng: round(e.latlng.lng) });
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
    // A pin set from search, location or typed coordinates may be off screen.
    if (!m.getBounds().contains([value.lat, value.lng])) {
      m.setView([value.lat, value.lng], Math.max(m.getZoom(), 16));
    }
  }, [value]);

  const search = async () => {
    const q = query.trim();
    if (!q || searching) return;
    setSearching(true);
    setProblem(null);
    try {
      const params = new URLSearchParams({ format: 'jsonv2', q, limit: '6', countrycodes: 'in', 'accept-language': locale });
      // Prefer places near what the map shows (the route's other stops).
      const m = map.current;
      if (m && m.getZoom() >= 10) {
        const b = m.getBounds();
        params.set('viewbox', [b.getWest(), b.getNorth(), b.getEast(), b.getSouth()].map((n) => n.toFixed(4)).join(','));
      }
      const res = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, { headers: { Accept: 'application/json' } });
      if (!res.ok) throw new Error(String(res.status));
      const rows = (await res.json()) as { lat: string; lon: string; display_name: string }[];
      setPlaces(rows.map((r) => ({ lat: round(Number(r.lat)), lng: round(Number(r.lon)), name: r.display_name })));
    } catch {
      setPlaces(null);
      setProblem(t('searchFailed'));
    } finally {
      setSearching(false);
    }
  };

  const choose = (p: Place) => {
    setPlaces(null);
    map.current?.setView([p.lat, p.lng], 17);
    onChange({ lat: p.lat, lng: p.lng });
  };

  const locate = () => {
    if (!navigator.geolocation) {
      setProblem(t('locateFailed'));
      return;
    }
    setLocating(true);
    setProblem(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        const v = { lat: round(pos.coords.latitude), lng: round(pos.coords.longitude) };
        map.current?.setView([v.lat, v.lng], 17);
        onChange(v);
      },
      () => {
        setLocating(false);
        setProblem(t('locateFailed'));
      },
      { enableHighAccuracy: true, timeout: 15_000 },
    );
  };

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <div className="relative min-w-0 flex-1">
          <Input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            // Inside the stop form: Enter searches instead of submitting it.
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                void search();
              }
            }}
            placeholder={t('searchPlaceholder')}
            aria-label={t('searchPlaceholder')}
            className="pr-11"
          />
          <button
            type="button"
            onClick={() => void search()}
            disabled={searching || !query.trim()}
            aria-label={t('search')}
            title={t('search')}
            className="absolute inset-y-0 right-0 flex w-10 cursor-pointer items-center justify-center text-ink-faint hover:text-ink disabled:cursor-default disabled:opacity-50"
          >
            <Search className="size-4" />
          </button>
        </div>
        <Button type="button" variant="outline" onClick={locate} disabled={locating} title={t('useMyLocation')}>
          <LocateFixed />
          <span className="hidden sm:inline">{locating ? t('locating') : t('useMyLocation')}</span>
        </Button>
      </div>

      {searching && <p className="text-[12.5px] text-ink-muted">{t('searching')}</p>}
      {problem && <p className="text-[12.5px] text-accent-danger-deep">{problem}</p>}
      {places &&
        (places.length === 0 ? (
          <p className="text-[12.5px] text-ink-muted">{t('noPlaces')}</p>
        ) : (
          <ul className="max-h-44 divide-y divide-line overflow-y-auto rounded-md border border-line">
            {places.map((p, i) => (
              <li key={i}>
                <button
                  type="button"
                  onClick={() => choose(p)}
                  className="w-full cursor-pointer px-3 py-2 text-left text-[13px] text-ink hover:bg-surface-secondary"
                >
                  {p.name}
                </button>
              </li>
            ))}
          </ul>
        ))}

      <div ref={el} className="h-64 w-full overflow-hidden rounded-lg border border-line sm:h-72" />
    </div>
  );
}
