"use client";

import { useState, useEffect } from "react";
import { hrApi, StaffAttendanceRecord } from "@/lib/hr-api";
import { API_BASE_URL } from "@/lib/api";
import { authFetch } from "@/lib/auth";
import { PieChart, Pie, ResponsiveContainer, Tooltip } from "recharts";

const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

interface HolidayInfo {
    id: number;
    description: string;
    startDate: string;
    endDate: string;
    isEntireSchool: boolean;
}

function findHolidayFor(dateStr: string, holidays: HolidayInfo[]): HolidayInfo | null {
    for (const h of holidays) {
        if (!h.isEntireSchool) continue;
        const start = (h.startDate || "").slice(0, 10);
        const end = (h.endDate || "").slice(0, 10);
        if (start && end && dateStr >= start && dateStr <= end) return h;
    }
    return null;
}

interface Props {
    staffId: number | null;
    staffLabel: string;
    onClose: () => void;
}

function colorFor(status: string | null | undefined) {
    switch (status) {
        case "PRESENT": return "bg-green-500 border-green-600 text-white shadow-sm shadow-green-500/20";
        case "LATE": return "bg-yellow-400 border-yellow-500 text-white shadow-sm shadow-yellow-400/20";
        case "HALF_DAY": return "bg-purple-500 border-purple-600 text-white shadow-sm shadow-purple-500/20";
        case "ON_LEAVE": return "bg-blue-500 border-blue-600 text-white shadow-sm shadow-blue-500/20";
        case "ABSENT": return "bg-red-500 border-red-600 text-white shadow-sm shadow-red-500/20";
        case "HOLIDAY": return "bg-sky-500 border-sky-600 text-white shadow-sm shadow-sky-500/20";
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
    const [holidays, setHolidays] = useState<HolidayInfo[]>([]);
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

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const res = await authFetch(`${API_BASE_URL}/holidays`);
                if (!res.ok) return;
                const list = await res.json();
                if (!cancelled) setHolidays(Array.isArray(list) ? list : []);
            } catch { /* holidays optional */ }
        })();
        return () => { cancelled = true; };
    }, []);

    if (!staffId) return null;

    const daysInMonth = new Date(year, month, 0).getDate();
    const firstDayOfMonth = new Date(year, month - 1, 1).getDay();
    const recordByDate = new Map(records.map((r) => [r.date, r]));

    const cells = Array.from({ length: 42 }, (_, i) => {
        const day = i - firstDayOfMonth + 1;
        if (day < 1 || day > daysInMonth) return { day: null as number | null, status: null as string | null, date: null as string | null, label: "" };
        const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
        const rec = recordByDate.get(dateStr);
        if (rec) return { day, status: rec.status, date: dateStr, label: `${dateStr}: ${rec.status} (${rec.method})` };
        const isSunday = new Date(year, month - 1, day).getDay() === 0;
        if (isSunday) return { day, status: "SUNDAY", date: dateStr, label: `${dateStr}: Sunday (Weekly Off)` };
        const hol = findHolidayFor(dateStr, holidays);
        if (hol) return { day, status: "HOLIDAY", date: dateStr, label: `${dateStr}: ${hol.description}` };
        return { day, status: null, date: dateStr, label: dateStr };
    });

    let holidayAuto = 0;
    for (let d = 1; d <= daysInMonth; d++) {
        const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
        if (recordByDate.has(dateStr)) continue;
        const isSunday = new Date(year, month - 1, d).getDay() === 0;
        if (isSunday || findHolidayFor(dateStr, holidays)) holidayAuto++;
    }

    const counts = {
        PRESENT: records.filter((r) => r.status === "PRESENT").length,
        LATE: records.filter((r) => r.status === "LATE").length,
        HALF_DAY: records.filter((r) => r.status === "HALF_DAY").length,
        ON_LEAVE: records.filter((r) => r.status === "ON_LEAVE").length,
        ABSENT: records.filter((r) => r.status === "ABSENT").length,
        HOLIDAY: records.filter((r) => r.status === "HOLIDAY").length + holidayAuto,
    };
    const presentish = counts.PRESENT + counts.LATE + counts.HALF_DAY;
    const workingMarked = counts.PRESENT + counts.LATE + counts.HALF_DAY + counts.ON_LEAVE + counts.ABSENT;
    const presentPct = workingMarked > 0 ? Math.round((presentish / workingMarked) * 100) : 0;

    const pieData = [
        { name: "Present", value: counts.PRESENT, fill: "#22c55e" },
        { name: "Late", value: counts.LATE, fill: "#facc15" },
        { name: "Half Day", value: counts.HALF_DAY, fill: "#a855f7" },
        { name: "Leave", value: counts.ON_LEAVE, fill: "#3b82f6" },
        { name: "Absent", value: counts.ABSENT, fill: "#ef4444" },
        { name: "Holiday", value: counts.HOLIDAY, fill: "#0ea5e9" },
    ].filter((d) => d.value > 0);

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden">
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
                        <input
                            type="month"
                            value={yyMm}
                            onChange={(e) => setYyMm(e.target.value)}
                            className="bg-white border border-slate-300 text-slate-700 text-sm rounded-lg px-3 py-1.5"
                        />
                    </div>

                    {loading ? (
                        <p className="text-sm text-slate-500 py-10 text-center">Loading…</p>
                    ) : (
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
                            <div className="bg-slate-50 rounded-2xl p-5 border border-slate-200">
                                <h4 className="text-slate-800 font-bold text-center mb-4">{MONTH_NAMES[month - 1]} {year}</h4>
                                <div className="grid grid-cols-7 gap-1 text-center mb-2">
                                    {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((d) => (
                                        <div key={d} className="text-slate-500 text-[10px] font-bold py-1 uppercase">{d}</div>
                                    ))}
                                </div>
                                <div className="grid grid-cols-7 gap-1.5">
                                    {cells.map((c, i) => (
                                        <div
                                            key={i}
                                            title={c.day ? c.label : ""}
                                            className={`aspect-square flex items-center justify-center rounded-lg text-xs font-bold border ${c.day ? colorFor(c.status) : "bg-transparent border-transparent"}`}
                                        >
                                            {c.day ?? ""}
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
                                    <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-orange-100 border border-orange-200" /> Sunday</span>
                                </div>
                            </div>

                            <div className="flex flex-col gap-4">
                                <div className="flex justify-center flex-col items-center bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
                                    {pieData.length > 0 ? (
                                        <div className="relative">
                                            <ResponsiveContainer width={240} height={240}>
                                                <PieChart>
                                                    <Pie data={pieData} cx="50%" cy="50%" innerRadius={70} outerRadius={100} paddingAngle={3} dataKey="value" />
                                                    <Tooltip
                                                        formatter={(val: any, name: any) => [`${val} days`, name]}
                                                        contentStyle={{ borderRadius: "8px", border: "none", boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)" }}
                                                    />
                                                </PieChart>
                                            </ResponsiveContainer>
                                            <div className="absolute inset-0 flex items-center justify-center flex-col pointer-events-none">
                                                <span className="text-slate-800 text-4xl font-black">{presentPct}%</span>
                                                <span className="text-slate-500 text-xs mt-1 uppercase tracking-widest font-bold">Present</span>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="py-10 text-center">
                                            <p className="text-slate-500 text-sm">No attendance data for this month yet.</p>
                                        </div>
                                    )}
                                </div>

                                <div className="grid grid-cols-3 gap-3">
                                    {[
                                        { label: "Present", value: counts.PRESENT, color: "text-green-600", bg: "bg-green-50 border-green-100" },
                                        { label: "Late", value: counts.LATE, color: "text-yellow-600", bg: "bg-yellow-50 border-yellow-100" },
                                        { label: "Half Day", value: counts.HALF_DAY, color: "text-purple-600", bg: "bg-purple-50 border-purple-100" },
                                        { label: "Leave", value: counts.ON_LEAVE, color: "text-blue-600", bg: "bg-blue-50 border-blue-100" },
                                        { label: "Absent", value: counts.ABSENT, color: "text-red-600", bg: "bg-red-50 border-red-100" },
                                        { label: "Holiday", value: counts.HOLIDAY, color: "text-sky-600", bg: "bg-sky-50 border-sky-100" },
                                    ].map((item) => (
                                        <div key={item.label} className={`border rounded-xl p-3 text-center shadow-sm ${item.bg}`}>
                                            <div className={`text-2xl font-black ${item.color} mb-1`}>{item.value}</div>
                                            <div className="text-slate-500 font-bold text-[10px] uppercase tracking-wider">{item.label}</div>
                                        </div>
                                    ))}
                                </div>

                                <div className="bg-slate-800 rounded-xl p-4 flex items-center justify-between text-white shadow-md">
                                    <div className="font-medium text-sm text-slate-300 uppercase tracking-wider">Working Days Marked</div>
                                    <div className="text-2xl font-bold">{workingMarked}</div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
