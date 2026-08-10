/**
 * Boundary geometry for the zone editor.
 *
 * A deliberate mirror of `staff-attendance-geo.util.ts` on the server, which
 * remains the authority — nothing here decides whether attendance is accepted.
 * These exist so the editor can answer while the operator is still drawing:
 * how big is this, does it cross itself, is it usable. Discovering a bow-tie
 * only after pressing Save, having placed twenty points, is a bad enough
 * experience to justify the duplication.
 *
 * Keep the thresholds in step with the server's; a boundary this accepts and
 * the server rejects is a confusing failure, and the reverse silently narrows
 * what schools can draw.
 */

import type { BoundaryPoint } from "./hr-api";

const EARTH_RADIUS_M = 6_371_000;
const toRad = (deg: number) => (deg * Math.PI) / 180;

export const MAX_BOUNDARY_VERTICES = 50;
export const MIN_BOUNDARY_AREA_SQ_M = 100;
export const MAX_BOUNDARY_AREA_SQ_M = 2_000_000;

interface PlanarPoint {
  x: number;
  y: number;
}

/** Local metre grid centred on `anchor`; distortion is negligible at campus scale. */
function project(point: BoundaryPoint, anchor: BoundaryPoint): PlanarPoint {
  return {
    x: EARTH_RADIUS_M * toRad(point.lng - anchor.lng) * Math.cos(toRad(anchor.lat)),
    y: EARTH_RADIUS_M * toRad(point.lat - anchor.lat),
  };
}

/** Enclosed area in square metres, whichever way the ring was drawn. */
export function ringAreaSqMetres(ring: BoundaryPoint[]): number {
  if (ring.length < 3) return 0;
  const p = ring.map((v) => project(v, ring[0]));
  let sum = 0;
  for (let i = 0, j = p.length - 1; i < p.length; j = i++) {
    sum += p[j].x * p[i].y - p[i].x * p[j].y;
  }
  return Math.abs(sum / 2);
}

function properlyIntersect(
  p1: PlanarPoint,
  p2: PlanarPoint,
  p3: PlanarPoint,
  p4: PlanarPoint,
): boolean {
  const cross = (o: PlanarPoint, a: PlanarPoint, b: PlanarPoint) =>
    (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
  const d1 = cross(p3, p4, p1);
  const d2 = cross(p3, p4, p2);
  const d3 = cross(p1, p2, p3);
  const d4 = cross(p1, p2, p4);
  return (
    ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) &&
    ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))
  );
}

/**
 * True if two non-adjacent edges cross. A bow-tie has no coherent inside, so
 * containment would admit and refuse people in bands across the campus with
 * nothing on screen to explain why.
 */
export function ringSelfIntersects(ring: BoundaryPoint[]): boolean {
  if (ring.length < 4) return false;
  const p = ring.map((v) => project(v, ring[0]));
  const n = p.length;
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      if (j === i + 1 || (i === 0 && j === n - 1)) continue;
      if (properlyIntersect(p[i], p[(i + 1) % n], p[j], p[(j + 1) % n])) return true;
    }
  }
  return false;
}

/** Human-readable reason the ring is unusable, or null when it is fine. */
export function validateBoundary(ring: BoundaryPoint[]): string | null {
  if (ring.length < 3) return "Add at least 3 points to close the boundary";
  if (ring.length > MAX_BOUNDARY_VERTICES) {
    return `A boundary can have at most ${MAX_BOUNDARY_VERTICES} points`;
  }
  if (ringSelfIntersects(ring)) {
    return "The boundary crosses over itself — drag the points so no two edges overlap";
  }
  const area = ringAreaSqMetres(ring);
  if (area < MIN_BOUNDARY_AREA_SQ_M) {
    return `That area (${Math.round(area)}m²) is too small to mark attendance in`;
  }
  if (area > MAX_BOUNDARY_AREA_SQ_M) {
    return `That covers ${(area / 1_000_000).toFixed(1)}km² — zoom in and trace just the campus`;
  }
  return null;
}

/** Area for display: square metres up close, hectares once that stops reading well. */
export function formatArea(sqMetres: number): string {
  if (sqMetres >= 10_000) return `${(sqMetres / 10_000).toFixed(2)} hectares`;
  return `${Math.round(sqMetres).toLocaleString()} m²`;
}

/** Centroid of a ring — the map centre stored alongside a drawn boundary. */
export function ringCentroid(ring: BoundaryPoint[]): BoundaryPoint {
  const lat = ring.reduce((sum, p) => sum + p.lat, 0) / ring.length;
  const lng = ring.reduce((sum, p) => sum + p.lng, 0) / ring.length;
  return { lat, lng };
}
