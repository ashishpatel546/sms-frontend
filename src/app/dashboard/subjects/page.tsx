"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Table from "../../../components/Table";
import useSWR from "swr";
import { fetcher } from "@/lib/api";
import { Loader } from "@/components/ui/Loader";
import { useRbac } from "@/lib/rbac";

export default function SubjectsPage() {
    const { data: subjects = [], isLoading: loading, error } = useSWR('/subjects', fetcher);
    const [searchTerm, setSearchTerm] = useState("");
    const rbac = useRbac();

    const filteredSubjects = subjects.filter((s: any) => {
        if (!searchTerm) return true;
        const lower = searchTerm.toLowerCase();
        return s.id.toString().includes(lower) || s.name.toLowerCase().includes(lower);
    });

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
            <div className="max-w-6xl mx-auto">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
                    <h1 className="text-2xl font-bold text-slate-800">Subjects</h1>
                    {rbac.canManageSubjects && (
                        <Link href="/dashboard/subjects/new" className="text-white bg-blue-700 hover:bg-blue-800 focus:ring-4 focus:ring-blue-300 font-medium rounded-lg text-sm px-5 py-2.5 focus:outline-none w-full sm:w-auto text-center whitespace-nowrap">
                            + Add Subject
                        </Link>
                    )}
                </div>

                <div className="mb-6 bg-white p-5 rounded-lg shadow-sm border border-slate-200">
                    <div className="flex flex-col md:flex-row md:items-center gap-4">
                        <div className="flex-1">
                            <label className="block mb-2 text-sm font-medium text-gray-900">Search Subjects</label>
                            <input
                                type="text"
                                placeholder="Search by ID or Name..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5"
                            />
                        </div>
                    </div>
                </div>

                <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
                    <Table
                        columns={columns}
                        data={filteredSubjects}
                        loading={loading}
                        defaultSortColumn="name"
                        emptyMessage="No subjects found matching your criteria."
                    />
                </div>
            </div>
        </main>
    );
}
