"use client";

import { useState, useEffect } from "react";
import { PieChart, Pie, ResponsiveContainer, Tooltip } from "recharts";
import { ATTENDANCE_TONE, attendanceCellClass } from "@/lib/attendanceColors";
import { CHART_TOOLTIP } from "@/lib/chartTokens";
import { hrApi, StaffAttendanceRecord } from "@/lib/hr-api";
import { AppMonthPicker } from "@/components/ui/AppDatePicker";

const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

interface Props {
    staffId: number | null;
    staffLabel: string;
    onClose: () => void;
}

const STATUS_HEX: Record<string, string> = {
    PRESENT: ATTENDANCE_TONE.PRESENT.fill,
    LATE: ATTENDANCE_TONE.LATE.fill,
    HALF_DAY: ATTENDANCE_TONE.HALF_DAY.fill,
    ON_LEAVE: ATTENDANCE_TONE.LEAVE.fill,
    ABSENT: ATTENDANCE_TONE.ABSENT.fill,
    HOLIDAY: ATTENDANCE_TONE.HOLIDAY.fill,
};

/**
 * Staff records say ON_LEAVE where student records say LEAVE; everything else
 * lines up. Normalising here is what lets both sides share one colour table
 * instead of keeping a second, drifting copy of it.
 */
function getStatusColor(status: string | null | undefined) {
    return attendanceCellClass(status === "ON_LEAVE" ? "LEAVE" : status);
}

/** `isLate` is an overlay fact independent of `status` — a PRESENT or HALF_DAY day can also be late. */
function isLateOverlay(record: StaffAttendanceRecord | null | undefined) {
    return !!record && (record.isLate === true || record.status === "LATE");
}

/**
 * Present/Half-day days that are also late get a diagonal split cell (base color + late yellow)
 * so both facts show at once instead of the late flag being silently swallowed by the status color.
 */
function getCellStyle(status: string | null | undefined, record: StaffAttendanceRecord | null | undefined) {
    const late = isLateOverlay(record);
    if (late && (status === "PRESENT" || status === "HALF_DAY")) {
        return {
            className: "text-white border-slate-300",
            style: { background: `linear-gradient(135deg, ${STATUS_HEX[status]} 50%, ${STATUS_HEX.LATE} 50%)` },
        };
    }
    return { className: getStatusColor(status), style: undefined };
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

    // Five disjoint buckets — every record lands in exactly one, which is what makes
    // them safe to sum for a percentage and to draw as pie slices. Legacy
    // status="LATE" rows fold into PRESENT: late is a kind of present, not a
    // bucket of its own (matches the backend register and my-attendance).
    const counts = {
        PRESENT: records.filter((r) => r.status === "PRESENT" || r.status === "LATE").length,
        HALF_DAY: records.filter((r) => r.status === "HALF_DAY").length,
        ON_LEAVE: records.filter((r) => r.status === "ON_LEAVE").length,
        ABSENT: records.filter((r) => r.status === "ABSENT").length,
        HOLIDAY: records.filter((r) => r.status === "HOLIDAY").length,
    };
    // Overlay, NOT a sixth bucket — a record can be isLate=true and still
    // status=PRESENT. It overlaps the buckets above, so it can never be a pie
    // slice or an addend in the percentage without double-counting those days.
    const lateArrivals = records.filter((r) => isLateOverlay(r)).length;

    const presentish = counts.PRESENT + counts.HALF_DAY;
    // HOLIDAY rows are not working days — including them deflated the rate.
    const workingMarked = presentish + counts.ON_LEAVE + counts.ABSENT;
    const pct = workingMarked > 0 ? Math.round((presentish / workingMarked) * 100) : 0;

    const pieData = [
        { name: "Present", value: counts.PRESENT, fill: STATUS_HEX.PRESENT },
        { name: "Half Day", value: counts.HALF_DAY, fill: STATUS_HEX.HALF_DAY },
        { name: "Leave", value: counts.ON_LEAVE, fill: STATUS_HEX.ON_LEAVE },
        { name: "Absent", value: counts.ABSENT, fill: STATUS_HEX.ABSENT },
        { name: "Holiday", value: counts.HOLIDAY, fill: STATUS_HEX.HOLIDAY },
    ].filter((d) => d.value > 0);

    const tiles = [
        { label: "Present", value: counts.PRESENT, color: "text-green-600", bg: "bg-green-50 border-green-100" },
        { label: "Late arrivals", value: lateArrivals, color: "text-yellow-600", bg: "bg-yellow-50 border-yellow-100" },
        { label: "Half Day", value: counts.HALF_DAY, color: "text-purple-600", bg: "bg-purple-50 border-purple-100" },
        { label: "Leave", value: counts.ON_LEAVE, color: "text-blue-600", bg: "bg-blue-50 border-blue-100" },
        { label: "Absent", value: counts.ABSENT, color: "text-red-600", bg: "bg-red-50 border-red-100" },
        { label: "Holiday", value: counts.HOLIDAY, color: "text-sky-600", bg: "bg-sky-50 border-sky-100" },
    ];

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-walnut-950/55 backdrop-blur-sm">
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
                                    {cells.map((c, i) => {
                                        const { className, style } = c.day ? getCellStyle(c.status, c.record) : { className: "bg-transparent border-transparent", style: undefined };
                                        const late = isLateOverlay(c.record);
                                        return (
                                            <div
                                                key={i}
                                                title={c.day ? (c.record ? `${c.date}: ${c.record.status}${late ? " (late)" : ""} (${c.record.method})` : c.status === "SUNDAY" ? `${c.date}: Sunday` : c.date ?? "") : ""}
                                                style={style}
                                                className={`aspect-square flex items-center justify-center rounded-lg text-xs font-bold border ${className}`}
                                            >
                                                {c.day || ""}
                                            </div>
                                        );
                                    })}
                                </div>
                                <div className="flex flex-wrap justify-center gap-2 mt-4 text-[10px] font-medium text-slate-600">
                                    <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-green-500" /> Present</span>
                                    <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-yellow-400" /> Late</span>
                                    <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-purple-500" /> Half</span>
                                    <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-blue-500" /> Leave</span>
                                    <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-red-500" /> Absent</span>
                                    <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-sky-500" /> Holiday</span>
                                    <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full" style={{ background: `linear-gradient(135deg, ${ATTENDANCE_TONE.PRESENT.fill} 50%, ${ATTENDANCE_TONE.LATE.fill} 50%)` }} /> Present + Late</span>
                                </div>
                            </div>

                            <div className="space-y-4">
                                <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
                                    {pieData.length > 0 ? (
                                        <>
                                            <div className="relative">
                                                <ResponsiveContainer width="100%" height={200}>
                                                    <PieChart>
                                                        {/* minAngle keeps a single-day slice from vanishing behind paddingAngle */}
                                                        <Pie data={pieData} cx="50%" cy="50%" innerRadius={58} outerRadius={82} paddingAngle={3} minAngle={6} dataKey="value" />
                                                        <Tooltip
                                                            formatter={(val: any, name: any) => [`${val} days`, name]}
                                                            wrapperStyle={{ zIndex: 10 }}
                                                            contentStyle={{ borderRadius: "8px", border: "none", boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)" }}
                                                        />
                                                    </PieChart>
                                                </ResponsiveContainer>
                                                <div className="absolute inset-0 flex items-center justify-center flex-col pointer-events-none">
                                                    <span className="text-slate-800 text-3xl font-black">{pct}%</span>
                                                    <span className="text-slate-500 text-[10px] mt-0.5 uppercase tracking-widest font-bold">Present rate</span>
                                                </div>
                                            </div>
                                            {lateArrivals > 0 && (
                                                <p className="text-[10px] text-slate-500 text-center mt-2 leading-snug">
                                                    Includes {lateArrivals} late arrival{lateArrivals === 1 ? "" : "s"} — late days still count as present.
                                                </p>
                                            )}
                                        </>
                                    ) : (
                                        <p className="text-sm text-slate-500 text-center py-12">No attendance marked this month.</p>
                                    )}
                                </div>

                                <div className="grid grid-cols-2 gap-2">
                                    {tiles.map((t) => (
                                        <div key={t.label} className={`border rounded-lg p-2 text-center shadow-sm ${t.bg}`}>
                                            <div className={`text-lg font-bold ${t.color}`}>{t.value}</div>
                                            <div className="text-[9px] text-slate-500 uppercase tracking-wider font-semibold">{t.label}</div>
                                        </div>
                                    ))}
                                </div>

                                <div className="bg-slate-800 rounded-xl px-4 py-3 flex items-center justify-between text-white shadow-md">
                                    <div className="font-medium text-[11px] text-slate-300 uppercase tracking-wider">Working days marked</div>
                                    <div className="text-xl font-bold">{workingMarked}</div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
