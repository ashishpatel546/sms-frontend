"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import useSWR from "swr";
import Table from "../../../components/Table";
import { API_BASE_URL, fetcher } from "@/lib/api";
import StudentResultModal from "@/components/Examinations/StudentResultModal";
import { authFetch } from "@/lib/auth";
import { useRbac } from "@/lib/rbac";
import ExamScheduleTab from "./ExamScheduleTab";
import { ClipboardList, Calendar, MoreVertical } from "lucide-react";

export default function ExaminationsPage() {
    const [activeTab, setActiveTab] = useState<"results" | "schedule">("results");
    const [hasScheduleTabMounted, setHasScheduleTabMounted] = useState(false);

    const [students, setStudents] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [hasSearched, setHasSearched] = useState(false);
    const [page, setPage] = useState(1);
    const [limit, setLimit] = useState(10);
    const [total, setTotal] = useState(0);
    const [classes, setClasses] = useState<any[]>([]);
    const [sections, setSections] = useState<any[]>([]);
    const [loadingSections, setLoadingSections] = useState(false);
    const [sessions, setSessions] = useState<any[]>([]);
    const [categories, setCategories] = useState<any[]>([]);

    // Search Params
    const [searchSessionId, setSearchSessionId] = useState("");
    const [searchId, setSearchId] = useState("");
    const [searchFirstName, setSearchFirstName] = useState("");
    const [searchClassId, setSearchClassId] = useState("");
    const [searchSectionId, setSearchSectionId] = useState("");

    // Category filter
    const [selectedCategoryId, setSelectedCategoryId] = useState("");

    // Modal state
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedStudentId, setSelectedStudentId] = useState<number | null>(null);
    const [actionMode, setActionMode] = useState<'view' | 'enter' | 'admin-edit'>('view');

    // Three-dot action menu
    const [openActionRowId, setOpenActionRowId] = useState<number | null>(null);
    const actionMenuRef = useRef<HTMLDivElement>(null);

    const rbac = useRbac();

    const fetchStudents = async (overrideSessionId?: string, overridePage?: number) => {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            if (searchId) params.append("id", searchId);
            if (searchFirstName) params.append("firstName", searchFirstName);
            if (searchClassId) params.append("classId", searchClassId);
            if (searchSectionId) params.append("sectionId", searchSectionId);

            const sessionToUse = overrideSessionId !== undefined ? overrideSessionId : searchSessionId;
            if (sessionToUse) params.append("academicSessionId", sessionToUse);

            const pageToUse = overridePage || page;
            params.append("page", pageToUse.toString());
            params.append("limit", limit.toString());

            const res = await authFetch(`${API_BASE_URL}/exams/dashboard?${params.toString()}`);
            if (res.ok) {
                const data = await res.json();
                if (data.data) {
                    setStudents(data.data);
                    setTotal(data.total);
                } else {
                    setStudents(data);
                    setTotal(data.length);
                }
            }
        } catch (err) {
            console.error("Failed to fetch students", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        Promise.all([
            authFetch(`${API_BASE_URL}/classes/names-only`).then(r => r.json()),
            authFetch(`${API_BASE_URL}/academic-sessions`).then(r => r.json()),
        ]).then(([classesData, sessionsData]) => {
            setClasses(Array.isArray(classesData) ? classesData : []);
            setSessions(Array.isArray(sessionsData) ? sessionsData : []);
            const activeSession = sessionsData.find((s: any) => s.isActive);
            if (activeSession) {
                const activeId = activeSession.id.toString();
                setSearchSessionId(activeId);
            }
        }).catch(() => { });
    }, []);

    useEffect(() => {
        if (!searchSessionId) {
            setCategories([]);
            setSelectedCategoryId("");
            return;
        }
        authFetch(`${API_BASE_URL}/exams/categories/active?sessionId=${searchSessionId}`)
            .then(r => r.json())
            .then(data => {
                setCategories(Array.isArray(data) ? data : []);
                setSelectedCategoryId("");
            })
            .catch(() => setCategories([]));
    }, [searchSessionId]);

    // Close action menu on outside click
    useEffect(() => {
        const handleOutsideClick = (e: MouseEvent) => {
            if (actionMenuRef.current && !actionMenuRef.current.contains(e.target as Node)) {
                setOpenActionRowId(null);
            }
        };
        document.addEventListener('mousedown', handleOutsideClick);
        return () => document.removeEventListener('mousedown', handleOutsideClick);
    }, []);

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        setHasSearched(true);
        setPage(1);
        fetchStudents(undefined, 1);
    };

    const handleClassChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
        const val = e.target.value;
        setSearchClassId(val);
        setSearchSectionId("");
        setSections([]);
        if (!val) return;
        setLoadingSections(true);
        try {
            const res = await authFetch(`${API_BASE_URL}/classes/${val}/sections`);
            if (res.ok) setSections(await res.json());
        } catch (_e) {
            console.error('Failed to fetch sections');
        } finally {
            setLoadingSections(false);
        }
    };

    const handleReset = () => {
        setSearchId("");
        setSearchFirstName("");
        setSearchClassId("");
        setSearchSectionId("");
        const activeSession = sessions.find((s: any) => s.isActive);
        const activeId = activeSession ? activeSession.id.toString() : "";
        setSearchSessionId(activeId);
        setSections([]);
        setHasSearched(false);
        setStudents([]);
        setPage(1);
        setTotal(0);
    };

    const totalPages = Math.ceil(total / limit);

    const defaultCatId = selectedCategoryId ? parseInt(selectedCategoryId) : undefined;

    const visibleCategories = selectedCategoryId
        ? categories.filter(cat => cat.id === parseInt(selectedCategoryId))
        : categories;

    let dynamicColumns: any[] = [];
    visibleCategories.forEach(cat => {
        dynamicColumns.push({
            header: `${cat.name} %`,
            accessor: `category_${cat.id}_percentage`,
            sortable: true,
            render: (row: any) => row[`category_${cat.id}_percentage`] != null ? `${row[`category_${cat.id}_percentage`]}%` : '-'
        });
    });

    const openModal = (studentId: number, mode: 'view' | 'enter' | 'admin-edit') => {
        setSelectedStudentId(studentId);
        setActionMode(mode);
        setIsModalOpen(true);
        setOpenActionRowId(null);
    };

    const columns = [
        { header: "Roll No", accessor: "rollNo", sortable: true, render: (row: any) => (row.rollNo && row.rollNo !== 0) ? row.rollNo : 'N/A' },
        { header: "ID", accessor: "id", sortable: true },
        { header: "Name", accessor: "firstName", render: (row: any) => `${row.firstName} ${row.lastName}` },
        {
            header: "Class / Section",
            render: (row: any) => row.class ? `${row.class.name} ${row.section ? '- ' + row.section.name : ''}` : '-'
        },
        ...dynamicColumns,
        {
            header: "Action",
            render: (row: any) => (
                <div className="relative" ref={openActionRowId === row.id ? actionMenuRef : undefined}>
                    <button
                        onClick={(e) => { e.stopPropagation(); setOpenActionRowId(openActionRowId === row.id ? null : row.id); }}
                        className="p-1.5 rounded-full hover:bg-gray-100 transition-colors"
                        title="Actions"
                    >
                        <MoreVertical className="w-4 h-4 text-gray-500" />
                    </button>
                    {openActionRowId === row.id && (
                        <div className="absolute right-0 z-20 mt-1 w-40 bg-white border border-gray-200 rounded-lg shadow-lg py-1">
                            <button
                                onClick={() => openModal(row.id, 'enter')}
                                className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                            >
                                Enter Marks
                            </button>
                            {rbac.isAdmin && (
                                <button
                                    onClick={() => openModal(row.id, 'admin-edit')}
                                    className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                                >
                                    Edit Marks
                                </button>
                            )}
                        </div>
                    )}
                </div>
            )
        },
        {
            header: "Results",
            render: (row: any) => (
                <button
                    onClick={() => openModal(row.id, 'view')}
                    className="flex items-center gap-1 font-medium text-blue-600 hover:text-blue-800 transition-colors"
                    title="View Result"
                >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                    <span>View</span>
                </button>
            )
        }
    ];

    return (
        <main className="p-4 bg-slate-50 min-h-screen">
            <div className="max-w-7xl mx-auto">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-4">
                    <h1 className="text-2xl font-bold text-slate-800">Examinations</h1>
                    <Link href="/dashboard/examinations/data-entry" className="text-white bg-blue-700 hover:bg-blue-800 focus:ring-4 focus:ring-blue-300 font-medium rounded-lg text-sm px-5 py-2.5 focus:outline-none w-full sm:w-auto text-center whitespace-nowrap">
                        Bulk Data Entry
                    </Link>
                </div>

                {/* Tabs */}
                <div className="flex p-1 bg-slate-100 rounded-xl mb-6 w-fit shadow-inner border border-slate-200/60">
                    <button
                        onClick={() => setActiveTab("results")}
                        className={`flex items-center gap-2 px-5 py-2.5 text-sm font-medium rounded-lg transition-all duration-200 ${
                            activeTab === "results"
                                ? "bg-white text-blue-700 shadow-sm ring-1 ring-black/5"
                                : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/50"
                        }`}
                    >
                        <ClipboardList className="w-4 h-4" />
                        Results & Marks
                    </button>
                    <button
                        onClick={() => {
                            setActiveTab("schedule");
                            if (!hasScheduleTabMounted) setHasScheduleTabMounted(true);
                        }}
                        className={`flex items-center gap-2 px-5 py-2.5 text-sm font-medium rounded-lg transition-all duration-200 ${
                            activeTab === "schedule"
                                ? "bg-white text-blue-700 shadow-sm ring-1 ring-black/5"
                                : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/50"
                        }`}
                    >
                        <Calendar className="w-4 h-4" />
                        Exam Schedule
                    </button>
                </div>

                <div className={activeTab === "results" ? "block" : "hidden"}>
                    <div className="bg-white p-5 rounded-lg shadow-sm border border-slate-200 mb-6">
                        <h2 className="text-lg font-semibold text-slate-700 mb-4">Search Students</h2>
                    <form onSubmit={handleSearch}>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
                            <div>
                                <label className="block text-xs font-medium text-gray-700 mb-1">Student ID</label>
                                <input type="text" value={searchId} onChange={e => setSearchId(e.target.value)} className="bg-gray-50 border border-gray-300 text-sm rounded-lg w-full p-2" placeholder="e.g. 1" />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-700 mb-1">Name</label>
                                <input type="text" value={searchFirstName} onChange={e => setSearchFirstName(e.target.value)} className="bg-gray-50 border border-gray-300 text-sm rounded-lg w-full p-2" placeholder="Name" />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-700 mb-1">Academic Session</label>
                                <select value={searchSessionId} onChange={e => setSearchSessionId(e.target.value)} className="bg-gray-50 border border-gray-300 text-sm rounded-lg w-full p-2">
                                    <option value="">All Sessions</option>
                                    {sessions.map((s: any) => (
                                        <option key={s.id} value={s.id}>{s.name}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-700 mb-1">Class</label>
                                <select value={searchClassId} onChange={handleClassChange} className="bg-gray-50 border border-gray-300 text-sm rounded-lg w-full p-2">
                                    <option value="">All Classes</option>
                                    {classes.map((c: any) => (
                                        <option key={c.id} value={c.id}>{c.name}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-700 mb-1">Section</label>
                                <select value={searchSectionId} onChange={e => setSearchSectionId(e.target.value)} disabled={!searchClassId || loadingSections} className="bg-gray-50 border border-gray-300 text-sm rounded-lg w-full p-2 disabled:opacity-50 disabled:cursor-not-allowed">
                                    <option value="">{loadingSections ? 'Loading sections...' : 'All Sections'}</option>
                                    {sections.map((s: any) => (
                                        <option key={s.id} value={s.id}>{s.name}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-700 mb-1">Exam Category</label>
                                <select value={selectedCategoryId} onChange={e => setSelectedCategoryId(e.target.value)} disabled={categories.length === 0} className="bg-gray-50 border border-gray-300 text-sm rounded-lg w-full p-2 disabled:opacity-50 disabled:cursor-not-allowed">
                                    <option value="">All Categories</option>
                                    {categories.map((c: any) => (
                                        <option key={c.id} value={c.id}>{c.name}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                        <div className="flex justify-end gap-2">
                            <button type="button" onClick={handleReset} className="px-5 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:ring-4 focus:ring-gray-200">
                                Reset
                            </button>
                            <button type="submit" className="px-5 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 focus:ring-4 focus:ring-blue-300">
                                Search
                            </button>
                        </div>
                    </form>
                </div>

                <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200">
                    {!hasSearched ? (
                        <div className="text-center py-10 text-gray-500">
                            Please click Search to view student examination records.
                        </div>
                    ) : (
                        <>
                            <Table
                                columns={columns}
                                data={students}
                                loading={loading}
                                defaultSortColumn="rollNo"
                                defaultSortDirection="asc"
                                emptyMessage="No students found matching the search criteria."
                            />

                            {/* Pagination Controls */}
                            {total > 0 && (
                                <div className="flex flex-col sm:flex-row items-center justify-between border-t border-gray-200 mt-4 pt-4">
                                    <div className="text-sm text-gray-500 mb-2 sm:mb-0">
                                        Showing <span className="font-semibold text-gray-900">{(page - 1) * limit + 1}</span> to <span className="font-semibold text-gray-900">{Math.min(page * limit, total)}</span> of <span className="font-semibold text-gray-900">{total}</span> Students
                                    </div>
                                    <div className="inline-flex rounded-md shadow-sm" role="group">
                                        <button
                                            type="button"
                                            onClick={() => {
                                                const newPage = Math.max(page - 1, 1);
                                                setPage(newPage);
                                                fetchStudents(undefined, newPage);
                                            }}
                                            disabled={page === 1 || loading}
                                            className="px-4 py-2 text-sm font-medium text-gray-900 bg-white border border-gray-200 rounded-l-lg hover:bg-gray-100 focus:z-10 focus:ring-2 focus:ring-blue-700 focus:text-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            Previous
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                const newPage = Math.min(page + 1, totalPages);
                                                setPage(newPage);
                                                fetchStudents(undefined, newPage);
                                            }}
                                            disabled={page >= totalPages || loading}
                                            className="px-4 py-2 text-sm font-medium text-gray-900 bg-white border border-gray-200 rounded-r-md hover:bg-gray-100 focus:z-10 focus:ring-2 focus:ring-blue-700 focus:text-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            Next
                                        </button>
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </div>                </div>

                <div className={activeTab === "schedule" ? "block" : "hidden"}>
                    {hasScheduleTabMounted && <ExamScheduleTab />}
                </div>            </div>

            {isModalOpen && searchSessionId && selectedStudentId && (
                <StudentResultModal
                    studentId={selectedStudentId}
                    sessionId={parseInt(searchSessionId)}
                    mode={actionMode}
                    defaultCategoryId={defaultCatId}
                    onClose={() => { setIsModalOpen(false); setActionMode('view'); }}
                    onSave={() => fetchStudents()}
                />
            )}
        </main>
    );
}
