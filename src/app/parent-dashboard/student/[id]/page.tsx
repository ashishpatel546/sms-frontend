"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { PieChart, Pie, Tooltip, ResponsiveContainer } from "recharts";
import { API_BASE_URL } from "@/lib/api";
import { getToken, authFetch } from "@/lib/auth";
import toast, { Toaster } from "react-hot-toast";
import ReceiptModal from "@/components/ReceiptModal";
import { getEnv } from "@/lib/env";
import ExamScheduleParentView from "./ExamScheduleParentView";
import PickupQRGenerator from "@/components/PickupQRGenerator";

const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

type ActiveSection = "fees" | "attendance" | "results" | "holidays" | "info" | "exam-schedule" | "homework" | "pickup";

declare global {
    interface Window {
        Razorpay: any;
    }
}

export default function StudentDashboardPage() {
    const params = useParams();
    const router = useRouter();
    const studentId = params.id;

    const now = new Date();
    const [attendanceMonth, setAttendanceMonth] = useState(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`);
    const currentYear = parseInt(attendanceMonth.split('-')[0]);
    const currentMonth = parseInt(attendanceMonth.split('-')[1]);
    const [academicSessionId, setAcademicSessionId] = useState<number | null>(null);
    const [academicYearString, setAcademicYearString] = useState<string>("");
    const [activeSection, setActiveSection] = useState<ActiveSection>("fees");

    const [info, setInfo] = useState<any>(null);
    const [attendance, setAttendance] = useState<any>(null);
    const [fees, setFees] = useState<any>(null);
    const [examResults, setExamResults] = useState<any>(null);
    const [selectedExamCats, setSelectedExamCats] = useState<Set<string>>(new Set());
    const [showCatDropdown, setShowCatDropdown] = useState(false);
    const catDropdownRef = useRef<HTMLDivElement>(null);
    const [holidays, setHolidays] = useState<any[]>([]);
    const [homework, setHomework] = useState<any[]>([]);
    const homeworkDateInputRef = useRef<HTMLInputElement>(null);
    const [homeworkDate, setHomeworkDate] = useState(() => {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    });
    const [sessions, setSessions] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [sectionLoading, setSectionLoading] = useState(false);

    // Sibling students (for the top student-switcher tab strip)
    const [siblings, setSiblings] = useState<any[]>([]);

    // Fee payment selection state (multi-select checkboxes)
    // Initialise category filter whenever exam results load
    useEffect(() => {
        if (examResults?.categories?.length) {
            setSelectedExamCats(new Set(examResults.categories));
        }
    }, [examResults]);

    // Close category dropdown on outside click
    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (catDropdownRef.current && !catDropdownRef.current.contains(e.target as Node)) {
                setShowCatDropdown(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    const [selectedMonths2Pay, setSelectedMonths2Pay] = useState<string[]>([]);
    const [showConfirmModal, setShowConfirmModal] = useState(false);
    const [payProcessing, setPayProcessing] = useState(false);
    const [showReceipt, setShowReceipt] = useState<any>(null);
    const [showReceiptsListModal, setShowReceiptsListModal] = useState<{ feeMonth: string, payments: any[], adjustments: any[], balanceRemaining: number, totalDue?: number, studentName?: string, studentClass?: string, studentSection?: string } | null>(null);

    const authHeaders = { Authorization: `Bearer ${getToken()}` };

    const loadInitialInfo = useCallback(async () => {
        setLoading(true);
        try {
            // First load sessions, info, and sibling list in parallel
            const [infoRes, sessionsRes, siblingsRes] = await Promise.all([
                authFetch(`${API_BASE_URL}/parent/student/${studentId}/info`, { headers: authHeaders }),
                authFetch(`${API_BASE_URL}/parent/academic-sessions`, { headers: authHeaders }),
                authFetch(`${API_BASE_URL}/parent/my-students`, { headers: authHeaders }),
            ]);

            let infoData = null;
            let sessionsList = [];

            if (infoRes.status === 404 || infoRes.status === 403) {
                // Student doesn't belong to this school — send parent back to the listing
                router.replace('/parent-dashboard');
                return;
            }

            if (infoRes.ok) infoData = await infoRes.json();
            if (sessionsRes.ok) sessionsList = await sessionsRes.json();
            if (siblingsRes.ok) {
                const allStudents = await siblingsRes.json();
                // Only show switcher when there are 2+ students
                setSiblings(allStudents.length > 1 ? allStudents : []);
            }

            setInfo(infoData);
            setSessions(sessionsList);

            // Force to use the currently active session globally first, 
            // fallback to whatever the student's active enrollment says, 
            // then fallback to index 0
            const globalActiveSession = sessionsList.find((s: any) => s.isActive);
            const activeSessionId = globalActiveSession?.id || infoData?.academicSessionId || sessionsList[0]?.id;
            const activeSessionStr = globalActiveSession?.name || infoData?.academicSession || sessionsList[0]?.name;

            setAcademicSessionId(activeSessionId);
            setAcademicYearString(activeSessionStr);

        } catch (err) { console.error(err); }
        finally { setLoading(false); }
    }, [studentId]);

    useEffect(() => { loadInitialInfo(); }, [loadInitialInfo]);

    const fetchFees = useCallback(async () => {
        if (!academicYearString) {
            setSectionLoading(false);
            return;
        }
        setSectionLoading(true);
        try {
            const res = await authFetch(`${API_BASE_URL}/parent/student/${studentId}/fees?academicYear=${academicYearString}`, { headers: authHeaders });
            if (res.ok) setFees(await res.json());
        } catch (err) { console.error(err); }
        finally { setSectionLoading(false); }
    }, [studentId, academicYearString]);

    const fetchAttendance = useCallback(async () => {
        setSectionLoading(true);
        try {
            const res = await authFetch(`${API_BASE_URL}/parent/student/${studentId}/attendance?year=${currentYear}&month=${currentMonth}`, { headers: authHeaders });
            if (res.ok) setAttendance(await res.json());
        } catch (err) { console.error(err); }
        finally { setSectionLoading(false); }
    }, [studentId, currentYear, currentMonth]);

    const fetchExamResults = useCallback(async () => {
        if (!academicSessionId) {
            setSectionLoading(false);
            return;
        }
        setSectionLoading(true);
        try {
            const res = await authFetch(`${API_BASE_URL}/parent/student/${studentId}/exam-results?sessionId=${academicSessionId}`, { headers: authHeaders });
            if (res.ok) setExamResults(await res.json());
        } catch (err) { console.error(err); }
        finally { setSectionLoading(false); }
    }, [studentId, academicSessionId]);

    const fetchHolidays = useCallback(async () => {
        setSectionLoading(true);
        try {
            const res = await authFetch(`${API_BASE_URL}/parent/student/${studentId}/holidays`, { headers: authHeaders });
            if (res.ok) setHolidays(await res.json());
        } catch (err) { console.error(err); }
        finally { setSectionLoading(false); }
    }, [studentId]);

    const fetchHomework = useCallback(async () => {
        setSectionLoading(true);
        try {
            const res = await authFetch(`${API_BASE_URL}/parent/student/${studentId}/homework?date=${homeworkDate}`, { headers: authHeaders });
            if (res.ok) setHomework(await res.json());
            else setHomework([]);
        } catch (err) { console.error(err); setHomework([]); }
        finally { setSectionLoading(false); }
    }, [studentId, homeworkDate]);

    // Unconditionally refetch data whenever tab changes or prerequisites change
    useEffect(() => {
        if (activeSection === "fees") fetchFees();
        else if (activeSection === "attendance") fetchAttendance();
        else if (activeSection === "results") fetchExamResults();
        else if (activeSection === "holidays") fetchHolidays();
        else if (activeSection === "homework") fetchHomework();
    }, [activeSection, fetchFees, fetchAttendance, fetchExamResults, fetchHolidays, fetchHomework]);

    const toggleMonthPay = (monthKey: string) => {
        setSelectedMonths2Pay(prev =>
            prev.includes(monthKey) ? prev.filter(k => k !== monthKey) : [...prev, monthKey]
        );
    };

    const handleSessionChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const id = Number(e.target.value);
        const session = sessions.find(s => s.id === id);
        if (session) {
            setAcademicSessionId(id);
            setAcademicYearString(session.name);
            setSelectedMonths2Pay([]);
        }
    };

    const handleConfirmPay = () => {
        if (selectedMonths2Pay.length === 0) return;
        setShowConfirmModal(true);
    };

    const loadRazorpayScript = () => {
        return new Promise((resolve) => {
            if (window.Razorpay) {
                resolve(true);
                return;
            }
            const script = document.createElement("script");
            script.src = "https://checkout.razorpay.com/v1/checkout.js";
            script.onload = () => resolve(true);
            script.onerror = () => resolve(false);
            document.body.appendChild(script);
        });
    };

    const processPayment = async () => {
        setPayProcessing(true);
        try {
            const amount = selectedMonths2Pay.reduce((sum, key) => {
                const m = allDueItems.find((x: any) => x.key === key);
                return sum + (m ? m.amount : 0);
            }, 0);

            // Compute total base fee and discount for the selected months from the unified API data
            let baseFeeAmount = 0;
            let discountAmount = 0;
            let lateFeeTotal = 0;
            const discountNames: string[] = [];

            selectedMonths2Pay.forEach(key => {
                const m = allDueItems.find((x: any) => x.key === key);
                if (m) {
                    baseFeeAmount += m.baseFee || 0;
                    discountAmount += m.discount || 0;
                    lateFeeTotal += m.lateFee || 0;
                    // Attempt to extract discount names if provided by backend (optional detail)
                    if (m.appliedDiscounts && Array.isArray(m.appliedDiscounts)) {
                        m.appliedDiscounts.forEach((d: any) => {
                            if (!discountNames.includes(d.name)) discountNames.push(d.name);
                        });
                    }
                }
            });

            // 1. Ask backend to generate a Razorpay Order
            const res = await authFetch(`${API_BASE_URL}/fees/razorpay/order`, {
                method: "POST",
                headers: { ...authHeaders, "Content-Type": "application/json" },
                body: JSON.stringify({
                    studentId: Number(studentId),
                    academicYear: academicYearString,
                    feeMonths: selectedMonths2Pay,
                })
            });

            if (!res.ok) {
                const errData = await res.json();
                throw new Error(errData.message || "Failed to initiate payment");
            }

            const order = await res.json();

            // 2. Load the official Razorpay script into the browser
            const scriptLoaded = await loadRazorpayScript();
            if (!scriptLoaded) throw new Error("Failed to load Razorpay SDK. Check your connection.");

            const rzpKey = order.keyId as string | undefined;
            if (!rzpKey) throw new Error("Razorpay is not configured for this school. Please contact the school administration.");

            // 3. Configure the checkout popup
            const baseUrl = getEnv('FRONTEND_URL') || window.location.origin;
            const options = {
                key: rzpKey,
                amount: order.amount,
                currency: order.currency,
                name: "School Management System",
                description: `Fee Payment for ${selectedMonths2Pay.length} months`,
                order_id: order.id,
                prefill: {
                    name: `${info.firstName} ${info.lastName}`,
                    contact: info.mobile || ""
                },
                theme: { color: "#4f46e5" },
                // Redirect user automatically to a success verification page
                callback_url: `${baseUrl}/api/razorpay-success-callback`,
                redirect: true,
            };

            const rzpObj = new window.Razorpay(options);

            rzpObj.on('payment.failed', function (response: any) {
                // Redirect user to a failure verification page
                window.location.href = `${baseUrl}/parent-dashboard/payment-failure?order_id=${order.id}&error=${encodeURIComponent(response.error.description || "Unknown Error")}`;
            });

            // Open the popup
            rzpObj.open();

            // Re-enable the button behind the popup so it's not permanently disabled
            setPayProcessing(false);

        } catch (err: any) {
            console.error(err);
            toast.error(err.message || "Failed to initiate payment");
            setPayProcessing(false);
        }
    };

    if (loading || !info) return (
        <div className="flex flex-col items-center justify-center py-24 gap-4">
            <div className="w-10 h-10 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-slate-400 text-sm">Loading student dashboard...</p>
        </div>
    );

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
            // Sundays are auto-holidays; if there's an explicit record use it, otherwise mark SUNDAY
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
            case 'SUNDAY': return 'bg-orange-500/20 border-orange-500/40 text-orange-300';
            default: return 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700/50';
        }
    };

    const dueMonths = fees?.months?.filter((m: any) => !m.paid && m.amount > 0) || [];
    const paidMonths = fees?.months?.filter((m: any) => m.paid && m.amount > 0) || [];

    // Include oneTimeFees in due/paid lists
    const otFee = fees?.oneTimeFees ?? null;
    const dueOneTimeFee = otFee && !otFee.paid && otFee.amount > 0 ? otFee : null;
    const paidOneTimeFee = otFee && otFee.paid && otFee.amount > 0 ? otFee : null;

    // All selectable due items (monthly + one-time)
    const allDueItems = [...(dueOneTimeFee ? [dueOneTimeFee] : []), ...dueMonths];

    const selectedAmountTotal = selectedMonths2Pay.reduce((sum, key) => {
        const m = allDueItems.find((x: any) => x.key === key);
        return sum + (m ? m.amount : 0);
    }, 0);

    return (
        <div className="space-y-4 max-w-5xl">
            <Toaster position="top-right" />

            {/* Back — only when multi-student (single-student parents never see the card grid) */}
            {siblings.length > 0 && (
                <Link href="/parent-dashboard" className="inline-flex items-center gap-1.5 text-slate-400 hover:text-white transition-colors text-sm animate-fade-in">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                    All Students
                </Link>
            )}

            {/* ── Student Switcher (shown when parent has 2+ students) ── */}
            {siblings.length > 0 && (
                <div className="animate-fade-in">
                    <p className="text-slate-500 text-xs mb-2 px-0.5">Switch student</p>
                    <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar snap-x snap-mandatory">
                        {siblings.map((s) => {
                            const isActive = String(s.id) === String(studentId);
                            const initials = `${s.firstName?.[0] ?? ""}${s.lastName?.[0] ?? ""}`;
                            return (
                                <button
                                    key={s.id}
                                    onClick={() => !isActive && router.push(`/parent-dashboard/student/${s.id}`)}
                                    className={`shrink-0 snap-start flex items-center gap-2.5 px-3 py-2 rounded-xl border transition-all text-left
                                        ${isActive
                                            ? "bg-indigo-600/20 border-indigo-500/50 text-white shadow-sm shadow-indigo-500/20"
                                            : "bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-600 hover:text-white hover:bg-slate-800/70"
                                        }`}
                                >
                                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold shrink-0
                                        ${isActive ? "bg-indigo-500 text-white" : "bg-slate-700 text-slate-300"}`}>
                                        {initials}
                                    </div>
                                    <div className="min-w-0">
                                        <p className={`text-sm font-semibold leading-tight truncate max-w-[120px] ${isActive ? "text-white" : "text-slate-300"}`}>
                                            {s.firstName} {s.lastName}
                                        </p>
                                        <p className="text-[10px] text-slate-500 leading-tight truncate">
                                            {[s.className, s.sectionName ? `Sec ${s.sectionName}` : null].filter(Boolean).join(" · ")}
                                        </p>
                                    </div>
                                    {isActive && <div className="w-1.5 h-1.5 rounded-full bg-indigo-400 shrink-0 ml-0.5" />}
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* ── Student Header Card ── */}
            <div className="bg-linear-to-r from-indigo-600/20 to-purple-600/20 border border-indigo-500/30 rounded-xl sm:rounded-2xl p-3 sm:p-5 animate-slide-up">
                <div className="flex items-center gap-3 sm:gap-4">
                    <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-xl sm:rounded-2xl bg-linear-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-lg sm:text-2xl font-bold shadow-lg shrink-0">
                        {info.firstName?.[0]}{info.lastName?.[0]}
                    </div>
                    <div className="flex-1 min-w-0">
                        <h1 className="text-white text-lg sm:text-2xl font-bold truncate">{info.firstName} {info.lastName}</h1>
                        <div className="flex flex-wrap gap-1.5 sm:gap-2 mt-1 sm:mt-2">
                            {info.className && <span className="px-2 py-0.5 sm:px-2.5 sm:py-1 bg-indigo-500/20 text-indigo-300 text-[10px] sm:text-xs rounded-full whitespace-nowrap">{info.className}</span>}
                            {info.sectionName && <span className="px-2 py-0.5 sm:px-2.5 sm:py-1 bg-purple-500/20 text-purple-300 text-[10px] sm:text-xs rounded-full whitespace-nowrap">Sec {info.sectionName}</span>}
                            {info.rollNo && <span className="px-2 py-0.5 sm:px-2.5 sm:py-1 bg-slate-700 text-slate-300 text-[10px] sm:text-xs rounded-full whitespace-nowrap">Roll: {info.rollNo}</span>}
                            {academicYearString && <span className="px-2 py-0.5 sm:px-2.5 sm:py-1 bg-emerald-500/20 text-emerald-300 text-[10px] sm:text-xs rounded-full whitespace-nowrap hidden sm:inline-block">{academicYearString}</span>}
                        </div>
                    </div>
                </div>
            </div>

            {/* ── Section Nav Tabs ── */}
            <div className="grid grid-cols-4 gap-1 bg-slate-900/80 border border-slate-800 rounded-xl p-1.5 animate-slide-up" style={{ animationDelay: '50ms' }}>
                {([
                    ["fees",          "💰", "Fees"],
                    ["attendance",    "📊", "Attendance"],
                    ["results",       "📝", "Results"],
                    ["exam-schedule", "📅", "Schedule"],
                    ["homework",      "📚", "Homework"],
                    ["pickup",        "🚗", "Pickup QR"],
                    ["holidays",      "🏝️", "Holidays"],
                    ["info",          "👤", "My Info"],
                ] as const).map(([key, icon, label]) => (
                    <button
                        key={key}
                        onClick={() => { setActiveSection(key as ActiveSection); if (key !== 'info' && key !== 'exam-schedule' && key !== 'pickup') setSectionLoading(true); }}
                        className={`flex flex-col items-center gap-0.5 py-2.5 px-1 rounded-lg text-xs font-medium transition-all ${activeSection === key ? "bg-indigo-600 text-white shadow" : "text-slate-400 hover:text-white hover:bg-slate-800"}`}
                    >
                        <span className="text-lg leading-none">{icon}</span>
                        <span className="leading-tight text-center">{label}</span>
                    </button>
                ))}
            </div>

            {sectionLoading ? (
                <div className="flex flex-col items-center justify-center py-24 gap-4 animate-fade-in">
                    <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                    <p className="text-slate-400 text-sm">Loading data...</p>
                </div>
            ) : (
                <>
                    {/* ════════════════════════════════
                        FEE & DUES TAB
                    ════════════════════════════════ */}
                    {activeSection === "fees" && (
                        <div className="space-y-4 animate-scale-in">
                            {/* Academic year selector + summary */}
                            <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-900 border border-slate-800 p-4 rounded-2xl">
                        <div className="flex items-center gap-3">
                            <label className="text-slate-400 text-sm">Academic Year:</label>
                            <select value={academicSessionId || ""} onChange={handleSessionChange}
                                className="bg-slate-800 border border-slate-700 text-white text-sm rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500">
                                {sessions.map(s => <option key={s.id} value={s.id}>{s.name} {s.isActive && "(Current)"}</option>)}
                            </select>
                        </div>
                        <div className="flex flex-wrap gap-3 text-sm">
                            <span className="px-3 py-1.5 bg-emerald-500/10 text-emerald-400 rounded-lg border border-emerald-500/20 font-medium">
                                Paid Total: ₹{Number(fees?.totalPaid || 0).toLocaleString()}
                            </span>
                            <span className="px-3 py-1.5 bg-red-500/10 text-red-400 rounded-lg border border-red-500/20 font-medium">
                                Due Total: ₹{Number(fees?.totalDue || 0).toLocaleString()}
                            </span>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        {/* ── Due Months (Selectable checkboxes to pay) ── */}
                        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex flex-col h-full">
                            <div className="flex justify-between items-center mb-4">
                                <h2 className="text-white font-bold flex items-center gap-2">
                                    <span className="w-2 h-2 rounded-full bg-red-400 inline-block"></span>
                                    Pending Dues ({allDueItems.length})
                                </h2>
                                {allDueItems.length > 0 && (
                                    <button onClick={() => setSelectedMonths2Pay(allDueItems.map((m: any) => m.key))} className="text-xs text-indigo-400 hover:text-indigo-300">
                                        Select All
                                    </button>
                                )}
                            </div>

                            {allDueItems.length === 0 ? (
                                <div className="text-center py-12 flex-1 flex flex-col justify-center">
                                    <div className="text-4xl mb-3">🎉</div>
                                    <p className="text-emerald-400 font-semibold text-base">All fees cleared!</p>
                                    <p className="text-slate-500 text-sm mt-1">No pending dues for this session.</p>
                                </div>
                            ) : (
                                <div className="space-y-2 overflow-y-auto max-h-[350px] pr-2 custom-scrollbar">
                                    {/* One-Time & Annual Fees — shown at the top if due */}
                                    {dueOneTimeFee && (() => {
                                        const m = dueOneTimeFee;
                                        return (
                                            <div key={m.key} className={`flex flex-col p-3 rounded-xl transition-all border ${selectedMonths2Pay.includes(m.key) ? "bg-indigo-600/20 border-indigo-500/50 cursor-pointer" : m.status === 'PARTIAL' ? "bg-yellow-500/5 border-yellow-500/30 hover:border-yellow-500/50 cursor-pointer" : "bg-amber-500/5 border-amber-500/30 hover:border-amber-500/50 cursor-pointer"}`}>
                                                <label className="flex justify-between items-center cursor-pointer w-full">
                                                    <div className="flex items-center gap-3">
                                                        <input type="checkbox"
                                                            checked={selectedMonths2Pay.includes(m.key)}
                                                            onChange={() => toggleMonthPay(m.key)}
                                                            className="w-4 h-4 rounded border-slate-600 text-indigo-500 focus:ring-indigo-500 focus:ring-offset-slate-900 bg-slate-800" />
                                                        <div>
                                                            <span className="text-amber-300 text-sm font-semibold">{m.label}</span>
                                                            <span className="ml-2 text-[9px] px-1.5 py-0.5 bg-amber-500/20 text-amber-400 rounded-full font-bold uppercase tracking-wider">Annual</span>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-3">
                                                        <div className="text-right">
                                                            <div className="text-white font-bold text-sm">₹{Number(m.amount).toLocaleString()}</div>
                                                            {m.status === 'PARTIAL' && m.totalPaid > 0 && (
                                                                <div className="text-yellow-400 text-[10px]">₹{Number(m.totalPaid).toLocaleString()} paid of ₹{Number(m.totalDue).toLocaleString()}</div>
                                                            )}
                                                        </div>
                                                        {m.status === 'PARTIAL' ? (
                                                            <span className="text-yellow-400 text-[10px] px-2 py-0.5 bg-yellow-500/10 rounded-full font-bold uppercase tracking-wider">Partial</span>
                                                        ) : (
                                                            <span className="text-red-400 text-[10px] px-2 py-0.5 bg-red-500/10 rounded-full font-bold uppercase tracking-wider">Due</span>
                                                        )}
                                                    </div>
                                                </label>
                                                {(m.categoryBreakdown?.length > 0 || m.discount > 0 || m.lateFee > 0) && (
                                                    <div className="mt-2 ml-7 pl-3 border-l-2 border-amber-500/30 space-y-1">
                                                        {m.categoryBreakdown?.map((cat: any, i: number) => (
                                                            <div key={i} className="flex justify-between text-xs text-slate-400">
                                                                <span>{cat.categoryName}</span>
                                                                <span>₹{cat.amount}</span>
                                                            </div>
                                                        ))}
                                                        {m.discount > 0 && (
                                                            <div className="flex justify-between text-xs text-emerald-400/80">
                                                                <span>Discount</span>
                                                                <span>-₹{m.discount}</span>
                                                            </div>
                                                        )}
                                                        {m.lateFee > 0 && (
                                                            <div className="flex justify-between text-xs text-red-400/80">
                                                                <span>Late Fee</span>
                                                                <span>+₹{m.lateFee}</span>
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                                {m.status === 'PARTIAL' && m.payments && m.payments.length > 0 && (
                                                    <button
                                                        onClick={(e) => {
                                                            e.preventDefault();
                                                            if (m.payments && m.payments.length > 1) {
                                                                setShowReceiptsListModal({
                                                                    feeMonth: m.label,
                                                                    payments: m.payments,
                                                                    adjustments: m.adjustments ?? [],
                                                                    balanceRemaining: m.outstanding ?? 0,
                                                                    totalDue: m.totalDue,
                                                                    studentName: info ? `${info.firstName} ${info.lastName}` : undefined,
                                                                    studentClass: info?.className,
                                                                    studentSection: info?.sectionName,
                                                                });
                                                            } else {
                                                                const paymentToView = m.payments?.[0] || m.payment;
                                                                setShowReceipt({
                                                                    ...paymentToView,
                                                                    components: paymentToView?.components ?? [],
                                                                    feeMonth: m.label,
                                                                    studentName: info ? `${info.firstName} ${info.lastName}` : undefined,
                                                                    studentClass: info?.className,
                                                                    studentSection: info?.sectionName,
                                                                    adjustments: m.adjustments ?? [],
                                                                    balanceRemaining: m.outstanding ?? 0,
                                                                    totalPayable: m.totalDue ?? null,
                                                                });
                                                            }
                                                        }}
                                                        className="mt-2 ml-7 text-xs px-2.5 py-1 bg-yellow-500/10 hover:bg-yellow-500/20 text-yellow-400 rounded-lg transition-colors border border-yellow-500/20 hover:border-yellow-500/40"
                                                    >
                                                        View Partial Receipt
                                                    </button>
                                                )}
                                            </div>
                                        );
                                    })()}

                                    {/* Monthly dues */}
                                    {dueMonths.map((m: any) => (
                                        <div key={m.key} className={`flex flex-col p-3 rounded-xl transition-all border ${selectedMonths2Pay.includes(m.key) ? "bg-indigo-600/20 border-indigo-500/50 cursor-pointer" : m.status === 'PARTIAL' ? "bg-yellow-500/5 border-yellow-500/30 hover:border-yellow-500/50 cursor-pointer" : "bg-slate-800/50 border-slate-700/50 hover:border-slate-600 cursor-pointer"}`}>
                                            <label className="flex justify-between items-center cursor-pointer w-full">
                                                <div className="flex items-center gap-3">
                                                    <input type="checkbox"
                                                        checked={selectedMonths2Pay.includes(m.key)}
                                                        onChange={() => toggleMonthPay(m.key)}
                                                        className="w-4 h-4 rounded border-slate-600 text-indigo-500 focus:ring-indigo-500 focus:ring-offset-slate-900 bg-slate-800" />
                                                    <span className="text-white text-sm font-medium">{m.label}</span>
                                                </div>
                                                <div className="flex items-center gap-3">
                                                    <div className="text-right">
                                                        <div className="text-white font-bold text-sm">₹{Number(m.amount).toLocaleString()}</div>
                                                        {m.status === 'PARTIAL' && m.totalPaid > 0 && (
                                                            <div className="text-yellow-400 text-[10px]">₹{Number(m.totalPaid).toLocaleString()} paid of ₹{Number(m.totalDue).toLocaleString()}</div>
                                                        )}
                                                    </div>
                                                    {m.status === 'UPCOMING' ? (
                                                        <span className="text-sky-400 text-[10px] px-2 py-0.5 bg-sky-500/10 rounded-full font-bold uppercase tracking-wider">Upcoming</span>
                                                    ) : m.status === 'PARTIAL' ? (
                                                        <span className="text-yellow-400 text-[10px] px-2 py-0.5 bg-yellow-500/10 rounded-full font-bold uppercase tracking-wider">Partial</span>
                                                    ) : (
                                                        <span className="text-red-400 text-[10px] px-2 py-0.5 bg-red-500/10 rounded-full font-bold uppercase tracking-wider">Due</span>
                                                    )}
                                                </div>
                                            </label>
                                            {(m.categoryBreakdown?.length > 0 || m.discount > 0 || m.lateFee > 0) && (
                                                <div className="mt-2 ml-7 pl-3 border-l-2 border-slate-700/50 space-y-1">
                                                    {m.categoryBreakdown?.map((cat: any, i: number) => (
                                                        <div key={i} className="flex justify-between text-xs text-slate-400">
                                                            <span>{cat.categoryName}</span>
                                                            <span>₹{cat.amount}</span>
                                                        </div>
                                                    ))}
                                                    {m.discount > 0 && (
                                                        <div className="flex justify-between text-xs text-emerald-400/80">
                                                            <span>Discount</span>
                                                            <span>-₹{m.discount}</span>
                                                        </div>
                                                    )}
                                                    {m.lateFee > 0 && (
                                                        <div className="flex justify-between text-xs text-red-400/80">
                                                            <span>Late Fee</span>
                                                            <span>+₹{m.lateFee}</span>
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                            {/* View Receipt button for partially-paid months */}
                                            {m.status === 'PARTIAL' && m.payments && m.payments.length > 0 && (
                                                <button
                                                    onClick={(e) => {
                                                        e.preventDefault();
                                                        if (m.payments && m.payments.length > 1) {
                                                            setShowReceiptsListModal({
                                                                feeMonth: m.label,
                                                                payments: m.payments,
                                                                adjustments: m.adjustments ?? [],
                                                                balanceRemaining: m.outstanding ?? 0,
                                                                totalDue: m.totalDue,
                                                                studentName: info ? `${info.firstName} ${info.lastName}` : undefined,
                                                                studentClass: info?.className,
                                                                studentSection: info?.sectionName,
                                                            });
                                                        } else {
                                                            const paymentToView = m.payments?.[0] || m.payment;
                                                            setShowReceipt({
                                                                ...paymentToView,
                                                                // Use components as-is — they hold correct per-period amounts.
                                                                // The "Total Paid" row shows what was actually collected.
                                                                components: paymentToView?.components ?? [],
                                                                feeMonth: m.label,
                                                                studentName: info ? `${info.firstName} ${info.lastName}` : undefined,
                                                                studentClass: info?.className,
                                                                studentSection: info?.sectionName,
                                                                adjustments: m.adjustments ?? [],
                                                                balanceRemaining: m.outstanding ?? 0,
                                                                totalPayable: m.totalDue ?? null,
                                                            });
                                                        }
                                                    }}
                                                    className="mt-2 ml-7 text-xs px-2.5 py-1 bg-yellow-500/10 hover:bg-yellow-500/20 text-yellow-400 rounded-lg transition-colors border border-yellow-500/20 hover:border-yellow-500/40"
                                                >
                                                    View Partial Receipt
                                                </button>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* Pay button pinned to bottom */}
                            {selectedMonths2Pay.length > 0 && (
                                <div className="mt-4 pt-4 border-t border-slate-800">
                                    <div className="flex items-center justify-between mb-3 text-sm">
                                        <span className="text-slate-400">Selected ({selectedMonths2Pay.length} item{selectedMonths2Pay.length !== 1 ? 's' : ''})</span>
                                        <span className="text-white font-bold text-xl">₹{selectedAmountTotal.toLocaleString()}</span>
                                    </div>
                                    <button onClick={handleConfirmPay}
                                        className="w-full py-3 bg-linear-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-semibold rounded-xl transition-all shadow-lg shadow-indigo-500/25">
                                        Proceed to Pay
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* ── Paid Months (with receipt) ── */}
                        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex flex-col h-full">
                            <h2 className="text-white font-bold mb-4 flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block"></span>
                                Payment History ({paidMonths.length + (paidOneTimeFee ? 1 : 0)})
                            </h2>
                            {paidMonths.length === 0 && !paidOneTimeFee ? (
                                <p className="text-slate-500 text-sm text-center py-12 flex-1 flex flex-col justify-center">No payment history found for {academicYearString}</p>
                            ) : (
                                <div className="space-y-2 overflow-y-auto max-h-[350px] pr-2 custom-scrollbar">
                                    {/* Paid One-Time & Annual Fees at top */}
                                    {paidOneTimeFee && (() => {
                                        const m = paidOneTimeFee;
                                        return (
                                            <div key={m.key} className="flex items-center gap-3 p-3 bg-amber-500/5 border border-amber-500/20 rounded-xl">
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-amber-300 text-sm font-semibold">{m.label}</p>
                                                    <span className="text-[9px] px-1.5 py-0.5 bg-amber-500/20 text-amber-400 rounded-full font-bold uppercase tracking-wider">Annual</span>
                                                </div>
                                                <div className="text-right whitespace-nowrap">
                                                    <div className="text-emerald-400 text-sm font-bold block mb-1">₹{(m.payments && m.payments.length > 1 ? m.payments.reduce((sum: number, p: any) => sum + Number(p.amountPaid || 0), 0) : Number(m.payment?.amountPaid || 0)).toLocaleString()}</div>
                                                    <button onClick={() => {
                                                        if (m.payments && m.payments.length > 1) {
                                                            setShowReceiptsListModal({
                                                                feeMonth: m.label,
                                                                payments: m.payments,
                                                                adjustments: m.adjustments ?? [],
                                                                balanceRemaining: m.outstanding ?? 0,
                                                                totalDue: m.totalDue,
                                                                studentName: info ? `${info.firstName} ${info.lastName}` : undefined,
                                                                studentClass: info?.className,
                                                                studentSection: info?.sectionName,
                                                            });
                                                        } else {
                                                            const paymentToView = m.payment;
                                                            setShowReceipt({
                                                                ...paymentToView,
                                                                components: paymentToView?.components ?? [],
                                                                feeMonth: m.label,
                                                                studentName: info ? `${info.firstName} ${info.lastName}` : undefined,
                                                                studentClass: info?.className,
                                                                studentSection: info?.sectionName,
                                                                adjustments: m.adjustments ?? [],
                                                                balanceRemaining: m.outstanding ?? 0,
                                                                totalPayable: m.totalDue ?? null,
                                                            });
                                                        }
                                                    }}
                                                        className="text-xs px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition-colors border border-slate-700 hover:border-slate-500">
                                                        Receipt
                                                    </button>
                                                </div>
                                            </div>
                                        );
                                    })()}

                                    {paidMonths.map((m: any) => (
                                        <div key={m.key} className="flex items-center gap-3 p-3 bg-emerald-500/5 border border-emerald-500/20 rounded-xl">
                                            <div className="flex-1 min-w-0">
                                                <p className="text-white text-sm font-medium">{m.label}</p>
                                            </div>
                                            <div className="text-right whitespace-nowrap">
                                                <div className="text-emerald-400 text-sm font-bold block mb-1">₹{(m.payments && m.payments.length > 1 ? m.payments.reduce((sum: number, p: any) => sum + Number(p.amountPaid || 0), 0) : Number(m.payment?.amountPaid || 0)).toLocaleString()}</div>
                                                <button onClick={() => {
                                                    if (m.payments && m.payments.length > 1) {
                                                        setShowReceiptsListModal({
                                                            feeMonth: m.label,
                                                            payments: m.payments,
                                                            adjustments: m.adjustments ?? [],
                                                            balanceRemaining: m.outstanding ?? 0,
                                                            totalDue: m.totalDue,
                                                            studentName: info ? `${info.firstName} ${info.lastName}` : undefined,
                                                            studentClass: info?.className,
                                                            studentSection: info?.sectionName,
                                                        });
                                                    } else {
                                                        const paymentToView = m.payment;
                                                        setShowReceipt({
                                                            ...paymentToView,
                                                            // Use components as-is — they hold correct per-period amounts.
                                                            // The "Total Paid" row shows what was actually collected.
                                                            components: paymentToView?.components ?? [],
                                                            feeMonth: m.label,
                                                            studentName: info ? `${info.firstName} ${info.lastName}` : undefined,
                                                            studentClass: info?.className,
                                                            studentSection: info?.sectionName,
                                                            adjustments: m.adjustments ?? [],
                                                            balanceRemaining: m.outstanding ?? 0,
                                                            totalPayable: m.totalDue ?? null,
                                                        });
                                                    }
                                                }}
                                                    className="text-xs px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition-colors border border-slate-700 hover:border-slate-500">
                                                    Receipt
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* ════════════════════════════════
                ATTENDANCE TAB
            ════════════════════════════════ */}
            {activeSection === "attendance" && (
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 animate-scale-in">
                    <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
                        <h2 className="text-white font-bold text-lg">📊 Attendance</h2>
                        <div className="flex gap-2">
                            <input
                                type="month"
                                value={attendanceMonth}
                                onChange={e => setAttendanceMonth(e.target.value)}
                                className="bg-slate-800 border border-slate-700 text-slate-300 text-sm rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500 [&::-webkit-calendar-picker-indicator]:filter [&::-webkit-calendar-picker-indicator]:invert"
                            />
                        </div>
                    </div>

                    {attendance && attendance.total > 0 ? (
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
                            <div className="bg-slate-800/50 rounded-2xl p-5 border border-slate-700/50">
                                <h3 className="text-white font-semibold text-center mb-4">{MONTH_NAMES[currentMonth - 1]} {currentYear}</h3>
                                <div className="grid grid-cols-7 gap-1 text-center mb-2">
                                    {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(day => (
                                        <div key={day} className="text-slate-400 text-xs font-medium py-1">{day}</div>
                                    ))}
                                </div>
                                <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
                                    {calendarDays.reduce((rows: any[], key, index) => {
                                        // chunk into weeks
                                        const weekIndex = Math.floor(index / 7);
                                        if (!rows[weekIndex]) rows[weekIndex] = [];
                                        rows[weekIndex].push(key);
                                        return rows;
                                    }, []).map((week, wIndex) => {
                                        // only render weeks that have at least one day
                                        if (week.every((d: any) => d.day === null)) return null;
                                        return week.map((d: any, i: number) => (
                                            <div key={`${wIndex}-${i}`}
                                                title={d.day ? (d.status === 'SUNDAY' ? `${d.date}: Sunday (Weekly Holiday)` : d.status ? `${d.date}: ${d.status}` : d.date) : ''}
                                                className={`aspect-square flex items-center justify-center rounded-lg text-sm font-medium border ${d.day ? getStatusColor(d.status) : 'bg-transparent border-transparent'} transition-colors duration-200`}>
                                                {d.day || ''}
                                            </div>
                                        ));
                                    })}
                                </div>
                                <div className="flex flex-wrap justify-center gap-4 mt-6 text-xs text-slate-300">
                                    <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-green-500 shadow-sm shadow-green-500/30"></span> Present</div>
                                    <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-yellow-400 shadow-sm shadow-yellow-400/30"></span> Late</div>
                                    <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-purple-500 shadow-sm shadow-purple-500/30"></span> Half Day</div>
                                    <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-blue-500 shadow-sm shadow-blue-500/30"></span> Leave</div>
                                    <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-red-500 shadow-sm shadow-red-500/30"></span> Absent</div>
                                    <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-sky-500 shadow-sm shadow-sky-500/30"></span> Holiday</div>
                                    <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-orange-500/60 border border-orange-500/40"></span> Sunday</div>
                                </div>
                            </div>

                            <div className="flex flex-col gap-6">
                                <div className="flex justify-center flex-col items-center">
                                    <div className="relative">
                                        <ResponsiveContainer width={220} height={220}>
                                            <PieChart>
                                                <Pie data={pieData} cx="50%" cy="50%" innerRadius={60} outerRadius={90} paddingAngle={3} dataKey="value" />
                                                <Tooltip formatter={(val: any, name: any) => [`${val} days`, name]} contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '8px', color: '#fff' }} />
                                            </PieChart>
                                        </ResponsiveContainer>
                                        <div className="absolute inset-0 flex items-center justify-center flex-col pointer-events-none">
                                            <span className="text-white text-3xl font-bold">{attendance.percentage}%</span>
                                            <span className="text-slate-400 text-xs mt-1 uppercase tracking-wider font-semibold">Present</span>
                                        </div>
                                    </div>
                                </div>
                                <div className="grid grid-cols-3 gap-3">
                                    {[
                                        { label: "Present", value: attendance.present, color: "text-green-400", bg: "bg-green-500/10 border-green-500/20" },
                                        { label: "Late", value: attendance.late || 0, color: "text-yellow-400", bg: "bg-yellow-500/10 border-yellow-500/20" },
                                        { label: "Half Day", value: attendance.halfDay || 0, color: "text-purple-400", bg: "bg-purple-500/10 border-purple-500/20" },
                                        { label: "Leave", value: attendance.leave || 0, color: "text-blue-400", bg: "bg-blue-500/10 border-blue-500/20" },
                                        { label: "Absent", value: attendance.absent, color: "text-red-400", bg: "bg-red-500/10 border-red-500/20" },
                                        { label: "Holiday", value: attendance.holiday || 0, color: "text-sky-400", bg: "bg-sky-500/10 border-sky-500/20" },
                                    ].map(item => (
                                        <div key={item.label} className={`border rounded-xl p-3 text-center shadow-sm ${item.bg}`}>
                                            <div className={`text-2xl font-bold ${item.color} mb-1`}>{item.value}</div>
                                            <div className="text-slate-400 font-medium text-[10px] uppercase">{item.label}</div>
                                        </div>
                                    ))}
                                </div>
                                <div className="mt-2 bg-slate-800 border border-slate-700 rounded-xl p-3 text-center">
                                    <div className="text-slate-300 font-medium text-xs">Total Working Days</div>
                                    <div className="text-xl font-bold text-white mt-1">{attendance.total - (attendance.holiday || 0)}</div>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="py-16 text-center border-2 border-dashed border-slate-800 rounded-xl">
                            <div className="text-4xl mb-3 opacity-60">📅</div>
                            <p className="text-slate-400 font-medium">No attendance data for {MONTH_NAMES[currentMonth - 1]} {currentYear}</p>
                            <p className="text-slate-500 text-sm mt-1">There are no records found for this month.</p>
                        </div>
                    )}
                </div>
            )}

            {/* ════════════════════════════════
                EXAM RESULTS TAB
            ════════════════════════════════ */}
            {activeSection === "results" && (
                <div className="space-y-4 animate-scale-in">
                    <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-900 border border-slate-800 p-4 rounded-2xl">
                        <div className="flex items-center gap-3">
                            <label className="text-slate-400 text-sm">Session:</label>
                            <select value={academicSessionId || ""} onChange={handleSessionChange}
                                className="bg-slate-800 border border-slate-700 text-white text-sm rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500">
                                {sessions.map(s => <option key={s.id} value={s.id}>{s.name} {s.isActive && "(Current)"}</option>)}
                            </select>
                        </div>
                        {examResults?.categories?.length > 0 && (
                            <div className="relative" ref={catDropdownRef}>
                                <button
                                    type="button"
                                    onClick={() => setShowCatDropdown(prev => !prev)}
                                    className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-slate-700 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300"
                                >
                                    <span>Categories ({selectedExamCats.size}/{examResults.categories.length})</span>
                                    <svg className="w-3.5 h-3.5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                                </button>
                                {showCatDropdown && (
                                    <div className="absolute right-0 z-30 mt-1 bg-slate-800 border border-slate-700 rounded-lg shadow-xl py-1.5 min-w-[190px]">
                                        <label className="flex items-center gap-2 px-4 py-2 text-sm cursor-pointer hover:bg-slate-700 border-b border-slate-700">
                                            <input
                                                type="checkbox"
                                                checked={selectedExamCats.size === examResults.categories.length}
                                                onChange={() => {
                                                    if (selectedExamCats.size === examResults.categories.length) {
                                                        setSelectedExamCats(new Set([examResults.categories[0]]));
                                                    } else {
                                                        setSelectedExamCats(new Set(examResults.categories));
                                                    }
                                                }}
                                                className="w-4 h-4 rounded border-slate-600 bg-slate-700 text-indigo-500 focus:ring-indigo-500"
                                            />
                                            <span className="font-medium text-slate-200">Show All</span>
                                        </label>
                                        {examResults.categories.map((cat: string) => (
                                            <label key={cat} className="flex items-center gap-2 px-4 py-2 text-sm cursor-pointer hover:bg-slate-700">
                                                <input
                                                    type="checkbox"
                                                    checked={selectedExamCats.has(cat)}
                                                    onChange={() => {
                                                        setSelectedExamCats(prev => {
                                                            const next = new Set(prev);
                                                            if (next.has(cat)) {
                                                                if (next.size === 1) return prev;
                                                                next.delete(cat);
                                                            } else {
                                                                next.add(cat);
                                                            }
                                                            return next;
                                                        });
                                                    }}
                                                    className="w-4 h-4 rounded border-slate-600 bg-slate-700 text-indigo-500 focus:ring-indigo-500"
                                                />
                                                <span className="text-slate-300">{cat}</span>
                                            </label>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
                        <h2 className="text-white font-bold text-lg mb-4">📝 Examination Dashboard</h2>

                        {(!examResults || examResults.subjects?.length === 0) ? (
                            <div className="text-center py-16 border-2 border-dashed border-slate-800 rounded-xl">
                                <div className="text-4xl mb-3 opacity-50">📑</div>
                                <p className="text-slate-400 text-sm font-medium">No results published for {academicYearString}</p>
                            </div>
                        ) : (
                            <div className="relative overflow-x-auto rounded-lg border border-slate-700 shadow-sm">
                                {/* derive the visible (filtered) category list inline */}
                                {(() => {
                                    const visibleCats: string[] = examResults.categories.filter((c: string) => selectedExamCats.has(c));
                                    return (
                                <table className="w-full text-sm text-left text-slate-300 min-w-[500px]">
                                    <thead className="text-xs text-slate-400 uppercase">
                                        <tr>
                                            <th className="px-4 py-3 bg-slate-800 sticky left-0 z-10 w-40 sm:w-48 align-bottom border-b border-slate-700" rowSpan={2}>Subject</th>
                                            {visibleCats.map((cat: string) => (
                                                <th key={cat} className="px-4 py-3 text-center border-l border-b border-slate-700 bg-slate-800" colSpan={6}>
                                                    {cat}
                                                </th>
                                            ))}
                                        </tr>
                                        <tr>
                                            {visibleCats.map((cat: string) => (
                                                <React.Fragment key={`sub-${cat}`}>
                                                    <th className="px-2 py-2 text-center text-[10px] text-slate-400 border-l border-b border-slate-700 bg-slate-800/80">Th. Marks</th>
                                                    <th className="px-2 py-2 text-center text-[10px] text-purple-400 border-l border-b border-slate-700 bg-purple-900/20">Pr. Marks</th>
                                                    <th className="px-2 py-2 text-center text-[10px] text-slate-400 border-l border-b border-slate-700 bg-slate-800/80">Total</th>
                                                    <th className="px-2 py-2 text-center text-[10px] text-slate-400 border-l border-b border-slate-700 bg-slate-800/80">Obtained</th>
                                                    <th className="px-2 py-2 text-center text-[10px] text-indigo-400 border-l border-b border-slate-700 bg-indigo-900/20">%</th>
                                                    <th className="px-2 py-2 text-center text-[10px] text-slate-400 border-l border-b border-slate-700 bg-slate-800/80">Grade</th>
                                                </React.Fragment>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {examResults.subjects.map((sub: any, idx: number) => (
                                            <tr key={idx} className="border-b border-slate-800 hover:bg-slate-800/30 transition-colors">
                                                <td className="px-4 py-3 font-semibold text-white bg-slate-900 sticky left-0 z-10 text-xs sm:text-sm">{sub.subjectName}</td>
                                                {visibleCats.map((cat: string) => {
                                                    const m = sub.marks[cat];
                                                    const isSplit = sub.hasTheory && sub.hasPractical;
                                                    const calcTotal = isSplit
                                                        ? (Number(m?.theoryTotalMarks || 0) + Number(m?.practicalTotalMarks || 0))
                                                        : Number(m?.totalMarks || 0);
                                                    const calcObtained = isSplit
                                                        ? (Number(m?.theoryObtainedMarks || 0) + Number(m?.practicalObtainedMarks || 0))
                                                        : Number(m?.obtainedMarks || 0);
                                                    return (
                                                        <React.Fragment key={`td-${cat}`}>
                                                            {/* Theory Marks */}
                                                            <td className="px-2 py-2 border-l border-slate-700 text-center">
                                                                {isSplit && m?.theoryTotalMarks
                                                                    ? <div className="text-[10px]">Obt: <span className="font-bold text-white">{m.theoryObtainedMarks ?? '-'}</span><br />Tot: {m.theoryTotalMarks}</div>
                                                                    : <span className="text-slate-600">—</span>}
                                                            </td>
                                                            {/* Practical Marks */}
                                                            <td className="px-2 py-2 border-l border-slate-700 text-center bg-purple-900/10">
                                                                {isSplit && m?.practicalTotalMarks
                                                                    ? <div className="text-[10px] text-purple-300">Obt: <span className="font-bold">{m.practicalObtainedMarks ?? '-'}</span><br />Tot: {m.practicalTotalMarks}</div>
                                                                    : <span className="text-slate-600">—</span>}
                                                            </td>
                                                            {/* Total */}
                                                            <td className="px-2 py-2 border-l border-slate-700 text-center">
                                                                <span className="font-bold text-slate-300">{calcTotal > 0 ? calcTotal : (m?.totalMarks ?? '-')}</span>
                                                            </td>
                                                            {/* Obtained */}
                                                            <td className="px-2 py-2 border-l border-slate-700 text-center">
                                                                <span className="font-bold text-white">{m ? (calcTotal > 0 ? calcObtained : (m.obtainedMarks ?? '-')) : '-'}</span>
                                                            </td>
                                                            {/* Percentage */}
                                                            <td className="px-2 py-2 border-l border-slate-700 text-center bg-indigo-900/10">
                                                                <span className="font-bold text-indigo-300">
                                                                    {m?.percentage != null ? `${Number(m.percentage).toFixed(1)}%` : '-'}
                                                                </span>
                                                            </td>
                                                            {/* Grade / Status */}
                                                            <td className="px-2 py-2 border-l border-slate-700 text-center">
                                                                {m ? (
                                                                    <div className="flex flex-col items-center gap-1">
                                                                        <span className="font-bold text-slate-200">{m.grade || '-'}</span>
                                                                        {m.isPass === true && <span className="px-1.5 py-0.5 text-[9px] font-bold rounded uppercase bg-emerald-500/20 text-emerald-400">Pass</span>}
                                                                        {m.isPass === false && <span className="px-1.5 py-0.5 text-[9px] font-bold rounded uppercase bg-red-500/20 text-red-400">Fail</span>}
                                                                    </div>
                                                                ) : <span className="text-slate-600">-</span>}
                                                            </td>
                                                        </React.Fragment>
                                                    );
                                                })}
                                            </tr>
                                        ))}
                                    </tbody>
                                    <tfoot className="border-t-2 border-slate-700 bg-slate-800/70 font-bold">
                                        <tr>
                                            <td className="px-4 py-4 sticky left-0 z-10 bg-slate-800 text-slate-300 uppercase tracking-wider text-xs">Overall / Total</td>
                                            {visibleCats.map((cat: string) => {
                                                let sumTotal = 0;
                                                let sumObtained = 0;
                                                examResults.subjects.forEach((sub: any) => {
                                                    const m = sub.marks[cat];
                                                    if (m?.totalMarks) sumTotal += Number(m.totalMarks);
                                                    if (m?.obtainedMarks) sumObtained += Number(m.obtainedMarks);
                                                });
                                                const percStr = sumTotal > 0 ? `${((sumObtained * 100) / sumTotal).toFixed(2)}%` : '-';

                                                let overallGrade = '-';
                                                let isPassText = '-';
                                                let isPassColor = '';

                                                if (sumTotal > 0 && examResults.gradingSystems?.length) {
                                                    const perc = (sumObtained * 100) / sumTotal;
                                                    const assigned = examResults.gradingSystems.find((g: any) =>
                                                        perc >= g.minPercentage && (perc < g.maxPercentage || (g.maxPercentage === 100 && perc <= 100))
                                                    );
                                                    if (assigned) {
                                                        overallGrade = assigned.gradeName;
                                                        isPassText = assigned.isFailGrade ? 'FAIL' : 'PASS';
                                                        isPassColor = assigned.isFailGrade
                                                            ? 'bg-red-500/20 text-red-400'
                                                            : 'bg-emerald-500/20 text-emerald-400';
                                                    }
                                                }

                                                return (
                                                    <React.Fragment key={`tfoot-${cat}`}>
                                                        <td className="px-2 py-3 border-l border-slate-700 text-center text-slate-600" colSpan={2}>—</td>
                                                        <td className="px-2 py-3 border-l border-slate-700 text-center text-slate-300">{sumTotal || '-'}</td>
                                                        <td className="px-2 py-3 border-l border-slate-700 text-center text-slate-300">{sumObtained || '-'}</td>
                                                        <td className="px-2 py-3 border-l border-slate-700 text-center font-bold text-indigo-300 bg-indigo-900/20">{percStr}</td>
                                                        <td className="px-2 py-3 border-l border-slate-700 text-center">
                                                            <div className="flex flex-col items-center gap-1">
                                                                <span className="font-bold text-slate-200">{overallGrade}</span>
                                                                {isPassText !== '-' && (
                                                                    <span className={`px-1.5 py-0.5 text-[9px] font-bold rounded uppercase ${isPassColor}`}>{isPassText}</span>
                                                                )}
                                                            </div>
                                                        </td>
                                                    </React.Fragment>
                                                );
                                            })}
                                        </tr>
                                    </tfoot>
                                </table>
                                    );
                                })()}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* ════════════════════════════════
                HOLIDAYS TAB
            ════════════════════════════════ */}
            {activeSection === "holidays" && (
                <div className="space-y-4 animate-scale-in">
                    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="w-10 h-10 rounded-xl bg-sky-500/20 text-sky-400 flex items-center justify-center text-xl">
                                🏝️
                            </div>
                            <div>
                                <h2 className="text-white font-bold text-lg">School Holidays</h2>
                                <p className="text-slate-400 text-sm">Upcoming and past holidays applicable for {info?.firstName}</p>
                            </div>
                        </div>

                        {holidays.length === 0 ? (
                            <div className="text-center py-16 border-2 border-dashed border-slate-800 rounded-xl">
                                <div className="text-4xl mb-3 opacity-50">📅</div>
                                <p className="text-slate-400 text-sm font-medium">No holidays declared at this moment.</p>
                            </div>
                        ) : (
                            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                                {holidays.map((h: any) => {
                                    const start = new Date(h.startDate);
                                    const end = new Date(h.endDate);
                                    const isSingleDay = start.getTime() === end.getTime();
                                    const isUpcoming = end >= now;

                                    return (
                                        <div key={h.id} className={`p-5 rounded-2xl border transition-colors ${isUpcoming ? 'bg-sky-500/10 border-sky-500/30 hover:border-sky-500/50' : 'bg-slate-800/50 border-slate-700 hover:border-slate-600'}`}>
                                            <div className="flex justify-between items-start mb-3">
                                                <h3 className="text-white font-bold">{h.description}</h3>
                                                {isUpcoming ? (
                                                    <span className="px-2 py-0.5 rounded text-[10px] uppercase font-bold bg-sky-500/20 text-sky-400 tracking-wider">Upcoming</span>
                                                ) : (
                                                    <span className="px-2 py-0.5 rounded text-[10px] uppercase font-bold bg-slate-700 text-slate-400 tracking-wider">Past</span>
                                                )}
                                            </div>

                                            <div className="flex items-center text-sm text-slate-300 gap-2 mb-3">
                                                <svg className="w-4 h-4 opacity-70 text-sky-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                                                <span>
                                                    {start.toLocaleDateString("en-IN", { day: 'numeric', month: 'short', year: 'numeric' })}
                                                    {!isSingleDay && ` - ${end.toLocaleDateString("en-IN", { day: 'numeric', month: 'short', year: 'numeric' })}`}
                                                </span>
                                            </div>

                                            {h.isEntireSchool ? (
                                                <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2 py-1 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                                    Entire School
                                                </span>
                                            ) : (
                                                <span className="inline-flex flex-wrap gap-1">
                                                    {h.classes?.map((c: any) => (
                                                        <span key={c.id} className="text-[10px] border border-indigo-500/30 bg-indigo-500/10 text-indigo-300 px-1.5 py-0.5 rounded shadow-sm">{c.name}</span>
                                                    ))}
                                                </span>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* ════════════════════════════════
                PERSONAL INFO TAB
            ════════════════════════════════ */}
            {activeSection === "info" && (
                <div className="space-y-4 animate-scale-in">
                    {/* Subjects */}
                    {info.subjects?.length > 0 && (
                        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
                            <h2 className="text-white font-bold mb-3">📚 Enrolled Subjects</h2>
                            <div className="flex flex-wrap gap-2">
                                {info.subjects.map((s: string, i: number) => (
                                    <span key={i} className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors text-sm rounded-lg border border-slate-700">{s}</span>
                                ))}
                            </div>
                        </div>
                    )}
                    {/* Personal details */}
                    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
                        <h2 className="text-white font-bold mb-4">👤 Student Information</h2>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {[
                                { label: "Father's Name", value: info.fathersName },
                                { label: "Mother's Name", value: info.mothersName },
                                { label: "Date of Birth", value: info.dateOfBirth ? new Date(info.dateOfBirth).toLocaleDateString("en-IN", { day: 'numeric', month: 'long', year: 'numeric' }) : null },
                                { label: "Gender", value: info.gender },
                                { label: "Mobile", value: info.mobile },
                                { label: "Class", value: info.className },
                                { label: "Section", value: info.sectionName },
                                { label: "Roll No", value: info.rollNo },
                                { label: "Academic Session", value: academicYearString },
                            ].filter(f => f.value).map(field => (
                                <div key={field.label} className="flex gap-3 p-3 bg-slate-800/50 rounded-xl border border-transparent hover:border-slate-700 transition-colors">
                                    <span className="text-slate-500 text-sm min-w-[130px]">{field.label}</span>
                                    <span className="text-white text-sm font-medium">{field.value}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* ════════════════════════════════
                EXAM SCHEDULE TAB
            ════════════════════════════════ */}
            {activeSection === "exam-schedule" && info?.classId && academicSessionId && (
                <div className="animate-scale-in">
                    <ExamScheduleParentView classId={info.classId} sessionId={academicSessionId} />
                </div>
            )}

            {/* ════════════════════════════════
                HOMEWORK TAB
            ════════════════════════════════ */}
            {activeSection === "homework" && (
                <div className="space-y-4 animate-scale-in">
                    {(() => {
                        // ── Homework helpers ──────────────────────────────────────────
                        const subjectPalette = [
                            { border: 'border-l-violet-500',  bg: 'bg-violet-500/10',  text: 'text-violet-300',  dot: 'bg-violet-400' },
                            { border: 'border-l-sky-500',     bg: 'bg-sky-500/10',     text: 'text-sky-300',     dot: 'bg-sky-400' },
                            { border: 'border-l-emerald-500', bg: 'bg-emerald-500/10', text: 'text-emerald-300', dot: 'bg-emerald-400' },
                            { border: 'border-l-amber-500',   bg: 'bg-amber-500/10',   text: 'text-amber-300',   dot: 'bg-amber-400' },
                            { border: 'border-l-rose-500',    bg: 'bg-rose-500/10',    text: 'text-rose-300',    dot: 'bg-rose-400' },
                            { border: 'border-l-cyan-500',    bg: 'bg-cyan-500/10',    text: 'text-cyan-300',    dot: 'bg-cyan-400' },
                            { border: 'border-l-fuchsia-500', bg: 'bg-fuchsia-500/10', text: 'text-fuchsia-300', dot: 'bg-fuchsia-400' },
                            { border: 'border-l-orange-500',  bg: 'bg-orange-500/10',  text: 'text-orange-300',  dot: 'bg-orange-400' },
                        ];
                        const subjectColorMap = new Map<string, typeof subjectPalette[0]>();
                        let paletteIdx = 0;
                        const getSubjectColor = (subject: string) => {
                            const key = subject.toLowerCase().trim();
                            if (!subjectColorMap.has(key)) {
                                subjectColorMap.set(key, subjectPalette[paletteIdx % subjectPalette.length]);
                                paletteIdx++;
                            }
                            return subjectColorMap.get(key)!;
                        };

                        const today = new Date();
                        today.setHours(0, 0, 0, 0);
                        const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

                        const shiftDate = (delta: number) => {
                            const [y, m, d] = homeworkDate.split('-').map(Number);
                            const next = new Date(y, m - 1, d + delta);
                            const ns = `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}-${String(next.getDate()).padStart(2, '0')}`;
                            if (ns <= todayStr) setHomeworkDate(ns);
                        };

                        const displayDate = (() => {
                            const [y, m, d] = homeworkDate.split('-').map(Number);
                            const dt = new Date(y, m - 1, d);
                            if (homeworkDate === todayStr) return 'Today';
                            const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1);
                            const yStr = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`;
                            if (homeworkDate === yStr) return 'Yesterday';
                            return dt.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
                        })();

                        const isToday = homeworkDate === todayStr;

                        return (
                            <>
                                {/* ── Header ── */}
                                <div className="flex items-center gap-3 mb-5">
                                    <div className="w-10 h-10 rounded-xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center text-xl shrink-0">📚</div>
                                    <div>
                                        <h2 className="text-white font-bold text-lg leading-tight">Homework</h2>
                                        <p className="text-slate-400 text-sm">{info?.firstName}&apos;s class assignments</p>
                                    </div>
                                </div>

                                {/* ── Day navigator ── */}
                                <div className="flex justify-center mb-5">
                                    <div className="inline-flex items-center bg-slate-800/70 border border-slate-700 rounded-2xl p-1 gap-1 shadow-lg">
                                        {/* Previous day */}
                                        <button
                                            onClick={() => shiftDate(-1)}
                                            className="w-8 h-8 flex items-center justify-center rounded-xl text-slate-400 hover:text-white hover:bg-slate-700 active:scale-90 transition-all text-lg font-bold"
                                            title="Previous day"
                                        >
                                            ‹
                                        </button>

                                        {/* Date label + calendar picker */}
                                        <div className="relative">
                                            <button
                                                type="button"
                                                onClick={() => homeworkDateInputRef.current?.showPicker()}
                                                className="flex items-center gap-2 px-3 py-1.5 rounded-xl hover:bg-slate-700 active:scale-95 transition-all group"
                                                title="Pick a date"
                                            >
                                                <div className="text-center min-w-[72px]">
                                                    <p className="text-white font-semibold text-sm group-hover:text-indigo-300 transition-colors leading-tight">{displayDate}</p>
                                                    {displayDate !== 'Today' && displayDate !== 'Yesterday' && (
                                                        <p className="text-slate-500 text-[10px] leading-tight">{homeworkDate}</p>
                                                    )}
                                                </div>
                                                <span className="text-indigo-400 group-hover:text-indigo-300 transition-colors text-base leading-none">📅</span>
                                            </button>
                                            {/* Input positioned at bottom-center so picker opens near the icon */}
                                            <input
                                                ref={homeworkDateInputRef}
                                                type="date"
                                                value={homeworkDate}
                                                max={todayStr}
                                                onChange={(e) => e.target.value && setHomeworkDate(e.target.value)}
                                                className="absolute bottom-0 left-1/2 -translate-x-1/2 w-px h-px opacity-0 pointer-events-none"
                                            />
                                        </div>

                                        {/* Next day */}
                                        <button
                                            onClick={() => shiftDate(1)}
                                            disabled={isToday}
                                            className="w-8 h-8 flex items-center justify-center rounded-xl text-slate-400 hover:text-white hover:bg-slate-700 active:scale-90 transition-all disabled:opacity-25 disabled:cursor-not-allowed text-lg font-bold"
                                            title="Next day"
                                        >
                                            ›
                                        </button>
                                    </div>
                                </div>

                                {/* ── Content ── */}
                                {sectionLoading ? (
                                    <div className="flex items-center justify-center py-16">
                                        <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                                    </div>
                                ) : homework.length === 0 ? (
                                    <div className="text-center py-16">
                                        <div className="w-16 h-16 rounded-full bg-slate-800 flex items-center justify-center text-3xl mx-auto mb-4">🎉</div>
                                        <p className="text-slate-300 font-medium">No homework for {displayDate.toLowerCase()}!</p>
                                        <p className="text-slate-500 text-sm mt-1">Check another date or enjoy the break.</p>
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        {homework.map((h: any) => {
                                            const color = getSubjectColor(h.subject || 'general');
                                            return (
                                                <div key={h.id} className={`bg-slate-800/50 border border-slate-700/60 border-l-4 ${color.border} rounded-xl p-4 hover:bg-slate-800 transition-colors`}>
                                                    {h.subject && (
                                                        <div className="flex items-center gap-1.5 mb-2">
                                                            <span className={`w-2 h-2 rounded-full shrink-0 ${color.dot}`} />
                                                            <span className={`text-xs font-bold uppercase tracking-wide ${color.text}`}>{h.subject}</span>
                                                        </div>
                                                    )}
                                                    <p className="text-slate-200 text-sm leading-relaxed whitespace-pre-line">{h.message}</p>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </>
                        );
                    })()}
                </div>
            )}

                </>
            )}

            {/* ════════════════════════════════
                PICKUP QR TAB
            ════════════════════════════════ */}
            {activeSection === "pickup" && (
                <div className="space-y-4 animate-scale-in">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center text-xl shrink-0">🚗</div>
                        <div>
                            <h2 className="text-white font-bold text-lg leading-tight">Pickup QR</h2>
                            <p className="text-slate-400 text-sm">Authorise someone to collect {info?.firstName}</p>
                        </div>
                    </div>
                    <PickupQRGenerator studentId={Number(studentId)} studentName={info ? `${info.firstName} ${info.lastName}` : undefined} />
                </div>
            )}

            {/* ── Payment Confirmation Modal ── */}
            {showConfirmModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                    <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 max-w-sm w-full shadow-2xl">
                        <div className="mb-5 text-center">
                            <div className="w-16 h-16 bg-indigo-500/20 text-indigo-400 rounded-full flex items-center justify-center text-2xl mx-auto mb-3">
                                💳
                            </div>
                            <h3 className="text-white font-bold text-xl">Confirm Payment</h3>
                            <p className="text-slate-400 text-sm mt-1">You are paying for {selectedMonths2Pay.length} months</p>
                        </div>

                        <div className="bg-slate-800 rounded-xl p-4 mb-5 space-y-2">
                            {selectedMonths2Pay.map(key => {
                                const m = fees?.months.find((x: any) => x.key === key);
                                return (
                                    <div key={key} className="flex justify-between text-sm">
                                        <span className="text-slate-300">{m?.label}</span>
                                        <span className="text-white font-medium">₹{Number(m?.amount).toLocaleString()}</span>
                                    </div>
                                );
                            })}
                            <div className="border-t border-slate-700 pt-2 mt-2 flex justify-between">
                                <span className="text-slate-400">Total Amount</span>
                                <span className="text-indigo-400 font-bold text-lg">₹{selectedAmountTotal.toLocaleString()}</span>
                            </div>
                        </div>

                        <div className="flex gap-3">
                            <button onClick={() => setShowConfirmModal(false)} disabled={payProcessing}
                                className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-white font-medium rounded-xl transition-colors text-sm disabled:opacity-50">
                                Cancel
                            </button>
                            <button onClick={processPayment} disabled={payProcessing}
                                className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-medium rounded-xl transition-colors text-sm disabled:opacity-50 flex items-center justify-center gap-2">
                                {payProcessing ? <><svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg> Processing...</> : "Confirm Pay"}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Receipt Selection Modal ── */}
            {showReceiptsListModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                    <div className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
                        <div className="bg-slate-800 px-5 py-4 flex justify-between items-center">
                            <h3 className="text-white font-bold text-lg">Multiple Receipts</h3>
                            <button onClick={() => setShowReceiptsListModal(null)} className="text-slate-400 hover:text-white transition-colors">
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                        </div>
                        <div className="p-5">
                            <p className="text-slate-400 text-sm mb-4">You made multiple partial payments for {showReceiptsListModal.feeMonth}. Please select a receipt to view.</p>
                            
                            <div className="space-y-3 max-h-[60vh] overflow-y-auto custom-scrollbar">
                                {showReceiptsListModal.payments.map((p: any, idx: number) => (
                                    <button 
                                        key={idx}
                                        onClick={() => {
                                            setShowReceiptsListModal(null);
                                            setShowReceipt({
                                                ...p,
                                                // Use components as-is — correct per-period amounts from DB
                                                components: p.components ?? [],
                                                feeMonth: showReceiptsListModal.feeMonth,
                                                studentName: showReceiptsListModal.studentName,
                                                studentClass: showReceiptsListModal.studentClass,
                                                studentSection: showReceiptsListModal.studentSection,
                                                adjustments: showReceiptsListModal.adjustments,
                                                balanceRemaining: showReceiptsListModal.balanceRemaining,
                                                totalPayable: showReceiptsListModal.totalDue ?? null,
                                            });
                                        }}
                                        className="w-full text-left p-3 rounded-xl bg-slate-800/50 hover:bg-slate-800 border border-slate-700 hover:border-indigo-500/50 transition-all flex justify-between items-center group"
                                    >
                                        <div>
                                            <div className="text-white font-medium text-sm mb-1">{p.receiptNumber}</div>
                                            <div className="text-slate-500 text-xs">{new Date(p.paymentDate).toLocaleDateString("en-IN", { day: '2-digit', month: 'short', year: 'numeric' })} · {p.paymentMethod}</div>
                                        </div>
                                        <div className="text-right">
                                            <div className="text-indigo-400 font-bold text-sm group-hover:text-indigo-300">₹{Number(p.amountPaid).toLocaleString()}</div>
                                            <div className="text-xs px-2 py-0.5 mt-1 bg-indigo-500/10 text-indigo-400 rounded inline-block">View &rarr;</div>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Receipt Detail Modal ── */}
            {showReceipt && (
                <ReceiptModal
                    receiptData={showReceipt}
                    onClose={() => setShowReceipt(null)}
                />
            )}
        </div>
    );
}
