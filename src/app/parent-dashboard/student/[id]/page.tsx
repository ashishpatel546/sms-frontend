"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import FeatureNotAvailableNotice from "@/components/parent/FeatureNotAvailableNotice";
import Link from "next/link";
import { PieChart, Pie, Tooltip, ResponsiveContainer } from "recharts";
import { API_BASE_URL } from "@/lib/api";
import { getToken, authFetch } from "@/lib/auth";
import toast, { Toaster } from "react-hot-toast";
import ReceiptModal from "@/components/ReceiptModal";
import { getEnv } from "@/lib/env";
import ExamScheduleParentView from "./ExamScheduleParentView";
import PickupQRGenerator from "@/components/PickupQRGenerator";
import VisitorQRGenerator from "@/components/VisitorQRGenerator";
import ApplyLeaveModal from "@/components/ApplyLeaveModal";
import LeaveTimeline from "@/components/LeaveTimeline";
import { AppMonthPicker } from "@/components/ui/AppDatePicker";
import { HomeSection } from "./components/HomeSection";
import { SectionRail } from "./components/SectionRail";
import type { SectionKey } from "./sectionStyle";
import { StudentBanner } from "./components/StudentBanner";
import { AiToolsSection } from "./components/AiToolsSection";
import { IdCardSection } from "./components/IdCardSection";
import { SectionSkeleton, StudentRecordSkeleton } from "@/components/ui/Skeletons";
import { ATTENDANCE_LEGEND, ATTENDANCE_TONE, attendanceCellStyle } from "@/lib/attendanceColors";
import { InitialsAvatar } from "@/components/ui/InitialsAvatar";
import { createSubjectColorMap } from "@/lib/subjectColors";
import { AttendanceBottomSheet } from "./components/AttendanceBottomSheet";
import { HomeworkBottomSheet } from "./components/HomeworkBottomSheet";
import FeesBottomSheet from "./components/FeesBottomSheet";
import { useLibraryIssuances } from "./hooks/useStudentData";
import {
    BookOpen,
    CalendarDays,
    ChevronLeft,
    IndianRupee,
    Library,
    Palmtree,
    QrCode,
    CheckCircle2,
    AlertCircle,
    CreditCard,
} from "lucide-react";
import { PageBody, PageHeader, PageShell } from "@/components/ui/PageHeader";
import { StatusChip } from "@/components/ui/StatusChip";

const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

const LEAVE_STATUS_PIGMENT: Record<string, 'attn' | 'info' | 'success' | 'danger' | 'neutral'> = {
    PENDING: 'attn',
    FIRST_APPROVED: 'info',
    APPROVED: 'success',
    REJECTED: 'danger',
    CANCELLED: 'neutral',
};
const LEAVE_STATUS_LABELS: Record<string, string> = {
    PENDING: "Pending",
    FIRST_APPROVED: "1st Approved",
    APPROVED: "Approved",
    REJECTED: "Rejected",
    CANCELLED: "Cancelled",
};
const LEAVE_TYPE_LABELS: Record<string, string> = {
    SICK_LEAVE: "Sick Leave",
    CASUAL_LEAVE: "Casual Leave",
    OTHER_LEAVE: "Other Leave",
};
const fmtDate = (d: string) => { const [y, m, day] = d.split("-"); return `${day}/${m}/${y}`; };

type ActiveSection = "home" | "fees" | "attendance" | "results" | "holidays" | "info" | "exam-schedule" | "homework" | "pickup" | "id-card" | "leaves" | "library" | "ai-tutor";

/**
 * Sections whose data THIS page fetches, and which therefore need the loading
 * skeleton while it happens. Every other tab loads itself and must not raise
 * `sectionLoading` — nothing would ever lower it, and the panel would sit
 * behind a skeleton forever.
 *
 * Listed positively on purpose. This was a negative list ("every section
 * except these six"), and the ID card tab was added without being added to it,
 * so it hung on a permanent skeleton. A new self-contained tab now stays
 * correct by default; only a tab that genuinely needs a page-level fetch has
 * to be named here, and whoever adds that fetch is looking right at this list.
 */
const PAGE_FETCHED_SECTIONS: readonly ActiveSection[] = [
    "fees",
    "attendance",
    "results",
    "holidays",
    "homework",
    "leaves",
];

declare global {
    interface Window {
        Razorpay: new (opts: Record<string, unknown>) => {
            open: () => void;
            on: (event: string, handler: (response: any) => void) => void;
        };
    }
}

export default function StudentDashboardPage() {
    const params = useParams();
    const router = useRouter();
    const studentId = params.id;

    // QR Codes tab: pickup (existing, with history) vs visiting (stateless, no history)
    const [qrMode, setQrMode] = useState<"pickup" | "visit">("pickup");

    const now = new Date();
    const [attendanceMonth, setAttendanceMonth] = useState(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`);
    const currentYear = parseInt(attendanceMonth.split('-')[0]);
    const currentMonth = parseInt(attendanceMonth.split('-')[1]);
    const [academicSessionId, setAcademicSessionId] = useState<number | null>(null);
    const [academicYearString, setAcademicYearString] = useState<string>("");
    const [activeSection, setActiveSection] = useState<ActiveSection>("home");

    const [info, setInfo] = useState<any>(null);
    const [attendance, setAttendance] = useState<any>(null);
    const [fees, setFees] = useState<any>(null);
    const [examResults, setExamResults] = useState<any>(null);
    const [selectedExamCats, setSelectedExamCats] = useState<Set<string>>(new Set());
    const [showCatDropdown, setShowCatDropdown] = useState(false);
    const catDropdownRef = useRef<HTMLDivElement>(null);
    const [holidays, setHolidays] = useState<any[]>([]);
    const [homework, setHomework] = useState<any[]>([]);
    const [leaves, setLeaves] = useState<any>(null);
    const [leavesPage, setLeavesPage] = useState(1);
    const [showApplyLeave, setShowApplyLeave] = useState(false);
    const [viewerDoc, setViewerDoc] = useState<{ url: string; fileName: string; mimeType: string } | null>(null);
    const [cancelLeaveId, setCancelLeaveId] = useState<number | null>(null);
    const [cancelLeaving, setCancelLeaving] = useState(false);
    const [viewLeave, setViewLeave] = useState<any | null>(null);
    const [replyLeaveId, setReplyLeaveId] = useState<number | null>(null);
    const [replyNote, setReplyNote] = useState("");
    const [replyFile, setReplyFile] = useState<File | null>(null);
    const [replySending, setReplySending] = useState(false);
    const homeworkDateInputRef = useRef<HTMLInputElement>(null);
    const [homeworkDate, setHomeworkDate] = useState(() => {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    });
    const [sessions, setSessions] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [sectionLoading, setSectionLoading] = useState(false);

    // Quick-view bottom sheets
    const [showAttendanceSheet, setShowAttendanceSheet] = useState(false);
    const [showHomeworkSheet, setShowHomeworkSheet] = useState(false);
    const [showFeesSheet, setShowFeesSheet] = useState(false);

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
    // School feature flag: when false, the online payment gateway (Razorpay) is hidden
    const [onlinePaymentEnabled, setOnlinePaymentEnabled] = useState(false);
    const [visitorMgmtEnabled, setVisitorMgmtEnabled] = useState(false);
    const [showReceipt, setShowReceipt] = useState<any>(null);
    const [showReceiptsListModal, setShowReceiptsListModal] = useState<{ feeMonth: string, payments: any[], adjustments: any[], balanceRemaining: number, totalDue?: number, studentName?: string, studentClass?: string, studentSection?: string } | null>(null);

    const authHeaders = { Authorization: `Bearer ${getToken()}` };

    const loadInitialInfo = useCallback(async () => {
        setLoading(true);
        try {
            // First load sessions, info, and sibling list in parallel
            const [infoRes, sessionsRes, siblingsRes, featuresRes] = await Promise.all([
                authFetch(`${API_BASE_URL}/parent/student/${studentId}/info`, { headers: authHeaders }),
                authFetch(`${API_BASE_URL}/parent/academic-sessions`, { headers: authHeaders }),
                authFetch(`${API_BASE_URL}/parent/my-students`, { headers: authHeaders }),
                authFetch(`${API_BASE_URL}/school/features`, { headers: authHeaders }),
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
            if (featuresRes.ok) {
                const features = await featuresRes.json();
                setOnlinePaymentEnabled(features?.['online_fee_payment'] === true);
                setVisitorMgmtEnabled(features?.['visitor_management'] === true);
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

    const fetchLeaves = useCallback(async (p = 1) => {
        setSectionLoading(true);
        try {
            const res = await authFetch(`${API_BASE_URL}/leaves/student/${studentId}?page=${p}&limit=10`, { headers: authHeaders });
            if (res.ok) setLeaves(await res.json());
        } catch (err) { console.error(err); }
        finally { setSectionLoading(false); }
    }, [studentId]);

    const handleReply = async () => {
        if (!replyLeaveId) return;
        if (!replyNote.trim() && !replyFile) {
            toast.error("Please write a message or attach a document.");
            return;
        }
        if (replyFile && replyFile.size > 5 * 1024 * 1024) {
            toast.error("File is too large. Maximum size is 5 MB.");
            return;
        }
        setReplySending(true);
        try {
            const formData = new FormData();
            if (replyNote.trim()) formData.append("note", replyNote.trim());
            if (replyFile) formData.append("file", replyFile);
            const res = await authFetch(`${API_BASE_URL}/leaves/${replyLeaveId}/respond`, {
                method: "POST",
                body: formData,
            });
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err.message || "Failed to send reply");
            }
            toast.success("Reply sent!");
            setReplyLeaveId(null);
            setReplyNote("");
            setReplyFile(null);
            fetchLeaves(leavesPage);
        } catch (err: any) {
            toast.error(err.message || "Failed to send reply");
        } finally {
            setReplySending(false);
        }
    };

    const handleOpenDoc = async (leaveId: number, doc: { id: number; fileName: string; mimeType: string }) => {
        try {
            const res = await authFetch(`${API_BASE_URL}/leaves/${leaveId}/documents/${doc.id}/url`);
            if (res.ok) {
                const { url } = await res.json();
                setViewerDoc({ url, fileName: doc.fileName, mimeType: doc.mimeType });
            } else {
                toast.error("Failed to get document URL");
            }
        } catch { toast.error("Failed to get document URL"); }
    };

    const handleOpenWorksheet = async (h: { id: string; worksheetFileName: string; worksheetMimeType: string | null }) => {
        try {
            const res = await authFetch(`${API_BASE_URL}/parent/student/${studentId}/homework/${h.id}/worksheet-url`);
            if (res.ok) {
                const { url } = await res.json();
                setViewerDoc({ url, fileName: h.worksheetFileName, mimeType: h.worksheetMimeType || "" });
            } else {
                toast.error("Failed to open worksheet");
            }
        } catch { toast.error("Failed to open worksheet"); }
    };

    const handleCancelLeave = async () => {
        if (!cancelLeaveId) return;
        setCancelLeaving(true);
        try {
            const res = await authFetch(`${API_BASE_URL}/leaves/${cancelLeaveId}/cancel`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({}),
            });
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err.message || "Cancellation failed");
            }
            toast.success("Leave cancelled");
            setCancelLeaveId(null);
            fetchLeaves(leavesPage);
        } catch (err: any) {
            toast.error(err.message || "Failed to cancel leave");
        } finally {
            setCancelLeaving(false);
        }
    };

    // Unconditionally refetch data whenever tab changes or prerequisites change
    useEffect(() => {
        if (activeSection === "fees") fetchFees();
        else if (activeSection === "attendance") fetchAttendance();
        else if (activeSection === "results") fetchExamResults();
        else if (activeSection === "holidays") fetchHolidays();
        else if (activeSection === "homework") fetchHomework();
        else if (activeSection === "leaves") fetchLeaves(leavesPage);
    }, [activeSection, fetchFees, fetchAttendance, fetchExamResults, fetchHolidays, fetchHomework, fetchLeaves, leavesPage]);

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

    const processPayment = async (keysOverride?: string[], itemsOverride?: any[]) => {
        if (!onlinePaymentEnabled) return;
        const keys = keysOverride ?? selectedMonths2Pay;
        const items = itemsOverride ?? allDueItems;
        setPayProcessing(true);
        try {
            const amount = keys.reduce((sum, key) => {
                const m = items.find((x: any) => x.key === key);
                return sum + (m ? m.amount : 0);
            }, 0);

            // Compute total base fee and discount for the selected months from the unified API data
            let baseFeeAmount = 0;
            let discountAmount = 0;
            let lateFeeTotal = 0;
            const discountNames: string[] = [];

            keys.forEach(key => {
                const m = items.find((x: any) => x.key === key);
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
                    feeMonths: keys,
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
                description: `Fee Payment for ${keys.length} months`,
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

    // Traces this screen's own layout — identity strip, the 12 section tabs,
    // then the panels — so the tab grid is already in place under the thumb
    // that is reaching for it.
    if (loading || !info) return <StudentRecordSkeleton />;

    const pieData = attendance ? ([
        ["PRESENT", attendance.present],
        ["LATE", attendance.late],
        ["HALF_DAY", attendance.halfDay],
        ["LEAVE", attendance.leave],
        ["ABSENT", attendance.absent],
        ["HOLIDAY", attendance.holiday],
    ] as const).map(([status, value]) => ({
        name: ATTENDANCE_TONE[status].label,
        value: value || 0,
        color: ATTENDANCE_TONE[status].fill,
        fill: ATTENDANCE_TONE[status].fill,
    })).filter(d => d.value > 0) : [];

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

    /**
     * Selecting a section. Lifted out of the tab's inline handler unchanged so
     * the strip and the More sheet share one path — behaviour is identical to
     * before: attendance/homework/fees still open a bottom sheet under 768px,
     * re-tapping the current tab still re-fetches, and the same six sections
     * still skip the loading state because they hold their own data.
     */
    const goToSection = (section: ActiveSection) => {
        const isMobile = typeof window !== "undefined" && window.innerWidth < 768;
        if (isMobile && section === "attendance") { setShowAttendanceSheet(true); return; }
        if (isMobile && section === "homework") { setShowHomeworkSheet(true); return; }
        if (isMobile && section === "fees") { setShowFeesSheet(true); return; }
        if (section === activeSection) {
            // Already on this tab — re-fetch directly
            if (section === "leaves") fetchLeaves(leavesPage);
            else if (section === "fees") { setSectionLoading(true); fetchFees(); }
            else if (section === "results") { setSectionLoading(true); fetchExamResults(); }
            else if (section === "holidays") { setSectionLoading(true); fetchHolidays(); }
        } else {
            setActiveSection(section);
            if (PAGE_FETCHED_SECTIONS.includes(section)) setSectionLoading(true);
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
        <div className="max-w-5xl space-y-4 px-3 py-4 sm:px-5 sm:py-6">
            <Toaster position="top-right" />

            {/* ── Student Switcher (shown when parent has 2+ students) ──
                The back link shares this row rather than taking one of its own:
                on a 667px phone the identity chrome above the fold was three
                stacked bands deep before any of the child's actual news. */}
            {siblings.length > 0 && (
                <div className="animate-fade-in">
                    <div className="mb-2 flex items-center justify-between gap-3 px-0.5">
                        <p className="eyebrow">Switch child</p>
                        <Link
                            href="/parent-dashboard"
                            className="inline-flex items-center gap-1 text-[12px] font-medium text-ink-muted transition-colors hover:text-brand"
                        >
                            <ChevronLeft className="size-3.5" aria-hidden />
                            All children
                        </Link>
                    </div>
                    <div className="flex gap-2.5 overflow-x-auto pb-1 no-scrollbar snap-x snap-mandatory">
                        {siblings.map((s, idx) => {
                            const isActive = String(s.id) === String(studentId);
                            const initials = `${s.firstName?.[0] ?? ""}${s.lastName?.[0] ?? ""}`;
                            /*
                             * Identity and selection are different jobs, and this
                             * used to conflate them: each sibling owned a whole
                             * violet/teal/rose/amber/green palette that coloured
                             * the chip, the border and the dot when selected — so
                             * "which child am I looking at" was said in a colour
                             * that means nothing anywhere else in the app.
                             *
                             * Now the AVATAR carries identity (InitialsAvatar owns
                             * the tones) and SELECTION is brass everywhere, exactly
                             * as it is for tabs, nav and buttons.
                             */
                            return (
                                <button
                                    key={s.id}
                                    onClick={() => !isActive && router.push(`/parent-dashboard/student/${s.id}`)}
                                    aria-current={isActive ? "true" : undefined}
                                    className={`flex min-w-40 shrink-0 snap-start cursor-pointer items-center gap-3 rounded-xl border px-3.5 py-2.5 text-left transition-all duration-200
                                        ${isActive
                                            ? "border-brand bg-brand-tint shadow-soft"
                                            : "border-line bg-surface hover:-translate-y-0.5 hover:border-brand-edge hover:shadow-soft"
                                        }`}
                                >
                                    <InitialsAvatar initials={initials} index={idx} size="md" className="shadow-soft" />
                                    <div className="min-w-0 flex-1">
                                        <p className={`truncate text-sm leading-tight font-semibold ${isActive ? "text-brand-deep" : "text-ink"}`}>
                                            {s.firstName} {s.lastName}
                                        </p>
                                        <p className="mt-0.5 truncate text-[11px] leading-tight text-ink-muted">
                                            {[s.className, s.sectionName ? `Sec ${s.sectionName}` : null].filter(Boolean).join(" · ")}
                                        </p>
                                    </div>
                                    {isActive && <div className="size-2 shrink-0 rounded-full bg-brand" />}
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* ── Student Header Card ── */}
            {/* Identity is said once. With a switcher on screen the highlighted
                chip already carries avatar, name and class — the banner repeated
                all three directly beneath it. Single-child parents have no
                switcher, so for them the banner is the only place it appears. */}
            {siblings.length === 0 && <StudentBanner studentId={studentId as string} />}

            {/* ── Section Nav ─────────────────────────────────────────────
                On Today there is no nav here at all: the Quick Access grid
                inside the panel IS the navigation, so the sections appear once
                rather than twice. Inside a section a parent still needs to move
                sideways and get back, so the rail appears there instead.

                The twelve-tile grid this replaces gave every section identical
                weight, which is how the portal read as an admin console.
            ──────────────────────────────────────────────────────────────── */}
            {activeSection !== "home" && (
                <SectionRail active={activeSection as SectionKey} onSelect={goToSection} />
            )}

            {sectionLoading ? (
                // The frame above is already on screen and stays put; only the
                // panel area is unknown, so only the panel area is drawn.
                <SectionSkeleton stats={activeSection === "attendance" || activeSection === "fees"} />
            ) : (
                <>
                    {/* ════════════════════════════════
                        HOME TAB
                    ════════════════════════════════ */}
                    {activeSection === "home" && (
                        <div
                            id="tabpanel-home"
                            role="tabpanel"
                            aria-labelledby="tab-home"
                            className="animate-scale-in"
                        >
                            <HomeSection studentId={studentId as string} academicYearString={academicYearString} sessionId={academicSessionId} onChangeSection={goToSection} />
                        </div>
                    )}

                    {/* ════════════════════════════════
                        LIBRARY TAB
                    ════════════════════════════════ */}
                    {activeSection === "library" && (
                        <div id="tabpanel-library" role="tabpanel" aria-labelledby="tab-library" className="animate-scale-in">
                            <StudentLibrarySection studentId={studentId as string} />
                        </div>
                    )}

                    {/* ════════════════════════════════
                        AI TUTOR TAB
                    ════════════════════════════════ */}
                    {activeSection === "ai-tutor" && (
                        <div id="tabpanel-ai-tutor" role="tabpanel" aria-labelledby="tab-ai-tutor" className="animate-scale-in">
                            <AiToolsSection studentId={studentId as string} info={info} />
                        </div>
                    )}

                    {/* ════════════════════════════════
                        FEE & DUES TAB
                    ════════════════════════════════ */}
                    {activeSection === "fees" && (
                        <div id="tabpanel-fees" role="tabpanel" aria-labelledby="tab-fees" className="space-y-4 animate-scale-in">
                            {/* Academic year selector + summary */}
                            <div className="flex flex-wrap items-center justify-between gap-3 bg-white/80 backdrop-blur-sm border border-slate-200 p-4 rounded-2xl">
                        <div className="flex items-center gap-3">
                            <label className="text-ink-muted text-sm font-medium">Academic Year:</label>
                            <select value={academicSessionId || ""} onChange={handleSessionChange}
                                className="bg-slate-100 border border-slate-200 text-ink text-sm rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-brand">
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
                        <div className="bg-white/80 backdrop-blur-sm border border-slate-200 rounded-2xl shadow-soft p-5 flex flex-col h-full">
                            <div className="flex justify-between items-center mb-4">
                                <h2 className="text-ink font-bold flex items-center gap-2">
                                    <span className="w-2 h-2 rounded-full bg-red-400 inline-block"></span>
                                    Pending Dues ({allDueItems.length})
                                </h2>
                                {onlinePaymentEnabled && allDueItems.length > 0 && (
                                    <button onClick={() => setSelectedMonths2Pay(allDueItems.map((m: any) => m.key))} className="text-xs text-brand hover:text-brand-light font-medium">
                                        Select All
                                    </button>
                                )}
                            </div>

                            {/* Dues stay listed either way; only the pay-online
                                path depends on the school having enabled it. */}
                            {!onlinePaymentEnabled && allDueItems.length > 0 && (
                                <FeatureNotAvailableNotice
                                    title="Online fee payment"
                                    description="You would be able to pay these dues from here by card or UPI."
                                    className="mb-4"
                                />
                            )}

                            {allDueItems.length === 0 ? (
                                <div className="text-center py-12 flex-1 flex flex-col justify-center">
                                    <div className="mx-auto mb-3 grid size-12 place-items-center rounded-full bg-accent-success-tint text-accent-success-deep"><CheckCircle2 className="size-6" aria-hidden /></div>
                                    <p className="text-emerald-400 font-semibold text-base">All fees cleared!</p>
                                    <p className="text-slate-500 text-sm mt-1">No pending dues for this session.</p>
                                </div>
                            ) : (
                                <div className="space-y-2 overflow-y-auto max-h-87.5 pr-2 custom-scrollbar">
                                    {/* One-Time & Annual Fees — shown at the top if due */}
                                    {dueOneTimeFee && (() => {
                                        const m = dueOneTimeFee;
                                        return (
                                            <div key={m.key} className={`flex flex-col p-3 rounded-xl transition-all border ${selectedMonths2Pay.includes(m.key) ? "bg-indigo-600/20 border-indigo-500/50" : m.status === 'PARTIAL' ? "bg-yellow-500/5 border-yellow-500/30" : "bg-amber-500/5 border-amber-500/30"} ${onlinePaymentEnabled ? "cursor-pointer hover:border-amber-500/50" : ""}`}>
                                                <label className={`flex justify-between items-center w-full ${onlinePaymentEnabled ? "cursor-pointer" : ""}`}>
                                                    <div className="flex items-center gap-3">
                                                        {onlinePaymentEnabled && (
                                                            <input type="checkbox"
                                                                checked={selectedMonths2Pay.includes(m.key)}
                                                                onChange={() => toggleMonthPay(m.key)}
                                                                className="w-4 h-4 rounded border-slate-300 text-indigo-500 focus:ring-brand/40 focus:ring-offset-white bg-slate-100" />
                                                        )}
                                                        <div>
                                                            <span className="text-amber-700 text-sm font-semibold">{m.label}</span>
                                                            <span className="ml-2 text-[9px] px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded-full font-bold uppercase tracking-wider">Annual</span>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-3">
                                                        <div className="text-right">
                                                            <div className="text-ink font-bold text-sm">₹{Number(m.amount).toLocaleString()}</div>
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
                                        <div key={m.key} className={`flex flex-col p-3 rounded-xl transition-all border ${selectedMonths2Pay.includes(m.key) ? "bg-indigo-600/20 border-indigo-500/50" : m.status === 'PARTIAL' ? "bg-yellow-500/5 border-yellow-500/30" : "bg-slate-100/60 border-slate-200/50"} ${onlinePaymentEnabled ? "cursor-pointer hover:border-slate-300" : ""}`}>
                                            <label className={`flex justify-between items-center w-full ${onlinePaymentEnabled ? "cursor-pointer" : ""}`}>
                                                <div className="flex items-center gap-3">
                                                    {onlinePaymentEnabled && (
                                                        <input type="checkbox"
                                                            checked={selectedMonths2Pay.includes(m.key)}
                                                            onChange={() => toggleMonthPay(m.key)}
                                                            className="w-4 h-4 rounded border-slate-300 text-indigo-500 focus:ring-brand/40 focus:ring-offset-white bg-slate-100" />
                                                    )}
                                                    <span className="text-ink text-sm font-medium">{m.label}</span>
                                                </div>
                                                <div className="flex items-center gap-3">
                                                    <div className="text-right">
                                                        <div className="text-ink font-bold text-sm">₹{Number(m.amount).toLocaleString()}</div>
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
                                                <div className="mt-2 ml-7 pl-3 border-l-2 border-slate-200/50 space-y-1">
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

                            {/* Notice when online payment is disabled for the school */}
                            {!onlinePaymentEnabled && allDueItems.length > 0 && (
                                <div className="mt-4 pt-4 border-t border-slate-200">
                                    <div className="flex items-start gap-2 p-3 bg-sky-500/5 border border-sky-500/20 rounded-xl">
                                        <span className="text-sm">ℹ️</span>
                                        <p className="text-sky-700 text-xs">Online payment is not available. Please pay at the school office.</p>
                                    </div>
                                </div>
                            )}

                            {/* Pay button pinned to bottom */}
                            {onlinePaymentEnabled && selectedMonths2Pay.length > 0 && (
                                <div className="mt-4 pt-4 border-t border-slate-200">
                                    <div className="flex items-center justify-between mb-3 text-sm">
                                        <span className="text-slate-400">Selected ({selectedMonths2Pay.length} item{selectedMonths2Pay.length !== 1 ? 's' : ''})</span>
                                        <span className="text-ink font-bold text-xl">₹{selectedAmountTotal.toLocaleString()}</span>
                                    </div>
                                    <button onClick={handleConfirmPay}
                                        className="w-full py-3 bg-linear-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-ink font-semibold rounded-xl transition-all shadow-lg shadow-indigo-500/25">
                                        Proceed to Pay
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* ── Paid Months (with receipt) ── */}
                        <div className="bg-white/80 backdrop-blur-sm border border-slate-200 rounded-2xl shadow-soft p-5 flex flex-col h-full">
                            <h2 className="text-ink font-bold mb-4 flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block"></span>
                                Payment History ({paidMonths.length + (paidOneTimeFee ? 1 : 0)})
                            </h2>
                            {paidMonths.length === 0 && !paidOneTimeFee ? (
                                <p className="text-slate-500 text-sm text-center py-12 flex-1 flex flex-col justify-center">No payment history found for {academicYearString}</p>
                            ) : (
                                <div className="space-y-2 overflow-y-auto max-h-87.5 pr-2 custom-scrollbar">
                                    {/* Paid One-Time & Annual Fees at top */}
                                    {paidOneTimeFee && (() => {
                                        const m = paidOneTimeFee;
                                        return (
                                            <div key={m.key} className="flex items-center gap-3 p-3 bg-amber-500/5 border border-amber-500/20 rounded-xl">
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-amber-700 text-sm font-semibold">{m.label}</p>
                                                    <span className="text-[9px] px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded-full font-bold uppercase tracking-wider">Annual</span>
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
                                                        className="text-xs px-2.5 py-1 bg-slate-100 hover:bg-slate-100 text-ink rounded-lg transition-colors border border-slate-200 hover:border-brand/40">
                                                        Receipt
                                                    </button>
                                                </div>
                                            </div>
                                        );
                                    })()}

                                    {paidMonths.map((m: any) => (
                                        <div key={m.key} className="flex items-center gap-3 p-3 bg-emerald-500/5 border border-emerald-500/20 rounded-xl">
                                            <div className="flex-1 min-w-0">
                                                <p className="text-ink text-sm font-medium">{m.label}</p>
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
                                                    className="text-xs px-2.5 py-1 bg-slate-100 hover:bg-slate-100 text-ink rounded-lg transition-colors border border-slate-200 hover:border-brand/40">
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
                <div id="tabpanel-attendance" role="tabpanel" aria-labelledby="tab-attendance" className="bg-white/80 backdrop-blur-sm border border-slate-200 rounded-2xl shadow-soft p-6 animate-scale-in">
                    <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
                        <h2 className="text-ink font-bold text-lg">Attendance</h2>
                        <div className="flex gap-2">
                            <AppMonthPicker
                                value={attendanceMonth}
                                onChange={(v) => setAttendanceMonth(v)}
                            />
                        </div>
                    </div>

                    {attendance && attendance.total > 0 ? (
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
                            <div className="bg-slate-100/60 rounded-2xl p-5 border border-slate-200/50">
                                <h3 className="text-ink font-semibold text-center mb-4">{MONTH_NAMES[currentMonth - 1]} {currentYear}</h3>
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
                                        return week.map((d: any, i: number) => {
                                            const { className, style } = d.day ? attendanceCellStyle(d.status) : { className: 'bg-transparent border-transparent', style: undefined };
                                            return (
                                                <div key={`${wIndex}-${i}`}
                                                    title={d.day ? (d.status === 'SUNDAY' ? `${d.date}: Sunday (Weekly Holiday)` : d.status ? `${d.date}: ${d.status}` : d.date) : ''}
                                                    style={style}
                                                    className={`aspect-square flex items-center justify-center rounded-lg text-sm font-medium border ${className} transition-colors duration-200`}>
                                                    {d.day || ''}
                                                </div>
                                            );
                                        });
                                    })}
                                </div>
                                <div className="mt-6 flex flex-wrap justify-center gap-x-4 gap-y-2 text-xs text-ink">
                                    {ATTENDANCE_LEGEND.filter(status => status !== 'LATE' && status !== 'HALF_DAY').map(status => (
                                        <div key={status} className="flex items-center gap-1.5">
                                            <span className={`size-3 rounded-full ${ATTENDANCE_TONE[status].dot}`} />
                                            {ATTENDANCE_TONE[status].label}
                                        </div>
                                    ))}
                                    {/* Late/half-day both count as present, so their cell is a split circle — one glance shows both facts. */}
                                    <div className="flex items-center gap-1.5">
                                        <span className="size-3 rounded-full" style={{ background: `linear-gradient(135deg, ${ATTENDANCE_TONE.PRESENT.fill} 50%, ${ATTENDANCE_TONE.LATE.fill} 50%)` }} />
                                        Present + Late
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                        <span className="size-3 rounded-full" style={{ background: `linear-gradient(135deg, ${ATTENDANCE_TONE.PRESENT.fill} 50%, ${ATTENDANCE_TONE.HALF_DAY.fill} 50%)` }} />
                                        Present + Half day
                                    </div>
                                </div>
                            </div>

                            <div className="flex flex-col gap-6">
                                <div className="flex justify-center flex-col items-center">
                                    <div className="relative">
                                        <ResponsiveContainer width={220} height={220}>
                                            <PieChart>
                                                <Pie data={pieData} cx="50%" cy="50%" innerRadius={60} outerRadius={90} paddingAngle={3} dataKey="value" />
                                                {/* Tokens, not hex — this used to be a hardcoded
                                                    white card with near-black text, which was an
                                                    unreadable flash of white in the dark theme. */}
                                                <Tooltip
                                                    formatter={(val: any, name: any) => [`${val} days`, name]}
                                                    wrapperStyle={{ zIndex: 10 }}
                                                    contentStyle={{
                                                        background: 'var(--surface)',
                                                        border: '1px solid var(--line)',
                                                        borderRadius: 'var(--radius-md)',
                                                        color: 'var(--ink)',
                                                        boxShadow: 'var(--shadow-raised)',
                                                    }}
                                                    itemStyle={{ color: 'var(--ink)' }}
                                                />
                                            </PieChart>
                                        </ResponsiveContainer>
                                        <div className="absolute inset-0 flex items-center justify-center flex-col pointer-events-none">
                                            <span className="text-ink text-3xl font-bold">{attendance.percentage}%</span>
                                            <span className="text-ink-muted text-xs mt-1 uppercase tracking-wider font-semibold">Present</span>
                                        </div>
                                    </div>
                                </div>
                                <div className="grid grid-cols-3 gap-3">
                                    {([
                                        ["PRESENT", attendance.present],
                                        ["LATE", attendance.late],
                                        ["HALF_DAY", attendance.halfDay],
                                        ["LEAVE", attendance.leave],
                                        ["ABSENT", attendance.absent],
                                        ["HOLIDAY", attendance.holiday],
                                    ] as const).map(([status, value]) => (
                                        <div
                                            key={status}
                                            className={`rounded-xl border p-3 text-center ${ATTENDANCE_TONE[status].tile}`}
                                        >
                                            <div className={`tabular mb-1 text-2xl font-bold ${ATTENDANCE_TONE[status].figure}`}>
                                                {value || 0}
                                            </div>
                                            <div className="eyebrow">{ATTENDANCE_TONE[status].label}</div>
                                        </div>
                                    ))}
                                </div>
                                <div className="mt-2 bg-brand/5 border border-brand/20 rounded-xl p-3 text-center">
                                    <div className="text-ink-muted font-medium text-xs">Total Working Days</div>
                                    <div className="text-xl font-bold text-ink mt-1">{attendance.workingDaysCount ?? (attendance.total - (attendance.holiday || 0))}</div>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="py-16 text-center border-2 border-dashed border-slate-200 rounded-xl">
                            <div className="mx-auto mb-3 grid size-12 place-items-center rounded-full bg-surface-secondary text-ink-faint"><CalendarDays className="size-6" aria-hidden /></div>
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
                <div id="tabpanel-results" role="tabpanel" aria-labelledby="tab-results" className="space-y-4 animate-scale-in">
                    <div className="flex flex-wrap items-center justify-between gap-3 bg-white/80 backdrop-blur-sm border border-slate-200 p-4 rounded-2xl">
                        <div className="flex items-center gap-3">
                            <label className="text-slate-400 text-sm">Session:</label>
                            <select value={academicSessionId || ""} onChange={handleSessionChange}
                                className="bg-slate-100 border border-slate-200 text-ink text-sm rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-brand">
                                {sessions.map(s => <option key={s.id} value={s.id}>{s.name} {s.isActive && "(Current)"}</option>)}
                            </select>
                        </div>
                        {examResults?.categories?.length > 0 && (
                            <div className="relative" ref={catDropdownRef}>
                                <button
                                    type="button"
                                    onClick={() => setShowCatDropdown(prev => !prev)}
                                    className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-slate-200 rounded-lg bg-slate-100 hover:bg-slate-100 text-ink"
                                >
                                    <span>Categories ({selectedExamCats.size}/{examResults.categories.length})</span>
                                    <svg className="w-3.5 h-3.5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                                </button>
                                {showCatDropdown && (
                                    <div className="absolute right-0 z-30 mt-1 bg-slate-100 border border-slate-200 rounded-lg shadow-xl py-1.5 min-w-47.5">
                                        <label className="flex items-center gap-2 px-4 py-2 text-sm cursor-pointer hover:bg-slate-100 border-b border-slate-200">
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
                                                className="w-4 h-4 rounded border-slate-300 bg-slate-100 text-brand focus:ring-brand"
                                            />
                                            <span className="font-medium text-ink">Show All</span>
                                        </label>
                                        {examResults.categories.map((cat: string) => (
                                            <label key={cat} className="flex items-center gap-2 px-4 py-2 text-sm cursor-pointer hover:bg-slate-100">
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
                                                    className="w-4 h-4 rounded border-slate-300 bg-slate-100 text-indigo-500 focus:ring-brand/40"
                                                />
                                                <span className="text-ink">{cat}</span>
                                            </label>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    <div className="bg-white/80 backdrop-blur-sm border border-slate-200 rounded-2xl shadow-soft p-6">
                        <h2 className="text-ink font-bold text-lg mb-4">Examination Dashboard</h2>

                        {(!examResults || examResults.subjects?.length === 0) ? (
                            <div className="text-center py-16 border-2 border-dashed border-slate-200 rounded-xl">
                                <div className="text-4xl mb-3 opacity-50">📑</div>
                                <p className="text-slate-400 text-sm font-medium">No results published for {academicYearString}</p>
                            </div>
                        ) : (
                            <div className="relative overflow-x-auto rounded-lg border border-slate-200 shadow-sm">
                                {/* derive the visible (filtered) category list inline */}
                                {(() => {
                                    const visibleCats: string[] = examResults.categories.filter((c: string) => selectedExamCats.has(c));
                                    return (
                                <table className="w-full text-sm text-left text-ink min-w-125">
                                    <thead className="text-xs text-slate-400 uppercase">
                                        <tr>
                                            <th className="px-4 py-3 bg-slate-100 sticky left-0 z-10 w-40 sm:w-48 align-bottom border-b border-slate-200" rowSpan={2}>Subject</th>
                                            {visibleCats.map((cat: string) => (
                                                <th key={cat} className="px-4 py-3 text-center border-l border-b border-slate-200 bg-slate-100" colSpan={6}>
                                                    {cat}
                                                </th>
                                            ))}
                                        </tr>
                                        <tr>
                                            {visibleCats.map((cat: string) => (
                                                <React.Fragment key={`sub-${cat}`}>
                                                    <th className="px-2 py-2 text-center text-[10px] text-slate-400 border-l border-b border-slate-200 bg-slate-100/80">Th. Marks</th>
                                                    <th className="px-2 py-2 text-center text-[10px] text-purple-400 border-l border-b border-slate-200 bg-purple-900/20">Pr. Marks</th>
                                                    <th className="px-2 py-2 text-center text-[10px] text-slate-400 border-l border-b border-slate-200 bg-slate-100/80">Total</th>
                                                    <th className="px-2 py-2 text-center text-[10px] text-slate-400 border-l border-b border-slate-200 bg-slate-100/80">Obtained</th>
                                                    <th className="px-2 py-2 text-center text-[10px] text-indigo-400 border-l border-b border-slate-200 bg-indigo-900/20">%</th>
                                                    <th className="px-2 py-2 text-center text-[10px] text-slate-400 border-l border-b border-slate-200 bg-slate-100/80">Grade</th>
                                                </React.Fragment>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {examResults.subjects.map((sub: any, idx: number) => (
                                            <tr key={idx} className="border-b border-slate-200 hover:bg-slate-50/30 transition-colors">
                                                <td className="px-4 py-3 font-semibold text-ink bg-surface sticky left-0 z-10 text-xs sm:text-sm border-r border-slate-200">{sub.subjectName}</td>
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
                                                            <td className="px-2 py-2 border-l border-slate-200 text-center">
                                                                {isSplit && m?.theoryTotalMarks
                                                                    ? <div className="text-[10px] text-ink-muted">Obt: <span className="font-bold text-ink">{m.theoryObtainedMarks ?? '-'}</span><br />Tot: {m.theoryTotalMarks}</div>
                                                                    : <span className="text-ink-muted">—</span>}
                                                            </td>
                                                            {/* Practical Marks */}
                                                            <td className="px-2 py-2 border-l border-slate-200 text-center bg-purple-500/10">
                                                                {isSplit && m?.practicalTotalMarks
                                                                    ? <div className="text-[10px] text-purple-600">Obt: <span className="font-bold">{m.practicalObtainedMarks ?? '-'}</span><br />Tot: {m.practicalTotalMarks}</div>
                                                                    : <span className="text-ink-muted">—</span>}
                                                            </td>
                                                            {/* Total */}
                                                            <td className="px-2 py-2 border-l border-slate-200 text-center">
                                                                <span className="font-bold text-ink">{calcTotal > 0 ? calcTotal : (m?.totalMarks ?? '-')}</span>
                                                            </td>
                                                            {/* Obtained */}
                                                            <td className="px-2 py-2 border-l border-slate-200 text-center">
                                                                <span className="font-bold text-ink">{m ? (calcTotal > 0 ? calcObtained : (m.obtainedMarks ?? '-')) : '-'}</span>
                                                            </td>
                                                            {/* Percentage */}
                                                            <td className="px-2 py-2 border-l border-slate-200 text-center bg-brand/10">
                                                                <span className="font-bold text-brand">
                                                                    {m?.percentage != null ? `${Number(m.percentage).toFixed(1)}%` : '-'}
                                                                </span>
                                                            </td>
                                                            {/* Grade / Status */}
                                                            <td className="px-2 py-2 border-l border-slate-200 text-center">
                                                                {m ? (
                                                                    <div className="flex flex-col items-center gap-1">
                                                                        <span className="font-bold text-ink-muted">{m.grade || '-'}</span>
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
                                    <tfoot className="border-t-2 border-slate-200 bg-slate-100/70 font-bold">
                                        <tr>
                                            <td className="px-4 py-4 sticky left-0 z-10 bg-slate-100 text-ink uppercase tracking-wider text-xs">Overall / Total</td>
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
                                                        <td className="px-2 py-3 border-l border-slate-200 text-center text-ink-muted" colSpan={2}>—</td>
                                                        <td className="px-2 py-3 border-l border-slate-200 text-center text-ink font-semibold">{sumTotal || '-'}</td>
                                                        <td className="px-2 py-3 border-l border-slate-200 text-center text-ink font-semibold">{sumObtained || '-'}</td>
                                                        <td className="px-2 py-3 border-l border-slate-200 text-center font-bold text-brand bg-brand/10">{percStr}</td>
                                                        <td className="px-2 py-3 border-l border-slate-200 text-center">
                                                            <div className="flex flex-col items-center gap-1">
                                                                <span className="font-bold text-ink">{overallGrade}</span>
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
                <div id="tabpanel-holidays" role="tabpanel" aria-labelledby="tab-holidays" className="space-y-4 animate-scale-in">
                    <div className="bg-white/80 backdrop-blur-sm border border-slate-200 rounded-2xl shadow-soft p-6">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="grid size-10 place-items-center rounded-lg bg-accent-info-tint text-accent-info-deep">
                                <Palmtree className="size-5" aria-hidden />
                            </div>
                            <div>
                                <h2 className="text-ink font-bold text-lg">School Holidays</h2>
                                <p className="text-slate-400 text-sm">Upcoming and past holidays applicable for {info?.firstName}</p>
                            </div>
                        </div>

                        {holidays.length === 0 ? (
                            <div className="text-center py-16 border-2 border-dashed border-slate-200 rounded-xl">
                                <div className="mx-auto mb-3 grid size-12 place-items-center rounded-full bg-surface-secondary text-ink-faint"><CalendarDays className="size-6" aria-hidden /></div>
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
                                        <div key={h.id} className={`p-5 rounded-2xl border transition-colors ${isUpcoming ? 'bg-sky-500/10 border-sky-500/30 hover:border-sky-500/50' : 'bg-slate-100/60 border-slate-200 hover:border-slate-300'}`}>
                                            <div className="flex justify-between items-start mb-3">
                                                <h3 className="text-ink font-bold">{h.description}</h3>
                                                {isUpcoming ? (
                                                    <span className="px-2 py-0.5 rounded text-[10px] uppercase font-bold bg-sky-500/20 text-sky-400 tracking-wider">Upcoming</span>
                                                ) : (
                                                    <span className="px-2 py-0.5 rounded text-[10px] uppercase font-bold bg-slate-100 text-slate-400 tracking-wider">Past</span>
                                                )}
                                            </div>

                                            <div className="flex items-center text-sm text-ink gap-2 mb-3">
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
                <div id="tabpanel-info" role="tabpanel" aria-labelledby="tab-info" className="space-y-4 animate-scale-in">
                    {/* Subjects */}
                    {info.subjects?.length > 0 && (
                        <div className="bg-white/80 backdrop-blur-sm border border-slate-200 rounded-2xl shadow-soft p-5">
                            <h2 className="text-ink font-bold mb-3">Enrolled Subjects</h2>
                            <div className="flex flex-wrap gap-2">
                                {info.subjects.map((s: string, i: number) => (
                                    <span key={i} className="px-3 py-1.5 bg-slate-100 hover:bg-slate-100 text-ink transition-colors text-sm rounded-lg border border-slate-200">{s}</span>
                                ))}
                            </div>
                        </div>
                    )}
                    {/* Personal details */}
                    <div className="bg-white/80 backdrop-blur-sm border border-slate-200 rounded-2xl shadow-soft p-5">
                        <h2 className="mb-4 font-display text-[16px] font-semibold text-ink">Student information</h2>
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
                                <div key={field.label} className="flex gap-3 p-3 bg-slate-100/60 rounded-xl border border-transparent hover:border-slate-200 transition-colors">
                                    <span className="text-slate-500 text-sm min-w-32.5">{field.label}</span>
                                    <span className="text-ink text-sm font-medium">{field.value}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* ════════════════════════════════
                ID CARD TAB
                Gated on the school's `id_cards` flag, which the section
                resolves itself from the API's own 403 — a parent should never
                see a broken panel because the school has not bought the module.
            ════════════════════════════════ */}
            {activeSection === "id-card" && (
                <div id="tabpanel-id-card" role="tabpanel" aria-labelledby="tab-id-card" className="animate-scale-in">
                    <IdCardSection studentId={String(studentId)} />
                </div>
            )}

            {/* ════════════════════════════════
                EXAM SCHEDULE TAB
            ════════════════════════════════ */}
            {activeSection === "exam-schedule" && info?.classId && academicSessionId && (
                <div id="tabpanel-exam-schedule" role="tabpanel" aria-labelledby="tab-exam-schedule" className="animate-scale-in">
                    <ExamScheduleParentView classId={info.classId} sessionId={academicSessionId} />
                </div>
            )}

            {/* ════════════════════════════════
                HOMEWORK TAB
            ════════════════════════════════ */}
            {activeSection === "homework" && (
                <div id="tabpanel-homework" role="tabpanel" aria-labelledby="tab-homework" className="space-y-4 animate-scale-in">
                    {(() => {
                        // Subject colours come from src/lib/subjectColors.ts so this
                        // list and the Today card cannot drift apart.
                        const getSubjectColor = createSubjectColorMap();

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
                                    <div className="grid size-10 shrink-0 place-items-center rounded-lg bg-accent-info-tint text-accent-info-deep"><BookOpen className="size-5" aria-hidden /></div>
                                    <div>
                                        <h2 className="text-ink font-bold text-lg leading-tight">Homework</h2>
                                        <p className="text-slate-400 text-sm">{info?.firstName}&apos;s class assignments</p>
                                    </div>
                                </div>

                                {/* ── Day navigator ── */}
                                <div className="flex justify-center mb-5">
                                    <div className="inline-flex items-center bg-slate-100/70 border border-slate-200 rounded-2xl p-1 gap-1 shadow-lg">
                                        {/* Previous day */}
                                        <button
                                            onClick={() => shiftDate(-1)}
                                            className="w-8 h-8 flex items-center justify-center rounded-xl text-slate-400 hover:text-ink hover:bg-slate-100 active:scale-90 transition-all text-lg font-bold"
                                            title="Previous day"
                                        >
                                            ‹
                                        </button>

                                        {/* Date label + calendar picker */}
                                        <div className="relative">
                                            <button
                                                type="button"
                                                onClick={() => homeworkDateInputRef.current?.showPicker()}
                                                className="flex items-center gap-2 px-3 py-1.5 rounded-xl hover:bg-slate-100 active:scale-95 transition-all group"
                                                title="Pick a date"
                                            >
                                                <div className="text-center min-w-18">
                                                    <p className="text-ink font-semibold text-sm group-hover:text-indigo-300 transition-colors leading-tight">{displayDate}</p>
                                                    {displayDate !== 'Today' && displayDate !== 'Yesterday' && (
                                                        <p className="text-slate-500 text-[10px] leading-tight">{homeworkDate}</p>
                                                    )}
                                                </div>
                                                <CalendarDays className="size-4 text-brand transition-colors" aria-hidden />
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
                                            className="w-8 h-8 flex items-center justify-center rounded-xl text-slate-400 hover:text-ink hover:bg-slate-100 active:scale-90 transition-all disabled:opacity-25 disabled:cursor-not-allowed text-lg font-bold"
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
                                        <div className="mx-auto mb-4 grid size-14 place-items-center rounded-full bg-accent-success-tint text-accent-success-deep"><CheckCircle2 className="size-7" aria-hidden /></div>
                                        <p className="text-ink font-medium">No homework for {displayDate.toLowerCase()}!</p>
                                        <p className="text-slate-500 text-sm mt-1">Check another date or enjoy the break.</p>
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        {homework.map((h: any) => {
                                            const color = getSubjectColor(h.subject || 'general');
                                            return (
                                                <div key={h.id} className={`bg-surface-glass backdrop-blur-sm border border-white/30 border-l-4 ${color.border} rounded-xl p-4 hover:shadow-md transition-all`}>
                                                    {h.subject && (
                                                        <div className="flex items-center gap-1.5 mb-2">
                                                            <span className={`w-2 h-2 rounded-full shrink-0 ${color.dot}`} />
                                                            <span className={`text-xs font-bold uppercase tracking-wide ${color.text}`}>{h.subject}</span>
                                                        </div>
                                                    )}
                                                    <p className="text-ink text-sm leading-relaxed whitespace-pre-line">{h.message}</p>
                                                    {h.worksheetFileName && (
                                                        <button
                                                            onClick={() => handleOpenWorksheet(h)}
                                                            className="mt-2.5 inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-brand/10 text-brand hover:bg-brand/20 text-xs font-semibold transition-colors max-w-full"
                                                        >
                                                            <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" /></svg>
                                                            <span className="truncate">View worksheet</span>
                                                        </button>
                                                    )}
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
                QR CODES TAB — Pickup QR + Visiting QR
            ════════════════════════════════ */}
            {activeSection === "pickup" && (
                <div id="tabpanel-pickup" role="tabpanel" aria-labelledby="tab-pickup" className="space-y-4 animate-scale-in">
                    <div className="flex items-center gap-3">
                        <div className="grid size-10 shrink-0 place-items-center rounded-lg bg-accent-info-tint text-accent-info-deep"><QrCode className="size-5" aria-hidden /></div>
                        <div>
                            <h2 className="text-ink font-bold text-lg leading-tight">{visitorMgmtEnabled ? "QR Codes" : "Pickup QR"}</h2>
                            <p className="text-slate-400 text-sm">
                                {qrMode === "pickup" || !visitorMgmtEnabled
                                    ? `Authorise someone to collect ${info?.firstName ?? "your child"}`
                                    : "Generate a gate-entry QR for your school visit"}
                            </p>
                        </div>
                    </div>

                    {/* Pickup / Visiting switcher — Visiting only when the school has visitor management enabled */}
                    {visitorMgmtEnabled && (
                        <div role="tablist" aria-label="QR type" className="grid grid-cols-2 gap-1.5 bg-surface border border-slate-200 dark:border-white/10 rounded-xl p-1.5">
                            {([["pickup", "🚗", "Pickup QR"], ["visit", "🚶", "Visiting QR"]] as const).map(([key, icon, label]) => (
                                <button
                                    key={key}
                                    role="tab"
                                    aria-selected={qrMode === key}
                                    onClick={() => setQrMode(key)}
                                    className={`flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-medium transition-all ${qrMode === key ? "bg-brand text-white shadow-md shadow-brand/20 dark:bg-white dark:text-slate-900" : "text-ink-muted hover:text-ink hover:bg-brand/5"}`}
                                >
                                    <span aria-hidden>{icon}</span> {label}
                                </button>
                            ))}
                        </div>
                    )}

                    {qrMode === "pickup" || !visitorMgmtEnabled ? (
                        <PickupQRGenerator studentId={Number(studentId)} studentName={info ? `${info.firstName} ${info.lastName}` : undefined} />
                    ) : (
                        <VisitorQRGenerator />
                    )}
                </div>
            )}

            {/* ════════════════════════════════
                LEAVES TAB
            ════════════════════════════════ */}
            {activeSection === "leaves" && (
                <div id="tabpanel-leaves" role="tabpanel" aria-labelledby="tab-leaves" className="space-y-4 animate-scale-in">
                    <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                            <div className="grid size-10 shrink-0 place-items-center rounded-lg bg-accent-info-tint text-accent-info-deep"><CalendarDays className="size-5" aria-hidden /></div>
                            <div>
                                <h2 className="text-ink font-bold text-lg leading-tight">Leave Requests</h2>
                                <p className="text-slate-400 text-sm">Track and apply for leaves</p>
                            </div>
                        </div>
                        <button
                            onClick={() => setShowApplyLeave(true)}
                            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-xl transition-colors shrink-0"
                        >
                            + Apply Leave
                        </button>
                    </div>

                    {leaves && leaves.data && leaves.data.length > 0 ? (
                        <div className="space-y-3">
                            {leaves.data.map((leave: any) => (
                                <div key={leave.id} className="bg-white/80 backdrop-blur-sm border border-slate-200 rounded-xl p-4">
                                    <div className="flex items-start justify-between gap-2">
                                        <div>
                                            <p className="text-ink font-medium text-sm">{LEAVE_TYPE_LABELS[leave.leaveType] ?? leave.leaveType}</p>
                                            <p className="text-slate-400 text-xs mt-0.5">
                                                {fmtDate(leave.fromDate)}{leave.fromDate !== leave.toDate ? ` → ${fmtDate(leave.toDate)}` : ""} · {leave.leaveDuration === "HALF_DAY" ? "Half Day" : "Full Day"}
                                            </p>
                                        </div>
                                        <StatusChip
                                            className="shrink-0"
                                            pigment={LEAVE_STATUS_PIGMENT[leave.status] ?? 'neutral'}
                                            label={LEAVE_STATUS_LABELS[leave.status] ?? leave.status}
                                        />
                                    </div>
                                    {leave.isActionRequired && (
                                        <div className="mt-2 flex items-center gap-1.5">
                                            <svg className="w-3.5 h-3.5 shrink-0 text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                            <span className="text-orange-400 text-xs font-medium">Response needed</span>
                                        </div>
                                    )}
                                    <div className="flex items-center justify-between mt-3">
                                        <p className="text-slate-600 text-xs">Applied {new Date(leave.createdAt).toLocaleDateString()}</p>
                                        <div className="flex items-center gap-2">
                                            {leave.status === "PENDING" && (
                                                <button
                                                    onClick={() => setCancelLeaveId(leave.id)}
                                                    className="px-2.5 py-1 text-xs font-medium text-red-400 border border-red-500/30 rounded-lg hover:bg-red-500/10 transition-colors"
                                                >
                                                    Cancel
                                                </button>
                                            )}
                                            <button
                                                onClick={() => setViewLeave(leave)}
                                                className="px-2.5 py-1 text-xs font-medium text-ink border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
                                            >
                                                View Details
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="bg-white/80 backdrop-blur-sm border border-slate-200 rounded-xl p-8 text-center">
                            <div className="mx-auto mb-3 grid size-12 place-items-center rounded-full bg-surface-secondary text-ink-faint"><CalendarDays className="size-6" aria-hidden /></div>
                            <p className="text-slate-400 text-sm">No leave requests yet</p>
                            <p className="text-slate-600 text-xs mt-1">Tap &quot;Apply Leave&quot; to submit a new request</p>
                        </div>
                    )}

                    {/* Pagination */}
                    {leaves && Math.ceil((leaves.total ?? 0) / 10) > 1 && (
                        <div className="flex items-center justify-center gap-2">
                            <button
                                onClick={() => setLeavesPage(p => Math.max(1, p - 1))}
                                disabled={leavesPage === 1}
                                className="px-3 py-1.5 text-xs border border-slate-200 text-slate-400 rounded-lg disabled:opacity-40 hover:bg-slate-50 transition-colors"
                            >← Prev</button>
                            <span className="text-xs text-slate-500">{leavesPage} / {Math.ceil((leaves.total ?? 0) / 10)}</span>
                            <button
                                onClick={() => setLeavesPage(p => p + 1)}
                                disabled={leavesPage >= Math.ceil((leaves.total ?? 0) / 10)}
                                className="px-3 py-1.5 text-xs border border-slate-200 text-slate-400 rounded-lg disabled:opacity-40 hover:bg-slate-50 transition-colors"
                            >Next →</button>
                        </div>
                    )}
                </div>
            )}

            {/* ── Payment Confirmation Modal ── */}
            {showConfirmModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-walnut-950/60 backdrop-blur-sm">
                    <div className="bg-white/80 backdrop-blur-sm border border-slate-200 rounded-2xl p-6 max-w-sm w-full shadow-2xl">
                        <div className="mb-5 text-center">
                            <div className="mx-auto mb-3 grid size-14 place-items-center rounded-full bg-brand-tint text-brand">
                                <CreditCard className="size-6" aria-hidden />
                            </div>
                            <h3 className="text-ink font-bold text-xl">Confirm Payment</h3>
                            <p className="text-slate-400 text-sm mt-1">You are paying for {selectedMonths2Pay.length} months</p>
                        </div>

                        <div className="bg-slate-100 rounded-xl p-4 mb-5 space-y-2">
                            {selectedMonths2Pay.map(key => {
                                const m = allDueItems.find((x: any) => x.key === key);
                                return (
                                    <div key={key} className="flex justify-between text-sm">
                                        <span className="text-ink">{m?.label}</span>
                                        <span className="text-ink font-medium">₹{Number(m?.amount).toLocaleString()}</span>
                                    </div>
                                );
                            })}
                            <div className="border-t border-slate-200 pt-2 mt-2 flex justify-between">
                                <span className="text-slate-400">Total Amount</span>
                                <span className="text-indigo-400 font-bold text-lg">₹{selectedAmountTotal.toLocaleString()}</span>
                            </div>
                        </div>

                        <div className="flex gap-3">
                            <button onClick={() => setShowConfirmModal(false)} disabled={payProcessing}
                                className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-100 text-ink font-medium rounded-xl transition-colors text-sm disabled:opacity-50">
                                Cancel
                            </button>
                            <button onClick={() => processPayment()} disabled={payProcessing}
                                className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-medium rounded-xl transition-colors text-sm disabled:opacity-50 flex items-center justify-center gap-2">
                                {payProcessing ? <><svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg> Processing...</> : "Confirm Pay"}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Receipt Selection Modal ── */}
            {showReceiptsListModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-walnut-950/60 backdrop-blur-sm">
                    <div className="bg-white/80 backdrop-blur-sm border border-slate-200 rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
                        <div className="bg-slate-100 px-5 py-4 flex justify-between items-center">
                            <h3 className="text-ink font-bold text-lg">Multiple Receipts</h3>
                            <button onClick={() => setShowReceiptsListModal(null)} className="text-slate-400 hover:text-ink transition-colors">
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
                                        className="w-full text-left p-3 rounded-xl bg-slate-100/60 hover:bg-slate-50 border border-slate-200 hover:border-indigo-500/50 transition-all flex justify-between items-center group"
                                    >
                                        <div>
                                            <div className="text-ink font-medium text-sm mb-1">{p.receiptNumber}</div>
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

            {/* ── In-app Document Viewer ── */}
            {viewerDoc && (
                <div className="fixed inset-0 z-60 flex flex-col bg-black/90" onClick={e => { if (e.target === e.currentTarget) setViewerDoc(null); }}>
                    <div className="flex items-center justify-between px-4 py-3 bg-slate-900 border-b border-slate-700 shrink-0">
                        <span className="text-white text-sm font-medium truncate max-w-xs">{viewerDoc.fileName}</span>
                        <div className="flex items-center gap-2 shrink-0">
                            <a
                                href={viewerDoc.url}
                                download={viewerDoc.fileName}
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium rounded-lg transition-colors"
                            >
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                                Download
                            </a>
                            <button onClick={() => setViewerDoc(null)} className="p-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-white transition-colors">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                        </div>
                    </div>
                    <div className="flex-1 overflow-auto flex items-center justify-center p-4">
                        {viewerDoc.mimeType === 'application/pdf' ? (
                            <iframe src={viewerDoc.url} title={viewerDoc.fileName} className="w-full h-full min-h-[70vh] rounded-lg border-0 bg-white" />
                        ) : (
                            <img src={viewerDoc.url} alt={viewerDoc.fileName} className="max-w-full max-h-full object-contain rounded-lg shadow-xl" />
                        )}
                    </div>
                </div>
            )}

            {/* ── Leave Detail Modal ── */}
            {viewLeave && (
                <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/70 backdrop-blur-sm" onClick={e => { if (e.target === e.currentTarget) setViewLeave(null); }}>
                    <div className="bg-white/80 backdrop-blur-sm border border-slate-200 rounded-t-2xl sm:rounded-2xl w-full max-w-md max-h-[90vh] flex flex-col shadow-2xl">
                        {/* Header */}
                        <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-slate-200 shrink-0">
                            <div>
                                <p className="text-ink font-bold text-base">{LEAVE_TYPE_LABELS[viewLeave.leaveType] ?? viewLeave.leaveType}</p>
                                <p className="text-slate-400 text-xs mt-0.5">
                                    {fmtDate(viewLeave.fromDate)}{viewLeave.fromDate !== viewLeave.toDate ? ` \u2192 ${fmtDate(viewLeave.toDate)}` : ""} &middot; {viewLeave.leaveDuration === "HALF_DAY" ? "Half Day" : "Full Day"}
                                </p>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                                <StatusChip
                                    pigment={LEAVE_STATUS_PIGMENT[viewLeave.status] ?? 'neutral'}
                                    label={LEAVE_STATUS_LABELS[viewLeave.status] ?? viewLeave.status}
                                />
                                <button onClick={() => setViewLeave(null)} className="p-1 rounded-lg text-slate-400 hover:text-ink transition-colors">
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                </button>
                            </div>
                        </div>
                        {/* Scrollable body */}
                        <div className="flex-1 overflow-y-auto p-5 space-y-4">
                            {/* Reason */}
                            {viewLeave.reason && (
                                <div>
                                    <p className="text-slate-500 text-xs font-medium mb-1">Reason</p>
                                    <p className="text-ink text-sm">{viewLeave.reason}</p>
                                </div>
                            )}
                            {/* Chronological timeline of events */}
                            <LeaveTimeline leave={viewLeave} theme="dark" />
                            {/* Reply button — shown if school is still waiting for a response */}
                            {viewLeave.isActionRequired && (
                                <button
                                    onClick={() => { setReplyLeaveId(viewLeave.id); setReplyNote(""); setReplyFile(null); }}
                                    className="w-full px-3 py-2 text-xs font-medium rounded-xl border bg-orange-500/20 text-orange-300 border-orange-500/40 hover:bg-orange-500/30 transition-colors"
                                >
                                    💬 Reply to school
                                </button>
                            )}
                            {/* Attached documents */}
                            {viewLeave.documents && viewLeave.documents.length > 0 && (
                                <div>
                                    <p className="text-slate-500 text-xs font-medium mb-1.5">Attached documents</p>
                                    <div className="space-y-1.5">
                                        {viewLeave.documents.map((doc: any) => (
                                            <button
                                                key={doc.id}
                                                onClick={() => handleOpenDoc(viewLeave.id, doc)}
                                                className="flex items-center gap-2 w-full text-left px-3 py-2 rounded-lg border border-slate-200 hover:border-brand/40 hover:bg-slate-100/60 transition-colors text-xs text-ink"
                                            >
                                                <span className="shrink-0">{doc.mimeType === 'application/pdf' ? '\uD83D\uDCC4' : '\uD83D\uDDBC\uFE0F'}</span>
                                                <span className="truncate">{doc.fileName}</span>
                                                <span className="ml-auto shrink-0 text-slate-500">{doc.mimeType === 'application/pdf' ? 'PDF' : 'Image'}</span>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}
                            <p className="text-slate-600 text-xs">Applied {new Date(viewLeave.createdAt).toLocaleDateString()}</p>
                        </div>
                        {/* Footer — cancel button for PENDING */}
                        {viewLeave.status === "PENDING" && (
                            <div className="px-5 py-4 border-t border-slate-200 shrink-0">
                                <button
                                    onClick={() => { setViewLeave(null); setCancelLeaveId(viewLeave.id); }}
                                    className="w-full py-2.5 text-sm font-medium text-red-400 border border-red-500/30 rounded-xl hover:bg-red-500/10 transition-colors"
                                >
                                    Cancel Leave
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* ── Reply to Action-Required Modal ── */}
            {replyLeaveId !== null && (
                <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
                    <div className="bg-white/80 backdrop-blur-sm border border-slate-200 rounded-2xl p-5 w-full max-w-md shadow-2xl">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-ink font-bold text-base">Reply to School</h3>
                            <button onClick={() => setReplyLeaveId(null)} className="p-1 rounded-lg text-slate-400 hover:text-ink transition-colors">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                        </div>
                        <p className="text-slate-400 text-xs mb-3">Write your reply below. You can also attach a document (optional).</p>
                        <textarea
                            value={replyNote}
                            onChange={e => setReplyNote(e.target.value)}
                            rows={4}
                            placeholder="Type your reply here…"
                            className="w-full bg-slate-100 border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-ink placeholder-ink-muted/50 focus:outline-none focus:border-orange-500/60 resize-none mb-3"
                        />
                        {/* File attachment */}
                        <div className="mb-4">
                            {replyFile ? (
                                <div className="flex items-center gap-2 px-3 py-2 bg-slate-100 border border-slate-200 rounded-xl">
                                    <span className="text-xs text-ink truncate flex-1">{replyFile.name}</span>
                                    <button onClick={() => setReplyFile(null)} className="shrink-0 text-slate-500 hover:text-red-400 text-xs transition-colors">Remove</button>
                                </div>
                            ) : (
                                <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-400 hover:text-ink transition-colors">
                                    <input
                                        type="file"
                                        accept="image/jpeg,image/png,image/webp,application/pdf"
                                        className="hidden"
                                        onChange={e => { const f = e.target.files?.[0]; if (f) setReplyFile(f); e.target.value = ""; }}
                                    />
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" /></svg>
                                    Attach document (optional)
                                </label>
                            )}
                        </div>
                        <div className="flex gap-3">
                            <button
                                onClick={() => setReplyLeaveId(null)}
                                disabled={replySending}
                                className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-100 text-ink font-medium rounded-xl transition-colors text-sm disabled:opacity-50"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleReply}
                                disabled={replySending || (!replyNote.trim() && !replyFile)}
                                className="flex-1 py-2.5 bg-orange-600 hover:bg-orange-500 text-white font-medium rounded-xl transition-colors text-sm disabled:opacity-50"
                            >
                                {replySending ? "Sending…" : "Send Reply"}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Cancel Leave Confirm Modal ── */}
            {cancelLeaveId && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
                    <div className="bg-white/80 backdrop-blur-sm border border-slate-200 rounded-2xl p-6 max-w-sm w-full shadow-2xl">
                        <div className="mb-4 text-center">
                            <div className="w-12 h-12 bg-red-500/15 text-red-400 rounded-full flex items-center justify-center text-xl mx-auto mb-3">✕</div>
                            <h3 className="text-ink font-bold text-lg">Cancel Leave</h3>
                            <p className="text-slate-400 text-sm mt-1">Are you sure you want to cancel this leave request?</p>
                        </div>
                        <div className="flex gap-3">
                            <button
                                onClick={() => setCancelLeaveId(null)}
                                disabled={cancelLeaving}
                                className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-100 text-ink font-medium rounded-xl transition-colors text-sm disabled:opacity-50"
                            >
                                Keep it
                            </button>
                            <button
                                onClick={handleCancelLeave}
                                disabled={cancelLeaving}
                                className="flex-1 py-2.5 bg-red-600 hover:bg-red-500 text-white font-medium rounded-xl transition-colors text-sm disabled:opacity-50"
                            >
                                {cancelLeaving ? "Cancelling…" : "Yes, Cancel"}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Apply Leave Modal ── */}
            {showApplyLeave && info && (
                <ApplyLeaveModal
                    studentId={Number(studentId)}
                    studentName={`${info.firstName} ${info.lastName}`}
                    onClose={() => setShowApplyLeave(false)}
                    onSuccess={() => { setShowApplyLeave(false); fetchLeaves(leavesPage); }}
                />)}

            {/* ── Attendance Quick-View Bottom Sheet ── */}
            <AttendanceBottomSheet
                studentId={studentId as string}
                isOpen={showAttendanceSheet}
                onClose={() => setShowAttendanceSheet(false)}
                onViewFull={() => {
                    setShowAttendanceSheet(false);
                    setActiveSection("attendance");
                    setSectionLoading(true);
                    fetchAttendance();
                }}
            />

            {/* ── Homework Quick-View Bottom Sheet ── */}
            <HomeworkBottomSheet
                studentId={studentId as string}
                isOpen={showHomeworkSheet}
                onClose={() => setShowHomeworkSheet(false)}
                onViewFull={() => {
                    setShowHomeworkSheet(false);
                    setActiveSection("homework");
                    setSectionLoading(true);
                    fetchHomework();
                }}
            />

            {/* ── Fees Quick-View Bottom Sheet ── */}
            <FeesBottomSheet
                studentId={studentId as string}
                isOpen={showFeesSheet}
                onClose={() => setShowFeesSheet(false)}
                academicYearString={academicYearString}
                studentInfo={info}
                paymentEnabled={onlinePaymentEnabled}
                onInitiatePayment={(keys, items) => processPayment(keys, items)}
                onViewReceipt={(data) => setShowReceipt(data)}
                onViewReceiptsList={(data) => setShowReceiptsListModal({
                    ...data,
                    studentName: info ? `${info.firstName} ${info.lastName}` : undefined,
                    studentClass: info?.className,
                    studentSection: info?.sectionName,
                })}
                onViewFull={() => {
                    setShowFeesSheet(false);
                    setActiveSection("fees");
                    setSectionLoading(true);
                }}
            />
        </div>
    );
}

// ── Student Library Section ────────────────────────────────────────────────────

function StudentLibrarySection({ studentId }: { studentId: string }) {
    const { data, isLoading, error } = useLibraryIssuances(studentId);

    const statusConfig: Record<string, { label: string; color: string; bg: string }> = {
        ISSUED:   { label: 'Issued',   color: 'text-blue-700 dark:text-blue-300',  bg: 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-700' },
        OVERDUE:  { label: 'Overdue',  color: 'text-red-700 dark:text-red-300',    bg: 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-700' },
        RETURNED: { label: 'Returned', color: 'text-emerald-700 dark:text-emerald-300', bg: 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-700' },
    };

    const fmtDate = (d: string) => new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

    return (
        <div className="space-y-4">
            {/* Header card */}
            <div className="flex items-center gap-3 rounded-xl border border-line bg-surface p-4 shadow-soft">
                <div className="grid size-11 shrink-0 place-items-center rounded-lg bg-accent-success-tint text-accent-success-deep"><Library className="size-5.5" aria-hidden /></div>
                <div>
                    <h2 className="font-display text-[16px] leading-tight font-semibold text-ink">Library books</h2>
                    <p className="text-[12.5px] text-ink-muted">Books currently issued or recently returned</p>
                </div>
            </div>

            {isLoading ? (
                <div className="flex justify-center py-16">
                    <div className="w-8 h-8 border-3 border-lime-500 border-t-transparent rounded-full animate-spin" />
                </div>
            ) : error ? (
                <div className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm border border-slate-200 dark:border-slate-700 rounded-2xl p-8 text-center">
                    <div className="mx-auto mb-3 grid size-12 place-items-center rounded-full bg-surface-secondary text-ink-faint"><BookOpen className="size-6" aria-hidden /></div>
                    <p className="text-ink font-semibold">Library not available</p>
                    <p className="text-ink-muted text-sm mt-1">Library feature may not be enabled for your school.</p>
                </div>
            ) : !data?.data?.length ? (
                <div className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm border border-slate-200 dark:border-slate-700 rounded-2xl p-8 text-center">
                    <div className="mx-auto mb-3 grid size-14 place-items-center rounded-full bg-surface-secondary text-ink-faint"><BookOpen className="size-7" aria-hidden /></div>
                    <p className="text-ink font-semibold text-lg">No books issued</p>
                    <p className="text-ink-muted text-sm mt-1">You have no books currently issued or in recent history.</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {data.data.map((item: any) => {
                        const cfg = statusConfig[item.status] ?? statusConfig['ISSUED'];
                        const isOverdue = item.status === 'OVERDUE';
                        const daysOverdue = isOverdue
                            ? Math.ceil((Date.now() - new Date(item.dueDate).getTime()) / 86400000)
                            : 0;
                        const hasLateFee = item.lateFeeCharged > 0;
                        return (
                            <div key={item.id} className={`bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm border rounded-2xl p-4 shadow-soft transition-all ${isOverdue ? 'border-red-200 dark:border-red-700' : 'border-slate-200 dark:border-slate-700'}`}>
                                <div className="flex items-start gap-3">
                                    {/* Book icon */}
                                    <div className={`w-11 h-11 rounded-xl flex items-center justify-center text-xl shrink-0 border ${cfg.bg}`}>
                                        {item.status === 'RETURNED' ? <CheckCircle2 className="size-4" aria-hidden /> : isOverdue ? <AlertCircle className="size-4" aria-hidden /> : <BookOpen className="size-4" aria-hidden />}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-start justify-between gap-2 flex-wrap">
                                            <p className="font-semibold text-ink text-sm leading-tight">{item.book?.title ?? 'Unknown Book'}</p>
                                            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border shrink-0 ${cfg.color} ${cfg.bg}`}>{cfg.label}</span>
                                        </div>
                                        {item.book?.author && (
                                            <p className="text-xs text-ink-muted mt-0.5">by {item.book.author}</p>
                                        )}
                                        <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2">
                                            <p className="text-xs text-ink-muted">
                                                <span className="font-medium text-ink">Issued:</span> {fmtDate(item.issueDate)}
                                            </p>
                                            <p className={`text-xs ${isOverdue ? 'text-red-600 dark:text-red-400 font-semibold' : 'text-ink-muted'}`}>
                                                <span className={`font-medium ${isOverdue ? '' : 'text-ink'}`}>Due:</span> {fmtDate(item.dueDate)}
                                            </p>
                                            {item.returnDate && (
                                                <p className="text-xs text-ink-muted">
                                                    <span className="font-medium text-ink">Returned:</span> {fmtDate(item.returnDate)}
                                                </p>
                                            )}
                                        </div>
                                        {isOverdue && (
                                            <div className="mt-2 flex items-center gap-1.5 text-xs text-red-600 dark:text-red-400 font-medium">
                                                <span>⏰</span>
                                                <span>{daysOverdue} day{daysOverdue !== 1 ? 's' : ''} overdue{hasLateFee ? ` · Late fee: ₹${item.lateFeeCharged}` : ''}</span>
                                            </div>
                                        )}
                                        {hasLateFee && item.status === 'RETURNED' && (
                                            <div className="mt-2 flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400">
                                                <IndianRupee className="size-3.5" aria-hidden />
                                                <span>Late fee charged: ₹{item.lateFeeCharged} · Paid: ₹{item.lateFeePayment?.amountPaid ?? 0}</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                    {data.total > data.data.length && (
                        <p className="text-center text-sm text-ink-muted py-2">Showing {data.data.length} of {data.total} records</p>
                    )}
                </div>
            )}
        </div>
    );
}
