"use client";

import { useState, useEffect } from "react";
import { hrApi, SalaryComponentDef, EmployeeSalaryConfig } from "@/lib/hr-api";
import { useRbac } from "@/lib/rbac";
import toast, { Toaster } from "react-hot-toast";
import StaffPicker from "@/components/StaffPicker";

type ComponentTab = "components" | "ctc";

export default function SalaryConfigPage() {
  const rbac = useRbac();
  const [tab, setTab] = useState<ComponentTab>("ctc");
  const [components, setComponents] = useState<SalaryComponentDef[]>([]);
  const [configs, setConfigs] = useState<EmployeeSalaryConfig[]>([]);
  const [loading, setLoading] = useState(true);

  // Component form
  const EMPTY_COMP: Partial<SalaryComponentDef> = { name: "", code: "", type: "EARNING", calcType: "FLAT", value: 0, isDefault: false, isActive: true, displayOrder: 0 };
  const [compForm, setCompForm] = useState<Partial<SalaryComponentDef>>(EMPTY_COMP);
  const [compEditId, setCompEditId] = useState<number | null>(null);
  const [showCompForm, setShowCompForm] = useState(false);

  // CTC form
  const [showCtcForm, setShowCtcForm] = useState(false);
  const [ctcStaffId, setCtcStaffId] = useState<number | null>(null);
  const [ctcForm, setCtcForm] = useState({ grossCTC: "", effectiveFrom: new Date().toISOString().slice(0, 10), componentOverrides: "" });

  const load = async () => {
    setLoading(true);
    try {
      const [comps, cfgs] = await Promise.allSettled([hrApi.salaryComponents.list(), hrApi.employeeSalary.listActive()]);
      if (comps.status === "fulfilled") setComponents(comps.value);
      if (cfgs.status === "fulfilled") setConfigs(cfgs.value);
    } catch { toast.error("Failed to load salary config"); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  // Component handlers
  const handleSeedComps = async () => {
    try { const created = await hrApi.salaryComponents.seedDefaults(); toast.success(`${created.length} defaults seeded`); load(); }
    catch (e: any) { toast.error(e?.info?.message ?? "Failed"); }
  };

  const handleSaveComp = async () => {
    if (!compForm.name || !compForm.code) { toast.error("Name and code required"); return; }
    try {
      if (compEditId) { await hrApi.salaryComponents.update(compEditId, compForm); toast.success("Updated"); }
      else { await hrApi.salaryComponents.create(compForm); toast.success("Created"); }
      setShowCompForm(false); load();
    } catch (e: any) { toast.error(e?.info?.message ?? "Save failed"); }
  };

  const handleDeleteComp = async (id: number) => {
    if (!confirm("Delete component?")) return;
    try { await hrApi.salaryComponents.remove(id); toast.success("Deleted"); load(); }
    catch (e: any) { toast.error(e?.info?.message ?? "Failed"); }
  };

  // CTC handlers
  const handleSaveCtc = async () => {
    if (!ctcStaffId || !ctcForm.grossCTC || !ctcForm.effectiveFrom) { toast.error("Fill required fields"); return; }
    let overrides: Record<string, number> = {};
    if (ctcForm.componentOverrides.trim()) {
      try { overrides = JSON.parse(ctcForm.componentOverrides); }
      catch { toast.error("Component overrides must be valid JSON"); return; }
    }
    try {
      await hrApi.employeeSalary.create({
        staffId: ctcStaffId, grossCTC: Number(ctcForm.grossCTC),
        effectiveFrom: ctcForm.effectiveFrom, componentOverrides: overrides,
      });
      toast.success("CTC saved");
      setShowCtcForm(false); load();
    } catch (e: any) { toast.error(e?.info?.message ?? "Save failed"); }
  };

  const CALC_LABELS: Record<string, string> = { FLAT: "Flat ₹", PERCENTAGE_OF_BASIC: "% of Basic", PERCENTAGE_OF_GROSS: "% of Gross" };

  return (
    <div className="p-6 space-y-4">
      <Toaster />
      <h1 className="text-xl font-bold text-gray-900">Salary Configuration</h1>

      {/* Tabs */}
      <div className="flex border-b border-gray-200">
        {(["ctc", "components"] as ComponentTab[]).map((t) => (
          <button key={t} onClick={() => setTab(t)} className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${tab === t ? "border-blue-600 text-blue-600" : "border-transparent text-gray-500 hover:text-gray-700"}`}>
            {t === "ctc" ? "Employee CTC" : "Salary Components"}
          </button>
        ))}
      </div>

      {/* Employee CTC tab */}
      {tab === "ctc" && (
        <>
          {/* CTC Info Banner */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h2 className="text-sm font-semibold text-blue-900 mb-1">Employee CTC (Cost to Company)</h2>
            <p className="text-xs text-blue-800 leading-relaxed">
              Set the <strong>monthly gross salary</strong> for each staff member here. The system uses salary components (defined in the Components tab)
              to automatically calculate earnings (Basic, HRA, TA, etc.) and deductions (PF, PT, TDS). Each CTC record has an
              effective date, so you can track salary revisions over time. You can optionally override specific component amounts
              using the JSON overrides field (e.g. <code className="bg-blue-100 px-1 rounded">{'{"HRA": 15000}'}</code>).
            </p>
          </div>
          {rbac.canManagePayroll && (
            <div className="flex justify-end">
              <button onClick={() => setShowCtcForm(true)} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700">+ Set CTC</button>
            </div>
          )}
          {loading ? <p className="text-sm text-gray-500">Loading…</p> : configs.length === 0 ? (
            <div className="text-center py-12 text-gray-500 text-sm">No CTC configurations yet.</div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-gray-200">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50 text-gray-600 text-xs uppercase">
                  <tr>
                    <th className="px-4 py-3 text-left">Staff ID</th>
                    <th className="px-4 py-3 text-left">Gross CTC (₹)</th>
                    <th className="px-4 py-3 text-left">Effective From</th>
                    <th className="px-4 py-3 text-left">Effective To</th>
                    <th className="px-4 py-3 text-left">Overrides</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {configs.map((c) => (
                    <tr key={c.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">#{c.staffId}</td>
                      <td className="px-4 py-3 font-medium">₹{Number(c.grossCTC).toLocaleString("en-IN")}</td>
                      <td className="px-4 py-3">{c.effectiveFrom}</td>
                      <td className="px-4 py-3">{c.effectiveTo ?? <span className="text-green-600 font-medium">Current</span>}</td>
                      <td className="px-4 py-3 text-xs text-gray-500 max-w-xs truncate">
                        {Object.keys(c.componentOverrides ?? {}).length > 0 ? JSON.stringify(c.componentOverrides) : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* Salary Components tab */}
      {tab === "components" && (
        <>
          {/* Components Info Banner */}
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
            <h2 className="text-sm font-semibold text-amber-900 mb-1">Salary Components</h2>
            <p className="text-xs text-amber-800 leading-relaxed">
              Salary components define <strong>how gross CTC is split</strong> into individual line items on salary slips.
              <strong>Earnings</strong> (Basic, HRA, TA, Special Allowance) add to take-home pay.
              <strong>Deductions</strong> (PF — Provident Fund, PT — Professional Tax, TDS) are subtracted.
              Click <strong>Seed Defaults</strong> to add standard Indian payroll components automatically.
              Components with <em>% of Basic</em> or <em>% of Gross</em> calculation are recomputed each payroll run.
            </p>
          </div>
          {rbac.canManagePayroll && (
            <div className="flex gap-2 justify-end">
              <button onClick={handleSeedComps} className="border border-gray-300 text-gray-700 px-4 py-2 rounded-lg text-sm hover:bg-gray-50">Seed Defaults</button>
              <button onClick={() => { setCompForm(EMPTY_COMP); setCompEditId(null); setShowCompForm(true); }} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700">+ Add Component</button>
            </div>
          )}
          {loading ? <p className="text-sm text-gray-500">Loading…</p> : components.length === 0 ? (
            <div className="text-center py-12 text-gray-500 text-sm">No components. Click "Seed Defaults" to add standard components.</div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-gray-200">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50 text-gray-600 text-xs uppercase">
                  <tr>
                    <th className="px-4 py-3 text-left">Name</th>
                    <th className="px-4 py-3 text-left">Code</th>
                    <th className="px-4 py-3 text-left">Type</th>
                    <th className="px-4 py-3 text-left">Calc</th>
                    <th className="px-4 py-3 text-left">Value</th>
                    <th className="px-4 py-3 text-left">Status</th>
                    {rbac.canManagePayroll && <th className="px-4 py-3 text-left">Actions</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {components.sort((a, b) => a.displayOrder - b.displayOrder).map((c) => (
                    <tr key={c.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium">{c.name}</td>
                      <td className="px-4 py-3 font-mono text-xs">{c.code}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs ${c.type === "EARNING" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>{c.type}</span>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-600">{CALC_LABELS[c.calcType]}</td>
                      <td className="px-4 py-3">{c.calcType === "FLAT" ? `₹${c.value}` : `${c.value}%`}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs border ${c.isActive ? "bg-green-50 text-green-700 border-green-200" : "bg-gray-100 text-gray-500 border-gray-200"}`}>
                          {c.isActive ? "Active" : "Inactive"}
                        </span>
                      </td>
                      {rbac.canManagePayroll && (
                        <td className="px-4 py-3 flex gap-2">
                          <button onClick={() => { setCompForm({ ...c }); setCompEditId(c.id); setShowCompForm(true); }} className="text-blue-600 hover:underline text-xs">Edit</button>
                          <button onClick={() => handleDeleteComp(c.id)} className="text-red-600 hover:underline text-xs">Delete</button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* Component form modal */}
      {showCompForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-md space-y-4">
            <h2 className="font-semibold text-lg">{compEditId ? "Edit" : "New"} Component</h2>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="text-sm font-medium">Name</label>
                <input value={compForm.name ?? ""} onChange={(e) => setCompForm((f) => ({ ...f, name: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm mt-1" />
              </div>
              <div>
                <label className="text-sm font-medium">Code</label>
                <input value={compForm.code ?? ""} onChange={(e) => setCompForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))} className="w-full border rounded-lg px-3 py-2 text-sm mt-1 font-mono" />
              </div>
              <div>
                <label className="text-sm font-medium">Type</label>
                <select value={compForm.type ?? "EARNING"} onChange={(e) => setCompForm((f) => ({ ...f, type: e.target.value as any }))} className="w-full border rounded-lg px-3 py-2 text-sm mt-1">
                  <option value="EARNING">Earning</option>
                  <option value="DEDUCTION">Deduction</option>
                </select>
              </div>
              <div>
                <label className="text-sm font-medium">Calculation</label>
                <select value={compForm.calcType ?? "FLAT"} onChange={(e) => setCompForm((f) => ({ ...f, calcType: e.target.value as any }))} className="w-full border rounded-lg px-3 py-2 text-sm mt-1">
                  <option value="FLAT">Flat ₹</option>
                  <option value="PERCENTAGE_OF_BASIC">% of Basic</option>
                  <option value="PERCENTAGE_OF_GROSS">% of Gross</option>
                </select>
              </div>
              <div>
                <label className="text-sm font-medium">Value</label>
                <input type="number" step="any" min={0} value={compForm.value ?? 0} onChange={(e) => setCompForm((f) => ({ ...f, value: parseFloat(e.target.value) }))} className="w-full border rounded-lg px-3 py-2 text-sm mt-1" />
              </div>
              <div>
                <label className="text-sm font-medium">Display Order</label>
                <input type="number" min={0} value={compForm.displayOrder ?? 0} onChange={(e) => setCompForm((f) => ({ ...f, displayOrder: Number(e.target.value) }))} className="w-full border rounded-lg px-3 py-2 text-sm mt-1" />
              </div>
              <div className="flex items-center gap-2">
                <input id="ca" type="checkbox" checked={compForm.isActive ?? true} onChange={(e) => setCompForm((f) => ({ ...f, isActive: e.target.checked }))} className="rounded" />
                <label htmlFor="ca" className="text-sm">Active</label>
              </div>
            </div>
            <div className="flex gap-2 justify-end pt-2">
              <button onClick={() => setShowCompForm(false)} className="px-4 py-2 text-sm border rounded-lg hover:bg-gray-50">Cancel</button>
              <button onClick={handleSaveComp} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700">Save</button>
            </div>
          </div>
        </div>
      )}

      {/* CTC form modal */}
      {showCtcForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-sm space-y-4">
            <h2 className="font-semibold text-lg">Set Employee CTC</h2>
            <StaffPicker
              label="Staff Member"
              value={ctcStaffId}
              onChange={(id) => setCtcStaffId(id)}
              required
            />
            <div>
              <label className="text-sm font-medium">Gross CTC (₹ / month)</label>
              <input type="number" min={0} value={ctcForm.grossCTC} onChange={(e) => setCtcForm((f) => ({ ...f, grossCTC: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm mt-1" />
            </div>
            <div>
              <label className="text-sm font-medium">Effective From</label>
              <input type="date" value={ctcForm.effectiveFrom} onChange={(e) => setCtcForm((f) => ({ ...f, effectiveFrom: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm mt-1" />
            </div>
            <div>
              <label className="text-sm font-medium">Component Overrides (JSON, optional)</label>
              <textarea value={ctcForm.componentOverrides} onChange={(e) => setCtcForm((f) => ({ ...f, componentOverrides: e.target.value }))} placeholder={'e.g. {"HRA": 15000, "TA": 2000}'} rows={3} className="w-full border rounded-lg px-3 py-2 text-sm mt-1 font-mono" />
            </div>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setShowCtcForm(false)} className="px-4 py-2 text-sm border rounded-lg hover:bg-gray-50">Cancel</button>
              <button onClick={handleSaveCtc} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700">Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
