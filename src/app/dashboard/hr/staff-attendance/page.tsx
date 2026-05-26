"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { hrApi, StaffAttendanceRecord, AttendanceBypassWindow, StaffBiometric, WebauthnRegistrationPermit, DailyAttendanceSummary } from "@/lib/hr-api";
import { useRbac } from "@/lib/rbac";
import toast, { Toaster } from "react-hot-toast";
import Link from "next/link";
import StaffPicker from "@/components/StaffPicker";
import StaffLookupForm from "@/components/StaffLookupForm";
import StaffAttendanceModal from "@/components/StaffAttendanceModal";
import { API_BASE_URL } from "@/lib/api";
import { authFetch } from "@/lib/auth";
import { InfoBanner } from "@/components/ui/InfoBanner";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
dayjs.extend(duration);

const PAGE_SIZE = 20;

function calcDuration(checkIn?: string, checkOut?: string): string | null {
  if (!checkIn || !checkOut) return null;
  const inMs = dayjs(`1970-01-01T${checkIn}`).valueOf();
  const outMs = dayjs(`1970-01-01T${checkOut}`).valueOf();
  if (outMs <= inMs) return null;
  const dur = dayjs.duration(outMs - inMs);
  const hh = String(Math.floor(dur.asHours())).padStart(2, "0");
  const mm = String(dur.minutes()).padStart(2, "0");
  const ss = String(dur.seconds()).padStart(2, "0");
  return `${hh}:${mm}:${ss}`;
}

const DURATION_TEXT: Record<string, string> = {
  PRESENT: "text-green-700 font-medium",
  LATE: "text-amber-700 font-medium",
  HALF_DAY: "text-blue-700 font-medium",
  ON_LEAVE: "text-purple-700",
  ABSENT: "text-red-500",
};

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

  // Pagination + server-side search
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);
  const [summary, setSummary] = useState<DailyAttendanceSummary>({ PRESENT: 0, LATE: 0, ABSENT: 0, HALF_DAY: 0, ON_LEAVE: 0, HOLIDAY: 0 });
  const [draftSearch, setDraftSearch] = useState({ name: "", mobile: "", employeeCode: "", staffId: "" });
  const [activeSearch, setActiveSearch] = useState({ name: "", mobile: "", employeeCode: "", staffId: "" });

  // Manual mark form
  const [showMark, setShowMark] = useState(false);
  const [markStaffId, setMarkStaffId] = useState<number | null>(null);
  const [markStaffLabel, setMarkStaffLabel] = useState<string>("");
  const [markSearchMode, setMarkSearchMode] = useState<"quick" | "explicit">("quick");
  const [markDate, setMarkDate] = useState<string>(today);
  const [markForm, setMarkForm] = useState({ status: "PRESENT", method: "MANUAL", checkInTime: "", checkOutTime: "", overrideReason: "" });

  // View-month modal
  const [viewStaff, setViewStaff] = useState<{ id: number; label: string } | null>(null);

  // Bypass form
  const [showBypass, setShowBypass] = useState(false);
  const [bypassForm, setBypassForm] = useState<{ reason: string; durationHours: number | string }>({ reason: "", durationHours: 8 });

  // Biometric management
  const [showBiometrics, setShowBiometrics] = useState(false);
  const [allCredentials, setAllCredentials] = useState<StaffBiometric[]>([]);
  const [permits, setPermits] = useState<WebauthnRegistrationPermit[]>([]);
  const [permitTargetId, setPermitTargetId] = useState<number | null>(null);
  const [bioLoading, setBioLoading] = useState(false);

  const loadRecords = useCallback(async () => {
    setLoading(true);
    try {
      const search = [activeSearch.name, activeSearch.mobile].filter(Boolean).join(" ").trim() || undefined;
      const [recs, bp] = await Promise.allSettled([
        hrApi.attendance.daily(date, {
          page: currentPage,
          limit: PAGE_SIZE,
          search,
          employeeCode: activeSearch.employeeCode || undefined,
          staffId: activeSearch.staffId || undefined,
        }),
        hrApi.attendance.bypass.getActive(),
      ]);
      if (recs.status === "fulfilled") {
        setRecords(recs.value.data);
        setTotalPages(recs.value.totalPages);
        setTotalRecords(recs.value.total);
        setSummary(recs.value.summary);
      }
      if (bp.status === "fulfilled") setBypass(bp.value);
    } catch { toast.error("Failed to load attendance"); }
    finally { setLoading(false); }
  }, [date, currentPage, activeSearch]);

  useEffect(() => { loadRecords(); }, [loadRecords]);
  // Reset to page 1 when date changes
  useEffect(() => { setCurrentPage(1); }, [date]);

  const handleMark = async () => {
    if (!markStaffId) { toast.error("Please select a staff member"); return; }
    if (!markDate) { toast.error("Please select a date"); return; }
    try {
      await hrApi.attendance.submit({
        staffId: markStaffId,
        date: markDate,
        method: markForm.method as any,
        status: markForm.status as any,
        checkInTime: markForm.checkInTime || undefined,
        checkOutTime: markForm.checkOutTime || undefined,
        overrideReason: markForm.overrideReason || undefined,
      });
      toast.success("Attendance marked");
      setShowMark(false);
      // If the marked date matches the page's currently-viewed date, refresh the daily list.
      if (markDate === date) {
        loadRecords();
      }
    } catch (e: any) { toast.error(e?.info?.message ?? "Failed"); }
  };

  const handleBypass = async () => {
    try {
      const bp = await hrApi.attendance.bypass.create({ ...bypassForm, durationHours: Math.min(Math.max(Number(bypassForm.durationHours) || 1, 1), 24) });
      setBypass(bp);
      toast.success("Bypass window created");
      setShowBypass(false);
    } catch (e: any) { toast.error(e?.info?.message ?? "Failed"); }
  };

  const handleCloseBypass = async () => {
    if (!confirm("Close the active bypass window? Geofence enforcement will resume immediately.")) return;
    try {
      await hrApi.attendance.bypass.close();
      setBypass(null);
      toast.success("Bypass window closed");
    } catch (e: any) { toast.error(e?.info?.message ?? "Failed to close bypass window"); }
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

  const present = summary.PRESENT + summary.LATE;
  const absent = summary.ABSENT;
  const hasActiveSearch = Boolean(activeSearch.name || activeSearch.mobile || activeSearch.employeeCode || activeSearch.staffId);

  const applySearch = () => {
    const next = { ...draftSearch };
    if (!next.name && !next.mobile && !next.employeeCode && !next.staffId) {
      toast("Enter at least one search field.");
      return;
    }
    setActiveSearch(next);
    setCurrentPage(1);
  };

  const clearSearch = () => {
    const empty = { name: "", mobile: "", employeeCode: "", staffId: "" };
    setDraftSearch(empty);
    setActiveSearch(empty);
    setCurrentPage(1);
  };

  const staffNameOf = (r: StaffAttendanceRecord) =>
    r.staff?.user ? `${r.staff.user.firstName} ${r.staff.user.lastName}` : `Staff #${r.staffId}`;

  const auditLabel = (r: StaffAttendanceRecord) => {
    switch (r.method) {
      case "WEBAUTHN":
        return r.markedBy ? `Biometric kiosk — by ${r.markedBy.firstName} ${r.markedBy.lastName}` : "Biometric kiosk";
      case "GEOFENCE":
        return "Self check-in (geo)";
      case "BYPASS":
        return r.markedBy ? `Bypass — by ${r.markedBy.firstName} ${r.markedBy.lastName}` : "Bypass (self)";
      case "MANUAL":
      default:
        return r.markedBy ? `Manual — by ${r.markedBy.firstName} ${r.markedBy.lastName}` : "Manual";
    }
  };

  return (
    <div className="p-3 sm:p-6 space-y-4">
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
          <Link href="/dashboard/hr/staff-attendance/devices" className="border border-gray-300 px-3 py-2 rounded-lg text-sm hover:bg-gray-50">
            Device Registrations
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
                {bypass ? "Bypass Active — Open New" : "Open Bypass Window"}
              </button>
              {bypass && (
                <button onClick={handleCloseBypass} className="border border-red-300 text-red-600 px-3 py-2 rounded-lg text-sm hover:bg-red-50">
                  Close Bypass Window
                </button>
              )}
              <button onClick={() => { setMarkDate(today); setShowMark(true); }} className="bg-blue-600 text-white px-3 py-2 rounded-lg text-sm font-medium hover:bg-blue-700">
                + Mark Manually
              </button>
            </>
          )}
        </div>
      </div>

      {/* Info Banner */}
      <InfoBanner title="About Staff Attendance">
        View daily attendance records for all staff. Staff can mark attendance via the <strong>WebAuthn Kiosk</strong> (fingerprint/face at main entrance) or through <strong>Geo-Fence check-in</strong> from their mobile.
        Use <strong>Mark Manually</strong> to record or override attendance (e.g., for a field visit).
        Open a <strong>Bypass Window</strong> to temporarily allow PIN-based marking when biometric devices are offline.
        Configure the allowed campus geo-zones via <strong>Geo-Zones</strong>.
      </InfoBanner>

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
      <div className="flex flex-wrap items-center gap-3">
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="border rounded-lg px-3 py-2 text-sm" />
        <span className="text-sm text-gray-600">Present: <strong className="text-green-700">{present}</strong></span>
        <span className="text-sm text-gray-600">Late: <strong className="text-amber-700">{summary.LATE}</strong></span>
        <span className="text-sm text-gray-600">Absent: <strong className="text-red-700">{absent}</strong></span>
        <span className="text-sm text-gray-600">Total: <strong>{totalRecords}</strong></span>
        {hasActiveSearch && (
          <span className="text-xs bg-blue-50 text-blue-700 border border-blue-200 rounded px-2 py-0.5">{totalRecords} result{totalRecords === 1 ? "" : "s"} for search</span>
        )}
      </div>

      {/* Multi-field search — fill any one or more, then click Search */}
      <form
        onSubmit={(e) => { e.preventDefault(); void applySearch(); }}
        className="bg-white border border-gray-200 rounded-xl p-3 sm:p-4"
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Name</label>
            <input
              type="text"
              value={draftSearch.name}
              onChange={(e) => setDraftSearch({ ...draftSearch, name: e.target.value })}
              placeholder="e.g. Rahul"
              className="w-full border rounded-lg px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Mobile Number</label>
            <input
              type="tel"
              value={draftSearch.mobile}
              onChange={(e) => setDraftSearch({ ...draftSearch, mobile: e.target.value })}
              placeholder="e.g. 9876543210"
              className="w-full border rounded-lg px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Employee Code</label>
            <input
              type="number"
              value={draftSearch.employeeCode}
              onChange={(e) => setDraftSearch({ ...draftSearch, employeeCode: e.target.value })}
              placeholder="e.g. 1024"
              className="w-full border rounded-lg px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Staff ID</label>
            <input
              type="number"
              value={draftSearch.staffId}
              onChange={(e) => setDraftSearch({ ...draftSearch, staffId: e.target.value })}
              placeholder="e.g. 17"
              className="w-full border rounded-lg px-3 py-2 text-sm"
            />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 mt-3">
          <button
            type="submit"
            className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg"
          >
            Search
          </button>
          <button
            type="button"
            onClick={clearSearch}
            className="border border-gray-300 hover:bg-gray-50 text-gray-700 text-sm font-medium px-4 py-2 rounded-lg"
          >
            Clear
          </button>
          <span className="text-xs text-gray-500">Fill any combination of fields and click Search.</span>
        </div>
      </form>

      {/* Records table */}
      {loading ? (
        <p className="text-sm text-gray-500">Loading…</p>
      ) : records.length === 0 ? (
        <p className="text-sm text-gray-500">{hasActiveSearch ? "No staff match your search." : "No attendance records for this date."}</p>
      ) : (
        <>
          {/* Mobile cards */}
          <div className="sm:hidden space-y-3">
            {records.map((r) => {
              const dur = calcDuration(r.checkInTime, r.checkOutTime);
              return (
                <div key={r.id} className="bg-white border border-gray-200 rounded-xl p-4 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-medium text-gray-900 text-sm truncate">{staffNameOf(r)}</p>
                      <p className="text-[11px] text-gray-500">
                        {r.staff?.employeeCode ? `EMP-${r.staff.employeeCode}` : `Staff #${r.staffId}`}
                        {r.staff?.user?.mobile ? ` · ${r.staff.user.mobile}` : ""}
                      </p>
                    </div>
                    <span className={`shrink-0 px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_STYLES[r.status] ?? "bg-gray-100"}`}>{r.status}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-gray-600">
                    <div><span className="text-gray-400">In: </span>{r.checkInTime ?? "—"}</div>
                    <div><span className="text-gray-400">Out: </span>{r.checkOutTime ?? "—"}</div>
                    {dur && <div className={`col-span-2 ${DURATION_TEXT[r.status] ?? "text-gray-600"}`}>⏱ {dur}</div>}
                    <div className="col-span-2"><span className="text-gray-400">Marked: </span>{auditLabel(r)}</div>
                  </div>
                  <button
                    onClick={() => setViewStaff({ id: r.staffId, label: staffNameOf(r) })}
                    className="text-blue-600 hover:underline text-xs font-medium"
                  >
                    View month →
                  </button>
                </div>
              );
            })}
          </div>

          {/* Tablet+ table */}
          <div className="hidden sm:block overflow-x-auto rounded-xl border border-gray-200">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 text-gray-600 text-xs uppercase">
                <tr>
                  <th className="px-4 py-3 text-left">Staff</th>
                  <th className="px-4 py-3 text-left">Status</th>
                  <th className="px-4 py-3 text-left">Check-In</th>
                  <th className="px-4 py-3 text-left">Check-Out</th>
                  <th className="px-4 py-3 text-left">Duration</th>
                  <th className="px-4 py-3 text-left">Marked By</th>
                  <th className="px-4 py-3 text-left">View</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {records.map((r) => {
                  const dur = calcDuration(r.checkInTime, r.checkOutTime);
                  return (
                    <tr key={r.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-900">{staffNameOf(r)}</div>
                        <div className="text-[11px] text-gray-500">
                          {r.staff?.employeeCode ? `EMP-${r.staff.employeeCode}` : `Staff #${r.staffId}`}
                          {r.staff?.user?.mobile ? ` · ${r.staff.user.mobile}` : ""}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_STYLES[r.status] ?? "bg-gray-100"}`}>{r.status}</span>
                      </td>
                      <td className="px-4 py-3 tabular-nums">{r.checkInTime ?? "—"}</td>
                      <td className="px-4 py-3 tabular-nums">{r.checkOutTime ?? "—"}</td>
                      <td className={`px-4 py-3 tabular-nums ${dur ? (DURATION_TEXT[r.status] ?? "text-gray-600") : "text-gray-400"}`}>{dur ?? "—"}</td>
                      <td className="px-4 py-3 text-xs text-gray-600">{auditLabel(r)}</td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => setViewStaff({ id: r.staffId, label: staffNameOf(r) })}
                          className="text-blue-600 hover:underline text-xs font-medium"
                        >
                          View
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination controls */}
          {totalPages > 1 && (
            <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
              <p className="text-xs text-gray-500">
                Page {currentPage} of {totalPages} &mdash; {totalRecords} record{totalRecords === 1 ? "" : "s"} total
              </p>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setCurrentPage(1)}
                  disabled={currentPage === 1}
                  className="px-2.5 py-1.5 text-xs border rounded-lg disabled:opacity-40 hover:bg-gray-50"
                  aria-label="First page"
                >
                  «
                </button>
                <button
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="px-3 py-1.5 text-xs border rounded-lg disabled:opacity-40 hover:bg-gray-50"
                >
                  Prev
                </button>
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  const start = Math.max(1, Math.min(currentPage - 2, totalPages - 4));
                  const pg = start + i;
                  return pg <= totalPages ? (
                    <button
                      key={pg}
                      onClick={() => setCurrentPage(pg)}
                      className={`px-3 py-1.5 text-xs border rounded-lg ${
                        pg === currentPage ? "bg-blue-600 text-white border-blue-600" : "hover:bg-gray-50"
                      }`}
                    >
                      {pg}
                    </button>
                  ) : null;
                })}
                <button
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="px-3 py-1.5 text-xs border rounded-lg disabled:opacity-40 hover:bg-gray-50"
                >
                  Next
                </button>
                <button
                  onClick={() => setCurrentPage(totalPages)}
                  disabled={currentPage === totalPages}
                  className="px-2.5 py-1.5 text-xs border rounded-lg disabled:opacity-40 hover:bg-gray-50"
                  aria-label="Last page"
                >
                  »
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Monthly view modal */}
      {viewStaff && (
        <StaffAttendanceModal
          staffId={viewStaff.id}
          staffLabel={viewStaff.label}
          onClose={() => setViewStaff(null)}
        />
      )}

      {/* Manual mark modal */}
      {showMark && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-sm space-y-4 max-h-[90vh] overflow-y-auto">
            <h2 className="font-semibold text-lg">Mark Attendance Manually</h2>

            {/* Search mode toggle */}
            <div className="flex gap-1 bg-gray-100 rounded-lg p-1 text-xs">
              <button
                type="button"
                onClick={() => setMarkSearchMode("quick")}
                className={`flex-1 py-1.5 rounded-md font-medium ${markSearchMode === "quick" ? "bg-white shadow text-gray-900" : "text-gray-500"}`}
              >
                Quick search
              </button>
              <button
                type="button"
                onClick={() => setMarkSearchMode("explicit")}
                className={`flex-1 py-1.5 rounded-md font-medium ${markSearchMode === "explicit" ? "bg-white shadow text-gray-900" : "text-gray-500"}`}
              >
                By code / ID / mobile
              </button>
            </div>

            {markSearchMode === "quick" ? (
              <StaffPicker
                label="Staff Member"
                value={markStaffId}
                onChange={(id, staff) => {
                  setMarkStaffId(id);
                  setMarkStaffLabel(staff ? `${staff.firstName} ${staff.lastName}` : "");
                }}
                required
              />
            ) : (
              <StaffLookupForm
                onResolved={(staff) => {
                  setMarkStaffId(staff.id);
                  setMarkStaffLabel(`${staff.firstName} ${staff.lastName}`);
                }}
                onClear={() => { setMarkStaffId(null); setMarkStaffLabel(""); }}
                selectedLabel={markStaffId && markStaffLabel ? markStaffLabel : null}
              />
            )}

            <div>
              <label className="text-sm font-medium">Date</label>
              <input
                type="date"
                value={markDate}
                max={today}
                onChange={(e) => setMarkDate(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm mt-1"
              />
              <p className="text-[11px] text-gray-500 mt-1">Defaults to today. Pick another date to back-date attendance.</p>
            </div>
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
              <input
                type="number"
                min={1}
                max={24}
                value={bypassForm.durationHours}
                onChange={(e) => {
                  const raw = e.target.value;
                  if (raw === "") {
                    setBypassForm((f) => ({ ...f, durationHours: "" }));
                  } else {
                    const num = parseInt(raw, 10);
                    if (!isNaN(num)) setBypassForm((f) => ({ ...f, durationHours: num }));
                  }
                }}
                onBlur={() => {
                  const num = Number(bypassForm.durationHours);
                  setBypassForm((f) => ({ ...f, durationHours: Math.min(Math.max(num || 1, 1), 24) }));
                }}
                className="w-full border rounded-lg px-3 py-2 text-sm mt-1"
              />
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
