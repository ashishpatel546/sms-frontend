"use client";

import { useState, useEffect } from "react";
import { hrApi, PayrollRun, StaffLeaveApplication, StaffAttendanceRecord } from "@/lib/hr-api";
import { todayLocalDate } from "@/lib/utils";
import { useRbac } from "@/lib/rbac";
import toast, { Toaster } from "react-hot-toast";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { INTL_LOCALE, type Locale } from "@/i18n/config";

export default function HrOverviewPage() {
  const rbac = useRbac();
  const t = useTranslations("hr");
  const tc = useTranslations("common");
  const locale = useLocale() as Locale;
  const monthName = (m: number) => new Date(2000, m - 1, 1).toLocaleDateString(INTL_LOCALE[locale], { month: "short" });
  const [runs, setRuns] = useState<PayrollRun[]>([]);
  const [pendingLeaves, setPendingLeaves] = useState<StaffLeaveApplication[]>([]);
  const [todayAttendance, setTodayAttendance] = useState<StaffAttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const today = todayLocalDate();

  useEffect(() => {
    const load = async () => {
      try {
        const [lr, pl, ta] = await Promise.allSettled([
          hrApi.payroll.listRuns(),
          hrApi.leaves.list({ status: "PENDING" }),
          hrApi.attendance.daily(today),
        ]);
        if (lr.status === "fulfilled") setRuns(lr.value.slice(0, 3));
        if (pl.status === "fulfilled") setPendingLeaves(pl.value);
        if (ta.status === "fulfilled") setTodayAttendance(ta.value.data);
      } catch {
        // Partial failures are OK — each settled independently above
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [today]);

  const present = todayAttendance.filter((a) => ["PRESENT", "LATE"].includes(a.status)).length;
  const absent = todayAttendance.filter((a) => a.status === "ABSENT").length;

  if (loading) return <div className="p-6 text-sm text-gray-500">{t("overview.loading")}</div>;

  return (
    <div className="p-3 sm:p-6 space-y-6">
      <Toaster />
      <h1 className="font-display text-[22px] sm:text-[26px] font-semibold tracking-[-0.02em] text-ink">{t("overview.title")}</h1>

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label={t("overview.presentToday")} value={present} color="green" />
        <StatCard label={t("overview.absentToday")} value={absent} color="red" />
        <StatCard label={t("overview.pendingLeaves")} value={pendingLeaves.length} color="amber" />
        <StatCard label={t("overview.payrollRuns")} value={runs.length} color="blue" />
      </div>

      {/* Pending leaves quick list */}
      {pendingLeaves.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-gray-800">{t("overview.pendingApprovals")}</h2>
            <Link href="/dashboard/hr/leaves" className="text-sm text-blue-600 hover:underline">
              {tc("action.viewAll")}
            </Link>
          </div>
          <ul className="divide-y divide-gray-100">
            {pendingLeaves.slice(0, 5).map((l) => (
              <li key={l.id} className="py-2 text-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-0.5">
                <span className="text-gray-700">{t("overview.staffNo", { id: l.staffId })} — {l.leavePolicy?.name ?? t("overview.policyNo", { id: l.leavePolicyId })}</span>
                <span className="text-gray-500 text-xs sm:text-sm">{l.fromDate} → {l.toDate} ({t("overview.daysShort", { count: l.leaveDays })})</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Recent payroll runs */}
      {runs.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-gray-800">{t("overview.recentRuns")}</h2>
            <Link href="/dashboard/hr/payroll" className="text-sm text-blue-600 hover:underline">
              {tc("action.viewAll")}
            </Link>
          </div>
          <ul className="divide-y divide-gray-100">
            {runs.map((r) => (
              <li key={r.id} className="py-2 text-sm flex items-center justify-between">
                <Link href={`/dashboard/hr/payroll/${r.id}`} className="text-blue-600 hover:underline">
                  {monthName(r.month)} {r.year}
                </Link>
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${r.status === "FINALIZED" ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"}`}>
                  {t(`payrollStatus.${r.status}`)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Quick links */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {[
          { href: "/dashboard/hr/staff-attendance", label: t("overview.links.markAttendance") },
          { href: "/dashboard/hr/leaves", label: t("overview.links.manageLeaves") },
          { href: "/dashboard/hr/leave-policies", label: t("overview.links.leavePolicies") },
          { href: "/dashboard/hr/salary-config", label: t("overview.links.salaryConfig") },
          { href: "/dashboard/hr/payroll", label: t("overview.links.runPayroll") },
          { href: "/dashboard/hr/staff-attendance/zones", label: t("overview.links.attendanceZones") },
        ].map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="block p-3 bg-white border border-gray-200 rounded-lg hover:border-blue-400 hover:bg-blue-50 text-sm font-medium text-gray-700 transition-colors"
          >
            {link.label}
          </Link>
        ))}
      </div>
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  const colors: Record<string, string> = {
    green: "bg-green-50 border-green-200 text-green-700",
    red: "bg-red-50 border-red-200 text-red-700",
    amber: "bg-amber-50 border-amber-200 text-amber-700",
    blue: "bg-blue-50 border-blue-200 text-blue-700",
  };
  return (
    <div className={`rounded-xl border p-4 ${colors[color]}`}>
      <div className="text-3xl font-bold">{value}</div>
      <div className="text-sm mt-1">{label}</div>
    </div>
  );
}
