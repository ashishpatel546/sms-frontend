"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { API_BASE_URL } from "@/lib/api";
import { getToken, authFetch } from "@/lib/auth";

export default function ParentDashboardPage() {
    const router = useRouter();
    const [students, setStudents] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    useEffect(() => {
        const fetchStudents = async () => {
            try {
                const res = await authFetch(`${API_BASE_URL}/parent/my-students`, {
                    headers: { Authorization: `Bearer ${getToken()}` },
                });
                if (!res.ok) throw new Error("Failed to load students");
                const data = await res.json();
                setStudents(data);
            } catch (err: any) {
                setError(err.message || "Failed to load students");
            } finally {
                setLoading(false);
            }
        };
        fetchStudents();
    }, []);

    const avatarColors = [
        "from-violet-500 to-purple-600",
        "from-indigo-500 to-blue-600",
        "from-pink-500 to-rose-600",
        "from-emerald-500 to-teal-600",
        "from-amber-500 to-orange-600",
    ];

    if (loading) return (
        <div className="flex flex-col items-center justify-center py-24 gap-4">
            <div className="w-10 h-10 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-slate-400 text-sm">Loading your students...</p>
        </div>
    );

    return (
        <div>
            {/* Header */}
            <div className="mb-8">
                <h1 className="text-white text-2xl sm:text-3xl font-bold mb-1">My Children</h1>
                <p className="text-slate-400">Select a student to view their dashboard</p>
            </div>

            {error && (
                <div className="flex items-center gap-3 p-4 bg-red-500/10 border border-red-500/30 rounded-2xl text-red-400 mb-6">
                    <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    {error}
                </div>
            )}

            {!loading && students.length === 0 && !error && (
                <div className="text-center py-20">
                    <div className="w-16 h-16 mx-auto rounded-2xl bg-slate-800 flex items-center justify-center mb-4">
                        <svg className="w-8 h-8 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                        </svg>
                    </div>
                    <p className="text-slate-400 text-lg font-medium mb-2">No students found</p>
                    <p className="text-slate-500 text-sm max-w-sm mx-auto">
                        Your mobile number is not linked to any student record. Please contact the school administration.
                    </p>
                </div>
            )}

            {/* Student Cards Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {students.map((student, idx) => (
                    <Link
                        key={student.id}
                        href={`/parent-dashboard/student/${student.id}`}
                        className="group relative bg-slate-900 border border-slate-800 rounded-2xl p-6 hover:border-indigo-500/60 hover:shadow-xl hover:shadow-indigo-500/10 transition-all duration-300 overflow-hidden"
                    >
                        {/* Background glow on hover */}
                        <div className="absolute inset-0 bg-linear-to-br from-indigo-500/5 to-purple-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

                        <div className="relative">
                            {/* Avatar */}
                            <div className={`w-14 h-14 rounded-2xl bg-linear-to-br ${avatarColors[idx % avatarColors.length]} flex items-center justify-center text-white text-xl font-bold shadow-lg mb-4`}>
                                {student.firstName?.[0]}{student.lastName?.[0]}
                            </div>

                            {/* Name */}
                            <h3 className="text-white text-lg font-bold mb-1 group-hover:text-indigo-300 transition-colors">
                                {student.firstName} {student.lastName}
                            </h3>

                            {/* Details */}
                            <div className="space-y-1.5 mb-4">
                                <div className="flex items-center gap-2 text-sm text-slate-400">
                                    <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                                    </svg>
                                    Class {student.className} – {student.sectionName}
                                </div>
                                {student.rollNo && (
                                    <div className="flex items-center gap-2 text-sm text-slate-400">
                                        <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14" />
                                        </svg>
                                        Roll No: {student.rollNo}
                                    </div>
                                )}
                                {student.academicSession && (
                                    <div className="flex items-center gap-2 text-sm text-slate-400">
                                        <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                        </svg>
                                        {student.academicSession}
                                    </div>
                                )}
                            </div>

                            {/* View button */}
                            <div className="flex items-center gap-1.5 text-indigo-400 group-hover:text-indigo-300 text-sm font-medium transition-colors">
                                View Dashboard
                                <svg className="w-4 h-4 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                </svg>
                            </div>
                        </div>
                    </Link>
                ))}
            </div>
        </div>
    );
}
