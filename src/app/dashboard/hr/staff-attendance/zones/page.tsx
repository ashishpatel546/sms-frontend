"use client";

import { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import { hrApi, AttendanceZone, BoundaryPoint } from "@/lib/hr-api";
import { useRbac } from "@/lib/rbac";
import {
  acquirePreciseFix,
  describeAccuracy,
  explainFixError,
  GeolocationFixError,
} from "@/lib/geolocation";
import {
  formatArea,
  ringAreaSqMetres,
  ringCentroid,
  validateBoundary,
} from "@/lib/geo-boundary";
import toast, { Toaster } from "react-hot-toast";
import Link from "next/link";

/**
 * Leaflet reads `window` when its module loads, so the map cannot be part of
 * the server render. Loading it on demand also keeps ~150KB out of the bundle
 * for everyone who never opens the zone editor.
 */
const ZoneBoundaryMap = dynamic(
  () => import("@/components/attendance/ZoneBoundaryMap"),
  {
    ssr: false,
    loading: () => (
      <div className="h-95 w-full rounded-xl border border-gray-300 bg-gray-50 grid place-items-center text-sm text-gray-500">
        Loading map…
      </div>
    ),
  },
);

// Form state keeps numeric fields as strings while the user is typing
// so empty values are valid (avoids NaN warnings) and the leading "0"
// can be cleared cleanly on mobile keyboards.
type ZoneFormState = {
  name: string;
  latStr: string;
  lngStr: string;
  radiusStr: string;
  isActive: boolean;
  /** Traced outline; null means this zone stays a circle. */
  boundary: BoundaryPoint[] | null;
};

type ZoneFormErrors = {
  name?: string;
  lat?: string;
  lng?: string;
  radius?: string;
  boundary?: string;
};

const EMPTY_FORM: ZoneFormState = {
  name: "",
  latStr: "",
  lngStr: "",
  radiusStr: "",
  isActive: true,
  boundary: null,
};

/** Where the map opens when a new zone has no coordinates yet — central Delhi. */
const FALLBACK_CENTRE: BoundaryPoint = { lat: 28.6139, lng: 77.209 };

export default function AttendanceZonesPage() {
  const rbac = useRbac();
  const [zones, setZones] = useState<AttendanceZone[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<ZoneFormState>(EMPTY_FORM);
  const [formErrors, setFormErrors] = useState<ZoneFormErrors>({});
  const [locationWarning, setLocationWarning] = useState<string | null>(null);
  const [locatingCentre, setLocatingCentre] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  /**
   * Circle or drawn outline. Lives here rather than inside the map because the
   * centre/radius fields below hide on the same signal — keyed off the boundary
   * instead, they would disappear as the first corner landed and shunt the map
   * mid-trace.
   */
  const [shapeMode, setShapeMode] = useState<"circle" | "polygon">("circle");
  const [showForm, setShowForm] = useState(false);

  const load = async () => {
    setLoading(true);
    try { setZones(await hrApi.attendance.zones.list()); }
    catch { toast.error("Failed to load zones"); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  /**
   * Where the map opens. Typed coordinates win so the numeric fields and the
   * map never disagree; a drawn boundary supplies its own view; otherwise fall
   * back to a sensible default rather than the middle of the ocean.
   */
  const typedLat = parseFloat(form.latStr);
  const typedLng = parseFloat(form.lngStr);
  const mapCentre: BoundaryPoint =
    Number.isFinite(typedLat) && Number.isFinite(typedLng)
      ? { lat: typedLat, lng: typedLng }
      : form.boundary?.length
        ? form.boundary[0]
        : FALLBACK_CENTRE;

  const openCreate = () => { setForm(EMPTY_FORM); setFormErrors({}); setLocationWarning(null); setEditId(null); setShapeMode("circle"); setShowForm(true); };
  const openEdit = (z: AttendanceZone) => {
    setForm({
      name: z.name ?? "",
      latStr: z.lat !== undefined && z.lat !== null ? String(z.lat) : "",
      lngStr: z.lng !== undefined && z.lng !== null ? String(z.lng) : "",
      radiusStr: z.radiusMeters !== undefined && z.radiusMeters !== null ? String(z.radiusMeters) : "",
      isActive: z.isActive ?? true,
      boundary: z.boundary?.length ? z.boundary : null,
    });
    setFormErrors({});
    setLocationWarning(null);
    setEditId(z.id);
    setShapeMode(z.boundary?.length ? "polygon" : "circle");
    setShowForm(true);
  };

  const handleSave = async () => {
    const name = form.name.trim();
    const lat = form.latStr.trim() === "" ? NaN : parseFloat(form.latStr);
    const lng = form.lngStr.trim() === "" ? NaN : parseFloat(form.lngStr);
    const radius = form.radiusStr.trim() === "" ? undefined : Number(form.radiusStr);

    const drawn = shapeMode === "polygon" && form.boundary?.length ? form.boundary : null;

    const errors: ZoneFormErrors = {};
    if (!name) errors.name = "Zone name is required";

    // Coordinates are only something the operator must supply for a circle.
    // With an outline drawn they are derived from it below, so demanding them
    // would be asking for a centre the shape already knows.
    if (!drawn) {
      if (form.latStr.trim() === "") errors.lat = "Latitude is required";
      else if (!Number.isFinite(lat) || lat < -90 || lat > 90) errors.lat = "Must be a number between -90 and 90";
      if (form.lngStr.trim() === "") errors.lng = "Longitude is required";
      else if (!Number.isFinite(lng) || lng < -180 || lng > 180) errors.lng = "Must be a number between -180 and 180";
      if (radius !== undefined && (!Number.isFinite(radius) || radius < 10)) errors.radius = "Radius must be at least 10 metres";
    } else {
      // Half-drawn outlines are rejected rather than silently discarded: saving
      // as a circle when the operator believes they traced a boundary is the
      // worse failure of the two.
      const problem = validateBoundary(drawn);
      if (problem) errors.boundary = problem;
    }

    if (Object.keys(errors).length > 0) { setFormErrors(errors); return; }
    setFormErrors({});

    // `lat`/`lng` stop being the geofence for a drawn zone and become simply
    // where its editor opens, so they follow the outline's centroid rather
    // than whatever was typed before it was traced. `radiusMeters` is unused
    // for these zones but stays NOT NULL in the schema, so it keeps a value.
    const centroid = drawn ? ringCentroid(drawn) : null;
    const payload = {
      name,
      lat: centroid ? centroid.lat : lat,
      lng: centroid ? centroid.lng : lng,
      radiusMeters: radius,
    };

    try {
      if (editId) {
        await hrApi.attendance.zones.update(editId, {
          ...payload,
          // Explicit null, not undefined — omitting the field is a patch that
          // leaves an existing outline alone, so clearing needs to be said.
          boundary: drawn,
          isActive: form.isActive,
        });
        toast.success("Zone updated");
      } else {
        await hrApi.attendance.zones.create({
          ...payload,
          ...(drawn ? { boundary: drawn } : {}),
        });
        toast.success("Zone created");
      }
      setShowForm(false); load();
    } catch (e: any) { toast.error(e?.info?.message ?? "Save failed"); }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Delete this zone?")) return;
    try { await hrApi.attendance.zones.remove(id); toast.success("Deleted"); load(); }
    catch (e: any) { toast.error(e?.info?.message ?? "Delete failed"); }
  };

  /**
   * Drop the zone centre on the operator's own position.
   *
   * This used to call `getCurrentPosition` with no options and discard
   * `accuracy`, so it could quietly capture a cached network fix — and a zone
   * centre set from a fix that was 500m out stays 500m out forever, silently
   * misjudging every check-in afterwards. Now it refines like the check-in path
   * does and reports how precise the result was, so a poor one is visible
   * rather than inherited.
   */
  const useCurrentLocation = async () => {
    setLocatingCentre(true);
    setLocationWarning(null);
    try {
      const fix = await acquirePreciseFix({
        onProgress: ({ accuracy }) =>
          setLocationWarning(`Locating… currently ${describeAccuracy(accuracy)}`),
      });
      setForm((f) => ({
        ...f,
        latStr: String(fix.lat),
        lngStr: String(fix.lng),
      }));
      setFormErrors((e) => ({ ...e, lat: undefined, lng: undefined }));
      setLocationWarning(
        fix.accuracy > 30
          ? `Placed the centre, but only to ${describeAccuracy(fix.accuracy)}. Check it against the map below and drag it onto the building if it is off.`
          : `Centre placed, accurate to ${describeAccuracy(fix.accuracy)}.`,
      );
    } catch (e: any) {
      setLocationWarning(
        e instanceof GeolocationFixError
          ? explainFixError(e)
          : "Could not get your location. Drop the centre on the map instead.",
      );
    } finally {
      setLocatingCentre(false);
    }
  };

  return (
    <div className="p-3 sm:p-6 space-y-4">
      <Toaster />
      <div className="flex items-center gap-3">
        <Link href="/dashboard/hr/staff-attendance" className="text-gray-400 hover:text-gray-700 transition-colors" title="Back to Staff Attendance">
          ← Back
        </Link>
        <h1 className="font-display text-[22px] sm:text-[26px] font-semibold tracking-[-0.02em] text-ink">Attendance Geo-Zones</h1>
        <div className="flex-1" />
        {rbac.canManageHR && (
          <button onClick={openCreate} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700">
            + New Zone
          </button>
        )}
      </div>
      <div className="bg-teal-50 border border-teal-200 rounded-lg p-4">
        <h2 className="text-sm font-semibold text-teal-900 mb-1">About Attendance Geo-Zones</h2>
        <p className="text-xs text-teal-800 leading-relaxed">
          Geo-zones define <strong>where staff are allowed to mark attendance</strong>. Trace your campus outline on the
          satellite map, or set a centre point and radius. Staff must be inside at least one active zone, and their phone
          must be precise enough to <strong>prove</strong> it — a check-in is only accepted when the whole GPS accuracy
          circle falls within the boundary, so a phone guessing from the network is never admitted.
        </p>
        <p className="text-xs text-teal-800 leading-relaxed mt-2">
          Leave the edges some room. A phone accurate to ±20m must stand at least 20m inside the line, so a boundary drawn
          tight to the walls will turn people away who are genuinely on site. Tracing the real outline beats a circle on
          any campus that is not round — a circle inside a long, narrow plot covers only a fraction of the grounds.
        </p>
      </div>

      {loading ? (
        <p className="text-sm text-gray-500">Loading…</p>
      ) : zones.length === 0 ? (
        <div className="text-center py-12 text-gray-500 text-sm">No zones defined yet.</div>
      ) : (
        <>
          {/* Mobile cards */}
          <div className="sm:hidden space-y-3">
            {zones.map((z) => (
              <div key={z.id} className="bg-white border border-gray-200 rounded-xl p-4 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <p className="font-medium text-gray-900 text-sm">{z.name}</p>
                  <span className={`shrink-0 px-2 py-0.5 rounded-full text-xs border ${z.isActive ? "bg-green-50 text-green-700 border-green-200" : "bg-gray-100 text-gray-500 border-gray-200"}`}>{z.isActive ? "Active" : "Inactive"}</span>
                </div>
                <div className="text-xs text-gray-600 font-mono space-y-0.5">
                  <div>{Number(z.lat).toFixed(6)}, {Number(z.lng).toFixed(6)}</div>
                  <div className="text-gray-500">
                    {z.boundary?.length
                      ? `Boundary: ${z.boundary.length} points · ${formatArea(ringAreaSqMetres(z.boundary))}`
                      : `Radius: ${z.radiusMeters}m`}
                  </div>
                </div>
                {rbac.canManageHR && (
                  <div className="flex gap-3">
                    <button onClick={() => openEdit(z)} className="text-blue-600 hover:underline text-xs">Edit</button>
                    <button onClick={() => handleDelete(z.id)} className="text-red-600 hover:underline text-xs">Delete</button>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Tablet+ table */}
          <div className="hidden sm:block overflow-x-auto rounded-xl border border-gray-200">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 text-gray-600 text-xs uppercase">
                <tr>
                  <th className="px-4 py-3 text-left">Name</th>
                  <th className="px-4 py-3 text-left">Latitude</th>
                  <th className="px-4 py-3 text-left">Longitude</th>
                  <th className="px-4 py-3 text-left">Shape</th>
                  <th className="px-4 py-3 text-left">Status</th>
                  {rbac.canManageHR && <th className="px-4 py-3 text-left">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {zones.map((z) => (
                  <tr key={z.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900">{z.name}</td>
                    <td className="px-4 py-3 font-mono text-xs">{Number(z.lat).toFixed(6)}</td>
                    <td className="px-4 py-3 font-mono text-xs">{Number(z.lng).toFixed(6)}</td>
                    <td className="px-4 py-3 text-xs">
                      {z.boundary?.length ? (
                        <span className="text-gray-700">
                          Boundary · {z.boundary.length} pts ·{" "}
                          {formatArea(ringAreaSqMetres(z.boundary))}
                        </span>
                      ) : (
                        <span className="text-gray-500">Circle · {z.radiusMeters}m</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs border ${z.isActive ? "bg-green-50 text-green-700 border-green-200" : "bg-gray-100 text-gray-500 border-gray-200"}`}>{z.isActive ? "Active" : "Inactive"}</span>
                    </td>
                    {rbac.canManageHR && (
                      <td className="px-4 py-3 flex gap-2">
                        <button onClick={() => openEdit(z)} className="text-blue-600 hover:underline text-xs">Edit</button>
                        <button onClick={() => handleDelete(z.id)} className="text-red-600 hover:underline text-xs">Delete</button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Form modal — flex column with a pinned footer so Save/Cancel stay
          visible on mobile even when the on-screen keyboard shrinks the
          viewport (dvh tracks the *visible* viewport, unlike vh).
          z-[80]: must stack above the mobile BottomTabBar (z-50, rendered
          after page content) which otherwise covers the footer. */}
      {showForm && (
        <div className="fixed inset-0 bg-walnut-950/55 flex items-end sm:items-center justify-center z-[80] p-0 sm:p-4">
          <div className="bg-white rounded-t-2xl sm:rounded-xl w-full sm:max-w-2xl flex flex-col max-h-[85dvh]">
            <h2 className="font-semibold text-lg px-5 pt-5 pb-3 shrink-0">{editId ? "Edit" : "New"} Geo-Zone</h2>
            <div className="px-5 space-y-4 overflow-y-auto flex-1 min-h-0">
            <div>
              <label className="text-sm font-medium">Zone Name</label>
              <input
                value={form.name}
                onChange={(e) => { setForm((f) => ({ ...f, name: e.target.value })); setFormErrors((er) => ({ ...er, name: undefined })); }}
                className={`w-full border rounded-lg px-3 py-2 text-sm mt-1 ${formErrors.name ? "border-red-400" : ""}`}
              />
              {formErrors.name && <p className="text-xs text-red-500 mt-1">{formErrors.name}</p>}
            </div>
            {/* The map sits above every conditional field on purpose. The
                circle-only controls below appear and disappear as the first
                point lands, and anything that reflows *above* the map drags it
                out from under the cursor mid-trace — which lands the next
                corner somewhere the operator never clicked. */}
            <div className="space-y-2">
              <div className="flex items-baseline justify-between gap-2">
                <label className="text-sm font-medium">Campus boundary</label>
                <span className="text-xs text-gray-500">
                  {shapeMode === "polygon" ? "Drawn outline" : "Circle"}
                </span>
              </div>
              {/* Editable on a phone too. Tapping each corner of a campus is
                  the same gesture people already use to drop a delivery pin,
                  and the handles are sized for a fingertip — the earlier
                  laptop-only restriction made the common case (a head teacher
                  standing on site with a phone) the unsupported one. */}
              <ZoneBoundaryMap
                centre={mapCentre}
                radiusMeters={Number(form.radiusStr) || 100}
                boundary={form.boundary}
                otherZones={zones.filter((z) => z.id !== editId)}
                onBoundaryChange={(boundary) => {
                  setForm((f) => ({ ...f, boundary }));
                  setFormErrors((er) => ({ ...er, boundary: undefined }));
                }}
                onCentreChange={(c) =>
                  setForm((f) => ({
                    ...f,
                    latStr: String(c.lat),
                    lngStr: String(c.lng),
                  }))
                }
                mode={shapeMode}
                onModeChange={setShapeMode}
              />
              {/* `sm:hidden` because the map states the same problem live, in
                  red, as the shape is drawn — showing both printed it twice.
                  Kept for narrow screens, where the map is not rendered and
                  this is the only thing that would explain a blocked save. */}
              {formErrors.boundary && (
                <p role="alert" className="sm:hidden text-xs text-red-500">{formErrors.boundary}</p>
              )}
            </div>

            {/* Centre, radius and "use my location" all belong to the circle.
                Once an outline exists it defines its own extent and centre, so
                these would be a second, contradictory set of numbers on screen
                — they go away rather than sit there greyed out inviting the
                question of which one wins. */}
            {shapeMode === "circle" && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-sm font-medium">Latitude</label>
                    <input
                      type="number"
                      step="any"
                      inputMode="decimal"
                      placeholder="e.g. 28.6139"
                      value={form.latStr}
                      onChange={(e) => { setForm((f) => ({ ...f, latStr: e.target.value })); setFormErrors((er) => ({ ...er, lat: undefined })); }}
                      className={`w-full border rounded-lg px-3 py-2 text-sm mt-1 font-mono ${formErrors.lat ? "border-red-400" : ""}`}
                    />
                    {formErrors.lat && <p className="text-xs text-red-500 mt-1">{formErrors.lat}</p>}
                  </div>
                  <div>
                    <label className="text-sm font-medium">Longitude</label>
                    <input
                      type="number"
                      step="any"
                      inputMode="decimal"
                      placeholder="e.g. 77.2090"
                      value={form.lngStr}
                      onChange={(e) => { setForm((f) => ({ ...f, lngStr: e.target.value })); setFormErrors((er) => ({ ...er, lng: undefined })); }}
                      className={`w-full border rounded-lg px-3 py-2 text-sm mt-1 font-mono ${formErrors.lng ? "border-red-400" : ""}`}
                    />
                    {formErrors.lng && <p className="text-xs text-red-500 mt-1">{formErrors.lng}</p>}
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium">Radius (metres)</label>
                  <input
                    type="number"
                    min={10}
                    inputMode="numeric"
                    placeholder="100"
                    value={form.radiusStr}
                    onChange={(e) => { setForm((f) => ({ ...f, radiusStr: e.target.value })); setFormErrors((er) => ({ ...er, radius: undefined })); }}
                    className={`w-full border rounded-lg px-3 py-2 text-sm mt-1 ${formErrors.radius ? "border-red-400" : ""}`}
                  />
                  {formErrors.radius && <p className="text-xs text-red-500 mt-1">{formErrors.radius}</p>}
                </div>

                <div>
                  <button
                    onClick={useCurrentLocation}
                    disabled={locatingCentre}
                    className="text-sm text-blue-600 hover:underline disabled:text-gray-400 disabled:no-underline min-h-9"
                  >
                    {locatingCentre ? "Locating…" : "📍 Use my current location"}
                  </button>
                  {locationWarning && (
                    <div className="mt-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs text-amber-800">
                      {locationWarning}
                    </div>
                  )}
                </div>
              </>
            )}
            <div className="flex items-center gap-2">
              <input id="za" type="checkbox" checked={form.isActive} onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))} className="rounded" />
              <label htmlFor="za" className="text-sm">Active</label>
            </div>
            </div>
            <div className="flex gap-2 justify-end shrink-0 px-5 pt-3 pb-[max(1.25rem,env(safe-area-inset-bottom))] border-t border-gray-100 mt-3">
              <button onClick={() => setShowForm(false)} className="px-4 py-2 text-sm border rounded-lg hover:bg-gray-50">Cancel</button>
              <button onClick={handleSave} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700">Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
