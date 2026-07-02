'use client';

import { useEffect, useState } from 'react';
import { Users, GraduationCap, Presentation, IndianRupee, UserCheck } from 'lucide-react';
import { authFetch } from '@/lib/auth';
import { useRbac } from '@/lib/rbac';
import { getEnv } from '@/lib/env';

interface Stats {
    students: number;
    staff: number;
    classes: number;
    feesCollected: number;
    attendanceToday: number;
}

const defaultStats: Stats = {
    students: 0,
    staff: 0,
    classes: 0,
    feesCollected: 0,
    attendanceToday: 0,
};

interface StatCard {
    title: string;
    value: string;
    subtitle: string;
    icon: any;
    iconBg: string;
    cardGradient: string;
    border: string;
    blob: string;
    showBar?: boolean;
    barPct?: number;
}

function fmtFees(n: number): string {
    if (n >= 10_000_000) return `₹${(n / 10_000_000).toFixed(1)}Cr`;
    if (n >= 100_000) return `₹${(n / 100_000).toFixed(1)}L`;
    return `₹${n.toLocaleString('en-IN')}`;
}

export default function DashboardStats({ selectedDate }: { selectedDate: string }) {
    const [stats, setStats] = useState<Stats>(defaultStats);
    const [loading, setLoading] = useState(true);
    const { isAdmin } = useRbac();

    useEffect(() => {
        async function fetchStats() {
            try {
                const url = getEnv('API_URL') || 'http://localhost:3000';
                const res = await authFetch(`${url}/dashboard/stats${selectedDate ? `?date=${selectedDate}` : ''}`);
                if (res.ok) setStats(await res.json());
                else setStats(defaultStats);
            } catch {
                setStats(defaultStats);
            } finally {
                setLoading(false);
            }
        }
        fetchStats();
    }, [selectedDate]);

    const attendancePct = stats.students > 0
        ? Math.round((stats.attendanceToday / stats.students) * 100)
        : 0;

    const cards: StatCard[] = [
        {
            title: 'Total Students',
            value: stats.students.toLocaleString('en-IN'),
            subtitle: 'Enrolled',
            icon: Users,
            iconBg: 'bg-blue-500',
            cardGradient: 'from-blue-50 to-sky-50/60 dark:from-blue-950/60 dark:to-blue-900/20',
            border: 'border-blue-200/70 dark:border-blue-700/30',
            blob: 'bg-blue-400',
        },
        {
            title: 'Present Today',
            value: stats.attendanceToday.toLocaleString('en-IN'),
            subtitle: loading ? '' : 'Students present',
            icon: UserCheck,
            iconBg: 'bg-emerald-500',
            cardGradient: 'from-emerald-50 to-teal-50/60 dark:from-emerald-950/60 dark:to-emerald-900/20',
            border: 'border-emerald-200/70 dark:border-emerald-700/30',
            blob: 'bg-emerald-400',
            showBar: true,
            barPct: attendancePct,
        },
        {
            title: 'Staff',
            value: stats.staff.toLocaleString('en-IN'),
            subtitle: 'Teachers & admins',
            icon: GraduationCap,
            iconBg: 'bg-violet-500',
            cardGradient: 'from-violet-50 to-purple-50/60 dark:from-violet-950/60 dark:to-violet-900/20',
            border: 'border-violet-200/70 dark:border-violet-700/30',
            blob: 'bg-violet-400',
        },
        {
            title: 'Classes',
            value: stats.classes.toLocaleString('en-IN'),
            subtitle: 'Active sections',
            icon: Presentation,
            iconBg: 'bg-amber-500',
            cardGradient: 'from-amber-50 to-yellow-50/60 dark:from-amber-950/60 dark:to-amber-900/20',
            border: 'border-amber-200/70 dark:border-amber-700/30',
            blob: 'bg-amber-400',
        },
    ];

    if (isAdmin) {
        cards.push({
            title: 'Fees (Month)',
            value: fmtFees(stats.feesCollected ?? 0),
            subtitle: 'Collected this month',
            icon: IndianRupee,
            iconBg: 'bg-rose-500',
            cardGradient: 'from-rose-50 to-pink-50/60 dark:from-rose-950/60 dark:to-rose-900/20',
            border: 'border-rose-200/70 dark:border-rose-700/30',
            blob: 'bg-rose-400',
        });
    }

    return (
        <div className={`grid grid-cols-2 ${isAdmin ? 'sm:grid-cols-3 lg:grid-cols-5' : 'md:grid-cols-4'} gap-3 sm:gap-4`}>
            {cards.map((card, i) => {
                const Icon = card.icon;
                return (
                    <div
                        key={i}
                        className={`relative overflow-hidden rounded-2xl border ${card.border} bg-linear-to-br ${card.cardGradient} shadow-soft hover:shadow-md transition-all duration-300 hover:-translate-y-0.5 group cursor-default`}
                    >
                        {/* Decorative blob — bottom-right accent circle */}
                        <div
                            className={`absolute -bottom-7 -right-7 w-28 h-28 rounded-full ${card.blob} opacity-[0.12] dark:opacity-[0.18] group-hover:scale-110 transition-transform duration-500`}
                        />
                        {/* Small top-left echo */}
                        <div
                            className={`absolute -top-4 -left-4 w-14 h-14 rounded-full ${card.blob} opacity-[0.08] dark:opacity-[0.12]`}
                        />

                        <div className="relative p-4 sm:p-5 flex flex-col gap-3">
                            {/* Icon pill */}
                            <div
                                className={`w-10 h-10 sm:w-12 sm:h-12 rounded-xl ${card.iconBg} text-white flex items-center justify-center shadow-sm shrink-0`}
                            >
                                <Icon className="w-5 h-5 sm:w-6 sm:h-6" strokeWidth={2.2} />
                            </div>

                            {/* Metric */}
                            <div>
                                <p className="text-[11px] sm:text-xs font-semibold text-ink-muted uppercase tracking-wide mb-1 leading-tight">
                                    {card.title}
                                </p>
                                {loading ? (
                                    <div className="h-7 sm:h-9 w-16 bg-surface-secondary/60 rounded-lg animate-pulse" />
                                ) : (
                                    <p className="text-2xl sm:text-3xl font-extrabold text-ink tracking-tight leading-none">
                                        {card.value}
                                    </p>
                                )}
                                {!loading && card.subtitle && (
                                    <p className="text-[11px] sm:text-xs text-ink-muted mt-1 leading-snug">
                                        {card.subtitle}
                                    </p>
                                )}
                            </div>

                            {/* Attendance progress bar */}
                            {card.showBar && !loading && (
                                <div className="mt-1 flex flex-col gap-1.5">
                                    <div className="flex items-center justify-between text-[11px] font-bold text-emerald-700 dark:text-emerald-400">
                                        <span className="uppercase tracking-wider">Attendance Rate</span>
                                        <span>{card.barPct ?? 0}%</span>
                                    </div>
                                    <div className="h-2 w-full bg-emerald-200/80 dark:bg-emerald-900/80 rounded-full overflow-hidden shadow-inner">
                                        <div
                                            className="h-full bg-emerald-600 dark:bg-emerald-400 rounded-full transition-all duration-1000 ease-out"
                                            style={{ width: `${card.barPct ?? 0}%` }}
                                        />
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
