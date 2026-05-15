"use client";

import { useState, useEffect } from "react";
import { hrApi, StaffLeavePolicy } from "@/lib/hr-api";
import { useRbac } from "@/lib/rbac";
import toast, { Toaster } from "react-hot-toast";

const EMPTY: Partial<StaffLeavePolicy> = {
  name: "", code: "", totalDaysPerYear: 12, carryForward: false, maxCarryForwardDays: 0, isPaid: true, isActive: true,
};

export default function LeavePoliciesPage() {
  const rbac = useRbac();
  const [policies, setPolicies] = useState<StaffLeavePolicy[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<Partial<StaffLeavePolicy>>(EMPTY);
  const [editId, setEditId] = useState<number | null>(null);
  const [showForm, setShowForm] = useState(false);

  const load = async () => {
    setLoading(true);
    try { setPolicies(await hrApi.leavePolicies.list()); }
    catch { toast.error("Failed to load leave policies"); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const openCreate = () => { setForm(EMPTY); setEditId(null); setShowForm(true); };
  const openEdit = (p: StaffLeavePolicy) => { setForm({ ...p }); setEditId(p.id); setShowForm(true); };

  const handleSave = async () => {
    if (!form.name || !form.code) { toast.error("Name and code are required"); return; }
    try {
      if (editId) { await hrApi.leavePolicies.update(editId, form); toast.success("Policy updated"); }
      else { await hrApi.leavePolicies.create(form); toast.success("Policy created"); }
      setShowForm(false); load();
    } catch (e: any) { toast.error(e?.info?.message ?? "Save failed"); }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Delete this policy?")) return;
    try { await hrApi.leavePolicies.remove(id); toast.success("Deleted"); load(); }
    catch (e: any) { toast.error(e?.info?.message ?? "Delete failed"); }
  };

  const handleSeedDefaults = async () => {
    try { const created = await hrApi.leavePolicies.seedDefaults(); toast.success(`${created.length} default policies seeded`); load(); }
    catch (e: any) { toast.error(e?.info?.message ?? "Seed failed"); }
  };

  return (
    <div className="p-6 space-y-4">
      <Toaster />
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">Leave Policies</h1>
        {rbac.canManageHR && (
          <div className="flex gap-2">
            <button onClick={handleSeedDefaults} className="border border-gray-300 text-gray-700 px-4 py-2 rounded-lg text-sm hover:bg-gray-50">
              Seed Defaults
            </button>
            <button onClick={openCreate} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700">
              + New Policy
            </button>
          </div>
        )}
      </div>

      {/* Info Banner */}
      <div className="bg-green-50 border border-green-200 rounded-lg p-4">
        <h2 className="text-sm font-semibold text-green-900 mb-1">About Leave Policies</h2>
        <p className="text-xs text-green-800 leading-relaxed">
          Leave policies define the types of leave available to staff — e.g. <strong>Casual Leave</strong>, <strong>Sick Leave</strong>, <strong>Earned Leave</strong>, and <strong>Maternity Leave</strong>.
          Each policy has an annual entitlement (total days per year), carry-forward rules, and whether it applies to all staff or specific categories.
          Click <strong>Seed Defaults</strong> to automatically create the standard set of leave types.
          Once created, staff members get leave balances populated from these policies each year.
          If a staff member applies for more days than their balance, the excess is treated as <strong>Loss of Pay (LOP)</strong>.
        </p>
      </div>

      {loading ? (
        <p className="text-sm text-gray-500">Loading…</p>
      ) : policies.length === 0 ? (
        <div className="text-center py-12 text-gray-500 text-sm">
          No leave policies yet.{rbac.canManageHR && ' Click "Seed Defaults" to get started.'}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-200">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-gray-600 text-xs uppercase">
              <tr>
                <th className="px-4 py-3 text-left">Name</th>
                <th className="px-4 py-3 text-left">Code</th>
                <th className="px-4 py-3 text-left">Days/Year</th>
                <th className="px-4 py-3 text-left">Carry Forward</th>
                <th className="px-4 py-3 text-left">Paid</th>
                <th className="px-4 py-3 text-left">Status</th>
                {rbac.canManageHR && <th className="px-4 py-3 text-left">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {policies.map((p) => (
                <tr key={p.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{p.name}</td>
                  <td className="px-4 py-3 text-gray-500 font-mono">{p.code}</td>
                  <td className="px-4 py-3">{p.totalDaysPerYear}</td>
                  <td className="px-4 py-3">{p.carryForward ? `Yes (max ${p.maxCarryForwardDays}d)` : "No"}</td>
                  <td className="px-4 py-3">{p.isPaid ? "Paid" : "Unpaid"}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs border ${p.isActive ? "bg-green-50 text-green-700 border-green-200" : "bg-gray-100 text-gray-500 border-gray-200"}`}>
                      {p.isActive ? "Active" : "Inactive"}
                    </span>
                  </td>
                  {rbac.canManageHR && (
                    <td className="px-4 py-3 flex gap-2">
                      <button onClick={() => openEdit(p)} className="text-blue-600 hover:underline text-xs">Edit</button>
                      <button onClick={() => handleDelete(p.id)} className="text-red-600 hover:underline text-xs">Delete</button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Create / Edit Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-md space-y-4">
            <h2 className="font-semibold text-lg">{editId ? "Edit" : "New"} Leave Policy</h2>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="text-sm font-medium">Name</label>
                <input value={form.name ?? ""} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm mt-1" />
              </div>
              <div>
                <label className="text-sm font-medium">Code</label>
                <input value={form.code ?? ""} onChange={(e) => setForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))} className="w-full border rounded-lg px-3 py-2 text-sm mt-1 font-mono" />
              </div>
              <div>
                <label className="text-sm font-medium">Days / Year</label>
                <input type="number" min={0} value={form.totalDaysPerYear ?? 0} onChange={(e) => setForm((f) => ({ ...f, totalDaysPerYear: Number(e.target.value) }))} className="w-full border rounded-lg px-3 py-2 text-sm mt-1" />
              </div>
              <div className="flex items-center gap-2">
                <input id="cf" type="checkbox" checked={form.carryForward ?? false} onChange={(e) => setForm((f) => ({ ...f, carryForward: e.target.checked }))} className="rounded" />
                <label htmlFor="cf" className="text-sm">Carry Forward</label>
              </div>
              <div>
                <label className="text-sm font-medium">Max Carry-Forward Days</label>
                <input type="number" min={0} value={form.maxCarryForwardDays ?? 0} onChange={(e) => setForm((f) => ({ ...f, maxCarryForwardDays: Number(e.target.value) }))} className="w-full border rounded-lg px-3 py-2 text-sm mt-1" disabled={!form.carryForward} />
              </div>
              <div className="flex items-center gap-2">
                <input id="paid" type="checkbox" checked={form.isPaid ?? true} onChange={(e) => setForm((f) => ({ ...f, isPaid: e.target.checked }))} className="rounded" />
                <label htmlFor="paid" className="text-sm">Paid Leave</label>
              </div>
              <div className="flex items-center gap-2">
                <input id="active" type="checkbox" checked={form.isActive ?? true} onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))} className="rounded" />
                <label htmlFor="active" className="text-sm">Active</label>
              </div>
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
