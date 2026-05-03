"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Papa from "papaparse";
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
    const [loadingSections, setLoadingSections] = useState(false);
    const [sessions, setSessions] = useState<any[]>([]);
    const rbac = useRbac();

    // Search Params
    const [searchSessionId, setSearchSessionId] = useState("");
    const [searchId, setSearchId] = useState("");
    const [searchFirstName, setSearchFirstName] = useState("");
    const [searchLastName, setSearchLastName] = useState("");
    const [searchEmail, setSearchEmail] = useState("");
    const [searchMobile, setSearchMobile] = useState("");
    const [searchParents, setSearchParents] = useState("");
    const [searchPen, setSearchPen] = useState("");
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

    // Bulk Import Modal State
    const [showBulkModal, setShowBulkModal] = useState(false);
    const [bulkFile, setBulkFile] = useState<File | null>(null);
    const [bulkUploading, setBulkUploading] = useState(false);
    const [bulkResult, setBulkResult] = useState<{ successful: number; failed: number; errors: string[] } | null>(null);
    const [bulkValidation, setBulkValidation] = useState<{ errors: string[]; warnings: string[]; rowCount: number } | null>(null);

    const REQUIRED_HEADERS = ["firstName", "lastName", "gender", "dateOfBirth", "mobile", "category", "religion", "fathersName", "mothersName"];
    const REQUIRED_FIELDS = REQUIRED_HEADERS;
    const DATE_DDMMYYYY = /^\d{2}-\d{2}-\d{4}$/;
    const DATE_YYYYMMDD = /^\d{4}-\d{2}-\d{2}$/;

    const validateBulkFile = (file: File) => {
        setBulkValidation(null);
        const reader = new FileReader();
        reader.onload = (e) => {
            const text = e.target?.result as string;
            const result = Papa.parse<Record<string, string>>(text, { header: true, skipEmptyLines: "greedy" });
            const errors: string[] = [];
            const warnings: string[] = [];

            if (result.errors.length > 0) {
                errors.push(`CSV parse error: ${result.errors[0].message}`);
                setBulkValidation({ errors, warnings, rowCount: 0 });
                return;
            }

            const headers = result.meta.fields ?? [];
            const missingHeaders = REQUIRED_HEADERS.filter(h => !headers.includes(h));
            if (missingHeaders.length > 0) {
                errors.push(`Missing required column(s): ${missingHeaders.join(", ")}`);
            }

            (result.data as Record<string, string>[]).forEach((row, i) => {
                const rowNum = i + 1;
                const missingFields = REQUIRED_FIELDS.filter(f => !row[f]?.trim());
                if (missingFields.length > 0) {
                    errors.push(`Row ${rowNum}: Missing required fields: ${missingFields.join(", ")}`);
                    return;
                }
                const dob = row.dateOfBirth?.trim() ?? "";
                if (dob && !DATE_DDMMYYYY.test(dob) && !DATE_YYYYMMDD.test(dob)) {
                    errors.push(`Row ${rowNum}: dateOfBirth "${dob}" must be DD-MM-YYYY or YYYY-MM-DD`);
                } else if (DATE_DDMMYYYY.test(dob)) {
                    // Warn about auto-conversion
                    warnings.push(`Row ${rowNum}: dateOfBirth "${dob}" is DD-MM-YYYY — will be auto-converted`);
                }
            });

            setBulkValidation({ errors, warnings, rowCount: result.data.length });
        };
        reader.readAsText(file);
    };

    const buildParams = (overridePage?: number) => {
        const params = new URLSearchParams();
        if (searchId) params.append("id", searchId);
        if (searchFirstName) params.append("firstName", searchFirstName);
        if (searchLastName) params.append("lastName", searchLastName);
        if (searchEmail) params.append("email", searchEmail);
        if (searchMobile) params.append("mobile", searchMobile);
        if (searchParents) params.append("parentsName", searchParents);
        if (searchPen) params.append("pen", searchPen);
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
            authFetch(`${API_BASE_URL}/classes/names-only`).then(r => r.json()),
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
        setSections([]);
        if (val) {
            setLoadingSections(true);
            authFetch(`${API_BASE_URL}/classes/${val}/sections`)
                .then(r => r.json())
                .then(data => setSections(Array.isArray(data) ? data : []))
                .catch(() => setSections([]))
                .finally(() => setLoadingSections(false));
        }
    };

    const handleReset = () => {
        setSearchId("");
        setSearchFirstName("");
        setSearchLastName("");
        setSearchEmail("");
        setSearchMobile("");
        setSearchParents("");
        setSearchPen("");
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

    const closeBulkModal = () => {
        setShowBulkModal(false);
        setBulkFile(null);
        setBulkResult(null);
        setBulkValidation(null);
    };

    const handleBulkUpload = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!bulkFile) return;

        setBulkUploading(true);
        setBulkResult(null);
        try {
            const formData = new FormData();
            formData.append("file", bulkFile);

            const res = await authFetch(`${API_BASE_URL}/students/bulk-import`, {
                method: "POST",
                body: formData, // No Content-Type header here, browser sets it with boundary for multipart/form-data
            });

            if (!res.ok) {
                const err = await res.json();
                toast.error(err.message || "Failed to upload file");
            } else {
                const result = await res.json();
                setBulkResult(result);
                
                if (result.successful > 0 && result.failed === 0) {
                    toast.success(`Successfully imported ${result.successful} students`);
                    fetchStudents(1); // Refresh list
                    setTimeout(() => closeBulkModal(), 2000);
                } else if (result.successful > 0) {
                    toast.success(`Partially imported ${result.successful} students. Check errors.`);
                    fetchStudents(1); // Refresh list
                }
            }
        } catch (error) {
            toast.error("An error occurred during bulk import");
        } finally {
            setBulkUploading(false);
        }
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
                const displayStatus = enrollment ? enrollment.status : (row.isActive ? 'ACTIVE' : 'INACTIVE');

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
                        {rbac.canManageStudents && (
                            <button
                                onClick={() => {
                                    setBulkFile(null);
                                    setBulkResult(null);
                                    setShowBulkModal(true);
                                }}
                                className="flex-1 sm:flex-none text-center text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 focus:ring-4 focus:ring-gray-200 font-medium rounded-lg text-sm px-5 py-2.5 focus:outline-none whitespace-nowrap"
                            >
                                Bulk Import
                            </button>
                        )}
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
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mb-4">
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
                                <label className="block text-xs font-medium text-gray-700 mb-1">Mobile Number</label>
                                <input type="text" value={searchMobile} onChange={e => setSearchMobile(e.target.value.replace(/\D/g, ''))} className="bg-gray-50 border border-gray-300 text-sm rounded-lg w-full p-2" placeholder="Exact Mobile No." />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-700 mb-1">Parent's Name</label>
                                <input type="text" value={searchParents} onChange={e => setSearchParents(e.target.value)} className="bg-gray-50 border border-gray-300 text-sm rounded-lg w-full p-2" placeholder="Mother or Father" />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-700 mb-1">PEN (Permanent Enrollment Number)</label>
                                <input type="text" value={searchPen} onChange={e => setSearchPen(e.target.value)} className="bg-gray-50 border border-gray-300 text-sm rounded-lg w-full p-2" placeholder="e.g. 1234567890" />
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
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mb-4">
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
                                <select value={searchSectionId} onChange={e => setSearchSectionId(e.target.value)} disabled={!searchClassId || loadingSections} className="bg-gray-50 border border-gray-300 text-sm rounded-lg w-full p-2 disabled:opacity-50 disabled:cursor-not-allowed">
                                    <option value="">{loadingSections ? "Loading sections..." : "All Sections"}</option>
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

                {/* Bulk Import Modal */}
                {showBulkModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50">
                        <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
                            <div className="flex items-center justify-between p-4 border-b">
                                <h3 className="text-xl font-semibold text-gray-900">Bulk Import Students</h3>
                                <button onClick={closeBulkModal} className="text-gray-400 bg-transparent hover:bg-gray-200 hover:text-gray-900 rounded-lg text-sm w-8 h-8 ms-auto inline-flex justify-center items-center">
                                    <svg className="w-3 h-3" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 14 14">
                                        <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="m1 1 6 6m0 0 6 6M7 7l6-6M7 7l-6 6" />
                                    </svg>
                                </button>
                            </div>
                            <div className="p-4 overflow-y-auto">
                                <div className="mb-4 text-sm text-gray-600 bg-blue-50 p-4 rounded-lg border border-blue-100">
                                    <p className="font-semibold mb-2">CSV Format Requirements:</p>
                                    <ul className="list-disc pl-5 space-y-1">
                                        <li>Must contain headers exactly as shown below (order matters):</li>
                                        <li className="font-mono text-xs bg-gray-100 p-1 rounded overflow-x-auto whitespace-nowrap">firstName,lastName,gender,dateOfBirth,mobile,email,alternateMobile,category,religion,bloodGroup,aadhaarNumber,fathersName,fatherAadhaarNumber,mothersName,motherAadhaarNumber,addressLine1,addressLine2,landmark,city,state,postalCode,country,classId,sectionId,academicSessionId,subjectIds,pen,fatherPan,motherPan,fatherOccupation,motherOccupation,fatherIncome,motherIncome,aparId,abhaId</li>
                                        <li><span className="font-semibold text-red-600">Required:</span> firstName, lastName, gender, dateOfBirth, mobile, fathersName, mothersName, category, religion</li>
                                        <li><span className="font-semibold">Optional fields</span> can be left empty, but the column must still be present.</li>
                                        <li><span className="font-semibold">dateOfBirth:</span> Use format YYYY-MM-DD</li>
                                        <li><span className="font-semibold">subjectIds:</span> Pipe-separated values e.g. <code className="bg-gray-200 px-1 rounded">1|3|4</code></li>
                                        <li><span className="font-semibold">country:</span> Full country name e.g. <code className="bg-gray-200 px-1 rounded">INDIA</code> (leave blank to default to INDIA)</li>
                                    </ul>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            const headers = "firstName,lastName,gender,dateOfBirth,mobile,email,alternateMobile,category,religion,bloodGroup,aadhaarNumber,fathersName,fatherAadhaarNumber,mothersName,motherAadhaarNumber,addressLine1,addressLine2,landmark,city,state,postalCode,country,classId,sectionId,academicSessionId,subjectIds,pen,fatherPan,motherPan,fatherOccupation,motherOccupation,fatherIncome,motherIncome,aparId,abhaId";
                                            const sample = "John,Doe,Male,2010-05-15,9876543210,john.doe@example.com,,General,HINDU,O+,,Ramesh Doe,,Sunita Doe,,12 Main Street,,Near Park,Delhi,Delhi,110001,India,1,1,1,1|2,,,,,,,,,";
                                            const blob = new Blob([headers + "\n" + sample], { type: "text/csv" });
                                            const url = URL.createObjectURL(blob);
                                            const a = document.createElement("a");
                                            a.href = url;
                                            a.download = "students-import-template.csv";
                                            a.click();
                                            URL.revokeObjectURL(url);
                                        }}
                                        className="mt-3 inline-flex items-center gap-1 text-xs text-blue-700 hover:text-blue-900 font-medium underline"
                                    >
                                        ⬇ Download CSV Template
                                    </button>
                                </div>

                                <form onSubmit={handleBulkUpload}>
                                    <label className="block mb-2 text-sm font-medium text-gray-900">Upload CSV File</label>
                                    <input 
                                        type="file" 
                                        accept=".csv"
                                        onChange={(e) => {
                                            const f = e.target.files?.[0] || null;
                                            setBulkFile(f);
                                            setBulkResult(null);
                                            if (f) validateBulkFile(f);
                                            else setBulkValidation(null);
                                        }}
                                        className="block w-full text-sm text-gray-900 border border-gray-300 rounded-lg cursor-pointer bg-gray-50 focus:outline-none p-2 mb-4" 
                                        required
                                    />

                                    {bulkValidation && !bulkResult && (
                                        <div className={`p-4 mb-4 text-sm rounded-lg border ${bulkValidation.errors.length > 0 ? 'bg-red-50 text-red-800 border-red-200' : 'bg-green-50 text-green-800 border-green-200'}`}>
                                            <p className="font-bold mb-1">
                                                {bulkValidation.errors.length > 0
                                                    ? `⚠️ Validation found ${bulkValidation.errors.length} issue(s) in ${bulkValidation.rowCount} row(s)`
                                                    : `✅ File looks good — ${bulkValidation.rowCount} row(s) ready to import`}
                                            </p>
                                            {bulkValidation.errors.length > 0 && (
                                                <div className="mt-2 max-h-40 overflow-y-auto text-xs bg-white p-2 rounded border border-red-100">
                                                    {bulkValidation.errors.map((err, i) => (
                                                        <div key={i} className="mb-1 text-red-600 font-mono">{err}</div>
                                                    ))}
                                                </div>
                                            )}
                                            {bulkValidation.warnings.length > 0 && (
                                                <details className="mt-2">
                                                    <summary className="text-xs cursor-pointer text-amber-700 font-medium">{bulkValidation.warnings.length} auto-conversion note(s)</summary>
                                                    <div className="mt-1 max-h-32 overflow-y-auto text-xs bg-white p-2 rounded border border-amber-100">
                                                        {bulkValidation.warnings.map((w, i) => (
                                                            <div key={i} className="mb-1 text-amber-700 font-mono">{w}</div>
                                                        ))}
                                                    </div>
                                                </details>
                                            )}
                                        </div>
                                    )}

                                    {bulkResult && (
                                        <div className={`p-4 mb-4 text-sm rounded-lg ${bulkResult.failed > 0 ? 'bg-orange-50 text-orange-800 border border-orange-200' : 'bg-green-50 text-green-800 border border-green-200'}`}>
                                            <p className="font-bold mb-2">Import Results:</p>
                                            <p>✅ {bulkResult.successful} students successfully created and enrolled.</p>
                                            {bulkResult.failed > 0 && <p>❌ {bulkResult.failed} failed.</p>}
                                            {bulkResult.errors?.length > 0 && (
                                                <div className="mt-2 max-h-32 overflow-y-auto text-xs bg-white p-2 rounded border border-orange-100">
                                                    {bulkResult.errors.map((err, i) => (
                                                        <div key={i} className="mb-1 text-red-600 font-mono">{err}</div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    <div className="flex justify-end gap-2 mt-6">
                                        <button 
                                            type="button" 
                                            onClick={closeBulkModal} 
                                            className="text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 focus:ring-4 focus:ring-gray-200 font-medium rounded-lg text-sm px-5 py-2.5"
                                        >
                                            Close
                                        </button>
                                        <button 
                                            type="submit" 
                                            disabled={!bulkFile || bulkUploading}
                                            className="text-white bg-blue-600 hover:bg-blue-700 focus:ring-4 focus:ring-blue-300 font-medium rounded-lg text-sm px-5 py-2.5 disabled:opacity-50"
                                        >
                                            {bulkUploading ? 'Importing...' : 'Upload & Import'}
                                        </button>
                                    </div>
                                </form>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </main>
    );
}
