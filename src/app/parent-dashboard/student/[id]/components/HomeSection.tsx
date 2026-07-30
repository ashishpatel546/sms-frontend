import React from "react";
import {
  BookOpen,
  CalendarCheck,
  CalendarDays,
  CalendarX,
  ChevronRight,
  ClipboardList,
  IndianRupee,
  Paperclip,
  QrCode,
  Trophy,
  type LucideIcon,
} from "lucide-react";
import { Panel } from "@/components/ui/Panel";
import { StatTile } from "@/components/ui/StatTile";
import { AttendanceStamp, type StampStatus } from "@/components/ui/AttendanceStamp";
import { useAttendance, useFees, useNotifications, useHolidays, useHomework, useExamResults } from "../hooks/useStudentData";
import { Skeleton } from "@/components/ui/skeleton";

/* ═══════════════════════════════════════════════════════════════════════════
   TODAY — the diary page.

   This used to be a dashboard: a status strip, a chip rail, four KPI tiles,
   then panels. Which is to say, the staff console with a parent's data in it —
   the answer a parent actually came for was the fifth thing down the page.

   It is now a dated page read top to bottom, the way the diary in the school
   bag is read: the stamp first, then what was set today, then anything wanting
   the parent, and only then the month's figures. Bands divide it the way rules
   divide a page.

   Nothing about the data changed — same hooks, same endpoints, same fields.
   ═══════════════════════════════════════════════════════════════════════════ */

interface HomeSectionProps {
  studentId: string;
  academicYearString: string;
  sessionId?: number | null;
  onChangeSection: (sec: string) => void;
}

/** A section rule: `today ─────────────`. */
const Band = ({ children, action }: { children: React.ReactNode; action?: React.ReactNode }) => (
  <div className="mb-3 flex items-center gap-3">
    <div className="diary-band min-w-0 flex-1">
      <span className="eyebrow shrink-0">{children}</span>
    </div>
    {action}
  </div>
);

const BandLink = ({ onClick, children }: { onClick: () => void; children: React.ReactNode }) => (
  <button
    onClick={onClick}
    className="group/bl flex shrink-0 cursor-pointer items-center gap-0.5 text-[12px] font-semibold text-brand transition-colors hover:text-brand-deep"
  >
    {children}
    <ChevronRight className="size-3.5 transition-transform group-hover/bl:translate-x-0.5" aria-hidden />
  </button>
);

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
    return { latestPct: '—', latestCatName: '' };
  }, [examResults]);

  // Today's attendance status
  const todayRec = attendance?.records?.find((a: any) => {
    // Handle both "YYYY-MM-DD" and "YYYY-MM-DDTHH:mm:ss.sssZ" date formats from API
    const d = typeof a.date === 'string' ? a.date.slice(0, 10) : '';
    return d === todayStr;
  });
  const attStatus = (todayRec?.status ?? "PENDING") as StampStatus;

  // Pending fees — use the same totalDue the fees tab shows (avoids counting upcoming months)
  const totalDue = Number(feesData?.totalDue ?? 0);
  const pendingFmtd = isFeesLoading ? null : `₹${totalDue.toLocaleString('en-IN')}`;

  // Recent notifications (last 3)
  const recentNotifs = notifications?.slice(0, 3) ?? [];

  const todayHomework = homeworkItems ?? [];

  // Same expression the attendance tab uses, so the two screens cannot disagree
  // about how many working days the month had.
  const workingDays =
    attendance?.workingDaysCount ?? ((attendance?.total ?? 0) - (attendance?.holiday ?? 0));

  return (
    <div className="space-y-7">
      {/* ── The page head: what day this is ─────────────────────────────── */}
      <div className="diary-band">
        <span className="tabular shrink-0 text-[12.5px] font-semibold tracking-[0.14em] text-ink-muted uppercase">
          {now.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}
        </span>
      </div>

      {/* ── The stamp ───────────────────────────────────────────────────── */}
      <div className="flex flex-col items-center py-2">
        {isAttLoading ? (
          <Skeleton className="h-18.5 w-44 rounded-xl" />
        ) : (
          <AttendanceStamp
            status={attStatus}
            date={now}
            time={todayRec?.checkInTime ?? null}
          />
        )}
        <button
          onClick={() => onChangeSection("attendance")}
          className="mt-3 cursor-pointer text-[12.5px] font-semibold text-brand hover:underline"
        >
          View the month
        </button>
      </div>

      {/* ── What was set today ──────────────────────────────────────────── */}
      <section>
        <Band action={<BandLink onClick={() => onChangeSection("homework")}>All homework</BandLink>}>
          Set today
        </Band>
        {isHwLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-11 w-full" />
            <Skeleton className="h-11 w-full" />
          </div>
        ) : todayHomework.length === 0 ? (
          <p className="py-1 text-[13.5px] text-ink-muted">Nothing was set today.</p>
        ) : (
          <ul className="stagger divide-y divide-line">
            {todayHomework.slice(0, 4).map((h: any) => (
              <li key={h.id} className="flex items-start gap-3 py-2.5">
                {/* The subject sits in the margin, in the register hand — the
                    way a diary entry is headed before the task is written. */}
                <span className="tabular w-20 shrink-0 pt-0.5 text-[10.5px] font-semibold tracking-widest text-brand uppercase">
                  {h.subject || '—'}
                </span>
                <p className="line-clamp-2 flex-1 text-[13.5px] leading-snug text-ink">{h.message}</p>
                {h.worksheetFileName && (
                  <Paperclip className="mt-0.5 size-3.5 shrink-0 text-ink-faint" aria-label="Worksheet attached" />
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ── Only rendered when something actually wants the parent ──────── */}
      {!isFeesLoading && totalDue > 0 && (
        <section>
          <Band>Needs you</Band>
          <button
            onClick={() => onChangeSection("fees")}
            className="group/due flex w-full cursor-pointer items-center gap-3 rounded-xl border border-accent-warn-edge bg-accent-warn-tint p-3.5 text-left transition-all hover:-translate-y-0.5 hover:shadow-soft"
          >
            <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-accent-warn/15 text-accent-warn-deep">
              <IndianRupee className="size-5" aria-hidden />
            </span>
            <span className="min-w-0 flex-1">
              <span className="tabular block text-[17px] font-bold text-ink">{pendingFmtd}</span>
              <span className="block text-[12.5px] text-ink-muted">Fees outstanding</span>
            </span>
            <span className="shrink-0 rounded-lg bg-brand px-3.5 py-2 text-[13px] font-semibold text-brand-contrast transition-transform group-hover/due:scale-105">
              Pay
            </span>
          </button>
        </section>
      )}

      {/* ── Jump to ─────────────────────────────────────────────────────── */}
      <section>
        <Band>Jump to</Band>
        <div className="no-scrollbar flex gap-2.5 overflow-x-auto pb-1">
          <ActionChip title="QR codes" icon={QrCode} onClick={() => onChangeSection("pickup")} />
          <ActionChip title="Apply for leave" icon={CalendarDays} onClick={() => onChangeSection("leaves")} />
          <ActionChip title="Homework" icon={BookOpen} onClick={() => onChangeSection("homework")} />
          <ActionChip title="Pay fees" icon={IndianRupee} onClick={() => onChangeSection("fees")} />
        </div>
      </section>

      {/* ── The month's figures, below the day's news ───────────────────── */}
      <section>
        <Band>This month</Band>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
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
          {/* Days present / absent rather than repeating the fee total and the
              homework count — both of those are already stated above, and a
              figure shown twice on one screen reads as two different facts.
              These also actually belong under "this month". */}
          <StatTile
            label="Days present"
            value={isAttLoading ? <Skeleton className="h-7 w-10" /> : String(attendance?.present ?? 0)}
            hint={`of ${workingDays} working days`}
            icon={<CalendarCheck />}
            pigment="success"
            onClick={() => onChangeSection("attendance")}
          />
          <StatTile
            label="Days absent"
            value={isAttLoading ? <Skeleton className="h-7 w-10" /> : String(attendance?.absent ?? 0)}
            icon={<CalendarX />}
            pigment={(attendance?.absent ?? 0) > 0 ? "danger" : "neutral"}
            onClick={() => onChangeSection("attendance")}
          />
        </div>
      </section>

      {/* ── Coming up ───────────────────────────────────────────────────── */}
      <section>
        <Band action={<BandLink onClick={() => onChangeSection("holidays")}>All holidays</BandLink>}>
          Coming up
        </Band>
        {isHolLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-11 w-full" />
            <Skeleton className="h-11 w-full" />
          </div>
        ) : upcomingHolidays.length === 0 ? (
          <p className="py-1 text-[13.5px] text-ink-muted">No holidays scheduled.</p>
        ) : (
          <ul className="stagger divide-y divide-line">
            {upcomingHolidays.map((h: any) => {
              const start = new Date(h.startDate);
              const end = new Date(h.endDate);
              const isSingleDay = h.startDate === h.endDate;
              const daysUntil = Math.ceil((start.getTime() - new Date(todayStr).getTime()) / 86400000);
              const isToday = daysUntil === 0;
              const dateLabel = isSingleDay
                ? start.toLocaleDateString("en-IN", { day: "numeric", month: "short" })
                : `${start.toLocaleDateString("en-IN", { day: "numeric", month: "short" })} – ${end.toLocaleDateString("en-IN", { day: "numeric", month: "short" })}`;
              return (
                <li key={h.id} className="flex items-center gap-3 py-2.5">
                  <span className="grid size-10 shrink-0 place-items-center rounded-lg border border-line bg-surface-secondary">
                    <span className="tabular text-[13px] leading-none font-bold text-ink">
                      {start.toLocaleDateString("en-IN", { day: "numeric" })}
                    </span>
                    <span className="tabular mt-0.5 text-[8.5px] leading-none font-semibold tracking-wider text-ink-muted uppercase">
                      {start.toLocaleDateString("en-IN", { month: "short" })}
                    </span>
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13.5px] leading-tight font-semibold text-ink">{h.description}</span>
                    <span className="mt-0.5 block text-[11.5px] text-ink-muted">
                      {isToday ? "Today" : daysUntil === 1 ? "Tomorrow" : `In ${daysUntil} days`}
                      {!isSingleDay && ` · ${dateLabel}`}
                    </span>
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* ── From school ─────────────────────────────────────────────────── */}
      <section>
        <Band action={<BandLink onClick={() => onChangeSection("notifications")}>All notices</BandLink>}>
          From school
        </Band>
        {isNotifsLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-11 w-full" />
            <Skeleton className="h-11 w-full" />
          </div>
        ) : recentNotifs.length === 0 ? (
          <p className="py-1 text-[13.5px] text-ink-muted">Nothing from the school yet.</p>
        ) : (
          <ul className="stagger divide-y divide-line">
            {recentNotifs.map((n) => (
              <li key={n.id} className="flex gap-3 py-2.5">
                <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-brand" aria-hidden />
                <div className="min-w-0">
                  <p className="truncate text-[13.5px] leading-tight font-semibold text-ink">{n.title}</p>
                  <p className="mt-0.5 line-clamp-2 text-[12.5px] leading-relaxed text-ink-muted">{n.message}</p>
                  <p className="tabular mt-1 text-[10.5px] text-ink-faint">
                    {new Date(n.createdAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
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
