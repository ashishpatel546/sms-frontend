"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Table from "../../../components/Table";
import { API_BASE_URL } from "@/lib/api";
import { useRbac } from "@/lib/rbac";
import { authFetch } from "@/lib/auth";

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

export default function TeachersPage() {
    const [teachers, setTeachers] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const rbac = useRbac();

    // Search Params
    const [searchId, setSearchId] = useState("");
    const [searchFirstName, setSearchFirstName] = useState("");
    const [searchLastName, setSearchLastName] = useState("");
    const [searchEmail, setSearchEmail] = useState("");
    const [searchStatus, setSearchStatus] = useState("");
    const [searchCategory, setSearchCategory] = useState("");
    const [searchDesignation, setSearchDesignation] = useState("");

    const [designations, setDesignations] = useState<any[]>([]);

    // Pagination
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(25);
    const [total, setTotal] = useState(0);

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
        setSearchStatus("");
        setSearchCategory("");
        setSearchDesignation("");
        setPage(1);
        setTimeout(() => fetchTeachers(1), 0);
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
            render: (row: any) => rbac.canManageTeachers ? (
                <Link href={`/dashboard/staff/${row.id}/edit`} className="font-medium text-blue-600 hover:underline">Edit</Link>
            ) : (
                <Link href={`/dashboard/staff/${row.id}/edit`} className="font-medium text-slate-400 text-xs">View</Link>
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
                    <h1 className="text-2xl font-bold text-slate-800">Staff Management</h1>
                    {rbac.canManageTeachers && (
                        <Link href="/dashboard/staff/new" className="text-white bg-blue-700 hover:bg-blue-800 focus:ring-4 focus:ring-blue-300 font-medium rounded-lg text-sm px-5 py-2.5 focus:outline-none w-full sm:w-auto text-center whitespace-nowrap">
                            Add Staff
                        </Link>
                    )}
                </div>

                {/* Advanced Search Filter */}
                <div className="bg-white p-5 rounded-lg shadow-sm border border-slate-200 mb-6">
                    <h2 className="text-lg font-semibold text-slate-700 mb-4">Search Staff</h2>
                    <form onSubmit={handleSearch}>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 gap-4 mb-4">
                            <div>
                                <label className="block text-xs font-medium text-gray-700 mb-1">Teacher ID</label>
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
                                <label className="block text-xs font-medium text-gray-700 mb-1">Category</label>
                                <select value={searchCategory} onChange={e => setSearchCategory(e.target.value)} className="bg-gray-50 border border-gray-300 text-sm rounded-lg w-full p-2">
                                    <option value="">All Categories</option>
                                    <option value="Teaching Staff">Teaching Staff</option>
                                    <option value="Management">Management</option>
                                    <option value="Support Staff">Support Staff</option>
                                    <option value="Admin Staff">Admin Staff</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-700 mb-1">Designation</label>
                                <select value={searchDesignation} onChange={e => setSearchDesignation(e.target.value)} className="bg-gray-50 border border-gray-300 text-sm rounded-lg w-full p-2">
                                    <option value="">All Designations</option>
                                    {designations.map(d => (
                                        <option key={d.id} value={d.id}>{d.title}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-700 mb-1">Status</label>
                                <select value={searchStatus} onChange={e => setSearchStatus(e.target.value)} className="bg-gray-50 border border-gray-300 text-sm rounded-lg w-full p-2">
                                    <option value="">All Statuses</option>
                                    <option value="true">Active</option>
                                    <option value="false">Inactive</option>
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
        </main>
    );
}
