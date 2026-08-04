"use client";

import { useState, useEffect } from "react";
import { hrApi, StaffAttendanceRecord } from "@/lib/hr-api";
import { AppMonthPicker } from "@/components/ui/AppDatePicker";

const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

interface Props {
    staffId: number | null;
    staffLabel: string;
    onClose: () => void;
}

function getStatusColor(status: string | null | undefined) {
    switch (status) {
        case "PRESENT": return "bg-green-500 border-green-600 text-white";
        case "LATE": return "bg-yellow-400 border-yellow-500 text-white";
        case "HALF_DAY": return "bg-purple-500 border-purple-600 text-white";
        case "ON_LEAVE": return "bg-blue-500 border-blue-600 text-white";
        case "ABSENT": return "bg-red-500 border-red-600 text-white";
        case "HOLIDAY": return "bg-sky-500 border-sky-600 text-white";
        case "SUNDAY": return "bg-orange-50 text-orange-400 border-orange-200";
        default: return "bg-slate-50 border-slate-200 text-slate-500";
    }
}

export default function StaffAttendanceModal({ staffId, staffLabel, onClose }: Props) {
    const now = new Date();
    const [yyMm, setYyMm] = useState(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`);
    const year = parseInt(yyMm.split("-")[0]);
    const month = parseInt(yyMm.split("-")[1]);

    const [records, setRecords] = useState<StaffAttendanceRecord[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!staffId) return;
        setLoading(true);
        hrApi.attendance
            .monthly(staffId, month, year)
            .then((r) => setRecords(r))
            .catch(() => setRecords([]))
            .finally(() => setLoading(false));
    }, [staffId, month, year]);

    if (!staffId) return null;

    // Build calendar
    const daysInMonth = new Date(year, month, 0).getDate();
    const firstDayOfMonth = new Date(year, month - 1, 1).getDay();
    const recordByDate = new Map(records.map((r) => [r.date, r]));

    const cells = Array.from({ length: 42 }, (_, i) => {
        const day = i - firstDayOfMonth + 1;
        if (day < 1 || day > daysInMonth) return { day: null as number | null, date: null, status: null, isSunday: false, record: null as StaffAttendanceRecord | null };
        const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
        const rec = recordByDate.get(dateStr) ?? null;
        const isSunday = new Date(year, month - 1, day).getDay() === 0;
        const status = rec?.status ?? (isSunday ? "SUNDAY" : undefined);
        return { day, date: dateStr, status, isSunday, record: rec };
    });

    const counts = {
        PRESENT: records.filter((r) => r.status === "PRESENT").length,
        LATE: records.filter((r) => r.status === "LATE").length,
        HALF_DAY: records.filter((r) => r.status === "HALF_DAY").length,
        ON_LEAVE: records.filter((r) => r.status === "ON_LEAVE").length,
        ABSENT: records.filter((r) => r.status === "ABSENT").length,
        HOLIDAY: records.filter((r) => r.status === "HOLIDAY").length,
    };
    const workingMarked = records.length;
    const presentish = counts.PRESENT + counts.LATE + counts.HALF_DAY;
    const pct = workingMarked > 0 ? Math.round((presentish / workingMarked) * 100) : 0;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-walnut-950/55 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50 shrink-0">
                    <div>
                        <h2 className="text-lg font-bold text-slate-800">{staffLabel}</h2>
                        <p className="text-xs text-slate-500">Monthly Attendance</p>
                    </div>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600 bg-white p-2 rounded-full shadow-sm" aria-label="Close">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                <div className="p-6 overflow-y-auto flex-1">
                    <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
                        <h3 className="font-bold text-slate-800">{MONTH_NAMES[month - 1]} {year}</h3>
                        <AppMonthPicker
                            value={yyMm}
                            onChange={(v) => setYyMm(v)}
                        />
                    </div>

                    {loading ? (
                        <p className="text-sm text-slate-500 py-10 text-center">Loading…</p>
                    ) : (
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                            <div className="lg:col-span-2 bg-slate-50 rounded-xl p-4 border border-slate-200">
                                <div className="grid grid-cols-7 gap-1 text-center mb-2">
                                    {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((d) => (
                                        <div key={d} className="text-slate-500 text-[10px] font-bold py-1 uppercase">{d}</div>
                                    ))}
                                </div>
                                <div className="grid grid-cols-7 gap-1.5">
                                    {cells.map((c, i) => (
                                        <div
                                            key={i}
                                            title={c.day ? (c.record ? `${c.date}: ${c.record.status} (${c.record.method})` : c.status === "SUNDAY" ? `${c.date}: Sunday` : c.date ?? "") : ""}
                                            className={`aspect-square flex items-center justify-center rounded-lg text-xs font-bold border ${c.day ? getStatusColor(c.status) : "bg-transparent border-transparent"}`}
                                        >
                                            {c.day || ""}
                                        </div>
                                    ))}
                                </div>
                                <div className="flex flex-wrap justify-center gap-2 mt-4 text-[10px] font-medium text-slate-600">
                                    <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-green-500" /> Present</span>
                                    <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-yellow-400" /> Late</span>
                                    <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-purple-500" /> Half</span>
                                    <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-blue-500" /> Leave</span>
                                    <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-red-500" /> Absent</span>
                                    <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-sky-500" /> Holiday</span>
                                </div>
                            </div>

                            <div className="space-y-3">
                                <div className="bg-white border border-slate-200 rounded-xl p-4 text-center">
                                    <p className="text-3xl font-black text-slate-800">{pct}%</p>
                                    <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold mt-1">Present rate</p>
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                    {Object.entries(counts).map(([k, v]) => (
                                        <div key={k} className="border border-slate-200 rounded-lg p-2 text-center bg-white">
                                            <div className="text-lg font-bold text-slate-800">{v}</div>
                                            <div className="text-[9px] text-slate-500 uppercase tracking-wider font-semibold">{k.replace("_", " ")}</div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
