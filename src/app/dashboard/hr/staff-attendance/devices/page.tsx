"use client";

import { useState, useEffect, useCallback } from "react";
import { hrApi, DeviceRegistrationRow } from "@/lib/hr-api";
import { useRbac } from "@/lib/rbac";
import toast, { Toaster } from "react-hot-toast";
import Link from "next/link";

const PAGE_SIZE = 25;

export default function DeviceRegistrationsPage() {
  const rbac = useRbac();

  const [rows, setRows]           = useState<DeviceRegistrationRow[]>([]);
  const [total, setTotal]         = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage]           = useState(1);
  const [loading, setLoading]     = useState(true);

  const [draft,  setDraft]  = useState({ name: "", mobile: "", employeeCode: "", staffId: "" });
  const [active, setActive] = useState({ name: "", mobile: "", employeeCode: "", staffId: "" });
  const [statusFilter, setStatusFilter] = useState<"all" | "registered" | "unregistered">("all");

  const [grantingId, setGrantingId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await hrApi.attendance.webauthn.deviceRegistrations({
        page, limit: PAGE_SIZE,
        name:         active.name         || undefined,
        mobile:       active.mobile       || undefined,
        employeeCode: active.employeeCode || undefined,
        staffId:      active.staffId      || undefined,
        status:       statusFilter,
      });
      setRows(res.data);
      setTotal(res.total);
      setTotalPages(res.totalPages);
    } catch {
      toast.error("Failed to load device registrations");
    } finally {
      setLoading(false);
    }
  }, [page, active, statusFilter]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setPage(1); }, [active, statusFilter]);

  const applySearch = () => setActive({ ...draft });
  const clearSearch = () => {
    const empty = { name: "", mobile: "", employeeCode: "", staffId: "" };
    setDraft(empty);
    setActive(empty);
  };

  const handleGrantPermit = async (staffId: number, name: string) => {
    setGrantingId(staffId);
    try {
      await hrApi.attendance.webauthn.grantPermit(staffId);
      toast.success(`Permit granted to ${name} (valid 48 h)`);
      load();
    } catch (e: any) {
      toast.error(e?.info?.message ?? "Failed to grant permit");
    } finally { setGrantingId(null); }
  };

  const handleDeleteDevice = async (biometricId: number, name: string) => {
    if (!confirm(`Remove the registered device for ${name}? They will need to re-register.`)) return;
    setDeletingId(biometricId);
    try {
      await hrApi.attendance.webauthn.deleteCredential(biometricId);
      toast.success(`Device removed for ${name}`);
      load();
    } catch (e: any) {
      toast.error(e?.info?.message ?? "Failed to remove device");
    } finally { setDeletingId(null); }
  };

  const hasSearch = Object.values(active).some(Boolean) || statusFilter !== "all";

  const STATUS_OPTIONS = [
    { value: "all",          label: "All",            activeClass: "bg-gray-700 border-gray-700 text-white" },
    { value: "registered",   label: "✓ Registered",   activeClass: "bg-green-600 border-green-600 text-white" },
    { value: "unregistered", label: "⚠ Not Registered", activeClass: "bg-amber-500 border-amber-500 text-white" },
  ] as const;

  return (
    <div className="p-3 sm:p-5 lg:p-6 space-y-4">
      <Toaster />

      {/* ── Header ─────────────────────────────────────────────────── */}
      <div>
        <Link href="/dashboard/hr/staff-attendance" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-2">
          ← Staff Attendance
        </Link>
        <h1 className="text-xl font-bold text-gray-900">Device Registrations</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Track which staff have registered a device for biometric self check-in.
        </p>
      </div>

      {/* ── Summary stat cards (3-col on all sizes, cards shrink gracefully) ── */}
      {!loading && (
        <div className="grid grid-cols-3 gap-2 sm:gap-3">
          {([
            { key: "all",          label: "Total Staff",    value: total,                                                                         activeRing: "ring-gray-400 bg-gray-100",   numClass: "text-gray-800"   },
            { key: "registered",   label: "Registered",     value: statusFilter === "registered" ? total : rows.filter(r => r.isRegistered).length,  activeRing: "ring-green-400 bg-green-100", numClass: "text-green-700"  },
            { key: "unregistered", label: "Not Registered", value: statusFilter === "unregistered" ? total : rows.filter(r => !r.isRegistered).length, activeRing: "ring-amber-400 bg-amber-100", numClass: "text-amber-700"  },
          ] as const).map(({ key, label, value, activeRing, numClass }) => (
            <div
              key={key}
              onClick={() => setStatusFilter(key)}
              className={`border rounded-xl px-3 py-2.5 sm:px-4 sm:py-3 cursor-pointer transition-all select-none
                ${statusFilter === key ? `${activeRing} ring-2` : "bg-white border-gray-200 hover:bg-gray-50"}`}
            >
              <p className={`text-xl sm:text-2xl font-bold leading-none ${numClass}`}>{value}</p>
              <p className="text-xs text-gray-500 mt-1 leading-tight">{label}{key !== "all" && statusFilter !== key ? <span className="hidden sm:inline"> (page)</span> : ""}</p>
            </div>
          ))}
        </div>
      )}

      {/* ── Search + filter form ───────────────────────────────────── */}
      <form
        onSubmit={(e) => { e.preventDefault(); applySearch(); }}
        className="bg-white border border-gray-200 rounded-xl p-3 sm:p-4 space-y-3"
      >
        {/* 4-field grid: 1-col mobile → 2-col tablet → 4-col desktop */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { key: "name",         label: "Name",          type: "text",   placeholder: "e.g. Rahul"      },
            { key: "mobile",       label: "Mobile Number", type: "tel",    placeholder: "e.g. 9876543210" },
            { key: "employeeCode", label: "Employee Code", type: "number", placeholder: "e.g. 1024"       },
            { key: "staffId",      label: "Staff ID",      type: "number", placeholder: "e.g. 17"         },
          ].map(({ key, label, type, placeholder }) => (
            <div key={key}>
              <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
              <input
                type={type}
                value={draft[key as keyof typeof draft]}
                onChange={(e) => setDraft({ ...draft, [key]: e.target.value })}
                placeholder={placeholder}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand/40"
              />
            </div>
          ))}
        </div>

        {/* Buttons + status pills — flex-wrap so they stack on narrow screens */}
        <div className="flex flex-wrap items-center gap-2">
          <button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg">
            Search
          </button>
          <button type="button" onClick={clearSearch} className="border border-gray-300 hover:bg-gray-50 text-gray-700 text-sm font-medium px-4 py-2 rounded-lg">
            Clear
          </button>
          {/* divider visible only when there's room */}
          <span className="hidden sm:inline text-gray-300">|</span>
          {/* Status pills — wrap onto new line on very narrow screens */}
          {STATUS_OPTIONS.map(({ value, label, activeClass }) => (
            <button
              key={value}
              type="button"
              onClick={() => setStatusFilter(value)}
              className={`text-xs px-3 py-1.5 rounded-full border font-medium transition-colors whitespace-nowrap
                ${statusFilter === value ? activeClass : "bg-white border-gray-300 text-gray-600 hover:bg-gray-50"}`}
            >
              {label}
            </button>
          ))}
        </div>
      </form>

      {/* ── Content ───────────────────────────────────────────────── */}
      {loading ? (
        <div className="bg-white border border-gray-200 rounded-xl p-10 text-center text-sm text-gray-400">Loading…</div>
      ) : rows.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-xl p-10 text-center text-sm text-gray-400">
          {hasSearch ? "No staff match your search / filter." : "No staff found."}
        </div>
      ) : (
        <>
          {/* ── Desktop / Tablet-landscape table (md = 768px+) ── */}
          <div className="hidden md:block bg-white border border-gray-200 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">Staff</th>
                    {/* Employee Code + Mobile hidden on tablet, shown on laptop+ */}
                    <th className="hidden lg:table-cell px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">Emp. Code</th>
                    <th className="hidden lg:table-cell px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">Mobile</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">Device</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">Registered On</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
                    {rbac.canManageHR && (
                      <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">Actions</th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {rows.map((row) => (
                    <tr key={row.staffId} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <p className="font-medium text-gray-900">{row.name}</p>
                        <p className="text-xs text-gray-400">#{row.staffId}</p>
                      </td>
                      <td className="hidden lg:table-cell px-4 py-3 text-gray-600 tabular-nums">{row.employeeCode ?? "—"}</td>
                      <td className="hidden lg:table-cell px-4 py-3 text-gray-600 tabular-nums">{row.mobile ?? "—"}</td>
                      <td className="px-4 py-3 text-gray-700 max-w-40 truncate" title={row.deviceName ?? undefined}>
                        {row.deviceName ?? <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-4 py-3 text-gray-500 tabular-nums text-xs whitespace-nowrap">
                        {row.registeredAt
                          ? new Date(row.registeredAt).toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" })
                          : <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-4 py-3">
                        {row.isRegistered
                          ? <span className="inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-full bg-green-100 text-green-700 whitespace-nowrap">✓ Registered</span>
                          : <span className="inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 whitespace-nowrap">⚠ Not Registered</span>}
                      </td>
                      {rbac.canManageHR && (
                        <td className="px-4 py-3 text-right">
                          <div className="flex justify-end gap-2 flex-wrap">
                            <button
                              onClick={() => handleGrantPermit(row.staffId, row.name)}
                              disabled={grantingId === row.staffId}
                              className="text-xs border border-indigo-300 text-indigo-600 hover:bg-indigo-50 disabled:opacity-50 px-2.5 py-1 rounded-lg transition-colors whitespace-nowrap"
                            >
                              {grantingId === row.staffId ? "Granting…" : "Grant Permit"}
                            </button>
                            {row.isRegistered && row.biometricId != null && (
                              <button
                                onClick={() => handleDeleteDevice(row.biometricId!, row.name)}
                                disabled={deletingId === row.biometricId}
                                className="text-xs border border-red-200 text-red-600 hover:bg-red-50 disabled:opacity-50 px-2.5 py-1 rounded-lg transition-colors whitespace-nowrap"
                              >
                                {deletingId === row.biometricId ? "Removing…" : "Remove Device"}
                              </button>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* ── Mobile + Tablet-portrait cards (< 768px) ── */}
          <div className="md:hidden space-y-2.5">
            {rows.map((row) => (
              <div key={row.staffId} className="bg-white border border-gray-200 rounded-xl p-4">
                {/* Top row: name + status badge */}
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-gray-900 truncate">{row.name}</p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {row.employeeCode ? `Code #${row.employeeCode}` : "No code"}
                      {row.mobile ? ` · ${row.mobile}` : ""}
                    </p>
                  </div>
                  {row.isRegistered
                    ? <span className="shrink-0 text-xs font-medium px-2 py-0.5 rounded-full bg-green-100 text-green-700 whitespace-nowrap">✓ Registered</span>
                    : <span className="shrink-0 text-xs font-medium px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 whitespace-nowrap">⚠ Not Registered</span>}
                </div>

                {/* Device info */}
                {row.isRegistered && (
                  <div className="mt-2 flex items-center gap-1.5 text-xs text-gray-500 bg-gray-50 rounded-lg px-3 py-2">
                    <span>📱</span>
                    <span className="font-medium text-gray-700">{row.deviceName || "Unnamed device"}</span>
                    {row.registeredAt && (
                      <span className="text-gray-400">
                        · {new Date(row.registeredAt).toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" })}
                      </span>
                    )}
                  </div>
                )}

                {/* Actions */}
                {rbac.canManageHR && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      onClick={() => handleGrantPermit(row.staffId, row.name)}
                      disabled={grantingId === row.staffId}
                      className="text-xs border border-indigo-300 text-indigo-600 hover:bg-indigo-50 disabled:opacity-50 px-3 py-1.5 rounded-lg transition-colors"
                    >
                      {grantingId === row.staffId ? "Granting…" : "Grant Permit"}
                    </button>
                    {row.isRegistered && row.biometricId != null && (
                      <button
                        onClick={() => handleDeleteDevice(row.biometricId!, row.name)}
                        disabled={deletingId === row.biometricId}
                        className="text-xs border border-red-200 text-red-600 hover:bg-red-50 disabled:opacity-50 px-3 py-1.5 rounded-lg transition-colors"
                      >
                        {deletingId === row.biometricId ? "Removing…" : "Remove Device"}
                      </button>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* ── Pagination ── */}
          {totalPages > 1 && (
            <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-gray-500 pt-1">
              <span>{total} staff · page {page} of {totalPages}</span>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="border rounded-lg px-3 py-1.5 hover:bg-gray-50 disabled:opacity-40 transition-colors"
                >
                  ← Prev
                </button>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="border rounded-lg px-3 py-1.5 hover:bg-gray-50 disabled:opacity-40 transition-colors"
                >
                  Next →
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}


