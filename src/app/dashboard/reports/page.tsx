"use client";

import { useState, useEffect } from "react";
import toast, { Toaster } from "react-hot-toast";
import { useRbac } from "@/lib/rbac";
import { todayLocalDate, sortByName } from "@/lib/utils";
import { useRouter } from "next/navigation";
import { API_BASE_URL } from "@/lib/api";
import { authFetch } from "@/lib/auth";
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
    PieChart, Pie, Cell, LineChart, Line, ComposedChart,
} from 'recharts';
import { Wallet, AlertCircle, ClipboardList, CalendarCheck, Users, UserCircle, Download, Boxes } from "lucide-react";
import Link from "next/link";
import { AppDatePicker } from "@/components/ui/AppDatePicker";
import { hrApi, PayrollMonthlySummary } from "@/lib/hr-api";
import { attendanceSettingsApi, type AttendanceTodaySummary } from "@/lib/attendance-settings-api";
import { ATTENDANCE_TONE } from "@/lib/attendanceColors";
import {
    CHART_CURSOR, CHART_GRID, CHART_TICK, CHART_TOOLTIP,
    SERIES, SERIES_CONTEXT_SOFT, categorical,
} from "@/lib/chartTokens";
import DailyAttendanceRegister from "@/components/DailyAttendanceRegister";
import { useLocale, useTranslations } from "next-intl";
import { INTL_LOCALE } from "@/i18n/config";

// Session months in school order (April → March); labels come from Intl.
const SESSION_MONTHS = [4, 5, 6, 7, 8, 9, 10, 11, 12, 1, 2, 3] as const;

interface AttendanceTrendPoint {
  date: string;
  present: number;
  marked: number;
  totalStudents: number;
  registersTaken: number;
  attendancePercent: number | null;
  coveragePercent: number;
}

function AttendanceTrendTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: { payload: AttendanceTrendPoint }[];
  label?: string;
}) {
  const t = useTranslations("reports");
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload;
  if (!d) return null;
  return (
    <div className="space-y-0.5 rounded-lg border border-line bg-surface px-3 py-2 text-xs shadow-raised">
      <p className="font-semibold text-ink">{label}</p>
      {/* Each line wears the colour of the mark it describes — the rate line
          and the coverage bars — so the tooltip is read without a legend. */}
      <p className="font-medium text-brand">
        {d.attendancePercent === null ? t('trendTooltip.noAttendance') : t('trendTooltip.presentOfMarked', { percent: d.attendancePercent, marked: d.marked })}
      </p>
      <p className="font-medium text-accent-info-deep">
        {t('trendTooltip.coverage', { coverage: d.coveragePercent, marked: d.marked, total: d.totalStudents })}
      </p>
    </div>
  );
}

// ── Library Fees Report (used inside reports page) ────────────────────────────

function LibraryFeesReportSection() {
    const t = useTranslations("reports");
    const tc = useTranslations("common");
    const [data, setData] = useState<any>(null);
    const [fromDate, setFromDate] = useState('');
    const [toDate, setToDate] = useState('');
    const [page, setPage] = useState(1);
    const [loading, setLoading] = useState(false);
    const LIMIT = 20;
    const fmtTs = (d: string) => new Date(d).toISOString().replace('T', ' ').substring(0, 19);

    const load = async (p: number) => {
        setLoading(true);
        try {
            const q = new URLSearchParams({ page: String(p), limit: String(LIMIT) });
            if (fromDate) q.set('fromDate', fromDate);
            if (toDate) q.set('toDate', toDate);
            const res = await authFetch(`${API_BASE_URL}/library/reports/fees?${q}`);
            if (!res.ok) throw new Error();
            setData(await res.json());
        } catch { toast.error(t('library.loadFailed')); } finally { setLoading(false); }
    };

    useEffect(() => { load(1); }, []);

    const downloadCsv = async () => {
        const q = new URLSearchParams({ export: 'csv', limit: '10000' });
        if (fromDate) q.set('fromDate', fromDate);
        if (toDate) q.set('toDate', toDate);
        const res = await authFetch(`${API_BASE_URL}/library/reports/fees?${q}`);
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url; a.download = 'library-fees.csv'; a.click();
    };

    return (
        <div className="space-y-4">
            {data?.summary && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    {[[t('library.totalCharged'), data.summary.totalCharged, 'text-slate-700'], [t('library.collected'), data.summary.totalCollected, 'text-green-600'], [t('library.waived'), data.summary.totalWaived, 'text-amber-600'], [t('library.outstanding'), data.summary.totalOutstanding, 'text-red-600']].map(([l, v, c]) => (
                        <div key={String(l)} className="bg-white border border-slate-200 rounded-xl p-4 text-center shadow-sm">
                            <div className={`text-2xl font-bold ${c}`}>₹{Number(v).toFixed(2)}</div>
                            <div className="text-xs text-slate-500 mt-1">{l}</div>
                        </div>
                    ))}
                </div>
            )}
            <div className="flex flex-wrap gap-2">
                <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} className="border border-gray-300 rounded-lg text-sm p-2 bg-gray-50" />
                <input type="date" value={toDate} onChange={e => setToDate(e.target.value)} className="border border-gray-300 rounded-lg text-sm p-2 bg-gray-50" />
                <button onClick={() => load(1)} className="px-4 py-2 rounded-lg bg-lime-600 text-white text-sm hover:bg-lime-700">{tc('action.search')}</button>
                <button onClick={downloadCsv} className="flex items-center gap-1.5 px-4 py-2 rounded-lg border border-slate-300 text-sm hover:bg-slate-100">
                    <Download className="w-4 h-4" /> {t('library.exportCsv')}
                </button>
            </div>
            {loading ? (
                <div className="flex justify-center py-12"><div className="w-6 h-6 border-2 border-lime-600 border-t-transparent rounded-full animate-spin" /></div>
            ) : (
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead className="bg-slate-50">
                            <tr className="text-slate-500 text-left">
                                <th className="px-4 py-3">{t('library.book')}</th>
                                <th className="px-4 py-3">{t('library.borrower')}</th>
                                <th className="px-4 py-3 text-right">{t('library.charged')}</th>
                                <th className="px-4 py-3 text-right">{t('library.paid')}</th>
                                <th className="px-4 py-3 text-right">{t('library.waived')}</th>
                                <th className="px-4 py-3">{t('library.method')}</th>
                                <th className="px-4 py-3">{t('library.collectedAt')}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {data?.data?.map((r: any) => (
                                <tr key={r.id} className="border-t border-slate-100 hover:bg-slate-50">
                                    <td className="px-4 py-3">{r.issuance?.book?.title ?? `#${r.issuanceId}`}</td>
                                    <td className="px-4 py-3">
                                        {r.issuance?.borrowerType === 'STUDENT'
                                            ? r.issuance.student ? `${r.issuance.student.firstName} ${r.issuance.student.lastName}` : '—'
                                            : r.issuance?.staff ? `${r.issuance.staff.firstName} ${r.issuance.staff.lastName}` : '—'}
                                    </td>
                                    <td className="px-4 py-3 text-right">₹{r.lateFeeCharged}</td>
                                    <td className="px-4 py-3 text-right text-green-600">₹{r.amountPaid}</td>
                                    <td className="px-4 py-3 text-right text-amber-600">₹{r.amountWaived}</td>
                                    <td className="px-4 py-3">{r.paymentMethod ?? '—'}</td>
                                    <td className="px-4 py-3 text-xs">{r.collectedAt ? fmtTs(r.collectedAt) : '—'}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    {data && (
                        <div className="flex items-center justify-center gap-1 p-3 border-t">
                            <button disabled={page === 1} onClick={() => { setPage(p => p - 1); load(page - 1); }} className="px-2 py-1 rounded border text-sm disabled:opacity-40">‹</button>
                            <span className="text-sm text-slate-600 px-2">{t('filter.pageOf', { page, total: Math.ceil((data.total ?? 0) / LIMIT) || 1 })}</span>
                            <button disabled={page >= Math.ceil((data.total ?? 0) / LIMIT)} onClick={() => { setPage(p => p + 1); load(page + 1); }} className="px-2 py-1 rounded border text-sm disabled:opacity-40">›</button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

// ── Inventory (used inside reports page) ───────────────────────────────────
// The full inventory report set (Sales / Payments / Outstanding / Waived Off /
// Borrow-Issue / Stock, each with its own filters and CSV+PDF export) lives at
// its own dedicated screen rather than duplicated inline here — this is a
// summary teaser plus a way in, matching how a school actually reaches it: the
// Inventory module in the sidebar, of which reports are one tab.

interface InventorySummaryTeaser {
    salesCount: number;
    salesValue: number;
    collected: number;
    outstanding: number;
    waived: number;
    lowStockCount: number;
}

function InventoryReportsTeaser() {
    const t = useTranslations("reports");
    const tc = useTranslations("common");
    const locale = useLocale();
    const [summary, setSummary] = useState<InventorySummaryTeaser | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        authFetch(`${API_BASE_URL}/inventory/reports/summary`)
            .then((r) => (r.ok ? r.json() : null))
            .then((data) => setSummary(data))
            .catch(() => {})
            .finally(() => setLoading(false));
    }, []);

    const tile = (label: string, value: string, tone: string) => (
        <div className="bg-white rounded-xl border border-slate-200 p-4">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{label}</p>
            <p className={`mt-1 text-2xl font-bold ${tone}`}>{value}</p>
        </div>
    );

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-slate-800">{t('inventory.heading')}</h2>
                <Link
                    href="/dashboard/inventory/reports"
                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white text-sm font-semibold rounded-lg transition-colors"
                >
                    {t('inventory.openFull')}
                </Link>
            </div>
            {loading ? (
                <p className="text-sm text-slate-500">{tc('state.loading')}</p>
            ) : !summary ? (
                <p className="text-sm text-slate-500">{t('inventory.loadFailed')}</p>
            ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                    {tile(t('inventory.sales'), String(summary.salesCount), 'text-slate-800')}
                    {tile(t('inventory.salesValue'), `₹${Number(summary.salesValue).toLocaleString(INTL_LOCALE[locale])}`, 'text-slate-800')}
                    {tile(t('inventory.collected'), `₹${Number(summary.collected).toLocaleString(INTL_LOCALE[locale])}`, 'text-green-700')}
                    {tile(t('inventory.outstanding'), `₹${Number(summary.outstanding).toLocaleString(INTL_LOCALE[locale])}`, 'text-amber-600')}
                    {tile(t('inventory.lowStock'), String(summary.lowStockCount), summary.lowStockCount > 0 ? 'text-red-600' : 'text-slate-800')}
                </div>
            )}
            <p className="text-xs text-slate-500">
                {t('inventory.note')}
            </p>
        </div>
    );
}

export default function ReportsDashboard() {
    const router = useRouter();
    const rbac = useRbac();
    const t = useTranslations("reports");
    const tc = useTranslations("common");
    const locale = useLocale();
    const intlLocale = INTL_LOCALE[locale];
    const monthLabel = (m: number) => new Intl.DateTimeFormat(intlLocale, { month: 'long' }).format(new Date(2000, m - 1, 1));
    const [mounted, setMounted] = useState(false);
    const [activeTab, setActiveTab] = useState<'FEES' | 'PENDING_DUES' | 'FEE_RECEIVED' | 'EXAMINATIONS' | 'ATTENDANCE' | 'STUDENTS' | 'STAFF' | 'SALARY' | 'LIBRARY_FEES' | 'INVENTORY'>('FEES');

    // HR Portal
    const [hrPortalEnabled, setHrPortalEnabled] = useState(false);
    const [libraryEnabled, setLibraryEnabled] = useState(false);
    const [inventoryEnabled, setInventoryEnabled] = useState(false);
    const [salaryYear, setSalaryYear] = useState(new Date().getFullYear());
    const [salaryData, setSalaryData] = useState<PayrollMonthlySummary[]>([]);

    // Staff attendance for today — the same figures /dashboard already shows,
    // read here as a breakdown rather than a row of counters.
    const [staffAttendanceSummary, setStaffAttendanceSummary] = useState<AttendanceTodaySummary | null>(null);
    const [staffAttendanceError, setStaffAttendanceError] = useState(false);

    // FILTERS
    const [academicSessions, setAcademicSessions] = useState<any[]>([]);
    const [examTerms, setExamTerms] = useState<any[]>([]);

    const [feeCollectionSession, setFeeCollectionSession] = useState('');
    const [collectionStatusSession, setCollectionStatusSession] = useState('');
    const [collectionPendingMonth, setCollectionPendingMonth] = useState((new Date().getMonth() + 1).toString());
    const [feeAdjustmentsFromDate, setFeeAdjustmentsFromDate] = useState(todayLocalDate());
    const [feeAdjustmentsToDate, setFeeAdjustmentsToDate] = useState(todayLocalDate());
    const [waivedOffTrendSession, setWaivedOffTrendSession] = useState('');

    const [selectedExamYear, setSelectedExamYear] = useState('');
    const [selectedExamTerm, setSelectedExamTerm] = useState('');
    const [selectedExamClass, setSelectedExamClass] = useState('');
    const [classes, setClasses] = useState<any[]>([]);
    const [availableSections, setAvailableSections] = useState<any[]>([]);
    const [selectedExamSection, setSelectedExamSection] = useState('');

    const [attendanceSession, setAttendanceSession] = useState('');
    const [attendanceMonth, setAttendanceMonth] = useState((new Date().getMonth() + 1).toString());
    const [attendanceFromDate, setAttendanceFromDate] = useState(todayLocalDate());
    const [attendanceToDate, setAttendanceToDate] = useState(todayLocalDate());

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
    const [pendingHasSearched, setPendingHasSearched] = useState(false);

    // Pagination for pending dues
    const [pendingDuesPage, setPendingDuesPage] = useState(1);
    const PENDING_DUES_PER_PAGE = 20;

    // Pagination for adjustments
    const [feeAdjPage, setFeeAdjPage] = useState(1);
    const FEE_ADJ_PER_PAGE = 10;

    // Fee Received Filters
    const [receivedSessionId, setReceivedSessionId] = useState('');
    const [receivedFromDate, setReceivedFromDate] = useState(todayLocalDate());
    const [receivedToDate, setReceivedToDate] = useState(todayLocalDate());
    const [receivedClassId, setReceivedClassId] = useState('');
    const [receivedAvailableSections, setReceivedAvailableSections] = useState<any[]>([]);
    const [receivedSectionId, setReceivedSectionId] = useState('');
    const [receivedSearchQuery, setReceivedSearchQuery] = useState('');
    const [receivedMobile, setReceivedMobile] = useState('');
    const [receivedMethod, setReceivedMethod] = useState('');
    const [receivedData, setReceivedData] = useState<any[]>([]);
    const [receivedLoading, setReceivedLoading] = useState(false);
    
    const [receivedHasSearched, setReceivedHasSearched] = useState(false);

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
    const [attendanceTrend, setAttendanceTrend] = useState<AttendanceTrendPoint[]>([]);
    const [staffDistribution, setStaffDistribution] = useState([]);
    const [enrollmentClass, setEnrollmentClass] = useState([]);
    const collectionStatusWithFill = collectionStatus.map((entry, index) => ({
        ...entry,
        name: entry.name === 'Collected' ? t('fees.collected') : entry.name === 'Pending Dues' ? t('fees.pendingDues') : entry.name,
        fill: categorical(index),
    }));
    const staffDistributionWithFill = staffDistribution.map((entry: any, index: number) => ({ ...entry, fill: categorical(index) }));

    // Colours come from ATTENDANCE_TONE so this donut, the staff calendar and its
    // legend can't drift apart. Zero-value slices are dropped — recharts still
    // renders a label for them, which litters the ring with "0"s.
    const staffAttendanceChartData = staffAttendanceSummary
        ? [
              { name: tc('status.present'), value: staffAttendanceSummary.summary.PRESENT, fill: ATTENDANCE_TONE.PRESENT.fill },
              // `lateArrivals`, not `summary.LATE` — the latter is a legacy bucket
              // that auto-compute no longer writes, so it trends to 0 regardless.
              { name: tc('status.late'), value: staffAttendanceSummary.lateArrivals, fill: ATTENDANCE_TONE.LATE.fill },
              { name: tc('status.halfDay'), value: staffAttendanceSummary.summary.HALF_DAY, fill: ATTENDANCE_TONE.HALF_DAY.fill },
              { name: tc('status.onLeave'), value: staffAttendanceSummary.summary.ON_LEAVE, fill: ATTENDANCE_TONE.LEAVE.fill },
              { name: tc('status.absent'), value: staffAttendanceSummary.summary.ABSENT, fill: ATTENDANCE_TONE.ABSENT.fill },
              { name: tc('status.holiday'), value: staffAttendanceSummary.summary.HOLIDAY, fill: ATTENDANCE_TONE.HOLIDAY.fill },
              // Grey by elimination: sage, marigold, iris, lapis, vermilion and brass
              // are all claimed above, and every other hue tried read as a near
              // neighbour of one of them — teal beside Present, magenta beside Absent.
              { name: t('staff.notMarked'), value: staffAttendanceSummary.summary.NOT_MARKED ?? 0, fill: 'var(--color-ink-faint)' },
          ].filter((d) => d.value > 0)
        : [];
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
                    setClasses(sortByName(data));
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

    // HR PORTAL feature flag
    useEffect(() => {
        authFetch(`${API_BASE_URL}/school/features`)
            .then((r) => r.ok ? r.json() : null)
            .then((data) => { if (data?.hr_portal) setHrPortalEnabled(true); if (data?.library_management) setLibraryEnabled(true); if (data?.inventory_management) setInventoryEnabled(true); })
            .catch(() => {});
    }, []);

    // Staff attendance donut — HR-only data, so don't even ask for it unless the
    // school has the HR Portal; the request would just 403.
    useEffect(() => {
        if (activeTab !== 'STAFF' || !hrPortalEnabled) return;
        setStaffAttendanceError(false);
        attendanceSettingsApi
            .todaySummary()
            .then(setStaffAttendanceSummary)
            .catch(() => setStaffAttendanceError(true));
    }, [activeTab, hrPortalEnabled]);

    // SALARY
    useEffect(() => {
        if (activeTab !== 'SALARY' || !hrPortalEnabled) return;
        hrApi.payroll.monthlySummary(salaryYear)
            .then((data) => setSalaryData(data))
            .catch((e) => { console.error(e); toast.error(t('salary.loadFailed')); });
    }, [activeTab, salaryYear, hrPortalEnabled, t]);

    // PENDING DUES - manual fetch (triggered by Apply Filters button)
    const fetchPendingDues = async () => {
        if (!pendingSessionId) {
            toast.error(t('filter.selectSessionFirst'));
            return;
        }
        setPendingDuesLoading(true);
        setPendingHasSearched(true);
        setPendingDuesPage(1);
        setSelectedPendingStudents([]);
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
                toast.error(t('pending.fetchFailed'));
            }
        } catch (e) {
            console.error(e);
            toast.error(t('pending.fetchError'));
        } finally {
            setPendingDuesLoading(false);
        }
    };

    // FEE RECEIVED - manual fetch (triggered by Apply Filters button)
    const fetchFeeReceived = async (pageOverride?: number) => {
        if (!receivedSessionId) {
            toast.error(t('filter.selectSessionFirst'));
            return;
        }
        const page = pageOverride ?? receivedPage;
        setReceivedLoading(true);
        if (!pageOverride) {
            setReceivedHasSearched(true);
            setReceivedPage(1);
        }
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
            if (receivedMethod) query += `&paymentMethod=${receivedMethod}`;

            query += `&page=${pageOverride ?? 1}&limit=${RECEIVED_PER_PAGE}`;

            const res = await authFetch(`${API_BASE_URL}/fees/reports/fee-received${query}`);
            if (res.ok) {
                const data = await res.json();
                setReceivedData(data.data || []);
                setReceivedTotalCount(data.totalCount || 0);
                if (!pageOverride) setReceivedPage(1);
            } else {
                toast.error(t('received.fetchFailed'));
            }
        } catch (e) {
            console.error(e);
            toast.error(t('received.fetchError'));
        } finally {
            setReceivedLoading(false);
        }
    };

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
            toast.error(t('filter.noDataToExport'));
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
            if (receivedMethod) query += `&paymentMethod=${receivedMethod}`;
            
            // Limit 0 indicates we want to fetch the whole set matching filters
            query += `&page=1&limit=0`;

            const res = await authFetch(`${API_BASE_URL}/fees/reports/fee-received${query}`);
            if (res.ok) {
                const json = await res.json();
                const bulkData = json.data || [];
                
                if (bulkData.length === 0) {
                    toast.error(t('filter.noDataToExport'));
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
                toast.error(t('received.exportBulkFailed'));
            }
        } catch (e) {
            console.error(e);
            toast.error(t('received.exportFailed'));
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
                toast.success(t('notify.sent'));
                setShowNotifModal(false);
                setUseCustomMessage(false);
                setCustomNotifMessage('');
            } else {
                const errData = await res.json();
                toast.error(errData.message || t('notify.sendFailed'));
            }
        } catch (e) {
            console.error("Notification Error:", e);
            toast.error(t('notify.sendError'));
        } finally {
            setSendingNotif(false);
        }
    };

    useEffect(() => {
        if (mounted && !rbac.isAdmin) {
            toast.error(t('noPermission'));
            router.replace('/dashboard');
        }
    }, [mounted, rbac.isAdmin, router, t]);

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
                <h1 className="font-display text-[22px] sm:text-[26px] font-semibold tracking-[-0.02em] text-ink">{t('heading')}</h1>
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
                    {t('tabs.fees')}
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
                    {t('tabs.feeReceived')}
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
                    {t('tabs.pendingDues')}
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
                    {t('tabs.examinations')}
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
                    {t('tabs.attendance')}
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
                    {t('tabs.students')}
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
                    {t('tabs.staff')}
                </button>
                {hrPortalEnabled && (
                    <button
                        onClick={() => setActiveTab('SALARY')}
                        className={`flex items-center gap-2 px-5 py-2.5 text-sm font-medium rounded-lg whitespace-nowrap transition-all duration-200 ${
                            activeTab === 'SALARY'
                                ? "bg-white text-blue-700 shadow-sm ring-1 ring-black/5"
                                : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/50"
                        }`}
                    >
                        <Wallet className="w-4 h-4" />
                        {t('tabs.salary')}
                    </button>
                )}
                {libraryEnabled && (
                    <button
                        onClick={() => setActiveTab('LIBRARY_FEES')}
                        className={`flex items-center gap-2 px-5 py-2.5 text-sm font-medium rounded-lg whitespace-nowrap transition-all duration-200 ${
                            activeTab === 'LIBRARY_FEES'
                                ? "bg-white text-lime-700 shadow-sm ring-1 ring-black/5"
                                : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/50"
                        }`}
                    >
                        <Download className="w-4 h-4" />
                        {t('tabs.libraryFees')}
                    </button>
                )}
                {inventoryEnabled && (
                    <button
                        onClick={() => setActiveTab('INVENTORY')}
                        className={`flex items-center gap-2 px-5 py-2.5 text-sm font-medium rounded-lg whitespace-nowrap transition-all duration-200 ${
                            activeTab === 'INVENTORY'
                                ? "bg-white text-orange-700 shadow-sm ring-1 ring-black/5"
                                : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/50"
                        }`}
                    >
                        <Boxes className="w-4 h-4" />
                        {t('tabs.inventory')}
                    </button>
                )}
            </div>

            {/* TAB CONTENT: FEES */}
            {activeTab === 'FEES' && (
                <div className="space-y-6">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Monthly Collection Chart */}
                        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                            <div className="flex justify-between items-center mb-4">
                                <h2 className="text-lg font-bold text-slate-800">{t('fees.monthlyTrend')}</h2>
                                <select 
                                    className="border-gray-300 rounded-lg shadow-sm focus:ring-brand/40 focus:border-brand text-sm p-2 bg-gray-50"
                                    value={feeCollectionSession}
                                    onChange={(e) => setFeeCollectionSession(e.target.value)}
                                >
                                    <option value="">{t('filter.selectSession')}</option>
                                    {academicSessions.map(session => (
                                        <option key={session.id} value={session.id.toString()}>{session.name}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="h-72">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={monthlyCollection}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={CHART_GRID} />
                                        <XAxis dataKey="month" axisLine={false} tickLine={false} tick={CHART_TICK} />
                                        <YAxis axisLine={false} tickLine={false} tick={CHART_TICK} tickFormatter={(val) => `₹${val/1000}k`} />
                                        <Tooltip {...CHART_TOOLTIP} formatter={(val: any) => `₹${val.toLocaleString(intlLocale)}`} cursor={CHART_CURSOR} />
                                        <Legend />
                                        <Bar dataKey="collected" name={t('fees.collected')} fill={SERIES.settled} radius={[4,4,0,0]} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>

                        {/* Collection vs Pending */}
                        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex flex-col">
                            <div className="flex justify-between items-start mb-2">
                                <div>
                                    <h2 className="text-lg font-bold text-slate-800">{t('fees.collectionVsPending')}</h2>
                                    <p className="text-sm text-gray-500 mt-1 max-w-md">
                                        {t.rich('fees.collectionVsPendingHint', { b: (c) => <strong>{c}</strong> })}
                                    </p>
                                </div>
                            </div>
                            
                            {/* min-h, not h: `flex-1` sets flex-basis:0% which overrides
                                `height` on a column flex container's main axis. On lg the
                                card is a stretched grid item so there was space to grow
                                into, but at grid-cols-1 the card is auto-height, free
                                space is 0, and the chart collapsed to nothing on mobile.
                                min-height isn't overridden, so it survives both. */}
                            <div className="min-h-72 flex-1 mt-4 relative">
                                {collectionStatus.every((d) => d.value === 0) ? (
                                    <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-400">
                                        <svg className="w-12 h-12 mb-2 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"></path></svg>
                                        <p>{t('fees.noFeeData')}</p>
                                    </div>
                                ) : (
                                    <ResponsiveContainer width="100%" height="100%">
                                        <PieChart>
                                            {/* `minAngle`, and a smaller gap: with paddingAngle 5,
                                                a slice whose own angle was under ~5° had the
                                                padding eat the entire sector, so a month where
                                                collection was small next to outstanding dues drew
                                                the blue arc as a bare gap in the ring — the legend
                                                said "Collected" in blue and nothing on the chart
                                                was blue. minAngle keeps a small slice honest-ish
                                                but visible; exact figures are in the tooltip.
                                                <Cell> makes the per-slice colour explicit rather
                                                than relying on recharts reading `fill` off the datum. */}
                                            <Pie
                                                data={collectionStatusWithFill}
                                                innerRadius={70}
                                                outerRadius={100}
                                                paddingAngle={2}
                                                minAngle={6}
                                                dataKey="value"
                                            >
                                                {collectionStatusWithFill.map((entry: any, i: number) => (
                                                    <Cell key={i} fill={entry.fill} />
                                                ))}
                                            </Pie>
                                            <Tooltip {...CHART_TOOLTIP} formatter={(val: any) => `₹${val.toLocaleString(intlLocale)}`} />
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
                                    <h2 className="text-lg font-bold text-slate-800">{t('fees.adjustmentsTitle')}</h2>
                                    <p className="text-sm text-gray-500">{t('fees.adjustmentsHint')}</p>
                                </div>
                                <div className="flex items-center gap-2 flex-wrap">
                                    <div className="w-40">
                                        <AppDatePicker
                                            value={feeAdjustmentsFromDate}
                                            onChange={(from) => {
                                                setFeeAdjustmentsFromDate(from);
                                                if (from) {
                                                    const maxTo = new Date(from);
                                                    maxTo.setDate(maxTo.getDate() + 31);
                                                    const maxToStr = maxTo.toISOString().split('T')[0];
                                                    if (feeAdjustmentsToDate > maxToStr) setFeeAdjustmentsToDate(maxToStr);
                                                    if (feeAdjustmentsToDate < from) setFeeAdjustmentsToDate(from);
                                                }
                                            }}
                                        />
                                    </div>
                                    <span className="text-slate-500 text-sm">{t('filter.to')}</span>
                                    <div className="w-40">
                                        <AppDatePicker
                                            value={feeAdjustmentsToDate}
                                            min={feeAdjustmentsFromDate}
                                            max={feeAdjustmentsFromDate ? (() => { const d = new Date(feeAdjustmentsFromDate); d.setDate(d.getDate() + 31); return d.toISOString().split('T')[0]; })() : undefined}
                                            onChange={(to) => {
                                                const from = feeAdjustmentsFromDate;
                                                const diffDays = (new Date(to).getTime() - new Date(from).getTime()) / (1000 * 60 * 60 * 24);
                                                if (diffDays > 31) { toast.error(t('filter.rangeTooLong')); return; }
                                                if (to < from) { toast.error(t('filter.endBeforeStart')); return; }
                                                setFeeAdjustmentsToDate(to);
                                            }}
                                        />
                                    </div>
                                    <span className="text-xs text-slate-400">{t('fees.max31Days')}</span>
                                    {feeAdjustments.length > 0 && (
                                        <button
                                            onClick={() => {
                                                const header = ['Date', 'Student', 'Type', 'Amount', 'Recorded By', 'Permitted By'];
                                                const rows = feeAdjustments.map((adj: any) => [
                                                    adj.date,
                                                    `"${(adj.student || '').replace(/"/g, '""')}"`,
                                                    adj.type,
                                                    adj.amount,
                                                    `"${(adj.recordedBy || '').replace(/"/g, '""')}"`,
                                                    `"${(adj.permittedBy || '').replace(/"/g, '""')}"`,
                                                ]);
                                                const csv = [header.join(','), ...rows.map(r => r.join(','))].join('\n');
                                                const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
                                                const url = URL.createObjectURL(blob);
                                                const a = document.createElement('a');
                                                a.href = url;
                                                a.download = `fee-adjustments-${feeAdjustmentsFromDate}-to-${feeAdjustmentsToDate}.csv`;
                                                a.click();
                                                URL.revokeObjectURL(url);
                                            }}
                                            className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 transition-colors"
                                        >
                                            <Download className="w-4 h-4" />
                                            {t('filter.csv')}
                                        </button>
                                    )}
                                </div>
                            </div>
                            <div className="overflow-x-auto">
                                <div className="max-h-72 overflow-y-auto">
                                    <table className="w-full text-sm text-left text-gray-600">
                                        <thead className="text-xs text-slate-500 uppercase bg-slate-50 border-b border-gray-200 sticky top-0 z-10">
                                            <tr>
                                                <th className="px-5 py-3 font-semibold">{tc('field.date')}</th>
                                                <th className="px-5 py-3 font-semibold">{tc('field.student')}</th>
                                                <th className="px-5 py-3 font-semibold">{tc('field.type')}</th>
                                                <th className="px-5 py-3 font-semibold text-right">{tc('field.amount')}</th>
                                                <th className="px-5 py-3 font-semibold">{t('fees.recordedBy')}</th>
                                                <th className="px-5 py-3 font-semibold">{t('fees.permittedBy')}</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {feeAdjustments.slice((feeAdjPage - 1) * FEE_ADJ_PER_PAGE, feeAdjPage * FEE_ADJ_PER_PAGE).map((adj) => (
                                                <tr key={adj.id} className="border-b border-gray-100 hover:bg-slate-50/50">
                                                    <td className="px-5 py-3">{adj.date}</td>
                                                    <td className="px-5 py-3 font-medium text-slate-800">{adj.student}</td>
                                                    <td className="px-5 py-3">
                                                        <span className={`px-2 py-1 rounded text-xs font-semibold ${adj.type === 'REFUND' ? 'bg-orange-100 text-orange-700' : 'bg-purple-100 text-purple-700'}`}>
                                                            {adj.type === 'REFUND' ? t('fees.typeRefund') : adj.type === 'WAIVE_OFF' ? t('fees.typeWaiveOff') : adj.type}
                                                        </span>
                                                    </td>
                                                    <td className="px-5 py-3 text-right font-semibold">₹{adj.amount}</td>
                                                    <td className="px-5 py-3 text-gray-500">{adj.recordedBy}</td>
                                                    <td className="px-5 py-3 text-gray-500">{adj.permittedBy || '—'}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                                {feeAdjustments.length === 0 && (
                                    <div className="p-4 text-center text-gray-500">{t('fees.noAdjustments')}</div>
                                )}
                                {feeAdjustments.length > 0 && (
                                    <div className="p-4 border-t border-gray-200 flex justify-between items-center bg-gray-50">
                                        <span className="text-sm text-gray-500">
                                            {t('fees.showingRange', { from: (feeAdjPage - 1) * FEE_ADJ_PER_PAGE + 1, to: Math.min(feeAdjPage * FEE_ADJ_PER_PAGE, feeAdjustments.length), total: feeAdjustments.length })}
                                        </span>
                                        <div className="flex gap-2">
                                            <button 
                                                className="px-3 py-1 border border-gray-300 rounded bg-white text-gray-600 hover:bg-gray-50 disabled:opacity-50"
                                                disabled={feeAdjPage === 1}
                                                onClick={() => setFeeAdjPage(p => p - 1)}
                                            >
                                                {tc('action.previous')}
                                            </button>
                                            <button 
                                                className="px-3 py-1 border border-gray-300 rounded bg-white text-gray-600 hover:bg-gray-50 disabled:opacity-50"
                                                disabled={feeAdjPage * FEE_ADJ_PER_PAGE >= feeAdjustments.length}
                                                onClick={() => setFeeAdjPage(p => p + 1)}
                                            >
                                                {tc('action.next')}
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
                                    <h2 className="text-lg font-bold text-slate-800">{t('fees.waivedTrendTitle')}</h2>
                                    <p className="text-sm text-gray-500">{t('fees.waivedTrendHint')}</p>
                                </div>
                                <select 
                                    className="border-gray-300 rounded-lg shadow-sm focus:ring-brand/40 focus:border-brand text-sm p-2 bg-gray-50"
                                    value={waivedOffTrendSession}
                                    onChange={(e) => setWaivedOffTrendSession(e.target.value)}
                                >
                                    <option value="">{t('filter.selectSession')}</option>
                                    {academicSessions.map(session => (
                                        <option key={session.id} value={session.id.toString()}>{session.name}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="h-72 p-5">
                                <ResponsiveContainer width="100%" height="100%">
                                    <LineChart data={waivedOffTrend}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={CHART_GRID} />
                                        <XAxis dataKey="month" axisLine={false} tickLine={false} tick={CHART_TICK} />
                                        <YAxis axisLine={false} tickLine={false} tick={CHART_TICK} tickFormatter={(val) => `₹${val/1000}k`} />
                                        <Tooltip {...CHART_TOOLTIP} formatter={(val: any) => `₹${val.toLocaleString(intlLocale)}`} />
                                        <Legend />
                                        <Line type="monotone" dataKey="waivedOff" name={t('fees.waivedTrendSeries')} stroke={SERIES.correction} strokeWidth={3} dot={{r: 4, fill: SERIES.correction}} />
                                        <Line type="monotone" dataKey="pending" name={t('fees.pendingTrendSeries')} stroke={SERIES.attention} strokeWidth={3} dot={{r: 4, fill: SERIES.attention}} />
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
                                <h2 className="text-xl font-bold text-slate-800">{t('pending.title')}</h2>
                                <p className="text-sm text-gray-500">{t('pending.hint')}</p>
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
                                    {t('pending.notifySelected')}
                                </button>
                                <button
                                    onClick={exportToCSV}
                                    disabled={displayedPendingDuesAll.length === 0}
                                    className="bg-emerald-600 text-white px-4 py-2 rounded shadow hover:bg-emerald-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 justify-center"
                                >
                                    <Download className="w-4 h-4" />
                                    {t('filter.downloadCsv')}
                                </button>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-7 gap-4 mb-6">
                            <div>
                                <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">{t('filter.session')}</label>
                                <select
                                    className="w-full border-gray-300 rounded-lg shadow-sm focus:ring-brand/40 focus:border-brand text-sm p-2 bg-gray-50"
                                    value={pendingSessionId}
                                    onChange={(e) => setPendingSessionId(e.target.value)}
                                >
                                    <option value="">{t('filter.selectSession')}</option>
                                    {academicSessions.map(session => (
                                        <option key={session.id} value={session.id.toString()}>{session.name}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">{tc('field.class')}</label>
                                <select
                                    className="w-full border-gray-300 rounded-lg shadow-sm focus:ring-brand/40 focus:border-brand text-sm p-2 bg-gray-50"
                                    value={pendingClassId}
                                    onChange={(e) => {
                                        setPendingClassId(e.target.value);
                                        setPendingSectionId('');
                                        const cls = classes.find(c => c.id.toString() === e.target.value);
                                        setPendingAvailableSections(cls ? cls.sections : []);
                                    }}
                                >
                                    <option value="">{t('filter.allClasses')}</option>
                                    {classes.map((cls: any) => (
                                        <option key={cls.id} value={cls.id.toString()}>{cls.name}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">{tc('field.section')}</label>
                                <select
                                    className="w-full border-gray-300 rounded-lg shadow-sm focus:ring-brand/40 focus:border-brand text-sm p-2 bg-gray-50 disabled:opacity-50"
                                    value={pendingSectionId}
                                    onChange={(e) => setPendingSectionId(e.target.value)}
                                    disabled={!pendingClassId}
                                >
                                    <option value="">{t('filter.allSections')}</option>
                                    {pendingAvailableSections.map((sec: any) => (
                                        <option key={sec.id} value={sec.id.toString()}>{sec.name}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="lg:col-span-2">
                                <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">{t('pending.searchStudent')}</label>
                                <input
                                    type="text"
                                    placeholder={t('pending.searchPlaceholder')}
                                    className="w-full border-gray-300 rounded-lg shadow-sm focus:ring-brand/40 focus:border-brand text-sm p-2 bg-gray-50"
                                    value={pendingSearchQuery}
                                    onChange={(e) => setPendingSearchQuery(e.target.value)}
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">{t('filter.mobileNo')}</label>
                                <input
                                    type="text"
                                    placeholder={t('filter.mobilePlaceholder')}
                                    className="w-full border-gray-300 rounded-lg shadow-sm focus:ring-brand/40 focus:border-brand text-sm p-2 bg-gray-50"
                                    value={pendingMobile}
                                    onChange={(e) => setPendingMobile(e.target.value)}
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">{t('filter.month')}</label>
                                <select 
                                    className="w-full border-gray-300 rounded-lg shadow-sm focus:ring-brand/40 focus:border-brand text-sm p-2 bg-gray-50"
                                    value={pendingMonth}
                                    onChange={(e) => setPendingMonth(e.target.value)}
                                >
                                    <option value="">{t('pending.wholeSession')}</option>
                                    {SESSION_MONTHS.map((m) => (
                                        <option key={m} value={m}>{monthLabel(m)}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <div className="flex justify-end mb-4">
                            <button
                                onClick={fetchPendingDues}
                                disabled={!pendingSessionId}
                                className="bg-blue-600 text-white px-6 py-2 rounded-lg shadow hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                            >
                                {t('filter.applyFilters')}
                            </button>
                        </div>

                        {!pendingHasSearched ? (
                            <div className="border border-dashed border-slate-300 rounded-lg p-12 text-center text-slate-400">
                                <svg className="w-12 h-12 mx-auto mb-3 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2a1 1 0 01-.293.707L13 13.414V19a1 1 0 01-.553.894l-4 2A1 1 0 017 21v-7.586L3.293 6.707A1 1 0 013 6V4z"/></svg>
                                <p className="text-sm font-medium">{t.rich('pending.emptyPrompt', { b: (c) => <span className="text-blue-600 font-semibold">{c}</span> })}</p>
                            </div>
                        ) : (
                        <>
                        <div className="overflow-x-auto border border-gray-200 rounded-lg max-h-150 overflow-y-auto">
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
                                                    className="w-4 h-4 text-indigo-600 bg-gray-100 border-gray-300 rounded focus:ring-brand/40 focus:ring-2"
                                                />
                                            </th>
                                            <th className="px-5 py-3 font-semibold cursor-pointer hover:bg-slate-100 group select-none" onClick={() => handlePendingSort('studentId')}>
                                                <div className="flex items-center gap-1">
                                                    {t('column.studentId')}{' '}
                                                    <span className="text-gray-400 text-xs">
                                                        {pendingSortColumn === 'studentId' ? (pendingSortDirection === 'asc' ? '↑' : '↓') : <span className="opacity-0 group-hover:opacity-50">↕</span>}
                                                    </span>
                                                </div>
                                            </th>
                                            <th className="px-5 py-3 font-semibold cursor-pointer hover:bg-slate-100 group select-none" onClick={() => handlePendingSort('rollNo')}>
                                                <div className="flex items-center gap-1">
                                                    {t('column.rollNo')}{' '}
                                                    <span className="text-gray-400 text-xs">
                                                        {pendingSortColumn === 'rollNo' ? (pendingSortDirection === 'asc' ? '↑' : '↓') : <span className="opacity-0 group-hover:opacity-50">↕</span>}
                                                    </span>
                                                </div>
                                            </th>
                                            <th className="px-5 py-3 font-semibold cursor-pointer hover:bg-slate-100 group select-none" onClick={() => handlePendingSort('firstName')}>
                                                <div className="flex items-center gap-1">
                                                    {tc('field.name')}{' '}
                                                    <span className="text-gray-400 text-xs">
                                                        {pendingSortColumn === 'firstName' ? (pendingSortDirection === 'asc' ? '↑' : '↓') : <span className="opacity-0 group-hover:opacity-50">↕</span>}
                                                    </span>
                                                </div>
                                            </th>
                                            <th className="px-5 py-3 font-semibold cursor-pointer hover:bg-slate-100 group select-none" onClick={() => handlePendingSort('className')}>
                                                <div className="flex items-center gap-1">
                                                    {tc('field.class')}{' '}
                                                    <span className="text-gray-400 text-xs">
                                                        {pendingSortColumn === 'className' ? (pendingSortDirection === 'asc' ? '↑' : '↓') : <span className="opacity-0 group-hover:opacity-50">↕</span>}
                                                    </span>
                                                </div>
                                            </th>
                                            <th className="px-5 py-3 font-semibold cursor-pointer hover:bg-slate-100 group select-none" onClick={() => handlePendingSort('sectionName')}>
                                                <div className="flex items-center gap-1">
                                                    {tc('field.section')}{' '}
                                                    <span className="text-gray-400 text-xs">
                                                        {pendingSortColumn === 'sectionName' ? (pendingSortDirection === 'asc' ? '↑' : '↓') : <span className="opacity-0 group-hover:opacity-50">↕</span>}
                                                    </span>
                                                </div>
                                            </th>
                                            <th className="px-5 py-3 font-semibold cursor-pointer hover:bg-slate-100 group select-none" onClick={() => handlePendingSort('mobile')}>
                                                <div className="flex items-center gap-1">
                                                    {tc('field.mobile')}{' '}
                                                    <span className="text-gray-400 text-xs">
                                                        {pendingSortColumn === 'mobile' ? (pendingSortDirection === 'asc' ? '↑' : '↓') : <span className="opacity-0 group-hover:opacity-50">↕</span>}
                                                    </span>
                                                </div>
                                            </th>
                                            <th className="px-5 py-3 font-semibold cursor-pointer hover:bg-slate-100 group select-none" onClick={() => handlePendingSort('pendingAmount')}>
                                                <div className="flex items-center justify-end gap-1">
                                                    {t('pending.pendingAmount')}{' '}
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
                                                            className="w-4 h-4 text-indigo-600 bg-gray-100 border-gray-300 rounded focus:ring-brand/40 focus:ring-2"
                                                        />
                                                    </td>
                                                    <td className="px-5 py-3 font-medium text-blue-600">{row.studentId}</td>
                                                    <td className="px-5 py-3">{row.rollNo || '-'}</td>
                                                    <td className="px-5 py-3 font-semibold text-slate-800">{row.firstName} {row.lastName}</td>
                                                    <td className="px-5 py-3">{row.className}</td>
                                                    <td className="px-5 py-3">{row.sectionName}</td>
                                                    <td className="px-5 py-3">{row.mobile}</td>
                                                    <td className="px-5 py-3 text-right font-bold text-red-600">₹{row.pendingAmount.toLocaleString(intlLocale)}</td>
                                                </tr>
                                            ))
                                        ) : (
                                            <tr>
                                                <td colSpan={8} className="p-8 text-center text-gray-500">
                                                    {t('pending.noResults')}
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                    {paginatedPendingDues.length > 0 && (
                                        <tfoot className="bg-slate-50 border-t border-gray-200 font-bold text-slate-800 sticky bottom-0">
                                            <tr>
                                                <td colSpan={7} className="px-5 py-3 text-right uppercase text-xs text-slate-500">{t('pending.totalPending')}</td>
                                                <td className="px-5 py-3 text-right text-red-600 text-lg">
                                                    ₹{displayedPendingDuesAll.reduce((sum, row) => sum + row.pendingAmount, 0).toLocaleString(intlLocale)}
                                                </td>
                                            </tr>
                                        </tfoot>
                                    )}
                                </table>
                            )}
                        </div>

                        {/* Pending Dues Pagination Controls */}
                        {displayedPendingDuesAll.length > 0 && (
                            <div className="p-4 border-t border-slate-100 flex items-center justify-between bg-slate-50/50 mt-4 rounded-lg">
                                <div className="text-sm text-slate-500">
                                    {t.rich('pending.showingStudents', {
                                        from: (pendingDuesPage - 1) * PENDING_DUES_PER_PAGE + 1,
                                        to: Math.min(pendingDuesPage * PENDING_DUES_PER_PAGE, displayedPendingDuesAll.length),
                                        total: displayedPendingDuesAll.length,
                                        b: (c) => <span className="font-medium text-slate-900">{c}</span>,
                                    })}
                                </div>
                                <div className="flex gap-2">
                                    <button 
                                        onClick={() => setPendingDuesPage(p => Math.max(1, p - 1))}
                                        disabled={pendingDuesPage === 1}
                                        className="px-3 py-1 border border-slate-200 rounded text-sm disabled:opacity-50 bg-white hover:bg-slate-50 transition"
                                    >
                                        {tc('action.previous')}
                                    </button>
                                    <span className="px-3 py-1 text-sm flex items-center">
                                        {t('filter.pageOf', { page: pendingDuesPage, total: totalPendingPages || 1 })}
                                    </span>
                                    <button 
                                        onClick={() => setPendingDuesPage(p => Math.min(totalPendingPages, p + 1))}
                                        disabled={pendingDuesPage === totalPendingPages || totalPendingPages === 0}
                                        className="px-3 py-1 border border-slate-200 rounded text-sm disabled:opacity-50 bg-white hover:bg-slate-50 transition"
                                    >
                                        {tc('action.next')}
                                    </button>
                                </div>
                            </div>
                        )}
                        </>
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
                                <h2 className="text-xl font-bold text-slate-800">{t('received.title')}</h2>
                                <p className="text-sm text-gray-500">{t('received.hint')}</p>
                            </div>
                            <div className="flex flex-col sm:flex-row gap-2">
                                <button
                                    onClick={exportFeeReceivedCSV}
                                    disabled={!receivedHasSearched || receivedData.length === 0}
                                    className="bg-emerald-600 text-white px-4 py-2 rounded shadow hover:bg-emerald-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 justify-center"
                                >
                                    <Download className="w-4 h-4" />
                                    {t('filter.downloadCsv')}
                                </button>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                            <div>
                                <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">{t('filter.session')}</label>
                                <select
                                    className="w-full border-gray-300 rounded-lg shadow-sm focus:ring-brand/40 focus:border-brand text-sm p-2 bg-gray-50"
                                    value={receivedSessionId}
                                    onChange={(e) => setReceivedSessionId(e.target.value)}
                                >
                                    <option value="">{t('filter.selectSession')}</option>
                                    {academicSessions.map(session => (
                                        <option key={session.id} value={session.id.toString()}>{session.name}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">{tc('field.class')}</label>
                                <select
                                    className="w-full border-gray-300 rounded-lg shadow-sm focus:ring-brand/40 focus:border-brand text-sm p-2 bg-gray-50"
                                    value={receivedClassId}
                                    onChange={(e) => {
                                        setReceivedClassId(e.target.value);
                                        setReceivedSectionId('');
                                        const cls = classes.find(c => c.id.toString() === e.target.value);
                                        setReceivedAvailableSections(cls ? cls.sections : []);
                                    }}
                                >
                                    <option value="">{t('filter.allClasses')}</option>
                                    {classes.map((cls: any) => (
                                        <option key={cls.id} value={cls.id.toString()}>{cls.name}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">{tc('field.section')}</label>
                                <select
                                    className="w-full border-gray-300 rounded-lg shadow-sm focus:ring-brand/40 focus:border-brand text-sm p-2 bg-gray-50 disabled:opacity-50"
                                    value={receivedSectionId}
                                    onChange={(e) => setReceivedSectionId(e.target.value)}
                                    disabled={!receivedClassId}
                                >
                                    <option value="">{t('filter.allSections')}</option>
                                    {receivedAvailableSections.map((sec: any) => (
                                        <option key={sec.id} value={sec.id.toString()}>{sec.name}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">{t('column.method')}</label>
                                <select
                                    className="w-full border-gray-300 rounded-lg shadow-sm focus:ring-brand/40 focus:border-brand text-sm p-2 bg-gray-50"
                                    value={receivedMethod}
                                    onChange={(e) => setReceivedMethod(e.target.value)}
                                >
                                    <option value="">{t('received.allMethods')}</option>
                                    <option value="CASH">{t('received.methodCash')}</option>
                                    <option value="UPI">UPI</option>
                                    <option value="ONLINE">{t('received.methodOnline')}</option>
                                    <option value="CARD">{t('received.methodCard')}</option>
                                    <option value="CHEQUE">{t('received.methodCheque')}</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">{t('column.studentId')}</label>
                                <input
                                    type="text"
                                    placeholder={t('received.searchById')}
                                    className="w-full border-gray-300 rounded-lg shadow-sm focus:ring-brand/40 focus:border-brand text-sm p-2 bg-gray-50"
                                    value={receivedSearchQuery}
                                    onChange={(e) => setReceivedSearchQuery(e.target.value)}
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">{t('filter.mobileNo')}</label>
                                <input
                                    type="text"
                                    placeholder={t('filter.mobilePlaceholder')}
                                    className="w-full border-gray-300 rounded-lg shadow-sm focus:ring-brand/40 focus:border-brand text-sm p-2 bg-gray-50"
                                    value={receivedMobile}
                                    onChange={(e) => setReceivedMobile(e.target.value)}
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">{t('received.fromDate')}</label>
                                <AppDatePicker
                                    value={receivedFromDate}
                                    onChange={(from) => {
                                        setReceivedFromDate(from);
                                        if (from && receivedToDate) {
                                            const maxTo = new Date(from);
                                            maxTo.setDate(maxTo.getDate() + 31);
                                            const maxToStr = maxTo.toISOString().split('T')[0];
                                            if (receivedToDate > maxToStr) setReceivedToDate(maxToStr);
                                            if (receivedToDate < from) setReceivedToDate(from);
                                        }
                                    }}
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">{t('received.toDate')} <span className="text-slate-400 font-normal normal-case">{t('received.max31Hint')}</span></label>
                                <AppDatePicker
                                    value={receivedToDate}
                                    min={receivedFromDate || undefined}
                                    max={receivedFromDate ? (() => { const d = new Date(receivedFromDate); d.setDate(d.getDate() + 31); return d.toISOString().split('T')[0]; })() : undefined}
                                    onChange={(to) => {
                                        if (receivedFromDate) {
                                            const diffDays = (new Date(to).getTime() - new Date(receivedFromDate).getTime()) / (1000 * 60 * 60 * 24);
                                            if (diffDays > 31) { toast.error(t('filter.rangeTooLong')); return; }
                                            if (to < receivedFromDate) { toast.error(t('filter.endBeforeStart')); return; }
                                        }
                                        setReceivedToDate(to);
                                    }}
                                />
                            </div>
                        </div>

                        <div className="flex justify-end mb-4">
                            <button
                                onClick={() => fetchFeeReceived()}
                                disabled={!receivedSessionId}
                                className="bg-blue-600 text-white px-6 py-2 rounded-lg shadow hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                            >
                                {t('filter.applyFilters')}
                            </button>
                        </div>

                        {!receivedHasSearched ? (
                            <div className="border border-dashed border-slate-300 rounded-lg p-12 text-center text-slate-400">
                                <svg className="w-12 h-12 mx-auto mb-3 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2a1 1 0 01-.293.707L13 13.414V19a1 1 0 01-.553.894l-4 2A1 1 0 017 21v-7.586L3.293 6.707A1 1 0 013 6V4z"/></svg>
                                <p className="text-sm font-medium">{t.rich('received.emptyPrompt', { b: (c) => <span className="text-blue-600 font-semibold">{c}</span> })}</p>
                            </div>
                        ) : (
                        <>
                        <div className="overflow-x-auto border border-gray-200 rounded-lg max-h-150 overflow-y-auto">
                            {receivedLoading ? (
                                <div className="p-12 flex justify-center">
                                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                                </div>
                            ) : (
                                <table className="w-full text-sm text-left text-gray-600">
                                    <thead className="text-xs text-slate-500 uppercase bg-slate-50 border-b border-gray-200 sticky top-0 z-10 shadow-sm">
                                        <tr>
                                            <th className="px-5 py-3 font-semibold">{t('received.paymentDate')}</th>
                                            <th className="px-5 py-3 font-semibold">{t('received.receiptNo')}</th>
                                            <th className="px-5 py-3 font-semibold">{t('column.studentName')}</th>
                                            <th className="px-5 py-3 font-semibold">{tc('field.class')}</th>
                                            <th className="px-5 py-3 font-semibold">{t('column.method')}</th>
                                            <th className="px-5 py-3 font-semibold">{t('received.feeMonth')}</th>
                                            <th className="px-5 py-3 font-semibold">{t('column.collectedBy')}</th>
                                            <th className="px-5 py-3 font-semibold text-right">{t('received.amountPaid')}</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {receivedData.length > 0 ? (
                                            receivedData.map((row, idx) => (
                                                <tr key={idx} className="border-b border-gray-100 hover:bg-slate-50/50">
                                                    <td className="px-5 py-3">{new Date(row.paymentDate).toLocaleDateString(intlLocale)}</td>
                                                    <td className="px-5 py-3 font-medium text-slate-800">{row.receiptNumber}</td>
                                                    <td className="px-5 py-3">
                                                        {row.firstName} {row.lastName}
                                                        <div className="text-xs text-gray-400">{t('received.idLabel', { id: row.studentId })}</div>
                                                    </td>
                                                    <td className="px-5 py-3">{row.className} {row.sectionName}</td>
                                                    <td className="px-5 py-3">{row.paymentMethod}</td>
                                                    <td className="px-5 py-3">{row.feeMonth || '-'}</td>
                                                    <td className="px-5 py-3">{row.collectedBy}</td>
                                                    <td className="px-5 py-3 text-right font-bold text-green-600">₹{row.amountPaid?.toLocaleString(intlLocale)}</td>
                                                </tr>
                                            ))
                                        ) : (
                                            <tr>
                                                <td colSpan={8} className="p-8 text-center text-gray-500">
                                                    {t('received.noResults')}
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            )}
                        </div>

                        {/* Pagination */}
                        {receivedHasSearched && receivedTotalCount > 0 && (
                            <div className="p-4 border-t border-slate-100 flex items-center justify-between bg-slate-50/50 mt-4 rounded-lg">
                                <div className="text-sm text-slate-500">
                                    {t.rich('received.showingRecords', {
                                        from: (receivedPage - 1) * RECEIVED_PER_PAGE + 1,
                                        to: Math.min(receivedPage * RECEIVED_PER_PAGE, receivedTotalCount),
                                        total: receivedTotalCount,
                                        b: (c) => <span className="font-medium text-slate-900">{c}</span>,
                                    })}
                                </div>
                                <div className="flex gap-2">
                                    <button 
                                        onClick={() => { const p = Math.max(1, receivedPage - 1); setReceivedPage(p); fetchFeeReceived(p); }}
                                        disabled={receivedPage === 1}
                                        className="px-3 py-1 border border-slate-200 rounded text-sm disabled:opacity-50 bg-white hover:bg-slate-50 transition"
                                    >
                                        {tc('action.previous')}
                                    </button>
                                    <span className="px-3 py-1 text-sm flex items-center">
                                        {t('filter.pageOf', { page: receivedPage, total: Math.ceil(receivedTotalCount / RECEIVED_PER_PAGE) || 1 })}
                                    </span>
                                    <button 
                                        onClick={() => { const p = Math.min(Math.ceil(receivedTotalCount / RECEIVED_PER_PAGE), receivedPage + 1); setReceivedPage(p); fetchFeeReceived(p); }}
                                        disabled={receivedPage === Math.ceil(receivedTotalCount / RECEIVED_PER_PAGE)}
                                        className="px-3 py-1 border border-slate-200 rounded text-sm disabled:opacity-50 bg-white hover:bg-slate-50 transition"
                                    >
                                        {tc('action.next')}
                                    </button>
                                </div>
                            </div>
                        )}
                        </>
                        )}
                    </div>
                </div>
            )}

            {/* TAB CONTENT: EXAMINATIONS */}
            {activeTab === 'EXAMINATIONS' && (
                <div className="space-y-6">
                    {/* Filters Row */}
                    <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex flex-wrap gap-4 items-end">
                        <div className="flex-1 min-w-37.5">
                            <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">{tc('field.academicYear')}</label>
                            <select
                                className="w-full border-gray-300 rounded-lg shadow-sm focus:ring-brand/40 focus:border-brand text-sm p-2 bg-white"
                                value={selectedExamYear}
                                onChange={(e) => setSelectedExamYear(e.target.value)}
                            >
                                <option value="">{t('filter.selectSession')}</option>
                                {academicSessions.map(session => (
                                    <option key={session.id} value={session.id.toString()}>{session.name}</option>
                                ))}
                            </select>
                        </div>
                        <div className="flex-1 min-w-37.5">
                            <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">{t('exams.examTerm')}</label>
                            <select
                                className="w-full border-gray-300 rounded-lg shadow-sm focus:ring-brand/40 focus:border-brand text-sm p-2 bg-white"
                                value={selectedExamTerm}
                                onChange={(e) => setSelectedExamTerm(e.target.value)}
                            >
                                <option value="">{t('exams.selectTerm')}</option>
                                {examTerms.map(term => (
                                    <option key={term.id} value={term.id.toString()}>{term.name}</option>
                                ))}
                            </select>
                        </div>
                        <div className="flex-1 min-w-37.5">
                            <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">{tc('field.class')}</label>
                            <select
                                className="w-full border-gray-300 rounded-lg shadow-sm focus:ring-brand/40 focus:border-brand text-sm p-2 bg-white"
                                value={selectedExamClass}
                                onChange={(e) => {
                                    setSelectedExamClass(e.target.value);
                                    setSelectedExamSection('');
                                    const cls = classes.find((c: any) => c.id.toString() === e.target.value);
                                    setAvailableSections(cls ? cls.sections : []);
                                }}
                            >
                                <option value="">{t('filter.allClasses')}</option>
                                {classes.map((cls: any) => (
                                    <option key={cls.id} value={cls.id.toString()}>{cls.name}</option>
                                ))}
                            </select>
                        </div>
                        {selectedExamClass && availableSections.length > 0 && (
                            <div className="flex-1 min-w-37.5">
                                <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">{tc('field.section')}</label>
                                <select 
                                    className="w-full border-gray-300 rounded-lg shadow-sm focus:ring-brand/40 focus:border-brand text-sm p-2 bg-white"
                                    value={selectedExamSection}
                                    onChange={(e) => setSelectedExamSection(e.target.value)}
                                >
                                    <option value="">{t('filter.allSections')}</option>
                                    {availableSections.map((sec: any) => (
                                        <option key={sec.id} value={sec.id.toString()}>{sec.name}</option>
                                    ))}
                                </select>
                            </div>
                        )}
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                            <h2 className="text-lg font-bold text-slate-800 mb-4">{t('exams.avgByClass')}</h2>
                            <div className="h-72">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={examClassAvg}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={CHART_GRID} />
                                        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={CHART_TICK} />
                                        <YAxis axisLine={false} tickLine={false} tick={CHART_TICK} domain={[0, 100]} />
                                        <Tooltip {...CHART_TOOLTIP} formatter={(val: any) => `${val}%`} cursor={CHART_CURSOR} />
                                        <Bar dataKey="avg" name={t('exams.averagePercent')} fill={SERIES.brand} radius={[4,4,0,0]} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>

                        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                            <div className="p-5 border-b border-gray-200 flex justify-between items-center">
                                <div>
                                    <h2 className="text-lg font-bold text-slate-800">{t('exams.topPerformers')}</h2>
                                    <p className="text-sm text-gray-500">{t('exams.topPerformersHint')}</p>
                                </div>
                            </div>
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm text-left text-gray-600">
                                    <thead className="text-xs text-slate-500 uppercase bg-slate-50 border-b border-gray-200">
                                        <tr>
                                            <th className="px-5 py-3 font-semibold">{tc('field.subject')}</th>
                                            <th className="px-5 py-3 font-semibold">{tc('field.class')}</th>
                                            <th className="px-5 py-3 font-semibold">{t('column.studentName')}</th>
                                            <th className="px-5 py-3 font-semibold text-right">{t('exams.highestPercent')}</th>
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
                                    <div className="p-4 text-center text-gray-500">{t('exams.noScores')}</div>
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
                                <h2 className="text-lg font-bold text-slate-800">{t('attendance.avgByClass')}</h2>
                                <select 
                                    className="border-gray-300 rounded-lg shadow-sm focus:ring-brand/40 focus:border-brand text-sm p-2 bg-gray-50 mr-2"
                                    value={attendanceSession}
                                    onChange={(e) => setAttendanceSession(e.target.value)}
                                >
                                    <option value="">{t('filter.selectSession')}</option>
                                    {academicSessions.map(session => (
                                        <option key={session.id} value={session.id.toString()}>{session.name}</option>
                                    ))}
                                </select>
                                <select 
                                    className="border-gray-300 rounded-lg shadow-sm focus:ring-brand/40 focus:border-brand text-sm p-2 bg-gray-50"
                                    value={attendanceMonth}
                                    onChange={(e) => setAttendanceMonth(e.target.value)}
                                >
                                    <option value="">{t('attendance.wholeYear')}</option>
                                    {SESSION_MONTHS.map((m) => (
                                        <option key={m} value={m}>{monthLabel(m)}</option>
                                    ))}
                                </select>
                            </div>
                            {/* Grow with the class count so many classes don't squish the bars. */}
                            <div style={{ height: Math.max(288, attendanceByClass.length * 28) }}>
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={attendanceByClass} layout="vertical">
                                        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke={CHART_GRID} />
                                        <XAxis type="number" domain={[0, 100]} axisLine={false} tickLine={false} tick={CHART_TICK} />
                                        <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={CHART_TICK} width={80} />
                                        <Tooltip {...CHART_TOOLTIP} formatter={(val: any) => `${val}%`} cursor={CHART_CURSOR} />
                                        <Bar dataKey="attendance" name={t('attendance.attendancePercent')} fill={SERIES.settled} radius={[0,4,4,0]} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>

                        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                            <div className="flex justify-between items-start mb-3 flex-wrap gap-4">
                                <div>
                                    <h2 className="text-lg font-bold text-slate-800">{t('attendance.dailyTrend')}</h2>
                                    <p className="text-xs text-slate-500 mt-0.5">
                                        {t('attendance.dailyTrendHint')}
                                    </p>
                                </div>
                                <div className="flex items-center gap-2">
                                    <div className="w-40">
                                        <AppDatePicker
                                            value={attendanceFromDate}
                                            onChange={(v) => setAttendanceFromDate(v)}
                                        />
                                    </div>
                                    <span className="text-slate-500 text-sm">{t('filter.to')}</span>
                                    <div className="w-40">
                                        <AppDatePicker
                                            value={attendanceToDate}
                                            onChange={(v) => setAttendanceToDate(v)}
                                        />
                                    </div>
                                </div>
                            </div>
                            {attendanceTrend.length > 0 && (() => {
                                const latest = attendanceTrend[attendanceTrend.length - 1];
                                const lowCoverage = latest.coveragePercent < 50;
                                return (
                                    <p className={`text-xs mb-3 ${lowCoverage ? 'text-amber-600 font-medium' : 'text-slate-500'}`}>
                                        {lowCoverage && '⚠ '}
                                        {t.rich('attendance.latest', {
                                            date: latest.date,
                                            marked: latest.marked,
                                            total: latest.totalStudents,
                                            coverage: latest.coveragePercent,
                                            b: (c) => <span className="font-semibold">{c}</span>,
                                        })}
                                        {latest.attendancePercent !== null && (
                                            <>
                                              {' '}{t.rich('attendance.latestPresent', {
                                                  percent: latest.attendancePercent,
                                                  b: (c) => <span className="font-semibold">{c}</span>,
                                              })}
                                            </>
                                        )}
                                    </p>
                                );
                            })()}
                            <div className="h-72">
                                <ResponsiveContainer width="100%" height="100%">
                                    <ComposedChart data={attendanceTrend}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={CHART_GRID} />
                                        <XAxis dataKey="date" axisLine={false} tickLine={false} tick={CHART_TICK} />
                                        <YAxis domain={[0, 100]} axisLine={false} tickLine={false} tick={CHART_TICK} />
                                        <Tooltip content={<AttendanceTrendTooltip />} />
                                        <Legend wrapperStyle={{fontSize: 12}} />
                                        {/* Coverage is the context the rate is read against, so it
                                            stays a pale fill behind the line rather than a second
                                            competing series. */}
                                        <Bar dataKey="coveragePercent" name={t('attendance.schoolCoverage')} fill={SERIES_CONTEXT_SOFT} radius={[4, 4, 0, 0]} barSize={16} />
                                        <Line
                                            type="monotone"
                                            dataKey="attendancePercent"
                                            name={t('attendance.attendanceMarked')}
                                            stroke={SERIES.brand}
                                            strokeWidth={3}
                                            dot={{r: 4, fill: SERIES.brand}}
                                            activeDot={{r: 6}}
                                            connectNulls={false}
                                        />
                                    </ComposedChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    </div>

                    {/* Which classes still owe attendance for a given date. Sits
                        below the two charts: those are the month's shape, this is
                        the day's outstanding work. */}
                    <DailyAttendanceRegister />
                </div>
            )}

            {/* TAB CONTENT: STUDENTS */}
            {activeTab === 'STUDENTS' && (
                <div className="space-y-6">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                            <div className="flex justify-between items-center mb-4 flex-wrap gap-2">
                                <h2 className="text-lg font-bold text-slate-800">{t('students.enrollmentByClass')}</h2>
                                <div className="flex items-center gap-2">
                                    <select 
                                        className="border-gray-300 rounded-lg shadow-sm focus:ring-brand/40 focus:border-brand text-sm p-2 bg-gray-50"
                                        value={enrollmentFromSession}
                                        onChange={(e) => setEnrollmentFromSession(e.target.value)}
                                    >
                                        <option value="">{t('students.filterSession')}</option>
                                        {academicSessions.map(session => (
                                            <option key={session.id} value={session.id.toString()}>{session.name}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                            <div className="h-72">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={enrollmentClass}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={CHART_GRID} />
                                        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={CHART_TICK} />
                                        <YAxis axisLine={false} tickLine={false} tick={CHART_TICK} />
                                        <Tooltip {...CHART_TOOLTIP} cursor={CHART_CURSOR} />
                                        <Bar dataKey="students" name={t('students.enrolledStudents')} fill={SERIES.brand} radius={[4,4,0,0]} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>

                        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                            <div className="flex justify-between items-center mb-4 flex-wrap gap-2">
                                <h2 className="text-lg font-bold text-slate-800">{t('students.admissionsTrend')}</h2>
                                <div className="flex items-center gap-2">
                                    <select 
                                        className="w-32 border-gray-300 rounded-lg shadow-sm focus:ring-brand/40 focus:border-brand text-sm p-2 bg-gray-50"
                                        value={admissionsFromSession}
                                        onChange={(e) => setAdmissionsFromSession(e.target.value)}
                                    >
                                        <option value="">{t('students.fromSession')}</option>
                                        {academicSessions.map(session => (
                                            <option key={session.id} value={session.id.toString()}>{session.name}</option>
                                        ))}
                                    </select>
                                    <span className="text-slate-500 text-sm">{t('filter.to')}</span>
                                    <select 
                                        className="w-32 border-gray-300 rounded-lg shadow-sm focus:ring-brand/40 focus:border-brand text-sm p-2 bg-gray-50"
                                        value={admissionsToSession}
                                        onChange={(e) => setAdmissionsToSession(e.target.value)}
                                    >
                                        <option value="">{t('students.toSession')}</option>
                                        {academicSessions.map(session => (
                                            <option key={session.id} value={session.id.toString()}>{session.name}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                            <div className="h-72">
                                <ResponsiveContainer width="100%" height="100%">
                                    <LineChart data={admissionsTrend}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={CHART_GRID} />
                                        <XAxis dataKey="year" axisLine={false} tickLine={false} tick={CHART_TICK} />
                                        <YAxis axisLine={false} tickLine={false} tick={CHART_TICK} />
                                        <Tooltip {...CHART_TOOLTIP} />
                                        <Line type="monotone" dataKey="admissions" name={t('students.newAdmissions')} stroke={SERIES.brand} strokeWidth={3} dot={{r: 4, fill: SERIES.brand}} />
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
                            <h2 className="text-lg font-bold text-slate-800 mb-4">{t('staff.distribution')}</h2>
                            <div className="h-72">
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie
                                            data={staffDistributionWithFill}
                                            innerRadius={60}
                                            outerRadius={100}
                                            paddingAngle={2}
                                            minAngle={6}
                                            dataKey="value"
                                            label
                                        >
                                            {staffDistributionWithFill.map((entry: any, i: number) => (
                                                <Cell key={i} fill={entry.fill} />
                                            ))}
                                        </Pie>
                                        <Tooltip {...CHART_TOOLTIP} />
                                        <Legend verticalAlign="bottom" height={36}/>
                                    </PieChart>
                                </ResponsiveContainer>
                            </div>
                        </div>

                        {hrPortalEnabled && (
                            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                                <h2 className="text-lg font-bold text-slate-800 mb-4">{t('staff.attendanceToday')}</h2>
                                <div className="h-72">
                                    {staffAttendanceError ? (
                                        <div className="h-full flex items-center justify-center text-center text-sm text-rose-600 px-4">
                                            {t('staff.loadFailed')}
                                        </div>
                                    ) : !staffAttendanceSummary ? (
                                        <div className="h-full flex items-center justify-center text-sm text-slate-400">
                                            {tc('state.loading')}
                                        </div>
                                    ) : staffAttendanceChartData.length === 0 ? (
                                        <div className="h-full flex items-center justify-center text-sm text-slate-500">
                                            {t('staff.noneToday')}
                                        </div>
                                    ) : (
                                        <ResponsiveContainer width="100%" height="100%">
                                            <PieChart>
                                                <Pie
                                                    data={staffAttendanceChartData}
                                                    innerRadius={60}
                                                    outerRadius={100}
                                                    paddingAngle={2}
                                                    minAngle={6}
                                                    dataKey="value"
                                                    label
                                                >
                                                    {staffAttendanceChartData.map((entry, i) => (
                                                        <Cell key={i} fill={entry.fill} />
                                                    ))}
                                                </Pie>
                                                <Tooltip {...CHART_TOOLTIP} />
                                                <Legend verticalAlign="bottom" height={36}/>
                                            </PieChart>
                                        </ResponsiveContainer>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {activeTab === 'SALARY' && hrPortalEnabled && (
                <div className="space-y-6">
                    {/* Year selector */}
                    <div className="flex items-center gap-3">
                        <label className="text-sm font-medium text-slate-700">{t('salary.year')}</label>
                        <select
                            value={salaryYear}
                            onChange={(e) => setSalaryYear(Number(e.target.value))}
                            className="border-gray-300 rounded-lg shadow-sm text-sm p-2 bg-gray-50"
                        >
                            {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i).map((y) => (
                                <option key={y} value={y}>{y}</option>
                            ))}
                        </select>
                    </div>

                    {salaryData.length === 0 ? (
                        <div className="text-center py-12 text-slate-500 text-sm">{t('salary.noRuns', { year: salaryYear })}</div>
                    ) : (
                        <>
                            {/* Bar chart */}
                            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                                <h2 className="text-lg font-bold text-slate-800 mb-4">{t('salary.monthlySummary', { year: salaryYear })}</h2>
                                <div className="h-72">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={salaryData}>
                                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={CHART_GRID} />
                                            <XAxis dataKey="monthName" axisLine={false} tickLine={false} tick={CHART_TICK} />
                                            <YAxis axisLine={false} tickLine={false} tick={CHART_TICK} tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} />
                                            <Tooltip {...CHART_TOOLTIP} formatter={(v: any) => `₹${Number(v).toLocaleString(intlLocale)}`} cursor={CHART_CURSOR} />
                                            <Legend />
                                            <Bar dataKey="totalGross" name={t('salary.grossEarnings')} fill={SERIES.brand} radius={[4, 4, 0, 0]} />
                                            <Bar dataKey="totalNetPay" name={t('salary.netPay')} fill={SERIES.settled} radius={[4, 4, 0, 0]} />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>

                            {/* Summary table */}
                            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-x-auto">
                                <table className="min-w-full text-sm">
                                    <thead className="bg-slate-50 text-slate-600 text-xs uppercase">
                                        <tr>
                                            <th className="px-4 py-3 text-left">{t('salary.month')}</th>
                                            <th className="px-4 py-3 text-right">{t('salary.headcount')}</th>
                                            <th className="px-4 py-3 text-right">{t('salary.grossEarnings')}</th>
                                            <th className="px-4 py-3 text-right">{t('salary.totalDeductions')}</th>
                                            <th className="px-4 py-3 text-right">{t('salary.netPay')}</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {salaryData.map((row) => (
                                            <tr key={`${row.year}-${row.month}`} className="hover:bg-slate-50">
                                                <td className="px-4 py-3 font-medium text-slate-900">{row.monthName} {row.year}</td>
                                                <td className="px-4 py-3 text-right">{row.headcount}</td>
                                                <td className="px-4 py-3 text-right">₹{Number(row.totalGross).toLocaleString(intlLocale)}</td>
                                                <td className="px-4 py-3 text-right text-red-600">₹{Number(row.totalDeductions).toLocaleString(intlLocale)}</td>
                                                <td className="px-4 py-3 text-right font-semibold text-green-700">₹{Number(row.totalNetPay).toLocaleString(intlLocale)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </>
                    )}
                </div>
            )}

            {activeTab === 'LIBRARY_FEES' && libraryEnabled && (
                <LibraryFeesReportSection />
            )}

            {activeTab === 'INVENTORY' && inventoryEnabled && (
                <InventoryReportsTeaser />
            )}

            {showNotifModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-walnut-950/55 backdrop-blur-sm animate-fade-in">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden animate-scale-in">
                        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                            <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                                <svg className="w-5 h-5 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                                </svg>
                                {t('notify.title')}
                            </h3>
                            <button onClick={() => setShowNotifModal(false)} className="text-slate-400 hover:text-slate-600 transition">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                            </button>
                        </div>
                        <div className="p-6 space-y-5">
                            <div className="bg-indigo-50 text-indigo-700 p-3 rounded-lg text-sm border border-indigo-100 flex gap-3 items-center">
                                <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                <span>{t.rich('notify.willNotify', { count: selectedPendingStudents.length, b: (c) => <strong>{c}</strong> })}</span>
                            </div>

                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-1">{t('notify.notificationTitle')}</label>
                                <input type="text" value="Fee Payment Reminder" disabled className="w-full border-slate-200 bg-slate-50 text-slate-500 rounded-lg p-2.5 text-sm" />
                            </div>

                            <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                    <label className="text-sm font-semibold text-slate-700">{t('notify.messageContent')}</label>
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input type="checkbox" checked={useCustomMessage} onChange={(e) => setUseCustomMessage(e.target.checked)} className="rounded border-slate-300 text-indigo-600 focus:ring-brand/40" />
                                        <span className="text-xs text-slate-600 font-medium">{t('notify.useCustom')}</span>
                                    </label>
                                </div>
                                
                                {useCustomMessage ? (
                                    <textarea
                                        value={customNotifMessage}
                                        onChange={(e) => setCustomNotifMessage(e.target.value)}
                                        placeholder={t('notify.customPlaceholder')}
                                        className="w-full border-slate-300 rounded-lg p-3 text-sm focus:ring-brand/40 focus:border-brand min-h-30"
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
                                {tc('action.cancel')}
                            </button>
                            <button
                                onClick={handleSendNotification}
                                disabled={sendingNotif || (useCustomMessage && !customNotifMessage.trim())}
                                className="px-5 py-2.5 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow transition flex items-center gap-2 disabled:opacity-50"
                            >
                                {sendingNotif && <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                                {sendingNotif ? t('notify.sending') : t('notify.send')}
                            </button>
                        </div>
                    </div>
                </div>
            )}

        </main>
    );
}
