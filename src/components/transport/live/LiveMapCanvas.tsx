'use client';

/**
 * The live bus map. MapLibre GL draws OpenFreeMap's vector tiles: free, no
 * key, no per-request bill, and fine at app scale (unlike the public OSM
 * raster servers the stop picker uses for its occasional admin edits).
 *
 * Loaded with `next/dynamic({ ssr: false })` by LiveMap: MapLibre needs
 * `window` and WebGL.
 */

import { useEffect, useRef } from 'react';
import maplibregl, { type LngLatLike, type Map as MlMap, type Marker } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

export interface MapBus {
  id: string | number;
  lat: number;
  lng: number;
  label: string;
  /** Position is old: drawn grey. */
  stale?: boolean;
  selected?: boolean;
}

export interface MapPin {
  id: string | number;
  lat: number;
  lng: number;
  label: string;
  /** `home` = the child's own stop, drawn larger. */
  tone?: 'stop' | 'home';
}

const STYLE_URL = 'https://tiles.openfreemap.org/styles/liberty';
const INDIA: LngLatLike = [79, 22.5];
/**
 * OpenFreeMap's vector tiles stop at zoom 14; past ~15 some devices draw an
 * empty canvas while over-zooming, so automatic fits stop at 15.
 */
const FIT_MAX_ZOOM = 15;

const BUS_SVG =
  '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 6v6"/><path d="M15 6v6"/><path d="M2 12h19.6"/><path d="M18 18h3s.5-1.7.8-2.8c.1-.4.2-.8.2-1.2 0-.4-.1-.8-.2-1.2l-1.4-5C20.1 6.8 19.1 6 18 6H4a2 2 0 0 0-2 2v10h3"/><circle cx="7" cy="18" r="2"/><path d="M9 18h5"/><circle cx="16" cy="18" r="2"/></svg>';

function busElement(b: MapBus): HTMLElement {
  const el = document.createElement('div');
  el.setAttribute('role', 'img');
  el.setAttribute('aria-label', b.label);
  el.style.cssText = [
    'display:flex',
    'align-items:center',
    'gap:4px',
    'padding:4px 8px',
    'border-radius:999px',
    'font:600 12px/1 system-ui,sans-serif',
    'white-space:nowrap',
    'box-shadow:0 2px 8px rgba(0,0,0,.25)',
    `background:${b.stale ? '#8a8f98' : '#9a5b05'}`,
    'color:#fff',
    `outline:${b.selected ? '3px solid #f2b33d' : 'none'}`,
  ].join(';');
  el.innerHTML = `${BUS_SVG}<span></span>`;
  (el.querySelector('span') as HTMLSpanElement).textContent = b.label;
  return el;
}

function pinElement(p: MapPin): HTMLElement {
  const el = document.createElement('div');
  const home = p.tone === 'home';
  el.title = p.label;
  el.style.cssText = [
    `width:${home ? 18 : 12}px`,
    `height:${home ? 18 : 12}px`,
    'border-radius:999px',
    `background:${home ? '#2f6b4f' : '#ffffff'}`,
    `border:3px solid ${home ? '#ffffff' : '#5b6b86'}`,
    'box-shadow:0 1px 4px rgba(0,0,0,.3)',
  ].join(';');
  return el;
}

export default function LiveMapCanvas({
  buses,
  pins = [],
  trail,
  fitKey,
  onBusClick,
  className = 'h-72 w-full',
}: {
  buses: MapBus[];
  pins?: MapPin[];
  /** [lng, lat] pairs, oldest first. */
  trail?: [number, number][];
  /** Change it to re-fit the view to everything shown (first load always fits). */
  fitKey?: string | number;
  onBusClick?: (id: MapBus['id']) => void;
  className?: string;
}) {
  const el = useRef<HTMLDivElement | null>(null);
  const map = useRef<MlMap | null>(null);
  const ready = useRef(false);
  const markers = useRef<Marker[]>([]);
  const fitted = useRef<string | number | undefined | null>(null);
  const onBusClickRef = useRef(onBusClick);
  useEffect(() => {
    onBusClickRef.current = onBusClick;
  }, [onBusClick]);

  // Build once.
  useEffect(() => {
    if (!el.current || map.current) return;
    const m = new maplibregl.Map({
      container: el.current,
      style: STYLE_URL,
      center: INDIA,
      zoom: 4,
      attributionControl: { compact: true },
    });
    m.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
    m.on('load', () => {
      ready.current = true;
      // Small maps: keep the credit as the (i) button until tapped.
      el.current?.querySelector('.maplibregl-ctrl-attrib')?.classList.remove('maplibregl-compact-show');
      m.addSource('trail', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
      m.addLayer({
        id: 'trail',
        type: 'line',
        source: 'trail',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': '#9a5b05', 'line-width': 4, 'line-opacity': 0.75 },
      });
      m.fire('trail-ready');
    });
    map.current = m;
    fitted.current = null; // a new map has not been fitted yet
    return () => {
      markers.current.forEach((mk) => mk.remove());
      markers.current = [];
      m.remove();
      map.current = null;
      ready.current = false;
    };
  }, []);

  // Markers and trail on every data change.
  useEffect(() => {
    const m = map.current;
    if (!m) return;

    markers.current.forEach((mk) => mk.remove());
    markers.current = [];
    for (const p of pins) {
      markers.current.push(new maplibregl.Marker({ element: pinElement(p) }).setLngLat([p.lng, p.lat]).addTo(m));
    }
    for (const b of buses) {
      const node = busElement(b);
      if (onBusClickRef.current) {
        node.style.cursor = 'pointer';
        node.addEventListener('click', () => onBusClickRef.current?.(b.id));
      }
      markers.current.push(new maplibregl.Marker({ element: node }).setLngLat([b.lng, b.lat]).addTo(m));
    }

    const drawTrail = () => {
      const src = m.getSource('trail') as maplibregl.GeoJSONSource | undefined;
      src?.setData({
        type: 'FeatureCollection',
        features:
          trail && trail.length > 1
            ? [{ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: trail } }]
            : [],
      });
    };
    if (ready.current) drawTrail();
    else m.once('trail-ready', drawTrail);

    const points: [number, number][] = [
      ...buses.map((b) => [b.lng, b.lat] as [number, number]),
      ...pins.map((p) => [p.lng, p.lat] as [number, number]),
      ...(trail ?? []),
    ];
    if (points.length === 0) return;
    const key = fitKey ?? 'first';
    if (fitted.current !== key) {
      fitted.current = key;
      // Fit once the map has its real size: before 'load' the container may
      // still be settling (dynamic import, dialog animation) and the fit lands
      // on the wrong zoom.
      const fit = () => {
        m.resize();
        if (points.length === 1) m.jumpTo({ center: points[0], zoom: FIT_MAX_ZOOM });
        else {
          const bounds = points.reduce((bb, p) => bb.extend(p), new maplibregl.LngLatBounds(points[0], points[0]));
          m.fitBounds(bounds, { padding: 56, maxZoom: FIT_MAX_ZOOM, duration: 0 });
        }
      };
      if (ready.current) fit();
      else m.once('load', fit);
      return;
    }
    // Keep a moving bus in view without fighting the user's zoom.
    const sel = buses.find((b) => b.selected) ?? (buses.length === 1 ? buses[0] : undefined);
    if (sel && !m.getBounds().contains([sel.lng, sel.lat])) {
      m.easeTo({ center: [sel.lng, sel.lat], duration: 600 });
    }
  }, [buses, pins, trail, fitKey]);

  return <div ref={el} className={`overflow-hidden rounded-lg border border-line ${className}`} />;
}
