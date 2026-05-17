"use client";

import { useState, useEffect } from "react";
import { hrApi, AttendanceZone } from "@/lib/hr-api";
import { useRbac } from "@/lib/rbac";
import toast, { Toaster } from "react-hot-toast";
import Link from "next/link";

const EMPTY: Partial<AttendanceZone> = { name: "", lat: 0, lng: 0, radiusMeters: 100, isActive: true };

export default function AttendanceZonesPage() {
  const rbac = useRbac();
  const [zones, setZones] = useState<AttendanceZone[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<Partial<AttendanceZone>>(EMPTY);
  const [editId, setEditId] = useState<number | null>(null);
  const [showForm, setShowForm] = useState(false);

  const load = async () => {
    setLoading(true);
    try { setZones(await hrApi.attendance.zones.list()); }
    catch { toast.error("Failed to load zones"); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const openCreate = () => { setForm(EMPTY); setEditId(null); setShowForm(true); };
  const openEdit = (z: AttendanceZone) => { setForm({ ...z }); setEditId(z.id); setShowForm(true); };

  const handleSave = async () => {
    if (!form.name || form.lat === undefined || form.lng === undefined) { toast.error("Name, lat, lng required"); return; }
    try {
      if (editId) { await hrApi.attendance.zones.update(editId, form); toast.success("Zone updated"); }
      else { await hrApi.attendance.zones.create({ name: form.name!, lat: form.lat!, lng: form.lng!, radiusMeters: form.radiusMeters }); toast.success("Zone created"); }
      setShowForm(false); load();
    } catch (e: any) { toast.error(e?.info?.message ?? "Save failed"); }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Delete this zone?")) return;
    try { await hrApi.attendance.zones.remove(id); toast.success("Deleted"); load(); }
    catch (e: any) { toast.error(e?.info?.message ?? "Delete failed"); }
  };

  const useCurrentLocation = () => {
    if (!navigator.geolocation) { toast.error("Geolocation not supported"); return; }
    navigator.geolocation.getCurrentPosition(
      (pos) => setForm((f) => ({ ...f, lat: pos.coords.latitude, lng: pos.coords.longitude })),
      () => toast.error("Could not get location"),
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

      {/* Form modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
          <div className="bg-white rounded-t-2xl sm:rounded-xl p-5 w-full sm:max-w-sm space-y-4 max-h-[90vh] overflow-y-auto">
            <h2 className="font-semibold text-lg">{editId ? "Edit" : "New"} Geo-Zone</h2>
            <div>
              <label className="text-sm font-medium">Zone Name</label>
              <input value={form.name ?? ""} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm mt-1" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium">Latitude</label>
                <input type="number" step="any" value={form.lat ?? 0} onChange={(e) => setForm((f) => ({ ...f, lat: parseFloat(e.target.value) }))} className="w-full border rounded-lg px-3 py-2 text-sm mt-1 font-mono" />
              </div>
              <div>
                <label className="text-sm font-medium">Longitude</label>
                <input type="number" step="any" value={form.lng ?? 0} onChange={(e) => setForm((f) => ({ ...f, lng: parseFloat(e.target.value) }))} className="w-full border rounded-lg px-3 py-2 text-sm mt-1 font-mono" />
              </div>
            </div>
            <button onClick={useCurrentLocation} className="text-sm text-blue-600 hover:underline">
              📍 Use my current location
            </button>
            <div>
              <label className="text-sm font-medium">Radius (metres)</label>
              <input type="number" min={10} value={form.radiusMeters ?? 100} onChange={(e) => setForm((f) => ({ ...f, radiusMeters: Number(e.target.value) }))} className="w-full border rounded-lg px-3 py-2 text-sm mt-1" />
            </div>
            <div className="flex items-center gap-2">
              <input id="za" type="checkbox" checked={form.isActive ?? true} onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))} className="rounded" />
              <label htmlFor="za" className="text-sm">Active</label>
            </div>
            <div className="flex gap-2 justify-end pt-2">
              <button onClick={() => setShowForm(false)} className="px-4 py-2 text-sm border rounded-lg hover:bg-gray-50">Cancel</button>
              <button onClick={handleSave} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700">Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
