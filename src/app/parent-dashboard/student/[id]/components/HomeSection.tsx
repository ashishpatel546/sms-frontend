import React from "react";
import { useAttendance, useFees, useNotifications, useHolidays, useHomework } from "../hooks/useStudentData";
import type { AttendanceStatus } from "@/lib/attendanceColors";
import { TodayAttendanceTile } from "./TodayAttendanceTile";
import { TodayHomeworkCard } from "./TodayHomeworkCard";
import { TodayFeesTile } from "./TodayFeesTile";
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

      {/* ── Today, in one band ───────────────────────────────────────────────
          Three narrow tiles rather than two wide ones plus a full-width fee
          strip. Each answers one question at a glance — did they get in, is
          there homework, is anything owed — and the detail behind each is one
          tap away. The tiles are a fixed height whatever the data says, so the
          page does not reflow when homework arrives or a fee is paid.
      ──────────────────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        <TodayAttendanceTile
          status={attStatus}
          holidayName={holidayName}
          isLoading={isAttLoading}
          onOpen={() => onChangeSection('attendance')}
        />
        <TodayHomeworkCard
          count={todayHomework.length}
          isLoading={isHwLoading}
          onOpen={() => onChangeSection('homework')}
        />
        <TodayFeesTile
          totalDue={totalDue}
          isLoading={isFeesLoading}
          onOpen={() => onChangeSection('fees')}
        />
      </div>

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
