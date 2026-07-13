"use client";

import React, { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { useHomework } from "../hooks/useStudentData";
import { Skeleton } from "@/components/ui/skeleton";
import { API_BASE_URL } from "@/lib/api";
import { authFetch } from "@/lib/auth";

interface Props {
  studentId: string;
  isOpen: boolean;
  onClose: () => void;
  onViewFull: () => void;
}

const SUBJECT_COLORS = [
  "border-violet-400 bg-violet-50 text-violet-700",
  "border-teal-400   bg-teal-50   text-teal-700",
  "border-rose-400   bg-rose-50   text-rose-700",
  "border-amber-400  bg-amber-50  text-amber-700",
  "border-sky-400    bg-sky-50    text-sky-700",
];

export const HomeworkBottomSheet = ({ studentId, isOpen, onClose, onViewFull }: Props) => {
  const now = new Date();
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const displayDate = now.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" });

  const { data: homeworkItems, isLoading } = useHomework(studentId, todayStr);
  const [openingWorksheetId, setOpeningWorksheetId] = useState<string | null>(null);

  const openWorksheet = async (h: any) => {
    setOpeningWorksheetId(h.id);
    try {
      const res = await authFetch(`${API_BASE_URL}/parent/student/${studentId}/homework/${h.id}/worksheet-url`);
      if (!res.ok) throw new Error();
      const { url } = await res.json();
      window.open(url, "_blank", "noopener");
    } catch {
      toast.error("Could not open worksheet.");
    } finally {
      setOpeningWorksheetId(null);
    }
  };

  // Lock body scroll when open
  useEffect(() => {
    if (isOpen) document.body.style.overflow = "hidden";
    else        document.body.style.overflow = "";
    return () => { document.body.style.overflow = ""; };
  }, [isOpen]);

  if (!isOpen) return null;

  const items: any[] = homeworkItems ?? [];

  return (
    <div
      className="fixed inset-0 z-60 flex flex-col justify-end"
      role="dialog"
      aria-modal="true"
      aria-label="Today's Homework"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-[2px]"
        onClick={onClose}
      />

      {/* Sheet */}
      <div
        className="relative bg-white rounded-t-3xl shadow-2xl max-h-[80vh] overflow-y-auto"
        style={{ animation: "hwSheetSlideUp 0.28s cubic-bezier(0.32,0.72,0,1)" }}
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-slate-300" />
        </div>

        <div className="px-5 pb-10 pt-2">
          {/* Header */}
          <div className="flex items-center justify-between mb-1">
            <div>
              <h2 className="text-lg font-bold text-ink">📚 Today&apos;s Homework</h2>
              <p className="text-xs text-ink-muted mt-0.5">{displayDate}</p>
            </div>
            <button
              onClick={onClose}
              aria-label="Close"
              className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-100 text-ink-muted hover:bg-slate-200 transition-colors text-lg font-bold"
            >
              ×
            </button>
          </div>

          <div className="mt-4">
            {isLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-16 w-full rounded-xl" />
                <Skeleton className="h-16 w-full rounded-xl" />
                <Skeleton className="h-16 w-full rounded-xl" />
              </div>
            ) : items.length === 0 ? (
              <div className="py-12 text-center">
                <div className="text-4xl mb-3">🎉</div>
                <p className="text-ink font-semibold text-base">No homework today!</p>
                <p className="text-ink-muted text-sm mt-1">Enjoy your free time.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {items.map((h: any, idx: number) => {
                  const colorClass = SUBJECT_COLORS[idx % SUBJECT_COLORS.length];
                  return (
                    <div
                      key={h.id}
                      className="rounded-xl border p-3.5 flex items-start gap-3 bg-white shadow-sm"
                    >
                      {h.subject && (
                        <span
                          className={`shrink-0 mt-0.5 text-[10px] font-bold uppercase tracking-wide px-2 py-1 rounded-lg border ${colorClass}`}
                        >
                          {h.subject}
                        </span>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-ink leading-snug">{h.message}</p>
                        {h.worksheetFileName && (
                          <button
                            onClick={() => openWorksheet(h)}
                            disabled={openingWorksheetId === h.id}
                            className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-brand/10 text-brand text-xs font-semibold disabled:opacity-60 transition-colors max-w-full"
                          >
                            <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" /></svg>
                            <span className="truncate">{openingWorksheetId === h.id ? "Opening…" : "Worksheet"}</span>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}

                {/* Count badge */}
                <p className="text-xs text-ink-muted text-center pt-1">
                  {items.length} assignment{items.length !== 1 ? "s" : ""} for today
                </p>
              </div>
            )}
          </div>

          {/* CTA */}
          <button
            onClick={onViewFull}
            className="mt-5 w-full py-3 rounded-2xl bg-brand text-white font-semibold text-sm hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
          >
            View All Homework
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>

      <style>{`
        @keyframes hwSheetSlideUp {
          from { transform: translateY(100%); opacity: 0.6; }
          to   { transform: translateY(0);    opacity: 1;   }
        }
      `}</style>
    </div>
  );
};
