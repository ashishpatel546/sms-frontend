"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Table from "../../../components/Table";
import useSWR from "swr";
import { fetcher } from "@/lib/api";
import { Loader } from "@/components/ui/Loader";
import { useRbac } from "@/lib/rbac";

export default function ClassesPage() {
    const rbac = useRbac();
    
    // UI State & Filters
    const [searchClass, setSearchClass] = useState("");
    const [searchSection, setSearchSection] = useState("");
    const [hasSearched, setHasSearched] = useState(false);
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(25);
    const [filters, setFilters] = useState({ className: "", sectionName: "" });

    // Conditional Fetching
    const { data, error, isLoading } = useSWR(hasSearched ? '/classes' : null, fetcher);
    const [tableData, setTableData] = useState<any[]>([]);

    useEffect(() => {
        if (data) {
            // Flatten data for table: One row per section
            const flattened = data.flatMap((cls: any) =>
                (cls.sections && cls.sections.length > 0)
                    ? cls.sections.map((sec: any) => ({
                        id: sec.id,
                        sectionId: sec.id,
                        className: cls.name, // "Class 10"
                        sectionName: sec.name, // "A"
                        classTeacher: sec.classStaff?.user
                            ? `${sec.classStaff.user.firstName} ${sec.classStaff.user.lastName}`
                            : '',
                        studentCount: sec.studentCount ?? 0,
                        classId: cls.id // For editing link
                    }))
                    : [{ // Handle class with no sections if any
                        id: `cls-${cls.id}`,
                        sectionId: 'N/A',
                        className: cls.name,
                        sectionName: 'No Sections',
                        classTeacher: '',
                        studentCount: 0,
                        classId: cls.id
                    }]
            );
            setTableData(flattened);
        }
    }, [data]);

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        setFilters({ className: searchClass, sectionName: searchSection });
        setHasSearched(true);
        setPage(1);
    };

    const handleReset = () => {
        setSearchClass("");
        setSearchSection("");
        setFilters({ className: "", sectionName: "" });
        setHasSearched(false);
        setPage(1);
    };

    // Filter logic
    const filteredClasses = tableData.filter((c: any) => {
        if (filters.className && !c.className.toLowerCase().includes(filters.className.toLowerCase())) return false;
        if (filters.sectionName && !c.sectionName.toLowerCase().includes(filters.sectionName.toLowerCase())) return false;
        return true;
    });

    // Pagination logic
    const total = filteredClasses.length;
    const totalPages = Math.ceil(total / pageSize);
    const paginatedClasses = filteredClasses.slice((page - 1) * pageSize, page * pageSize);

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

    if (error) return <div className="p-4 text-red-500">Failed to load classes</div>;

    const columns = [
        { header: "Class ID", accessor: "classId", sortable: true },
        { header: "Class", accessor: "className", sortable: true },
        { header: "Section ID", accessor: "sectionId", sortable: true },
        { header: "Section", accessor: "sectionName", sortable: true },
        { header: "Class Teacher", accessor: "classTeacher", sortable: true },
        { header: "No. of Students", accessor: "studentCount", sortable: true },
        {
            header: "Action",
            render: (row: any) => rbac.canManageSections ? (
                <Link
                    href={`/dashboard/classes/${row.classId}/edit`}
                    className="font-medium text-blue-600 hover:underline"
                >
                    Edit
                </Link>
            ) : (
                <span className="text-xs text-slate-400">View only</span>
            )
        }
    ];

    return (
        <main className="p-4 bg-slate-50 min-h-screen">
            <div className="max-w-7xl mx-auto">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
                    <h1 className="text-2xl font-bold text-slate-800">Classes Management</h1>
                    <div className="w-full sm:w-auto">
                        {rbac.canManageClasses && (
                            <Link href="/dashboard/classes/new" className="text-white bg-blue-700 hover:bg-blue-800 focus:ring-4 focus:ring-blue-300 font-medium rounded-lg text-sm px-5 py-2.5 sm:mr-2 mb-2 focus:outline-none block sm:inline-block w-full text-center whitespace-nowrap">
                                Add Class
                            </Link>
                        )}
                    </div>
                </div>

                {/* Search Filter */}
                <div className="bg-white p-5 rounded-lg shadow-sm border border-slate-200 mb-6">
                    <h2 className="text-lg font-semibold text-slate-700 mb-4">Search Classes</h2>
                    <form onSubmit={handleSearch}>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                            <div>
                                <label className="block text-xs font-medium text-gray-700 mb-1">Class</label>
                                <input type="text" value={searchClass} onChange={e => setSearchClass(e.target.value)} className="bg-gray-50 border border-gray-300 text-sm rounded-lg w-full p-2" placeholder="e.g. Class 10" />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-700 mb-1">Section</label>
                                <input type="text" value={searchSection} onChange={e => setSearchSection(e.target.value)} className="bg-gray-50 border border-gray-300 text-sm rounded-lg w-full p-2" placeholder="e.g. A" />
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
                            <h3 className="text-lg font-medium text-slate-900 mb-1">Find Classes</h3>
                            <p className="text-sm">Please apply filters and click Search to view the list.</p>
                        </div>
                    ) : (
                        <>
                            <Table
                                columns={columns}
                                data={paginatedClasses}
                                loading={isLoading}
                                defaultSortColumn="className"
                                emptyMessage="No classes found."
                            />

                            {/* Pagination Controls */}
                            {total > 0 && (
                                <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-4 pt-4 border-t border-slate-200">
                                    <div className="flex items-center gap-2 text-sm text-slate-600">
                                        <span>Rows per page:</span>
                                        <select
                                            value={pageSize}
                                            onChange={(e) => {
                                                setPageSize(Number(e.target.value));
                                                setPage(1);
                                            }}
                                            className="border border-gray-300 rounded-md text-sm p-1"
                                        >
                                            {[10, 25, 50, 100].map(opt => (
                                                <option key={opt} value={opt}>{opt}</option>
                                            ))}
                                        </select>
                                        <span className="ml-2">
                                            {Math.min((page - 1) * pageSize + 1, total)}–{Math.min(page * pageSize, total)} of {total}
                                        </span>
                                    </div>

                                    <div className="flex items-center gap-1">
                                        <button
                                            onClick={() => setPage(Math.max(1, page - 1))}
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
                                                    onClick={() => setPage(p as number)}
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
                                            onClick={() => setPage(Math.min(totalPages, page + 1))}
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
