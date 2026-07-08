"use client";

import { useState, useEffect, useCallback } from "react";
import { API_BASE_URL } from "@/lib/api";
import { authFetch } from "@/lib/auth";
import { useRbac } from "@/lib/rbac";
import toast, { Toaster } from "react-hot-toast";
import LeaveCancellationModal from "@/components/LeaveCancellationModal";
import LeaveTimeline from "@/components/LeaveTimeline";
import { AppDatePicker } from "@/components/ui/AppDatePicker";

// ── Types ──────────────────────────────────────────────────────────────────

type LeaveStatus = "PENDING" | "FIRST_APPROVED" | "APPROVED" | "REJECTED" | "CANCELLED";
type LeaveType = "SICK_LEAVE" | "CASUAL_LEAVE" | "OTHER_LEAVE";
type LeaveDuration = "FULL_DAY" | "HALF_DAY";

interface LeaveApplication {
    id: number;
    studentId: number;
    student?: { id: number; user?: { firstName: string; lastName: string } };
    class?: { name: string };
    section?: { name: string };
    leaveType: LeaveType;
    leaveDuration: LeaveDuration;
    fromDate: string;
    toDate: string;
    reason: string;
    status: LeaveStatus;
    firstApprover?: { id?: number; firstName: string; lastName: string; role?: string };
    firstApprovedAt?: string;
    secondApprover?: { id?: number; firstName: string; lastName: string; role?: string };
    secondApprovedAt?: string;
    rejectedBy?: { id?: number; firstName: string; lastName: string; role?: string };
    rejectedAt?: string;
    rejectionReason?: string;
    cancelledBy?: { id?: number; firstName: string; lastName: string; role?: string };
    cancelledAt?: string;
    cancellationNote?: string;
    // Action required
    isActionRequired?: boolean;
    actionRequiredMessage?: string;
    actionRequiredBy?: { id?: number; firstName: string; lastName: string; role?: string };
    actionRequiredAt?: string;
    parentResponseNote?: string;
    parentResponseAt?: string;
    documents?: { id: number; fileName: string; mimeType: string }[];
    createdAt: string;
}

const PAGE_SIZE_OPTIONS = [10, 20, 50];

const LEAVE_TYPE_LABELS: Record<LeaveType, string> = {
    SICK_LEAVE: "Sick Leave",
    CASUAL_LEAVE: "Casual Leave",
    OTHER_LEAVE: "Other Leave",
};

const STATUS_STYLES: Record<LeaveStatus, string> = {
    PENDING: "bg-amber-100 text-amber-800 border border-amber-200",
    FIRST_APPROVED: "bg-blue-100 text-blue-800 border border-blue-200",
    APPROVED: "bg-green-100 text-green-800 border border-green-200",
    REJECTED: "bg-red-100 text-red-800 border border-red-200",
    CANCELLED: "bg-gray-100 text-gray-600 border border-gray-200",
};

const STATUS_LABELS: Record<LeaveStatus, string> = {
    PENDING: "Pending",
    FIRST_APPROVED: "1st Approved",
    APPROVED: "Approved",
    REJECTED: "Rejected",
    CANCELLED: "Cancelled",
};

function formatDate(d: string) {
    if (!d) return "—";
    const [y, m, day] = d.split("-");
    return `${day}/${m}/${y}`;
}

// ── In-app Document Viewer Modal ───────────────────────────────────────────

function DocViewerModal({
    url,
    fileName,
    mimeType,
    onClose,
}: {
    url: string;
    fileName: string;
    mimeType: string;
    onClose: () => void;
}) {
    const isPdf = mimeType === 'application/pdf';
    return (
        <div className="fixed inset-0 z-[60] flex flex-col bg-black/80" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
            {/* Toolbar */}
            <div className="flex items-center justify-between px-4 py-3 bg-gray-900 border-b border-gray-700 shrink-0">
                <span className="text-white text-sm font-medium truncate max-w-xs">{fileName}</span>
                <div className="flex items-center gap-2 shrink-0">
                    <a
                        href={url}
                        download={fileName}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium rounded-lg transition-colors"
                    >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                        Download
                    </a>
                    <button onClick={onClose} className="p-1.5 rounded-lg bg-gray-700 hover:bg-gray-600 text-gray-200 transition-colors">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>
            </div>
            {/* Content */}
            <div className="flex-1 overflow-auto flex items-center justify-center p-4">
                {isPdf ? (
                    <iframe
                        src={url}
                        title={fileName}
                        className="w-full h-full min-h-[70vh] rounded-lg border-0 bg-white"
                    />
                ) : (
                    <img
                        src={url}
                        alt={fileName}
                        className="max-w-full max-h-full object-contain rounded-lg shadow-xl"
                    />
                )}
            </div>
        </div>
    );
}

// ── Detail Drawer ──────────────────────────────────────────────────────────

function LeaveDetailDrawer({
    leave,
    onClose,
    onOpenDoc,
}: {
    leave: LeaveApplication;
    onClose: () => void;
    onOpenDoc: (doc: { id: number; fileName: string; mimeType: string }) => void;
}) {
    return (
        <div className="fixed inset-0 z-50 flex">
            {/* Backdrop */}
            <div className="flex-1 bg-black/40" onClick={onClose} />
            {/* Panel */}
            <div className="w-full max-w-md bg-white shadow-xl overflow-y-auto flex flex-col">
                <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 sticky top-0 bg-white z-10">
                    <h2 className="text-base font-semibold text-gray-900">Leave #{leave.id} Details</h2>
                    <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
                        <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>
                <div className="p-5 space-y-4 flex-1">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold text-sm">
                            {leave.student?.user?.firstName?.[0]}{leave.student?.user?.lastName?.[0]}
                        </div>
                        <div>
                            <p className="font-semibold text-gray-900">{leave.student?.user?.firstName} {leave.student?.user?.lastName}</p>
                            <p className="text-xs text-gray-500">{leave.class?.name}{leave.section?.name ? ` · Sec ${leave.section.name}` : ""}</p>
                        </div>
                        <span className={`ml-auto text-xs px-2 py-1 rounded-full font-medium ${STATUS_STYLES[leave.status]}`}>{STATUS_LABELS[leave.status]}</span>
                    </div>

                    <div className="grid grid-cols-2 gap-3 text-sm">
                        <div className="bg-gray-50 rounded-lg p-3">
                            <p className="text-gray-500 text-xs mb-1">Leave Type</p>
                            <p className="font-medium text-gray-900">{LEAVE_TYPE_LABELS[leave.leaveType]}</p>
                        </div>
                        <div className="bg-gray-50 rounded-lg p-3">
                            <p className="text-gray-500 text-xs mb-1">Duration</p>
                            <p className="font-medium text-gray-900">{leave.leaveDuration === "HALF_DAY" ? "Half Day" : "Full Day"}</p>
                        </div>
                        <div className="bg-gray-50 rounded-lg p-3">
                            <p className="text-gray-500 text-xs mb-1">From</p>
                            <p className="font-medium text-gray-900">{formatDate(leave.fromDate)}</p>
                        </div>
                        <div className="bg-gray-50 rounded-lg p-3">
                            <p className="text-gray-500 text-xs mb-1">To</p>
                            <p className="font-medium text-gray-900">{formatDate(leave.toDate)}</p>
                        </div>
                    </div>

                    <div className="bg-gray-50 rounded-lg p-3 text-sm">
                        <p className="text-gray-500 text-xs mb-1">Reason</p>
                        <p className="text-gray-900">{leave.reason}</p>
                    </div>

                    {/* Chronological event timeline */}
                    <LeaveTimeline leave={leave} theme="light" />

                    {/* Pending approvals (still show if not yet actioned) */}
                    {!leave.firstApprovedAt && !leave.rejectedAt && !leave.cancelledAt && (
                        <div className="flex items-center gap-2 text-sm text-gray-500">
                            <span className="w-2 h-2 rounded-full bg-gray-300 shrink-0" />
                            Awaiting 1st approval
                        </div>
                    )}
                    {leave.firstApprovedAt && !leave.secondApprovedAt && !leave.rejectedAt && !leave.cancelledAt && (
                        <div className="flex items-center gap-2 text-sm text-gray-500">
                            <span className="w-2 h-2 rounded-full bg-gray-300 shrink-0" />
                            Awaiting final approval
                        </div>
                    )}

                    {/* Documents */}
                    {leave.documents && leave.documents.length > 0 && (
                        <div>
                            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Documents</p>
                            <div className="space-y-2">
                                {leave.documents.map(doc => {
                                    const isPdf = doc.mimeType === 'application/pdf';
                                    return (
                                        <button
                                            key={doc.id}
                                            onClick={() => onOpenDoc(doc)}
                                            className="flex items-center gap-2 w-full text-left px-3 py-2 rounded-lg border border-gray-200 hover:bg-blue-50 hover:border-blue-300 transition-colors text-sm text-blue-600"
                                        >
                                            {isPdf ? (
                                                <svg className="w-4 h-4 shrink-0 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
                                            ) : (
                                                <svg className="w-4 h-4 shrink-0 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                                            )}
                                            <span className="truncate">{doc.fileName}</span>
                                            <span className="ml-auto shrink-0 text-xs text-gray-400">{isPdf ? 'PDF' : 'Image'}</span>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

// ── Reject Modal ───────────────────────────────────────────────────────────

function RejectModal({
    leave,
    onClose,
    onConfirm,
    loading,
}: {
    leave: LeaveApplication;
    onClose: () => void;
    onConfirm: (reason: string) => void;
    loading: boolean;
}) {
    const [reason, setReason] = useState("");
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
                <h3 className="text-base font-semibold text-gray-900 mb-4">Reject Leave #{leave.id}</h3>
                <p className="text-sm text-gray-600 mb-4">
                    {leave.student?.user?.firstName} {leave.student?.user?.lastName} — {formatDate(leave.fromDate)} to {formatDate(leave.toDate)}
                </p>
                <label className="block text-sm font-medium text-gray-700 mb-1">Rejection Reason <span className="text-red-500">*</span></label>
                <textarea
                    value={reason}
                    onChange={e => setReason(e.target.value)}
                    rows={3}
                    placeholder="Enter reason for rejection..."
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-400 resize-none"
                />
                <div className="flex gap-3 mt-5">
                    <button onClick={onClose} className="flex-1 py-2.5 border border-gray-300 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">Cancel</button>
                    <button
                        onClick={() => reason.trim() && onConfirm(reason.trim())}
                        disabled={!reason.trim() || loading}
                        className="flex-1 py-2.5 bg-red-600 text-white rounded-xl text-sm font-medium hover:bg-red-700 disabled:opacity-50 transition-colors"
                    >
                        {loading ? "Rejecting…" : "Reject Leave"}
                    </button>
                </div>
            </div>
        </div>
    );
}

// ── Main Page ──────────────────────────────────────────────────────────────

export default function LeavesPage() {
    const rbac = useRbac();

    const [leaves, setLeaves] = useState<LeaveApplication[]>([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);
    const [loading, setLoading] = useState(false);
    const [actionLoading, setActionLoading] = useState(false);

    // Filters
    const [classes, setClasses] = useState<any[]>([]);
    const [sections, setSections] = useState<any[]>([]);
    const [loadingSections, setLoadingSections] = useState(false);
    const [filterClassId, setFilterClassId] = useState("");
    const [filterSectionId, setFilterSectionId] = useState("");
    const [filterStudentId, setFilterStudentId] = useState("");
    const [filterStatus, setFilterStatus] = useState("UNAPPROVED");
    const [filterFromDate, setFilterFromDate] = useState("");
    const [filterToDate, setFilterToDate] = useState("");
    const [committedFilters, setCommittedFilters] = useState<Record<string, string>>({ status: "UNAPPROVED" });

    // Modals / drawers
    const [detailLeave, setDetailLeave] = useState<LeaveApplication | null>(null);
    const [rejectLeave, setRejectLeave] = useState<LeaveApplication | null>(null);
    const [cancelLeave, setCancelLeave] = useState<LeaveApplication | null>(null);
    const [requestDocLeave, setRequestDocLeave] = useState<LeaveApplication | null>(null);
    const [viewerDoc, setViewerDoc] = useState<{ url: string; fileName: string; mimeType: string } | null>(null);

    const totalPages = Math.ceil(total / pageSize);

    // ── Data loading ─────────────────────────────────────────────────────

    const fetchLeaves = useCallback(async (p: number, filters: Record<string, string>) => {
        setLoading(true);
        try {
            const params = new URLSearchParams({ page: String(p), limit: String(pageSize) });
            Object.entries(filters).forEach(([k, v]) => { if (v) params.set(k, v); });
            const res = await authFetch(`${API_BASE_URL}/leaves?${params}`);
            if (res.ok) {
                const data = await res.json();
                setLeaves(data.data ?? []);
                setTotal(data.total ?? 0);
            }
        } catch { toast.error("Failed to load leave requests"); }
        finally { setLoading(false); }
    }, [pageSize]);

    useEffect(() => {
        authFetch(`${API_BASE_URL}/classes/names-only`)
            .then(r => r.json())
            .then(d => setClasses(Array.isArray(d) ? d : []))
            .catch(() => { });
    }, []);

    useEffect(() => { fetchLeaves(page, committedFilters); }, [page, committedFilters, fetchLeaves]);

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        const filters: Record<string, string> = {};
        if (filterClassId) filters.classId = filterClassId;
        if (filterSectionId) filters.sectionId = filterSectionId;
        if (filterStudentId) filters.studentId = filterStudentId;
        if (filterStatus) filters.status = filterStatus;
        if (filterFromDate) filters.fromDate = filterFromDate;
        if (filterToDate) filters.toDate = filterToDate;
        setPage(1);
        setCommittedFilters(filters);
    };

    const handleReset = () => {
        setFilterClassId(""); setFilterSectionId(""); setFilterStudentId("");
        setFilterStatus("UNAPPROVED"); setFilterFromDate(""); setFilterToDate("");
        setSections([]);
        setPage(1);
        setCommittedFilters({ status: "UNAPPROVED" });
    };

    const handleClassChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const val = e.target.value;
        setFilterClassId(val);
        setFilterSectionId("");
        setSections([]);
        if (val) {
            setLoadingSections(true);
            authFetch(`${API_BASE_URL}/classes/${val}/sections`)
                .then(r => r.json())
                .then(d => setSections(Array.isArray(d) ? d : []))
                .catch(() => setSections([]))
                .finally(() => setLoadingSections(false));
        }
    };

    // ── Actions ───────────────────────────────────────────────────────────

    const patchLeave = async (id: number, endpoint: string, body?: any) => {
        setActionLoading(true);
        try {
            const res = await authFetch(`${API_BASE_URL}/leaves/${id}/${endpoint}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: body ? JSON.stringify(body) : undefined,
            });
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err.message || "Action failed");
            }
            return await res.json();
        } finally { setActionLoading(false); }
    };

    const handleFirstApprove = async (leave: LeaveApplication) => {
        try {
            await patchLeave(leave.id, "first-approve");
            toast.success("First approval granted");
            fetchLeaves(page, committedFilters);
        } catch (err: any) { toast.error(err.message); }
    };

    const handleSecondApprove = async (leave: LeaveApplication) => {
        try {
            await patchLeave(leave.id, "second-approve");
            toast.success("Leave fully approved — attendance updated");
            fetchLeaves(page, committedFilters);
        } catch (err: any) { toast.error(err.message); }
    };

    const handleRejectConfirm = async (reason: string) => {
        if (!rejectLeave) return;
        try {
            await patchLeave(rejectLeave.id, "reject", { rejectionReason: reason });
            toast.success("Leave rejected");
            setRejectLeave(null);
            fetchLeaves(page, committedFilters);
        } catch (err: any) { toast.error(err.message); }
    };

    const handleCancelConfirm = async (note: string, action: string) => {
        if (!cancelLeave) return;
        try {
            const body: any = {};
            if (note) body.cancellationNote = note;
            if (action) body.cancellationAttendanceAction = action;
            await patchLeave(cancelLeave.id, "cancel", body);
            toast.success("Leave cancelled");
            setCancelLeave(null);
            fetchLeaves(page, committedFilters);
        } catch (err: any) { toast.error(err.message); }
    };

    const handleRequestDocConfirm = async (message: string) => {
        if (!requestDocLeave) return;
        try {
            await patchLeave(requestDocLeave.id, "request-document", { message });
            toast.success("Message sent to parent");
            setRequestDocLeave(null);
            fetchLeaves(page, committedFilters);
        } catch (err: any) { toast.error(err.message); }
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

    // ── Pagination ────────────────────────────────────────────────────────

    const getPageNumbers = () => {
        const pages: (number | string)[] = [];
        if (totalPages <= 7) {
            for (let i = 1; i <= totalPages; i++) pages.push(i);
        } else {
            pages.push(1);
            if (page > 3) pages.push("...");
            const start = Math.max(2, page - 1);
            const end = Math.min(totalPages - 1, page + 1);
            for (let i = start; i <= end; i++) pages.push(i);
            if (page < totalPages - 2) pages.push("...");
            pages.push(totalPages);
        }
        return pages;
    };

    const inputCls = "bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg w-full p-2.5 focus:ring-blue-500 focus:border-blue-500";

    return (
        <div className="p-4 sm:p-6 max-w-7xl mx-auto">
            <Toaster position="top-right" />

            {/* Header */}
            <div className="mb-6">
                <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Leave Requests</h1>
                <p className="text-sm text-gray-500 mt-1">Review and manage student leave applications</p>
            </div>

            {/* Filters */}
            <form onSubmit={handleSearch} className="bg-white border border-gray-200 rounded-2xl p-4 sm:p-5 mb-6 shadow-sm">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 mb-4">
                    {/* Class */}
                    <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Class</label>
                        <select value={filterClassId} onChange={handleClassChange} className={inputCls}>
                            <option value="">All Classes</option>
                            {classes.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                    </div>
                    {/* Section */}
                    <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Section</label>
                        <select value={filterSectionId} onChange={e => setFilterSectionId(e.target.value)} disabled={!filterClassId || loadingSections} className={inputCls}>
                            <option value="">{loadingSections ? "Loading…" : "All Sections"}</option>
                            {sections.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
                        </select>
                    </div>
                    {/* Student ID */}
                    <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Student ID</label>
                        <input type="text" value={filterStudentId} onChange={e => setFilterStudentId(e.target.value)} placeholder="e.g. 101" className={inputCls} />
                    </div>
                    {/* Status */}
                    <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Status</label>
                        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className={inputCls}>
                            <option value="">All Statuses</option>
                            <option value="UNAPPROVED">⏳ Unapproved (Active)</option>
                            <option value="PENDING">Pending</option>
                            <option value="FIRST_APPROVED">1st Approved</option>
                            <option value="APPROVED">Approved</option>
                            <option value="REJECTED">Rejected</option>
                            <option value="CANCELLED">Cancelled</option>
                        </select>
                    </div>
                    {/* From Date */}
                    <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">From Date</label>
                        <AppDatePicker value={filterFromDate} onChange={(v) => setFilterFromDate(v)} />
                    </div>
                    {/* To Date */}
                    <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">To Date</label>
                        <AppDatePicker value={filterToDate} onChange={(v) => setFilterToDate(v)} />
                    </div>
                </div>
                <div className="flex gap-3">
                    <button type="submit" className="px-5 py-2.5 bg-blue-700 text-white text-sm font-medium rounded-xl hover:bg-blue-800 transition-colors">Search</button>
                    <button type="button" onClick={handleReset} className="px-5 py-2.5 border border-gray-300 text-gray-700 text-sm font-medium rounded-xl hover:bg-gray-50 transition-colors">Reset</button>
                </div>
            </form>

            {/* Table */}
            <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
                {loading ? (
                    <div className="flex items-center justify-center py-16">
                        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                    </div>
                ) : leaves.length === 0 ? (
                    <div className="text-center py-16 text-gray-400">
                        <svg className="w-12 h-12 mx-auto mb-3 opacity-40" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
                        <p className="text-sm">No leave requests found</p>
                    </div>
                ) : (
                    <>
                        {/* Desktop table */}
                        <div className="hidden sm:block overflow-x-auto">
                            <table className="w-full text-sm text-left text-gray-700">
                                <thead className="bg-gray-50 border-b border-gray-200">
                                    <tr>
                                        <th className="px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">#</th>
                                        <th className="px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">Student</th>
                                        <th className="px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">Class</th>
                                        <th className="px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">Type</th>
                                        <th className="px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">Dates</th>
                                        <th className="px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">Duration</th>
                                        <th className="px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">Status</th>
                                        <th className="px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">Applied On</th>
                                        <th className="px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {leaves.map(leave => (
                                        <tr key={leave.id} className="hover:bg-gray-50 transition-colors">
                                            <td className="px-4 py-3 text-gray-500 text-xs">{leave.id}</td>
                                            <td className="px-4 py-3 font-medium text-gray-900">
                                                {leave.student?.user?.firstName} {leave.student?.user?.lastName}
                                            </td>
                                            <td className="px-4 py-3 text-gray-600 text-xs">
                                                {leave.class?.name}{leave.section?.name ? ` · ${leave.section.name}` : ""}
                                            </td>
                                            <td className="px-4 py-3 text-xs">{LEAVE_TYPE_LABELS[leave.leaveType]}</td>
                                            <td className="px-4 py-3 text-xs whitespace-nowrap">
                                                {formatDate(leave.fromDate)}{leave.fromDate !== leave.toDate ? ` → ${formatDate(leave.toDate)}` : ""}
                                            </td>
                                            <td className="px-4 py-3 text-xs">{leave.leaveDuration === "HALF_DAY" ? "Half Day" : "Full Day"}</td>
                                            <td className="px-4 py-3">
                                                <div className="flex flex-wrap items-center gap-1.5">
                                                    <span className={`text-xs px-2.5 py-1 rounded-full font-medium whitespace-nowrap ${STATUS_STYLES[leave.status]}`}>
                                                        {STATUS_LABELS[leave.status]}
                                                    </span>
                                                    {leave.isActionRequired && (
                                                        <span className="text-xs px-2 py-0.5 rounded-full bg-orange-100 text-orange-700 border border-orange-200 font-medium whitespace-nowrap">
                                                            ⚠ Action Needed
                                                        </span>
                                                    )}
                                                    {leave.documents && leave.documents.length > 0 && (
                                                        <span className="text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 border border-blue-200 font-medium whitespace-nowrap">
                                                            📎 {leave.documents.length}
                                                        </span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">
                                                {new Date(leave.createdAt).toLocaleDateString()}
                                            </td>
                                            <td className="px-4 py-3">
                                                <ActionButtons
                                                    leave={leave}
                                                    rbac={rbac}
                                                    actionLoading={actionLoading}
                                                    onView={() => setDetailLeave(leave)}
                                                    onFirstApprove={() => handleFirstApprove(leave)}
                                                    onSecondApprove={() => handleSecondApprove(leave)}
                                                    onReject={() => setRejectLeave(leave)}
                                                    onCancel={() => setCancelLeave(leave)}
                                                    onRequestDoc={() => setRequestDocLeave(leave)}
                                                />
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {/* Mobile cards */}
                        <div className="sm:hidden divide-y divide-gray-100">
                            {leaves.map(leave => (
                                <div key={leave.id} className="p-4 space-y-3">
                                    <div className="flex items-start justify-between gap-2">
                                        <div>
                                            <p className="font-semibold text-gray-900 text-sm">{leave.student?.user?.firstName} {leave.student?.user?.lastName}</p>
                                            <p className="text-xs text-gray-500">{leave.class?.name}{leave.section?.name ? ` · Sec ${leave.section.name}` : ""}</p>
                                        </div>
                                        <span className={`text-xs px-2.5 py-1 rounded-full font-medium whitespace-nowrap shrink-0 ${STATUS_STYLES[leave.status]}`}>
                                            {STATUS_LABELS[leave.status]}
                                        </span>
                                    </div>
                                    <div className="flex flex-wrap gap-2 text-xs text-gray-600">
                                        <span className="bg-gray-100 px-2 py-0.5 rounded-full">{LEAVE_TYPE_LABELS[leave.leaveType]}</span>
                                        <span className="bg-gray-100 px-2 py-0.5 rounded-full">{leave.leaveDuration === "HALF_DAY" ? "Half Day" : "Full Day"}</span>
                                        <span className="bg-gray-100 px-2 py-0.5 rounded-full">{formatDate(leave.fromDate)}{leave.fromDate !== leave.toDate ? ` → ${formatDate(leave.toDate)}` : ""}</span>
                                    </div>
                                    <ActionButtons
                                        leave={leave}
                                        rbac={rbac}
                                        actionLoading={actionLoading}
                                        onView={() => setDetailLeave(leave)}
                                        onFirstApprove={() => handleFirstApprove(leave)}
                                        onSecondApprove={() => handleSecondApprove(leave)}
                                        onReject={() => setRejectLeave(leave)}
                                        onCancel={() => setCancelLeave(leave)}
                                        onRequestDoc={() => setRequestDocLeave(leave)}
                                    />
                                </div>
                            ))}
                        </div>
                    </>
                )}

                {/* Pagination */}
                {totalPages > 1 && (
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 border-t border-gray-200">
                        <div className="flex items-center gap-2">
                            <span className="text-xs text-gray-500">Rows per page:</span>
                            <select value={pageSize} onChange={e => { setPageSize(Number(e.target.value)); setPage(1); }} className="border border-gray-300 rounded-lg text-xs py-1 px-2">
                                {PAGE_SIZE_OPTIONS.map(n => <option key={n} value={n}>{n}</option>)}
                            </select>
                            <span className="text-xs text-gray-500">{(page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)} of {total}</span>
                        </div>
                        <div className="flex items-center gap-1">
                            <button onClick={() => setPage(p => p - 1)} disabled={page === 1} className="px-2.5 py-1.5 text-xs border border-gray-300 rounded-lg disabled:opacity-40 hover:bg-gray-50">← Prev</button>
                            {getPageNumbers().map((p, i) =>
                                p === "..." ? <span key={`e${i}`} className="px-2 text-gray-400 text-xs">…</span> :
                                    <button key={p} onClick={() => setPage(Number(p))} className={`px-2.5 py-1.5 text-xs border rounded-lg ${page === p ? "bg-blue-600 text-white border-blue-600" : "border-gray-300 hover:bg-gray-50"}`}>{p}</button>
                            )}
                            <button onClick={() => setPage(p => p + 1)} disabled={page === totalPages} className="px-2.5 py-1.5 text-xs border border-gray-300 rounded-lg disabled:opacity-40 hover:bg-gray-50">Next →</button>
                        </div>
                    </div>
                )}
            </div>

            {/* Modals & Drawers */}
            {detailLeave && (
                <LeaveDetailDrawer leave={detailLeave} onClose={() => setDetailLeave(null)} onOpenDoc={doc => handleOpenDoc(detailLeave.id, doc)} />
            )}
            {viewerDoc && (
                <DocViewerModal url={viewerDoc.url} fileName={viewerDoc.fileName} mimeType={viewerDoc.mimeType} onClose={() => setViewerDoc(null)} />
            )}
            {rejectLeave && (
                <RejectModal leave={rejectLeave} onClose={() => setRejectLeave(null)} onConfirm={handleRejectConfirm} loading={actionLoading} />
            )}
            {cancelLeave && (
                <LeaveCancellationModal
                    leave={cancelLeave}
                    isApproved={cancelLeave.status === "APPROVED"}
                    onClose={() => setCancelLeave(null)}
                    onConfirm={handleCancelConfirm}
                    loading={actionLoading}
                />
            )}
            {requestDocLeave && (
                <RequestDocModal
                    leave={requestDocLeave}
                    onClose={() => setRequestDocLeave(null)}
                    onConfirm={handleRequestDocConfirm}
                    loading={actionLoading}
                />
            )}
        </div>
    );
}

// ── Request Document Modal ─────────────────────────────────────────────────

function RequestDocModal({
    leave,
    onClose,
    onConfirm,
    loading,
}: {
    leave: LeaveApplication;
    onClose: () => void;
    onConfirm: (message: string) => void;
    loading: boolean;
}) {
    const [message, setMessage] = useState("");
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
                <h3 className="text-base font-semibold text-gray-900 mb-1">Ask for Info — Leave #{leave.id}</h3>
                <p className="text-sm text-gray-500 mb-4">
                    {leave.student?.user?.firstName} {leave.student?.user?.lastName} — {formatDate(leave.fromDate)} to {formatDate(leave.toDate)}
                </p>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                    Message to Parent <span className="text-red-500">*</span>
                    <span className="ml-1 text-xs text-gray-400 font-normal">(min 10 characters)</span>
                </label>
                <textarea
                    value={message}
                    onChange={e => setMessage(e.target.value)}
                    rows={4}
                    maxLength={500}
                    placeholder="e.g. Please upload a medical certificate from a registered doctor confirming the illness."
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 resize-none"
                />
                <p className="text-xs text-gray-400 text-right mb-4">{message.length}/500</p>
                <div className="flex gap-3">
                    <button onClick={onClose} className="flex-1 py-2.5 border border-gray-300 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">Cancel</button>
                    <button
                        onClick={() => message.trim().length >= 10 && onConfirm(message.trim())}
                        disabled={message.trim().length < 10 || loading}
                        className="flex-1 py-2.5 bg-orange-500 text-white rounded-xl text-sm font-medium hover:bg-orange-600 disabled:opacity-50 transition-colors"
                    >
                        {loading ? "Sending…" : "Send Request"}
                    </button>
                </div>
            </div>
        </div>
    );
}

// ── Action Buttons ─────────────────────────────────────────────────────────

function ActionButtons({
    leave,
    rbac,
    actionLoading,
    onView,
    onFirstApprove,
    onSecondApprove,
    onReject,
    onCancel,
    onRequestDoc,
}: {
    leave: LeaveApplication;
    rbac: ReturnType<typeof useRbac>;
    actionLoading: boolean;
    onView: () => void;
    onFirstApprove: () => void;
    onSecondApprove: () => void;
    onReject: () => void;
    onCancel: () => void;
    onRequestDoc: () => void;
}) {
    return (
        <div className="flex flex-wrap items-center gap-1.5">
            <button onClick={onView} className="px-2.5 py-1 text-xs bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors">View</button>

            {/* Teacher: first-approve PENDING */}
            {rbac.isTeacher && leave.status === "PENDING" && (
                <button onClick={onFirstApprove} disabled={actionLoading} className="px-2.5 py-1 text-xs bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 disabled:opacity-50 transition-colors">1st Approve</button>
            )}

            {/* Admin: second-approve FIRST_APPROVED */}
            {rbac.isSubAdmin && leave.status === "FIRST_APPROVED" && (
                <button onClick={onSecondApprove} disabled={actionLoading} className="px-2.5 py-1 text-xs bg-green-100 text-green-700 rounded-lg hover:bg-green-200 disabled:opacity-50 transition-colors">Final Approve</button>
            )}

            {/* Teacher/Admin: request document on active leaves */}
            {rbac.isTeacher && (leave.status === "PENDING" || leave.status === "FIRST_APPROVED") && !leave.isActionRequired && (
                <button onClick={onRequestDoc} disabled={actionLoading} className="px-2.5 py-1 text-xs bg-orange-100 text-orange-700 rounded-lg hover:bg-orange-200 disabled:opacity-50 transition-colors">Ask for Info</button>
            )}

            {/* Teacher: reject PENDING or FIRST_APPROVED */}
            {rbac.isTeacher && (leave.status === "PENDING" || leave.status === "FIRST_APPROVED") && (
                <button onClick={onReject} disabled={actionLoading} className="px-2.5 py-1 text-xs bg-red-100 text-red-700 rounded-lg hover:bg-red-200 disabled:opacity-50 transition-colors">Reject</button>
            )}

            {/* Admin: cancel only APPROVED leaves (to revert attendance) — PENDING/FIRST_APPROVED should be Rejected instead */}
            {rbac.isSubAdmin && leave.status === "APPROVED" && (
                <button onClick={onCancel} disabled={actionLoading} className="px-2.5 py-1 text-xs bg-amber-100 text-amber-700 rounded-lg hover:bg-amber-200 disabled:opacity-50 transition-colors">Cancel</button>
            )}
        </div>
    );
}
