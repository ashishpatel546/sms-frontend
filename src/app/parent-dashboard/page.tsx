"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowRight, CalendarDays, Hash, School, Users } from "lucide-react";
import { API_BASE_URL } from "@/lib/api";
import { getToken, authFetch } from "@/lib/auth";
import { AnimatedLoader } from "@/components/ui/AnimatedLoader";
import { PageBody, PageHeader, PageShell } from "@/components/ui/PageHeader";
import { EmptyState, ErrorState } from "@/components/ui/EmptyState";
import { Panel } from "@/components/ui/Panel";

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

    if (loading) return <AnimatedLoader size="fullscreen" text="Loading your students…" />;

    return (
        <PageShell>
            <PageHeader
                section="Parent portal"
                title={students.length > 1 ? "Your children" : "Your child"}
                description="Open a record to see attendance, fees, homework and results."
            />

            <PageBody>
                {error && (
                    <Panel>
                        <ErrorState
                            description={error}
                            onRetry={() => window.location.reload()}
                        />
                    </Panel>
                )}

                {!error && students.length === 0 && (
                    <Panel>
                        <EmptyState
                            icon={<Users />}
                            title="No student linked to this number"
                            description="Your mobile number isn't attached to a student record yet. The school office can link it for you."
                        />
                    </Panel>
                )}

                {students.length > 0 && (
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                        {students.map(student => (
                            <Link
                                key={student.id}
                                href={`/parent-dashboard/student/${student.id}`}
                                className="group/child relative flex flex-col overflow-hidden rounded-xl border border-line bg-surface p-4 shadow-soft transition-all hover:-translate-y-0.5 hover:border-brand-edge hover:shadow-raised"
                            >
                                {/* The brass rail marks a child's card the way a pigment
                                    rail marks a figure — one visual language throughout. */}
                                <span
                                    aria-hidden
                                    className="absolute top-0 bottom-0 left-0 w-[3px] bg-brand"
                                />

                                <div className="flex items-center gap-3">
                                    <span className="grid size-13 shrink-0 place-items-center rounded-xl bg-linear-to-br from-brass-500 to-marigold-400 font-display text-[19px] font-bold text-white">
                                        {student.firstName?.[0]}{student.lastName?.[0]}
                                    </span>
                                    <span className="min-w-0">
                                        <span className="block truncate font-display text-[17px] font-semibold text-ink">
                                            {student.firstName} {student.lastName}
                                        </span>
                                        <span className="mt-1 flex items-center gap-1.5 text-[12.5px] text-ink-muted">
                                            <School className="size-3.5 shrink-0" aria-hidden />
                                            {student.className || 'Class not set'}
                                        </span>
                                    </span>
                                </div>

                                <dl className="mt-3.5 grid grid-cols-2 gap-x-3 gap-y-2 border-t border-line pt-3">
                                    <div className="min-w-0">
                                        <dt className="eyebrow flex items-center gap-1">
                                            <Hash className="size-3" aria-hidden />
                                            Roll no
                                        </dt>
                                        <dd className="tabular mt-0.5 text-[13.5px] text-ink">
                                            {student.rollNo || '—'}
                                        </dd>
                                    </div>
                                    <div className="min-w-0">
                                        <dt className="eyebrow flex items-center gap-1">
                                            <CalendarDays className="size-3" aria-hidden />
                                            Session
                                        </dt>
                                        <dd className="mt-0.5 truncate text-[13.5px] text-ink">
                                            {student.academicSession || '—'}
                                        </dd>
                                    </div>
                                </dl>

                                <span className="mt-3.5 flex items-center gap-1.5 text-[13px] font-semibold text-brand">
                                    Open record
                                    <ArrowRight
                                        className="size-3.5 transition-transform group-hover/child:translate-x-0.5"
                                        aria-hidden
                                    />
                                </span>
                            </Link>
                        ))}
                    </div>
                )}
            </PageBody>
        </PageShell>
    );
}
