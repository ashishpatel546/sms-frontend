import React from "react";
import {
  BookOpen,
  CalendarDays,
  ClipboardList,
  IndianRupee,
  QrCode,
  Trophy,
  type LucideIcon,
} from "lucide-react";
import { Panel } from "@/components/ui/Panel";
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
      <Panel className="flex items-center justify-between p-4">
        <div>
          <p className="eyebrow">Attendance today</p>
          <div className="mt-1.5 flex items-center gap-2">
            {isAttLoading ? (
              <Skeleton className="h-7 w-28" />
            ) : (
              <>
                <span className={`size-2.5 rounded-full ${attColor}`} aria-hidden />
                <span className="font-display text-[19px] font-semibold text-ink">{attLabel}</span>
              </>
            )}
          </div>
        </div>
        <button
          onClick={() => onChangeSection("attendance")}
          className="cursor-pointer text-[13px] font-semibold text-brand hover:underline"
        >
          View the month
        </button>
      </Panel>

      {/* Quick Actions */}
      <div>
        <p className="eyebrow mb-2.5 px-1">Jump to</p>
        <div className="no-scrollbar flex gap-2.5 overflow-x-auto pb-2">
          <ActionChip title="QR codes" icon={QrCode} onClick={() => onChangeSection("pickup")} />
          <ActionChip title="Apply for leave" icon={CalendarDays} onClick={() => onChangeSection("leaves")} />
          <ActionChip title="Homework" icon={BookOpen} onClick={() => onChangeSection("homework")} />
          <ActionChip title="Pay fees" icon={IndianRupee} onClick={() => onChangeSection("fees")} />
        </div>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-2 gap-4">
        <StatTile
          label="Attendance"
          value={isAttLoading ? <Skeleton className="h-7 w-16" /> : `${attendance?.percentage ?? 0}%`}
          hint="This month"
          icon={<ClipboardList />}
          pigment="success"
          onClick={() => onChangeSection("attendance")}
        />
        <StatTile
          label="Latest exam"
          value={(!sessionId || isExamLoading) ? <Skeleton className="h-7 w-16" /> : latestPct}
          hint={sessionId && !isExamLoading && latestCatName ? latestCatName : undefined}
          icon={<Trophy />}
          pigment="info"
          onClick={() => onChangeSection("results")}
        />
        <StatTile
          label="Fees due"
          value={isFeesLoading ? <Skeleton className="h-7 w-20" /> : (pendingFmtd ?? "₹0")}
          icon={<IndianRupee />}
          pigment="attn"
          onClick={() => onChangeSection("fees")}
        />
        <StatTile
          label="Homework today"
          value={isHwLoading ? <Skeleton className="h-7 w-10" /> : (homeworkItems?.length > 0 ? `${homeworkItems.length} task${homeworkItems.length > 1 ? 's' : ''}` : 'None')}
          icon={<BookOpen />}
          pigment="info"
          onClick={() => onChangeSection("homework")}
        />
      </div>

      {/* Today's Homework + Upcoming Holidays — combined card */}
      <Panel className="p-4">
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
                <p className="text-sm text-ink leading-snug line-clamp-2 flex-1">{h.message}</p>
                {h.worksheetFileName && (
                  <svg
                    className="w-3.5 h-3.5 text-ink-muted shrink-0 mt-0.5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    aria-label="Worksheet attached"
                  >
                    <title>Worksheet attached</title>
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                  </svg>
                )}
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
                      {isToday ? "Today" : daysUntil === 1 ? "Tomorrow" : `In ${daysUntil} days`}
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
      </Panel>

      {/* Recent Notifications */}
      <Panel className="p-4">
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
      </Panel>
    </div>
  );
};

const ActionChip = ({
  title,
  icon: Icon,
  onClick,
}: {
  title: string;
  icon: LucideIcon;
  onClick: () => void;
}) => (
  <button
    onClick={onClick}
    className="flex shrink-0 cursor-pointer items-center gap-2 rounded-lg border border-line bg-surface px-3 py-2.5 text-[13px] font-medium text-ink shadow-soft transition-all hover:border-brand-edge hover:bg-brand-tint hover:text-brand active:scale-95"
  >
    <Icon className="size-4 shrink-0 text-brand" aria-hidden />
    {title}
  </button>
);
