"use client";

import { useState, useRef } from "react";
import useSWR from "swr";
import { API_BASE_URL, fetcher } from "@/lib/api";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import toast from "react-hot-toast";

interface ExamScheduleParentViewProps {
    classId: number;
    sessionId: number;
}

export default function ExamScheduleParentView({ classId, sessionId }: ExamScheduleParentViewProps) {
    const [selectedScheduleId, setSelectedScheduleId] = useState<number | null>(null);

    // Fetch the list of published & active schedules for this class & session
    // The backend enforce PARENT role restrictions (status=PUBLISHED, isActive=true)
    const { data: schedules, isLoading } = useSWR(
        (classId && sessionId) ? `${API_BASE_URL}/exam-schedules?classId=${classId}&academicSessionId=${sessionId}` : null,
        fetcher
    );

    if (isLoading) {
        return (
            <div className="flex justify-center items-center py-20">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500"></div>
            </div>
        );
    }

    if (!schedules || schedules.length === 0) {
        return (
            <div className="bg-slate-800/50 rounded-2xl p-12 text-center border border-slate-700/50 shadow-xl">
                <div className="bg-slate-700/50 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner">
                    <svg className="w-10 h-10 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
                </div>
                <h3 className="text-xl font-medium text-slate-200 mb-2">No Exam Schedules</h3>
                <p className="text-slate-400 max-w-md mx-auto">There are currently no published exam schedules for this academic session.</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {!selectedScheduleId ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {schedules.map((schedule: any) => (
                        <div 
                            key={schedule.id}
                            onClick={() => setSelectedScheduleId(schedule.id)}
                            className="bg-slate-800/80 rounded-xl p-6 border border-slate-700 hover:border-indigo-500/50 cursor-pointer transition-all hover:shadow-lg hover:shadow-indigo-500/10 group"
                        >
                            <div className="flex justify-between items-start mb-4">
                                <div className="bg-indigo-500/20 p-3 rounded-lg text-indigo-400 group-hover:bg-indigo-500 group-hover:text-white transition-colors">
                                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"></path></svg>
                                </div>
                                <span className="text-xs font-medium bg-slate-700 text-slate-300 px-2.5 py-1 rounded-full">
                                    {schedule.entryCount || 0} Exams
                                </span>
                            </div>
                            <h3 className="text-lg font-semibold text-slate-100 mb-1">{schedule.examCategory?.name}</h3>
                            <p className="text-sm text-slate-400 mb-1">{schedule.academicSession?.name}</p>
                            <p className="text-sm text-slate-400 mb-4">
                                {new Date(schedule.startDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })} - {new Date(schedule.endDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                            </p>
                            <div className="text-sm font-medium text-indigo-400 flex items-center gap-1 group-hover:text-indigo-300">
                                View Schedule
                                <svg className="w-4 h-4 transform group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"></path></svg>
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <ScheduleMatrix scheduleId={selectedScheduleId} classId={classId} onBack={() => setSelectedScheduleId(null)} />
            )}
        </div>
    );
}

function ScheduleMatrix({ scheduleId, classId, onBack }: { scheduleId: number, classId: number, onBack: () => void }) {
    const { data: schedule, isLoading } = useSWR(
        scheduleId ? `${API_BASE_URL}/exam-schedules/${scheduleId}` : null,
        fetcher
    );

    // null = use schedule's start month as default
    const [currentMonth, setCurrentMonth] = useState<{ year: number; month: number } | null>(null);
    const [selectedDateDetail, setSelectedDateDetail] = useState<{ dateStr: string, entry: any | null, holiday: any | null } | null>(null);
    const printRef = useRef<HTMLDivElement>(null);
    const [isDownloading, setIsDownloading] = useState(false);

    if (isLoading) return <div className="text-center py-12 text-slate-400">Loading schedule details...</div>;
    if (!schedule) return <div className="text-center py-12 text-slate-400">Schedule not found.</div>;

    const toLocalDateStr = (d: Date) => {
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, "0");
        const day = String(d.getDate()).padStart(2, "0");
        return `${y}-${m}-${day}`;
    };

    const scheduleStart = new Date(schedule.startDate + "T00:00:00");
    const scheduleEnd = new Date(schedule.endDate + "T00:00:00");

    const displayYear = currentMonth?.year ?? scheduleStart.getFullYear();
    const displayMonth = currentMonth?.month ?? scheduleStart.getMonth(); // 0-indexed

    // Build calendar grid — week starts Monday (Mon=0 … Sun=6)
    const firstOfMonth = new Date(displayYear, displayMonth, 1);
    const lastOfMonth = new Date(displayYear, displayMonth + 1, 0);
    const monStartDayOfWeek = (d: Date) => (d.getDay() + 6) % 7; // Mon=0…Sun=6
    const leadingBlanks = monStartDayOfWeek(firstOfMonth);
    const totalCells = Math.ceil((leadingBlanks + lastOfMonth.getDate()) / 7) * 7;

    const cells: (string | null)[] = Array.from({ length: totalCells }, (_, i) => {
        const day = i - leadingBlanks + 1;
        if (day < 1 || day > lastOfMonth.getDate()) return null;
        return toLocalDateStr(new Date(displayYear, displayMonth, day));
    });

    const getEntry = (dateStr: string) =>
        schedule.entries?.find((e: any) => e.class?.id === classId && e.date === dateStr) ?? null;

    const isHolidayForClass = (dateStr: string): any | null =>
        schedule.holidays?.find((h: any) => {
            if (!(dateStr >= h.startDate && dateStr <= h.endDate)) return false;
            return h.isEntireSchool || h.classes?.some((c: any) => c.id === classId);
        }) ?? null;

    const todayStr = toLocalDateStr(new Date());
    const scheduleStartStr = schedule.startDate as string;
    const scheduleEndStr = schedule.endDate as string;

    // Month navigation bounds
    const canGoPrev = !(displayYear === scheduleStart.getFullYear() && displayMonth === scheduleStart.getMonth());
    const canGoNext = !(displayYear === scheduleEnd.getFullYear() && displayMonth === scheduleEnd.getMonth());

    const goPrev = () => {
        const d = new Date(displayYear, displayMonth - 1, 1);
        setCurrentMonth({ year: d.getFullYear(), month: d.getMonth() });
    };
    const goNext = () => {
        const d = new Date(displayYear, displayMonth + 1, 1);
        setCurrentMonth({ year: d.getFullYear(), month: d.getMonth() });
    };

    const monthLabel = firstOfMonth.toLocaleDateString("en-US", { month: "long", year: "numeric" });
    const weekDayHeaders = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

    const examsThisMonth = schedule.entries?.filter((e: any) => {
        if (e.class?.id !== classId) return false;
        const d = new Date(e.date + "T00:00:00");
        return d.getFullYear() === displayYear && d.getMonth() === displayMonth;
    }).length ?? 0;

    const handleDownloadPDF = async () => {
        setIsDownloading(true);
        try {
            const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

            doc.setFontSize(16);
            doc.text(`Exam Schedule: ${schedule.examCategory?.name || "N/A"}`, 14, 15);
            doc.setFontSize(11);
            doc.setTextColor(100);
            doc.text(`Academic Session: ${schedule.academicSession?.name || "N/A"}`, 14, 22);
            doc.text(`Dates: ${new Date(schedule.startDate).toLocaleDateString()} to ${new Date(schedule.endDate).toLocaleDateString()}`, 14, 28);

            const tableData: any[][] = [];
            
            const start = new Date(schedule.startDate + "T00:00:00");
            const end = new Date(schedule.endDate + "T00:00:00");
            const datesToProcess: string[] = [];
            const cur = new Date(start);
            while (cur <= end) {
                datesToProcess.push(toLocalDateStr(cur));
                cur.setDate(cur.getDate() + 1);
            }

            const classNameStr = schedule.entries?.find((e: any) => e.class?.id === classId)?.class?.name || "N/A";

            datesToProcess.forEach(dateStr => {
                const entry = getEntry(dateStr);
                const holiday = isHolidayForClass(dateStr);
                const d = new Date(dateStr + "T00:00:00");
                const dateFormatted = d.toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" });
                const dayFormatted = d.toLocaleDateString("en-US", { weekday: "short" });

                if (entry) {
                    const timeStr = entry.startTime || entry.endTime 
                        ? `${entry.startTime || "--:--"} to ${entry.endTime || "--:--"}` 
                        : "--:--";
                    tableData.push([
                        classNameStr,
                        dateFormatted,
                        dayFormatted,
                        entry.subjectName || entry.subject?.name || "Exam",
                        timeStr,
                        entry.notes || ""
                    ]);
                } else if (holiday) {
                    tableData.push([
                        classNameStr,
                        dateFormatted,
                        dayFormatted,
                        "HOLIDAY",
                        holiday.description || "-",
                        ""
                    ]);
                }
            });

            if (tableData.length === 0) {
                toast.error("No exams scheduled yet. Nothing to download.");
                return;
            }

            autoTable(doc, {
                startY: 35,
                head: [['Class', 'Date', 'Day', 'Subject / Event', 'Time', 'Notes']],
                body: tableData,
                theme: 'grid',
                headStyles: { fillColor: [79, 70, 229] }, // indigo-600
                styles: { fontSize: 9, cellPadding: 3 },
                columnStyles: {
                    0: { cellWidth: 25, fontStyle: 'bold' }, // Class
                    1: { cellWidth: 25 }, // Date
                    2: { cellWidth: 15 }, // Day
                    3: { cellWidth: 40, fontStyle: 'bold' }, // Subject
                    4: { cellWidth: 35 }, // Time
                    5: { cellWidth: 'auto' } // Notes
                }
            });

            doc.save(`exam-schedule-${schedule.examCategory?.name || "download"}.pdf`);
        } catch (error) {
            console.error("PDF generation error:", error);
            toast.error("Failed to generate PDF");
        } finally {
            setIsDownloading(false);
        }
    };

    return (
        <div ref={printRef} className="bg-slate-800/50 rounded-2xl border border-slate-700/50 overflow-hidden shadow-xl">
            {/* Header */}
            <div className="p-6 border-b border-slate-700/50 flex items-center gap-4">
                <button onClick={onBack} className="p-2 bg-slate-700/50 hover:bg-slate-700 text-slate-300 rounded-full transition-colors">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path></svg>
                </button>
                <div className="flex-1 min-w-0">
                    <h2 className="text-xl font-bold text-slate-100">{schedule.examCategory?.name} Schedule</h2>
                    <p className="text-sm text-slate-400 mt-1">{schedule.academicSession?.name}</p>
                </div>
                <div className="text-right text-sm text-slate-400 hidden sm:flex flex-col items-end gap-2">
                    <div>
                        <span>{new Date(scheduleStartStr + "T00:00:00").toLocaleDateString("en-US", { day: "numeric", month: "short" })}</span>
                        <span className="mx-1 text-slate-600">–</span>
                        <span>{new Date(scheduleEndStr + "T00:00:00").toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" })}</span>
                    </div>
                    <button
                        onClick={handleDownloadPDF}
                        disabled={isDownloading}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-slate-700/50 hover:bg-slate-700 text-slate-300 transition-colors disabled:opacity-50 no-print"
                    >
                        {isDownloading ? (
                            <svg className="animate-spin h-3 w-3" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                        ) : (
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                        )}
                        Download PDF
                    </button>
                </div>
            </div>

            {/* Month navigation */}
            <div className="px-4 py-3 border-b border-slate-700/50 flex items-center justify-between no-print">
                <button
                    onClick={goPrev}
                    disabled={!canGoPrev}
                    className="p-2 rounded-lg bg-slate-700/50 hover:bg-slate-700 text-slate-300 disabled:opacity-25 disabled:cursor-not-allowed transition-colors"
                >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7"></path></svg>
                </button>
                <div className="text-center">
                    <div className="text-base font-semibold text-slate-100">{monthLabel}</div>
                    <div className="text-xs text-indigo-400 mt-0.5 h-4">
                        {examsThisMonth > 0 ? `${examsThisMonth} exam${examsThisMonth !== 1 ? "s" : ""} this month` : ""}
                    </div>
                </div>
                <button
                    onClick={goNext}
                    disabled={!canGoNext}
                    className="p-2 rounded-lg bg-slate-700/50 hover:bg-slate-700 text-slate-300 disabled:opacity-25 disabled:cursor-not-allowed transition-colors"
                >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"></path></svg>
                </button>
            </div>

            {/* Calendar */}
            <div className="p-4">
                {/* Day-of-week headers */}
                <div className="grid grid-cols-7 mb-1">
                    {weekDayHeaders.map((day) => (
                        <div
                            key={day}
                            className={`text-center text-xs font-semibold uppercase tracking-wider py-2 ${day === "Sun" ? "text-slate-600" : "text-slate-500"}`}
                        >
                            {day}
                        </div>
                    ))}
                </div>

                {/* Date cells */}
                <div className="grid grid-cols-7 gap-1">
                    {cells.map((dateStr, idx) => {
                        if (!dateStr) {
                            return <div key={idx} className="min-h-20 rounded-lg" />;
                        }

                        const isSunday = idx % 7 === 6; // Sun is last col in Mon-start grid
                        const entry = getEntry(dateStr);
                        const holiday = isHolidayForClass(dateStr);
                        const isToday = dateStr === todayStr;
                        const inRange = dateStr >= scheduleStartStr && dateStr <= scheduleEndStr;
                        const dayNum = new Date(dateStr + "T00:00:00").getDate();

                        let cellBg = "bg-slate-800/60 border-slate-700/40";
                        if (!inRange)        cellBg = "bg-transparent border-slate-800/20";
                        else if (entry)      cellBg = "bg-indigo-900/20 border-indigo-700/40";
                        else if (holiday)    cellBg = "bg-amber-800/30 border-amber-600/50";
                        else if (isSunday)   cellBg = "bg-slate-900/40 border-slate-800/30";

                        return (
                            <div
                                key={idx}
                                onClick={() => {
                                    if (inRange && (entry || holiday)) {
                                        setSelectedDateDetail({ dateStr, entry, holiday });
                                    }
                                }}
                                className={`min-h-20 rounded-lg border p-1.5 flex flex-col transition-colors ${cellBg} ${isToday ? "ring-2 ring-indigo-500 ring-offset-1 ring-offset-slate-900" : ""} ${inRange && (entry || holiday) ? "cursor-pointer hover:border-indigo-500/80 hover:bg-slate-800/80" : ""}`}
                            >
                                {/* Date number */}
                                <span className={`text-xs font-bold w-6 h-6 flex items-center justify-center rounded-full shrink-0 ${
                                    isToday   ? "bg-indigo-500 text-white" :
                                    !inRange  ? "text-slate-700" :
                                    holiday   ? "text-amber-400" :
                                    isSunday  ? "text-slate-600" :
                                               "text-slate-300"
                                }`}>
                                    {dayNum}
                                </span>

                                {/* Content (only within schedule range) */}
                                {inRange && (
                                    <div className="flex flex-col gap-0.5 mt-1">
                                        {entry && (
                                            <div className="bg-indigo-500/25 border border-indigo-500/40 rounded px-1.5 py-1 text-xs leading-tight">
                                                <div className="font-semibold text-indigo-200 truncate">
                                                    {entry.subjectName || entry.subject?.name || "Exam"}
                                                </div>
                                                {entry.startTime && (
                                                    <div className="text-indigo-300/70 mt-0.5 truncate">
                                                        {entry.startTime}{entry.endTime ? `–${entry.endTime}` : ""}
                                                    </div>
                                                )}
                                                {entry.notes && (
                                                    <div className="text-indigo-300/50 mt-0.5 truncate text-[10px]">{entry.notes}</div>
                                                )}
                                            </div>
                                        )}
                                        {holiday && (
                                            <div className="bg-amber-500/30 border border-amber-500/60 rounded px-1.5 py-1 text-[10px] text-amber-300 leading-tight truncate font-medium">
                                                {holiday.description || "Holiday"}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>

                {/* Legend */}
                <div className="mt-4 pt-3 border-t border-slate-700/50 flex flex-wrap gap-x-5 gap-y-2 text-xs text-slate-400">
                    <div className="flex items-center gap-1.5">
                        <div className="w-4 h-4 rounded-full bg-indigo-500 shrink-0" />
                        <span>Today</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <div className="w-4 h-4 rounded bg-indigo-500/25 border border-indigo-500/40 shrink-0" />
                        <span>Exam</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <div className="w-4 h-4 rounded bg-amber-500/30 border border-amber-500/60 shrink-0" />
                        <span>Holiday</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <div className="w-4 h-4 rounded bg-transparent border border-slate-800/20 shrink-0" />
                        <span>Outside schedule</span>
                    </div>
                </div>
            </div>

            {/* Date Detail Modal for Mobile Viewing */}
            {selectedDateDetail && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm no-print">
                    <div className="bg-slate-900 border border-slate-700 shadow-2xl rounded-2xl w-full max-w-sm overflow-hidden animate-scale-in">
                        <div className="flex items-center justify-between p-4 border-b border-slate-800 bg-slate-800/30">
                            <h3 className="font-semibold text-slate-100">
                                {new Date(selectedDateDetail.dateStr + "T00:00:00").toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
                            </h3>
                            <button onClick={() => setSelectedDateDetail(null)} className="p-1 text-slate-400 hover:text-white transition-colors bg-slate-800 hover:bg-slate-700 rounded-full">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                        </div>
                        <div className="p-5 space-y-4">
                            {selectedDateDetail.entry && (
                                <div className="bg-indigo-900/20 border border-indigo-700/40 rounded-xl p-4">
                                    <div className="flex items-center gap-2 mb-2 text-indigo-400 font-semibold">
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                                        Examination
                                    </div>
                                    <h4 className="text-lg font-bold text-slate-100 leading-tight mb-2">
                                        {selectedDateDetail.entry.subjectName || selectedDateDetail.entry.subject?.name || "Exam"}
                                    </h4>
                                    {(selectedDateDetail.entry.startTime || selectedDateDetail.entry.endTime) && (
                                        <div className="flex items-center gap-2 text-indigo-300/80 text-sm mb-2">
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                            {selectedDateDetail.entry.startTime || "TBD"} – {selectedDateDetail.entry.endTime || "TBD"}
                                        </div>
                                    )}
                                    {selectedDateDetail.entry.notes && (
                                        <div className="mt-3 text-sm text-slate-400 bg-slate-950/30 p-3 rounded-lg border border-slate-800/50">
                                            {selectedDateDetail.entry.notes}
                                        </div>
                                    )}
                                </div>
                            )}

                            {selectedDateDetail.holiday && (
                                <div className="bg-amber-900/20 border border-amber-700/40 rounded-xl p-4">
                                    <div className="flex items-center gap-2 mb-2 text-amber-400 font-semibold">
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" /></svg>
                                        Holiday
                                    </div>
                                    <h4 className="text-lg font-bold text-slate-100 leading-tight">
                                        {selectedDateDetail.holiday.description || "Holiday"}
                                    </h4>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
