"use client";

import { useState, useEffect, useCallback } from "react";
import { hrApi, StaffLeaveApplication, StaffLeaveBalance, StaffLeavePolicy, StaffLeaveStatus } from "@/lib/hr-api";
import { useRbac } from "@/lib/rbac";
import { getUser } from "@/lib/auth";
import toast, { Toaster } from "react-hot-toast";
import StaffPicker, { StaffResult } from "@/components/StaffPicker";
import { InfoBanner } from "@/components/ui/InfoBanner";
import { useReadOnlySession, READ_ONLY_TITLE } from '@/lib/support-session';
import { useLocale, useTranslations } from "next-intl";
import { INTL_LOCALE, type Locale } from "@/i18n/config";

const STATUS_STYLES: Record<StaffLeaveStatus, string> = {
  PENDING: "bg-amber-100 text-amber-700 border-amber-200",
  APPROVED: "bg-green-100 text-green-700 border-green-200",
  REJECTED: "bg-red-100 text-red-700 border-red-200",
  CANCELLED: "bg-gray-100 text-gray-600 border-gray-200",
};

const MONTH_NUMBERS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
const now = new Date();

export default function StaffLeavesPage() {
  const rbac = useRbac();
  const t = useTranslations("hr");
  const tc = useTranslations("common");
  const locale = useLocale() as Locale;
  const readOnly = useReadOnlySession();
  const user = getUser();

  const [leaves, setLeaves] = useState<StaffLeaveApplication[]>([]);
  const [policies, setPolicies] = useState<StaffLeavePolicy[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<StaffLeaveStatus | "">("");
  const [filterMonth, setFilterMonth] = useState(now.getMonth() + 1);
  const [filterYear, setFilterYear] = useState(now.getFullYear());

  // Apply form state
  const [showApply, setShowApply] = useState(false);
  const [applyForm, setApplyForm] = useState({
    staffId: user?.staffId ?? "",
    leavePolicyId: "",
    fromDate: "",
    toDate: "",
    leaveDuration: "FULL_DAY" as "FULL_DAY" | "HALF_DAY",
    reason: "",
  });

  // Selected staff for apply form
  const [applyStaff, setApplyStaff] = useState<StaffResult | null>(null);

  // Reject modal
  const [rejectId, setRejectId] = useState<number | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  const loadLeaves = useCallback(async () => {
    setLoading(true);
    try {
      // Non-HR staff: use self-service endpoint (staffId derived from JWT on backend)
      if (!rbac.canAccessHR) {
        const data = await hrApi.leaves.myLeaves({ status: filterStatus || undefined, year: filterYear });
        setLeaves(data);
      } else {
        const params: any = { month: filterMonth, year: filterYear };
        if (filterStatus) params.status = filterStatus;
        const data = await hrApi.leaves.list(params);
        setLeaves(data);
      }
    } catch { toast.error(t("leaves.loadFailed")); }
    finally { setLoading(false); }
  }, [filterMonth, filterYear, filterStatus, rbac.canAccessHR, user?.staffId, t]);

  useEffect(() => {
    hrApi.leavePolicies.list().then(setPolicies).catch(() => {});
    loadLeaves();
  }, [loadLeaves]);

  const handleApply = async () => {
    if (!applyForm.staffId || !applyForm.leavePolicyId || !applyForm.fromDate || !applyForm.toDate || !applyForm.reason) {
      toast.error(t("myLeaves.fillRequired")); return;
    }
    try {
      await hrApi.leaves.apply({ ...applyForm, staffId: Number(applyForm.staffId), leavePolicyId: Number(applyForm.leavePolicyId) });
      toast.success(t("leaves.applied")); setShowApply(false); loadLeaves();
    } catch (e: any) { toast.error(e?.info?.message ?? t("leaves.applyFailed")); }
  };

  const handleApprove = async (id: number) => {
    try { await hrApi.leaves.approve(id); toast.success(t("leaves.approved")); loadLeaves(); }
    catch (e: any) { toast.error(e?.info?.message ?? t("failed")); }
  };

  const handleReject = async () => {
    if (!rejectId) return;
    try { await hrApi.leaves.reject(rejectId, rejectReason); toast.success(t("leaves.rejected")); setRejectId(null); setRejectReason(""); loadLeaves(); }
    catch (e: any) { toast.error(e?.info?.message ?? t("failed")); }
  };

  const handleCancel = async (id: number) => {
    if (!confirm(t("myLeaves.cancelConfirm"))) return;
    try { await hrApi.leaves.cancel(id); toast.success(t("leaves.cancelled")); loadLeaves(); }
    catch (e: any) { toast.error(e?.info?.message ?? t("failed")); }
  };

  return (
    <div className="p-3 sm:p-6 space-y-4">
      <Toaster />
      <div className="flex items-center justify-between">
        <h1 className="font-display text-[22px] sm:text-[26px] font-semibold tracking-[-0.02em] text-ink">{t("leaves.title")}</h1>
        <button onClick={() => setShowApply(true)} disabled={readOnly} title={readOnly ? READ_ONLY_TITLE : undefined} className="bg-blue-600 text-white px-3 py-2 sm:px-4 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed">
          {t("myLeaves.applyButton")}
        </button>
      </div>

      {/* Info Banner */}
      <InfoBanner title={t("leaves.infoTitle")}>
        {t.rich("leaves.infoBody", { strong: (c) => <strong>{c}</strong> })}
      </InfoBanner>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <select value={filterMonth} onChange={(e) => setFilterMonth(Number(e.target.value))} className="border rounded-lg px-3 py-2 text-sm">
          {MONTH_NUMBERS.map((m) => <option key={m} value={m}>{new Date(2000, m - 1, 1).toLocaleDateString(INTL_LOCALE[locale], { month: "short" })}</option>)}
        </select>
        <select value={filterYear} onChange={(e) => setFilterYear(Number(e.target.value))} className="border rounded-lg px-3 py-2 text-sm">
          {[now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1].map((y) => <option key={y}>{y}</option>)}
        </select>
        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value as any)} className="border rounded-lg px-3 py-2 text-sm">
          <option value="">{t("leaves.allStatus")}</option>
          {(["PENDING","APPROVED","REJECTED","CANCELLED"] as StaffLeaveStatus[]).map((s) => <option key={s} value={s}>{t(`leaveStatus.${s}`)}</option>)}
        </select>
        <button onClick={loadLeaves} className="bg-gray-100 border rounded-lg px-3 py-2 text-sm hover:bg-gray-200">{tc("action.refresh")}</button>
      </div>

      {/* Table */}
      {loading ? (
        <p className="text-sm text-gray-500">{tc("state.loading")}</p>
      ) : leaves.length === 0 ? (
        <p className="text-sm text-gray-500">{t("leaves.empty")}</p>
      ) : (
        <>
          {/* Mobile cards */}
          <div className="sm:hidden space-y-3">
            {leaves.map((l) => (
              <div key={l.id} className="bg-white border border-gray-200 rounded-xl p-4 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-medium text-gray-900 text-sm">
                      {rbac.canAccessHR
                        ? l.staff
                          ? `${l.staff.user.firstName} ${l.staff.user.lastName}`
                          : t("overview.staffNo", { id: l.staffId })
                        : ""}
                      {rbac.canAccessHR ? " — " : ""}{l.leavePolicy?.name ?? `#${l.leavePolicyId}`}
                    </p>
                    {rbac.canAccessHR && l.staff?.user?.mobile && (
                      <p className="text-xs text-gray-400">{l.staff.user.mobile}</p>
                    )}
                    <p className="text-xs text-gray-500 mt-0.5">{l.fromDate} → {l.toDate} · {t("overview.daysShort", { count: l.leaveDays })}{l.isLop ? ` (${t("leaves.lopDays", { count: l.lopDays })})` : ""}</p>
                  </div>
                  <span className={`shrink-0 px-2 py-0.5 rounded-full text-xs font-medium border ${STATUS_STYLES[l.status]}`}>{t(`leaveStatus.${l.status}`)}</span>
                </div>
                {rbac.canAccessHR && (
                  <div className="flex gap-3">
                    {l.status === "PENDING" && (
                      <>
                        <button onClick={() => handleApprove(l.id)} disabled={readOnly} title={readOnly ? READ_ONLY_TITLE : undefined} className="text-green-600 hover:underline text-xs disabled:opacity-50 disabled:cursor-not-allowed">{tc("action.approve")}</button>
                        <button onClick={() => { setRejectId(l.id); setRejectReason(""); }} disabled={readOnly} title={readOnly ? READ_ONLY_TITLE : undefined} className="text-red-600 hover:underline text-xs disabled:opacity-50 disabled:cursor-not-allowed">{tc("action.reject")}</button>
                      </>
                    )}
                    {["PENDING","APPROVED"].includes(l.status) && (
                      <button onClick={() => handleCancel(l.id)} disabled={readOnly} title={readOnly ? READ_ONLY_TITLE : undefined} className="text-gray-500 hover:underline text-xs disabled:opacity-50 disabled:cursor-not-allowed">{tc("action.cancel")}</button>
                    )}
                  </div>
                )}
                {!rbac.canAccessHR && ["PENDING","APPROVED"].includes(l.status) && (
                  <button onClick={() => handleCancel(l.id)} disabled={readOnly} title={readOnly ? READ_ONLY_TITLE : undefined} className="text-red-500 hover:underline text-xs disabled:opacity-50 disabled:cursor-not-allowed">{t("myLeaves.cancelApplication")}</button>
                )}
              </div>
            ))}
          </div>

          {/* Tablet+ table */}
          <div className="hidden sm:block overflow-x-auto rounded-xl border border-gray-200">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 text-gray-600 text-xs uppercase">
                <tr>
                  {rbac.canAccessHR && <th className="px-4 py-3 text-left">{t("leaves.staff")}</th>}
                  <th className="px-4 py-3 text-left">{t("myLeaves.leaveType")}</th>
                  <th className="px-4 py-3 text-left">{t("myLeaves.period")}</th>
                  <th className="px-4 py-3 text-left">{t("myLeaves.days")}</th>
                  <th className="px-4 py-3 text-left">{tc("field.status")}</th>
                  <th className="px-4 py-3 text-left">{tc("action.actions")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {leaves.map((l) => (
                  <tr key={l.id} className="hover:bg-gray-50">
                    {rbac.canAccessHR && <td className="px-4 py-3">
                      <div className="font-medium text-gray-900">
                        {l.staff ? `${l.staff.user.firstName} ${l.staff.user.lastName}` : `#${l.staffId}`}
                      </div>
                      {l.staff?.user?.mobile && <div className="text-xs text-gray-400">{l.staff.user.mobile}</div>}
                    </td>}
                    <td className="px-4 py-3">{l.leavePolicy?.name ?? `#${l.leavePolicyId}`}</td>
                    <td className="px-4 py-3">{l.fromDate} → {l.toDate}</td>
                    <td className="px-4 py-3">{l.leaveDays}{l.isLop ? <span className="ml-1 text-red-500 text-xs">({t("leaves.lopDays", { count: l.lopDays })})</span> : null}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${STATUS_STYLES[l.status]}`}>{t(`leaveStatus.${l.status}`)}</span>
                    </td>
                    <td className="px-4 py-3 flex gap-2">
                      {rbac.canAccessHR ? (
                        <>
                          {l.status === "PENDING" && (
                            <>
                              <button onClick={() => handleApprove(l.id)} disabled={readOnly} title={readOnly ? READ_ONLY_TITLE : undefined} className="text-green-600 hover:underline text-xs disabled:opacity-50 disabled:cursor-not-allowed">{tc("action.approve")}</button>
                              <button onClick={() => { setRejectId(l.id); setRejectReason(""); }} disabled={readOnly} title={readOnly ? READ_ONLY_TITLE : undefined} className="text-red-600 hover:underline text-xs disabled:opacity-50 disabled:cursor-not-allowed">{tc("action.reject")}</button>
                            </>
                          )}
                          {["PENDING","APPROVED"].includes(l.status) && (
                            <button onClick={() => handleCancel(l.id)} disabled={readOnly} title={readOnly ? READ_ONLY_TITLE : undefined} className="text-gray-500 hover:underline text-xs disabled:opacity-50 disabled:cursor-not-allowed">{tc("action.cancel")}</button>
                          )}
                        </>
                      ) : (
                        ["PENDING","APPROVED"].includes(l.status) && (
                          <button onClick={() => handleCancel(l.id)} disabled={readOnly} title={readOnly ? READ_ONLY_TITLE : undefined} className="text-gray-500 hover:underline text-xs disabled:opacity-50 disabled:cursor-not-allowed">{tc("action.cancel")}</button>
                        )
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Apply modal */}
      {showApply && (
        <div className="fixed inset-0 bg-walnut-950/55 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
          <div className="bg-white rounded-t-2xl sm:rounded-xl p-5 w-full sm:max-w-md space-y-4 max-h-[90vh] overflow-y-auto">
            <h2 className="font-semibold text-lg">{t("myLeaves.applyTitle")}</h2>
            {rbac.canAccessHR && (
              <StaffPicker
                label={t("leaves.staffMember")}
                value={applyForm.staffId ? Number(applyForm.staffId) : null}
                onChange={(id, staff) => {
                  setApplyForm((f) => ({ ...f, staffId: id ?? "" }));
                  setApplyStaff(staff);
                }}
                required
              />
            )}
            <div>
              <label className="text-sm font-medium">{t("myLeaves.leaveType")}</label>
              <select value={applyForm.leavePolicyId} onChange={(e) => setApplyForm((f) => ({ ...f, leavePolicyId: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm mt-1">
                <option value="">{tc("state.selectPlaceholder")}</option>
                {policies.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium">{tc("field.from")}</label>
                <input type="date" value={applyForm.fromDate} onChange={(e) => setApplyForm((f) => ({ ...f, fromDate: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm mt-1" />
              </div>
              <div>
                <label className="text-sm font-medium">{tc("field.to")}</label>
                <input type="date" value={applyForm.toDate} onChange={(e) => setApplyForm((f) => ({ ...f, toDate: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm mt-1" />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium">{t("myLeaves.duration")}</label>
              <select value={applyForm.leaveDuration} onChange={(e) => setApplyForm((f) => ({ ...f, leaveDuration: e.target.value as any }))} className="w-full border rounded-lg px-3 py-2 text-sm mt-1">
                <option value="FULL_DAY">{t("duration.FULL_DAY")}</option>
                <option value="HALF_DAY">{t("duration.HALF_DAY")}</option>
              </select>
            </div>
            <div>
              <label className="text-sm font-medium">{t("myLeaves.reason")}</label>
              <textarea value={applyForm.reason} onChange={(e) => setApplyForm((f) => ({ ...f, reason: e.target.value }))} rows={3} className="w-full border rounded-lg px-3 py-2 text-sm mt-1" />
            </div>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setShowApply(false)} className="px-4 py-2 text-sm border rounded-lg hover:bg-gray-50">{tc("action.cancel")}</button>
              <button onClick={handleApply} disabled={readOnly} title={readOnly ? READ_ONLY_TITLE : undefined} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed">{tc("action.submit")}</button>
            </div>
          </div>
        </div>
      )}

      {/* Reject modal */}
      {rejectId && (
        <div className="fixed inset-0 bg-walnut-950/55 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-sm space-y-4">
            <h2 className="font-semibold text-lg">{t("leaves.rejectTitle")}</h2>
            <textarea value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} placeholder={t("leaves.rejectPlaceholder")} rows={3} className="w-full border rounded-lg px-3 py-2 text-sm" />
            <div className="flex gap-2 justify-end">
              <button onClick={() => setRejectId(null)} className="px-4 py-2 text-sm border rounded-lg hover:bg-gray-50">{tc("action.cancel")}</button>
              <button onClick={handleReject} disabled={readOnly} title={readOnly ? READ_ONLY_TITLE : undefined} className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed">{tc("action.reject")}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
