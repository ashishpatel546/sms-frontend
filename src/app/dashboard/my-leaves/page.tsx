"use client";

import { useState, useEffect, useCallback } from "react";
import { hrApi, StaffLeaveBalance, StaffLeaveApplication, StaffLeavePolicy } from "@/lib/hr-api";
import { getUser } from "@/lib/auth";
import toast, { Toaster } from "react-hot-toast";

const now = new Date();
const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

export default function MyLeavesPage() {
  const user = getUser();
  const staffId = user?.staffId;

  const [balances, setBalances] = useState<StaffLeaveBalance[]>([]);
  const [applications, setApplications] = useState<StaffLeaveApplication[]>([]);
  const [policies, setPolicies] = useState<StaffLeavePolicy[]>([]);
  const [loading, setLoading] = useState(true);

  // Apply form
  const [showApply, setShowApply] = useState(false);
  const [form, setForm] = useState({ leavePolicyId: "", fromDate: "", toDate: "", leaveDuration: "FULL_DAY" as "FULL_DAY" | "HALF_DAY", reason: "" });

  const load = useCallback(async () => {
    if (!staffId) return;
    setLoading(true);
    try {
      const [bal, apps, pols] = await Promise.allSettled([
        hrApi.leaves.balances(staffId, now.getFullYear()),
        hrApi.leaves.list({ staffId }),
        hrApi.leavePolicies.list(),
      ]);
      if (bal.status === "fulfilled") setBalances(bal.value);
      if (apps.status === "fulfilled") setApplications(apps.value);
      if (pols.status === "fulfilled") setPolicies(pols.value);
    } catch { toast.error("Failed to load leave data"); }
    finally { setLoading(false); }
  }, [staffId]);

  useEffect(() => { load(); }, [load]);

  const handleApply = async () => {
    if (!staffId || !form.leavePolicyId || !form.fromDate || !form.toDate || !form.reason) {
      toast.error("Please fill all required fields"); return;
    }
    try {
      await hrApi.leaves.apply({ staffId, leavePolicyId: Number(form.leavePolicyId), fromDate: form.fromDate, toDate: form.toDate, leaveDuration: form.leaveDuration, reason: form.reason });
      toast.success("Leave application submitted");
      setShowApply(false); load();
    } catch (e: any) { toast.error(e?.info?.message ?? "Failed"); }
  };

  const handleCancel = async (id: number) => {
    if (!confirm("Cancel this leave application?")) return;
    try { await hrApi.leaves.cancel(id); toast.success("Cancelled"); load(); }
    catch (e: any) { toast.error(e?.info?.message ?? "Failed"); }
  };

  return (
    <div className="p-6 space-y-6">
      <Toaster />
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">My Leaves</h1>
        <button onClick={() => setShowApply(true)} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700">
          + Apply Leave
        </button>
      </div>

      {/* Balances */}
      {balances.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {balances.map((b) => {
            const remaining = b.allocated - b.used;
            return (
              <div key={b.id} className="bg-white border border-gray-200 rounded-xl p-4">
                <div className="text-sm font-medium text-gray-700 mb-2">{b.leavePolicy?.name ?? `Policy #${b.leavePolicyId}`}</div>
                <div className="text-3xl font-bold text-blue-700">{remaining}</div>
                <div className="text-xs text-gray-500 mt-1">of {b.allocated} remaining</div>
                {b.lopDays > 0 && <div className="text-xs text-red-500 mt-0.5">LOP: {b.lopDays}d</div>}
              </div>
            );
          })}
        </div>
      )}

      {/* Applications table */}
      <div>
        <h2 className="font-semibold text-gray-800 mb-3">My Applications</h2>
        {loading ? (
          <p className="text-sm text-gray-500">Loading…</p>
        ) : applications.length === 0 ? (
          <p className="text-sm text-gray-500">No leave applications yet.</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-gray-200">
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
                    <td className="px-4 py-3">{a.fromDate} → {a.toDate}</td>
                    <td className="px-4 py-3">{a.leaveDays}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${
                        a.status === "APPROVED" ? "bg-green-50 text-green-700 border-green-200" :
                        a.status === "REJECTED" ? "bg-red-50 text-red-700 border-red-200" :
                        a.status === "CANCELLED" ? "bg-gray-100 text-gray-500 border-gray-200" :
                        "bg-amber-50 text-amber-700 border-amber-200"
                      }`}>{a.status}</span>
                    </td>
                    <td className="px-4 py-3">
                      {["PENDING","APPROVED"].includes(a.status) && (
                        <button onClick={() => handleCancel(a.id)} className="text-gray-500 hover:underline text-xs">Cancel</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Apply modal */}
      {showApply && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-md space-y-4">
            <h2 className="font-semibold text-lg">Apply Leave</h2>
            <div>
              <label className="text-sm font-medium">Leave Type</label>
              <select value={form.leavePolicyId} onChange={(e) => setForm((f) => ({ ...f, leavePolicyId: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm mt-1">
                <option value="">Select…</option>
                {policies.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium">From</label>
                <input type="date" value={form.fromDate} onChange={(e) => setForm((f) => ({ ...f, fromDate: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm mt-1" />
              </div>
              <div>
                <label className="text-sm font-medium">To</label>
                <input type="date" value={form.toDate} onChange={(e) => setForm((f) => ({ ...f, toDate: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm mt-1" />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium">Duration</label>
              <select value={form.leaveDuration} onChange={(e) => setForm((f) => ({ ...f, leaveDuration: e.target.value as any }))} className="w-full border rounded-lg px-3 py-2 text-sm mt-1">
                <option value="FULL_DAY">Full Day</option>
                <option value="HALF_DAY">Half Day</option>
              </select>
            </div>
            <div>
              <label className="text-sm font-medium">Reason</label>
              <textarea value={form.reason} onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))} rows={3} className="w-full border rounded-lg px-3 py-2 text-sm mt-1" />
            </div>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setShowApply(false)} className="px-4 py-2 text-sm border rounded-lg hover:bg-gray-50">Cancel</button>
              <button onClick={handleApply} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700">Submit</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
