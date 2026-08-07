"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import Table from "../../../components/Table";
import { API_BASE_URL } from "@/lib/api";
import { useRbac } from "@/lib/rbac";
import { useReadOnlySession, READ_ONLY_TITLE } from '@/lib/support-session';
import { Upload, UserPlus } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/button";
import { authFetch } from "@/lib/auth";
import Papa from "papaparse";
import { MoreVertical, Eye, Pencil, UserMinus } from "lucide-react";
import toast from "react-hot-toast";

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

export default function TeachersPage() {
    const [teachers, setTeachers] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const rbac = useRbac();
    const readOnly = useReadOnlySession();

    const [openActionRowId, setOpenActionRowId] = useState<number | null>(null);
    const actionMenuRef = useRef<HTMLDivElement>(null);

    // Exit Modal States
    const [showExitModal, setShowExitModal] = useState(false);
    const [selectedStaffForExit, setSelectedStaffForExit] = useState<any>(null);
    const [exitDate, setExitDate] = useState(new Date().toISOString().split('T')[0]);
    const [isExiting, setIsExiting] = useState(false);

    // Search Params
    const [searchId, setSearchId] = useState("");
    const [searchFirstName, setSearchFirstName] = useState("");
    const [searchLastName, setSearchLastName] = useState("");
    const [searchEmail, setSearchEmail] = useState("");
    const [searchStatus, setSearchStatus] = useState("true");
    const [searchCategory, setSearchCategory] = useState("");
    const [searchDesignation, setSearchDesignation] = useState("");

    const [designations, setDesignations] = useState<any[]>([]);

    // Pagination
    // Pagination
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(25);
    const [total, setTotal] = useState(0);

    // Bulk Import State
    const [showImportModal, setShowImportModal] = useState(false);
    const [importFile, setImportFile] = useState<File | null>(null);
    const [importLoading, setImportLoading] = useState(false);
    const [importSummary, setImportSummary] = useState<{ successful: number; failed: number; errors: string[] } | null>(null);

    const totalPages = Math.ceil(total / pageSize);

    const buildParams = (overridePage?: number, overrideSize?: number) => {
        const params = new URLSearchParams();
        if (searchId) params.append("id", searchId);
        if (searchFirstName) params.append("firstName", searchFirstName);
        if (searchLastName) params.append("lastName", searchLastName);
        if (searchEmail) params.append("email", searchEmail);
        if (searchStatus !== "") params.append("isActive", searchStatus);
        if (searchCategory) params.append("staffCategory", searchCategory);
        if (searchDesignation) params.append("designationId", searchDesignation);
        params.append("page", String(overridePage ?? page));
        params.append("limit", String(overrideSize ?? pageSize));
        return params;
    };

    const fetchTeachers = async (overridePage?: number, overrideSize?: number) => {
        setLoading(true);
        try {
            const params = buildParams(overridePage, overrideSize);
            const res = await authFetch(`${API_BASE_URL}/staff?${params.toString()}`);
            if (res.ok) {
                const data = await res.json();
                if (data && data.data) {
                    setTeachers(data.data);
                    setTotal(data.total);
                    setPage(data.page);
                } else {
                    setTeachers(Array.isArray(data) ? data : []);
                    setTotal(Array.isArray(data) ? data.length : 0);
                }
            }
        } catch (err) {
            console.error("Failed to fetch teachers", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchTeachers(1, 25);
        authFetch(`${API_BASE_URL}/designations`)
            .then(res => res.ok ? res.json() : [])
            .then(data => setDesignations(data))
            .catch(() => setDesignations([]));
    }, []);

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
        setPage(1);
        fetchTeachers(1);
    };

    const handleReset = () => {
        setSearchId("");
        setSearchFirstName("");
        setSearchLastName("");
        setSearchEmail("");
        setSearchStatus("true");
        setSearchCategory("");
        setSearchDesignation("");
        setPage(1);
        setTimeout(() => fetchTeachers(1), 0);
    };

    const handleConfirmExit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (readOnly) return;
        if (!selectedStaffForExit) return;
        setIsExiting(true);
        try {
            const res = await authFetch(`${API_BASE_URL}/staff/${selectedStaffForExit.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    exitDate: exitDate,
                    isActive: false
                })
            });
            if (res.ok) {
                toast.success("Staff exit marked successfully");
                setShowExitModal(false);
                setSelectedStaffForExit(null);
                fetchTeachers(page, pageSize);
            } else {
                const err = await res.json();
                toast.error(err.message || "Failed to mark exit");
            }
        } catch (error) {
            toast.error("An error occurred while marking exit");
        } finally {
            setIsExiting(false);
        }
    };

    const handlePageChange = (newPage: number) => {
        if (newPage < 1 || newPage > totalPages) return;
        setPage(newPage);
        fetchTeachers(newPage);
    };

    const handlePageSizeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const newSize = parseInt(e.target.value);
        setPageSize(newSize);
        setPage(1);
        fetchTeachers(1, newSize);
    };

    const handleDownloadTemplate = () => {
        const headers = [
            "firstName", "lastName", "email", "mobile", "alternateMobile", "gender", "dateOfBirth", "bloodGroup", "aadhaarNumber", 
            "category", "religion", "fathersName", "mothersName", "staffCategory", "designationId", "isActive", "role",
            "department", "joiningDate", "qualification",
            "addressLine1", "addressLine2", "landmark", "city", "state", "postalCode", "country"
        ].join(",");
        const dummyRow = "\nJohn,Doe,john.doe@gmail.com,9876543210,,Male,1990-01-01,O+,123412341234,General,HINDU,,,Teaching Staff,4,true,TEACHER,Science,2023-05-01,M.Sc,Street 1,,Near Park,New Delhi,Delhi,110001,INDIA";
        
        const blob = new Blob([headers + dummyRow], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'staff_import_template.csv';
        a.click();
    };

    const handleImportSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (readOnly) return;
        if (!importFile) return;

        setImportLoading(true);
        setImportSummary(null);

        Papa.parse(importFile, {
            header: true,
            skipEmptyLines: true,
            complete: async (results) => {
                try {
                    const staffData = results.data.map((row: any) => ({
                         ...row,
                         designationId: row.designationId ? parseInt(row.designationId) : undefined,
                         category: row.category || undefined,
                         religion: row.religion || undefined,
                         gender: row.gender || undefined,
                         isActive: row.isActive === 'false' ? false : true,
                         role: row.role || 'TEACHER',
                         address: {
                             addressLine1: row.addressLine1 || undefined,
                             addressLine2: row.addressLine2 || undefined,
                             landmark: row.landmark || undefined,
                             city: row.city || undefined,
                             state: row.state || undefined,
                             postalCode: row.postalCode || undefined,
                             country: row.country || 'INDIA'
                         }
                    }));

                    const res = await authFetch(`${API_BASE_URL}/staff/bulk-import`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ staffData })
                    });

                    if (res.ok) {
                        const data = await res.json();
                        setImportSummary(data);
                        fetchTeachers(1);
                    } else {
                        const err = await res.json();
                        alert("Import failed: " + (err.message || "Unknown error"));
                    }
                } catch (error) {
                    console.error("Bulk import error", error);
                    alert("An error occurred during import.");
                } finally {
                    setImportLoading(false);
                }
            },
            error: (err: any) => {
                alert("Failed to read CSV file: " + err.message);
                setImportLoading(false);
            }
        });
    };

    const columns = [
        { header: "ID", accessor: "id", sortable: true },
        {
            header: "Name",
            sortable: true,
            sortKey: "firstName",
            render: (row: any) => `${row.firstName} ${row.lastName}`
        },
        { header: "Email", accessor: "email", sortable: true },
        {
            header: "Designation",
            render: (row: any) => row.designation?.title || '-'
        },
        {
            header: "Class Teacher Of",
            render: (row: any) => row.classTeacherOf && row.classTeacherOf.length > 0
                ? row.classTeacherOf.map((s: any) => `${s.class?.name || ''}-${s.name}`).filter(Boolean).join(', ')
                : '-'
        },
        {
            header: "Subjects",
            render: (row: any) => row.subjectAssignments && row.subjectAssignments.length > 0
                ? row.subjectAssignments.map((sa: any) => `${sa.subject?.name} (${sa.class?.name}-${sa.section?.name})`).join(', ')
                : '-'
        },
        {
            header: "Status",
            render: (row: any) => (
                <span className={`px-2 py-1 font-semibold leading-tight ${row.isActive ? 'text-green-700 bg-green-100' : 'text-red-700 bg-red-100'} rounded-full`}>
                    {row.isActive ? 'Active' : 'Inactive'}
                </span>
            )
        },
        {
            header: "Actions",
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
                        <div className="absolute right-0 z-20 mt-1 w-32 bg-white border border-gray-200 rounded-lg shadow-lg py-1">
                            <Link
                                href={`/dashboard/staff/${row.id}`}
                                className="flex items-center gap-2 w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                            >
                                <Eye className="w-4 h-4 text-gray-400" />
                                View
                            </Link>
                            {rbac.canManageTeachers && (
                                <Link
                                    href={`/dashboard/staff/${row.id}/edit`}
                                    className="flex items-center gap-2 w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                                >
                                    <Pencil className="w-4 h-4 text-gray-400" />
                                    Edit
                                </Link>
                            )}
                            {rbac.canManageTeachers && row.isActive && (
                                <button
                                    type="button"
                                    onClick={() => {
                                        setSelectedStaffForExit(row);
                                        setExitDate(new Date().toISOString().split('T')[0]);
                                        setShowExitModal(true);
                                        setOpenActionRowId(null);
                                    }}
                                    className="flex items-center gap-2 w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-gray-50 border-t border-gray-100"
                                >
                                    <UserMinus className="w-4 h-4 text-red-400" />
                                    Mark Exit
                                </button>
                            )}
                        </div>
                    )}
                </div>
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
        <main className="p-4 sm:p-5">
            <div className="max-w-7xl mx-auto">
                <PageHeader
                    className="mb-4"
                    section="Academics · Staff"
                    title="Staff"
                    description="Teachers, admins and support staff on the payroll."
                    actions={rbac.canManageTeachers ? (
                        <>
                            <Button variant="outline" onClick={() => setShowImportModal(true)}>
                                <Upload />
                                Import CSV
                            </Button>
                            <Button render={<Link href="/dashboard/staff/new" />}>
                                <UserPlus />
                                Add staff
                            </Button>
                        </>
                    ) : undefined}
                />

                {/* Advanced Search Filter */}
                <div className="mb-4 rounded-xl border border-line bg-surface p-4 shadow-soft">
                    <h2 className="mb-3.5 font-display text-[15px] font-semibold text-ink">Search Staff</h2>
                    <form onSubmit={handleSearch}>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mb-4">
                            <div>
                                <label className="eyebrow mb-1.5 block">Teacher ID</label>
                                <input type="text" value={searchId} onChange={e => setSearchId(e.target.value)} className="h-10 w-full rounded-md border border-line-strong bg-surface px-3 text-[14px] text-ink transition-colors focus:border-brand focus:ring-3 focus:ring-brand/16 focus:outline-none" placeholder="e.g. 1" />
                            </div>
                            <div>
                                <label className="eyebrow mb-1.5 block">First Name</label>
                                <input type="text" value={searchFirstName} onChange={e => setSearchFirstName(e.target.value)} className="h-10 w-full rounded-md border border-line-strong bg-surface px-3 text-[14px] text-ink transition-colors focus:border-brand focus:ring-3 focus:ring-brand/16 focus:outline-none" placeholder="First Name" />
                            </div>
                            <div>
                                <label className="eyebrow mb-1.5 block">Last Name</label>
                                <input type="text" value={searchLastName} onChange={e => setSearchLastName(e.target.value)} className="h-10 w-full rounded-md border border-line-strong bg-surface px-3 text-[14px] text-ink transition-colors focus:border-brand focus:ring-3 focus:ring-brand/16 focus:outline-none" placeholder="Last Name" />
                            </div>
                            <div>
                                <label className="eyebrow mb-1.5 block">Email</label>
                                <input type="text" value={searchEmail} onChange={e => setSearchEmail(e.target.value)} className="h-10 w-full rounded-md border border-line-strong bg-surface px-3 text-[14px] text-ink transition-colors focus:border-brand focus:ring-3 focus:ring-brand/16 focus:outline-none" placeholder="Email Address" />
                            </div>
                            <div>
                                <label className="eyebrow mb-1.5 block">Category</label>
                                <select value={searchCategory} onChange={e => setSearchCategory(e.target.value)} className="h-10 w-full rounded-md border border-line-strong bg-surface px-3 text-[14px] text-ink transition-colors focus:border-brand focus:ring-3 focus:ring-brand/16 focus:outline-none">
                                    <option value="">All Categories</option>
                                    <option value="Teaching Staff">Teaching Staff</option>
                                    <option value="Management">Management</option>
                                    <option value="Support Staff">Support Staff</option>
                                    <option value="Admin Staff">Admin Staff</option>
                                </select>
                            </div>
                            <div>
                                <label className="eyebrow mb-1.5 block">Designation</label>
                                <select value={searchDesignation} onChange={e => setSearchDesignation(e.target.value)} className="h-10 w-full rounded-md border border-line-strong bg-surface px-3 text-[14px] text-ink transition-colors focus:border-brand focus:ring-3 focus:ring-brand/16 focus:outline-none">
                                    <option value="">All Designations</option>
                                    {designations.map(d => (
                                        <option key={d.id} value={d.id}>{d.title}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="eyebrow mb-1.5 block">Status</label>
                                <select value={searchStatus} onChange={e => setSearchStatus(e.target.value)} className="h-10 w-full rounded-md border border-line-strong bg-surface px-3 text-[14px] text-ink transition-colors focus:border-brand focus:ring-3 focus:ring-brand/16 focus:outline-none">
                                    <option value="">All Statuses</option>
                                    <option value="true">Active</option>
                                    <option value="false">Inactive</option>
                                </select>
                            </div>
                        </div>
                        <div className="flex justify-end gap-2">
                            <button type="button" onClick={handleReset} className="h-10 cursor-pointer rounded-md px-3.5 text-[13.5px] font-semibold text-ink-muted transition-colors hover:bg-surface-secondary hover:text-ink">
                                Reset
                            </button>
                            <button type="submit" className="h-10 cursor-pointer rounded-md bg-brand px-4 text-[13.5px] font-semibold text-brand-contrast shadow-soft transition-all hover:bg-brand-deep hover:shadow-brand">
                                Search
                            </button>
                        </div>
                    </form>
                </div>

                <div className="rounded-xl border border-line bg-surface shadow-soft">
                    <Table
                        columns={columns}
                        data={teachers}
                        loading={loading}
                        defaultSortColumn="id"
                        defaultSortDirection="asc"
                        emptyMessage="No teachers found matching the search criteria."
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
                </div>
            </div>

            {/* Import Modal */}
            {showImportModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-walnut-950/55 backdrop-blur-sm">
                    <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                        <h2 className="text-xl font-bold mb-4">Bulk Import Staff</h2>
                        
                        <div className="mb-4 p-4 bg-blue-50 text-blue-800 text-sm rounded-lg border border-blue-200 relative">
                            <p className="mb-2"><strong>Instructions:</strong></p>
                            <ol className="list-decimal ml-5 space-y-1">
                                <li>Download the CSV template below.</li>
                                <li>Fill in the staff details. Do NOT delete the header row.</li>
                                <li><strong>designationId</strong>: Must be the numeric ID from the list below.</li>
                                <li><strong>Password</strong>: The default password configured in the `.env` (via SSM) will automatically be assigned. The staff member will be forced to change it on their first login.</li>
                            </ol>
                            <button onClick={handleDownloadTemplate} type="button" className="mt-3 text-white bg-blue-600 hover:bg-blue-700 font-medium rounded text-xs px-3 py-1.5 focus:outline-none">
                                Download CSV Template
                            </button>
                        </div>

                        <div className="mb-6 border border-gray-200 rounded max-h-40 overflow-y-auto w-full">
                            <table className="w-full text-sm text-left text-gray-500">
                                <thead className="text-xs text-gray-700 uppercase bg-gray-50 sticky top-0">
                                    <tr>
                                        <th className="px-4 py-2 border-b">Designation ID</th>
                                        <th className="px-4 py-2 border-b">Title</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {designations.map(d => (
                                        <tr key={d.id} className="border-b">
                                            <td className="px-4 py-2 font-mono font-bold text-gray-900">{d.id}</td>
                                            <td className="px-4 py-2">{d.title}</td>
                                        </tr>
                                    ))}
                                    {designations.length === 0 && (
                                        <tr><td colSpan={2} className="px-4 py-2 text-center">No designations found.</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>

                        {importSummary ? (
                            <div className="mb-6 border border-slate-200 rounded-lg p-4 bg-slate-50">
                                <h3 className="font-bold text-lg mb-2 text-slate-800">Import Results</h3>
                                <div className="flex gap-4 mb-4">
                                    <div className="bg-green-100 border border-green-200 text-green-800 p-3 rounded-lg flex-1 text-center">
                                        <div className="text-2xl font-bold">{importSummary.successful}</div>
                                        <div className="text-xs uppercase font-medium mt-1">Successful</div>
                                    </div>
                                    <div className="bg-red-100 border border-red-200 text-red-800 p-3 rounded-lg flex-1 text-center">
                                        <div className="text-2xl font-bold">{importSummary.failed}</div>
                                        <div className="text-xs uppercase font-medium mt-1">Failed</div>
                                    </div>
                                </div>
                                {importSummary.errors.length > 0 && (
                                    <div className="bg-red-50 p-3 rounded-lg max-h-40 overflow-y-auto text-sm border border-red-200">
                                        <p className="font-bold text-red-800 mb-2 mt-1">Errors:</p>
                                        <ul className="list-disc pl-5 text-red-700 space-y-1">
                                            {importSummary.errors.map((e, idx) => <li key={idx}>{e}</li>)}
                                        </ul>
                                    </div>
                                )}
                                <div className="flex justify-end gap-2 pt-4 border-t mt-4 border-slate-200">
                                    <button type="button" onClick={() => { setShowImportModal(false); setImportSummary(null); setImportFile(null); }} className="px-5 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 focus:ring-4 focus:ring-brand/40">
                                        Done
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <form onSubmit={handleImportSubmit} className="space-y-4">
                                <div>
                                    <label className="block mb-2 text-sm font-medium text-gray-900">Upload CSV File <span className="text-red-500">*</span></label>
                                    <input type="file" accept=".csv" required onChange={e => setImportFile(e.target.files?.[0] || null)} className="block w-full text-sm text-gray-900 border border-gray-300 rounded-lg cursor-pointer bg-gray-50 focus:outline-none file:mr-4 file:py-2.5 file:px-4 file:rounded-l-lg file:border-0 file:text-sm file:font-semibold file:bg-slate-100 file:text-slate-700 hover:file:bg-slate-200" />
                                </div>
                                <div className="flex justify-end gap-2 pt-4 border-t border-slate-200">
                                    <button type="button" onClick={() => setShowImportModal(false)} className="px-5 py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:ring-4 focus:ring-line-strong">
                                        Cancel
                                    </button>
                                    <button type="submit" disabled={importLoading || !importFile || readOnly} title={readOnly ? READ_ONLY_TITLE : undefined} className="px-5 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 focus:ring-4 focus:ring-brand/40 disabled:opacity-50 flex items-center">
                                        {importLoading ? "Importing..." : "Start Import"}
                                    </button>
                                </div>
                            </form>
                        )}
                    </div>
                </div>
            )}
            {showExitModal && selectedStaffForExit && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-walnut-950/55 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6">
                        <h3 className="text-lg font-bold text-gray-900 mb-4">Mark Staff Exit</h3>
                        <p className="text-sm text-gray-600 mb-4">
                            You are marking exit for staff member: <span className="font-semibold text-gray-800">{selectedStaffForExit.firstName} {selectedStaffForExit.lastName}</span> (ID: {selectedStaffForExit.id}). This will also deactivate their user account.
                        </p>
                        <form onSubmit={handleConfirmExit} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Exit Date <span className="text-red-500">*</span></label>
                                <input
                                    type="date"
                                    required
                                    value={exitDate}
                                    onChange={e => setExitDate(e.target.value)}
                                    className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-brand/40 focus:border-brand block w-full p-2.5"
                                />
                            </div>
                            <div className="flex justify-end gap-2 pt-4 border-t border-gray-200">
                                <button
                                    type="button"
                                    onClick={() => { setShowExitModal(false); setSelectedStaffForExit(null); }}
                                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:ring-4 focus:ring-line-strong"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={isExiting || readOnly}
                                    title={readOnly ? READ_ONLY_TITLE : undefined}
                                    className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 focus:ring-4 focus:ring-red-300 disabled:opacity-50"
                                >
                                    {isExiting ? "Marking Exit..." : "Confirm Exit"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </main>
    );
}
