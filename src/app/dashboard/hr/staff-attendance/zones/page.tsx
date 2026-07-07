"use client";

import { useState, useEffect } from "react";
import { hrApi, AttendanceZone } from "@/lib/hr-api";
import { useRbac } from "@/lib/rbac";
import toast, { Toaster } from "react-hot-toast";
import Link from "next/link";

// Form state keeps numeric fields as strings while the user is typing
// so empty values are valid (avoids NaN warnings) and the leading "0"
// can be cleared cleanly on mobile keyboards.
type ZoneFormState = {
  name: string;
  latStr: string;
  lngStr: string;
  radiusStr: string;
  isActive: boolean;
};

type ZoneFormErrors = {
  name?: string;
  lat?: string;
  lng?: string;
  radius?: string;
};

const EMPTY_FORM: ZoneFormState = {
  name: "",
  latStr: "",
  lngStr: "",
  radiusStr: "",
  isActive: true,
};

export default function AttendanceZonesPage() {
  const rbac = useRbac();
  const [zones, setZones] = useState<AttendanceZone[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<ZoneFormState>(EMPTY_FORM);
  const [formErrors, setFormErrors] = useState<ZoneFormErrors>({});
  const [locationWarning, setLocationWarning] = useState<string | null>(null);
  const [editId, setEditId] = useState<number | null>(null);
  const [showForm, setShowForm] = useState(false);

  const load = async () => {
    setLoading(true);
    try { setZones(await hrApi.attendance.zones.list()); }
    catch { toast.error("Failed to load zones"); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const openCreate = () => { setForm(EMPTY_FORM); setFormErrors({}); setLocationWarning(null); setEditId(null); setShowForm(true); };
  const openEdit = (z: AttendanceZone) => {
    setForm({
      name: z.name ?? "",
      latStr: z.lat !== undefined && z.lat !== null ? String(z.lat) : "",
      lngStr: z.lng !== undefined && z.lng !== null ? String(z.lng) : "",
      radiusStr: z.radiusMeters !== undefined && z.radiusMeters !== null ? String(z.radiusMeters) : "",
      isActive: z.isActive ?? true,
    });
    setFormErrors({});
    setLocationWarning(null);
    setEditId(z.id);
    setShowForm(true);
  };

  const handleSave = async () => {
    const name = form.name.trim();
    const lat = form.latStr.trim() === "" ? NaN : parseFloat(form.latStr);
    const lng = form.lngStr.trim() === "" ? NaN : parseFloat(form.lngStr);
    const radius = form.radiusStr.trim() === "" ? undefined : Number(form.radiusStr);

    const errors: ZoneFormErrors = {};
    if (!name) errors.name = "Zone name is required";
    if (form.latStr.trim() === "") errors.lat = "Latitude is required";
    else if (!Number.isFinite(lat) || lat < -90 || lat > 90) errors.lat = "Must be a number between -90 and 90";
    if (form.lngStr.trim() === "") errors.lng = "Longitude is required";
    else if (!Number.isFinite(lng) || lng < -180 || lng > 180) errors.lng = "Must be a number between -180 and 180";
    if (radius !== undefined && (!Number.isFinite(radius) || radius < 10)) errors.radius = "Radius must be at least 10 metres";

    if (Object.keys(errors).length > 0) { setFormErrors(errors); return; }
    setFormErrors({});

    try {
      if (editId) {
        await hrApi.attendance.zones.update(editId, {
          name,
          lat,
          lng,
          radiusMeters: radius,
          isActive: form.isActive,
        });
        toast.success("Zone updated");
      } else {
        await hrApi.attendance.zones.create({ name, lat, lng, radiusMeters: radius });
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

  const useCurrentLocation = () => {
    if (!navigator.geolocation) {
      setLocationWarning("Geolocation is not supported by this browser.");
      return;
    }
    setLocationWarning(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocationWarning(null);
        setForm((f) => ({
          ...f,
          latStr: String(pos.coords.latitude),
          lngStr: String(pos.coords.longitude),
        }));
        setFormErrors((e) => ({ ...e, lat: undefined, lng: undefined }));
      },
      (err) => {
        if (err.code === 1 /* PERMISSION_DENIED */) {
          setLocationWarning(
            "Location permission denied. To use this feature, allow location access in your browser settings (usually the lock icon in the address bar), then reload the page.",
          );
        } else if (err.code === 2 /* POSITION_UNAVAILABLE */) {
          setLocationWarning("Location unavailable. Make sure your device's GPS/location service is turned on.");
        } else {
          setLocationWarning("Could not get your location. Please try again or enter coordinates manually.");
        }
      },
    );
  };

  return (
    <div className="p-3 sm:p-6 space-y-4">
      <Toaster />
      <div className="flex items-center gap-3">
        <Link href="/dashboard/hr/staff-attendance" className="text-gray-400 hover:text-gray-700 transition-colors" title="Back to Staff Attendance">
          ← Back
        </Link>
        <h1 className="text-xl font-bold text-gray-900">Attendance Geo-Zones</h1>
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
          Geo-zones define the <strong>physical boundaries</strong> of your campus or allowed check-in locations using GPS coordinates.
          Each zone has a <strong>center point</strong> (latitude/longitude) and a <strong>radius in meters</strong>.
          When staff use geolocation-based check-in from their mobile, the system verifies they are within at least one active zone.
          Add a zone for your school&apos;s main campus by clicking <strong>New Zone</strong> and using the <em>Use my current location</em> button for automatic coordinate detection.
          For a typical school, a radius of <strong>100–200 metres</strong> works well.
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
                  <div className="text-gray-500">Radius: {z.radiusMeters}m</div>
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
                  <th className="px-4 py-3 text-left">Radius (m)</th>
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
                    <td className="px-4 py-3">{z.radiusMeters}</td>
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
        <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-[80] p-0 sm:p-4">
          <div className="bg-white rounded-t-2xl sm:rounded-xl w-full sm:max-w-sm flex flex-col max-h-[85dvh]">
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
              <button onClick={useCurrentLocation} className="text-sm text-blue-600 hover:underline">
                📍 Use my current location
              </button>
              {locationWarning && (
                <div className="mt-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs text-amber-800">
                  {locationWarning}
                </div>
              )}
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
