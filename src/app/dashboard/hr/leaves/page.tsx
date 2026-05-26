"use client";

import { useState, useEffect, useCallback } from "react";
import { hrApi, StaffLeaveApplication, StaffLeaveBalance, StaffLeavePolicy, StaffLeaveStatus } from "@/lib/hr-api";
import { useRbac } from "@/lib/rbac";
import { getUser } from "@/lib/auth";
import toast, { Toaster } from "react-hot-toast";
import StaffPicker, { StaffResult } from "@/components/StaffPicker";
import { InfoBanner } from "@/components/ui/InfoBanner";

const STATUS_STYLES: Record<StaffLeaveStatus, string> = {
  PENDING: "bg-amber-100 text-amber-700 border-amber-200",
  APPROVED: "bg-green-100 text-green-700 border-green-200",
  REJECTED: "bg-red-100 text-red-700 border-red-200",
  CANCELLED: "bg-gray-100 text-gray-600 border-gray-200",
};

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const now = new Date();

export default function StaffLeavesPage() {
  const rbac = useRbac();
  const user = getUser();

  const [leaves, setLeaves] = useState<StaffLeaveApplication[]>([]);
  const [policies, setPolicies] = useState<StaffLeavePolicy[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<StaffLeaveStatus | "">("");
  const [filterMonth, setFilterMonth] = useState(now.getMonth() + 1);
  const [filterYear, setFilterYear] = useState(now.getFullYear());

  // Apply form state
  const [showApply, setShowApply] = useState(false);
  const [applyForm, setApplyForm] = useState({
    staffId: user?.staffId ?? "",
    leavePolicyId: "",
    fromDate: "",
    toDate: "",
    leaveDuration: "FULL_DAY" as "FULL_DAY" | "HALF_DAY",
    reason: "",
  });

  // Selected staff for apply form
  const [applyStaff, setApplyStaff] = useState<StaffResult | null>(null);

  // Reject modal
  const [rejectId, setRejectId] = useState<number | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  const loadLeaves = useCallback(async () => {
    setLoading(true);
    try {
      // Non-HR staff: use self-service endpoint (staffId derived from JWT on backend)
      if (!rbac.canAccessHR) {
        const data = await hrApi.leaves.myLeaves({ status: filterStatus || undefined, year: filterYear });
        setLeaves(data);
      } else {
        const params: any = { month: filterMonth, year: filterYear };
        if (filterStatus) params.status = filterStatus;
        const data = await hrApi.leaves.list(params);
        setLeaves(data);
      }
    } catch { toast.error("Failed to load leaves"); }
    finally { setLoading(false); }
  }, [filterMonth, filterYear, filterStatus, rbac.canAccessHR, user?.staffId]);

  useEffect(() => {
    hrApi.leavePolicies.list().then(setPolicies).catch(() => {});
    loadLeaves();
  }, [loadLeaves]);

  const handleApply = async () => {
    if (!applyForm.staffId || !applyForm.leavePolicyId || !applyForm.fromDate || !applyForm.toDate || !applyForm.reason) {
      toast.error("Please fill all required fields"); return;
    }
    try {
      await hrApi.leaves.apply({ ...applyForm, staffId: Number(applyForm.staffId), leavePolicyId: Number(applyForm.leavePolicyId) });
      toast.success("Leave applied"); setShowApply(false); loadLeaves();
    } catch (e: any) { toast.error(e?.info?.message ?? "Failed to apply leave"); }
  };

  const handleApprove = async (id: number) => {
    try { await hrApi.leaves.approve(id); toast.success("Leave approved"); loadLeaves(); }
    catch (e: any) { toast.error(e?.info?.message ?? "Failed"); }
  };

  const handleReject = async () => {
    if (!rejectId) return;
    try { await hrApi.leaves.reject(rejectId, rejectReason); toast.success("Leave rejected"); setRejectId(null); setRejectReason(""); loadLeaves(); }
    catch (e: any) { toast.error(e?.info?.message ?? "Failed"); }
  };

  const handleCancel = async (id: number) => {
    if (!confirm("Cancel this leave application?")) return;
    try { await hrApi.leaves.cancel(id); toast.success("Leave cancelled"); loadLeaves(); }
    catch (e: any) { toast.error(e?.info?.message ?? "Failed"); }
  };

  return (
    <div className="p-3 sm:p-6 space-y-4">
      <Toaster />
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">Staff Leaves</h1>
        <button onClick={() => setShowApply(true)} className="bg-blue-600 text-white px-3 py-2 sm:px-4 rounded-lg text-sm font-medium hover:bg-blue-700">
          + Apply Leave
        </button>
      </div>

      {/* Info Banner */}
      <InfoBanner title="About Staff Leave Management">
        This page lets HR admins view, approve, reject, or cancel leave applications for all staff.
        Staff apply for leave themselves via <strong>My Leaves</strong>; HR admins can also apply on their behalf using the button above.
        If a staff member exhausts their leave balance, the excess days are automatically marked as <strong>Loss of Pay (LOP)</strong> and deducted from payroll.
        Use the month/year filter to view historical records.
      </InfoBanner>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <select value={filterMonth} onChange={(e) => setFilterMonth(Number(e.target.value))} className="border rounded-lg px-3 py-2 text-sm">
          {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
        </select>
        <select value={filterYear} onChange={(e) => setFilterYear(Number(e.target.value))} className="border rounded-lg px-3 py-2 text-sm">
          {[now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1].map((y) => <option key={y}>{y}</option>)}
        </select>
        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value as any)} className="border rounded-lg px-3 py-2 text-sm">
          <option value="">All Status</option>
          {(["PENDING","APPROVED","REJECTED","CANCELLED"] as StaffLeaveStatus[]).map((s) => <option key={s}>{s}</option>)}
        </select>
        <button onClick={loadLeaves} className="bg-gray-100 border rounded-lg px-3 py-2 text-sm hover:bg-gray-200">Refresh</button>
      </div>

      {/* Table */}
      {loading ? (
        <p className="text-sm text-gray-500">Loading…</p>
      ) : leaves.length === 0 ? (
        <p className="text-sm text-gray-500">No leave applications found.</p>
      ) : (
        <>
          {/* Mobile cards */}
          <div className="sm:hidden space-y-3">
            {leaves.map((l) => (
              <div key={l.id} className="bg-white border border-gray-200 rounded-xl p-4 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-medium text-gray-900 text-sm">{rbac.canAccessHR ? `Staff #${l.staffId} — ` : ""}{l.leavePolicy?.name ?? `#${l.leavePolicyId}`}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{l.fromDate} → {l.toDate} · {l.leaveDays}d{l.isLop ? ` (LOP:${l.lopDays}d)` : ""}</p>
                  </div>
                  <span className={`shrink-0 px-2 py-0.5 rounded-full text-xs font-medium border ${STATUS_STYLES[l.status]}`}>{l.status}</span>
                </div>
                {rbac.canAccessHR && (
                  <div className="flex gap-3">
                    {l.status === "PENDING" && (
                      <>
                        <button onClick={() => handleApprove(l.id)} className="text-green-600 hover:underline text-xs">Approve</button>
                        <button onClick={() => { setRejectId(l.id); setRejectReason(""); }} className="text-red-600 hover:underline text-xs">Reject</button>
                      </>
                    )}
                    {["PENDING","APPROVED"].includes(l.status) && (
                      <button onClick={() => handleCancel(l.id)} className="text-gray-500 hover:underline text-xs">Cancel</button>
                    )}
                  </div>
                )}
                {!rbac.canAccessHR && ["PENDING","APPROVED"].includes(l.status) && (
                  <button onClick={() => handleCancel(l.id)} className="text-red-500 hover:underline text-xs">Cancel application</button>
                )}
              </div>
            ))}
          </div>

          {/* Tablet+ table */}
          <div className="hidden sm:block overflow-x-auto rounded-xl border border-gray-200">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 text-gray-600 text-xs uppercase">
                <tr>
                  {rbac.canAccessHR && <th className="px-4 py-3 text-left">Staff</th>}
                  <th className="px-4 py-3 text-left">Leave Type</th>
                  <th className="px-4 py-3 text-left">Period</th>
                  <th className="px-4 py-3 text-left">Days</th>
                  <th className="px-4 py-3 text-left">Status</th>
                  <th className="px-4 py-3 text-left">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {leaves.map((l) => (
                  <tr key={l.id} className="hover:bg-gray-50">
                    {rbac.canAccessHR && <td className="px-4 py-3">#{l.staffId}</td>}
                    <td className="px-4 py-3">{l.leavePolicy?.name ?? `#${l.leavePolicyId}`}</td>
                    <td className="px-4 py-3">{l.fromDate} → {l.toDate}</td>
                    <td className="px-4 py-3">{l.leaveDays}{l.isLop ? <span className="ml-1 text-red-500 text-xs">(LOP:{l.lopDays}d)</span> : null}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${STATUS_STYLES[l.status]}`}>{l.status}</span>
                    </td>
                    <td className="px-4 py-3 flex gap-2">
                      {rbac.canAccessHR ? (
                        <>
                          {l.status === "PENDING" && (
                            <>
                              <button onClick={() => handleApprove(l.id)} className="text-green-600 hover:underline text-xs">Approve</button>
                              <button onClick={() => { setRejectId(l.id); setRejectReason(""); }} className="text-red-600 hover:underline text-xs">Reject</button>
                            </>
                          )}
                          {["PENDING","APPROVED"].includes(l.status) && (
                            <button onClick={() => handleCancel(l.id)} className="text-gray-500 hover:underline text-xs">Cancel</button>
                          )}
                        </>
                      ) : (
                        ["PENDING","APPROVED"].includes(l.status) && (
                          <button onClick={() => handleCancel(l.id)} className="text-gray-500 hover:underline text-xs">Cancel</button>
                        )
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Apply modal */}
      {showApply && (
        <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
          <div className="bg-white rounded-t-2xl sm:rounded-xl p-5 w-full sm:max-w-md space-y-4 max-h-[90vh] overflow-y-auto">
            <h2 className="font-semibold text-lg">Apply Leave</h2>
            {rbac.canAccessHR && (
              <StaffPicker
                label="Staff Member"
                value={applyForm.staffId ? Number(applyForm.staffId) : null}
                onChange={(id, staff) => {
                  setApplyForm((f) => ({ ...f, staffId: id ?? "" }));
                  setApplyStaff(staff);
                }}
                required
              />
            )}
            <div>
              <label className="text-sm font-medium">Leave Type</label>
              <select value={applyForm.leavePolicyId} onChange={(e) => setApplyForm((f) => ({ ...f, leavePolicyId: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm mt-1">
                <option value="">Select…</option>
                {policies.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium">From</label>
                <input type="date" value={applyForm.fromDate} onChange={(e) => setApplyForm((f) => ({ ...f, fromDate: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm mt-1" />
              </div>
              <div>
                <label className="text-sm font-medium">To</label>
                <input type="date" value={applyForm.toDate} onChange={(e) => setApplyForm((f) => ({ ...f, toDate: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm mt-1" />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium">Duration</label>
              <select value={applyForm.leaveDuration} onChange={(e) => setApplyForm((f) => ({ ...f, leaveDuration: e.target.value as any }))} className="w-full border rounded-lg px-3 py-2 text-sm mt-1">
                <option value="FULL_DAY">Full Day</option>
                <option value="HALF_DAY">Half Day</option>
              </select>
            </div>
            <div>
              <label className="text-sm font-medium">Reason</label>
              <textarea value={applyForm.reason} onChange={(e) => setApplyForm((f) => ({ ...f, reason: e.target.value }))} rows={3} className="w-full border rounded-lg px-3 py-2 text-sm mt-1" />
            </div>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setShowApply(false)} className="px-4 py-2 text-sm border rounded-lg hover:bg-gray-50">Cancel</button>
              <button onClick={handleApply} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700">Submit</button>
            </div>
          </div>
        </div>
      )}

      {/* Reject modal */}
      {rejectId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-sm space-y-4">
            <h2 className="font-semibold text-lg">Reject Leave</h2>
            <textarea value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} placeholder="Reason for rejection…" rows={3} className="w-full border rounded-lg px-3 py-2 text-sm" />
            <div className="flex gap-2 justify-end">
              <button onClick={() => setRejectId(null)} className="px-4 py-2 text-sm border rounded-lg hover:bg-gray-50">Cancel</button>
              <button onClick={handleReject} className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700">Reject</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
