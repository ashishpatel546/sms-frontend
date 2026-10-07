"use client";

import { useState, useEffect } from "react";
import { hrApi, SalaryComponentDef, EmployeeSalaryConfig } from "@/lib/hr-api";
import { todayLocalDate } from "@/lib/utils";
import { useRbac } from "@/lib/rbac";
import toast, { Toaster } from "react-hot-toast";
import StaffPicker from "@/components/StaffPicker";
import { InfoBanner } from "@/components/ui/InfoBanner";
import NumberInput from "@/components/ui/NumberInput";
import { useLocale, useTranslations } from "next-intl";
import { INTL_LOCALE, type Locale } from "@/i18n/config";

type ComponentTab = "components" | "ctc";

export default function SalaryConfigPage() {
  const rbac = useRbac();
  const t = useTranslations("hr");
  const tc = useTranslations("common");
  const locale = useLocale() as Locale;
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
  const [ctcForm, setCtcForm] = useState({ grossCTC: "", effectiveFrom: todayLocalDate(), componentOverrides: "" });
  const [ctcSearch, setCtcSearch] = useState("");
  const [ctcStatusFilter, setCtcStatusFilter] = useState<'ALL' | 'ACTIVE' | 'HISTORY'>('ACTIVE');

  const load = async () => {
    setLoading(true);
    try {
      const [comps, cfgs] = await Promise.allSettled([
        hrApi.salaryComponents.list(), 
        hrApi.employeeSalary.listAll(ctcStatusFilter)
      ]);
      if (comps.status === "fulfilled") setComponents(comps.value);
      if (cfgs.status === "fulfilled") setConfigs(cfgs.value);
    } catch { toast.error(t("salary.loadFailed")); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [ctcStatusFilter]);

  // Component handlers
  const handleSeedComps = async () => {
    try { const created = await hrApi.salaryComponents.seedDefaults(); toast.success(t("salary.seeded", { count: created.length })); load(); }
    catch (e: any) { toast.error(e?.info?.message ?? t("failed")); }
  };

  const handleSaveComp = async () => {
    if (!compForm.name || !compForm.code) { toast.error(t("policies.nameCodeRequired")); return; }
    try {
      if (compEditId) { await hrApi.salaryComponents.update(compEditId, compForm); toast.success(tc("state.updated")); }
      else { await hrApi.salaryComponents.create(compForm); toast.success(t("salary.created")); }
      setShowCompForm(false); load();
    } catch (e: any) { toast.error(e?.info?.message ?? t("policies.saveFailed")); }
  };

  const handleDeleteComp = async (id: number) => {
    if (!confirm(t("salary.deleteConfirm"))) return;
    try { await hrApi.salaryComponents.remove(id); toast.success(tc("state.deleted")); load(); }
    catch (e: any) { toast.error(e?.info?.message ?? t("failed")); }
  };

  // CTC handlers
  const handleSaveCtc = async () => {
    if (!ctcStaffId || !ctcForm.grossCTC || !ctcForm.effectiveFrom) { toast.error(t("myLeaves.fillRequired")); return; }
    let overrides: Record<string, number> = {};
    if (ctcForm.componentOverrides.trim()) {
      try { overrides = JSON.parse(ctcForm.componentOverrides); }
      catch { toast.error(t("salary.invalidJson")); return; }
    }
    try {
      await hrApi.employeeSalary.create({
        staffId: ctcStaffId, grossCTC: Number(ctcForm.grossCTC),
        effectiveFrom: ctcForm.effectiveFrom, componentOverrides: overrides,
      });
      toast.success(t("salary.ctcSaved"));
      setShowCtcForm(false); load();
    } catch (e: any) { toast.error(e?.info?.message ?? t("policies.saveFailed")); }
  };


  return (
    <div className="p-3 sm:p-6 space-y-4">
      <Toaster />
      <h1 className="font-display text-[22px] sm:text-[26px] font-semibold tracking-[-0.02em] text-ink">{t("salary.title")}</h1>

      {/* Tabs */}
      <div className="flex border-b border-gray-200">
        {(["ctc", "components"] as ComponentTab[]).map((key) => (
          <button key={key} onClick={() => setTab(key)} className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${tab === key ? "border-blue-600 text-blue-600" : "border-transparent text-gray-500 hover:text-gray-700"}`}>
            {key === "ctc" ? t("salary.tabCtc") : t("salary.tabComponents")}
          </button>
        ))}
      </div>

      {/* Employee CTC tab */}
      {tab === "ctc" && (
        <>
          {/* CTC Info Banner */}
          <InfoBanner title={t("salary.ctcInfoTitle")}>
            {t.rich("salary.ctcInfoBody", {
              strong: (c) => <strong>{c}</strong>,
              code: (c) => <code className="bg-blue-100 dark:bg-blue-900/50 px-1 rounded">{c}</code>,
              example: '{"HRA": 15000}',
            })}
          </InfoBanner>
          {rbac.canManagePayroll && (
            <div className="flex justify-end">
              <button onClick={() => {
                setCtcStaffId(null);
                setCtcForm({ grossCTC: "", effectiveFrom: todayLocalDate(), componentOverrides: "" });
                setShowCtcForm(true);
              }} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700">{t("salary.setCtcButton")}</button>
            </div>
          )}
          {/* Search & Filter */}
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="text"
              placeholder={t("salary.searchPlaceholder")}
              value={ctcSearch}
              onChange={(e) => setCtcSearch(e.target.value)}
              className="flex-1 sm:max-w-sm border rounded-lg px-3 py-2 text-sm"
            />
            <select
              value={ctcStatusFilter}
              onChange={(e) => setCtcStatusFilter(e.target.value as any)}
              className="border rounded-lg px-3 py-2 text-sm text-gray-700"
            >
              <option value="ACTIVE">{t("salary.activeOnly")}</option>
              <option value="ALL">{t("salary.allHistory")}</option>
            </select>
          </div>
          {loading ? <p className="text-sm text-gray-500">{tc("state.loading")}</p> : configs.length === 0 ? (
            <div className="text-center py-12 text-gray-500 text-sm">{t("salary.noCtc")}</div>
          ) : (
            <>
              {/* Mobile cards */}
              <div className="sm:hidden space-y-3">
                {configs.filter((c) => {
                  if (!ctcSearch) return true;
                  const q = ctcSearch.toLowerCase();
                  const name = c.staff ? `${c.staff.user.firstName} ${c.staff.user.lastName}`.toLowerCase() : "";
                  const mobile = c.staff?.user?.mobile ?? "";
                  return name.includes(q) || mobile.includes(q) || String(c.staffId).includes(q);
                }).map((c) => (
                  <div key={c.id} className="bg-white border border-gray-200 rounded-xl p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="font-semibold text-gray-900">
                          {c.staff ? `${c.staff.user.firstName} ${c.staff.user.lastName}` : t("overview.staffNo", { id: c.staffId })}
                        </span>
                        {c.staff?.designation && <p className="text-xs text-gray-500">{c.staff.designation}</p>}
                        {c.staff?.user?.mobile && <p className="text-xs text-gray-400">{c.staff.user.mobile}</p>}
                      </div>
                      <span className="font-medium text-blue-700">₹{Number(c.grossCTC).toLocaleString(INTL_LOCALE[locale])}</span>
                    </div>
                    <div className="text-xs text-gray-600 space-y-0.5">
                      <div><span className="text-gray-400">{t("salary.fromLabel")} </span>{c.effectiveFrom}</div>
                      <div><span className="text-gray-400">{t("salary.toLabel")} </span>{c.effectiveTo ?? <span className="text-green-600 font-medium">{t("salary.current")}</span>}</div>
                      {Object.keys(c.componentOverrides ?? {}).length > 0 && (
                        <div className="truncate"><span className="text-gray-400">{t("salary.overridesLabel")} </span>{JSON.stringify(c.componentOverrides)}</div>
                      )}
                    </div>
                    {rbac.canManagePayroll && !c.effectiveTo && (
                      <div className="pt-2 flex justify-end">
                        <button
                          onClick={() => {
                            setCtcStaffId(c.staffId);
                            setCtcForm({
                              grossCTC: c.grossCTC.toString(),
                              effectiveFrom: todayLocalDate(),
                              componentOverrides: Object.keys(c.componentOverrides ?? {}).length ? JSON.stringify(c.componentOverrides) : ""
                            });
                            setShowCtcForm(true);
                          }}
                          className="text-sm text-blue-600 hover:text-blue-800 font-medium"
                        >
                          {t("salary.reviseCtc")}
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Tablet+ table */}
              <div className="hidden sm:block overflow-x-auto rounded-xl border border-gray-200">
                <table className="min-w-full text-sm">
                  <thead className="bg-gray-50 text-gray-600 text-xs uppercase">
                    <tr>
                      <th className="px-4 py-3 text-left">{t("leaves.staff")}</th>
                      <th className="px-4 py-3 text-left">{t("run.monthlyGrossCtc")}</th>
                      <th className="px-4 py-3 text-left">{t("salary.effectiveFrom")}</th>
                      <th className="px-4 py-3 text-left">{t("salary.effectiveTo")}</th>
                      <th className="px-4 py-3 text-left">{t("salary.overrides")}</th>
                      {rbac.canManagePayroll && <th className="px-4 py-3 text-right">{tc("action.actions")}</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {configs.filter((c) => {
                      if (!ctcSearch) return true;
                      const q = ctcSearch.toLowerCase();
                      const name = c.staff ? `${c.staff.user.firstName} ${c.staff.user.lastName}`.toLowerCase() : "";
                      const mobile = c.staff?.user?.mobile ?? "";
                      return name.includes(q) || mobile.includes(q) || String(c.staffId).includes(q);
                    }).map((c) => (
                      <tr key={c.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <div className="font-medium text-gray-900">
                            {c.staff ? `${c.staff.user.firstName} ${c.staff.user.lastName}` : `#${c.staffId}`}
                          </div>
                          {c.staff?.designation && <div className="text-xs text-gray-500">{c.staff.designation}</div>}
                          {c.staff?.user?.mobile && <div className="text-xs text-gray-400">{c.staff.user.mobile}</div>}
                        </td>
                        <td className="px-4 py-3 font-medium">₹{Number(c.grossCTC).toLocaleString(INTL_LOCALE[locale])}</td>
                        <td className="px-4 py-3">{c.effectiveFrom}</td>
                        <td className="px-4 py-3">
                          {c.effectiveTo ? (
                            <span className="text-gray-600">{c.effectiveTo}</span>
                          ) : (
                            <span className="text-green-600 font-medium">{t("salary.current")}</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-500 max-w-xs truncate">
                          {Object.keys(c.componentOverrides ?? {}).length > 0 ? JSON.stringify(c.componentOverrides) : "—"}
                        </td>
                        {rbac.canManagePayroll && (
                          <td className="px-4 py-3 text-right">
                            {!c.effectiveTo && (
                              <button
                                onClick={() => {
                                  setCtcStaffId(c.staffId);
                                  setCtcForm({
                                    grossCTC: c.grossCTC.toString(),
                                    effectiveFrom: todayLocalDate(),
                                    componentOverrides: Object.keys(c.componentOverrides ?? {}).length ? JSON.stringify(c.componentOverrides) : ""
                                  });
                                  setShowCtcForm(true);
                                }}
                                className="text-blue-600 hover:text-blue-800 font-medium px-2 py-1"
                              >
                                {t("salary.reviseCtc")}
                              </button>
                            )}
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </>
      )}

      {/* Salary Components tab */}
      {tab === "components" && (
        <>
          {/* Components Info Banner */}
          <InfoBanner title={t("salary.tabComponents")} variant="amber">
            {t.rich("salary.compInfoBody", { strong: (c) => <strong>{c}</strong>, em: (c) => <em>{c}</em> })}
          </InfoBanner>
          {rbac.canManagePayroll && (
            <div className="flex gap-2 justify-end">
              <button onClick={handleSeedComps} className="border border-gray-300 text-gray-700 px-4 py-2 rounded-lg text-sm hover:bg-gray-50">{t("salary.seedDefaults")}</button>
              <button onClick={() => { setCompForm(EMPTY_COMP); setCompEditId(null); setShowCompForm(true); }} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700">{t("salary.addComponent")}</button>
            </div>
          )}
          {loading ? <p className="text-sm text-gray-500">{tc("state.loading")}</p> : components.length === 0 ? (
            <div className="text-center py-12 text-gray-500 text-sm">{t("salary.noComponents")}</div>
          ) : (
            <>
              {/* Mobile cards */}
              <div className="sm:hidden space-y-3">
                {components.sort((a, b) => a.displayOrder - b.displayOrder).map((c) => (
                  <div key={c.id} className="bg-white border border-gray-200 rounded-xl p-4 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-medium text-gray-900 text-sm">{c.name}</p>
                        <p className="text-xs text-gray-500 font-mono">{c.code}</p>
                      </div>
                      <span className={`shrink-0 px-2 py-0.5 rounded-full text-xs ${c.type === "EARNING" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>{t(`salary.compType.${c.type}`)}</span>
                    </div>
                    <div className="flex items-center justify-between text-xs text-gray-600">
                      <span>{t(`salary.calc.${c.calcType}`)} · {c.calcType === "FLAT" ? `₹${c.value}` : `${c.value}%`}</span>
                      <span className={`px-2 py-0.5 rounded-full border ${c.isActive ? "bg-green-50 text-green-700 border-green-200" : "bg-gray-100 text-gray-500 border-gray-200"}`}>{c.isActive ? tc("status.active") : tc("status.inactive")}</span>
                    </div>
                    {rbac.canManagePayroll && (
                      <div className="flex gap-3">
                        <button onClick={() => { setCompForm({ ...c }); setCompEditId(c.id); setShowCompForm(true); }} className="text-blue-600 hover:underline text-xs">{tc("action.edit")}</button>
                        <button onClick={() => handleDeleteComp(c.id)} className="text-red-600 hover:underline text-xs">{tc("action.delete")}</button>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Tablet+ table */}
              <div className="hidden sm:block overflow-x-auto rounded-xl border border-gray-200">
                <table className="min-w-full text-sm">
                  <thead className="bg-gray-50 text-gray-600 text-xs uppercase">
                    <tr>
                      <th className="px-4 py-3 text-left">{tc("field.name")}</th>
                      <th className="px-4 py-3 text-left">{t("policies.code")}</th>
                      <th className="px-4 py-3 text-left">{tc("field.type")}</th>
                      <th className="px-4 py-3 text-left">{t("salary.calcShort")}</th>
                      <th className="px-4 py-3 text-left">{t("salary.value")}</th>
                      <th className="px-4 py-3 text-left">{tc("field.status")}</th>
                      {rbac.canManagePayroll && <th className="px-4 py-3 text-left">{tc("action.actions")}</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {components.sort((a, b) => a.displayOrder - b.displayOrder).map((c) => (
                      <tr key={c.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 font-medium">{c.name}</td>
                        <td className="px-4 py-3 font-mono text-xs">{c.code}</td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded-full text-xs ${c.type === "EARNING" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>{t(`salary.compType.${c.type}`)}</span>
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-600">{t(`salary.calc.${c.calcType}`)}</td>
                        <td className="px-4 py-3">{c.calcType === "FLAT" ? `₹${c.value}` : `${c.value}%`}</td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded-full text-xs border ${c.isActive ? "bg-green-50 text-green-700 border-green-200" : "bg-gray-100 text-gray-500 border-gray-200"}`}>
                            {c.isActive ? tc("status.active") : tc("status.inactive")}
                          </span>
                        </td>
                        {rbac.canManagePayroll && (
                          <td className="px-4 py-3 flex gap-2">
                            <button onClick={() => { setCompForm({ ...c }); setCompEditId(c.id); setShowCompForm(true); }} className="text-blue-600 hover:underline text-xs">{tc("action.edit")}</button>
                            <button onClick={() => handleDeleteComp(c.id)} className="text-red-600 hover:underline text-xs">{tc("action.delete")}</button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </>
      )}

      {/* Component form modal */}
      {showCompForm && (
        <div className="fixed inset-0 bg-walnut-950/55 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
          <div className="bg-white rounded-t-2xl sm:rounded-xl p-5 w-full sm:max-w-md space-y-4 max-h-[90vh] overflow-y-auto">
            <h2 className="font-semibold text-lg">{compEditId ? t("salary.editComponent") : t("salary.newComponent")}</h2>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="text-sm font-medium">{tc("field.name")}</label>
                <input value={compForm.name ?? ""} onChange={(e) => setCompForm((f) => ({ ...f, name: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm mt-1" />
              </div>
              <div>
                <label className="text-sm font-medium">{t("policies.code")}</label>
                <input value={compForm.code ?? ""} onChange={(e) => setCompForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))} className="w-full border rounded-lg px-3 py-2 text-sm mt-1 font-mono" />
              </div>
              <div>
                <label className="text-sm font-medium">{tc("field.type")}</label>
                <select value={compForm.type ?? "EARNING"} onChange={(e) => setCompForm((f) => ({ ...f, type: e.target.value as any }))} className="w-full border rounded-lg px-3 py-2 text-sm mt-1">
                  <option value="EARNING">{t("salary.compType.EARNING")}</option>
                  <option value="DEDUCTION">{t("salary.compType.DEDUCTION")}</option>
                </select>
              </div>
              <div>
                <label className="text-sm font-medium">{t("salary.calculation")}</label>
                <select value={compForm.calcType ?? "FLAT"} onChange={(e) => setCompForm((f) => ({ ...f, calcType: e.target.value as any }))} className="w-full border rounded-lg px-3 py-2 text-sm mt-1">
                  <option value="FLAT">{t("salary.calc.FLAT")}</option>
                  <option value="PERCENTAGE_OF_BASIC">{t("salary.calc.PERCENTAGE_OF_BASIC")}</option>
                  <option value="PERCENTAGE_OF_GROSS">{t("salary.calc.PERCENTAGE_OF_GROSS")}</option>
                </select>
              </div>
              <div>
                <label className="text-sm font-medium">{t("salary.value")}</label>
                <NumberInput step="any" min={0} value={compForm.value ?? 0} emptyValue={0} onChange={(v) => setCompForm((f) => ({ ...f, value: v ?? 0 }))} className="w-full border rounded-lg px-3 py-2 text-sm mt-1" />
              </div>
              <div>
                <label className="text-sm font-medium">{t("salary.displayOrder")}</label>
                <NumberInput min={0} value={compForm.displayOrder ?? 0} emptyValue={0} onChange={(v) => setCompForm((f) => ({ ...f, displayOrder: v ?? 0 }))} className="w-full border rounded-lg px-3 py-2 text-sm mt-1" />
              </div>
              <div className="flex items-center gap-2">
                <input id="ca" type="checkbox" checked={compForm.isActive ?? true} onChange={(e) => setCompForm((f) => ({ ...f, isActive: e.target.checked }))} className="rounded" />
                <label htmlFor="ca" className="text-sm">{tc("status.active")}</label>
              </div>
            </div>
            <div className="flex gap-2 justify-end pt-2">
              <button onClick={() => setShowCompForm(false)} className="px-4 py-2 text-sm border rounded-lg hover:bg-gray-50">{tc("action.cancel")}</button>
              <button onClick={handleSaveComp} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700">{tc("action.save")}</button>
            </div>
          </div>
        </div>
      )}

      {/* CTC form modal */}
      {showCtcForm && (
        <div className="fixed inset-0 bg-walnut-950/55 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-sm space-y-4">
            <h2 className="font-semibold text-lg">{t("salary.setCtcTitle")}</h2>
            <StaffPicker
              label={t("leaves.staffMember")}
              value={ctcStaffId}
              onChange={(id) => setCtcStaffId(id)}
              required
            />
            <div>
              <label className="text-sm font-medium">{t("salary.grossLabel")}</label>
              <input type="number" min={0} value={ctcForm.grossCTC} onChange={(e) => setCtcForm((f) => ({ ...f, grossCTC: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm mt-1" />
            </div>
            <div>
              <label className="text-sm font-medium">{t("salary.effectiveFrom")}</label>
              <input type="date" value={ctcForm.effectiveFrom} onChange={(e) => setCtcForm((f) => ({ ...f, effectiveFrom: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm mt-1" />
            </div>
            <div>
              <label className="text-sm font-medium">{t("salary.overridesField")}</label>
              <textarea value={ctcForm.componentOverrides} onChange={(e) => setCtcForm((f) => ({ ...f, componentOverrides: e.target.value }))} placeholder={t("salary.overridesPlaceholder", { example: '{"HRA": 15000, "TA": 2000}' })} rows={3} className="w-full border rounded-lg px-3 py-2 text-sm mt-1 font-mono" />
            </div>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setShowCtcForm(false)} className="px-4 py-2 text-sm border rounded-lg hover:bg-gray-50">{tc("action.cancel")}</button>
              <button onClick={handleSaveCtc} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700">{tc("action.save")}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
