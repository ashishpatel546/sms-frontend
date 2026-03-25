"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Table from "../../../components/Table";
import useSWR from "swr";
import { fetcher } from "@/lib/api";
import { Loader } from "@/components/ui/Loader";
import { useRbac } from "@/lib/rbac";

export default function ClassesPage() {
    const { data, error, isLoading } = useSWR('/classes', fetcher);
    const [tableData, setTableData] = useState<any[]>([]);
    const rbac = useRbac();

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
                        studentCount: sec.students ? sec.students.length : 0,
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

    if (isLoading) return <Loader fullScreen text="Loading classes..." />;
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
            <div className="max-w-6xl mx-auto">
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

                <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200">
                    <Table
                        columns={columns}
                        data={tableData}
                        loading={false}
                        defaultSortColumn="className"
                        emptyMessage="No classes found."
                    />
                </div>
            </div>
        </main>
    );
}
