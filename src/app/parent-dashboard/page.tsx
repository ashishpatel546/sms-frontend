"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { API_BASE_URL } from "@/lib/api";
import { getToken, authFetch } from "@/lib/auth";
import { AnimatedLoader } from "@/components/ui/AnimatedLoader";
import { GlassCard } from "@/components/ui/GlassCard";
import { Button } from "@/components/ui/button";

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
                // If there is exactly one student, go straight to their dashboard
                if (data.length === 1) {
                    router.replace(`/parent-dashboard/student/${data[0].id}`);
                    return;
                }
                setStudents(data);
            } catch (err: any) {
                setError(err.message || "Failed to load students");
            } finally {
                setLoading(false);
            }
        };
        fetchStudents();
    }, [router]);

    const avatarColors = [
        "from-violet-500 to-purple-600",
        "from-brand to-brand-light",
        "from-pink-500 to-rose-600",
        "from-accent-success to-emerald-600",
        "from-accent-warn to-orange-600",
    ];

    if (loading) return <AnimatedLoader size="fullscreen" text="Loading your students..." />;

    return (
        <div className="max-w-6xl mx-auto space-y-6">
            {/* Header */}
            <div className="mb-8 animate-fade-in px-2">
                <div className="flex items-center gap-3 mb-2">
                    <div className="w-10 h-10 rounded-xl bg-brand/10 flex items-center justify-center text-brand border border-brand/20 shadow-inner">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                        </svg>
                    </div>
                    <h1 className="text-ink text-3xl sm:text-4xl font-extrabold tracking-tight">Enrolled Students</h1>
                </div>
                <p className="text-ink-muted text-sm sm:text-base">Select a student to view their dashboard and track their progress.</p>
            </div>

            {error && (
                <div className="flex items-center gap-3 p-4 bg-accent-danger/10 border border-accent-danger/30 rounded-2xl text-accent-danger mb-6 animate-slide-up mx-2">
                    <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    {error}
                </div>
            )}

            {!loading && students.length === 0 && !error && (
                <GlassCard className="text-center py-24 mx-2 animate-scale-in flex flex-col items-center">
                    <div className="w-20 h-20 rounded-full bg-surface-secondary flex items-center justify-center mb-5 ring-4 ring-brand/10">
                        <svg className="w-8 h-8 text-ink-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                        </svg>
                    </div>
                    <p className="text-ink text-lg font-bold mb-2">No students found</p>
                    <p className="text-ink-muted text-sm max-w-sm mx-auto">
                        Your mobile number is not linked to any student record. Please contact the school administration.
                    </p>
                </GlassCard>
            )}

            {/* Student Cards Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 px-2">
                {students.map((student, idx) => (
                    <Link key={student.id} href={`/parent-dashboard/student/${student.id}`}>
                        <GlassCard
                            className="group relative p-6 sm:p-7 hover:border-brand/40 hover:shadow-xl transition-all duration-300 overflow-hidden animate-slide-up cursor-pointer h-full flex flex-col"
                            style={{ animationDelay: `${idx * 100}ms` }}
                        >
                            {/* Header Section of Card */}
                            <div className="flex items-center gap-4 mb-6">
                                {/* Avatar */}
                                <div className={`w-16 h-16 rounded-2xl bg-linear-to-br ${avatarColors[idx % avatarColors.length]} flex items-center justify-center text-white text-2xl font-bold shadow-md shrink-0 group-hover:scale-105 transition-transform duration-300`}>
                                    {student.firstName?.[0]}{student.lastName?.[0]}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <h3 className="text-ink text-xl font-bold truncate group-hover:text-brand transition-colors">
                                        {student.firstName} {student.lastName}
                                    </h3>
                                    <div className="flex flex-col items-start gap-2 mt-2">
                                        <div className="flex items-center gap-1.5 px-2.5 py-1 bg-brand/5 text-brand text-xs rounded-lg font-medium border border-brand/10 whitespace-nowrap">
                                            <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                                            </svg>
                                            {student.className || 'N/A'}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Details */}
                            <div className="flex flex-wrap gap-2 mb-6 bg-surface-secondary rounded-2xl p-4 border border-slate-100 mt-auto">
                                <div className="flex items-center gap-1.5 px-3 py-1.5 bg-accent-info/10 text-accent-info text-xs rounded-lg font-medium border border-accent-info/20 w-fit whitespace-nowrap">
                                    <svg className="w-3.5 h-3.5 opacity-80 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 114 0v1m-4 0a2 2 0 104 0m-5 8a2 2 0 100-4 2 2 0 000 4zm0 0c1.306 0 2.417.835 2.83 2M9 14a3.001 3.001 0 00-2.83 2M15 11h3m-3 4h3" />
                                    </svg>
                                    Roll No: {student.rollNo || 'N/A'}
                                </div>
                                <div className="flex items-center gap-1.5 px-3 py-1.5 bg-accent-success/10 text-accent-success text-xs rounded-lg font-medium border border-accent-success/20 w-fit whitespace-nowrap">
                                    <svg className="w-3.5 h-3.5 opacity-80 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                    </svg>
                                    {student.academicSession || 'N/A'}
                                </div>
                            </div>

                            <Button variant="outline" className="w-full group-hover:bg-brand group-hover:text-white transition-all">
                                View Dashboard
                                <svg className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                </svg>
                            </Button>
                        </GlassCard>
                    </Link>
                ))}
            </div>
        </div>
    );
}
