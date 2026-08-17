"use client";

import { CalendarDays } from 'lucide-react';
import React, { useEffect } from "react";
import { useAttendance } from "../hooks/useStudentData";
import { Skeleton } from "@/components/ui/skeleton";

interface Props {
  studentId: string;
  isOpen: boolean;
  onClose: () => void;
  onViewFull: () => void;
}

// LATE and HALF_DAY count as present, so their circle is split diagonally —
// present green plus the status's own color — matching the full calendar's cells.
const STATUS_CONFIG: Record<string, { label: string; circleBg: string; ringColor: string; circleStyle?: React.CSSProperties }> = {
  PRESENT:  { label: "P",  circleBg: "bg-green-500 text-white",                       ringColor: "ring-green-300"  },
  ABSENT:   { label: "A",  circleBg: "bg-red-500 text-white",                         ringColor: "ring-red-300"    },
  LATE:     { label: "L",  circleBg: "text-white",                                    ringColor: "ring-yellow-300", circleStyle: { background: "linear-gradient(135deg, #22c55e 50%, #facc15 50%)" } },
  HALF_DAY: { label: "H",  circleBg: "text-white",                                    ringColor: "ring-purple-300", circleStyle: { background: "linear-gradient(135deg, #22c55e 50%, #a855f7 50%)" } },
  LEAVE:    { label: "Lv", circleBg: "bg-blue-500 text-white",                        ringColor: "ring-blue-300"   },
  HOLIDAY:  { label: "Ho", circleBg: "bg-sky-400 text-white",                         ringColor: "ring-sky-300"    },
  SUNDAY:   { label: "—",  circleBg: "bg-orange-100 text-orange-700 border border-orange-200", ringColor: "ring-orange-200" },
};

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export const AttendanceBottomSheet = ({ studentId, isOpen, onClose, onViewFull }: Props) => {
  const now = new Date();
  const year  = now.getFullYear();
  const month = now.getMonth() + 1;
  const todayStr = `${year}-${String(month).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

  const { data: attendance, isLoading } = useAttendance(studentId, year, month);

  // Lock body scroll when open
  useEffect(() => {
    if (isOpen) document.body.style.overflow = "hidden";
    else        document.body.style.overflow = "";
    return () => { document.body.style.overflow = ""; };
  }, [isOpen]);

  // This week Mon–Sun
  const thisWeekDays = React.useMemo(() => {
    const today = new Date(year, month - 1, now.getDate());
    const dow = today.getDay(); // 0=Sun
    const diffToMon = dow === 0 ? -6 : 1 - dow;
    const monday = new Date(today);
    monday.setDate(today.getDate() + diffToMon);

    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      const record = attendance?.records?.find((r: any) => {
        const rDate = typeof r.date === "string" ? r.date.slice(0, 10) : "";
        return rDate === dateStr;
      });
      const isSunday  = d.getDay() === 0;
      const isFuture  = d > today;
      const isToday   = dateStr === todayStr;
      const status = record?.status ?? (isSunday ? "SUNDAY" : null);
      return { day: DAY_LABELS[i], dateStr, status, isFuture, isToday };
    });
  }, [attendance, year, month, now.getDate(), todayStr]);

  const STAT_ROWS = [
    { label: "Present",  value: attendance?.present  ?? 0, color: "text-green-600",  bg: "bg-green-50  border-green-100"  },
    { label: "Absent",   value: attendance?.absent   ?? 0, color: "text-red-600",    bg: "bg-red-50    border-red-100"    },
    { label: "Late",     value: attendance?.late     ?? 0, color: "text-yellow-600", bg: "bg-yellow-50 border-yellow-100" },
    { label: "Leave",    value: attendance?.leave    ?? 0, color: "text-blue-600",   bg: "bg-blue-50   border-blue-100"   },
    { label: "Half Day", value: attendance?.halfDay  ?? 0, color: "text-purple-600", bg: "bg-purple-50 border-purple-100" },
    { label: "Holiday",  value: attendance?.holiday  ?? 0, color: "text-sky-600",    bg: "bg-sky-50    border-sky-100"    },
  ];

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-60 flex flex-col justify-end"
      role="dialog"
      aria-modal="true"
      aria-label="Attendance Overview"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-walnut-950/50 backdrop-blur-[2px]"
        onClick={onClose}
      />

      {/* Sheet */}
      <div
        className="relative bg-white rounded-t-3xl shadow-2xl max-h-[85vh] overflow-y-auto"
        style={{ animation: "attSheetSlideUp 0.28s cubic-bezier(0.32,0.72,0,1)" }}
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-slate-300" />
        </div>

        <div className="px-5 pb-10 pt-2">
          {/* Header */}
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-lg font-bold text-ink">Attendance overview</h2>
            <button
              onClick={onClose}
              aria-label="Close"
              className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-100 text-ink-muted hover:bg-slate-200 transition-colors text-lg font-bold"
            >
              ×
            </button>
          </div>

          {isLoading ? (
            <div className="space-y-4">
              <Skeleton className="h-28 w-full rounded-2xl" />
              <Skeleton className="h-24 w-full rounded-2xl" />
              <Skeleton className="h-12 w-full rounded-2xl" />
            </div>
          ) : !attendance || attendance.total === 0 ? (
            <div className="py-14 text-center">
              <div className="mx-auto mb-3 grid size-12 place-items-center rounded-full bg-surface-secondary text-ink-faint"><CalendarDays className="size-6" aria-hidden /></div>
              <p className="text-ink-muted text-sm font-medium">No attendance data for this month</p>
            </div>
          ) : (
            <>
              {/* ── Overview row: circle left + stats grid right ── */}
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 mb-5 flex items-center gap-4">
                {/* Percentage ring */}
                <div className="flex flex-col items-center shrink-0">
                  <div className="relative w-18 h-18">
                    <svg viewBox="0 0 72 72" className="w-full h-full -rotate-90">
                      <circle cx="36" cy="36" r="28" fill="none" stroke="#e2e8f0" strokeWidth="7" />
                      <circle
                        cx="36" cy="36" r="28" fill="none"
                        stroke="#22c55e" strokeWidth="7"
                        strokeLinecap="round"
                        strokeDasharray={`${2 * Math.PI * 28}`}
                        strokeDashoffset={`${2 * Math.PI * 28 * (1 - (attendance.percentage ?? 0) / 100)}`}
                        style={{ transition: "stroke-dashoffset 0.6s ease" }}
                      />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className="text-sm font-bold text-ink leading-none">{attendance.percentage}%</span>
                      <span className="text-[9px] text-ink-muted font-medium mt-0.5">Present</span>
                    </div>
                  </div>
                  <p className="text-[10px] text-ink-muted mt-1.5 font-medium">This Month</p>
                </div>

                {/* Stat tiles */}
                <div className="grid grid-cols-3 gap-1.5 flex-1 min-w-0">
                  {STAT_ROWS.map((s) => (
                    <div key={s.label} className={`border rounded-xl p-1.5 text-center ${s.bg}`}>
                      <div className={`text-base font-bold leading-none ${s.color}`}>{s.value}</div>
                      <div className="text-[9px] text-ink-muted uppercase font-medium mt-0.5 leading-tight">{s.label}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* ── This Week ── */}
              <div className="mb-5">
                <p className="text-sm font-semibold text-ink mb-3">This Week</p>
                <div className="grid grid-cols-7 gap-1">
                  {thisWeekDays.map(({ day, status, isFuture, isToday }) => {
                    const cfg = status ? STATUS_CONFIG[status] : null;
                    return (
                      <div key={day} className="flex flex-col items-center gap-1.5">
                        <span className={`text-[10px] font-semibold ${isToday ? "text-brand" : "text-ink-muted"}`}>
                          {day}
                        </span>
                        <div
                          style={!isFuture ? cfg?.circleStyle : undefined}
                          className={[
                            "w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold transition-all",
                            isToday ? "ring-2 ring-brand ring-offset-1" : "",
                            isFuture
                              ? "bg-slate-100 text-slate-400"
                              : cfg
                              ? cfg.circleBg
                              : "bg-slate-100 text-slate-400",
                          ].join(" ")}
                        >
                          {isFuture ? "–" : cfg ? cfg.label : "–"}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* CTA */}
              <button
                onClick={onViewFull}
                className="w-full py-3 rounded-2xl bg-brand text-white font-semibold text-sm hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
              >
                View Full Calendar
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </>
          )}
        </div>
      </div>

      <style>{`
        @keyframes attSheetSlideUp {
          from { transform: translateY(100%); opacity: 0.6; }
          to   { transform: translateY(0);    opacity: 1;   }
        }
      `}</style>
    </div>
  );
};
