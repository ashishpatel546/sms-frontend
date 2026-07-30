'use client';

import { useEffect, useState } from 'react';
import { Users, GraduationCap, Presentation, IndianRupee, UserCheck } from 'lucide-react';
import { authFetch } from '@/lib/auth';
import { useRbac } from '@/lib/rbac';
import { getEnv } from '@/lib/env';
import { StatTile, StatGrid } from '@/components/ui/StatTile';
import { Skeleton } from '@/components/ui/skeleton';
import { formatINRShort } from '@/components/ui/Money';
import type { Pigment } from '@/components/ui/pigment';

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

    /**
     * Each tile's pigment states what kind of figure it is, not which colour
     * looked nice: a headcount is informational, attendance is a settled fact,
     * money owed to the school wants attention. That is why the row can be read
     * before any of the numbers are.
     */
    const cards: {
        label: string;
        value: string;
        hint?: string;
        icon: React.ReactNode;
        pigment: Pigment;
        bar?: number;
    }[] = [
        {
            label: 'Total students',
            value: stats.students.toLocaleString('en-IN'),
            hint: 'Enrolled',
            icon: <Users />,
            pigment: 'info',
        },
        {
            label: 'Present today',
            value: stats.attendanceToday.toLocaleString('en-IN'),
            hint: 'Students present',
            icon: <UserCheck />,
            pigment: 'success',
            bar: attendancePct,
        },
        {
            label: 'Staff',
            value: stats.staff.toLocaleString('en-IN'),
            hint: 'Teachers & admins',
            icon: <GraduationCap />,
            pigment: 'info',
        },
        {
            label: 'Classes',
            value: stats.classes.toLocaleString('en-IN'),
            hint: 'Active sections',
            icon: <Presentation />,
            pigment: 'info',
        },
    ];

    if (isAdmin) {
        cards.push({
            label: 'Fees this month',
            value: `₹${formatINRShort(stats.feesCollected ?? 0)}`,
            hint: 'Collected',
            icon: <IndianRupee />,
            pigment: 'attn',
        });
    }

    return (
        <StatGrid columns={isAdmin ? 5 : 4}>
            {cards.map(card => (
                <StatTile
                    key={card.label}
                    label={card.label}
                    value={loading ? <Skeleton className="h-7 w-16" /> : card.value}
                    hint={loading ? undefined : card.hint}
                    icon={card.icon}
                    pigment={card.pigment}
                >
                    {card.bar !== undefined && !loading && (
                        <div className="flex flex-col gap-1.5">
                            <div className="flex items-center justify-between">
                                <span className="eyebrow">Attendance rate</span>
                                <span className="tabular text-[11.5px] font-semibold text-accent-success-deep">
                                    {card.bar}%
                                </span>
                            </div>
                            <div
                                role="progressbar"
                                aria-valuenow={card.bar}
                                aria-valuemin={0}
                                aria-valuemax={100}
                                aria-label="Attendance rate"
                                className="h-1.5 w-full overflow-hidden rounded-full bg-accent-success-tint"
                            >
                                <div
                                    className="h-full rounded-full bg-accent-success transition-[width] duration-700 ease-out"
                                    style={{ width: `${card.bar}%` }}
                                />
                            </div>
                        </div>
                    )}
                </StatTile>
            ))}
        </StatGrid>
    );
}
