"use client";

import { useState, useEffect, useCallback } from "react";
import { hrApi, StaffAttendanceRecord, AttendanceBypassWindow, StaffBiometric, WebauthnRegistrationPermit } from "@/lib/hr-api";
import { useRbac } from "@/lib/rbac";
import toast, { Toaster } from "react-hot-toast";
import Link from "next/link";
import StaffPicker from "@/components/StaffPicker";

const STATUS_STYLES: Record<string, string> = {
  PRESENT: "bg-green-100 text-green-700",
  LATE: "bg-amber-100 text-amber-700",
  ABSENT: "bg-red-100 text-red-700",
  HALF_DAY: "bg-blue-100 text-blue-700",
  ON_LEAVE: "bg-purple-100 text-purple-700",
  HOLIDAY: "bg-gray-100 text-gray-600",
};

export default function StaffAttendancePage() {
  const rbac = useRbac();
  const today = new Date().toISOString().slice(0, 10);

  const [date, setDate] = useState(today);
  const [records, setRecords] = useState<StaffAttendanceRecord[]>([]);
  const [bypass, setBypass] = useState<AttendanceBypassWindow | null>(null);
  const [loading, setLoading] = useState(true);

  // Manual mark form
  const [showMark, setShowMark] = useState(false);
  const [markStaffId, setMarkStaffId] = useState<number | null>(null);
  const [markForm, setMarkForm] = useState({ status: "PRESENT", method: "MANUAL", checkInTime: "", checkOutTime: "", overrideReason: "" });

  // Bypass form
  const [showBypass, setShowBypass] = useState(false);
  const [bypassForm, setBypassForm] = useState({ reason: "", durationHours: 8 });

  // Biometric management
  const [showBiometrics, setShowBiometrics] = useState(false);
  const [allCredentials, setAllCredentials] = useState<StaffBiometric[]>([]);
  const [permits, setPermits] = useState<WebauthnRegistrationPermit[]>([]);
  const [permitTargetId, setPermitTargetId] = useState<number | null>(null);
  const [bioLoading, setBioLoading] = useState(false);

  const loadRecords = useCallback(async () => {
    setLoading(true);
    try {
      const [recs, bp] = await Promise.allSettled([
        hrApi.attendance.daily(date),
        hrApi.attendance.bypass.getActive(),
      ]);
      if (recs.status === "fulfilled") setRecords(recs.value);
      if (bp.status === "fulfilled") setBypass(bp.value);
    } catch { toast.error("Failed to load attendance"); }
    finally { setLoading(false); }
  }, [date]);

  useEffect(() => { loadRecords(); }, [loadRecords]);

  const handleMark = async () => {
    if (!markStaffId) { toast.error("Please select a staff member"); return; }
    try {
      await hrApi.attendance.submit({
        staffId: markStaffId,
        date,
        method: markForm.method as any,
        status: markForm.status as any,
        checkInTime: markForm.checkInTime || undefined,
        checkOutTime: markForm.checkOutTime || undefined,
        overrideReason: markForm.overrideReason || undefined,
      });
      toast.success("Attendance marked");
      setShowMark(false);
      loadRecords();
    } catch (e: any) { toast.error(e?.info?.message ?? "Failed"); }
  };

  const handleBypass = async () => {
    try {
      const bp = await hrApi.attendance.bypass.create(bypassForm);
      setBypass(bp);
      toast.success("Bypass window created");
      setShowBypass(false);
    } catch (e: any) { toast.error(e?.info?.message ?? "Failed"); }
  };

  const loadBiometrics = useCallback(async () => {
    setBioLoading(true);
    try {
      const [creds, perms] = await Promise.all([
        hrApi.attendance.webauthn.allCredentials(),
        hrApi.attendance.webauthn.listPermits(),
      ]);
      setAllCredentials(creds);
      setPermits(perms);
    } catch { toast.error("Failed to load biometric data"); }
    finally { setBioLoading(false); }
  }, []);

  const handleGrantPermit = async () => {
    if (!permitTargetId) { toast.error("Select a staff member"); return; }
    try {
      await hrApi.attendance.webauthn.grantPermit(permitTargetId);
      toast.success("Registration permission granted (48 hours)");
      setPermitTargetId(null);
      loadBiometrics();
    } catch (e: any) { toast.error(e?.info?.message ?? "Failed"); }
  };

  const handleRevokePermit = async (staffId: number) => {
    try {
      await hrApi.attendance.webauthn.revokePermitByStaff(staffId);
      toast.success("Permission revoked");
      loadBiometrics();
    } catch { toast.error("Failed to revoke"); }
  };

  const handleDeleteCredential = async (id: number) => {
    if (!confirm("Delete this biometric credential? The staff member will need to re-register.")) return;
    try {
      await hrApi.attendance.webauthn.deleteCredential(id);
      toast.success("Credential deleted");
      loadBiometrics();
    } catch { toast.error("Failed to delete"); }
  };

  const present = records.filter((r) => ["PRESENT", "LATE"].includes(r.status)).length;  const absent = records.filter((r) => r.status === "ABSENT").length;

  return (
    <div className="p-6 space-y-4">
      <Toaster />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-bold text-gray-900">Staff Attendance</h1>
        <div className="flex gap-2 flex-wrap">
          <Link href="/dashboard/hr/staff-attendance/kiosk" className="border border-gray-300 px-3 py-2 rounded-lg text-sm hover:bg-gray-50">
            Kiosk Mode
          </Link>
          <Link href="/dashboard/hr/staff-attendance/zones" className="border border-gray-300 px-3 py-2 rounded-lg text-sm hover:bg-gray-50">
            Geo-Zones
          </Link>
          {rbac.canManageHR && (
            <>
              <button
                onClick={() => { setShowBiometrics((v) => !v); if (!showBiometrics) loadBiometrics(); }}
                className="border border-indigo-300 text-indigo-700 px-3 py-2 rounded-lg text-sm hover:bg-indigo-50"
              >
                Biometrics
              </button>
              <button onClick={() => setShowBypass(true)} className="border border-amber-400 text-amber-700 px-3 py-2 rounded-lg text-sm hover:bg-amber-50">
                {bypass ? "Bypass Active" : "Open Bypass Window"}
              </button>
              <button onClick={() => setShowMark(true)} className="bg-blue-600 text-white px-3 py-2 rounded-lg text-sm font-medium hover:bg-blue-700">
                + Mark Manually
              </button>
            </>
          )}
        </div>
      </div>

      {/* Info Banner */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h2 className="text-sm font-semibold text-blue-900 mb-1">About Staff Attendance</h2>
        <p className="text-xs text-blue-800 leading-relaxed">
          View daily attendance records for all staff. Staff can mark attendance via the <strong>WebAuthn Kiosk</strong> (fingerprint/face at main entrance) or through <strong>Geo-Fence check-in</strong> from their mobile.
          Use <strong>Mark Manually</strong> to record or override attendance (e.g., for a field visit).
          Open a <strong>Bypass Window</strong> to temporarily allow PIN-based marking when biometric devices are offline.
          Configure the allowed campus geo-zones via <strong>Geo-Zones</strong>.
        </p>
      </div>

      {/* Bypass info */}
      {bypass && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800">
          Bypass window active — expires {new Date(bypass.expiresAt).toLocaleString()}. Staff can mark attendance without biometrics.
        </div>
      )}

      {/* Biometric management panel */}
      {showBiometrics && rbac.canManageHR && (
        <div className="border border-indigo-200 rounded-xl overflow-hidden">
          <div className="bg-indigo-50 px-5 py-3 flex items-center justify-between">
            <p className="text-sm font-semibold text-indigo-900">Biometric Device Management</p>
            <button onClick={() => setShowBiometrics(false)} className="text-indigo-400 hover:text-indigo-700 text-xs">Close ✕</button>
          </div>
          <div className="p-5 space-y-5 bg-white">
            {bioLoading ? <p className="text-sm text-gray-500">Loading…</p> : (
              <>
                {/* Grant registration permission */}
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-gray-700 uppercase tracking-wide">Allow Device Registration</p>
                  <p className="text-xs text-gray-500">Select a staff member to allow them to register their device for 48 hours. Once they register, the permission is consumed automatically.</p>
                  <div className="flex gap-2 items-end">
                    <div className="flex-1">
                      <StaffPicker label="Staff Member" value={permitTargetId} onChange={(id) => setPermitTargetId(id)} />
                    </div>
                    <button onClick={handleGrantPermit} className="bg-indigo-600 text-white text-sm px-4 py-2 rounded-lg hover:bg-indigo-700 whitespace-nowrap">
                      Grant Permission
                    </button>
                  </div>
                </div>

                {/* Active permits */}
                {permits.filter((p) => !p.usedAt && new Date(p.expiresAt) > new Date()).length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-semibold text-gray-700 uppercase tracking-wide">Active Permissions</p>
                    <div className="space-y-1.5">
                      {permits
                        .filter((p) => !p.usedAt && new Date(p.expiresAt) > new Date())
                        .map((p) => (
                          <div key={p.id} className="flex items-center justify-between bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
                            <div>
                              <p className="text-xs font-medium text-amber-800">Staff ID #{p.staffId}</p>
                              <p className="text-xs text-amber-600">Expires {new Date(p.expiresAt).toLocaleString()}</p>
                            </div>
                            <button onClick={() => handleRevokePermit(p.staffId)} className="text-red-500 hover:text-red-700 text-xs">Revoke</button>
                          </div>
                        ))}
                    </div>
                  </div>
                )}

                {/* Registered credentials */}
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-gray-700 uppercase tracking-wide">
                    Registered Devices ({allCredentials.length})
                  </p>
                  {allCredentials.length === 0 ? (
                    <p className="text-xs text-gray-400">No devices registered yet. Grant permission to a staff member so they can register from My Attendance.</p>
                  ) : (
                    <div className="space-y-1.5">
                      {allCredentials.map((c) => (
                        <div key={c.id} className="flex items-center justify-between border border-gray-200 rounded-lg px-3 py-2">
                          <div>
                            <p className="text-sm font-medium text-gray-800">
                              {c.staff?.user
                                ? `${c.staff.user.firstName} ${c.staff.user.lastName} (#${c.staff.employeeCode})`
                                : `Staff #${c.staffId}`}
                            </p>
                            <p className="text-xs text-gray-400">
                              {c.deviceName || "Unnamed"} — registered {new Date(c.registeredAt).toLocaleDateString()}
                            </p>
                          </div>
                          <button onClick={() => handleDeleteCredential(c.id)} className="text-red-500 hover:text-red-700 text-xs ml-4">Delete</button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Date picker + stats */}
      <div className="flex items-center gap-4">
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="border rounded-lg px-3 py-2 text-sm" />
        <span className="text-sm text-gray-600">Present: <strong className="text-green-700">{present}</strong></span>
        <span className="text-sm text-gray-600">Absent: <strong className="text-red-700">{absent}</strong></span>
        <span className="text-sm text-gray-600">Total: <strong>{records.length}</strong></span>
      </div>

      {/* Records table */}
      {loading ? (
        <p className="text-sm text-gray-500">Loading…</p>
      ) : records.length === 0 ? (
        <p className="text-sm text-gray-500">No attendance records for this date.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-200">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-gray-600 text-xs uppercase">
              <tr>
                <th className="px-4 py-3 text-left">Staff ID</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-left">Method</th>
                <th className="px-4 py-3 text-left">Check-In</th>
                <th className="px-4 py-3 text-left">Check-Out</th>
                <th className="px-4 py-3 text-left">Zone</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {records.map((r) => (
                <tr key={r.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">#{r.staffId}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_STYLES[r.status] ?? "bg-gray-100"}`}>{r.status}</span>
                  </td>
                  <td className="px-4 py-3 text-gray-500">{r.method}</td>
                  <td className="px-4 py-3">{r.checkInTime ?? "—"}</td>
                  <td className="px-4 py-3">{r.checkOutTime ?? "—"}</td>
                  <td className="px-4 py-3">{r.matchedZoneId ? `Zone #${r.matchedZoneId}` : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Manual mark modal */}
      {showMark && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-sm space-y-4">
            <h2 className="font-semibold text-lg">Mark Attendance Manually</h2>
            <StaffPicker
              label="Staff Member"
              value={markStaffId}
              onChange={(id) => setMarkStaffId(id)}
              required
            />
            <div>
              <label className="text-sm font-medium">Status</label>
              <select value={markForm.status} onChange={(e) => setMarkForm((f) => ({ ...f, status: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm mt-1">
                {["PRESENT","ABSENT","LATE","HALF_DAY","ON_LEAVE"].map((s) => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium">Check-In</label>
                <input type="time" value={markForm.checkInTime} onChange={(e) => setMarkForm((f) => ({ ...f, checkInTime: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm mt-1" />
              </div>
              <div>
                <label className="text-sm font-medium">Check-Out</label>
                <input type="time" value={markForm.checkOutTime} onChange={(e) => setMarkForm((f) => ({ ...f, checkOutTime: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm mt-1" />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium">Override Reason (optional)</label>
              <input value={markForm.overrideReason} onChange={(e) => setMarkForm((f) => ({ ...f, overrideReason: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm mt-1" />
            </div>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setShowMark(false)} className="px-4 py-2 text-sm border rounded-lg hover:bg-gray-50">Cancel</button>
              <button onClick={handleMark} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700">Mark</button>
            </div>
          </div>
        </div>
      )}

      {/* Bypass window modal */}
      {showBypass && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-sm space-y-4">
            <h2 className="font-semibold text-lg">Open Bypass Window</h2>
            <p className="text-sm text-gray-600">During a bypass window, staff can mark attendance without biometrics (e.g., device maintenance).</p>
            <div>
              <label className="text-sm font-medium">Duration (hours)</label>
              <input type="number" min={1} max={24} value={bypassForm.durationHours} onChange={(e) => setBypassForm((f) => ({ ...f, durationHours: Number(e.target.value) }))} className="w-full border rounded-lg px-3 py-2 text-sm mt-1" />
            </div>
            <div>
              <label className="text-sm font-medium">Reason (optional)</label>
              <input value={bypassForm.reason} onChange={(e) => setBypassForm((f) => ({ ...f, reason: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm mt-1" />
            </div>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setShowBypass(false)} className="px-4 py-2 text-sm border rounded-lg hover:bg-gray-50">Cancel</button>
              <button onClick={handleBypass} className="px-4 py-2 text-sm bg-amber-600 text-white rounded-lg hover:bg-amber-700">Activate</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
