"use client";

/**
 * Satellite map for defining where attendance may be marked.
 *
 * Exists because the previous way of setting a zone — standing on the spot and
 * pressing "use my current location" — inherits whatever the phone happened to
 * report. A coarse fix there is silently permanent: every future check-in is
 * measured against a centre that may be hundreds of metres off, and nothing in
 * the UI ever says so. Tracing the campus on georeferenced imagery is accurate
 * to a few metres, which is better than any handset manages, and it is visibly
 * wrong when it is wrong.
 *
 * Leaflet is loaded through a dynamic import in the parent, not here: it
 * touches `window` at module scope and would break server rendering.
 */

import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { AttendanceZone, BoundaryPoint } from "@/lib/hr-api";
import {
  formatArea,
  ringAreaSqMetres,
  validateBoundary,
  MAX_BOUNDARY_VERTICES,
} from "@/lib/geo-boundary";

/**
 * Basemap sources. Esri's World Imagery needs no key, no billing account and
 * no per-tenant setup, and at 0.3–0.6 m/pixel in urban India it resolves
 * individual buildings — far finer than the ±15–40 m phone fixes it is used to
 * judge, so imagery sharpness is not the limiting factor here.
 *
 * Google is left as a one-line swap rather than a rewrite: if a particular
 * campus turns out to be stale or cloud-covered on Esri, the fix is to point
 * that tenant at a different layer, not to rebuild the editor.
 */
const BASEMAPS = {
  esriSatellite: {
    label: "Satellite",
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    attribution: "Imagery &copy; Esri, Maxar, Earthstar Geographics",
    maxZoom: 21,
  },
  osmStreet: {
    label: "Street",
    url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    attribution: "&copy; OpenStreetMap contributors",
    maxZoom: 19,
  },
} as const;

type BasemapKey = keyof typeof BASEMAPS;

/**
 * A finger is not a mouse pointer. Coarse pointers get a target near the 44px
 * minimum so a vertex can actually be grabbed, rather than the 7px dot that is
 * comfortable to hit with a cursor.
 */
const COARSE_POINTER =
  typeof window !== "undefined" &&
  window.matchMedia?.("(pointer: coarse)").matches;
const HANDLE_RADIUS = COARSE_POINTER ? 12 : 7;

/** Movement under this many pixels counts as a tap, not a drag. */
const TAP_SLOP_PX = 8;

/**
 * Makes a Leaflet vector marker draggable by finger or mouse, and reports a
 * press that never moved as a tap.
 *
 * Built on pointer events rather than Leaflet's `mousedown`/`mousemove`, which
 * never fire for touch — that omission is what would have confined zone editing
 * to a laptop. `setPointerCapture` keeps the drag alive when the finger leaves
 * the small handle, which on a phone it immediately does.
 */
function makeDraggable(
  map: L.Map,
  marker: L.CircleMarker,
  handlers: { onDrag: (latlng: L.LatLng) => void; onTap?: () => void },
): void {
  const el = marker.getElement() as SVGElement | null;
  if (!el) return;

  // Without this the browser claims the gesture for panning/scrolling and the
  // pointermove stream stops after the first few pixels.
  el.style.touchAction = "none";
  el.style.cursor = "grab";

  el.addEventListener("pointerdown", (down: PointerEvent) => {
    down.preventDefault();
    down.stopPropagation();
    // Capture keeps the drag alive once the finger leaves the handle, which on
    // a phone happens immediately. It throws if the pointer is already gone, so
    // a failure here must not take the rest of the drag down with it.
    try {
      el.setPointerCapture(down.pointerId);
    } catch {
      /* capture unavailable — dragging still works, just not past the edge */
    }
    map.dragging.disable();

    const startX = down.clientX;
    const startY = down.clientY;
    let moved = false;

    const toLatLng = (e: PointerEvent) => {
      const rect = map.getContainer().getBoundingClientRect();
      return map.containerPointToLatLng([
        e.clientX - rect.left,
        e.clientY - rect.top,
      ]);
    };

    const onMove = (move: PointerEvent) => {
      if (
        !moved &&
        Math.hypot(move.clientX - startX, move.clientY - startY) < TAP_SLOP_PX
      ) {
        return; // still within tap tolerance — don't jitter the shape
      }
      moved = true;
      const latlng = toLatLng(move);
      marker.setLatLng(latlng);
      handlers.onDrag(latlng);
    };

    const onUp = () => {
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerup", onUp);
      el.removeEventListener("pointercancel", onUp);
      map.dragging.enable();
      if (!moved) handlers.onTap?.();
    };

    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerup", onUp);
    el.addEventListener("pointercancel", onUp);
  });
}

export interface ZoneBoundaryMapProps {
  /** Map centre, and the circle centre when no boundary is drawn. */
  centre: BoundaryPoint;
  radiusMeters: number;
  boundary: BoundaryPoint[] | null;
  /** Other zones for this school, drawn dimmed so coverage gaps are visible. */
  otherZones?: AttendanceZone[];
  onBoundaryChange: (boundary: BoundaryPoint[] | null) => void;
  onCentreChange: (centre: BoundaryPoint) => void;
  /**
   * Which kind of zone is being defined. Owned by the form, not by this map:
   * the form shows or hides the centre/radius fields on the same signal, and
   * if it reacted to the first point landing instead, the fields would vanish
   * mid-trace and shift the map out from under the next tap.
   */
  mode: "circle" | "polygon";
  onModeChange: (mode: "circle" | "polygon") => void;
  /** Renders the shape without any editing affordances. */
  readOnly?: boolean;
}

export default function ZoneBoundaryMap({
  centre,
  radiusMeters,
  boundary,
  otherZones = [],
  onBoundaryChange,
  onCentreChange,
  mode,
  onModeChange,
  readOnly = false,
}: ZoneBoundaryMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const tileRef = useRef<L.TileLayer | null>(null);
  /** Everything redrawn on each state change, kept apart from the basemap. */
  const overlayRef = useRef<L.LayerGroup | null>(null);
  const [basemap, setBasemap] = useState<BasemapKey>("esriSatellite");

  /**
   * Callbacks are read through a ref inside Leaflet handlers. Leaflet listeners
   * are bound imperatively and outlive a render, so a handler closing over the
   * props directly would keep calling the version from the render that bound
   * it, and edits made after the first click would be written against stale
   * state.
   */
  const handlersRef = useRef({ onBoundaryChange, onCentreChange, boundary, mode });
  handlersRef.current = { onBoundaryChange, onCentreChange, boundary, mode };

  // ── Map creation, once ──────────────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      center: [centre.lat, centre.lng],
      zoom: 18,
      // Campus-scale work only; letting the operator zoom out to the country
      // is how a boundary ends up covering the neighbourhood.
      minZoom: 15,
      zoomControl: true,
    });
    mapRef.current = map;

    tileRef.current = L.tileLayer(BASEMAPS.esriSatellite.url, {
      attribution: BASEMAPS.esriSatellite.attribution,
      maxZoom: BASEMAPS.esriSatellite.maxZoom,
    }).addTo(map);

    overlayRef.current = L.layerGroup().addTo(map);

    map.on("click", (e: L.LeafletMouseEvent) => {
      const { mode: currentMode, boundary: current, onBoundaryChange: emit } =
        handlersRef.current;
      if (currentMode !== "polygon") return;
      const points = current ?? [];
      if (points.length >= MAX_BOUNDARY_VERTICES) return;
      emit([...points, { lat: e.latlng.lat, lng: e.latlng.lng }]);
    });

    return () => {
      map.remove();
      mapRef.current = null;
      overlayRef.current = null;
      tileRef.current = null;
    };
    // Created once; centre changes are handled by the redraw effect below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Basemap switching ───────────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !tileRef.current) return;
    const source = BASEMAPS[basemap];
    tileRef.current.remove();
    tileRef.current = L.tileLayer(source.url, {
      attribution: source.attribution,
      maxZoom: source.maxZoom,
    }).addTo(map);
    tileRef.current.bringToBack();
  }, [basemap]);

  // ── Cursor affordance while drawing ─────────────────────────────────────
  useEffect(() => {
    const container = mapRef.current?.getContainer();
    if (container) container.style.cursor = mode === "polygon" ? "crosshair" : "";
  }, [mode]);

  /**
   * Bring the map fully into view the moment drawing starts.
   *
   * Leaflet gives its container a tabindex, so the first tap focuses it and the
   * browser scrolls it into view — inside a scrollable dialog on a phone that
   * shifts the map up under the finger, and the *second* corner lands somewhere
   * the operator never aimed. Doing the scroll here spends it before any corner
   * is placed, leaving the browser's own scroll-into-view with nothing to do.
   */
  useEffect(() => {
    if (mode !== "polygon") return;
    const container = mapRef.current?.getContainer();
    container?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [mode]);

  // ── Redraw overlays whenever the shape changes ──────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    const overlay = overlayRef.current;
    if (!map || !overlay) return;
    overlay.clearLayers();

    // Existing zones, dimmed — the operator can see what is already covered
    // and where the gaps are, which is the whole reason to draw another.
    for (const zone of otherZones) {
      if (zone.boundary && zone.boundary.length >= 3) {
        L.polygon(
          zone.boundary.map((p) => [p.lat, p.lng] as L.LatLngExpression),
          { color: "#94a3b8", weight: 1, fillOpacity: 0.08, dashArray: "4 4", interactive: false },
        )
          .bindTooltip(zone.name)
          .addTo(overlay);
      } else {
        L.circle([zone.lat, zone.lng], {
          radius: zone.radiusMeters,
          color: "#94a3b8",
          weight: 1,
          fillOpacity: 0.08,
          dashArray: "4 4",
          interactive: false,
        })
          .bindTooltip(zone.name)
          .addTo(overlay);
      }
    }

    if (boundary && boundary.length > 0) {
      const latlngs = boundary.map((p) => [p.lat, p.lng] as L.LatLngExpression);
      const invalid = boundary.length >= 3 && validateBoundary(boundary) !== null;
      const stroke = invalid ? "#dc2626" : "#2563eb";

      if (boundary.length >= 3) {
        L.polygon(latlngs, {
          color: stroke,
          weight: 2,
          fillColor: stroke,
          fillOpacity: 0.15,
          interactive: false,
        }).addTo(overlay);
      } else {
        // Two points or fewer cannot enclose anything; show the run so far.
        L.polyline(latlngs, { color: stroke, weight: 2, interactive: false }).addTo(overlay);
      }

      // Draggable vertices. Circle markers rather than pins: Leaflet's default
      // icon resolves its image by URL and breaks under a bundler, and a plain
      // dot is easier to place precisely anyway.
      boundary.forEach((point, index) => {
        const handle = L.circleMarker([point.lat, point.lng], {
          radius: HANDLE_RADIUS,
          color: "#ffffff",
          weight: 2,
          fillColor: stroke,
          fillOpacity: 1,
          // Non-draggable in read-only mode, but still rendered so the shape
          // reads correctly.
          interactive: !readOnly,
        }).addTo(overlay);

        if (readOnly) return;

        handle.bindTooltip(
          `Point ${index + 1} — drag to move, tap to remove`,
          { direction: "top" },
        );

        makeDraggable(map, handle, {
          onDrag: (latlng) => {
            const next = [...(handlersRef.current.boundary ?? [])];
            next[index] = { lat: latlng.lat, lng: latlng.lng };
            handlersRef.current.onBoundaryChange(next);
          },
          // A press that never moved means "remove this point" — but only
          // while the ring would still be a ring afterwards.
          onTap: () => {
            const current = handlersRef.current.boundary ?? [];
            if (current.length > 3) {
              handlersRef.current.onBoundaryChange(
                current.filter((_, i) => i !== index),
              );
            }
          },
        });
      });
    } else {
      // No boundary yet: show the circle this zone falls back to.
      L.circle([centre.lat, centre.lng], {
        radius: radiusMeters,
        color: "#2563eb",
        weight: 2,
        fillColor: "#2563eb",
        fillOpacity: 0.15,
        interactive: false,
      }).addTo(overlay);

      const pin = L.circleMarker([centre.lat, centre.lng], {
        radius: HANDLE_RADIUS,
        color: "#ffffff",
        weight: 2,
        fillColor: "#2563eb",
        fillOpacity: 1,
      })
        .bindTooltip("Zone centre — drag onto the building")
        .addTo(overlay);

      if (!readOnly) {
        makeDraggable(map, pin, {
          onDrag: (latlng) =>
            handlersRef.current.onCentreChange({
              lat: latlng.lat,
              lng: latlng.lng,
            }),
        });
      }
    }
  }, [boundary, centre, radiusMeters, otherZones, readOnly]);

  // ── Keep the viewport on the shape being edited ─────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (boundary && boundary.length >= 3) {
      map.fitBounds(
        L.latLngBounds(boundary.map((p) => [p.lat, p.lng] as L.LatLngExpression)),
        { padding: [40, 40], maxZoom: 19 },
      );
    } else if (!boundary || boundary.length === 0) {
      map.setView([centre.lat, centre.lng], map.getZoom());
    }
    // Deliberately not reacting to every vertex drag — refitting mid-drag would
    // move the ground under the operator's finger.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [boundary === null, centre.lat, centre.lng]);

  const area = boundary && boundary.length >= 3 ? ringAreaSqMetres(boundary) : 0;
  const problem = boundary && boundary.length > 0 ? validateBoundary(boundary) : null;

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex rounded-lg border border-gray-300 overflow-hidden text-xs">
          {(Object.keys(BASEMAPS) as BasemapKey[]).map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => setBasemap(key)}
              aria-pressed={basemap === key}
              className={`px-3 py-1.5 min-h-9 transition-colors ${
                basemap === key
                  ? "bg-blue-600 text-white"
                  : "bg-white text-gray-700 hover:bg-gray-50"
              }`}
            >
              {BASEMAPS[key].label}
            </button>
          ))}
        </div>

        {!readOnly && (
          <>
            <div className="flex rounded-lg border border-gray-300 overflow-hidden text-xs">
              <button
                type="button"
                onClick={() => {
                  onModeChange("circle");
                  onBoundaryChange(null);
                }}
                aria-pressed={mode === "circle"}
                className={`px-3 py-1.5 min-h-9 transition-colors ${
                  mode === "circle"
                    ? "bg-blue-600 text-white"
                    : "bg-white text-gray-700 hover:bg-gray-50"
                }`}
              >
                Centre + radius
              </button>
              <button
                type="button"
                onClick={() => onModeChange("polygon")}
                aria-pressed={mode === "polygon"}
                className={`px-3 py-1.5 min-h-9 border-l border-gray-300 transition-colors ${
                  mode === "polygon"
                    ? "bg-blue-600 text-white"
                    : "bg-white text-gray-700 hover:bg-gray-50"
                }`}
              >
                Draw outline
              </button>
            </div>

          </>
        )}
      </div>

      <div
        ref={containerRef}
        // Taller on a phone than the old fixed height: a small map on a small
        // screen is what made tracing feel impossible, and vertical space is
        // the one thing a phone has.
        className="h-[60vh] sm:h-95 max-h-130 w-full rounded-xl border border-gray-300 overflow-hidden z-0"
        style={{ minHeight: 300 }}
      />

      {/* Undo/Start over live BELOW the map, and appear only once there is
          something to undo. Above it they would grow the toolbar on the first
          tap and shove the map down mid-trace, landing the next corner
          somewhere the operator never touched. */}
      {!readOnly && mode === "polygon" && !!boundary?.length && (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() =>
              onBoundaryChange(boundary.length <= 1 ? null : boundary.slice(0, -1))
            }
            className="text-xs px-3 py-1.5 min-h-9 rounded-lg border border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
          >
            Undo point
          </button>
          <button
            type="button"
            onClick={() => onBoundaryChange(null)}
            className="text-xs px-3 py-1.5 min-h-9 rounded-lg border border-gray-300 bg-white text-red-600 hover:bg-red-50"
          >
            Start over
          </button>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
        <span className="text-gray-600">
          {boundary?.length
            ? `${boundary.length} point${boundary.length === 1 ? "" : "s"}${
                area ? ` · ${formatArea(area)}` : ""
              }`
            : mode === "polygon"
              ? "No points yet"
              : `Circle · ${radiusMeters}m radius`}
        </span>
        <span className="text-blue-700">
          {mode === "polygon"
            ? "Tap each corner of the campus. Tap a point to remove it."
            : "Drag the centre dot onto your school building."}
        </span>
      </div>

      {problem && (
        <p role="alert" className="text-xs text-red-600">
          {problem}
        </p>
      )}

      {!!boundary?.length && !problem && (
        <p className="text-xs text-gray-500">
          Staff must stand inside this outline, with a GPS fix precise enough to
          prove it. Leave room at the edges — a phone accurate to ±20m needs to
          be at least 20m inside the line.
        </p>
      )}
    </div>
  );
}
