"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { API_BASE_URL } from "@/lib/api";
import { authFetch } from "@/lib/auth";

export default function TeacherHistoryPage() {
    const params = useParams();
    const id = params?.id as string;
    const [history, setHistory] = useState<{ subjectHistory: any[], classTeacherHistory: any[] }>({ subjectHistory: [], classTeacherHistory: [] });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    useEffect(() => {
        if (!id) return;
        const fetchHistory = async () => {
            try {
                const res = await authFetch(`${API_BASE_URL}/staff/${id}/history`);
                if (!res.ok) throw new Error("Failed to fetch history");
                const data = await res.json();
                // Handle legacy response or new object structure
                if (Array.isArray(data)) {
                    setHistory({ subjectHistory: data, classTeacherHistory: [] });
                } else {
                    setHistory(data);
                }
            } catch (err: any) {
                setError(err.message || "Failed to load history");
            } finally {
                setLoading(false);
            }
        };

        fetchHistory();
    }, [id]);

    if (loading) return <div className="p-4">Loading...</div>;
    if (error) return <div className="p-4 text-red-600">{error}</div>;

    return (
        <main className="p-4 space-y-8">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold text-slate-800">Assignment History</h1>
                <Link href="/dashboard/staff" className="text-blue-600 hover:underline">
                    &larr; Back to Teachers
                </Link>
            </div>

            {/* Subject Assignments */}
            <div>
                <h2 className="text-xl font-bold mb-4 text-slate-700">Subject Assignments</h2>
                <div className="relative overflow-x-auto shadow-md sm:rounded-lg">
                    <table className="w-full text-sm text-left text-gray-500">
                        <thead className="text-xs text-gray-700 uppercase bg-gray-50">
                            <tr>
                                <th scope="col" className="px-6 py-3">Subject</th>
                                <th scope="col" className="px-6 py-3">Class</th>
                                <th scope="col" className="px-6 py-3">Section</th>
                                <th scope="col" className="px-6 py-3">Start Date</th>
                                <th scope="col" className="px-6 py-3">End Date</th>
                                <th scope="col" className="px-6 py-3">Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {history.subjectHistory.length === 0 ? (
                                <tr className="bg-white border-b hover:bg-gray-50">
                                    <td colSpan={6} className="px-6 py-4 text-center">No assignment history found.</td>
                                </tr>
                            ) : (
                                history.subjectHistory.map((item: any) => (
                                    <tr key={item.id} className="bg-white border-b hover:bg-gray-50">
                                        <td className="px-6 py-4 font-medium text-gray-900">{item.subject.name}</td>
                                        <td className="px-6 py-4">{item.class.name}</td>
                                        <td className="px-6 py-4">{item.section.name}</td>
                                        <td className="px-6 py-4">{new Date(item.startDate).toLocaleDateString()}</td>
                                        <td className="px-6 py-4">{item.endDate ? new Date(item.endDate).toLocaleDateString() : '-'}</td>
                                        <td className="px-6 py-4">
                                            <span className={`px-2 py-1 font-semibold leading-tight ${item.isActive ? 'text-green-700 bg-green-100' : 'text-gray-700 bg-gray-100'} rounded-full`}>
                                                {item.isActive ? 'Active' : 'Ended'}
                                            </span>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Class Teacher History */}
            <div>
                <h2 className="text-xl font-bold mb-4 text-slate-700">Class Teacher Roles</h2>
                <div className="relative overflow-x-auto shadow-md sm:rounded-lg">
                    <table className="w-full text-sm text-left text-gray-500">
                        <thead className="text-xs text-gray-700 uppercase bg-gray-50">
                            <tr>
                                <th scope="col" className="px-6 py-3">Class</th>
                                <th scope="col" className="px-6 py-3">Start Date</th>
                                <th scope="col" className="px-6 py-3">End Date</th>
                                <th scope="col" className="px-6 py-3">Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {history.classTeacherHistory.length === 0 ? (
                                <tr className="bg-white border-b hover:bg-gray-50">
                                    <td colSpan={4} className="px-6 py-4 text-center">No class teacher history found.</td>
                                </tr>
                            ) : (
                                history.classTeacherHistory.map((item: any) => (
                                    <tr key={item.id} className="bg-white border-b hover:bg-gray-50">
                                        <td className="px-6 py-4 font-medium text-gray-900">{item.class.name}</td>
                                        <td className="px-6 py-4">{new Date(item.startDate).toLocaleDateString()}</td>
                                        <td className="px-6 py-4">{item.endDate ? new Date(item.endDate).toLocaleDateString() : '-'}</td>
                                        <td className="px-6 py-4">
                                            <span className={`px-2 py-1 font-semibold leading-tight ${item.isActive ? 'text-green-700 bg-green-100' : 'text-gray-700 bg-gray-100'} rounded-full`}>
                                                {item.isActive ? 'Active' : 'Ended'}
                                            </span>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </main>
    );
}
