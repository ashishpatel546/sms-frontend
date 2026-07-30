"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowRight, CalendarDays, Hash, School, Users } from "lucide-react";
import { API_BASE_URL } from "@/lib/api";
import { getToken, authFetch } from "@/lib/auth";
import { Skeleton } from "@/components/ui/skeleton";
import { InitialsAvatar, initialsOf } from "@/components/ui/InitialsAvatar";
import { ChildGridSkeleton } from "@/components/ui/Skeletons";
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

    /*
     * Loading draws the page that is coming rather than covering it.
     *
     * The chrome we already know — the ledger tab, the description — paints
     * immediately, so the portal looks open the instant it is opened. Only the
     * two genuinely unknown things wait: the heading (a parent with one child
     * gets "Your child", several get "Your children") and the cards.
     *
     * Everything sits on the real grid, so nothing moves when the data lands.
     */
    if (loading) return (
        <PageShell measure="reading">
            <PageHeader
                section="Parent portal"
                title={<Skeleton className="h-6 w-44 max-w-[70%] sm:h-7" />}
                description="Open a record to see attendance, fees, homework and results."
            />
            <PageBody stagger={false}>
                <ChildGridSkeleton count={2} />
            </PageBody>
        </PageShell>
    );

    return (
        <PageShell measure="reading">
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
                    /*
                     * Two columns, not three. A parent has one, two, maybe four
                     * children — a three-up grid left a hole on every screen
                     * wider than a laptop and made two children look like an
                     * unfinished row. On the reading measure two cards fill the
                     * line, so the page looks composed at any child count.
                     *
                     * `stagger` sits here rather than on PageBody because the
                     * grid is a single child of the body: the cards need to be
                     * the staggered elements, not the container.
                     */
                    <div className="stagger grid grid-cols-1 gap-3 sm:grid-cols-2">
                        {students.map((student, idx) => (
                            <Link
                                key={student.id}
                                href={`/parent-dashboard/student/${student.id}`}
                                className="group/child relative flex flex-col overflow-hidden rounded-xl border border-line bg-surface p-4 shadow-soft transition-all duration-200 hover:-translate-y-0.5 hover:border-brand-edge hover:shadow-raised sm:p-5"
                            >
                                {/* The brass rail marks a child's card the way a pigment
                                    rail marks a figure — one visual language throughout.
                                    It thickens on hover, so the card answers the pointer
                                    on the same edge that identifies it. */}
                                <span
                                    aria-hidden
                                    className="absolute top-0 bottom-0 left-0 w-[3px] bg-brand transition-all duration-200 group-hover/child:w-[5px]"
                                />

                                <div className="flex items-center gap-3.5">
                                    {/* Same tone index as the sibling switcher, so a
                                        child keeps their colour across both screens. */}
                                    <InitialsAvatar
                                        initials={initialsOf(student.firstName, student.lastName)}
                                        index={idx}
                                        size="xl"
                                        className="ring-1 ring-brand-edge transition-transform duration-200 group-hover/child:scale-105"
                                    />
                                    <span className="min-w-0">
                                        <span className="block truncate font-display text-[18px] font-semibold text-ink">
                                            {student.firstName} {student.lastName}
                                        </span>
                                        <span className="mt-1 flex items-center gap-1.5 text-[12.5px] text-ink-muted">
                                            <School className="size-3.5 shrink-0" aria-hidden />
                                            {/* Section was in the payload all along and never
                                                shown — it is half of how a parent names their
                                                child's class out loud. */}
                                            <span className="truncate">
                                                {student.className || 'Class not set'}
                                                {student.sectionName ? ` · Section ${student.sectionName}` : ''}
                                            </span>
                                        </span>
                                    </span>
                                </div>

                                <dl className="mt-4 grid grid-cols-2 gap-x-3 gap-y-2 border-t border-line pt-3.5">
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

                                <span className="mt-4 flex items-center gap-1.5 text-[13px] font-semibold text-brand">
                                    Open record
                                    <ArrowRight
                                        className="size-3.5 transition-transform duration-200 group-hover/child:translate-x-1"
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
