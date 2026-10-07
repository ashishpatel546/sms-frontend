"use client";

import { useState, useEffect } from "react";
import { hrApi, PayrollRun } from "@/lib/hr-api";
import { useRbac } from "@/lib/rbac";
import toast, { Toaster } from "react-hot-toast";
import Link from "next/link";
import { InfoBanner } from "@/components/ui/InfoBanner";
import { useLocale, useTranslations } from "next-intl";
import { INTL_LOCALE, type Locale } from "@/i18n/config";

const MONTH_NUMBERS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
const now = new Date();

export default function PayrollPage() {
  const rbac = useRbac();
  const t = useTranslations("hr");
  const tc = useTranslations("common");
  const locale = useLocale() as Locale;
  const monthName = (m: number) => new Date(2000, m - 1, 1).toLocaleDateString(INTL_LOCALE[locale], { month: "short" });
  const fmtDate = (d: string) => new Date(d).toLocaleDateString(INTL_LOCALE[locale]);
  const [runs, setRuns] = useState<PayrollRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDraft, setShowDraft] = useState(false);
  const [draftForm, setDraftForm] = useState({ month: now.getMonth() + 1, year: now.getFullYear() });
  const [drafting, setDrafting] = useState(false);
  const [processingId, setProcessingId] = useState<number | null>(null);
  const [unmarkedWarning, setUnmarkedWarning] = useState<any[] | null>(null);

  const load = async () => {
    setLoading(true);
    try { setRuns(await hrApi.payroll.listRuns()); }
    catch { toast.error(t("payroll.loadFailed")); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const handleGenerateDraft = async (force = false) => {
    setDrafting(true);
    try {
      const run = await hrApi.payroll.generateDraft(draftForm.month, draftForm.year, force);
      toast.success(t("payroll.draftCreated", { period: `${monthName(run.month)} ${run.year}` }));
      setShowDraft(false); setUnmarkedWarning(null); load();
    } catch (e: any) { 
      if (e?.info?.unmarked) {
        setUnmarkedWarning(e.info.unmarked);
      } else {
        toast.error(e?.info?.message ?? t("payroll.draftFailed")); 
      }
    }
    finally { setDrafting(false); }
  };

  const handleFinalize = async (runId: number, month: number, year: number) => {
    if (!confirm(t("payroll.finalizeConfirm", { period: `${monthName(month)} ${year}` }))) return;
    try { await hrApi.payroll.finalize(runId); toast.success(t("payroll.finalized")); load(); }
    catch (e: any) { toast.error(e?.info?.message ?? t("payroll.finalizeFailed")); }
  };

  const handleDelete = async (runId: number) => {
    if (!confirm(t("payroll.deleteConfirm"))) return;
    setProcessingId(runId);
    try { await hrApi.payroll.deleteDraft(runId); toast.success(t("payroll.draftDeleted")); load(); }
    catch (e: any) { toast.error(e?.info?.message ?? t("policies.deleteFailed")); }
    finally { setProcessingId(null); }
  };

  const handleRefresh = async (runId: number) => {
    if (!confirm(t("payroll.refreshConfirm"))) return;
    setProcessingId(runId);
    try { await hrApi.payroll.refreshDraft(runId); toast.success(t("payroll.draftRefreshed")); load(); }
    catch (e: any) { toast.error(e?.info?.message ?? t("payroll.refreshFailed")); }
    finally { setProcessingId(null); }
  };

  return (
    <div className="p-3 sm:p-6 space-y-4">
      <Toaster />
      <div className="flex items-center justify-between">
        <h1 className="font-display text-[22px] sm:text-[26px] font-semibold tracking-[-0.02em] text-ink">{t("payroll.title")}</h1>
        {rbac.canManagePayroll && (
          <button onClick={() => setShowDraft(true)} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700">
            {t("payroll.generateButton")}
          </button>
        )}
      </div>

      {/* Info Banner */}
      <InfoBanner title={t("payroll.infoTitle")} variant="indigo">
        {t.rich("payroll.infoBody", { strong: (c) => <strong>{c}</strong>, em: (c) => <em>{c}</em> })}
      </InfoBanner>

      {loading ? (
        <p className="text-sm text-gray-500">{tc("state.loading")}</p>
      ) : runs.length === 0 ? (
        <div className="text-center py-12 text-gray-500 text-sm">{t("payroll.empty")}</div>
      ) : (
        <>
          {/* Mobile cards */}
          <div className="sm:hidden space-y-3">
            {runs.map((r) => (
              <div key={r.id} className="bg-white border border-gray-200 rounded-xl p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-gray-900">{monthName(r.month)} {r.year}</span>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${r.status === "FINALIZED" ? "bg-green-50 text-green-700 border-green-200" : "bg-amber-50 text-amber-700 border-amber-200"}`}>{t(`payrollStatus.${r.status}`)}</span>
                </div>
                <p className="text-xs text-gray-500">{t("payroll.createdOn", { date: fmtDate(r.createdAt) })}{r.finalizedAt ? ` · ${t("payroll.finalizedOn", { date: fmtDate(r.finalizedAt) })}` : ""}</p>
                <div className="flex gap-3">
                  <Link href={`/dashboard/hr/payroll/${r.id}`} className="text-blue-600 hover:underline text-xs">{t("payroll.viewEntries")}</Link>
                  {rbac.canManagePayroll && r.status === "DRAFT" && (
                    <>
                      <button onClick={() => handleRefresh(r.id)} disabled={processingId === r.id} className="text-amber-600 hover:underline text-xs disabled:opacity-50">{tc("action.refresh")}</button>
                      <button onClick={() => handleDelete(r.id)} disabled={processingId === r.id} className="text-red-600 hover:underline text-xs disabled:opacity-50">{tc("action.delete")}</button>
                      <button onClick={() => handleFinalize(r.id, r.month, r.year)} className="text-green-600 hover:underline text-xs">{t("payroll.finalize")}</button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Tablet+ table */}
          <div className="hidden sm:block overflow-x-auto rounded-xl border border-gray-200">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 text-gray-600 text-xs uppercase">
                <tr>
                  <th className="px-4 py-3 text-left">{t("myLeaves.period")}</th>
                  <th className="px-4 py-3 text-left">{tc("field.status")}</th>
                  <th className="px-4 py-3 text-left">{t("payroll.created")}</th>
                  <th className="px-4 py-3 text-left">{t("payroll.finalizedAt")}</th>
                  <th className="px-4 py-3 text-left">{tc("action.actions")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {runs.map((r) => (
                  <tr key={r.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900">{monthName(r.month)} {r.year}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${r.status === "FINALIZED" ? "bg-green-50 text-green-700 border-green-200" : "bg-amber-50 text-amber-700 border-amber-200"}`}>{t(`payrollStatus.${r.status}`)}</span>
                    </td>
                    <td className="px-4 py-3 text-gray-500">{fmtDate(r.createdAt)}</td>
                    <td className="px-4 py-3 text-gray-500">{r.finalizedAt ? fmtDate(r.finalizedAt) : "—"}</td>
                    <td className="px-4 py-3 flex gap-2">
                      <Link href={`/dashboard/hr/payroll/${r.id}`} className="text-blue-600 hover:underline text-xs">{t("payroll.viewEntries")}</Link>
                      {rbac.canManagePayroll && r.status === "DRAFT" && (
                        <>
                          <button onClick={() => handleRefresh(r.id)} disabled={processingId === r.id} className="text-amber-600 hover:underline text-xs disabled:opacity-50">{tc("action.refresh")}</button>
                          <button onClick={() => handleDelete(r.id)} disabled={processingId === r.id} className="text-red-600 hover:underline text-xs disabled:opacity-50">{tc("action.delete")}</button>
                          <button onClick={() => handleFinalize(r.id, r.month, r.year)} className="text-green-600 hover:underline text-xs">{t("payroll.finalize")}</button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Generate draft modal */}
      {showDraft && (
        <div className="fixed inset-0 bg-walnut-950/55 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
          <div className="bg-white rounded-t-2xl sm:rounded-xl p-5 w-full sm:max-w-sm space-y-4">
            <h2 className="font-semibold text-lg">{t("payroll.generateTitle")}</h2>
            {unmarkedWarning ? (
              <div className="space-y-3">
                <div className="bg-red-50 text-red-700 p-3 rounded-lg text-sm border border-red-200">
                  <p className="font-semibold mb-1">{t("payroll.unmarkedTitle")}</p>
                  <p className="mb-2">{t("payroll.unmarkedBody")}</p>
                  <div className="max-h-32 overflow-y-auto text-xs space-y-1">
                    {Array.from(new Set(unmarkedWarning.map((u: any) => t("payroll.unmarkedStaff", { name: u.name, id: u.staffId }))))
                      .slice(0, 10)
                      .map((staffText: string, i: number) => (
                        <div key={i}>• {staffText}</div>
                      ))}
                    {Array.from(new Set(unmarkedWarning.map((u: any) => u.staffId))).length > 10 && (
                      <div>{t("payroll.andMore", { count: Array.from(new Set(unmarkedWarning.map((u: any) => u.staffId))).length - 10 })}</div>
                    )}
                  </div>
                </div>
                <div className="flex gap-2 justify-end">
                  <button onClick={() => setUnmarkedWarning(null)} className="px-4 py-2 text-sm border rounded-lg hover:bg-gray-50">{t("payroll.goBack")}</button>
                  <button onClick={() => handleGenerateDraft(true)} disabled={drafting} className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-60">
                    {drafting ? t("payroll.generating") : t("payroll.generateAnyway")}
                  </button>
                </div>
              </div>
            ) : (
              <>
                <p className="text-sm text-gray-600">
                  {t("payroll.generateHint")}
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-sm font-medium">{t("payroll.month")}</label>
                    <select value={draftForm.month} onChange={(e) => setDraftForm((f) => ({ ...f, month: Number(e.target.value) }))} className="w-full border rounded-lg px-3 py-2 text-sm mt-1">
                      {MONTH_NUMBERS.map((m) => <option key={m} value={m}>{monthName(m)}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-sm font-medium">{t("payroll.year")}</label>
                    <select value={draftForm.year} onChange={(e) => setDraftForm((f) => ({ ...f, year: Number(e.target.value) }))} className="w-full border rounded-lg px-3 py-2 text-sm mt-1">
                      {[now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1].map((y) => <option key={y}>{y}</option>)}
                    </select>
                  </div>
                </div>
                <div className="flex gap-2 justify-end">
                  <button onClick={() => setShowDraft(false)} className="px-4 py-2 text-sm border rounded-lg hover:bg-gray-50">{tc("action.cancel")}</button>
                  <button onClick={() => handleGenerateDraft(false)} disabled={drafting} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-60">
                    {drafting ? t("payroll.generating") : t("payroll.generateDraft")}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
