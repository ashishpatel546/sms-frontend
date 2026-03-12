"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Table from "../../../components/Table";
import { API_BASE_URL } from "@/lib/api";
import { toast } from "react-hot-toast";
import { useRbac } from "@/lib/rbac";
import { authFetch } from "@/lib/auth";

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

export default function StudentsPage() {
    const [students, setStudents] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [classes, setClasses] = useState<any[]>([]);
    const [sections, setSections] = useState<any[]>([]);
    const [sessions, setSessions] = useState<any[]>([]);
    const rbac = useRbac();

    // Search Params
    const [searchSessionId, setSearchSessionId] = useState("");
    const [searchId, setSearchId] = useState("");
    const [searchFirstName, setSearchFirstName] = useState("");
    const [searchLastName, setSearchLastName] = useState("");
    const [searchEmail, setSearchEmail] = useState("");
    const [searchParents, setSearchParents] = useState("");
    const [searchStatus, setSearchStatus] = useState("");
    const [searchClassId, setSearchClassId] = useState("");
    const [searchSectionId, setSearchSectionId] = useState("");

    const [hasSearched, setHasSearched] = useState(false);

    // Committed params — only updated when Search is clicked, used by column renders
    const [committedSessionId, setCommittedSessionId] = useState("");
    const [committedStatus, setCommittedStatus] = useState("");

    // Pagination
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(25);
    const [total, setTotal] = useState(0);

    const totalPages = Math.ceil(total / pageSize);

    const buildParams = (overridePage?: number) => {
        const params = new URLSearchParams();
        if (searchId) params.append("id", searchId);
        if (searchFirstName) params.append("firstName", searchFirstName);
        if (searchLastName) params.append("lastName", searchLastName);
        if (searchEmail) params.append("email", searchEmail);
        if (searchParents) params.append("parentsName", searchParents);
        if (searchStatus !== "") params.append("enrollmentStatus", searchStatus);
        if (searchClassId) params.append("classId", searchClassId);
        if (searchSectionId) params.append("sectionId", searchSectionId);
        if (searchSessionId) params.append("academicSessionId", searchSessionId);
        params.append("page", String(overridePage ?? page));
        params.append("limit", String(pageSize));
        return params;
    };

    const fetchStudents = async (overridePage?: number) => {
        setLoading(true);
        try {
            const params = buildParams(overridePage);
            const res = await authFetch(`${API_BASE_URL}/students?${params.toString()}`);
            if (res.ok) {
                const data = await res.json();
                if (data && data.data) {
                    setStudents(data.data);
                    setTotal(data.total);
                    setPage(data.page);
                } else {
                    setStudents(Array.isArray(data) ? data : []);
                    setTotal(Array.isArray(data) ? data.length : 0);
                }
                setHasSearched(true);
                setCommittedSessionId(searchSessionId);
                setCommittedStatus(searchStatus);
            }
        } catch (err) {
            toast.error("Failed to fetch students");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        Promise.all([
            authFetch(`${API_BASE_URL}/classes`).then(r => r.json()),
            authFetch(`${API_BASE_URL}/academic-sessions`).then(r => r.json())
        ]).then(([classesData, sessionsData]) => {
            setClasses(Array.isArray(classesData) ? classesData : []);
            setSessions(Array.isArray(sessionsData) ? sessionsData : []);
            const activeSession = sessionsData.find((s: any) => s.isActive);
            if (activeSession) setSearchSessionId(activeSession.id.toString());
        }).catch(() => { });
    }, []);

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        setPage(1);
        fetchStudents(1);
    };

    const handleClassChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const val = e.target.value;
        setSearchClassId(val);
        setSearchSectionId("");
        if (val) {
            const cls = classes.find((c: any) => c.id === parseInt(val));
            setSections(cls?.sections || []);
        } else {
            setSections([]);
        }
    };

    const handleReset = () => {
        setSearchId("");
        setSearchFirstName("");
        setSearchLastName("");
        setSearchEmail("");
        setSearchParents("");
        setSearchStatus("");
        setSearchClassId("");
        setSearchSectionId("");
        const activeSession = sessions.find((s: any) => s.isActive);
        setSearchSessionId(activeSession ? activeSession.id.toString() : "");
        setSections([]);
        setStudents([]);
        setHasSearched(false);
        setCommittedSessionId("");
        setCommittedStatus("");
        setPage(1);
        setTotal(0);
    };

    const handlePageChange = (newPage: number) => {
        if (newPage < 1 || newPage > totalPages) return;
        setPage(newPage);
        fetchStudents(newPage);
    };

    const handlePageSizeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const newSize = parseInt(e.target.value);
        setPageSize(newSize);
        setPage(1);
        // Re-fetch with new page size — use setTimeout to let state settle
        setTimeout(() => fetchStudents(1), 0);
    };

    const columns = [
        { header: "ID", accessor: "id", sortable: true },
        {
            header: "Roll No",
            sortable: true,
            render: (row: any) => {
                const enrollment = row.enrollments?.find((e: any) => e.academicSession?.id === parseInt(committedSessionId))
                    ?? (committedStatus ? row.enrollments?.find((e: any) => e.status === committedStatus) : undefined)
                    ?? row.enrollments?.find((e: any) => e.status === 'ACTIVE');
                const rollNo = enrollment?.rollNo ?? row.rollNo;
                return (rollNo && rollNo !== 0) ? rollNo : 'N/A';
            }
        },
        { header: "First Name", accessor: "firstName", sortable: true },
        { header: "Last Name", accessor: "lastName", sortable: true },
        {
            header: "Class / Section",
            render: (row: any) => {
                const enrollment = row.enrollments?.find((e: any) => e.academicSession?.id === parseInt(searchSessionId))
                    ?? (committedStatus ? row.enrollments?.find((e: any) => e.status === committedStatus) : undefined);
                if (enrollment) {
                    return `${enrollment.class?.name || '-'} ${enrollment.section ? '- ' + enrollment.section.name : ''}`;
                }
                return row.class ? `${row.class.name} ${row.section ? '- ' + row.section.name : ''}` : '-';
            }
        },
        {
            header: "Subjects",
            render: (row: any) => row.studentSubjects && row.studentSubjects.length > 0
                ? row.studentSubjects.map((ss: any) => (ss.subject || ss.extraSubject)?.name).filter(Boolean).join(', ')
                : '-'
        },
        {
            header: "Status",
            render: (row: any) => {
                const enrollment = row.enrollments?.find((e: any) => e.academicSession?.id === parseInt(committedSessionId))
                    ?? (committedStatus ? row.enrollments?.find((e: any) => e.status === committedStatus) : undefined)
                    ?? row.enrollments?.find((e: any) => e.status === 'ACTIVE');
                let displayStatus = enrollment ? enrollment.status : (row.isActive ? 'ACTIVE' : 'INACTIVE');

                let colorClass = 'bg-slate-100 text-slate-800';
                if (displayStatus === 'ACTIVE') colorClass = 'bg-green-100 text-green-800';
                else if (displayStatus === 'PROMOTED') colorClass = 'bg-blue-100 text-blue-800';
                else if (displayStatus === 'ALUMNI') colorClass = 'bg-purple-100 text-purple-800';
                else if (displayStatus === 'WITHDRAWN' || displayStatus === 'INACTIVE') colorClass = 'bg-red-100 text-red-800';

                return (
                    <span className={`px-2.5 py-1 text-xs font-semibold rounded-full ${colorClass}`}>
                        {displayStatus}
                    </span>
                );
            }
        },
        {
            header: "Actions",
            render: (row: any) => rbac.canManageStudents ? (
                <Link href={`/dashboard/students/${row.id}/edit`} className="font-medium text-blue-600 hover:underline">Edit</Link>
            ) : (
                <Link href={`/dashboard/students/${row.id}/edit`} className="font-medium text-slate-400 text-xs">View</Link>
            )
        }
    ];

    const getPageNumbers = () => {
        const pages: (number | '...')[] = [];
        if (totalPages <= 7) {
            for (let i = 1; i <= totalPages; i++) pages.push(i);
        } else {
            pages.push(1);
            if (page > 3) pages.push('...');
            const start = Math.max(2, page - 1);
            const end = Math.min(totalPages - 1, page + 1);
            for (let i = start; i <= end; i++) pages.push(i);
            if (page < totalPages - 2) pages.push('...');
            pages.push(totalPages);
        }
        return pages;
    };

    return (
        <main className="p-4 bg-slate-50 min-h-screen">
            <div className="max-w-7xl mx-auto">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
                    <h1 className="text-2xl font-bold text-slate-800">Students Management</h1>
                    <div className="flex flex-wrap gap-2 w-full sm:w-auto">
                        {rbac.canBulkOperateStudents && (
                            <Link href="/dashboard/students/promotions" className="flex-1 sm:flex-none text-center text-white bg-amber-600 hover:bg-amber-700 focus:ring-4 focus:ring-amber-300 font-medium rounded-lg text-sm px-5 py-2.5 focus:outline-none whitespace-nowrap">
                                Bulk Promotions
                            </Link>
                        )}
                        {rbac.canManageStudents && (
                            <Link href="/dashboard/students/new" className="flex-1 sm:flex-none text-center text-white bg-blue-700 hover:bg-blue-800 focus:ring-4 focus:ring-blue-300 font-medium rounded-lg text-sm px-5 py-2.5 focus:outline-none whitespace-nowrap">
                                Add Student
                            </Link>
                        )}
                    </div>
                </div>

                {/* Advanced Search Filter */}
                <div className="bg-white p-5 rounded-lg shadow-sm border border-slate-200 mb-6">
                    <h2 className="text-lg font-semibold text-slate-700 mb-4">Search Students</h2>
                    <form onSubmit={handleSearch}>
                        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-4">
                            <div>
                                <label className="block text-xs font-medium text-gray-700 mb-1">Student ID</label>
                                <input type="text" value={searchId} onChange={e => setSearchId(e.target.value)} className="bg-gray-50 border border-gray-300 text-sm rounded-lg w-full p-2" placeholder="e.g. 1" />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-700 mb-1">First Name</label>
                                <input type="text" value={searchFirstName} onChange={e => setSearchFirstName(e.target.value)} className="bg-gray-50 border border-gray-300 text-sm rounded-lg w-full p-2" placeholder="First Name" />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-700 mb-1">Last Name</label>
                                <input type="text" value={searchLastName} onChange={e => setSearchLastName(e.target.value)} className="bg-gray-50 border border-gray-300 text-sm rounded-lg w-full p-2" placeholder="Last Name" />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-700 mb-1">Email</label>
                                <input type="text" value={searchEmail} onChange={e => setSearchEmail(e.target.value)} className="bg-gray-50 border border-gray-300 text-sm rounded-lg w-full p-2" placeholder="Email Address" />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-700 mb-1">Parent's Name</label>
                                <input type="text" value={searchParents} onChange={e => setSearchParents(e.target.value)} className="bg-gray-50 border border-gray-300 text-sm rounded-lg w-full p-2" placeholder="Mother or Father" />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-700 mb-1">Status</label>
                                <select value={searchStatus} onChange={e => setSearchStatus(e.target.value)} className="bg-gray-50 border border-gray-300 text-sm rounded-lg w-full p-2">
                                    <option value="">All</option>
                                    <option value="ACTIVE">Active</option>
                                    <option value="PROMOTED">Promoted</option>
                                    <option value="ALUMNI">Alumni</option>
                                    <option value="WITHDRAWN">Withdrawn</option>
                                    <option value="GRADUATED">Graduated</option>
                                </select>
                            </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-4">
                            <div>
                                <label className="block text-xs font-medium text-gray-700 mb-1">Academic Year</label>
                                <select value={searchSessionId} onChange={e => setSearchSessionId(e.target.value)} className="bg-gray-50 border border-gray-300 text-sm rounded-lg w-full p-2">
                                    <option value="">All Sessions</option>
                                    {sessions.map((s: any) => (
                                        <option key={s.id} value={s.id}>{s.name} {s.isActive ? '(Active)' : ''}</option>
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
                                <select value={searchSectionId} onChange={e => setSearchSectionId(e.target.value)} disabled={!searchClassId} className="bg-gray-50 border border-gray-300 text-sm rounded-lg w-full p-2 disabled:opacity-50 disabled:cursor-not-allowed">
                                    <option value="">All Sections</option>
                                    {sections.map((s: any) => (
                                        <option key={s.id} value={s.id}>{s.name}</option>
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
                        <div className="text-center py-12 text-slate-500">
                            <svg className="mx-auto h-12 w-12 text-slate-400 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                            </svg>
                            <h3 className="text-lg font-medium text-slate-900 mb-1">Find Students</h3>
                            <p className="text-sm">Please apply filters and click Search to view the student list.</p>
                        </div>
                    ) : (
                        <>
                            <Table
                                columns={columns}
                                data={students}
                                loading={loading}
                                defaultSortColumn="id"
                                defaultSortDirection="asc"
                                emptyMessage="No students found matching the search criteria."
                            />

                            {/* Pagination Controls */}
                            {!loading && total > 0 && (
                                <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-4 pt-4 border-t border-slate-200">
                                    <div className="flex items-center gap-2 text-sm text-slate-600">
                                        <span>Rows per page:</span>
                                        <select
                                            value={pageSize}
                                            onChange={handlePageSizeChange}
                                            className="border border-gray-300 rounded-md text-sm p-1"
                                        >
                                            {PAGE_SIZE_OPTIONS.map(opt => (
                                                <option key={opt} value={opt}>{opt}</option>
                                            ))}
                                        </select>
                                        <span className="ml-2">
                                            {Math.min((page - 1) * pageSize + 1, total)}–{Math.min(page * pageSize, total)} of {total}
                                        </span>
                                    </div>

                                    <div className="flex items-center gap-1">
                                        <button
                                            onClick={() => handlePageChange(page - 1)}
                                            disabled={page === 1}
                                            className="px-3 py-1.5 text-sm rounded-md border border-gray-300 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                                        >
                                            ← Prev
                                        </button>

                                        {getPageNumbers().map((p, idx) =>
                                            p === '...' ? (
                                                <span key={`ellipsis-${idx}`} className="px-2 py-1.5 text-sm text-slate-400">…</span>
                                            ) : (
                                                <button
                                                    key={p}
                                                    onClick={() => handlePageChange(p as number)}
                                                    className={`px-3 py-1.5 text-sm rounded-md border ${page === p
                                                        ? 'bg-blue-600 text-white border-blue-600'
                                                        : 'border-gray-300 hover:bg-gray-50'
                                                        }`}
                                                >
                                                    {p}
                                                </button>
                                            )
                                        )}

                                        <button
                                            onClick={() => handlePageChange(page + 1)}
                                            disabled={page === totalPages}
                                            className="px-3 py-1.5 text-sm rounded-md border border-gray-300 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                                        >
                                            Next →
                                        </button>
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>
        </main>
    );
}
