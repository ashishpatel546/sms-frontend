"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { hrApi, ComponentSnapshotItem, PayrollEntry, PayrollRun } from "@/lib/hr-api";
import { useRbac } from "@/lib/rbac";
import { generateSalarySlipPdf } from "@/lib/salary-slip-pdf";
import { useSchoolInfo } from "@/lib/useSchoolInfo";
import toast, { Toaster } from "react-hot-toast";
import { useLocale, useTranslations } from "next-intl";
import { INTL_LOCALE, type Locale } from "@/i18n/config";

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

export default function PayrollRunPage() {
  const params = useParams();
  const runId = Number(params.runId);
  const router = useRouter();
  const rbac = useRbac();
  const schoolInfo = useSchoolInfo();
  const t = useTranslations("hr");
  const tc = useTranslations("common");
  const locale = useLocale() as Locale;
  const monthName = (m: number) => new Date(2000, m - 1, 1).toLocaleDateString(INTL_LOCALE[locale], { month: "short" });

  const [run, setRun] = useState<PayrollRun | null>(null);
  const [entries, setEntries] = useState<PayrollEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [recalcId, setRecalcId] = useState<number | null>(null);
  const [downloadingId, setDownloadingId] = useState<number | null>(null);
  const [exportingCsv, setExportingCsv] = useState(false);
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());

  const load = async () => {
    setLoading(true);
    try {
      const [runs, ents] = await Promise.all([
        hrApi.payroll.listRuns(),
        hrApi.payroll.entries(runId),
      ]);
      const found = runs.find((r) => r.id === runId) ?? null;
      setRun(found);
      setEntries(ents);
    } catch { toast.error(t("run.loadFailed")); }
    finally { setLoading(false); }
  };

  useEffect(() => { if (runId) load(); }, [runId]);

  const handleRecalculate = async (staffId: number) => {
    setRecalcId(staffId);
    try {
      const updated = await hrApi.payroll.recalculate(runId, staffId);
      setEntries((prev) => prev.map((e) => (e.staffId === staffId ? updated : e)));
      toast.success(t("run.recalculated"));
    } catch (e: any) { toast.error(e?.info?.message ?? t("failed")); }
    finally { setRecalcId(null); }
  };

  const handleFinalize = async () => {
    if (!run || !confirm(t("payroll.finalizeConfirm", { period: `${monthName(run.month)} ${run.year}` }))) return;
    try {
      await hrApi.payroll.finalize(runId);
      toast.success(t("payroll.finalized"));
      load();
    } catch (e: any) { toast.error(e?.info?.message ?? t("failed")); }
  };

  const handleDownloadSlip = async (entry: PayrollEntry) => {
    setDownloadingId(entry.staffId);
    try {
      const nameParts = [];
      if (entry.staff?.user?.firstName) nameParts.push(entry.staff.user.firstName);
      if (entry.staff?.user?.lastName) nameParts.push(entry.staff.user.lastName);
      const staffName = nameParts.length > 0 ? nameParts.join('-').replace(/\s+/g, '-') : 'Staff';
      
      await generateSalarySlipPdf(entry, {
        fileName: `salary-slip-${run ? `${MONTHS[run.month - 1]}-${run.year}` : `run-${runId}`}-${staffName}-${entry.staffId}.pdf`,
        month: run?.month,
        year: run?.year,
        schoolInfo: schoolInfo || undefined,
      });
    } catch (e: any) { toast.error(t("mySalary.pdfFailed", { error: e?.message ?? "" })); }
    finally { setDownloadingId(null); }
  };

  const handleExportCsv = async () => {
    setExportingCsv(true);
    try { await hrApi.payroll.exportRun(runId); }
    catch (e: any) { toast.error(e?.message ?? t("run.exportFailed")); }
    finally { setExportingCsv(false); }
  };

  const toggleExpand = (id: number) =>
    setExpandedIds((prev) => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s; });

  const totalNet = entries.reduce((s, e) => s + Number(e.netPay), 0);
  const totalDeductions = entries.reduce((s, e) => s + Number(e.totalDeductions), 0);
  const totalGross = entries.reduce((s, e) => s + Number(e.grossEarnings), 0);

  const fmt = (n: number) => `₹${n.toLocaleString(INTL_LOCALE[locale])}`;

  /**
   * Normalises a componentsSnapshot entry into a flat list with label, amount,
   * type, and sort order — handles both the enriched object format (new) and
   * legacy plain-number format (old payroll entries).
   */
  function resolveSnapshotEntries(snapshot: Record<string, ComponentSnapshotItem | number>) {
    const LEGACY_DEDUCTION_KEYS = ["PF", "PT", "TDS", "LOP_AMOUNT"];
    return Object.entries(snapshot)
      .map(([code, val]) => {
        if (typeof val === "object") {
          return { code, label: val.name || code, amount: val.amount, isDeduction: val.type === "DEDUCTION", order: val.displayOrder };
        }
        const isDeduction = LEGACY_DEDUCTION_KEYS.some((d) => code.toUpperCase().includes(d));
        return { code, label: code, amount: val, isDeduction, order: 99 };
      })
      .filter((e) => e.amount > 0)
      .sort((a, b) => a.order - b.order || a.label.localeCompare(b.label));
  }

  return (
    <div className="p-3 sm:p-6 space-y-4">
      <Toaster />
      <div className="flex flex-wrap items-center gap-2 sm:gap-3">
        <button onClick={() => router.back()} className="text-gray-500 hover:text-gray-700 text-sm">← {tc("action.back")}</button>
        <h1 className="font-display text-[22px] sm:text-[26px] font-semibold tracking-[-0.02em] text-ink">
          {t("run.title", { period: run ? `${monthName(run.month)} ${run.year}` : t("mySalary.runNo", { id: runId }) })}
        </h1>
        {run && (
          <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${run.status === "FINALIZED" ? "bg-green-50 text-green-700 border-green-200" : "bg-amber-50 text-amber-700 border-amber-200"}`}>
            {t(`payrollStatus.${run.status}`)}
          </span>
        )}
      </div>

      {/* Summary cards */}
      {!loading && entries.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <div className="text-2xl font-bold text-gray-900">{entries.length}</div>
            <div className="text-xs text-gray-500 mt-1">{t("run.employees")}</div>
          </div>
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <div className="text-2xl font-bold text-green-700">{fmt(totalGross)}</div>
            <div className="text-xs text-gray-500 mt-1">{t("mySalary.gross")}</div>
          </div>
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <div className="text-2xl font-bold text-red-700">{fmt(totalDeductions)}</div>
            <div className="text-xs text-gray-500 mt-1">{t("mySalary.totalDeductions")}</div>
          </div>
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <div className="text-2xl font-bold text-blue-700">{fmt(totalNet)}</div>
            <div className="text-xs text-gray-500 mt-1">{t("run.netPayroll")}</div>
          </div>
        </div>
      )}

      {/* Action buttons */}
      {run?.status === "DRAFT" && rbac.canManagePayroll && (
        <div className="flex justify-end gap-2">
          <button onClick={handleExportCsv} disabled={exportingCsv} className="border border-gray-300 text-gray-700 px-4 py-2 rounded-lg text-sm hover:bg-gray-50 disabled:opacity-60">
            {exportingCsv ? t("run.exporting") : t("run.exportCsv")}
          </button>
          <button onClick={handleFinalize} className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-green-700">
            {t("run.finalizePayroll")}
          </button>
        </div>
      )}
      {run?.status === "FINALIZED" && (
        <div className="flex justify-end">
          <button onClick={handleExportCsv} disabled={exportingCsv} className="border border-gray-300 text-gray-700 px-4 py-2 rounded-lg text-sm hover:bg-gray-50 disabled:opacity-60">
            {exportingCsv ? t("run.exporting") : t("run.exportCsv")}
          </button>
        </div>
      )}

      {/* Entries table */}
      {loading ? (
        <p className="text-sm text-gray-500">{tc("state.loading")}</p>
      ) : entries.length === 0 ? (
        <div className="text-center py-12 text-gray-500 text-sm">{t("run.empty")}</div>
      ) : (
        <>
          {/* Mobile cards */}
          <div className="sm:hidden space-y-3">
            {entries.map((e) => {
              const staffName = e.staff ? `${e.staff.user.firstName} ${e.staff.user.lastName}` : t("overview.staffNo", { id: e.staffId });
              const snapshot = e.componentsSnapshot ?? {};
              const isExpanded = expandedIds.has(e.id);
              const snapshotEntries = resolveSnapshotEntries(snapshot);
              const earningEntries = snapshotEntries.filter((s) => !s.isDeduction);
              const deductionEntries = snapshotEntries.filter((s) => s.isDeduction);
              return (
                <div key={e.id} className="bg-white border border-gray-200 rounded-xl p-4 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold text-gray-900 text-sm">{staffName}</p>
                      {e.staff?.designation && <p className="text-xs text-gray-500">{typeof e.staff.designation === 'string' ? e.staff.designation : (e.staff.designation as any)?.title}</p>}
                    </div>
                    <p className="font-bold text-green-700 shrink-0">{fmt(Number(e.netPay))}</p>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-xs text-gray-600">
                    <div><span className="text-gray-400">{t("run.working")} </span>{e.workingDays}</div>
                    <div><span className="text-gray-400">{t("policies.paid")} </span>{e.paidDays}</div>
                    <div><span className="text-gray-400">{t("run.lop")} </span><span className={e.lopDays > 0 ? "text-red-600" : ""}>{e.lopDays}</span></div>
                    <div><span className="text-gray-400">{t("run.grossMonthlyCtc")} </span>{fmt(Number((e as any).monthlyGrossCTC ?? 0))}</div>
                    <div><span className="text-gray-400">{t("run.earnedGross")} </span>{fmt(Number(e.grossEarnings))}</div>
                    <div className="col-span-3"><span className="text-gray-400">{t("mySalary.deductions")} </span><span className="text-red-600">{fmt(Number(e.totalDeductions))}</span></div>
                  </div>
                  {Object.keys(snapshot).length > 0 && (
                    <button onClick={() => toggleExpand(e.id)} className="text-xs text-blue-600 hover:underline">
                      {isExpanded ? t("run.hideBreakdown") : t("run.showBreakdown")}
                    </button>
                  )}
                  {isExpanded && (
                    <div className="text-xs space-y-1 border-t pt-2">
                      {earningEntries.map((s) => (
                        <div key={s.code} className="flex justify-between"><span className="text-gray-500">{s.label}</span><span className="text-green-700">{fmt(s.amount)}</span></div>
                      ))}
                      {deductionEntries.map((s) => (
                        <div key={s.code} className="flex justify-between"><span className="text-gray-500">{s.label}</span><span className="text-red-600">-{fmt(s.amount)}</span></div>
                      ))}
                    </div>
                  )}
                  <div className="flex gap-3">
                    <button onClick={() => handleDownloadSlip(e)} disabled={downloadingId === e.staffId} className="text-blue-600 hover:underline text-xs disabled:opacity-50">{downloadingId === e.staffId ? "…" : t("mySalary.downloadPdf")}</button>
                    {run?.status === "DRAFT" && rbac.canManagePayroll && (
                      <button onClick={() => handleRecalculate(e.staffId)} disabled={recalcId === e.staffId} className="text-amber-600 hover:underline text-xs disabled:opacity-50">{recalcId === e.staffId ? "…" : t("run.recalculate")}</button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Tablet+ table */}
          <div className="hidden sm:block overflow-x-auto rounded-xl border border-gray-200">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 text-gray-600 text-xs uppercase">
                <tr>
                  <th className="px-4 py-3 text-left">{t("leaves.staff")}</th>
                  <th className="px-4 py-3 text-right">{t("mySalary.workingDays")}</th>
                  <th className="px-4 py-3 text-right">{t("run.paidDays")}</th>
                  <th className="px-4 py-3 text-right">{t("run.lop")}</th>
                  <th className="px-4 py-3 text-right">{t("run.monthlyGrossCtc")}</th>
                  <th className="px-4 py-3 text-right">{t("run.earnedGrossRs")}</th>
                  <th className="px-4 py-3 text-right">{t("run.deductionsRs")}</th>
                  <th className="px-4 py-3 text-right">{t("run.netPayRs")}</th>
                  <th className="px-4 py-3 text-left">{tc("action.actions")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {entries.map((e) => {
                  const staffName = e.staff ? `${e.staff.user.firstName} ${e.staff.user.lastName}` : t("overview.staffNo", { id: e.staffId });
                  const snapshot = e.componentsSnapshot ?? {};
                  const isExpanded = expandedIds.has(e.id);
                  const snapshotEntries = resolveSnapshotEntries(snapshot);
                  const earningEntries = snapshotEntries.filter((s) => !s.isDeduction);
                  const deductionEntries = snapshotEntries.filter((s) => s.isDeduction);
                  return (
                    <tr key={e.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-900">{staffName}</div>
                        {e.staff?.designation && <div className="text-xs text-gray-500">{typeof e.staff.designation === 'string' ? e.staff.designation : (e.staff.designation as any)?.title}</div>}
                      </td>
                      <td className="px-4 py-3 text-right">{e.workingDays}</td>
                      <td className="px-4 py-3 text-right">{e.paidDays}</td>
                      <td className="px-4 py-3 text-right">{e.lopDays > 0 ? <span className="text-red-600">{e.lopDays}</span> : 0}</td>
                      <td className="px-4 py-3 text-right">{fmt(Number((e as any).monthlyGrossCTC ?? 0))}</td>
                      <td className="px-4 py-3 text-right">{fmt(Number(e.grossEarnings))}</td>
                      <td className="px-4 py-3 text-right text-red-600">{fmt(Number(e.totalDeductions))}</td>
                      <td className="px-4 py-3 text-right font-semibold text-green-700">{fmt(Number(e.netPay))}</td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2 items-center">
                          <button onClick={() => handleDownloadSlip(e)} disabled={downloadingId === e.staffId} className="text-blue-600 hover:underline text-xs disabled:opacity-50">{downloadingId === e.staffId ? "…" : "PDF"}</button>
                          {run?.status === "DRAFT" && rbac.canManagePayroll && (
                            <button onClick={() => handleRecalculate(e.staffId)} disabled={recalcId === e.staffId} className="text-amber-600 hover:underline text-xs disabled:opacity-50">{recalcId === e.staffId ? "…" : t("run.recalc")}</button>
                          )}
                          {Object.keys(snapshot).length > 0 && (
                            <button onClick={() => toggleExpand(e.id)} aria-label={isExpanded ? t("run.hideBreakdown") : t("run.showBreakdown")} className="text-gray-500 hover:underline text-xs">{isExpanded ? "▲" : "▼"}</button>
                          )}
                        </div>
                        {isExpanded && (
                          <div className="mt-2 text-xs space-y-0.5 border-t pt-1">
                            {earningEntries.map((s) => (
                              <div key={s.code} className="flex justify-between gap-4"><span className="text-gray-500">{s.label}</span><span className="text-green-700">{fmt(s.amount)}</span></div>
                            ))}
                            {deductionEntries.map((s) => (
                              <div key={s.code} className="flex justify-between gap-4"><span className="text-gray-500">{s.label}</span><span className="text-red-600">-{fmt(s.amount)}</span></div>
                            ))}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
