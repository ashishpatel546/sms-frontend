"use client";

import { useState, useEffect } from "react";
import { hrApi, StaffLeavePolicy, LeavePolicyDefault, HrSettings, AccrualFrequency } from "@/lib/hr-api";
import { useRbac } from "@/lib/rbac";
import toast, { Toaster } from "react-hot-toast";
import NumberInput from "@/components/ui/NumberInput";
import { useLocale, useTranslations } from "next-intl";
import { INTL_LOCALE, type Locale } from "@/i18n/config";

const EMPTY: Partial<StaffLeavePolicy> = {
  name: "", code: "", totalDaysPerYear: 12, carryForward: false, maxCarryForwardDays: 0,
  isPaid: true, proRata: true, appliesToGender: 'ALL', isActive: true,
};

const MONTH_NUMBERS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

export default function LeavePoliciesPage() {
  const rbac = useRbac();
  const t = useTranslations("hr.policies");
  const tc = useTranslations("common");
  const locale = useLocale() as Locale;

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
    } catch { toast.error(t("loadFailed")); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [rbac.canManageHR]);

  const openCreate = () => { setForm(EMPTY); setEditId(null); setShowForm(true); };
  const openEdit = (p: StaffLeavePolicy) => { setForm({ ...p }); setEditId(p.id); setShowForm(true); };

  const handleSave = async () => {
    if (!form.name || !form.code) { toast.error(t("nameCodeRequired")); return; }
    try {
      if (editId) { await hrApi.leavePolicies.update(editId, form); toast.success(t("updated")); }
      else { await hrApi.leavePolicies.create(form); toast.success(t("created")); }
      setShowForm(false); load();
    } catch (e: any) { toast.error(e?.info?.message ?? t("saveFailed")); }
  };

  const handleDelete = async (id: number) => {
    if (!confirm(t("deleteConfirm"))) return;
    try { await hrApi.leavePolicies.remove(id); toast.success(tc("state.deleted")); load(); }
    catch (e: any) { toast.error(e?.info?.message ?? t("deleteFailed")); }
  };

  const handleToggleActive = async (p: StaffLeavePolicy) => {
    const next = !p.isActive;
    try {
      await hrApi.leavePolicies.update(p.id, { isActive: next });
      toast.success(next ? t("activated", { name: p.name }) : t("suspended", { name: p.name }));
      load();
    } catch (e: any) { toast.error(e?.info?.message ?? t("updateFailed")); }
  };

  const handleApplyDefaults = async () => {
    try {
      const result = await hrApi.leavePolicies.seedDefaults();
      toast.success(t("defaultsApplied", { count: result.length }));
      load();
    } catch (e: any) { toast.error(e?.info?.message ?? t("applyFailed")); }
  };

  const handleSaveSettings = async () => {
    if (!settingsDraft) return;
    setSavingSettings(true);
    try {
      const updated = await hrApi.settings.update(settingsDraft);
      setSettings(updated);
      setSettingsDraft(updated);
      toast.success(t("settingsUpdated"));
    } catch (e: any) { toast.error(e?.info?.message ?? t("saveFailed")); }
    finally { setSavingSettings(false); }
  };

  const handleInitBalances = async () => {
    if (!confirm(t("initConfirm"))) return;
    try {
      const r = await hrApi.settings.initYearBalances();
      toast.success(t("initialized", { count: r.initialized }));
    } catch (e: any) { toast.error(e?.info?.message ?? t("initFailed")); }
  };

  const settingsDirty =
    settings && settingsDraft &&
    (settings.leaveYearStartMonth !== settingsDraft.leaveYearStartMonth ||
     settings.accrualFrequency !== settingsDraft.accrualFrequency);

  return (
    <div className="p-3 sm:p-6 space-y-4">
      <Toaster />
      <div className="flex items-center justify-between">
        <h1 className="font-display text-[22px] sm:text-[26px] font-semibold tracking-[-0.02em] text-ink">{t("title")}</h1>
        {rbac.canManageHR && policies.length > 0 && (
          <button onClick={openCreate} className="bg-blue-600 text-white px-3 py-2 sm:px-4 rounded-lg text-sm font-medium hover:bg-blue-700">
            {t("newPolicy")}
          </button>
        )}
      </div>

      {/* HR Settings Panel */}
      {rbac.canManageHR && settingsDraft && (
        <div className="bg-white border border-gray-200 rounded-xl p-4 sm:p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-900">{t("calendarTitle")}</h2>
            <button
              onClick={handleInitBalances}
              className="text-xs text-blue-600 hover:underline"
              title={t("refreshBalancesTitle")}
            >
              {t("refreshBalances")}
            </button>
          </div>
          <p className="text-xs text-gray-500">
            {t("calendarHint")}
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-gray-700">{t("yearStarts")}</label>
              <select
                value={settingsDraft.leaveYearStartMonth}
                onChange={(e) => setSettingsDraft({ ...settingsDraft, leaveYearStartMonth: parseInt(e.target.value, 10) })}
                className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white"
              >
                {MONTH_NUMBERS.map((m) => (
                  <option key={m} value={m}>{new Date(2000, m - 1, 1).toLocaleDateString(INTL_LOCALE[locale], { month: "long" })}</option>
                ))}
              </select>
              <p className="text-[11px] text-gray-500 mt-1">
                {t("yearStartsHint")}
              </p>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-700">{t("accrual")}</label>
              <select
                value={settingsDraft.accrualFrequency}
                onChange={(e) => setSettingsDraft({ ...settingsDraft, accrualFrequency: e.target.value as AccrualFrequency })}
                className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white"
              >
                <option value="YEARLY">{t("accrualYearly")}</option>
                <option value="MONTHLY">{t("accrualMonthly")}</option>
              </select>
              <p className="text-[11px] text-gray-500 mt-1">
                {t("accrualHint")}
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
                {tc("action.cancel")}
              </button>
              <button
                onClick={handleSaveSettings}
                disabled={savingSettings}
                className="px-3 py-1.5 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {savingSettings ? tc("action.saving") : t("saveSettings")}
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
              <h2 className="text-sm font-semibold text-green-900">{t("suggested")}</h2>
              <p className="text-xs text-green-800 mt-1">
                {t("suggestedHint")}
              </p>
            </div>
            <button
              onClick={handleApplyDefaults}
              className="shrink-0 bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-green-700"
            >
              {t("applyDefaults")}
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
                  <span>{t("daysPerYearShort", { count: d.totalDaysPerYear })}</span>
                  {d.carryForward && <span className="text-blue-600">{"\u21A9"} {d.maxCarryForwardDays}</span>}
                  {!d.proRata && <span className="text-purple-600">{t("noProRata")}</span>}
                  {d.appliesToGender !== 'ALL' && (
                    <span className="text-pink-600">{d.appliesToGender === 'FEMALE' ? t("femaleTag") : t("maleTag")}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {loading ? (
        <p className="text-sm text-gray-500">{tc("state.loading")}</p>
      ) : policies.length === 0 ? (
        <div className="text-center py-12 text-gray-500 text-sm">
          {rbac.canManageHR
            ? t("emptyManage")
            : t("empty")}
          {rbac.canManageHR && (
            <div className="mt-4">
              <button onClick={openCreate} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700">
                {t("newPolicy")}
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
                    {p.isActive ? tc("status.active") : tc("status.inactive")}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-gray-600">
                  <div><span className="text-gray-400">{t("daysYrLabel")} </span>{p.totalDaysPerYear}</div>
                  <div><span className="text-gray-400">{t("paidLabel")} </span>{p.isPaid ? tc("action.yes") : tc("action.no")}</div>
                  <div><span className="text-gray-400">{t("proRataLabel")} </span>{p.proRata ? tc("action.yes") : tc("action.no")}</div>
                  <div><span className="text-gray-400">{t("carryLabel")} </span>{p.carryForward ? t("carryYesShort", { count: Math.round(p.maxCarryForwardDays) }) : tc("action.no")}</div>
                  <div className="col-span-2"><span className="text-gray-400">{t("appliesLabel")} </span>{t(`gender.${p.appliesToGender ?? 'ALL'}`)}</div>
                </div>
                {rbac.canManageHR && (
                  <div className="flex gap-3">
                    <button onClick={() => openEdit(p)} className="text-blue-600 hover:underline text-xs">{tc("action.edit")}</button>
                    <button
                      onClick={() => handleToggleActive(p)}
                      className={p.isActive ? "text-amber-600 hover:underline text-xs" : "text-green-600 hover:underline text-xs"}
                    >
                      {p.isActive ? t("suspend") : t("activate")}
                    </button>
                    <button onClick={() => handleDelete(p.id)} className="text-red-600 hover:underline text-xs">{tc("action.delete")}</button>
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
                  <th className="px-4 py-3 text-left">{tc("field.name")}</th>
                  <th className="px-4 py-3 text-left">{t("code")}</th>
                  <th className="px-4 py-3 text-left">{t("daysPerYear")}</th>
                  <th className="px-4 py-3 text-left">{t("carryForward")}</th>
                  <th className="px-4 py-3 text-left">{t("paid")}</th>
                  <th className="px-4 py-3 text-left">{t("proRata")}</th>
                  <th className="px-4 py-3 text-left">{t("appliesTo")}</th>
                  <th className="px-4 py-3 text-left">{tc("field.status")}</th>
                  {rbac.canManageHR && <th className="px-4 py-3 text-left">{tc("action.actions")}</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {policies.map((p) => (
                  <tr key={p.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900">{p.name}</td>
                    <td className="px-4 py-3 text-gray-500 font-mono">{p.code}</td>
                    <td className="px-4 py-3">{p.totalDaysPerYear}</td>
                    <td className="px-4 py-3">{p.carryForward ? t("carryYes", { count: Math.round(p.maxCarryForwardDays) }) : tc("action.no")}</td>
                    <td className="px-4 py-3">{p.isPaid ? t("paid") : t("unpaid")}</td>
                    <td className="px-4 py-3">{p.proRata ? tc("action.yes") : tc("action.no")}</td>
                    <td className="px-4 py-3">{t(`gender.${p.appliesToGender ?? 'ALL'}`)}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs border ${p.isActive ? "bg-green-50 text-green-700 border-green-200" : "bg-gray-100 text-gray-500 border-gray-200"}`}>
                        {p.isActive ? tc("status.active") : tc("status.inactive")}
                      </span>
                    </td>
                    {rbac.canManageHR && (
                      <td className="px-4 py-3 flex gap-2">
                        <button onClick={() => openEdit(p)} className="text-blue-600 hover:underline text-xs">{tc("action.edit")}</button>
                        <button
                          onClick={() => handleToggleActive(p)}
                          className={p.isActive ? "text-amber-600 hover:underline text-xs" : "text-green-600 hover:underline text-xs"}
                        >
                          {p.isActive ? t("suspend") : t("activate")}
                        </button>
                        <button onClick={() => handleDelete(p.id)} className="text-red-600 hover:underline text-xs">{tc("action.delete")}</button>
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
        <div className="fixed inset-0 bg-walnut-950/55 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
          <div className="bg-white rounded-t-2xl sm:rounded-xl p-5 w-full sm:max-w-md space-y-4 max-h-[90vh] overflow-y-auto">
            <h2 className="font-semibold text-lg">{editId ? t("editTitle") : t("newTitle")}</h2>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="text-sm font-medium">{tc("field.name")}</label>
                <input value={form.name ?? ""} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm mt-1" />
              </div>
              <div>
                <label className="text-sm font-medium">{t("code")}</label>
                <input value={form.code ?? ""} onChange={(e) => setForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))} className="w-full border rounded-lg px-3 py-2 text-sm mt-1 font-mono" />
              </div>
              <div>
                <label className="text-sm font-medium">{t("daysPerYear")}</label>
                <NumberInput min={0} step={1} value={form.totalDaysPerYear ?? 0} emptyValue={0} onChange={(v) => setForm((f) => ({ ...f, totalDaysPerYear: v ?? 0 }))} className="w-full border rounded-lg px-3 py-2 text-sm mt-1" />
              </div>
              <div className="flex items-center gap-2">
                <input id="cf" type="checkbox" checked={form.carryForward ?? false} onChange={(e) => setForm((f) => ({ ...f, carryForward: e.target.checked }))} className="rounded" />
                <label htmlFor="cf" className="text-sm">{t("carryForward")}</label>
              </div>
              <div>
                <label className="text-sm font-medium">{t("maxCarry")}</label>
                <NumberInput min={0} step={1} value={form.maxCarryForwardDays ?? 0} emptyValue={0} onChange={(v) => setForm((f) => ({ ...f, maxCarryForwardDays: v ?? 0 }))} className="w-full border rounded-lg px-3 py-2 text-sm mt-1" disabled={!form.carryForward} />
              </div>
              <div className="flex items-center gap-2">
                <input id="paid" type="checkbox" checked={form.isPaid ?? true} onChange={(e) => setForm((f) => ({ ...f, isPaid: e.target.checked }))} className="rounded" />
                <label htmlFor="paid" className="text-sm">{t("paidLeave")}</label>
              </div>
              <div className="flex items-center gap-2">
                <input id="prorata" type="checkbox" checked={form.proRata ?? true} onChange={(e) => setForm((f) => ({ ...f, proRata: e.target.checked }))} className="rounded" />
                <label htmlFor="prorata" className="text-sm" title={t("proRataTitle")}>{t("proRataJoiners")}</label>
              </div>
              <div className="col-span-2">
                <label className="text-sm font-medium">{t("appliesTo")}</label>
                <select
                  value={form.appliesToGender ?? 'ALL'}
                  onChange={(e) => setForm((f) => ({ ...f, appliesToGender: e.target.value as 'ALL' | 'MALE' | 'FEMALE' }))}
                  className="w-full border rounded-lg px-3 py-2 text-sm mt-1 bg-white"
                >
                  <option value="ALL">{t("gender.ALL")}</option>
                  <option value="FEMALE">{t("femaleOption")}</option>
                  <option value="MALE">{t("maleOption")}</option>
                </select>
              </div>
              <div className="flex items-center gap-2">
                <input id="active" type="checkbox" checked={form.isActive ?? true} onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))} className="rounded" />
                <label htmlFor="active" className="text-sm">{tc("status.active")}</label>
              </div>
            </div>
            <div className="flex gap-2 justify-end pt-2">
              <button onClick={() => setShowForm(false)} className="px-4 py-2 text-sm border rounded-lg hover:bg-gray-50">{tc("action.cancel")}</button>
              <button onClick={handleSave} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700">{tc("action.save")}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
