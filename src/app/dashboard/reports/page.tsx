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

const COLORS = ['#0ea5e9', '#f43f5e', '#10b981', '#f59e0b', '#8b5cf6', '#64748b'];

export default function ReportsDashboard() {
    const router = useRouter();
    const rbac = useRbac();
    const [mounted, setMounted] = useState(false);
    const [activeTab, setActiveTab] = useState<'FEES' | 'PENDING_DUES' | 'EXAMINATIONS' | 'ATTENDANCE' | 'STUDENTS' | 'STAFF'>('FEES');

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
    const [pendingClassId, setPendingClassId] = useState('');
    const [pendingAvailableSections, setPendingAvailableSections] = useState<any[]>([]);
    const [pendingSectionId, setPendingSectionId] = useState('');
    const [pendingStudentId, setPendingStudentId] = useState('');
    const [pendingMobile, setPendingMobile] = useState('');
    const [pendingMonth, setPendingMonth] = useState('');
    const [pendingDuesData, setPendingDuesData] = useState<any[]>([]);
    const [pendingDuesLoading, setPendingDuesLoading] = useState(false);
    const [pendingSortColumn, setPendingSortColumn] = useState<string>('className');
    const [pendingSortDirection, setPendingSortDirection] = useState<'asc' | 'desc'>('asc');

    // Pagination for adjustments
    const [feeAdjPage, setFeeAdjPage] = useState(1);
    const FEE_ADJ_PER_PAGE = 10;

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
                if (pendingStudentId) query += `&studentId=${pendingStudentId}`;
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
        
        // Add a small debounce if typing Student ID or Mobile
        const timeoutId = setTimeout(() => {
            fetchData();
        }, 500);
        return () => clearTimeout(timeoutId);
    }, [activeTab, pendingSessionId, pendingClassId, pendingSectionId, pendingStudentId, pendingMobile, pendingMonth, academicSessions]);

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

    const exportToCSV = () => {
        if (sortedPendingDues.length === 0) {
            toast.error('No data to export');
            return;
        }

        const headers = ['Student ID', 'Roll No', 'First Name', 'Last Name', 'Mobile', 'Class', 'Section', 'Pending Amount'];
        const rows = sortedPendingDues.map(row => [
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
            <div className="flex border-b border-gray-200 mb-6 overflow-x-auto">
                <button
                    className={`py-2 px-4 font-semibold text-sm mr-4 border-b-2 whitespace-nowrap transition-colors ${activeTab === 'FEES' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}
                    onClick={() => setActiveTab('FEES')}
                >
                    💰 Fees & Revenue
                </button>
                <button
                    className={`py-2 px-4 font-semibold text-sm mr-4 border-b-2 whitespace-nowrap transition-colors ${activeTab === 'PENDING_DUES' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}
                    onClick={() => setActiveTab('PENDING_DUES')}
                >
                    💸 Pending Dues
                </button>
                <button
                    className={`py-2 px-4 font-semibold text-sm mr-4 border-b-2 whitespace-nowrap transition-colors ${activeTab === 'EXAMINATIONS' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}
                    onClick={() => setActiveTab('EXAMINATIONS')}
                >
                    📝 Examinations
                </button>
                <button
                    className={`py-2 px-4 font-semibold text-sm mr-4 border-b-2 whitespace-nowrap transition-colors ${activeTab === 'ATTENDANCE' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}
                    onClick={() => setActiveTab('ATTENDANCE')}
                >
                    📅 Attendance
                </button>
                <button
                    className={`py-2 px-4 font-semibold text-sm mr-4 border-b-2 whitespace-nowrap transition-colors ${activeTab === 'STUDENTS' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}
                    onClick={() => setActiveTab('STUDENTS')}
                >
                    👨‍🎓 Students
                </button>
                <button
                    className={`py-2 px-4 font-semibold text-sm mr-4 border-b-2 whitespace-nowrap transition-colors ${activeTab === 'STAFF' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}
                    onClick={() => setActiveTab('STAFF')}
                >
                    👩‍🏫 Staff
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
                            <button
                                onClick={exportToCSV}
                                disabled={pendingDuesData.length === 0}
                                className="bg-emerald-600 text-white px-4 py-2 rounded shadow hover:bg-emerald-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg>
                                Download CSV
                            </button>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
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
                            <div>
                                <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Student ID</label>
                                <input
                                    type="text"
                                    placeholder="ID..."
                                    className="w-full border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500 text-sm p-2 bg-gray-50"
                                    value={pendingStudentId}
                                    onChange={(e) => setPendingStudentId(e.target.value)}
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
                                            <th className="px-5 py-3 font-semibold cursor-pointer hover:bg-slate-100" onClick={() => handlePendingSort('studentId')}>
                                                Student ID {pendingSortColumn === 'studentId' && (pendingSortDirection === 'asc' ? '↑' : '↓')}
                                            </th>
                                            <th className="px-5 py-3 font-semibold cursor-pointer hover:bg-slate-100" onClick={() => handlePendingSort('rollNo')}>
                                                Roll No {pendingSortColumn === 'rollNo' && (pendingSortDirection === 'asc' ? '↑' : '↓')}
                                            </th>
                                            <th className="px-5 py-3 font-semibold cursor-pointer hover:bg-slate-100" onClick={() => handlePendingSort('firstName')}>
                                                Name {pendingSortColumn === 'firstName' && (pendingSortDirection === 'asc' ? '↑' : '↓')}
                                            </th>
                                            <th className="px-5 py-3 font-semibold cursor-pointer hover:bg-slate-100" onClick={() => handlePendingSort('className')}>
                                                Class {pendingSortColumn === 'className' && (pendingSortDirection === 'asc' ? '↑' : '↓')}
                                            </th>
                                            <th className="px-5 py-3 font-semibold cursor-pointer hover:bg-slate-100" onClick={() => handlePendingSort('sectionName')}>
                                                Section {pendingSortColumn === 'sectionName' && (pendingSortDirection === 'asc' ? '↑' : '↓')}
                                            </th>
                                            <th className="px-5 py-3 font-semibold cursor-pointer hover:bg-slate-100" onClick={() => handlePendingSort('mobile')}>
                                                Mobile {pendingSortColumn === 'mobile' && (pendingSortDirection === 'asc' ? '↑' : '↓')}
                                            </th>
                                            <th className="px-5 py-3 font-semibold text-right cursor-pointer hover:bg-slate-100" onClick={() => handlePendingSort('pendingAmount')}>
                                                Pending Amount {pendingSortColumn === 'pendingAmount' && (pendingSortDirection === 'asc' ? '↑' : '↓')}
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {sortedPendingDues.length > 0 ? (
                                            sortedPendingDues.map((row, idx) => (
                                                <tr key={idx} className="border-b border-gray-100 hover:bg-slate-50/50">
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
                                                <td colSpan={7} className="p-8 text-center text-gray-500">
                                                    No pending dues found matching the selected filters.
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                    {sortedPendingDues.length > 0 && (
                                        <tfoot className="bg-slate-50 border-t border-gray-200 font-bold text-slate-800 sticky bottom-0">
                                            <tr>
                                                <td colSpan={6} className="px-5 py-3 text-right uppercase text-xs text-slate-500">Total Pending Dues</td>
                                                <td className="px-5 py-3 text-right text-red-600 text-lg">
                                                    ₹{sortedPendingDues.reduce((sum, row) => sum + row.pendingAmount, 0).toLocaleString()}
                                                </td>
                                            </tr>
                                        </tfoot>
                                    )}
                                </table>
                            )}
                        </div>
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

        </main>
    );
}
