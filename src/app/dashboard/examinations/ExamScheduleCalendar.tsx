"use client";

import { useState } from "react";
import useSWR from "swr";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { API_BASE_URL, fetcher } from "@/lib/api";
import { authFetch } from "@/lib/auth";
import toast, { Toaster } from "react-hot-toast";
import { useRbac } from "@/lib/rbac";
import ExamEntryModal from "./ExamEntryModal";

interface ExamScheduleCalendarProps {
    scheduleId: number;
    onBack: () => void;
}

interface SelectedCell {
    cls: any;
    dateStr: string;
    existingEntry: any | null;
    isHoliday: boolean;
    holidayName?: string;
    isSunday: boolean;
}

export default function ExamScheduleCalendar({ scheduleId, onBack }: ExamScheduleCalendarProps) {
    const { isAdmin } = useRbac();
    const [selectedCell, setSelectedCell] = useState<SelectedCell | null>(null);
    const [isDownloading, setIsDownloading] = useState(false);

    // Fetch schedule (includes entries with class, holidays)
    const { data: schedule, mutate, isLoading } = useSWR(
        scheduleId ? `${API_BASE_URL}/exam-schedules/${scheduleId}` : null,
        fetcher
    );

    // Fetch all classes for row headers
    const { data: allClasses } = useSWR(`${API_BASE_URL}/classes`, fetcher);

    if (isLoading) return <div className="text-center py-10 text-slate-500">Loading schedule...</div>;
    if (!schedule) return <div className="text-center py-10 text-slate-500">Schedule not found</div>;

    const canEdit = schedule.status === "DRAFT" || isAdmin;

    // Generate dates array (use local date parts to avoid UTC timezone shift)
    const toLocalDateStr = (d: Date) => {
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, "0");
        const day = String(d.getDate()).padStart(2, "0");
        return `${y}-${m}-${day}`;
    };
    const start = new Date(schedule.startDate + "T00:00:00");
    const end = new Date(schedule.endDate + "T00:00:00");
    const dates: string[] = [];
    const cur = new Date(start);
    while (cur <= end) {
        dates.push(toLocalDateStr(cur));
        cur.setDate(cur.getDate() + 1);
    }

    // Get entry for a specific (classId, date) pair
    const getEntry = (classId: number, dateStr: string): any | null => {
        return schedule.entries?.find(
            (e: any) => e.class?.id === classId && e.date === dateStr
        ) ?? null;
    };

    // Check if a date is a holiday for a specific class
    const getHolidayForClass = (classId: number, dateStr: string): any | null => {
        return schedule.holidays?.find((h: any) => {
            const inRange = dateStr >= h.startDate && dateStr <= h.endDate;
            if (!inRange) return false;
            return h.isEntireSchool || h.classes?.some((c: any) => c.id === classId);
        }) ?? null;
    };

    const isSundayStr = (dateStr: string) => new Date(dateStr + "T00:00:00").getDay() === 0;
    const todayStr = toLocalDateStr(new Date());

    const handleCellClick = (cls: any, dateStr: string) => {
        if (!canEdit) return;
        const holiday = getHolidayForClass(cls.id, dateStr);
        const sunday = isSundayStr(dateStr);
        if (holiday || sunday) return; // hard block — no scheduling on restricted days
        setSelectedCell({
            cls,
            dateStr,
            existingEntry: getEntry(cls.id, dateStr),
            isHoliday: false,
            holidayName: undefined,
            isSunday: false,
        });
    };

    const handlePublish = async () => {
        const res = await authFetch(`${API_BASE_URL}/exam-schedules/${scheduleId}/publish`, { method: "PATCH" });
        if (res.ok) { toast.success("Schedule published!"); mutate(); }
        else toast.error("Failed to publish");
    };

    const handleToggleActive = async () => {
        const res = await authFetch(`${API_BASE_URL}/exam-schedules/${scheduleId}/toggle-active`, { method: "PATCH" });
        if (res.ok) { toast.success(schedule.isActive ? "Deactivated" : "Activated"); mutate(); }
        else toast.error("Failed to toggle");
    };

    const handleDownloadPDF = async () => {
        setIsDownloading(true);
        try {
            const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
            
            // Header
            doc.setFontSize(16);
            doc.text(`Exam Schedule: ${schedule.examCategory?.name || "N/A"}`, 14, 15);
            doc.setFontSize(11);
            doc.setTextColor(100);
            doc.text(`Academic Session: ${schedule.academicSession?.name || "N/A"}`, 14, 22);
            doc.text(`Dates: ${new Date(schedule.startDate).toLocaleDateString()} to ${new Date(schedule.endDate).toLocaleDateString()}`, 14, 28);

            // Table Data
            const tableData: any[][] = [];
            
            (allClasses ?? []).forEach((cls: any) => {
                let hasEntriesForClass = false;
                dates.forEach(dateStr => {
                    const entry = getEntry(cls.id, dateStr);
                    if (entry) {
                        hasEntriesForClass = true;
                        const d = new Date(dateStr + "T00:00:00");
                        const timeStr = entry.startTime || entry.endTime 
                            ? `${entry.startTime || "--:--"} to ${entry.endTime || "--:--"}` 
                            : "--:--";
                            
                        tableData.push([
                            cls.name,
                            d.toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" }),
                            d.toLocaleDateString("en-US", { weekday: "short" }),
                            entry.subjectName || entry.subject?.name || "Exam",
                            timeStr,
                            entry.notes || ""
                        ]);
                    }
                });
                
                // Add an empty row to visually separate classes (if there were entries)
                if (hasEntriesForClass) {
                    tableData.push(["", "", "", "", "", ""]);
                }
            });

            if (tableData.length === 0) {
                toast.error("No exams scheduled yet. Nothing to download.");
                return;
            }

            // Clean up trailing empty row
            if (tableData.length > 0 && tableData[tableData.length - 1][0] === "") {
                tableData.pop();
            }

            autoTable(doc, {
                startY: 35,
                head: [['Class', 'Date', 'Day', 'Subject', 'Time', 'Notes']],
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
                },
                didParseCell: function(data) {
                    // Remove borders for empty separator rows
                    if (Array.isArray(data.row.raw) && data.row.raw[0] === "" && data.section === 'body') {
                        data.cell.styles.fillColor = [255, 255, 255];
                        data.cell.styles.lineWidth = 0;
                        data.cell.styles.minCellHeight = 5;
                    }
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
        <div className="flex flex-col h-full">
            <Toaster position="top-right" />
            {/* Header bar */}
            <div className="flex items-center justify-between mb-5 shrink-0">
                <div className="flex items-center gap-4">
                    <button onClick={onBack} className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-500">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
                    </button>
                    <div>
                        <h2 className="text-xl font-bold text-slate-800 flex items-center gap-3">
                            {schedule.examCategory?.name}
                            <span className={`px-2.5 py-1 text-xs rounded-full font-medium ${schedule.status === "PUBLISHED" ? "bg-green-100 text-green-800" : "bg-yellow-100 text-yellow-800"}`}>
                                {schedule.status}
                            </span>
                            <span className={`px-2.5 py-1 text-xs rounded-full font-medium ${schedule.isActive ? "bg-blue-100 text-blue-800" : "bg-gray-100 text-gray-800"}`}>
                                {schedule.isActive ? "Active" : "Inactive"}
                            </span>
                        </h2>
                        <p className="text-sm text-slate-500 mt-1">
                            {schedule.academicSession?.name} &nbsp;|&nbsp;
                            {new Date(schedule.startDate).toLocaleDateString()} to {new Date(schedule.endDate).toLocaleDateString()}
                        </p>
                    </div>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={handleDownloadPDF}
                        disabled={isDownloading}
                        className="px-4 py-2 text-sm font-medium rounded-lg transition-colors bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 flex items-center gap-2 disabled:opacity-50"
                    >
                        {isDownloading ? (
                            <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                        ) : (
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                        )}
                        <span className="hidden sm:inline">Download PDF</span>
                    </button>
                    {isAdmin && (
                        <>
                            <button onClick={handleToggleActive} className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${schedule.isActive ? "bg-gray-100 text-gray-700 hover:bg-gray-200" : "bg-blue-100 text-blue-700 hover:bg-blue-200"}`}>
                                {schedule.isActive ? "Deactivate" : "Activate"}
                            </button>
                            {schedule.status === "DRAFT" && (
                                <button onClick={handlePublish} className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 transition-colors shadow-sm">
                                    Publish
                                </button>
                            )}
                        </>
                    )}
                </div>
            </div>

            {/* Legend */}
            <div className="flex items-center gap-4 mb-3 text-xs text-slate-500 shrink-0">
                <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-amber-100 border border-amber-300 inline-block" />Holiday</span>
                <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-slate-100 border border-slate-300 inline-block" />Sunday</span>
                <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-blue-50 border border-blue-300 inline-block" />Today</span>
                {canEdit && <span className="text-slate-400 ml-auto">Click any cell to add/edit an exam entry</span>}
            </div>

            {/* Matrix Table */}
            <div className="flex-1 overflow-auto border border-slate-200 rounded-lg bg-white">
                <table className="border-collapse text-sm min-w-max w-full">
                    <thead>
                        <tr className="bg-slate-50 border-b border-slate-200">
                            {/* Sticky class column header */}
                            <th className="sticky left-0 z-20 bg-slate-50 border-r border-slate-200 px-4 py-3 text-left font-semibold text-slate-700 min-w-40 shadow-[2px_0_4px_-2px_rgba(0,0,0,0.08)]">
                                Class
                            </th>
                            {dates.map(dateStr => {
                                const isToday = dateStr === todayStr;
                                const sunday = isSundayStr(dateStr);
                                const isHoliday = schedule.holidays?.some((h: any) => dateStr >= h.startDate && dateStr <= h.endDate);
                                const d = new Date(dateStr + "T00:00:00");
                                return (
                                    <th key={dateStr} className={`px-3 py-3 text-center font-medium min-w-[140px] border-r border-slate-200 ${isToday ? "bg-blue-50 text-blue-700" : isHoliday ? "bg-amber-50 text-amber-700" : sunday ? "bg-slate-100 text-slate-400" : "text-slate-600"}`}>
                                        <div className="text-xs uppercase tracking-wide">{d.toLocaleDateString("en-US", { weekday: "short" })}</div>
                                        <div className={`text-base font-bold ${isToday ? "text-blue-700" : isHoliday ? "text-amber-700" : sunday ? "text-slate-400" : "text-slate-800"}`}>
                                            {d.toLocaleDateString("en-US", { day: "numeric", month: "short" })}
                                        </div>
                                    </th>
                                );
                            })}
                        </tr>
                    </thead>
                    <tbody>
                        {(allClasses ?? []).map((cls: any, rowIdx: number) => (
                            <tr key={cls.id} className={rowIdx % 2 === 0 ? "bg-white" : "bg-slate-50/50"}>
                                {/* Sticky class name */}
                                <td className="sticky left-0 z-10 bg-inherit border-r border-b border-slate-200 px-4 py-3 font-medium text-slate-700 shadow-[2px_0_4px_-2px_rgba(0,0,0,0.06)]">
                                    {cls.name}
                                </td>
                                {dates.map(dateStr => {
                                    const entry = getEntry(cls.id, dateStr);
                                    const holiday = getHolidayForClass(cls.id, dateStr);
                                    const sunday = isSundayStr(dateStr);
                                    const isToday = dateStr === todayStr;
                                    const isBlocked = !!holiday || sunday;

                                    let cellBg = "";
                                    if (holiday) cellBg = "bg-amber-50";
                                    else if (sunday) cellBg = "bg-slate-100";
                                    else if (isToday) cellBg = "bg-blue-50/40";

                                    return (
                                        <td
                                            key={dateStr}
                                            onClick={() => canEdit && !isBlocked ? handleCellClick(cls, dateStr) : undefined}
                                            className={`border-r border-b border-slate-200 px-2 py-2 align-top min-w-[140px] min-h-16 ${cellBg} ${canEdit && !isBlocked ? "cursor-pointer hover:bg-blue-50/60 transition-colors" : isBlocked ? "cursor-not-allowed" : ""}`}
                                        >
                                            {entry ? (
                                                <div className="bg-white border border-slate-200 rounded-md p-2 shadow-sm text-xs space-y-0.5 hover:shadow-md transition-shadow">
                                                    <p className="font-semibold text-slate-800 truncate">
                                                        {entry.subjectName || entry.subject?.name || "Exam"}
                                                    </p>
                                                    {(entry.startTime || entry.endTime) && (
                                                        <p className="text-slate-500 flex items-center gap-1">
                                                            <svg className="w-3 h-3 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                                            {entry.startTime || "--:--"} – {entry.endTime || "--:--"}
                                                        </p>
                                                    )}
                                                    {entry.notes && <p className="text-slate-400 truncate">{entry.notes}</p>}
                                                </div>
                                            ) : holiday ? (
                                                <span className="text-xs text-amber-600 font-medium px-1">{holiday.description}</span>
                                            ) : sunday ? (
                                                <span className="text-xs text-slate-400 px-1">Sunday</span>
                                            ) : canEdit ? (
                                                <div className="h-full flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                                                    <span className="text-slate-300 text-lg">+</span>
                                                </div>
                                            ) : null}
                                        </td>
                                    );
                                })}
                            </tr>
                        ))}
                        {(!allClasses || allClasses.length === 0) && (
                            <tr>
                                <td colSpan={dates.length + 1} className="text-center py-10 text-slate-400">Loading classes...</td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {/* Entry Modal */}
            {selectedCell && (
                <ExamEntryModal
                    scheduleId={scheduleId}
                    classId={selectedCell.cls.id}
                    className={selectedCell.cls.name}
                    date={selectedCell.dateStr}
                    existingEntry={selectedCell.existingEntry}
                    isHoliday={selectedCell.isHoliday}
                    holidayName={selectedCell.holidayName}
                    isSunday={selectedCell.isSunday}
                    onClose={() => setSelectedCell(null)}
                    onSaved={() => {
                        setSelectedCell(null);
                        mutate();
                    }}
                />
            )}
        </div>
    );
}
