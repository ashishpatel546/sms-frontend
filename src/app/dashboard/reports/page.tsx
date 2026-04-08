"use client";

import { useState, useEffect } from "react";
import toast, { Toaster } from "react-hot-toast";
import { useRbac } from "@/lib/rbac";
import { useRouter } from "next/navigation";
import { API_BASE_URL } from "@/lib/api";
import { authFetch } from "@/lib/auth";
import { 
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, 
    PieChart, Pie, Cell, LineChart, Line 
} from 'recharts';
import { Wallet, AlertCircle, ClipboardList, CalendarCheck, Users, UserCircle } from "lucide-react";

const COLORS = ['#0ea5e9', '#f43f5e', '#10b981', '#f59e0b', '#8b5cf6', '#64748b'];

export default function ReportsDashboard() {
    const router = useRouter();
    const rbac = useRbac();
    const [mounted, setMounted] = useState(false);
    const [activeTab, setActiveTab] = useState<'FEES' | 'PENDING_DUES' | 'FEE_RECEIVED' | 'EXAMINATIONS' | 'ATTENDANCE' | 'STUDENTS' | 'STAFF'>('FEES');

    // FILTERS
    const [academicSessions, setAcademicSessions] = useState<any[]>([]);
    const [examTerms, setExamTerms] = useState<any[]>([]);

    const [feeCollectionSession, setFeeCollectionSession] = useState('');
    const [collectionStatusSession, setCollectionStatusSession] = useState('');
    const [collectionPendingMonth, setCollectionPendingMonth] = useState((new Date().getMonth() + 1).toString());
    const [feeAdjustmentsFromDate, setFeeAdjustmentsFromDate] = useState(new Date().toISOString().split('T')[0]);
    const [feeAdjustmentsToDate, setFeeAdjustmentsToDate] = useState(new Date().toISOString().split('T')[0]);
    const [waivedOffTrendSession, setWaivedOffTrendSession] = useState('');

    const [selectedExamYear, setSelectedExamYear] = useState('');
    const [selectedExamTerm, setSelectedExamTerm] = useState('');
    const [selectedExamClass, setSelectedExamClass] = useState('');
    const [classes, setClasses] = useState<any[]>([]);
    const [availableSections, setAvailableSections] = useState<any[]>([]);
    const [selectedExamSection, setSelectedExamSection] = useState('');

    const [attendanceSession, setAttendanceSession] = useState('');
    const [attendanceMonth, setAttendanceMonth] = useState((new Date().getMonth() + 1).toString());
    const [attendanceFromDate, setAttendanceFromDate] = useState(new Date().toISOString().split('T')[0]);
    const [attendanceToDate, setAttendanceToDate] = useState(new Date().toISOString().split('T')[0]);

    const [enrollmentFromSession, setEnrollmentFromSession] = useState('');
    const [admissionsFromSession, setAdmissionsFromSession] = useState('');
    const [admissionsToSession, setAdmissionsToSession] = useState('');

    // Pending Dues Filters
    const [pendingSessionId, setPendingSessionId] = useState('');
    
    // Pending Dues Notification State
    const [showNotifModal, setShowNotifModal] = useState(false);
    const [useCustomMessage, setUseCustomMessage] = useState(false);
    const [customNotifMessage, setCustomNotifMessage] = useState('');
    const [sendingNotif, setSendingNotif] = useState(false);
    const [pendingClassId, setPendingClassId] = useState('');
    const [pendingAvailableSections, setPendingAvailableSections] = useState<any[]>([]);
    const [pendingSectionId, setPendingSectionId] = useState('');
    const [pendingSearchQuery, setPendingSearchQuery] = useState('');
    const [pendingMobile, setPendingMobile] = useState('');
    const [pendingMonth, setPendingMonth] = useState('');
    const [pendingDuesData, setPendingDuesData] = useState<any[]>([]);
    const [pendingDuesLoading, setPendingDuesLoading] = useState(false);
    const [pendingSortColumn, setPendingSortColumn] = useState<string>('className');
    const [pendingSortDirection, setPendingSortDirection] = useState<'asc' | 'desc'>('asc');
    const [selectedPendingStudents, setSelectedPendingStudents] = useState<number[]>([]);

    // Pagination for pending dues
    const [pendingDuesPage, setPendingDuesPage] = useState(1);
    const PENDING_DUES_PER_PAGE = 20;

    // Pagination for adjustments
    const [feeAdjPage, setFeeAdjPage] = useState(1);
    const FEE_ADJ_PER_PAGE = 10;

    // Fee Received Filters
    const [receivedSessionId, setReceivedSessionId] = useState('');
    const [receivedFromDate, setReceivedFromDate] = useState('');
    const [receivedToDate, setReceivedToDate] = useState('');
    const [receivedClassId, setReceivedClassId] = useState('');
    const [receivedAvailableSections, setReceivedAvailableSections] = useState<any[]>([]);
    const [receivedSectionId, setReceivedSectionId] = useState('');
    const [receivedSearchQuery, setReceivedSearchQuery] = useState('');
    const [receivedMobile, setReceivedMobile] = useState('');
    const [receivedData, setReceivedData] = useState<any[]>([]);
    const [receivedLoading, setReceivedLoading] = useState(false);
    
    // Pagination for fee received
    const [receivedPage, setReceivedPage] = useState(1);
    const [receivedTotalCount, setReceivedTotalCount] = useState(0);
    const RECEIVED_PER_PAGE = 20;

    // DATA STATES
    const [monthlyCollection, setMonthlyCollection] = useState<any[]>([]);
    const [collectionStatus, setCollectionStatus] = useState<any[]>([]);
    const [feeAdjustments, setFeeAdjustments] = useState<any[]>([]);
    const [waivedOffTrend, setWaivedOffTrend] = useState([]);
    const [examClassAvg, setExamClassAvg] = useState([]);
    const [topPerformers, setTopPerformers] = useState<any[]>([]);
    const [attendanceByClass, setAttendanceByClass] = useState([]);
    const [attendanceTrend, setAttendanceTrend] = useState([]);
    const [staffDistribution, setStaffDistribution] = useState([]);
    const [enrollmentClass, setEnrollmentClass] = useState([]);
    const [admissionsTrend, setAdmissionsTrend] = useState([]);

    useEffect(() => {
        const fetchFiltersData = async () => {
            try {
                const [sessionsRes, examsRes, classesRes] = await Promise.all([
                    authFetch(`${API_BASE_URL}/academic-sessions`),
                    authFetch(`${API_BASE_URL}/exams/categories/active`),
                    authFetch(`${API_BASE_URL}/classes`)
                ]);

                if (classesRes.ok) {
                    const data = await classesRes.json();
                    setClasses(data);
                }

                if (sessionsRes.ok) {
                    const data = await sessionsRes.json();
                    setAcademicSessions(data);
                    const activeSession = data.find((s: any) => s.isActive);
                    if (activeSession) {
                        const sid = activeSession.id.toString();
                        setFeeCollectionSession(sid);
                        setCollectionStatusSession(sid);
                        setWaivedOffTrendSession(sid);
                        setSelectedExamYear(sid);
                        setAttendanceSession(sid);
                        setEnrollmentFromSession(sid);
                        setPendingSessionId(sid);
                        setReceivedSessionId(sid);
                        setAdmissionsToSession(sid);
                        if (data.length > 3) setAdmissionsFromSession(data[3].id.toString());
                        else if (data.length > 0) setAdmissionsFromSession(data[data.length - 1].id.toString());
                    }
                }
                if (examsRes.ok) {
                    const data = await examsRes.json();
                    setExamTerms(data);
                    if (data.length > 0) setSelectedExamTerm(data[0].id.toString());
                }
            } catch (err) {
                console.error("Failed to fetch filters data", err);
            }
        };
        fetchFiltersData();
    }, []);

    // FEES
    useEffect(() => {
        if (activeTab !== 'FEES') return;
        const fetchData = async () => {
            try {
                const currentMonth = new Date().getMonth() + 1;
                const acYearName = academicSessions.find(s => s.id.toString() === collectionStatusSession)?.name || '';
                
                const [mcRes, csRes, faRes, wotRes, pdRes] = await Promise.all([
                    authFetch(`${API_BASE_URL}/dashboard/reports/monthly-collection?sessionId=${feeCollectionSession}`),
                    authFetch(`${API_BASE_URL}/dashboard/reports/collection-status?sessionId=${collectionStatusSession}&month=${currentMonth}`),
                    authFetch(`${API_BASE_URL}/dashboard/reports/fee-adjustments?fromDate=${feeAdjustmentsFromDate}&toDate=${feeAdjustmentsToDate}`),
                    authFetch(`${API_BASE_URL}/dashboard/reports/waived-off-trend?sessionId=${waivedOffTrendSession}`),
                    // Only fetch pending dues if we have the academic year
                    acYearName ? authFetch(`${API_BASE_URL}/fees/reports/pending-dues?academicYear=${encodeURIComponent(acYearName)}`) : Promise.resolve(null)
                ]);
                if (mcRes.ok) setMonthlyCollection(await mcRes.json());
                
                if (csRes.ok) {
                    const statusData = await csRes.json();
                    let totalPending = 0;
                    
                    if (pdRes && pdRes.ok) {
                        const pendingData = await pdRes.json();
                        totalPending = pendingData.reduce((sum: number, row: any) => sum + (Number(row.pendingAmount) || 0), 0);
                    } else {
                        // Fallback to the mocked pending dues if real calculation fails
                        totalPending = statusData.find((d: any) => d.name === 'Pending Dues')?.value || 0;
                    }
                    
                    const collectedAmount = statusData.find((d: any) => d.name === 'Collected')?.value || 0;
                    
                    setCollectionStatus([
                        { name: 'Collected', value: collectedAmount },
                        { name: 'Pending Dues', value: totalPending }
                    ]);
                }

                if (faRes.ok) setFeeAdjustments(await faRes.json());
                if (wotRes.ok) setWaivedOffTrend(await wotRes.json());
            } catch (e) { console.error(e); }
        };
        fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeTab, feeCollectionSession, collectionStatusSession, feeAdjustmentsFromDate, feeAdjustmentsToDate, waivedOffTrendSession, academicSessions]);

    // EXAMS
    useEffect(() => {
        if (activeTab !== 'EXAMINATIONS') return;
        const fetchData = async () => {
            try {
                let query = `?sessionId=${selectedExamYear}&termId=${selectedExamTerm}`;
                if (selectedExamClass) query += `&classId=${selectedExamClass}`;
                if (selectedExamSection) query += `&sectionId=${selectedExamSection}`;
                const [ecaRes, tpRes] = await Promise.all([
                    authFetch(`${API_BASE_URL}/dashboard/reports/exam-class-average${query}`),
                    authFetch(`${API_BASE_URL}/dashboard/reports/top-performers${query}`)
                ]);
                if (ecaRes.ok) setExamClassAvg(await ecaRes.json());
                if (tpRes.ok) setTopPerformers(await tpRes.json());
            } catch (e) { console.error(e); }
        };
        fetchData();
    }, [activeTab, selectedExamYear, selectedExamTerm, selectedExamClass, selectedExamSection]);

    // ATTENDANCE
    useEffect(() => {
        if (activeTab !== 'ATTENDANCE') return;
        const fetchData = async () => {
            try {
                const [abcRes, atRes] = await Promise.all([
                    authFetch(`${API_BASE_URL}/dashboard/reports/attendance-by-class?sessionId=${attendanceSession}&month=${attendanceMonth}`),
                    authFetch(`${API_BASE_URL}/dashboard/reports/attendance-trend?fromDate=${attendanceFromDate}&toDate=${attendanceToDate}`)
                ]);
                if (abcRes.ok) setAttendanceByClass(await abcRes.json());
                if (atRes.ok) setAttendanceTrend(await atRes.json());
            } catch (e) { console.error(e); }
        };
        fetchData();
    }, [activeTab, attendanceSession, attendanceMonth, attendanceFromDate, attendanceToDate]);

    // STUDENTS
    useEffect(() => {
        if (activeTab !== 'STUDENTS') return;
        const fetchData = async () => {
            try {
                const [ecRes, atRes] = await Promise.all([
                    authFetch(`${API_BASE_URL}/dashboard/reports/enrollment-by-class?sessionId=${enrollmentFromSession}`),
                    authFetch(`${API_BASE_URL}/dashboard/reports/admissions-trend?fromSessionId=${admissionsFromSession}&toSessionId=${admissionsToSession}`)
                ]);
                if (ecRes.ok) setEnrollmentClass(await ecRes.json());
                if (atRes.ok) setAdmissionsTrend(await atRes.json());
            } catch (e) { console.error(e); }
        };
        fetchData();
    }, [activeTab, enrollmentFromSession, admissionsFromSession, admissionsToSession]);

    // STAFF
    useEffect(() => {
        if (activeTab !== 'STAFF') return;
        const fetchData = async () => {
            try {
                const res = await authFetch(`${API_BASE_URL}/dashboard/reports/staff-distribution`);
                if (res.ok) setStaffDistribution(await res.json());
            } catch (e) { console.error(e); }
        };
        fetchData();
    }, [activeTab]);

    // PENDING DUES
    useEffect(() => {
        if (activeTab !== 'PENDING_DUES') return;
        if (!pendingSessionId) return;

        const fetchData = async () => {
            setPendingDuesLoading(true);
            try {
                let query = `?academicYear=${encodeURIComponent(
                    academicSessions.find(s => s.id.toString() === pendingSessionId)?.name || ''
                )}`;
                if (pendingClassId) query += `&classId=${pendingClassId}`;
                if (pendingSectionId) query += `&sectionId=${pendingSectionId}`;
                if (pendingMobile) query += `&mobileNumber=${pendingMobile}`;
                if (pendingMonth) query += `&month=${pendingMonth}`;

                const res = await authFetch(`${API_BASE_URL}/fees/reports/pending-dues${query}`);
                if (res.ok) {
                    const data = await res.json();
                    setPendingDuesData(data);
                } else {
                    toast.error('Failed to fetch pending dues data');
                }
            } catch (e) { 
                console.error(e); 
                toast.error('An error occurred while fetching pending dues data');
            } finally {
                setPendingDuesLoading(false);
            }
        };
        
        // Add a small debounce if typing Mobile
        const timeoutId = setTimeout(() => {
            fetchData();
        }, 500);
        return () => clearTimeout(timeoutId);
    }, [activeTab, pendingSessionId, pendingClassId, pendingSectionId, pendingMobile, pendingMonth, academicSessions]);

    // Reset pagination on filter change
    useEffect(() => {
        setPendingDuesPage(1);
    }, [pendingSessionId, pendingClassId, pendingSectionId, pendingMobile, pendingMonth, pendingSearchQuery]);

    // Reset pagination on filter change
    useEffect(() => {
        setPendingDuesPage(1);
    }, [pendingSessionId, pendingClassId, pendingSectionId, pendingMobile, pendingMonth, pendingSearchQuery]);

    // FEE RECEIVED DATA FETCH
    useEffect(() => {
        if (activeTab !== 'FEE_RECEIVED') return;
        if (!receivedSessionId) return;

        const fetchData = async () => {
            setReceivedLoading(true);
            try {
                let query = `?academicYear=${encodeURIComponent(
                    academicSessions.find(s => s.id.toString() === receivedSessionId)?.name || ''
                )}`;
                if (receivedClassId) query += `&classId=${receivedClassId}`;
                if (receivedSectionId) query += `&sectionId=${receivedSectionId}`;
                if (receivedMobile) query += `&mobileNumber=${receivedMobile}`;
                if (receivedFromDate) query += `&fromDate=${receivedFromDate}`;
                if (receivedToDate) query += `&toDate=${receivedToDate}`;
                if (receivedSearchQuery && !isNaN(Number(receivedSearchQuery))) query += `&studentId=${receivedSearchQuery}`;
                
                query += `&page=${receivedPage}&limit=${RECEIVED_PER_PAGE}`;

                const res = await authFetch(`${API_BASE_URL}/fees/reports/fee-received${query}`);
                if (res.ok) {
                    const data = await res.json();
                    setReceivedData(data.data || []);
                    setReceivedTotalCount(data.totalCount || 0);
                } else {
                    toast.error('Failed to fetch fee received data');
                }
            } catch (e) {
                console.error(e);
                toast.error('An error occurred while fetching fee received data');
            } finally {
                setReceivedLoading(false);
            }
        };

        const timeoutId = setTimeout(() => {
            fetchData();
        }, 500);
        return () => clearTimeout(timeoutId);
    }, [activeTab, receivedSessionId, receivedClassId, receivedSectionId, receivedMobile, receivedFromDate, receivedToDate, receivedSearchQuery, receivedPage, academicSessions]);

    // Reset received pagination on filter change
    useEffect(() => {
        setReceivedPage(1);
    }, [receivedSessionId, receivedClassId, receivedSectionId, receivedMobile, receivedFromDate, receivedToDate, receivedSearchQuery]);

    // Sorting Helper for Pending Dues
    const handlePendingSort = (column: string) => {
        if (pendingSortColumn === column) {
            setPendingSortDirection(pendingSortDirection === 'asc' ? 'desc' : 'asc');
        } else {
            setPendingSortColumn(column);
            setPendingSortDirection('asc');
        }
    };

    const sortedPendingDues = [...pendingDuesData].sort((a, b) => {
        let valA = a[pendingSortColumn];
        let valB = b[pendingSortColumn];
        
        if (typeof valA === 'string') valA = valA.toLowerCase();
        if (typeof valB === 'string') valB = valB.toLowerCase();
        
        if (valA < valB) return pendingSortDirection === 'asc' ? -1 : 1;
        if (valA > valB) return pendingSortDirection === 'asc' ? 1 : -1;
        return 0;
    });

    // Client-side filtering for student name and ID
    const displayedPendingDuesAll = sortedPendingDues.filter(row => {
        if (!pendingSearchQuery) return true;
        const q = pendingSearchQuery.toLowerCase();
        const fullName = `${row.firstName || ''} ${row.lastName || ''}`.toLowerCase();
        return fullName.includes(q) || row.studentId.toString().includes(q) || (row.rollNo && row.rollNo.toString().includes(q));
    });
    
    // Pagination logic
    const totalPendingPages = Math.ceil(displayedPendingDuesAll.length / PENDING_DUES_PER_PAGE);
    const paginatedPendingDues = displayedPendingDuesAll.slice(
        (pendingDuesPage - 1) * PENDING_DUES_PER_PAGE,
        pendingDuesPage * PENDING_DUES_PER_PAGE
    );

    const exportToCSV = () => {
        if (displayedPendingDuesAll.length === 0) {
            toast.error('No data to export');
            return;
        }

        const headers = ['Student ID', 'Roll No', 'First Name', 'Last Name', 'Mobile', 'Class', 'Section', 'Pending Amount'];
        const rows = displayedPendingDuesAll.map(row => [
            row.studentId,
            row.rollNo || '',
            `"${row.firstName || ''}"`,
            `"${row.lastName || ''}"`,
            `"${row.mobile || ''}"`,
            `"${row.className || ''}"`,
            `"${row.sectionName || ''}"`,
            row.pendingAmount
        ]);

        const csvContent = [
            headers.join(','),
            ...rows.map(e => e.join(','))
        ].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", `Pending_Dues_Report_${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const exportFeeReceivedCSV = async () => {
        if (!receivedSessionId) return;
        setReceivedLoading(true);
        try {
            let query = `?academicYear=${encodeURIComponent(
                academicSessions.find(s => s.id.toString() === receivedSessionId)?.name || ''
            )}`;
            if (receivedClassId) query += `&classId=${receivedClassId}`;
            if (receivedSectionId) query += `&sectionId=${receivedSectionId}`;
            if (receivedMobile) query += `&mobileNumber=${receivedMobile}`;
            if (receivedFromDate) query += `&fromDate=${receivedFromDate}`;
            if (receivedToDate) query += `&toDate=${receivedToDate}`;
            if (receivedSearchQuery && !isNaN(Number(receivedSearchQuery))) query += `&studentId=${receivedSearchQuery}`;
            
            // Limit 0 indicates we want to fetch the whole set matching filters
            query += `&page=1&limit=0`;

            const res = await authFetch(`${API_BASE_URL}/fees/reports/fee-received${query}`);
            if (res.ok) {
                const json = await res.json();
                const bulkData = json.data || [];
                
                if (bulkData.length === 0) {
                    toast.error('No data to export');
                    return;
                }

                const headers = ['Receipt No', 'Payment Date', 'Student ID', 'First Name', 'Last Name', 'Mobile', 'Class', 'Section', 'Payment Method', 'Fee Month(s)', 'Amount Paid', 'Collected By'];
                const rows = bulkData.map((row: any) => [
                    `"${row.receiptNumber || ''}"`,
                    row.paymentDate,
                    row.studentId,
                    `"${row.firstName || ''}"`,
                    `"${row.lastName || ''}"`,
                    `"${row.mobile || ''}"`,
                    `"${row.className || ''}"`,
                    `"${row.sectionName || ''}"`,
                    row.paymentMethod || '',
                    `"${row.feeMonth || ''}"`,
                    row.amountPaid,
                    `"${row.collectedBy || ''}"`
                ]);

                const csvContent = [headers.join(','), ...rows.map((e: any[]) => e.join(','))].join('\n');
                const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
                const url = URL.createObjectURL(blob);
                const link = document.createElement("a");
                link.setAttribute("href", url);
                link.setAttribute("download", `Fee_Received_Report_${new Date().toISOString().split('T')[0]}.csv`);
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
            } else {
                toast.error('Failed to export bulk fee received data');
            }
        } catch (e) {
            console.error(e);
            toast.error('Failed to export fee received data');
        } finally {
            setReceivedLoading(false);
        }
    };

    const handleSendNotification = async () => {
        if (selectedPendingStudents.length === 0) return;
        
        setSendingNotif(true);
        try {
            const defaultMsg = "Dear Parent, this is a reminder that your ward has pending school fee dues. Kindly clear the outstanding amount at the earliest to avoid any inconvenience. Thank you.";
            const message = useCustomMessage ? customNotifMessage : defaultMsg;
            const targetUserIds = selectedPendingStudents.map(id => id.toString());
            
            const payload = {
                title: "Fee Payment Reminder",
                message,
                targetAudience: "CUSTOM",
                targetUserIds
            };

            const res = await authFetch(`${API_BASE_URL}/api/app-notifications`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });

            if (res.ok) {
                toast.success('Notification sent successfully!');
                setShowNotifModal(false);
                setUseCustomMessage(false);
                setCustomNotifMessage('');
            } else {
                const errData = await res.json();
                toast.error(errData.message || 'Failed to send notification');
            }
        } catch (e) {
            console.error("Notification Error:", e);
            toast.error('An error occurred while sending notification');
        } finally {
            setSendingNotif(false);
        }
    };

    useEffect(() => {
        if (mounted && !rbac.isAdmin) {
            toast.error("You don't have permission to access Reports.");
            router.replace('/dashboard');
        }
    }, [mounted, rbac.isAdmin, router]);

    useEffect(() => {
        setMounted(true);
    }, []);

    if (!mounted) {
        return (
            <div className="p-8 flex justify-center items-center h-full">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
        );
    }

    return (
        <main className="p-4 flex-1 h-full overflow-y-auto w-full max-w-7xl mx-auto">
            <Toaster position="top-right" />
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-3xl font-bold text-slate-800">Reports Dashboard</h1>
            </div>

            {/* TABS */}
            <div className="flex p-1 bg-slate-100 rounded-xl mb-6 w-full md:w-fit shadow-inner border border-slate-200/60 overflow-x-auto">
                <button
                    onClick={() => setActiveTab('FEES')}
                    className={`flex items-center gap-2 px-5 py-2.5 text-sm font-medium rounded-lg whitespace-nowrap transition-all duration-200 ${
                        activeTab === 'FEES'
                            ? "bg-white text-blue-700 shadow-sm ring-1 ring-black/5"
                            : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/50"
                    }`}
                >
                    <Wallet className="w-4 h-4" />
                    Fees & Revenue
                </button>
                <button
                    onClick={() => setActiveTab('FEE_RECEIVED')}
                    className={`flex items-center gap-2 px-5 py-2.5 text-sm font-medium rounded-lg whitespace-nowrap transition-all duration-200 ${
                        activeTab === 'FEE_RECEIVED'
                            ? "bg-white text-blue-700 shadow-sm ring-1 ring-black/5"
                            : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/50"
                    }`}
                >
                    <ClipboardList className="w-4 h-4" />
                    Fee Received
                </button>
                <button
                    onClick={() => setActiveTab('PENDING_DUES')}
                    className={`flex items-center gap-2 px-5 py-2.5 text-sm font-medium rounded-lg whitespace-nowrap transition-all duration-200 ${
                        activeTab === 'PENDING_DUES'
                            ? "bg-white text-blue-700 shadow-sm ring-1 ring-black/5"
                            : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/50"
                    }`}
                >
                    <AlertCircle className="w-4 h-4" />
                    Pending Dues
                </button>
                <button
                    onClick={() => setActiveTab('EXAMINATIONS')}
                    className={`flex items-center gap-2 px-5 py-2.5 text-sm font-medium rounded-lg whitespace-nowrap transition-all duration-200 ${
                        activeTab === 'EXAMINATIONS'
                            ? "bg-white text-blue-700 shadow-sm ring-1 ring-black/5"
                            : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/50"
                    }`}
                >
                    <ClipboardList className="w-4 h-4" />
                    Examinations
                </button>
                <button
                    onClick={() => setActiveTab('ATTENDANCE')}
                    className={`flex items-center gap-2 px-5 py-2.5 text-sm font-medium rounded-lg whitespace-nowrap transition-all duration-200 ${
                        activeTab === 'ATTENDANCE'
                            ? "bg-white text-blue-700 shadow-sm ring-1 ring-black/5"
                            : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/50"
                    }`}
                >
                    <CalendarCheck className="w-4 h-4" />
                    Attendance
                </button>
                <button
                    onClick={() => setActiveTab('STUDENTS')}
                    className={`flex items-center gap-2 px-5 py-2.5 text-sm font-medium rounded-lg whitespace-nowrap transition-all duration-200 ${
                        activeTab === 'STUDENTS'
                            ? "bg-white text-blue-700 shadow-sm ring-1 ring-black/5"
                            : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/50"
                    }`}
                >
                    <Users className="w-4 h-4" />
                    Students
                </button>
                <button
                    onClick={() => setActiveTab('STAFF')}
                    className={`flex items-center gap-2 px-5 py-2.5 text-sm font-medium rounded-lg whitespace-nowrap transition-all duration-200 ${
                        activeTab === 'STAFF'
                            ? "bg-white text-blue-700 shadow-sm ring-1 ring-black/5"
                            : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/50"
                    }`}
                >
                    <UserCircle className="w-4 h-4" />
                    Staff
                </button>
            </div>

            {/* TAB CONTENT: FEES */}
            {activeTab === 'FEES' && (
                <div className="space-y-6">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Monthly Collection Chart */}
                        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                            <div className="flex justify-between items-center mb-4">
                                <h2 className="text-lg font-bold text-slate-800">Monthly Fee Collection Trend</h2>
                                <select 
                                    className="border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500 text-sm p-2 bg-gray-50"
                                    value={feeCollectionSession}
                                    onChange={(e) => setFeeCollectionSession(e.target.value)}
                                >
                                    <option value="">Select Session</option>
                                    {academicSessions.map(session => (
                                        <option key={session.id} value={session.id.toString()}>{session.name}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="h-72">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={monthlyCollection}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                                        <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{fill: '#64748B'}} />
                                        <YAxis axisLine={false} tickLine={false} tick={{fill: '#64748B'}} tickFormatter={(val) => `₹${val/1000}k`} />
                                        <Tooltip formatter={(val: any) => `₹${val.toLocaleString()}`} cursor={{fill: '#F1F5F9'}} />
                                        <Legend />
                                        <Bar dataKey="collected" name="Collected" fill="#0ea5e9" radius={[4,4,0,0]} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>

                        {/* Collection vs Pending */}
                        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex flex-col">
                            <div className="flex justify-between items-start mb-2">
                                <div>
                                    <h2 className="text-lg font-bold text-slate-800">Collection vs Pending Dues</h2>
                                    <p className="text-sm text-gray-500 mt-1 max-w-md">
                                        This chart compares the total amount <strong>collected in the current month</strong> against the overall <strong>pending dues up to today's date</strong>.
                                    </p>
                                </div>
                            </div>
                            
                            <div className="h-72 flex-1 mt-4 relative">
                                {collectionStatus.every((d) => d.value === 0) ? (
                                    <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-400">
                                        <svg className="w-12 h-12 mb-2 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"></path></svg>
                                        <p>No fee data found for this period.</p>
                                    </div>
                                ) : (
                                    <ResponsiveContainer width="100%" height="100%">
                                        <PieChart>
                                            <Pie
                                                data={collectionStatus}
                                                innerRadius={70}
                                                outerRadius={100}
                                                paddingAngle={5}
                                                dataKey="value"
                                            >
                                                <Cell fill="#10b981" />
                                                <Cell fill="#f43f5e" />
                                            </Pie>
                                            <Tooltip formatter={(val: any) => `₹${val.toLocaleString()}`} />
                                            <Legend verticalAlign="bottom" height={36}/>
                                        </PieChart>
                                    </ResponsiveContainer>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                        {/* Fee Adjustments Log */}
                        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                            <div className="p-5 border-b border-gray-200 flex justify-between items-center flex-wrap gap-4">
                                <div>
                                    <h2 className="text-lg font-bold text-slate-800">Recent Fee Adjustments (Waive-off & Refund)</h2>
                                    <p className="text-sm text-gray-500">Log of recent records from the fee_adjustment table.</p>
                                </div>
                                <div className="flex items-center gap-2">
                                    <input 
                                        type="date" 
                                        className="border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500 text-sm p-2 bg-gray-50"
                                        value={feeAdjustmentsFromDate}
                                        onChange={(e) => setFeeAdjustmentsFromDate(e.target.value)}
                                    />
                                    <span className="text-slate-500 text-sm">to</span>
                                    <input 
                                        type="date" 
                                        className="border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500 text-sm p-2 bg-gray-50"
                                        value={feeAdjustmentsToDate}
                                        onChange={(e) => setFeeAdjustmentsToDate(e.target.value)}
                                    />
                                </div>
                            </div>
                            <div className="overflow-x-auto">
                                <div className="max-h-72 overflow-y-auto">
                                    <table className="w-full text-sm text-left text-gray-600">
                                        <thead className="text-xs text-slate-500 uppercase bg-slate-50 border-b border-gray-200 sticky top-0 z-10">
                                            <tr>
                                                <th className="px-5 py-3 font-semibold">Date</th>
                                                <th className="px-5 py-3 font-semibold">Student</th>
                                                <th className="px-5 py-3 font-semibold">Type</th>
                                                <th className="px-5 py-3 font-semibold text-right">Amount</th>
                                                <th className="px-5 py-3 font-semibold">Auth By</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {feeAdjustments.slice((feeAdjPage - 1) * FEE_ADJ_PER_PAGE, feeAdjPage * FEE_ADJ_PER_PAGE).map((adj) => (
                                                <tr key={adj.id} className="border-b border-gray-100 hover:bg-slate-50/50">
                                                    <td className="px-5 py-3">{adj.date}</td>
                                                    <td className="px-5 py-3 font-medium text-slate-800">{adj.student}</td>
                                                    <td className="px-5 py-3">
                                                        <span className={`px-2 py-1 rounded text-xs font-semibold ${adj.type === 'REFUND' ? 'bg-orange-100 text-orange-700' : 'bg-purple-100 text-purple-700'}`}>
                                                            {adj.type}
                                                        </span>
                                                    </td>
                                                    <td className="px-5 py-3 text-right font-semibold">₹{adj.amount}</td>
                                                    <td className="px-5 py-3 text-gray-500">{adj.authBy}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                                {feeAdjustments.length === 0 && (
                                    <div className="p-4 text-center text-gray-500">No adjustments found in this date range.</div>
                                )}
                                {feeAdjustments.length > 0 && (
                                    <div className="p-4 border-t border-gray-200 flex justify-between items-center bg-gray-50">
                                        <span className="text-sm text-gray-500">
                                            Showing {(feeAdjPage - 1) * FEE_ADJ_PER_PAGE + 1} to {Math.min(feeAdjPage * FEE_ADJ_PER_PAGE, feeAdjustments.length)} of {feeAdjustments.length}
                                        </span>
                                        <div className="flex gap-2">
                                            <button 
                                                className="px-3 py-1 border border-gray-300 rounded bg-white text-gray-600 hover:bg-gray-50 disabled:opacity-50"
                                                disabled={feeAdjPage === 1}
                                                onClick={() => setFeeAdjPage(p => p - 1)}
                                            >
                                                Prev
                                            </button>
                                            <button 
                                                className="px-3 py-1 border border-gray-300 rounded bg-white text-gray-600 hover:bg-gray-50 disabled:opacity-50"
                                                disabled={feeAdjPage * FEE_ADJ_PER_PAGE >= feeAdjustments.length}
                                                onClick={() => setFeeAdjPage(p => p + 1)}
                                            >
                                                Next
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Waived-off vs Pending Trend */}
                        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                            <div className="p-5 border-b border-gray-200 flex justify-between items-center flex-wrap gap-4">
                                <div>
                                    <h2 className="text-lg font-bold text-slate-800">Waived-off Trend</h2>
                                    <p className="text-sm text-gray-500">Comparison of waived-off fees.</p>
                                </div>
                                <select 
                                    className="border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500 text-sm p-2 bg-gray-50"
                                    value={waivedOffTrendSession}
                                    onChange={(e) => setWaivedOffTrendSession(e.target.value)}
                                >
                                    <option value="">Select Session</option>
                                    {academicSessions.map(session => (
                                        <option key={session.id} value={session.id.toString()}>{session.name}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="h-72 p-5">
                                <ResponsiveContainer width="100%" height="100%">
                                    <LineChart data={waivedOffTrend}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                                        <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{fill: '#64748B'}} />
                                        <YAxis axisLine={false} tickLine={false} tick={{fill: '#64748B'}} tickFormatter={(val) => `₹${val/1000}k`} />
                                        <Tooltip formatter={(val: any) => `₹${val.toLocaleString()}`} />
                                        <Legend />
                                        <Line type="monotone" dataKey="waivedOff" name="Waived-off Trend" stroke="#f43f5e" strokeWidth={3} dot={{r: 4, fill: '#f43f5e'}} />
                                        <Line type="monotone" dataKey="pending" name="Pending Trend" stroke="#f59e0b" strokeWidth={3} dot={{r: 4, fill: '#f59e0b'}} />
                                    </LineChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* TAB CONTENT: PENDING DUES */}
            {activeTab === 'PENDING_DUES' && (
                <div className="space-y-6">
                    <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                        <div className="flex flex-col lg:flex-row justify-between lg:items-center gap-4 mb-6">
                            <div>
                                <h2 className="text-xl font-bold text-slate-800">Pending Dues Report</h2>
                                <p className="text-sm text-gray-500">Filter and export pending fee dues.</p>
                            </div>
                            <div className="flex flex-col sm:flex-row gap-2">
                                <button
                                    onClick={() => setShowNotifModal(true)}
                                    disabled={selectedPendingStudents.length === 0}
                                    className="bg-indigo-600 text-white px-4 py-2 rounded shadow hover:bg-indigo-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 justify-center"
                                >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                                    </svg>
                                    Notify Selected
                                </button>
                                <button
                                    onClick={exportToCSV}
                                    disabled={paginatedPendingDues.length === 0}
                                    className="bg-emerald-600 text-white px-4 py-2 rounded shadow hover:bg-emerald-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 justify-center"
                                >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg>
                                    Download CSV
                                </button>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-7 gap-4 mb-6">
                            <div>
                                <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Session</label>
                                <select
                                    className="w-full border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500 text-sm p-2 bg-gray-50"
                                    value={pendingSessionId}
                                    onChange={(e) => setPendingSessionId(e.target.value)}
                                >
                                    <option value="">Select Session</option>
                                    {academicSessions.map(session => (
                                        <option key={session.id} value={session.id.toString()}>{session.name}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Class</label>
                                <select
                                    className="w-full border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500 text-sm p-2 bg-gray-50"
                                    value={pendingClassId}
                                    onChange={(e) => {
                                        setPendingClassId(e.target.value);
                                        setPendingSectionId('');
                                        const cls = classes.find(c => c.id.toString() === e.target.value);
                                        setPendingAvailableSections(cls ? cls.sections : []);
                                    }}
                                >
                                    <option value="">All Classes</option>
                                    {classes.map((cls: any) => (
                                        <option key={cls.id} value={cls.id.toString()}>{cls.name}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Section</label>
                                <select
                                    className="w-full border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500 text-sm p-2 bg-gray-50 disabled:opacity-50"
                                    value={pendingSectionId}
                                    onChange={(e) => setPendingSectionId(e.target.value)}
                                    disabled={!pendingClassId}
                                >
                                    <option value="">All Sections</option>
                                    {pendingAvailableSections.map((sec: any) => (
                                        <option key={sec.id} value={sec.id.toString()}>{sec.name}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="lg:col-span-2">
                                <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Search Student</label>
                                <input
                                    type="text"
                                    placeholder="Search by ID, Roll No, or Name..."
                                    className="w-full border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500 text-sm p-2 bg-gray-50"
                                    value={pendingSearchQuery}
                                    onChange={(e) => setPendingSearchQuery(e.target.value)}
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Mobile No.</label>
                                <input
                                    type="text"
                                    placeholder="Mobile..."
                                    className="w-full border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500 text-sm p-2 bg-gray-50"
                                    value={pendingMobile}
                                    onChange={(e) => setPendingMobile(e.target.value)}
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Month</label>
                                <select 
                                    className="w-full border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500 text-sm p-2 bg-gray-50"
                                    value={pendingMonth}
                                    onChange={(e) => setPendingMonth(e.target.value)}
                                >
                                    <option value="">Whole Session</option>
                                    <option value="4">April</option>
                                    <option value="5">May</option>
                                    <option value="6">June</option>
                                    <option value="7">July</option>
                                    <option value="8">August</option>
                                    <option value="9">September</option>
                                    <option value="10">October</option>
                                    <option value="11">November</option>
                                    <option value="12">December</option>
                                    <option value="1">January</option>
                                    <option value="2">February</option>
                                    <option value="3">March</option>
                                </select>
                            </div>
                        </div>

                        <div className="overflow-x-auto border border-gray-200 rounded-lg max-h-[600px] overflow-y-auto">
                            {pendingDuesLoading ? (
                                <div className="p-12 flex justify-center">
                                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                                </div>
                            ) : (
                                <table className="w-full text-sm text-left text-gray-600">
                                    <thead className="text-xs text-slate-500 uppercase bg-slate-50 border-b border-gray-200 sticky top-0 z-10 shadow-sm">
                                        <tr>
                                            <th className="px-5 py-3 w-10">
                                                <input 
                                                    type="checkbox"
                                                    checked={paginatedPendingDues.length > 0 && selectedPendingStudents.length === paginatedPendingDues.length}
                                                    onChange={(e) => {
                                                        if (e.target.checked) {
                                                            setSelectedPendingStudents(paginatedPendingDues.map(r => r.studentId));
                                                        } else {
                                                            setSelectedPendingStudents([]);
                                                        }
                                                    }}
                                                    className="w-4 h-4 text-indigo-600 bg-gray-100 border-gray-300 rounded focus:ring-indigo-500 focus:ring-2"
                                                />
                                            </th>
                                            <th className="px-5 py-3 font-semibold cursor-pointer hover:bg-slate-100 group select-none" onClick={() => handlePendingSort('studentId')}>
                                                <div className="flex items-center gap-1">
                                                    Student ID 
                                                    <span className="text-gray-400 text-xs">
                                                        {pendingSortColumn === 'studentId' ? (pendingSortDirection === 'asc' ? '↑' : '↓') : <span className="opacity-0 group-hover:opacity-50">↕</span>}
                                                    </span>
                                                </div>
                                            </th>
                                            <th className="px-5 py-3 font-semibold cursor-pointer hover:bg-slate-100 group select-none" onClick={() => handlePendingSort('rollNo')}>
                                                <div className="flex items-center gap-1">
                                                    Roll No 
                                                    <span className="text-gray-400 text-xs">
                                                        {pendingSortColumn === 'rollNo' ? (pendingSortDirection === 'asc' ? '↑' : '↓') : <span className="opacity-0 group-hover:opacity-50">↕</span>}
                                                    </span>
                                                </div>
                                            </th>
                                            <th className="px-5 py-3 font-semibold cursor-pointer hover:bg-slate-100 group select-none" onClick={() => handlePendingSort('firstName')}>
                                                <div className="flex items-center gap-1">
                                                    Name 
                                                    <span className="text-gray-400 text-xs">
                                                        {pendingSortColumn === 'firstName' ? (pendingSortDirection === 'asc' ? '↑' : '↓') : <span className="opacity-0 group-hover:opacity-50">↕</span>}
                                                    </span>
                                                </div>
                                            </th>
                                            <th className="px-5 py-3 font-semibold cursor-pointer hover:bg-slate-100 group select-none" onClick={() => handlePendingSort('className')}>
                                                <div className="flex items-center gap-1">
                                                    Class 
                                                    <span className="text-gray-400 text-xs">
                                                        {pendingSortColumn === 'className' ? (pendingSortDirection === 'asc' ? '↑' : '↓') : <span className="opacity-0 group-hover:opacity-50">↕</span>}
                                                    </span>
                                                </div>
                                            </th>
                                            <th className="px-5 py-3 font-semibold cursor-pointer hover:bg-slate-100 group select-none" onClick={() => handlePendingSort('sectionName')}>
                                                <div className="flex items-center gap-1">
                                                    Section 
                                                    <span className="text-gray-400 text-xs">
                                                        {pendingSortColumn === 'sectionName' ? (pendingSortDirection === 'asc' ? '↑' : '↓') : <span className="opacity-0 group-hover:opacity-50">↕</span>}
                                                    </span>
                                                </div>
                                            </th>
                                            <th className="px-5 py-3 font-semibold cursor-pointer hover:bg-slate-100 group select-none" onClick={() => handlePendingSort('mobile')}>
                                                <div className="flex items-center gap-1">
                                                    Mobile 
                                                    <span className="text-gray-400 text-xs">
                                                        {pendingSortColumn === 'mobile' ? (pendingSortDirection === 'asc' ? '↑' : '↓') : <span className="opacity-0 group-hover:opacity-50">↕</span>}
                                                    </span>
                                                </div>
                                            </th>
                                            <th className="px-5 py-3 font-semibold cursor-pointer hover:bg-slate-100 group select-none" onClick={() => handlePendingSort('pendingAmount')}>
                                                <div className="flex items-center justify-end gap-1">
                                                    Pending Amount 
                                                    <span className="text-gray-400 text-xs">
                                                        {pendingSortColumn === 'pendingAmount' ? (pendingSortDirection === 'asc' ? '↑' : '↓') : <span className="opacity-0 group-hover:opacity-50">↕</span>}
                                                    </span>
                                                </div>
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {paginatedPendingDues.length > 0 ? (
                                            paginatedPendingDues.map((row, idx) => (
                                                <tr key={idx} className="border-b border-gray-100 hover:bg-slate-50/50">
                                                    <td className="px-5 py-3">
                                                        <input 
                                                            type="checkbox"
                                                            checked={selectedPendingStudents.includes(row.studentId)}
                                                            onChange={(e) => {
                                                                if (e.target.checked) {
                                                                    setSelectedPendingStudents(prev => [...prev, row.studentId]);
                                                                } else {
                                                                    setSelectedPendingStudents(prev => prev.filter(id => id !== row.studentId));
                                                                }
                                                            }}
                                                            className="w-4 h-4 text-indigo-600 bg-gray-100 border-gray-300 rounded focus:ring-indigo-500 focus:ring-2"
                                                        />
                                                    </td>
                                                    <td className="px-5 py-3 font-medium text-blue-600">{row.studentId}</td>
                                                    <td className="px-5 py-3">{row.rollNo || '-'}</td>
                                                    <td className="px-5 py-3 font-semibold text-slate-800">{row.firstName} {row.lastName}</td>
                                                    <td className="px-5 py-3">{row.className}</td>
                                                    <td className="px-5 py-3">{row.sectionName}</td>
                                                    <td className="px-5 py-3">{row.mobile}</td>
                                                    <td className="px-5 py-3 text-right font-bold text-red-600">₹{row.pendingAmount.toLocaleString()}</td>
                                                </tr>
                                            ))
                                        ) : (
                                            <tr>
                                                <td colSpan={8} className="p-8 text-center text-gray-500">
                                                    No pending dues found matching the selected filters.
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                    {paginatedPendingDues.length > 0 && (
                                        <tfoot className="bg-slate-50 border-t border-gray-200 font-bold text-slate-800 sticky bottom-0">
                                            <tr>
                                                <td colSpan={7} className="px-5 py-3 text-right uppercase text-xs text-slate-500">Total Pending Dues</td>
                                                <td className="px-5 py-3 text-right text-red-600 text-lg">
                                                    ₹{displayedPendingDuesAll.reduce((sum, row) => sum + row.pendingAmount, 0).toLocaleString()}
                                                </td>
                                            </tr>
                                        </tfoot>
                                    )}
                                </table>
                            )}
                        </div>

                        {/* Pending Dues Pagination Controls */}
                        {totalPendingPages > 1 && (
                            <div className="p-4 border-t border-slate-100 flex items-center justify-between bg-slate-50/50 mt-4 rounded-lg">
                                <div className="text-sm text-slate-500">
                                    Showing <span className="font-medium text-slate-900">{(pendingDuesPage - 1) * PENDING_DUES_PER_PAGE + 1}</span> to <span className="font-medium text-slate-900">{Math.min(pendingDuesPage * PENDING_DUES_PER_PAGE, displayedPendingDuesAll.length)}</span> of <span className="font-medium text-slate-900">{displayedPendingDuesAll.length}</span> students
                                </div>
                                <div className="flex gap-2">
                                    <button 
                                        onClick={() => setPendingDuesPage(p => Math.max(1, p - 1))}
                                        disabled={pendingDuesPage === 1}
                                        className="px-3 py-1 border border-slate-200 rounded text-sm disabled:opacity-50 bg-white hover:bg-slate-50 transition"
                                    >
                                        Previous
                                    </button>
                                    <span className="px-3 py-1 text-sm flex items-center">
                                        Page {pendingDuesPage} of {totalPendingPages}
                                    </span>
                                    <button 
                                        onClick={() => setPendingDuesPage(p => Math.min(totalPendingPages, p + 1))}
                                        disabled={pendingDuesPage === totalPendingPages}
                                        className="px-3 py-1 border border-slate-200 rounded text-sm disabled:opacity-50 bg-white hover:bg-slate-50 transition"
                                    >
                                        Next
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* TAB CONTENT: FEE RECEIVED */}
            {activeTab === 'FEE_RECEIVED' && (
                <div className="space-y-6">
                    <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                        <div className="flex flex-col lg:flex-row justify-between lg:items-center gap-4 mb-6">
                            <div>
                                <h2 className="text-xl font-bold text-slate-800">Fee Received Report</h2>
                                <p className="text-sm text-gray-500">View and export all fee collections.</p>
                            </div>
                            <div className="flex flex-col sm:flex-row gap-2">
                                <button
                                    onClick={exportFeeReceivedCSV}
                                    className="bg-emerald-600 text-white px-4 py-2 rounded shadow hover:bg-emerald-700 transition flex items-center gap-2 justify-center"
                                >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4-4m0 0l-4-4m4 4V4"></path></svg>
                                    Download CSV
                                </button>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-7 gap-4 mb-6">
                            <div>
                                <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Session</label>
                                <select
                                    className="w-full border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500 text-sm p-2 bg-gray-50"
                                    value={receivedSessionId}
                                    onChange={(e) => setReceivedSessionId(e.target.value)}
                                >
                                    <option value="">Select Session</option>
                                    {academicSessions.map(session => (
                                        <option key={session.id} value={session.id.toString()}>{session.name}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Class</label>
                                <select
                                    className="w-full border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500 text-sm p-2 bg-gray-50"
                                    value={receivedClassId}
                                    onChange={(e) => {
                                        setReceivedClassId(e.target.value);
                                        setReceivedSectionId('');
                                        const cls = classes.find(c => c.id.toString() === e.target.value);
                                        setReceivedAvailableSections(cls ? cls.sections : []);
                                    }}
                                >
                                    <option value="">All Classes</option>
                                    {classes.map((cls: any) => (
                                        <option key={cls.id} value={cls.id.toString()}>{cls.name}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Section</label>
                                <select
                                    className="w-full border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500 text-sm p-2 bg-gray-50 disabled:opacity-50"
                                    value={receivedSectionId}
                                    onChange={(e) => setReceivedSectionId(e.target.value)}
                                    disabled={!receivedClassId}
                                >
                                    <option value="">All Sections</option>
                                    {receivedAvailableSections.map((sec: any) => (
                                        <option key={sec.id} value={sec.id.toString()}>{sec.name}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="lg:col-span-2">
                                <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Student ID</label>
                                <input
                                    type="text"
                                    placeholder="Search by ID..."
                                    className="w-full border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500 text-sm p-2 bg-gray-50"
                                    value={receivedSearchQuery}
                                    onChange={(e) => setReceivedSearchQuery(e.target.value)}
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Mobile No.</label>
                                <input
                                    type="text"
                                    placeholder="Mobile..."
                                    className="w-full border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500 text-sm p-2 bg-gray-50"
                                    value={receivedMobile}
                                    onChange={(e) => setReceivedMobile(e.target.value)}
                                />
                            </div>
                            <div className="flex gap-2 lg:col-span-1">
                                <div className="w-1/2">
                                    <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">From</label>
                                    <input
                                        type="date"
                                        className="w-full border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500 text-[11px] p-2 bg-gray-50"
                                        value={receivedFromDate}
                                        onChange={(e) => setReceivedFromDate(e.target.value)}
                                    />
                                </div>
                                <div className="w-1/2">
                                    <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">To</label>
                                    <input
                                        type="date"
                                        className="w-full border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500 text-[11px] p-2 bg-gray-50"
                                        value={receivedToDate}
                                        onChange={(e) => setReceivedToDate(e.target.value)}
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="overflow-x-auto border border-gray-200 rounded-lg max-h-[600px] overflow-y-auto">
                            {receivedLoading ? (
                                <div className="p-12 flex justify-center">
                                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                                </div>
                            ) : (
                                <table className="w-full text-sm text-left text-gray-600">
                                    <thead className="text-xs text-slate-500 uppercase bg-slate-50 border-b border-gray-200 sticky top-0 z-10 shadow-sm">
                                        <tr>
                                            <th className="px-5 py-3 font-semibold">Payment Date</th>
                                            <th className="px-5 py-3 font-semibold">Receipt No</th>
                                            <th className="px-5 py-3 font-semibold">Student Name</th>
                                            <th className="px-5 py-3 font-semibold">Class</th>
                                            <th className="px-5 py-3 font-semibold">Method</th>
                                            <th className="px-5 py-3 font-semibold">Fee Month</th>
                                            <th className="px-5 py-3 font-semibold">Collected By</th>
                                            <th className="px-5 py-3 font-semibold text-right">Amount Paid</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {receivedData.length > 0 ? (
                                            receivedData.map((row, idx) => (
                                                <tr key={idx} className="border-b border-gray-100 hover:bg-slate-50/50">
                                                    <td className="px-5 py-3">{new Date(row.paymentDate).toLocaleDateString()}</td>
                                                    <td className="px-5 py-3 font-medium text-slate-800">{row.receiptNumber}</td>
                                                    <td className="px-5 py-3">
                                                        {row.firstName} {row.lastName}
                                                        <div className="text-xs text-gray-400">ID: {row.studentId}</div>
                                                    </td>
                                                    <td className="px-5 py-3">{row.className} {row.sectionName}</td>
                                                    <td className="px-5 py-3">{row.paymentMethod}</td>
                                                    <td className="px-5 py-3">{row.feeMonth || '-'}</td>
                                                    <td className="px-5 py-3">{row.collectedBy}</td>
                                                    <td className="px-5 py-3 text-right font-bold text-green-600">₹{row.amountPaid?.toLocaleString()}</td>
                                                </tr>
                                            ))
                                        ) : (
                                            <tr>
                                                <td colSpan={8} className="p-8 text-center text-gray-500">
                                                    No fee received records matching the selected filters.
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            )}
                        </div>

                        {/* Pagination */}
                        {receivedTotalCount > 0 && Math.ceil(receivedTotalCount / RECEIVED_PER_PAGE) > 1 && (
                            <div className="p-4 border-t border-slate-100 flex items-center justify-between bg-slate-50/50 mt-4 rounded-lg">
                                <div className="text-sm text-slate-500">
                                    Showing <span className="font-medium text-slate-900">{(receivedPage - 1) * RECEIVED_PER_PAGE + 1}</span> to <span className="font-medium text-slate-900">{Math.min(receivedPage * RECEIVED_PER_PAGE, receivedTotalCount)}</span> of <span className="font-medium text-slate-900">{receivedTotalCount}</span> records
                                </div>
                                <div className="flex gap-2">
                                    <button 
                                        onClick={() => setReceivedPage(p => Math.max(1, p - 1))}
                                        disabled={receivedPage === 1}
                                        className="px-3 py-1 border border-slate-200 rounded text-sm disabled:opacity-50 bg-white hover:bg-slate-50 transition"
                                    >
                                        Previous
                                    </button>
                                    <span className="px-3 py-1 text-sm flex items-center">
                                        Page {receivedPage} of {Math.ceil(receivedTotalCount / RECEIVED_PER_PAGE)}
                                    </span>
                                    <button 
                                        onClick={() => setReceivedPage(p => Math.min(Math.ceil(receivedTotalCount / RECEIVED_PER_PAGE), p + 1))}
                                        disabled={receivedPage === Math.ceil(receivedTotalCount / RECEIVED_PER_PAGE)}
                                        className="px-3 py-1 border border-slate-200 rounded text-sm disabled:opacity-50 bg-white hover:bg-slate-50 transition"
                                    >
                                        Next
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* TAB CONTENT: EXAMINATIONS */}
            {activeTab === 'EXAMINATIONS' && (
                <div className="space-y-6">
                    {/* Filters Row */}
                    <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex flex-wrap gap-4 items-end">
                        <div className="flex-1 min-w-[150px]">
                            <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Academic Year</label>
                            <select 
                                className="w-full border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500 text-sm p-2 bg-white"
                                value={selectedExamYear}
                                onChange={(e) => setSelectedExamYear(e.target.value)}
                            >
                                <option value="">Select Session</option>
                                {academicSessions.map(session => (
                                    <option key={session.id} value={session.id.toString()}>{session.name}</option>
                                ))}
                            </select>
                        </div>
                        <div className="flex-1 min-w-[150px]">
                            <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Exam Term</label>
                            <select 
                                className="w-full border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500 text-sm p-2 bg-white"
                                value={selectedExamTerm}
                                onChange={(e) => setSelectedExamTerm(e.target.value)}
                            >
                                <option value="">Select Term</option>
                                {examTerms.map(term => (
                                    <option key={term.id} value={term.id.toString()}>{term.name}</option>
                                ))}
                            </select>
                        </div>
                        <div className="flex-1 min-w-[150px]">
                            <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Class</label>
                            <select 
                                className="w-full border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500 text-sm p-2 bg-white"
                                value={selectedExamClass}
                                onChange={(e) => {
                                    setSelectedExamClass(e.target.value);
                                    setSelectedExamSection('');
                                    const cls = classes.find((c: any) => c.id.toString() === e.target.value);
                                    setAvailableSections(cls ? cls.sections : []);
                                }}
                            >
                                <option value="">All Classes</option>
                                {classes.map((cls: any) => (
                                    <option key={cls.id} value={cls.id.toString()}>{cls.name}</option>
                                ))}
                            </select>
                        </div>
                        {selectedExamClass && availableSections.length > 0 && (
                            <div className="flex-1 min-w-[150px]">
                                <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Section</label>
                                <select 
                                    className="w-full border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500 text-sm p-2 bg-white"
                                    value={selectedExamSection}
                                    onChange={(e) => setSelectedExamSection(e.target.value)}
                                >
                                    <option value="">All Sections</option>
                                    {availableSections.map((sec: any) => (
                                        <option key={sec.id} value={sec.id.toString()}>{sec.name}</option>
                                    ))}
                                </select>
                            </div>
                        )}
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                            <h2 className="text-lg font-bold text-slate-800 mb-4">Average Marks by Class</h2>
                            <div className="h-72">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={examClassAvg}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                                        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#64748B'}} />
                                        <YAxis axisLine={false} tickLine={false} tick={{fill: '#64748B'}} domain={[0, 100]} />
                                        <Tooltip formatter={(val: any) => `${val}%`} cursor={{fill: '#F1F5F9'}} />
                                        <Bar dataKey="avg" name="Average %" fill="#8b5cf6" radius={[4,4,0,0]} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>

                        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                            <div className="p-5 border-b border-gray-200 flex justify-between items-center">
                                <div>
                                    <h2 className="text-lg font-bold text-slate-800">Top Performers / Highest Marks</h2>
                                    <p className="text-sm text-gray-500">Highest scores per subject</p>
                                </div>
                            </div>
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm text-left text-gray-600">
                                    <thead className="text-xs text-slate-500 uppercase bg-slate-50 border-b border-gray-200">
                                        <tr>
                                            <th className="px-5 py-3 font-semibold">Subject</th>
                                            <th className="px-5 py-3 font-semibold">Class</th>
                                            <th className="px-5 py-3 font-semibold">Student Name</th>
                                            <th className="px-5 py-3 font-semibold text-right">Highest %</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {topPerformers.map((tp, idx) => (
                                            <tr key={idx} className="border-b border-gray-100 hover:bg-slate-50/50">
                                                <td className="px-5 py-3 font-medium">{tp.subject}</td>
                                                <td className="px-5 py-3">{tp.className}</td>
                                                <td className="px-5 py-3">{tp.studentName}</td>
                                                <td className="px-5 py-3 text-right font-bold text-green-600">{tp.percentage}%</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                                {topPerformers.length === 0 && (
                                    <div className="p-4 text-center text-gray-500">No score records found.</div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* TAB CONTENT: ATTENDANCE */}
            {activeTab === 'ATTENDANCE' && (
                <div className="space-y-6">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                            <div className="flex justify-between items-center mb-4 flex-wrap gap-2">
                                <h2 className="text-lg font-bold text-slate-800">Average Attendance by Class</h2>
                                <select 
                                    className="border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500 text-sm p-2 bg-gray-50 mr-2"
                                    value={attendanceSession}
                                    onChange={(e) => setAttendanceSession(e.target.value)}
                                >
                                    <option value="">Select Session</option>
                                    {academicSessions.map(session => (
                                        <option key={session.id} value={session.id.toString()}>{session.name}</option>
                                    ))}
                                </select>
                                <select 
                                    className="border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500 text-sm p-2 bg-gray-50"
                                    value={attendanceMonth}
                                    onChange={(e) => setAttendanceMonth(e.target.value)}
                                >
                                    <option value="">Whole Year</option>
                                    <option value="4">April</option>
                                    <option value="5">May</option>
                                    <option value="6">June</option>
                                    <option value="7">July</option>
                                    <option value="8">August</option>
                                    <option value="9">September</option>
                                    <option value="10">October</option>
                                    <option value="11">November</option>
                                    <option value="12">December</option>
                                    <option value="1">January</option>
                                    <option value="2">February</option>
                                    <option value="3">March</option>
                                </select>
                            </div>
                            <div className="h-72">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={attendanceByClass} layout="vertical">
                                        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#E2E8F0" />
                                        <XAxis type="number" domain={[0, 100]} axisLine={false} tickLine={false} tick={{fill: '#64748B'}} />
                                        <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{fill: '#64748B'}} width={60} />
                                        <Tooltip formatter={(val: any) => `${val}%`} cursor={{fill: '#F1F5F9'}} />
                                        <Bar dataKey="attendance" name="Attendance %" fill="#10b981" radius={[0,4,4,0]} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>

                        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                            <div className="flex justify-between items-center mb-4 flex-wrap gap-4">
                                <h2 className="text-lg font-bold text-slate-800">School-Wide Daily Trend</h2>
                                <div className="flex items-center gap-2">
                                    <input 
                                        type="date" 
                                        className="border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500 text-sm p-2 bg-gray-50"
                                        value={attendanceFromDate}
                                        onChange={(e) => setAttendanceFromDate(e.target.value)}
                                    />
                                    <span className="text-slate-500 text-sm">to</span>
                                    <input 
                                        type="date" 
                                        className="border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500 text-sm p-2 bg-gray-50"
                                        value={attendanceToDate}
                                        onChange={(e) => setAttendanceToDate(e.target.value)}
                                    />
                                </div>
                            </div>
                            <div className="h-72">
                                <ResponsiveContainer width="100%" height="100%">
                                    <LineChart data={attendanceTrend}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                                        <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{fill: '#64748B'}} />
                                        <YAxis domain={[0, 100]} axisLine={false} tickLine={false} tick={{fill: '#64748B'}} />
                                        <Tooltip formatter={(val: any) => `${val}%`} />
                                        <Line type="monotone" dataKey="percent" name="Attendance %" stroke="#f59e0b" strokeWidth={3} dot={{r:4, fill:'#f59e0b'}} activeDot={{r:6}} />
                                    </LineChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* TAB CONTENT: STUDENTS */}
            {activeTab === 'STUDENTS' && (
                <div className="space-y-6">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                            <div className="flex justify-between items-center mb-4 flex-wrap gap-2">
                                <h2 className="text-lg font-bold text-slate-800">Student Enrollment by Class</h2>
                                <div className="flex items-center gap-2">
                                    <select 
                                        className="border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500 text-sm p-2 bg-gray-50"
                                        value={enrollmentFromSession}
                                        onChange={(e) => setEnrollmentFromSession(e.target.value)}
                                    >
                                        <option value="">Filter Session</option>
                                        {academicSessions.map(session => (
                                            <option key={session.id} value={session.id.toString()}>{session.name}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                            <div className="h-72">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={enrollmentClass}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                                        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#64748B'}} />
                                        <YAxis axisLine={false} tickLine={false} tick={{fill: '#64748B'}} />
                                        <Tooltip cursor={{fill: '#F1F5F9'}} />
                                        <Bar dataKey="students" name="Enrolled Students" fill="#3b82f6" radius={[4,4,0,0]} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>

                        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                            <div className="flex justify-between items-center mb-4 flex-wrap gap-2">
                                <h2 className="text-lg font-bold text-slate-800">New Admissions Trend</h2>
                                <div className="flex items-center gap-2">
                                    <select 
                                        className="w-32 border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500 text-sm p-2 bg-gray-50"
                                        value={admissionsFromSession}
                                        onChange={(e) => setAdmissionsFromSession(e.target.value)}
                                    >
                                        <option value="">From Session</option>
                                        {academicSessions.map(session => (
                                            <option key={session.id} value={session.id.toString()}>{session.name}</option>
                                        ))}
                                    </select>
                                    <span className="text-slate-500 text-sm">to</span>
                                    <select 
                                        className="w-32 border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500 text-sm p-2 bg-gray-50"
                                        value={admissionsToSession}
                                        onChange={(e) => setAdmissionsToSession(e.target.value)}
                                    >
                                        <option value="">To Session</option>
                                        {academicSessions.map(session => (
                                            <option key={session.id} value={session.id.toString()}>{session.name}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                            <div className="h-72">
                                <ResponsiveContainer width="100%" height="100%">
                                    <LineChart data={admissionsTrend}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                                        <XAxis dataKey="year" axisLine={false} tickLine={false} tick={{fill: '#64748B'}} />
                                        <YAxis axisLine={false} tickLine={false} tick={{fill: '#64748B'}} />
                                        <Tooltip />
                                        <Line type="monotone" dataKey="admissions" name="New Admissions" stroke="#10b981" strokeWidth={3} dot={{r: 4, fill: '#10b981'}} />
                                    </LineChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* TAB CONTENT: STAFF */}
            {activeTab === 'STAFF' && (
                <div className="space-y-6">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                            <h2 className="text-lg font-bold text-slate-800 mb-4">Staff Distribution</h2>
                            <div className="h-72">
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie
                                            data={staffDistribution}
                                            innerRadius={60}
                                            outerRadius={100}
                                            paddingAngle={2}
                                            dataKey="value"
                                            label
                                        >
                                            {staffDistribution.map((entry: any, index: number) => (
                                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                            ))}
                                        </Pie>
                                        <Tooltip />
                                        <Legend verticalAlign="bottom" height={36}/>
                                    </PieChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {showNotifModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden animate-scale-in">
                        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                            <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                                <svg className="w-5 h-5 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                                </svg>
                                Send Fee Reminder Notification
                            </h3>
                            <button onClick={() => setShowNotifModal(false)} className="text-slate-400 hover:text-slate-600 transition">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                            </button>
                        </div>
                        <div className="p-6 space-y-5">
                            <div className="bg-indigo-50 text-indigo-700 p-3 rounded-lg text-sm border border-indigo-100 flex gap-3 items-center">
                                <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                <span>Will notify parents of <strong>{selectedPendingStudents.length}</strong> selected student(s).</span>
                            </div>

                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-1">Notification Title</label>
                                <input type="text" value="Fee Payment Reminder" disabled className="w-full border-slate-200 bg-slate-50 text-slate-500 rounded-lg p-2.5 text-sm" />
                            </div>

                            <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                    <label className="text-sm font-semibold text-slate-700">Message Content</label>
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input type="checkbox" checked={useCustomMessage} onChange={(e) => setUseCustomMessage(e.target.checked)} className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" />
                                        <span className="text-xs text-slate-600 font-medium">Use custom message</span>
                                    </label>
                                </div>
                                
                                {useCustomMessage ? (
                                    <textarea
                                        value={customNotifMessage}
                                        onChange={(e) => setCustomNotifMessage(e.target.value)}
                                        placeholder="Write your custom reminder message here..."
                                        className="w-full border-slate-300 rounded-lg p-3 text-sm focus:ring-indigo-500 focus:border-indigo-500 min-h-[120px]"
                                    />
                                ) : (
                                    <div className="w-full border border-slate-200 bg-slate-50 rounded-lg p-4 text-sm text-slate-500 italic">
                                        "Dear Parent, this is a reminder that your ward has pending school fee dues. Kindly clear the outstanding amount at the earliest to avoid any inconvenience. Thank you."
                                    </div>
                                )}
                            </div>
                        </div>
                        <div className="p-5 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
                            <button
                                onClick={() => setShowNotifModal(false)}
                                disabled={sendingNotif}
                                className="px-5 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-200 bg-slate-100 rounded-lg transition"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSendNotification}
                                disabled={sendingNotif || (useCustomMessage && !customNotifMessage.trim())}
                                className="px-5 py-2.5 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow transition flex items-center gap-2 disabled:opacity-50"
                            >
                                {sendingNotif && <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                                {sendingNotif ? 'Sending...' : 'Send Notification'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

        </main>
    );
}
