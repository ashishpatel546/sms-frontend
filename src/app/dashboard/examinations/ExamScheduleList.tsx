"use client";

import { useState, useEffect, useCallback } from "react";
import useSWR from "swr";
import Table from "@/components/Table";
import { API_BASE_URL, fetcher } from "@/lib/api";
import { authFetch } from "@/lib/auth";
import { useRbac } from "@/lib/rbac";
import toast, { Toaster } from "react-hot-toast";

export default function ExamScheduleList({ onView }: { onView: (id: number) => void }) {
    const rbac = useRbac();

    const [schedules, setSchedules] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);

    // Filter states
    const [searchSessionId, setSearchSessionId] = useState("");
    const [searchStatus, setSearchStatus] = useState("");
    const [searchIsActive, setSearchIsActive] = useState("");

    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

    const { data: sessions } = useSWR(`${API_BASE_URL}/academic-sessions`, fetcher);

    const fetchSchedules = useCallback(async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            if (searchSessionId) params.append("academicSessionId", searchSessionId);
            if (searchStatus) params.append("status", searchStatus);
            if (searchIsActive) params.append("isActive", searchIsActive);

            const res = await authFetch(`${API_BASE_URL}/exam-schedules?${params.toString()}`);
            if (res.ok) {
                const data = await res.json();
                setSchedules(Array.isArray(data) ? data : []);
            }
        } catch {
            toast.error("Failed to fetch exam schedules");
        } finally {
            setLoading(false);
        }
    }, [searchSessionId, searchStatus, searchIsActive]);

    useEffect(() => {
        fetchSchedules();
    }, [fetchSchedules]);

    const columns = [
        { header: "ID", accessor: "id", sortable: true },
        { header: "Session", render: (row: any) => row.academicSession?.name ?? "-" },
        { header: "Exam Category", render: (row: any) => row.examCategory?.name ?? "-" },
        {
            header: "Date Range",
            render: (row: any) => (
                <span className="text-sm text-gray-600">
                    {row.startDate ?? ""} &rarr; {row.endDate ?? ""}
                </span>
            ),
        },
        {
            header: "Status",
            render: (row: any) => (
                <span className={`px-2 py-0.5 rounded text-xs font-semibold ${row.status === "PUBLISHED" ? "bg-green-100 text-green-800" : "bg-yellow-100 text-yellow-800"}`}>
                    {row.status}
                </span>
            ),
        },
        {
            header: "Active",
            render: (row: any) => (
                <span className={`px-2 py-0.5 rounded text-xs font-semibold ${row.isActive ? "bg-blue-100 text-blue-800" : "bg-gray-100 text-gray-500"}`}>
                    {row.isActive ? "Yes" : "No"}
                </span>
            ),
        },
        {
            header: "Actions",
            render: (row: any) => (
                <button
                    onClick={() => onView(row.id)}
                    title="View Schedule"
                    className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                </button>
            ),
        },
    ];

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        fetchSchedules();
    };

    const handleReset = () => {
        setSearchSessionId("");
        setSearchStatus("");
        setSearchIsActive("");
    };

    return (
        <div>
            <Toaster position="top-right" />
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold text-gray-800">Exam Schedules</h2>
                {rbac.isSubAdmin && (
                    <button
                        onClick={() => setIsCreateModalOpen(true)}
                        className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                        </svg>
                        New Schedule
                    </button>
                )}
            </div>

            {/* Filters */}
            <form onSubmit={handleSearch} className="bg-gray-50 rounded-lg p-4 mb-4 border border-gray-200">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
                    <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Academic Session</label>
                        <select
                            value={searchSessionId}
                            onChange={e => setSearchSessionId(e.target.value)}
                            className="w-full p-2 text-sm border border-gray-300 rounded-md bg-white focus:ring-blue-500 focus:border-blue-500"
                        >
                            <option value="">All Sessions</option>
                            {sessions?.map((s: any) => (
                                <option key={s.id} value={s.id}>{s.name}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Status</label>
                        <select
                            value={searchStatus}
                            onChange={e => setSearchStatus(e.target.value)}
                            className="w-full p-2 text-sm border border-gray-300 rounded-md bg-white focus:ring-blue-500 focus:border-blue-500"
                        >
                            <option value="">All Statuses</option>
                            <option value="DRAFT">Draft</option>
                            <option value="PUBLISHED">Published</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Active</label>
                        <select
                            value={searchIsActive}
                            onChange={e => setSearchIsActive(e.target.value)}
                            className="w-full p-2 text-sm border border-gray-300 rounded-md bg-white focus:ring-blue-500 focus:border-blue-500"
                        >
                            <option value="">All</option>
                            <option value="true">Active</option>
                            <option value="false">Inactive</option>
                        </select>
                    </div>
                </div>
                <div className="flex gap-2 justify-end">
                    <button
                        type="button"
                        onClick={handleReset}
                        className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                    >
                        Reset
                    </button>
                    <button
                        type="submit"
                        className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
                    >
                        Search
                    </button>
                </div>
            </form>

            <Table
                columns={columns}
                data={schedules}
                loading={loading}
                emptyMessage="No exam schedules found. Create one to get started."
            />

            {isCreateModalOpen && (
                <CreateScheduleModal
                    sessions={sessions || []}
                    onClose={() => setIsCreateModalOpen(false)}
                    onSuccess={() => {
                        setIsCreateModalOpen(false);
                        fetchSchedules();
                    }}
                />
            )}
        </div>
    );
}

function CreateScheduleModal({
    sessions,
    onClose,
    onSuccess,
}: {
    sessions: any[];
    onClose: () => void;
    onSuccess: () => void;
}) {
    const [loading, setLoading] = useState(false);
    const [academicSessionId, setAcademicSessionId] = useState("");
    const [examCategoryId, setExamCategoryId] = useState("");
    const [startDate, setStartDate] = useState("");
    const [endDate, setEndDate] = useState("");

    // Fetch categories only once a session is selected (they are session-scoped)
    const { data: examCategories } = useSWR(
        academicSessionId ? `${API_BASE_URL}/exams/categories?sessionId=${academicSessionId}` : null,
        fetcher
    );

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            const res = await authFetch(`${API_BASE_URL}/exam-schedules`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    academicSessionId: Number(academicSessionId),
                    examCategoryId: Number(examCategoryId),
                    startDate,
                    endDate,
                }),
            });
            if (res.ok) {
                toast.success("Exam schedule created!");
                onSuccess();
            } else {
                const data = await res.json();
                toast.error(data.message || "Failed to create schedule");
            }
        } catch {
            toast.error("Network error");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4">
                <div className="flex justify-between items-center p-6 border-b">
                    <h3 className="text-lg font-semibold text-gray-800">Create Exam Schedule</h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>
                <div className="p-6">
                    <p className="text-sm text-blue-600 bg-blue-50 rounded-md p-3 mb-4">
                        This schedule will cover all classes. You can add per-class exam entries after creation.
                    </p>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Academic Session <span className="text-red-500">*</span>
                            </label>
                            <select
                                required
                                value={academicSessionId}
                                onChange={e => { setAcademicSessionId(e.target.value); setExamCategoryId(""); }}
                                className="w-full p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 text-sm"
                            >
                                <option value="">Select session...</option>
                                {sessions.map((s: any) => (
                                    <option key={s.id} value={s.id}>{s.name}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Exam Category <span className="text-red-500">*</span>
                            </label>
                            <select
                                required
                                value={examCategoryId}
                                onChange={e => setExamCategoryId(e.target.value)}
                                disabled={!academicSessionId}
                                className="w-full p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <option value="">{!academicSessionId ? "Select a session first..." : "Select category..."}</option>
                                {examCategories?.map((c: any) => (
                                    <option key={c.id} value={c.id}>{c.name}</option>
                                ))}
                            </select>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Start Date <span className="text-red-500">*</span>
                                </label>
                                <input
                                    required
                                    type="date"
                                    value={startDate}
                                    onChange={e => setStartDate(e.target.value)}
                                    className="w-full p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 text-sm"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    End Date <span className="text-red-500">*</span>
                                </label>
                                <input
                                    required
                                    type="date"
                                    value={endDate}
                                    min={startDate}
                                    onChange={e => setEndDate(e.target.value)}
                                    className="w-full p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 text-sm"
                                />
                            </div>
                        </div>
                        <div className="flex justify-end gap-2 pt-2">
                            <button
                                type="button"
                                onClick={onClose}
                                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={loading}
                                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
                            >
                                {loading ? "Creating..." : "Create Schedule"}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
}
