import React from "react";
import { GlassCard } from "@/components/ui/GlassCard";
import { StatTile } from "@/components/ui/StatTile";
import { useAttendance, useFees, useNotifications, useHolidays, useHomework, useExamResults } from "../hooks/useStudentData";
import { Skeleton } from "@/components/ui/skeleton";

interface HomeSectionProps {
  studentId: string;
  academicYearString: string;
  sessionId?: number | null;
  onChangeSection: (sec: string) => void;
}

export const HomeSection = ({ studentId, academicYearString, sessionId, onChangeSection }: HomeSectionProps) => {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  // Use LOCAL date (not UTC) to avoid midnight timezone mismatch in India (IST = UTC+5:30)
  const todayStr = `${year}-${String(month).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

  const { data: attendance, isLoading: isAttLoading } = useAttendance(studentId, year, month);
  const { data: feesData, isLoading: isFeesLoading } = useFees(studentId, academicYearString);
  const { data: notifications, isLoading: isNotifsLoading } = useNotifications();
  const { data: allHolidays, isLoading: isHolLoading } = useHolidays(studentId);
  const { data: homeworkItems, isLoading: isHwLoading } = useHomework(studentId, todayStr);
  const { data: examResults, isLoading: isExamLoading } = useExamResults(studentId, sessionId ?? null);

  // Upcoming holidays — sort by start date, show future ones (or today), cap at 3
  const upcomingHolidays: any[] = React.useMemo(() => {
    if (!allHolidays) return [];
    const todayDate = new Date(todayStr);
    return (allHolidays as any[])
      .filter((h) => new Date(h.endDate) >= todayDate)
      .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime())
      .slice(0, 3);
  }, [allHolidays, todayStr]);

  // Latest exam: iterate categories newest→oldest, sum across subjects, pick first with real marks.
  // Data shape from API: { categories: string[], subjects: [{ subjectName, marks: { [cat]: { totalMarks, obtainedMarks, ... } } }] }
  const { latestPct, latestCatName } = React.useMemo(() => {
    const cats: string[] = examResults?.categories ?? [];
    const subjects: any[] = examResults?.subjects ?? [];
    for (let i = cats.length - 1; i >= 0; i--) {
      const cat = cats[i];
      let sumTot = 0;
      let sumObt = 0;
      for (const sub of subjects) {
        const m = sub?.marks?.[cat];
        if (!m) continue;
        const th = Number(m.theoryTotalMarks) || 0;
        const pr = Number(m.practicalTotalMarks) || 0;
        const obtTh = Number(m.theoryObtainedMarks) || 0;
        const obtPr = Number(m.practicalObtainedMarks) || 0;
        const tot = th + pr > 0 ? th + pr : (Number(m.totalMarks) || 0);
        const obt = th + pr > 0 ? obtTh + obtPr : (Number(m.obtainedMarks) || 0);
        sumTot += tot;
        sumObt += obt;
      }
      if (sumTot > 0) {
        return { latestPct: `${((sumObt / sumTot) * 100).toFixed(1)}%`, latestCatName: cat };
      }
    }
    return { latestPct: '\u2014', latestCatName: '' };
  }, [examResults]);

  // Today's attendance status
  const todayRec = attendance?.records?.find((a: any) => {
    // Handle both "YYYY-MM-DD" and "YYYY-MM-DDTHH:mm:ss.sssZ" date formats from API
    const d = typeof a.date === 'string' ? a.date.slice(0, 10) : '';
    return d === todayStr;
  });
  const attStatus = todayRec?.status ?? "PENDING";

  // Pending fees — use the same totalDue the fees tab shows (avoids counting upcoming months)
  const pendingFmtd = isFeesLoading
    ? null
    : `₹${Number(feesData?.totalDue ?? 0).toLocaleString('en-IN')}`;

  // Recent notifications (last 3)
  const recentNotifs = notifications?.slice(0, 3) ?? [];

  const attColor =
    attStatus === 'PRESENT' ? 'bg-accent-success' :
    attStatus === 'ABSENT'  ? 'bg-accent-danger'  :
    attStatus === 'LATE'    ? 'bg-yellow-400'      :
    attStatus === 'HALF_DAY' ? 'bg-purple-400'     :
    'bg-accent-warn';

  const attLabel =
    attStatus === 'PENDING'   ? 'Not Marked' :
    attStatus === 'PRESENT'   ? 'Present'    :
    attStatus === 'ABSENT'    ? 'Absent'     :
    attStatus === 'LATE'      ? 'Late'       :
    attStatus === 'HALF_DAY'  ? 'Half Day'   :
    attStatus === 'LEAVE'     ? 'On Leave'   :
    attStatus === 'HOLIDAY'   ? 'Holiday'    : attStatus;

  return (
    <div className="space-y-6">
      {/* Today's Attendance Banner */}
      <GlassCard className="p-5 flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-ink-muted">Today&apos;s Attendance</p>
          <div className="mt-1 flex items-center gap-2">
            {isAttLoading ? (
              <Skeleton className="h-8 w-28" />
            ) : (
              <>
                <div className={`w-3 h-3 rounded-full ${attColor}`} />
                <span className="text-xl font-bold text-ink">{attLabel}</span>
              </>
            )}
          </div>
        </div>
        <button
          onClick={() => onChangeSection("attendance")}
          className="text-brand text-sm font-medium hover:underline"
        >
          View Month →
        </button>
      </GlassCard>

      {/* Quick Actions */}
      <div>
        <p className="text-sm font-semibold text-ink mb-3 px-1">Quick Actions</p>
        <div className="flex gap-3 overflow-x-auto no-scrollbar pb-2">
          <ActionChip title="Pickup QR" icon="📱" onClick={() => onChangeSection("pickup")} />
          <ActionChip title="Apply Leave" icon="📅" onClick={() => onChangeSection("leaves")} />
          <ActionChip title="Homework" icon="📚" onClick={() => onChangeSection("homework")} />
          <ActionChip title="Pay Fees" icon="💳" onClick={() => onChangeSection("fees")} />
        </div>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-2 gap-4">
        <StatTile
          title="Avg Attendance"
          value={isAttLoading ? <Skeleton className="h-7 w-16" /> : `${attendance?.percentage ?? 0}%`}
          icon={<span className="text-lg">📊</span>}
          onClick={() => onChangeSection("attendance")}
        />
        <StatTile
          title="Latest Exam"
          value={(!sessionId || isExamLoading) ? <Skeleton className="h-7 w-16" /> : latestPct}
          delta={sessionId && !isExamLoading && latestCatName ? latestCatName : undefined}
          icon={<span className="text-lg">🏆</span>}
          onClick={() => onChangeSection("results")}
        />
        <StatTile
          title="Pending Fees"
          value={isFeesLoading ? <Skeleton className="h-7 w-20" /> : (pendingFmtd ?? "₹0")}
          icon={<span className="text-lg">💰</span>}
          onClick={() => onChangeSection("fees")}
        />
        <StatTile
          title="Today's Hw"
          value={isHwLoading ? <Skeleton className="h-7 w-10" /> : (homeworkItems?.length > 0 ? `${homeworkItems.length} task${homeworkItems.length > 1 ? 's' : ''}` : 'None')}
          icon={<span className="text-lg">📝</span>}
          onClick={() => onChangeSection("homework")}
        />
      </div>

      {/* Today's Homework + Upcoming Holidays — combined card */}
      <GlassCard className="p-5">
        {/* ── Homework section ── */}
        <div className="flex items-center justify-between mb-3">
          <p className="text-ink font-semibold">Today&apos;s Homework</p>
          <button
            onClick={() => onChangeSection("homework")}
            className="text-brand text-xs font-medium hover:underline"
          >
            View all →
          </button>
        </div>
        {isHwLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        ) : !homeworkItems || homeworkItems.length === 0 ? (
          <p className="text-sm text-ink-muted">No homework today 🎉</p>
        ) : (
          <div className="space-y-3">
            {homeworkItems.slice(0, 3).map((h: any) => (
              <div key={h.id} className="flex items-start gap-3 border-l-2 border-brand/60 pl-3">
                {h.subject && (
                  <span className="text-xs font-bold text-brand uppercase tracking-wide shrink-0 mt-0.5">{h.subject}</span>
                )}
                <p className="text-sm text-ink leading-snug line-clamp-2">{h.message}</p>
              </div>
            ))}
          </div>
        )}

        {/* Divider */}
        <div className="border-t border-slate-200/60 my-4" />

        {/* ── Upcoming Holidays section ── */}
        <div className="flex items-center justify-between mb-3">
          <p className="text-ink font-semibold">Upcoming Holidays</p>
          <button
            onClick={() => onChangeSection("holidays")}
            className="text-brand text-xs font-medium hover:underline"
          >
            View all →
          </button>
        </div>
        {isHolLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : upcomingHolidays.length === 0 ? (
          <p className="text-sm text-ink-muted">No upcoming holidays 💪</p>
        ) : (
          <div className="space-y-2">
            {upcomingHolidays.map((h: any) => {
              const start = new Date(h.startDate);
              const end = new Date(h.endDate);
              const isSingleDay = h.startDate === h.endDate;
              const daysUntil = Math.ceil((start.getTime() - new Date(todayStr).getTime()) / 86400000);
              const isToday = daysUntil === 0;
              const dateLabel = isSingleDay
                ? start.toLocaleDateString("en-IN", { day: "numeric", month: "short" })
                : `${start.toLocaleDateString("en-IN", { day: "numeric", month: "short" })} \u2013 ${end.toLocaleDateString("en-IN", { day: "numeric", month: "short" })}`;
              return (
                <div key={h.id} className="flex items-center gap-3 py-1.5 border-b border-slate-200/60 last:border-0">
                  <div className={`w-10 h-10 rounded-xl flex flex-col items-center justify-center shrink-0 ${
                    isToday ? "bg-accent-success/20 text-accent-success" : "bg-sky-500/15 text-sky-600"
                  }`}>
                    <span className="text-xs font-bold leading-none">{start.toLocaleDateString("en-IN", { day: "numeric" })}</span>
                    <span className="text-[9px] uppercase font-semibold opacity-80">{start.toLocaleDateString("en-IN", { month: "short" })}</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-ink leading-tight truncate">{h.description}</p>
                    <p className="text-[11px] text-ink-muted mt-0.5">
                      {isToday ? "🎉 Today" : daysUntil === 1 ? "Tomorrow" : `In ${daysUntil} days`}
                      {!isSingleDay && ` \u00b7 ${dateLabel}`}
                    </p>
                  </div>
                  {h.isEntireSchool && (
                    <span className="text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-600 shrink-0">School</span>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </GlassCard>

      {/* Recent Notifications */}
      <GlassCard className="p-5">
        <div className="flex items-center justify-between mb-3">
          <p className="text-ink font-semibold">Recent Notifications</p>
          <button
            onClick={() => onChangeSection("notifications")}
            className="text-brand text-xs font-medium hover:underline"
          >
            View all →
          </button>
        </div>
        {isNotifsLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        ) : recentNotifs.length === 0 ? (
          <p className="text-sm text-ink-muted">No notifications yet</p>
        ) : (
          <div className="space-y-3">
            {recentNotifs.map((n) => (
              <div key={n.id} className="flex gap-3 items-start">
                <div className="w-2 h-2 rounded-full bg-brand mt-1.5 shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-ink leading-tight truncate">{n.title}</p>
                  <p className="text-xs text-ink-muted leading-relaxed line-clamp-2">{n.message}</p>
                  <p className="text-[10px] text-ink-muted mt-0.5">
                    {new Date(n.createdAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </GlassCard>
    </div>
  );
};

const ActionChip = ({ title, icon, onClick }: { title: string; icon: React.ReactNode; onClick: () => void }) => (
  <button
    onClick={onClick}
    className="shrink-0 flex items-center gap-2 bg-surface border border-slate-200 dark:border-white/10 px-4 py-2.5 rounded-xl shadow-sm hover:border-brand/40 hover:shadow-md transition-all"
  >
    <span>{icon}</span>
    <span className="text-sm font-medium text-ink">{title}</span>
  </button>
);
