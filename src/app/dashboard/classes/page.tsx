"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Table from "../../../components/Table";
import useSWR from "swr";
import { fetcher, API_BASE_URL } from "@/lib/api";
import { authFetch } from "@/lib/auth";
import toast, { Toaster } from "react-hot-toast";
import { Loader } from "@/components/ui/Loader";
import { useRbac } from "@/lib/rbac";
import { Plus } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/button";

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
    const { data, error, isLoading, mutate } = useSWR(hasSearched ? '/classes' : null, fetcher);
    const [tableData, setTableData] = useState<any[]>([]);
    const [deletingClassId, setDeletingClassId] = useState<number | null>(null);

    const handleDeleteClass = async (classId: number, className: string) => {
        if (!confirm(
            `Delete class "${className}"?\n\nThis removes the class and its section links. ` +
            `Deletion is refused if any students, attendance, exams, fees or other records are linked to it.`
        )) return;
        setDeletingClassId(classId);
        try {
            const res = await authFetch(`${API_BASE_URL}/classes/${classId}`, { method: "DELETE" });
            if (!res.ok) {
                const body = await res.json().catch(() => ({}));
                throw new Error(body?.message ?? "Failed to delete class");
            }
            toast.success(`Class "${className}" deleted`);
            mutate(); // refresh the list
        } catch (e: any) {
            // 409 messages explain exactly which records are still linked
            toast.error(e?.message ?? "Failed to delete class", { duration: 8000 });
        } finally {
            setDeletingClassId(null);
        }
    };

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
                <div className="flex items-center gap-3">
                    <Link
                        href={`/dashboard/classes/${row.classId}/edit`}
                        className="font-medium text-blue-600 hover:underline"
                    >
                        Edit
                    </Link>
                    {rbac.isSuperAdmin && (
                        <button
                            onClick={() => handleDeleteClass(row.classId, row.className)}
                            disabled={deletingClassId === row.classId}
                            className="font-medium text-red-600 hover:underline disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {deletingClassId === row.classId ? "Deleting…" : "Delete"}
                        </button>
                    )}
                </div>
            ) : (
                <span className="text-xs text-slate-400">View only</span>
            )
        }
    ];

    return (
        <main className="p-4 sm:p-5">
            <Toaster />
            <div className="max-w-7xl mx-auto">
                <PageHeader
                    className="mb-4"
                    section="Academics · Classes"
                    title="Classes"
                    description="Every class and its sections for the academic year."
                    actions={rbac.canManageClasses ? (
                        <Button render={<Link href="/dashboard/classes/new" />}>
                            <Plus />
                            Add class
                        </Button>
                    ) : undefined}
                />

                {/* Search Filter */}
                <div className="mb-4 rounded-xl border border-line bg-surface p-4 shadow-soft">
                    <h2 className="mb-3.5 font-display text-[15px] font-semibold text-ink">Search Classes</h2>
                    <form onSubmit={handleSearch}>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                            <div>
                                <label className="eyebrow mb-1.5 block">Class</label>
                                <input type="text" value={searchClass} onChange={e => setSearchClass(e.target.value)} className="h-10 w-full rounded-md border border-line-strong bg-surface px-3 text-[14px] text-ink transition-colors focus:border-brand focus:ring-3 focus:ring-brand/16 focus:outline-none" placeholder="e.g. Class 10" />
                            </div>
                            <div>
                                <label className="eyebrow mb-1.5 block">Section</label>
                                <input type="text" value={searchSection} onChange={e => setSearchSection(e.target.value)} className="h-10 w-full rounded-md border border-line-strong bg-surface px-3 text-[14px] text-ink transition-colors focus:border-brand focus:ring-3 focus:ring-brand/16 focus:outline-none" placeholder="e.g. A" />
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
