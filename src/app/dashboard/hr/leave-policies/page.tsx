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
    try {
      const result = await hrApi.leavePolicies.seedDefaults();
      toast.success(`${result.length} default ${result.length === 1 ? 'policy' : 'policies'} loaded`);
      load();
    } catch (e: any) { toast.error(e?.info?.message ?? "Seed failed"); }
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
      <div className="bg-green-50 border border-green-200 rounded-lg p-4 space-y-3">
        <h2 className="text-sm font-semibold text-green-900">About Leave Policies</h2>
        <p className="text-xs text-green-800 leading-relaxed">
          Leave policies define the types of leave available to staff. Each policy sets the annual
          entitlement, carry-forward rules, and whether it is paid. Once created, staff get leave
          balances from these policies each year. Leave beyond balance is treated as <strong>Loss of Pay (LOP)</strong>.
        </p>
        <div>
          <p className="text-xs font-semibold text-green-900 mb-1.5">"Seed Defaults" creates the following standard policies:</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
            {[
              { name: "Casual Leave (CL)",    days: 12,  cf: false, cfMax: 0,  paid: true },
              { name: "Sick Leave (SL)",       days: 12,  cf: false, cfMax: 0,  paid: true },
              { name: "Earned Leave (EL)",     days: 15,  cf: true,  cfMax: 30, paid: true },
              { name: "Maternity Leave (ML)",  days: 180, cf: false, cfMax: 0,  paid: true },
              { name: "Paternity Leave (PL)",  days: 15,  cf: false, cfMax: 0,  paid: true },
            ].map((p) => (
              <div key={p.name} className="flex items-center justify-between bg-white border border-green-100 rounded-md px-3 py-1.5 text-xs">
                <span className="font-medium text-gray-800">{p.name}</span>
                <span className="text-gray-500 space-x-2">
                  <span>{p.days} days/yr</span>
                  {p.cf && <span className="text-blue-600">↩ max {p.cfMax} days carry-fwd</span>}
                </span>
              </div>
            ))}
          </div>
        </div>
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
                  <td className="px-4 py-3">{p.carryForward ? `Yes (max ${Math.round(p.maxCarryForwardDays)} days)` : "No"}</td>
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
                <input type="number" min={0} step={1} value={form.totalDaysPerYear ?? 0} onChange={(e) => setForm((f) => ({ ...f, totalDaysPerYear: parseInt(e.target.value) || 0 }))} className="w-full border rounded-lg px-3 py-2 text-sm mt-1" />
              </div>
              <div className="flex items-center gap-2">
                <input id="cf" type="checkbox" checked={form.carryForward ?? false} onChange={(e) => setForm((f) => ({ ...f, carryForward: e.target.checked }))} className="rounded" />
                <label htmlFor="cf" className="text-sm">Carry Forward</label>
              </div>
              <div>
                <label className="text-sm font-medium">Max Carry-Forward Days</label>
                <input type="number" min={0} step={1} value={form.maxCarryForwardDays ?? 0} onChange={(e) => setForm((f) => ({ ...f, maxCarryForwardDays: parseInt(e.target.value) || 0 }))} className="w-full border rounded-lg px-3 py-2 text-sm mt-1" disabled={!form.carryForward} />
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
