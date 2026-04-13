"use client";

import { useState, useEffect } from "react";
import { PieChart, Pie, ResponsiveContainer, Tooltip } from "recharts";
import { API_BASE_URL } from "@/lib/api";
import { authFetch } from "@/lib/auth";

const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

interface Props {
    studentId: number | null;
    studentName: string;
    onClose: () => void;
}

export default function StudentAttendanceModal({ studentId, studentName, onClose }: Props) {
    const now = new Date();
    const [attendanceMonth, setAttendanceMonth] = useState(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`);
    const currentYear = parseInt(attendanceMonth.split('-')[0]);
    const currentMonth = parseInt(attendanceMonth.split('-')[1]);
    
    const [attendance, setAttendance] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!studentId) return;

        const fetchAttendance = async () => {
            setLoading(true);
            try {
                // Endpoint accessible to SUB_ADMIN+ (now TEACHER+)
                const res = await authFetch(`${API_BASE_URL}/parent/student/${studentId}/attendance?year=${currentYear}&month=${currentMonth}`);
                if (res.ok) {
                    setAttendance(await res.json());
                } else {
                    setAttendance(null);
                }
            } catch (err) {
                console.error("Failed to fetch student attendance", err);
                setAttendance(null);
            } finally {
                setLoading(false);
            }
        };

        fetchAttendance();
    }, [studentId, currentYear, currentMonth]);

    if (!studentId) return null;

    const pieData = attendance ? [
        { name: "Present", value: attendance.present || 0, color: "#22c55e", fill: "#22c55e" },
        { name: "Late", value: attendance.late || 0, color: "#facc15", fill: "#facc15" },
        { name: "Half Day", value: attendance.halfDay || 0, color: "#a855f7", fill: "#a855f7" },
        { name: "Leave", value: attendance.leave || 0, color: "#3b82f6", fill: "#3b82f6" },
        { name: "Absent", value: attendance.absent || 0, color: "#ef4444", fill: "#ef4444" },
        { name: "Holiday", value: attendance.holiday || 0, color: "#0ea5e9", fill: "#0ea5e9" },
    ].filter(d => d.value > 0) : [];

    // Calendar logic
    const daysInMonth = new Date(currentYear, currentMonth, 0).getDate();
    const firstDayOfMonth = new Date(currentYear, currentMonth - 1, 1).getDay();
    const calendarDays = Array.from({ length: 42 }, (_, i) => {
        const dayNumber = i - firstDayOfMonth + 1;
        if (dayNumber > 0 && dayNumber <= daysInMonth) {
            const dateStr = `${currentYear}-${String(currentMonth).padStart(2, '0')}-${String(dayNumber).padStart(2, '0')}`;
            const record = attendance?.records?.find((r: any) => r.date === dateStr);
            const isSunday = new Date(currentYear, currentMonth - 1, dayNumber).getDay() === 0;
            const effectiveStatus = record?.status || (isSunday ? 'SUNDAY' : undefined);
            return { day: dayNumber, date: dateStr, status: effectiveStatus, isSunday };
        }
        return { day: null, date: null, status: null, isSunday: false };
    });

    const getStatusColor = (status: string | null | undefined) => {
        switch (status) {
            case 'PRESENT': return 'bg-green-500 border-green-600 text-white shadow-sm shadow-green-500/20';
            case 'LATE': return 'bg-yellow-400 border-yellow-500 text-white shadow-sm shadow-yellow-400/20';
            case 'HALF_DAY': return 'bg-purple-500 border-purple-600 text-white shadow-sm shadow-purple-500/20';
            case 'LEAVE': return 'bg-blue-500 border-blue-600 text-white shadow-sm shadow-blue-500/20';
            case 'ABSENT': return 'bg-red-500 border-red-600 text-white shadow-sm shadow-red-500/20';
            case 'HOLIDAY': return 'bg-sky-500 border-sky-600 text-white shadow-sm shadow-sky-500/20';
            case 'SUNDAY': return 'bg-orange-50 text-orange-400 border-orange-200';
            default: return 'bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100';
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden animate-scale-in">
                
                {/* Header */}
                <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50 shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold text-lg">
                            {studentName?.charAt(0) || '?'}
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-slate-800">{studentName}</h2>
                            <p className="text-xs text-slate-500">Monthly Attendance Report</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition bg-white p-2 rounded-full shadow-sm">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
                        </svg>
                    </button>
                </div>

                {/* Body */}
                <div className="p-6 overflow-y-auto custom-scrollbar flex-1">
                    <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
                        <h3 className="font-bold text-slate-800 text-lg flex items-center gap-2">
                            <span className="text-xl">📅</span>
                            Attendance Data
                        </h3>
                        <div className="flex gap-2">
                            <input
                                type="month"
                                value={attendanceMonth}
                                onChange={e => setAttendanceMonth(e.target.value)}
                                className="bg-white border border-slate-300 text-slate-700 text-sm rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm"
                            />
                        </div>
                    </div>

                    {loading ? (
                        <div className="py-24 flex flex-col items-center justify-center gap-4">
                            <div className="w-10 h-10 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
                            <p className="text-slate-500 font-medium">Loading attendance data...</p>
                        </div>
                    ) : attendance && attendance.total > 0 ? (
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
                            
                            {/* Calendar */}
                            <div className="bg-slate-50 rounded-2xl p-6 border border-slate-200 shadow-sm">
                                <h4 className="text-slate-800 font-bold text-center mb-5">{MONTH_NAMES[currentMonth - 1]} {currentYear}</h4>
                                <div className="grid grid-cols-7 gap-1 text-center mb-3">
                                    {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(day => (
                                        <div key={day} className="text-slate-500 text-xs font-bold py-1 uppercase">{day}</div>
                                    ))}
                                </div>
                                <div className="grid grid-cols-7 gap-2">
                                    {calendarDays.reduce((rows: any[], key, index) => {
                                        const weekIndex = Math.floor(index / 7);
                                        if (!rows[weekIndex]) rows[weekIndex] = [];
                                        rows[weekIndex].push(key);
                                        return rows;
                                    }, []).map((week, wIndex) => {
                                        if (week.every((d: any) => d.day === null)) return null;
                                        return week.map((d: any, i: number) => (
                                            <div key={`${wIndex}-${i}`}
                                                title={d.day ? (d.status === 'SUNDAY' ? `${d.date}: Sunday (Weekly Holiday)` : d.status ? `${d.date}: ${d.status}` : d.date) : ''}
                                                className={`aspect-square flex items-center justify-center rounded-xl text-sm font-bold border ${d.day ? getStatusColor(d.status) : 'bg-transparent border-transparent'} transition-all hover:scale-105 cursor-default`}>
                                                {d.day || ''}
                                            </div>
                                        ));
                                    })}
                                </div>
                                
                                <div className="flex flex-wrap justify-center gap-3 mt-8 text-[11px] font-medium text-slate-600">
                                    <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-green-500 shadow-sm"></span> Present</div>
                                    <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-yellow-400 shadow-sm"></span> Late</div>
                                    <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-purple-500 shadow-sm"></span> Half Day</div>
                                    <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-blue-500 shadow-sm"></span> Leave</div>
                                    <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-red-500 shadow-sm"></span> Absent</div>
                                    <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-sky-500 shadow-sm"></span> Holiday</div>
                                    <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-orange-100 border border-orange-200"></span> Sunday</div>
                                </div>
                            </div>

                            {/* Stats & Pie Chart */}
                            <div className="flex flex-col gap-6">
                                <div className="flex justify-center flex-col items-center bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
                                    <div className="relative">
                                        <ResponsiveContainer width={240} height={240}>
                                            <PieChart>
                                                <Pie data={pieData} cx="50%" cy="50%" innerRadius={70} outerRadius={100} paddingAngle={3} dataKey="value" />
                                                <Tooltip formatter={(val: any, name: any) => [`${val} days`, name]} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                                            </PieChart>
                                        </ResponsiveContainer>
                                        <div className="absolute inset-0 flex items-center justify-center flex-col pointer-events-none">
                                            <span className="text-slate-800 text-4xl font-black">{attendance.percentage}%</span>
                                            <span className="text-slate-500 text-xs mt-1 uppercase tracking-widest font-bold">Present</span>
                                        </div>
                                    </div>
                                </div>
                                
                                <div className="grid grid-cols-3 gap-3">
                                    {[
                                        { label: "Present", value: attendance.present, color: "text-green-600", bg: "bg-green-50 border-green-100" },
                                        { label: "Late", value: attendance.late || 0, color: "text-yellow-600", bg: "bg-yellow-50 border-yellow-100" },
                                        { label: "Half Day", value: attendance.halfDay || 0, color: "text-purple-600", bg: "bg-purple-50 border-purple-100" },
                                        { label: "Leave", value: attendance.leave || 0, color: "text-blue-600", bg: "bg-blue-50 border-blue-100" },
                                        { label: "Absent", value: attendance.absent, color: "text-red-600", bg: "bg-red-50 border-red-100" },
                                        { label: "Holiday", value: attendance.holiday || 0, color: "text-sky-600", bg: "bg-sky-50 border-sky-100" },
                                    ].map(item => (
                                        <div key={item.label} className={`border rounded-xl p-3 text-center shadow-sm transition-transform hover:-translate-y-1 ${item.bg}`}>
                                            <div className={`text-2xl font-black ${item.color} mb-1`}>{item.value}</div>
                                            <div className="text-slate-500 font-bold text-[10px] uppercase tracking-wider">{item.label}</div>
                                        </div>
                                    ))}
                                </div>
                                
                                <div className="bg-slate-800 rounded-xl p-4 flex items-center justify-between text-white shadow-md">
                                    <div className="font-medium text-sm text-slate-300 uppercase tracking-wider">Total Working Days</div>
                                    <div className="text-2xl font-bold">{attendance.total - (attendance.holiday || 0)}</div>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="py-24 text-center border-2 border-dashed border-slate-200 rounded-2xl bg-slate-50">
                            <div className="text-5xl mb-4 opacity-50">📅</div>
                            <p className="text-slate-700 font-bold text-lg">No attendance data for {MONTH_NAMES[currentMonth - 1]} {currentYear}</p>
                            <p className="text-slate-500 text-sm mt-2">There are no records found for this student in the selected month.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
