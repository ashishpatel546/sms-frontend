"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Table from "../../../components/Table";
import useSWR from "swr";
import { fetcher } from "@/lib/api";
import { Loader } from "@/components/ui/Loader";
import { useRbac } from "@/lib/rbac";
import { Plus } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/button";
import { useTranslations } from "next-intl";

export default function SubjectsPage() {
    const rbac = useRbac();
    const t = useTranslations("subjects");
    const tc = useTranslations("common");
    
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
    const uniqueCategories = ['BASE', 'OPTIONAL', 'VOCATIONAL', 'ACTIVITY'] as const;

    const columns = [
        { header: t("list.colId"), accessor: "id", sortable: true, sortKey: "id" },
        { header: t("form.name"), accessor: "name", sortable: true, sortKey: "name" },
        { header: t("list.colCategory"), accessor: "subjectCategory", sortable: true, render: (s: { subjectCategory: string }) => (uniqueCategories as readonly string[]).includes(s.subjectCategory) ? t(`categoryShort.${s.subjectCategory as (typeof uniqueCategories)[number]}`) : s.subjectCategory },
        {
            header: t("list.colComponents"),
            render: (s: any) => (
                <div className="flex gap-1">
                    {s.hasTheory && <span className="bg-blue-100 text-blue-800 text-xs font-bold px-1.5 py-0.5 rounded">{t("list.theoryShort")}</span>}
                    {s.hasPractical && <span className="bg-purple-100 text-purple-800 text-xs font-bold px-1.5 py-0.5 rounded">{t("list.practicalShort")}</span>}
                    {!s.hasTheory && !s.hasPractical && <span className="text-gray-400 text-xs">-</span>}
                </div>
            )
        },
        {
            header: t("list.colFeeMapping"),
            render: (s: any) => s.feeCategory ? <span className="text-xs text-gray-500">{s.feeCategory.name}</span> : <span className="text-xs text-gray-300">-</span>
        },
        {
            header: tc("action.actions"),
            render: (row: any) => rbac.canManageSubjects ? (
                <Link href={`/dashboard/subjects/${row.id}/edit`} className="font-medium text-blue-600 hover:underline">{tc("action.edit")}</Link>
            ) : (
                <span className="text-xs text-slate-400">{t("list.viewOnly")}</span>
            )
        }
    ];

    if (error) return <div className="p-4 text-red-500">{t("list.loadFailed")}</div>;

    return (
        <main className="p-4 sm:p-5">
            <div className="max-w-7xl mx-auto">
                <PageHeader
                    className="mb-4"
                    section={t("list.section")}
                    title={t("list.title")}
                    description={t("list.description")}
                    actions={rbac.canManageSubjects ? (
                        <Button render={<Link href="/dashboard/subjects/new" />}>
                            <Plus />
                            {t("list.addSubject")}
                        </Button>
                    ) : undefined}
                />

                {/* Search Filter */}
                <div className="mb-4 rounded-xl border border-line bg-surface p-4 shadow-soft">
                    <h2 className="mb-3.5 font-display text-[15px] font-semibold text-ink">{t("list.searchTitle")}</h2>
                    <form onSubmit={handleSearch}>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                            <div>
                                <label className="eyebrow mb-1.5 block">{t("list.subjectId")}</label>
                                <input type="text" value={searchId} onChange={e => setSearchId(e.target.value)} className="h-10 w-full rounded-md border border-line-strong bg-surface px-3 text-[14px] text-ink transition-colors focus:border-brand focus:ring-3 focus:ring-brand/16 focus:outline-none" placeholder={t("list.idPlaceholder")} />
                            </div>
                            <div>
                                <label className="eyebrow mb-1.5 block">{t("form.name")}</label>
                                <input type="text" value={searchName} onChange={e => setSearchName(e.target.value)} className="h-10 w-full rounded-md border border-line-strong bg-surface px-3 text-[14px] text-ink transition-colors focus:border-brand focus:ring-3 focus:ring-brand/16 focus:outline-none" placeholder={t("form.name")} />
                            </div>
                            <div>
                                <label className="eyebrow mb-1.5 block">{t("list.colCategory")}</label>
                                <select value={searchCategory} onChange={e => setSearchCategory(e.target.value)} className="h-10 w-full rounded-md border border-line-strong bg-surface px-3 text-[14px] text-ink transition-colors focus:border-brand focus:ring-3 focus:ring-brand/16 focus:outline-none">
                                    <option value="">{t("list.allCategories")}</option>
                                    {uniqueCategories.map(c => (
                                        <option key={c as string} value={c as string}>{t(`categoryShort.${c}`)}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="eyebrow mb-1.5 block">{t("list.colComponents")}</label>
                                <select value={searchComponent} onChange={e => setSearchComponent(e.target.value)} className="h-10 w-full rounded-md border border-line-strong bg-surface px-3 text-[14px] text-ink transition-colors focus:border-brand focus:ring-3 focus:ring-brand/16 focus:outline-none">
                                    <option value="">{t("list.allItems")}</option>
                                    <option value="Theory">{t("list.hasTheory")}</option>
                                    <option value="Practical">{t("list.hasPractical")}</option>
                                    <option value="Both">{t("list.both")}</option>
                                </select>
                            </div>
                        </div>
                        <div className="flex justify-end gap-2">
                            <button type="button" onClick={handleReset} className="h-10 cursor-pointer rounded-md px-3.5 text-[13.5px] font-semibold text-ink-muted transition-colors hover:bg-surface-secondary hover:text-ink">
                                {tc("action.reset")}
                            </button>
                            <button type="submit" className="h-10 cursor-pointer rounded-md bg-brand px-4 text-[13.5px] font-semibold text-brand-contrast shadow-soft transition-all hover:bg-brand-deep hover:shadow-brand">
                                {tc("action.search")}
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
                            <h3 className="text-lg font-medium text-slate-900 mb-1">{t("list.findTitle")}</h3>
                            <p className="text-sm">{t("list.findHint")}</p>
                        </div>
                    ) : (
                        <>
                            <Table
                                columns={columns}
                                data={paginatedSubjects}
                                loading={loading && !subjects.length}
                                defaultSortColumn="name"
                                emptyMessage={t("list.empty")}
                            />

                            {/* Pagination Controls */}
                            {total > 0 && (
                                <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-4 pt-4 border-t border-slate-200">
                                    <div className="flex items-center gap-2 text-sm text-slate-600">
                                        <span>{t("list.rowsPerPage")}</span>
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
                                            {t("list.range", { from: Math.min((page - 1) * pageSize + 1, total), to: Math.min(page * pageSize, total), total })}
                                        </span>
                                    </div>

                                    <div className="flex items-center gap-1">
                                        <button
                                            onClick={() => setPage(Math.max(1, page - 1))}
                                            disabled={page === 1}
                                            className="px-3 py-1.5 text-sm rounded-md border border-gray-300 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                                        >
                                            {t("list.prev")}
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
                                            {t("list.next")}
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
