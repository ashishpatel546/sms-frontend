"use client";

import { useState, useEffect, useCallback } from "react";
import { hrApi, StaffLeaveBalance, StaffLeaveApplication, StaffLeavePolicy } from "@/lib/hr-api";
import toast, { Toaster } from "react-hot-toast";
import { AppDatePicker } from "@/components/ui/AppDatePicker";

const now = new Date();

const STATUS_COLOR: Record<string, string> = {
  APPROVED: "bg-green-50 text-green-700 border-green-200",
  REJECTED: "bg-red-50 text-red-700 border-red-200",
  CANCELLED: "bg-gray-100 text-gray-500 border-gray-200",
  PENDING: "bg-amber-50 text-amber-700 border-amber-200",
};

export default function MyLeavesPage() {
  const [balances, setBalances] = useState<StaffLeaveBalance[]>([]);
  const [applications, setApplications] = useState<StaffLeaveApplication[]>([]);
  const [policies, setPolicies] = useState<StaffLeavePolicy[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [showApply, setShowApply] = useState(false);
  const [form, setForm] = useState({
    leavePolicyId: "",
    fromDate: "",
    toDate: "",
    leaveDuration: "FULL_DAY" as "FULL_DAY" | "HALF_DAY",
    reason: "",
  });

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [bal, apps, pols] = await Promise.allSettled([
        hrApi.leaves.myBalances(now.getFullYear()),
        hrApi.leaves.myLeaves(),
        hrApi.leavePolicies.list(),
      ]);
      if (bal.status === "fulfilled") {
        setBalances(bal.value);
      } else {
        const msg =
          (bal.reason as any)?.info?.message ??
          (bal.reason as any)?.message ??
          "Failed to load leave balances";
        setLoadError(typeof msg === "string" ? msg : "Failed to load leave balances");
      }
      if (apps.status === "fulfilled") setApplications(apps.value);
      if (pols.status === "fulfilled") setPolicies(pols.value);
    } catch {
      toast.error("Failed to load leave data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleApply = async () => {
    if (!form.leavePolicyId || !form.fromDate || !form.toDate || !form.reason) {
      toast.error("Please fill all required fields");
      return;
    }
    const staffId = balances[0]?.staffId;
    if (!staffId) {
      toast.error("No staff profile found for your account. Contact HR.");
      return;
    }
    try {
      await hrApi.leaves.apply({
        staffId,
        leavePolicyId: Number(form.leavePolicyId),
        fromDate: form.fromDate,
        toDate: form.toDate,
        leaveDuration: form.leaveDuration,
        reason: form.reason,
      });
      toast.success("Leave application submitted");
      setShowApply(false);
      load();
    } catch (e: any) {
      toast.error(e?.info?.message ?? "Failed");
    }
  };

  const handleCancel = async (id: number) => {
    if (!confirm("Cancel this leave application?")) return;
    try {
      await hrApi.leaves.cancel(id);
      toast.success("Cancelled");
      load();
    } catch (e: any) {
      toast.error(e?.info?.message ?? "Failed");
    }
  };

  return (
    <div className="p-3 sm:p-6 space-y-6">
      <Toaster />
      <div className="flex items-center justify-between">
        <h1 className="font-display text-[22px] sm:text-[26px] font-semibold tracking-[-0.02em] text-ink">My Leaves</h1>
        <button
          onClick={() => setShowApply(true)}
          className="bg-blue-600 text-white px-3 py-2 sm:px-4 rounded-lg text-sm font-medium hover:bg-blue-700"
        >
          + Apply Leave
        </button>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 text-xs text-blue-800">
        Note: Leave balances and applications are available only for users with a staff profile.
        If you don&apos;t see your leaves here, ask your HR admin to create a staff record for your account.
      </div>

      {loading ? (
        <p className="text-sm text-gray-500">Loading...</p>
      ) : loadError ? (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
          {loadError}
        </div>
      ) : balances.length === 0 ? (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
          No leave balances found. Your HR admin needs to set up leave policies and assign you a staff profile first.
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {balances.map((b) => {
            const remaining = Number(b.allocated) - Number(b.used);
            const pct = b.allocated > 0 ? Math.max(0, (remaining / b.allocated) * 100) : 0;
            return (
              <div key={b.id} className="bg-white border border-gray-200 rounded-xl p-3 sm:p-4">
                <div className="text-xs font-medium text-gray-600 mb-2 truncate">
                  {b.leavePolicy?.name ?? `Policy #${b.leavePolicyId}`}
                </div>
                <div className="text-2xl sm:text-3xl font-bold text-blue-700">{remaining}</div>
                <div className="text-xs text-gray-500 mt-1">of {b.allocated} remaining</div>
                <div className="mt-2 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full bg-blue-400 rounded-full transition-all" style={{ width: `${pct}%` }} />
                </div>
                {b.lopDays > 0 && <div className="text-xs text-red-500 mt-1.5">LOP: {b.lopDays}d</div>}
              </div>
            );
          })}
        </div>
      )}

      <div>
        <h2 className="font-semibold text-gray-800 mb-3 text-sm sm:text-base">My Applications</h2>
        {loading ? (
          <p className="text-sm text-gray-500">Loading...</p>
        ) : applications.length === 0 ? (
          <p className="text-sm text-gray-500">No leave applications yet.</p>
        ) : (
          <>
            <div className="sm:hidden space-y-3">
              {applications.map((a) => (
                <div key={a.id} className="bg-white border border-gray-200 rounded-xl p-4 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-medium text-gray-900 text-sm">
                        {a.leavePolicy?.name ?? `#${a.leavePolicyId}`}
                      </p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {a.fromDate} to {a.toDate} - {a.leaveDays}d
                      </p>
                    </div>
                    <span className={`shrink-0 px-2 py-0.5 rounded-full text-xs font-medium border ${STATUS_COLOR[a.status]}`}>
                      {a.status}
                    </span>
                  </div>
                  {["PENDING", "APPROVED"].includes(a.status) && (
                    <button onClick={() => handleCancel(a.id)} className="text-xs text-red-500 hover:underline">
                      Cancel application
                    </button>
                  )}
                </div>
              ))}
            </div>

            <div className="hidden sm:block overflow-x-auto rounded-xl border border-gray-200">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50 text-gray-600 text-xs uppercase">
                  <tr>
                    <th className="px-4 py-3 text-left">Type</th>
                    <th className="px-4 py-3 text-left">Period</th>
                    <th className="px-4 py-3 text-left">Days</th>
                    <th className="px-4 py-3 text-left">Status</th>
                    <th className="px-4 py-3 text-left">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {applications.map((a) => (
                    <tr key={a.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">{a.leavePolicy?.name ?? `#${a.leavePolicyId}`}</td>
                      <td className="px-4 py-3 whitespace-nowrap">{a.fromDate} to {a.toDate}</td>
                      <td className="px-4 py-3">{a.leaveDays}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${STATUS_COLOR[a.status]}`}>
                          {a.status}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {["PENDING", "APPROVED"].includes(a.status) && (
                          <button onClick={() => handleCancel(a.id)} className="text-gray-500 hover:underline text-xs">
                            Cancel
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {showApply && (
        <div className="fixed inset-0 bg-walnut-950/55 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
          <div className="bg-white rounded-t-2xl sm:rounded-xl p-5 w-full sm:max-w-md space-y-4 max-h-[90vh] overflow-y-auto">
            <h2 className="font-semibold text-lg">Apply Leave</h2>
            <div>
              <label className="text-sm font-medium">Leave Type</label>
              <select
                value={form.leavePolicyId}
                onChange={(e) => setForm((f) => ({ ...f, leavePolicyId: e.target.value }))}
                className="w-full border rounded-lg px-3 py-2 text-sm mt-1"
              >
                <option value="">Select...</option>
                {policies.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium">From</label>
                <AppDatePicker
                  value={form.fromDate}
                  onChange={(v) => setForm((f) => ({ ...f, fromDate: v }))}
                />
              </div>
              <div>
                <label className="text-sm font-medium">To</label>
                <AppDatePicker
                  value={form.toDate}
                  onChange={(v) => setForm((f) => ({ ...f, toDate: v }))}
                />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium">Duration</label>
              <select
                value={form.leaveDuration}
                onChange={(e) => setForm((f) => ({ ...f, leaveDuration: e.target.value as any }))}
                className="w-full border rounded-lg px-3 py-2 text-sm mt-1"
              >
                <option value="FULL_DAY">Full Day</option>
                <option value="HALF_DAY">Half Day</option>
              </select>
            </div>
            <div>
              <label className="text-sm font-medium">Reason</label>
              <textarea
                value={form.reason}
                onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))}
                rows={3}
                className="w-full border rounded-lg px-3 py-2 text-sm mt-1"
              />
            </div>
            <div className="flex gap-2 justify-end pt-1">
              <button onClick={() => setShowApply(false)} className="px-4 py-2 text-sm border rounded-lg hover:bg-gray-50">
                Cancel
              </button>
              <button onClick={handleApply} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                Submit
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
