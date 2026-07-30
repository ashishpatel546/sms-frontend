"use client";

import { useState, useEffect } from "react";
import { hrApi, StaffLeavePolicy, LeavePolicyDefault, HrSettings, AccrualFrequency } from "@/lib/hr-api";
import { useRbac } from "@/lib/rbac";
import toast, { Toaster } from "react-hot-toast";
import NumberInput from "@/components/ui/NumberInput";

const EMPTY: Partial<StaffLeavePolicy> = {
  name: "", code: "", totalDaysPerYear: 12, carryForward: false, maxCarryForwardDays: 0,
  isPaid: true, proRata: true, appliesToGender: 'ALL', isActive: true,
};

const GENDER_LABEL: Record<'ALL' | 'MALE' | 'FEMALE', string> = {
  ALL: 'All staff',
  MALE: 'Male only',
  FEMALE: 'Female only',
};

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export default function LeavePoliciesPage() {
  const rbac = useRbac();

  // Policies state
  const [policies, setPolicies] = useState<StaffLeavePolicy[]>([]);
  const [defaults, setDefaults] = useState<LeavePolicyDefault[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<Partial<StaffLeavePolicy>>(EMPTY);
  const [editId, setEditId] = useState<number | null>(null);
  const [showForm, setShowForm] = useState(false);

  // HR settings state
  const [settings, setSettings] = useState<HrSettings | null>(null);
  const [settingsDraft, setSettingsDraft] = useState<HrSettings | null>(null);
  const [savingSettings, setSavingSettings] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [policiesList, settingsResp] = await Promise.all([
        hrApi.leavePolicies.list(),
        hrApi.settings.get().catch(() => null),
      ]);
      setPolicies(policiesList);
      if (settingsResp) {
        setSettings(settingsResp);
        setSettingsDraft(settingsResp);
      }
      // Defaults are HR-only and only useful if no policies exist yet
      if (rbac.canManageHR && policiesList.length === 0) {
        try { setDefaults(await hrApi.leavePolicies.listDefaults()); } catch { /* ignore */ }
      } else {
        setDefaults([]);
      }
    } catch { toast.error("Failed to load leave policies"); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [rbac.canManageHR]);

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

  const handleToggleActive = async (p: StaffLeavePolicy) => {
    const next = !p.isActive;
    try {
      await hrApi.leavePolicies.update(p.id, { isActive: next });
      toast.success(next ? `${p.name} activated` : `${p.name} suspended`);
      load();
    } catch (e: any) { toast.error(e?.info?.message ?? "Update failed"); }
  };

  const handleApplyDefaults = async () => {
    try {
      const result = await hrApi.leavePolicies.seedDefaults();
      toast.success(`${result.length} default ${result.length === 1 ? 'policy' : 'policies'} applied`);
      load();
    } catch (e: any) { toast.error(e?.info?.message ?? "Apply failed"); }
  };

  const handleSaveSettings = async () => {
    if (!settingsDraft) return;
    setSavingSettings(true);
    try {
      const updated = await hrApi.settings.update(settingsDraft);
      setSettings(updated);
      setSettingsDraft(updated);
      toast.success("HR settings updated");
    } catch (e: any) { toast.error(e?.info?.message ?? "Save failed"); }
    finally { setSavingSettings(false); }
  };

  const handleInitBalances = async () => {
    if (!confirm("Initialize leave balances for all active staff for the current leave year?")) return;
    try {
      const r = await hrApi.settings.initYearBalances();
      toast.success(`Initialized balances for ${r.initialized} staff`);
    } catch (e: any) { toast.error(e?.info?.message ?? "Init failed"); }
  };

  const settingsDirty =
    settings && settingsDraft &&
    (settings.leaveYearStartMonth !== settingsDraft.leaveYearStartMonth ||
     settings.accrualFrequency !== settingsDraft.accrualFrequency);

  return (
    <div className="p-3 sm:p-6 space-y-4">
      <Toaster />
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">Leave Policies</h1>
        {rbac.canManageHR && policies.length > 0 && (
          <button onClick={openCreate} className="bg-blue-600 text-white px-3 py-2 sm:px-4 rounded-lg text-sm font-medium hover:bg-blue-700">
            + New Policy
          </button>
        )}
      </div>

      {/* HR Settings Panel */}
      {rbac.canManageHR && settingsDraft && (
        <div className="bg-white border border-gray-200 rounded-xl p-4 sm:p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-900">Leave Calendar &amp; Accrual</h2>
            <button
              onClick={handleInitBalances}
              className="text-xs text-blue-600 hover:underline"
              title="Create or top-up balance rows for all active staff for the current leave year"
            >
              Refresh staff balances
            </button>
          </div>
          <p className="text-xs text-gray-500">
            These rules apply school-wide. Existing balances are not changed retroactively &mdash; the
            new configuration takes effect on the next balance refresh / login.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-gray-700">Leave year starts in</label>
              <select
                value={settingsDraft.leaveYearStartMonth}
                onChange={(e) => setSettingsDraft({ ...settingsDraft, leaveYearStartMonth: parseInt(e.target.value, 10) })}
                className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white"
              >
                {MONTHS.map((m, i) => (
                  <option key={i} value={i + 1}>{m}</option>
                ))}
              </select>
              <p className="text-[11px] text-gray-500 mt-1">
                Default: April (Indian fiscal year). Choose January for calendar-year leave.
              </p>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-700">Accrual frequency</label>
              <select
                value={settingsDraft.accrualFrequency}
                onChange={(e) => setSettingsDraft({ ...settingsDraft, accrualFrequency: e.target.value as AccrualFrequency })}
                className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white"
              >
                <option value="YEARLY">Yearly &mdash; full allocation credited at start of leave year</option>
                <option value="MONTHLY">Monthly &mdash; 1/12 credited each month</option>
              </select>
              <p className="text-[11px] text-gray-500 mt-1">
                Mid-year joiners always get a pro-rata share based on joining date.
              </p>
            </div>
          </div>
          {settingsDirty && (
            <div className="flex justify-end gap-2 pt-1">
              <button
                onClick={() => setSettingsDraft(settings)}
                className="px-3 py-1.5 text-xs border border-gray-300 rounded-lg hover:bg-gray-50"
                disabled={savingSettings}
              >
                Cancel
              </button>
              <button
                onClick={handleSaveSettings}
                disabled={savingSettings}
                className="px-3 py-1.5 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {savingSettings ? "Saving\u2026" : "Save settings"}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Suggested Defaults card (only when no policies exist) */}
      {!loading && policies.length === 0 && rbac.canManageHR && defaults.length > 0 && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 sm:p-5 space-y-3">
          <div className="flex items-start sm:items-center justify-between gap-3 flex-col sm:flex-row">
            <div>
              <h2 className="text-sm font-semibold text-green-900">Suggested defaults</h2>
              <p className="text-xs text-green-800 mt-1">
                Apply the standard Indian-school leave policies in one click. You can edit or delete any of them afterwards.
              </p>
            </div>
            <button
              onClick={handleApplyDefaults}
              className="shrink-0 bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-green-700"
            >
              Apply defaults
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {defaults.map((d) => (
              <div key={d.code} className="flex items-center justify-between bg-white border border-green-100 rounded-md px-3 py-2 text-xs">
                <div>
                  <span className="font-medium text-gray-800">{d.name}</span>
                  <span className="text-gray-400 font-mono ml-2">{d.code}</span>
                </div>
                <div className="text-gray-500 text-right space-x-2">
                  <span>{d.totalDaysPerYear} d/yr</span>
                  {d.carryForward && <span className="text-blue-600">\u21A9 {d.maxCarryForwardDays}</span>}
                  {!d.proRata && <span className="text-purple-600">no pro-rata</span>}
                  {d.appliesToGender !== 'ALL' && (
                    <span className="text-pink-600">{d.appliesToGender === 'FEMALE' ? '\u2640 female' : '\u2642 male'}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {loading ? (
        <p className="text-sm text-gray-500">Loading\u2026</p>
      ) : policies.length === 0 ? (
        <div className="text-center py-12 text-gray-500 text-sm">
          {rbac.canManageHR
            ? 'No custom policies yet. Apply the suggested defaults above or click "+ New Policy".'
            : 'No leave policies configured yet.'}
          {rbac.canManageHR && (
            <div className="mt-4">
              <button onClick={openCreate} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700">
                + New Policy
              </button>
            </div>
          )}
        </div>
      ) : (
        <>
          {/* Mobile cards */}
          <div className="sm:hidden space-y-3">
            {policies.map((p) => (
              <div key={p.id} className="bg-white border border-gray-200 rounded-xl p-4 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-medium text-gray-900 text-sm">{p.name}</p>
                    <p className="text-xs text-gray-500 font-mono mt-0.5">{p.code}</p>
                  </div>
                  <span className={`shrink-0 px-2 py-0.5 rounded-full text-xs border ${p.isActive ? "bg-green-50 text-green-700 border-green-200" : "bg-gray-100 text-gray-500 border-gray-200"}`}>
                    {p.isActive ? "Active" : "Inactive"}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-gray-600">
                  <div><span className="text-gray-400">Days/yr: </span>{p.totalDaysPerYear}</div>
                  <div><span className="text-gray-400">Paid: </span>{p.isPaid ? "Yes" : "No"}</div>
                  <div><span className="text-gray-400">Pro-rata: </span>{p.proRata ? "Yes" : "No"}</div>
                  <div><span className="text-gray-400">Carry fwd: </span>{p.carryForward ? `Yes (max ${Math.round(p.maxCarryForwardDays)}d)` : "No"}</div>
                  <div className="col-span-2"><span className="text-gray-400">Applies to: </span>{GENDER_LABEL[p.appliesToGender ?? 'ALL']}</div>
                </div>
                {rbac.canManageHR && (
                  <div className="flex gap-3">
                    <button onClick={() => openEdit(p)} className="text-blue-600 hover:underline text-xs">Edit</button>
                    <button
                      onClick={() => handleToggleActive(p)}
                      className={p.isActive ? "text-amber-600 hover:underline text-xs" : "text-green-600 hover:underline text-xs"}
                    >
                      {p.isActive ? "Suspend" : "Activate"}
                    </button>
                    <button onClick={() => handleDelete(p.id)} className="text-red-600 hover:underline text-xs">Delete</button>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Tablet+ table */
          <div className="hidden sm:block overflow-x-auto rounded-xl border border-gray-200">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 text-gray-600 text-xs uppercase">
                <tr>
                  <th className="px-4 py-3 text-left">Name</th>
                  <th className="px-4 py-3 text-left">Code</th>
                  <th className="px-4 py-3 text-left">Days/Year</th>
                  <th className="px-4 py-3 text-left">Carry Forward</th>
                  <th className="px-4 py-3 text-left">Paid</th>
                  <th className="px-4 py-3 text-left">Pro-rata</th>
                  <th className="px-4 py-3 text-left">Applies to</th>
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
                    <td className="px-4 py-3">{p.proRata ? "Yes" : "No"}</td>
                    <td className="px-4 py-3">{GENDER_LABEL[p.appliesToGender ?? 'ALL']}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs border ${p.isActive ? "bg-green-50 text-green-700 border-green-200" : "bg-gray-100 text-gray-500 border-gray-200"}`}>
                        {p.isActive ? "Active" : "Inactive"}
                      </span>
                    </td>
                    {rbac.canManageHR && (
                      <td className="px-4 py-3 flex gap-2">
                        <button onClick={() => openEdit(p)} className="text-blue-600 hover:underline text-xs">Edit</button>
                        <button
                          onClick={() => handleToggleActive(p)}
                          className={p.isActive ? "text-amber-600 hover:underline text-xs" : "text-green-600 hover:underline text-xs"}
                        >
                          {p.isActive ? "Suspend" : "Activate"}
                        </button>
                        <button onClick={() => handleDelete(p.id)} className="text-red-600 hover:underline text-xs">Delete</button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>}
        </>
      )}

      {/* Create / Edit Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
          <div className="bg-white rounded-t-2xl sm:rounded-xl p-5 w-full sm:max-w-md space-y-4 max-h-[90vh] overflow-y-auto">
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
                <NumberInput min={0} step={1} value={form.totalDaysPerYear ?? 0} emptyValue={0} onChange={(v) => setForm((f) => ({ ...f, totalDaysPerYear: v ?? 0 }))} className="w-full border rounded-lg px-3 py-2 text-sm mt-1" />
              </div>
              <div className="flex items-center gap-2">
                <input id="cf" type="checkbox" checked={form.carryForward ?? false} onChange={(e) => setForm((f) => ({ ...f, carryForward: e.target.checked }))} className="rounded" />
                <label htmlFor="cf" className="text-sm">Carry Forward</label>
              </div>
              <div>
                <label className="text-sm font-medium">Max Carry-Forward Days</label>
                <NumberInput min={0} step={1} value={form.maxCarryForwardDays ?? 0} emptyValue={0} onChange={(v) => setForm((f) => ({ ...f, maxCarryForwardDays: v ?? 0 }))} className="w-full border rounded-lg px-3 py-2 text-sm mt-1" disabled={!form.carryForward} />
              </div>
              <div className="flex items-center gap-2">
                <input id="paid" type="checkbox" checked={form.isPaid ?? true} onChange={(e) => setForm((f) => ({ ...f, isPaid: e.target.checked }))} className="rounded" />
                <label htmlFor="paid" className="text-sm">Paid Leave</label>
              </div>
              <div className="flex items-center gap-2">
                <input id="prorata" type="checkbox" checked={form.proRata ?? true} onChange={(e) => setForm((f) => ({ ...f, proRata: e.target.checked }))} className="rounded" />
                <label htmlFor="prorata" className="text-sm" title="Uncheck for ML/PL: always full allocation">Pro-rata for mid-year joiners</label>
              </div>
              <div className="col-span-2">
                <label className="text-sm font-medium">Applies to</label>
                <select
                  value={form.appliesToGender ?? 'ALL'}
                  onChange={(e) => setForm((f) => ({ ...f, appliesToGender: e.target.value as 'ALL' | 'MALE' | 'FEMALE' }))}
                  className="w-full border rounded-lg px-3 py-2 text-sm mt-1 bg-white"
                >
                  <option value="ALL">All staff</option>
                  <option value="FEMALE">Female only (e.g. Maternity Leave)</option>
                  <option value="MALE">Male only (e.g. Paternity Leave)</option>
                </select>
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
