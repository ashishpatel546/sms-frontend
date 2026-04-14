"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Table from "../../../components/Table";
import useSWR from "swr";
import { fetcher } from "@/lib/api";
import { Loader } from "@/components/ui/Loader";
import { useRbac } from "@/lib/rbac";

export default function SubjectsPage() {
    const rbac = useRbac();
    
    // UI State & Filters
    const [searchId, setSearchId] = useState("");
    const [searchName, setSearchName] = useState("");
    const [searchCategory, setSearchCategory] = useState("");
    const [searchComponent, setSearchComponent] = useState("");
    const [hasSearched, setHasSearched] = useState(false);
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(25);
    
    // Committed filters
    const [filters, setFilters] = useState({ id: "", name: "", category: "", component: "" });
    
    // Conditional Fetching
    const { data: subjects = [], isLoading: loading, error } = useSWR(hasSearched ? '/subjects' : null, fetcher);

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        setFilters({ id: searchId, name: searchName, category: searchCategory, component: searchComponent });
        setHasSearched(true);
        setPage(1);
    };

    const handleReset = () => {
        setSearchId("");
        setSearchName("");
        setSearchCategory("");
        setSearchComponent("");
        setFilters({ id: "", name: "", category: "", component: "" });
        setHasSearched(false);
        setPage(1);
    };

    // Filter logic
    const filteredSubjects = subjects.filter((s: any) => {
        if (filters.id && !s.id.toString().includes(filters.id)) return false;
        if (filters.name && !s.name.toLowerCase().includes(filters.name.toLowerCase())) return false;
        if (filters.category && s.subjectCategory !== filters.category) return false;
        
        if (filters.component === "Theory" && !s.hasTheory) return false;
        if (filters.component === "Practical" && !s.hasPractical) return false;
        if (filters.component === "Both" && (!s.hasTheory || !s.hasPractical)) return false;

        return true;
    });

    // Pagination logic
    const total = filteredSubjects.length;
    const totalPages = Math.ceil(total / pageSize);
    const paginatedSubjects = filteredSubjects.slice((page - 1) * pageSize, page * pageSize);

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

    // Hardcoded unique categories to match backend SubjectCategory enum
    const uniqueCategories = ['BASE', 'OPTIONAL', 'VOCATIONAL', 'ACTIVITY'];

    const columns = [
        { header: "ID", accessor: "id", sortable: true, sortKey: "id" },
        { header: "Subject Name", accessor: "name", sortable: true, sortKey: "name" },
        { header: "Category", accessor: "subjectCategory", sortable: true },
        {
            header: "Components",
            render: (s: any) => (
                <div className="flex gap-1">
                    {s.hasTheory && <span className="bg-blue-100 text-blue-800 text-xs font-bold px-1.5 py-0.5 rounded">Th</span>}
                    {s.hasPractical && <span className="bg-purple-100 text-purple-800 text-xs font-bold px-1.5 py-0.5 rounded">Pr</span>}
                    {!s.hasTheory && !s.hasPractical && <span className="text-gray-400 text-xs">-</span>}
                </div>
            )
        },
        {
            header: "Fee Mapping",
            render: (s: any) => s.feeCategory ? <span className="text-xs text-gray-500">{s.feeCategory.name}</span> : <span className="text-xs text-gray-300">-</span>
        },
        {
            header: "Actions",
            render: (row: any) => rbac.canManageSubjects ? (
                <Link href={`/dashboard/subjects/${row.id}/edit`} className="font-medium text-blue-600 hover:underline">Edit</Link>
            ) : (
                <span className="text-xs text-slate-400">View only</span>
            )
        }
    ];

    if (error) return <div className="p-4 text-red-500">Failed to load subjects</div>;

    return (
        <main className="p-4 bg-slate-50 min-h-screen">
            <div className="max-w-7xl mx-auto">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
                    <h1 className="text-2xl font-bold text-slate-800">Subjects</h1>
                    {rbac.canManageSubjects && (
                        <Link href="/dashboard/subjects/new" className="text-white bg-blue-700 hover:bg-blue-800 focus:ring-4 focus:ring-blue-300 font-medium rounded-lg text-sm px-5 py-2.5 focus:outline-none w-full sm:w-auto text-center whitespace-nowrap">
                            + Add Subject
                        </Link>
                    )}
                </div>

                {/* Search Filter */}
                <div className="bg-white p-5 rounded-lg shadow-sm border border-slate-200 mb-6">
                    <h2 className="text-lg font-semibold text-slate-700 mb-4">Search Subjects</h2>
                    <form onSubmit={handleSearch}>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                            <div>
                                <label className="block text-xs font-medium text-gray-700 mb-1">Subject ID</label>
                                <input type="text" value={searchId} onChange={e => setSearchId(e.target.value)} className="bg-gray-50 border border-gray-300 text-sm rounded-lg w-full p-2" placeholder="e.g. 1" />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-700 mb-1">Subject Name</label>
                                <input type="text" value={searchName} onChange={e => setSearchName(e.target.value)} className="bg-gray-50 border border-gray-300 text-sm rounded-lg w-full p-2" placeholder="Subject Name" />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-700 mb-1">Category</label>
                                <select value={searchCategory} onChange={e => setSearchCategory(e.target.value)} className="bg-gray-50 border border-gray-300 text-sm rounded-lg w-full p-2">
                                    <option value="">All Categories</option>
                                    {uniqueCategories.map(c => (
                                        <option key={c as string} value={c as string}>{c as string}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-700 mb-1">Components</label>
                                <select value={searchComponent} onChange={e => setSearchComponent(e.target.value)} className="bg-gray-50 border border-gray-300 text-sm rounded-lg w-full p-2">
                                    <option value="">All Items</option>
                                    <option value="Theory">Has Theory</option>
                                    <option value="Practical">Has Practical</option>
                                    <option value="Both">Both (Th + Pr)</option>
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
                            <h3 className="text-lg font-medium text-slate-900 mb-1">Find Subjects</h3>
                            <p className="text-sm">Please apply filters and click Search to view the list.</p>
                        </div>
                    ) : (
                        <>
                            <Table
                                columns={columns}
                                data={paginatedSubjects}
                                loading={loading && !subjects.length}
                                defaultSortColumn="name"
                                emptyMessage="No subjects found matching your criteria."
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
