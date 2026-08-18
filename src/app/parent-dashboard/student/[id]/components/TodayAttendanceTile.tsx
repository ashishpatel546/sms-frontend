import React from 'react';
import { Check, X, Clock, CircleDot, Plane, Palmtree, HelpCircle, ChevronRight } from 'lucide-react';
import {
  ATTENDANCE_TONE,
  ATTENDANCE_NOT_MARKED,
  type AttendanceStatus,
} from '@/lib/attendanceColors';
import { Skeleton } from '@/components/ui/skeleton';

/* ═══════════════════════════════════════════════════════════════════════════
   Did my child reach school today?

   The one question every parent opens this page for, so it is the first thing
   on it and the tallest thing in its row.

   The card itself stays plain surface; only the stamp carries colour. A card
   washed in the status colour was tried and rejected: it needs a second set of
   hues that have to work on both grounds, and it turns an absent day into a
   red block, which is louder than the fact deserves.
   ═══════════════════════════════════════════════════════════════════════════ */

const STATUS_ICON: Record<AttendanceStatus, typeof Check> = {
  PRESENT: Check,
  ABSENT: X,
  LATE: Clock,
  HALF_DAY: CircleDot,
  LEAVE: Plane,
  HOLIDAY: Palmtree,
  SUNDAY: Palmtree,
};

interface TodayAttendanceTileProps {
  /** Null when the register has no row for today yet. */
  status: AttendanceStatus | null;
  /** e.g. "Independence Day" — only when the day is a holiday. */
  holidayName?: string | null;
  isLoading: boolean;
  onOpen: () => void;
}

export const TodayAttendanceTile = ({
  status,
  holidayName,
  isLoading,
  onOpen,
}: TodayAttendanceTileProps) => {
  const tone = status ? ATTENDANCE_TONE[status] : null;
  const Icon = status ? STATUS_ICON[status] : HelpCircle;
  const ink = tone?.stamp ?? ATTENDANCE_NOT_MARKED.stamp;
  const label = tone?.label ?? ATTENDANCE_NOT_MARKED.label;
  const borderStyle = status ? 'border-solid' : ATTENDANCE_NOT_MARKED.border;

  const isRestDay = status === 'HOLIDAY' || status === 'SUNDAY';

  return (
    <button
      onClick={onOpen}
      aria-label={`Today's attendance: ${label}. Open the attendance month.`}
      className="flex min-h-33 w-full cursor-pointer flex-col items-center gap-1 rounded-xl border border-line bg-surface p-2.5 text-center shadow-soft transition-all hover:-translate-y-0.5 hover:border-brand-edge hover:shadow-raised focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none"
    >
      <span className="eyebrow w-full text-left">Today</span>

      {isLoading ? (
        <Skeleton className="mt-2 h-13 w-20 rounded-lg" />
      ) : (
        <span
          /* The off-square tilt is the portal's existing stamp gesture — a
             rubber stamp pressed by hand, not a status pill. */
          className={`mt-1.5 inline-flex -rotate-2 flex-col items-center gap-0.5 rounded-lg border-2 px-2 pt-1.5 pb-1 ${borderStyle} ${ink}`}
        >
          <Icon className="size-4.5" strokeWidth={3} aria-hidden />
          <span className="font-display text-[10px] leading-tight font-extrabold tracking-[0.06em] uppercase">
            {label}
          </span>
        </span>
      )}

      {isRestDay && holidayName && (
        <span className="line-clamp-1 text-[10px] leading-tight text-ink-muted">{holidayName}</span>
      )}

      <span className="mt-auto flex items-center gap-0.5 pt-1.5 text-[11px] font-semibold text-brand">
        View
        <ChevronRight className="size-3.5" aria-hidden />
      </span>
    </button>
  );
};
