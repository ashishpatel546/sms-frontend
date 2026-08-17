import React from "react";
import { IndianRupee } from "lucide-react";
import { useAttendance, useFees, useNotifications, useHolidays, useHomework } from "../hooks/useStudentData";
import { Skeleton } from "@/components/ui/skeleton";
import type { AttendanceStatus } from "@/lib/attendanceColors";
import { TodayAttendanceTile } from "./TodayAttendanceTile";
import { TodayHomeworkCard } from "./TodayHomeworkCard";
import { QuickAccessGrid } from "./QuickAccessGrid";
import { AnnouncementBanner } from "./AnnouncementBanner";
import { RecentUpdates } from "./RecentUpdates";
import type { SectionKey } from "../sectionStyle";

/* ═══════════════════════════════════════════════════════════════════════════
   TODAY

   Ordered by what a parent came to find out, in the order they ask it:

     did they get in  →  what was set  →  is anything owed  →  everything else

   The first two share a row so both are above the fold on a phone, with
   attendance the taller of the pair. Below them the sections appear as app
   icons rather than a twelve-tile tab grid — the grid gave every section the
   same weight, which is how a parent portal ends up reading as a staff console.

   Same hooks, same endpoints, same fields as before.
   ═══════════════════════════════════════════════════════════════════════════ */

interface HomeSectionProps {
  studentId: string;
  academicYearString: string;
  sessionId?: number | null;
  onChangeSection: (sec: SectionKey) => void;
}

/** Only the fields this view reads — the endpoints return a good deal more. */
interface AttendanceRecord {
  date: string;
  status: string;
  remarks?: string | null;
}
interface HolidayRow {
  id: number;
  startDate: string;
  endDate: string;
  description: string;
}
interface HomeworkRow {
  id: string;
  subject: string | null;
  message: string;
  worksheetFileName?: string | null;
}

function greeting(hour: number): string {
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

export const HomeSection = ({ studentId, academicYearString, onChangeSection }: HomeSectionProps) => {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  // Use LOCAL date (not UTC) to avoid midnight timezone mismatch in India (IST = UTC+5:30)
  const todayStr = `${year}-${String(month).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

  const { data: attendance, isLoading: isAttLoading } = useAttendance(studentId, year, month);
  const { data: feesData, isLoading: isFeesLoading } = useFees(studentId, academicYearString);
  const { data: notifications, isLoading: isNotifsLoading } = useNotifications();
  const { data: allHolidays } = useHolidays(studentId);
  const { data: homeworkItems, isLoading: isHwLoading } = useHomework(studentId, todayStr);

  // Today's attendance row. The API sends "YYYY-MM-DD" for some rows and a full
  // ISO timestamp for others, hence the slice.
  const todayRec = (attendance?.records as AttendanceRecord[] | undefined)?.find((a) => {
    const d = typeof a.date === 'string' ? a.date.slice(0, 10) : '';
    return d === todayStr;
  });

  // No row yet is a real answer ("the register isn't marked"), not an error.
  const attStatus: AttendanceStatus | null = (todayRec?.status as AttendanceStatus) ?? null;

  /**
   * The holidays endpoint injects synthetic Sundays with negative ids, so a
   * naive "what is today" lookup would label every Sunday with a made-up
   * holiday. Filter those out and fall back to the attendance row's own remark,
   * which is where the string "Sunday" actually comes from.
   */
  const holidayName: string | null = React.useMemo(() => {
    const real = ((allHolidays as HolidayRow[] | undefined) ?? []).filter((h) => Number(h.id) > 0);
    const match = real.find(
      (h) =>
        String(h.startDate).slice(0, 10) <= todayStr && todayStr <= String(h.endDate).slice(0, 10),
    );
    return match?.description ?? todayRec?.remarks ?? null;
  }, [allHolidays, todayStr, todayRec]);

  const totalDue = Number(feesData?.totalDue ?? 0);
  const todayHomework = React.useMemo<HomeworkRow[]>(
    () => (homeworkItems as HomeworkRow[] | undefined) ?? [],
    [homeworkItems],
  );

  // Same expression the attendance tab uses, so the two screens cannot disagree
  // about how many working days the month had.
  const workingDays =
    attendance?.workingDaysCount ?? ((attendance?.total ?? 0) - (attendance?.holiday ?? 0));

  const allNotifs = notifications ?? [];
  const headline = allNotifs[0] ?? null;

  // Distinct subjects only — three rows saying "Maths homework posted" is noise.
  const homeworkSubjects = React.useMemo<string[]>(
    () =>
      Array.from(new Set(todayHomework.map((h) => h.subject || 'General'))).slice(0, 2),
    [todayHomework],
  );

  return (
    <div className="space-y-3.5">
      {/* ── Who this is and when ─────────────────────────────────────────── */}
      <div>
        <h2 className="font-display text-[17px] leading-tight font-bold text-ink">
          {greeting(now.getHours())}, Parent!
        </h2>
        <p className="tabular mt-0.5 text-[11.5px] font-medium text-ink-muted">
          {now.toLocaleDateString('en-IN', {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
            year: 'numeric',
          })}
        </p>
      </div>

      {/* ── The day's two questions, side by side at every width ─────────────
          Not stacked on small screens: attendance and homework together are
          what the page is for, and one above the other pushes homework below
          the fold on a phone. 45/55 keeps the homework text readable at 375px.
      ──────────────────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-[45fr_55fr] gap-3">
        <TodayAttendanceTile
          status={attStatus}
          holidayName={holidayName}
          percentage={attendance?.percentage ?? 0}
          daysPresent={attendance?.present ?? 0}
          workingDays={workingDays}
          isLoading={isAttLoading}
          onOpen={() => onChangeSection('attendance')}
        />
        <TodayHomeworkCard
          items={todayHomework}
          isLoading={isHwLoading}
          onOpen={() => onChangeSection('homework')}
        />
      </div>

      {/* ── Only rendered when something actually wants the parent ────────── */}
      {isFeesLoading ? (
        <Skeleton className="h-16 w-full rounded-xl" />
      ) : (
        totalDue > 0 && (
          <button
            onClick={() => onChangeSection('fees')}
            className="group/due flex w-full cursor-pointer items-center gap-3 rounded-xl border border-accent-warn-edge bg-accent-warn-tint p-3.5 text-left transition-all hover:-translate-y-0.5 hover:shadow-soft"
          >
            <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-accent-warn/15 text-accent-warn-deep">
              <IndianRupee className="size-5" aria-hidden />
            </span>
            <span className="min-w-0 flex-1">
              <span className="tabular block text-[17px] font-bold text-ink">
                ₹{totalDue.toLocaleString('en-IN')}
              </span>
              <span className="block text-[12.5px] text-ink-muted">Fees outstanding</span>
            </span>
            <span className="shrink-0 rounded-lg bg-brand px-3.5 py-2 text-[13px] font-semibold text-brand-contrast transition-transform group-hover/due:scale-105">
              Pay
            </span>
          </button>
        )
      )}

      <QuickAccessGrid onSelect={onChangeSection} />

      {!isNotifsLoading && headline && (
        <AnnouncementBanner title={headline.title} message={headline.message} />
      )}

      <RecentUpdates
        notifications={allNotifs.slice(1, 4)}
        homeworkSubjects={homeworkSubjects}
        isLoading={isNotifsLoading}
        onOpenHomework={() => onChangeSection('homework')}
      />
    </div>
  );
};
