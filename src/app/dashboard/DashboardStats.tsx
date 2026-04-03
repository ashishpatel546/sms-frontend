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

export default function DashboardStats({ selectedDate }: { selectedDate: string }) {
    const [stats, setStats] = useState<Stats>(defaultStats);
    const [loading, setLoading] = useState(true);
    const [isAdminUser, setIsAdminUser] = useState(false);

    useEffect(() => {
        setIsAdminUser(useRbac().isAdmin);
        async function fetchStats() {
            try {
                const url = getEnv('API_URL') || 'http://localhost:3000';
                const queryParams = selectedDate ? `?date=${selectedDate}` : '';
                const res = await authFetch(`${url}/dashboard/stats${queryParams}`);
                if (!res.ok) {
                    setStats(defaultStats);
                    return;
                }
                const data = await res.json();
                setStats(data);
            } catch (err) {
                console.error('Error fetching stats:', err);
                setStats(defaultStats);
            } finally {
                setLoading(false);
            }
        }
        fetchStats();
    }, [selectedDate]);

    const statCards: Array<{ title: string; value: string | number; icon: any; color: string; bgColor: string; borderColor: string; }> = [
        {
            title: 'Total Students',
            value: stats.students,
            icon: Users,
            color: 'text-blue-600',
            bgColor: 'bg-blue-100',
            borderColor: 'border-blue-200',
        },
        {
            title: 'Present',
            value: stats.attendanceToday,
            icon: UserCheck,
            color: 'text-emerald-600',
            bgColor: 'bg-emerald-100',
            borderColor: 'border-emerald-200',
        },
        {
            title: 'Staff',
            value: stats.staff,
            icon: GraduationCap,
            color: 'text-purple-600',
            bgColor: 'bg-purple-100',
            borderColor: 'border-purple-200',
        },
        {
            title: 'Total Classes',
            value: stats.classes,
            icon: Presentation,
            color: 'text-orange-600',
            bgColor: 'bg-orange-100',
            borderColor: 'border-orange-200',
        },
    ];

    if (isAdminUser) {
        statCards.push({
            title: 'Fees Collected (M)',
            value: `₹${stats.feesCollected?.toLocaleString('en-IN') || 0}`,
            icon: IndianRupee,
            color: 'text-rose-600',
            bgColor: 'bg-rose-100',
            borderColor: 'border-rose-200',
        });
    }

    return (
        <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 ${isAdminUser ? 'xl:grid-cols-5' : 'xl:grid-cols-4'} gap-6`}>
            {statCards.map((stat, i) => {
                const Icon = stat.icon;
                return (
                    <div
                        key={i}
                        className={`bg-white rounded-2xl p-6 shadow-sm border ${stat.borderColor} hover:shadow-md transition-shadow relative overflow-hidden group`}
                    >
                        <div
                            className={`absolute -right-4 -top-4 w-24 h-24 rounded-full ${stat.bgColor} opacity-50 group-hover:scale-150 transition-transform duration-500 ease-out`}
                        />
                        <div className="relative flex flex-col h-full justify-between">
                            <div className="flex items-start justify-between">
                                <div className={`p-3 rounded-xl ${stat.bgColor} ${stat.color} shadow-inner`}>
                                    <Icon className="w-6 h-6" strokeWidth={2} />
                                </div>
                            </div>
                            <div className="mt-6">
                                <p className="text-sm font-medium text-slate-500 mb-1">{stat.title}</p>
                                <h3 className="text-3xl font-bold text-slate-900 tracking-tight">
                                    {loading ? (
                                        <span className="inline-block w-12 h-8 bg-slate-200 rounded animate-pulse" />
                                    ) : (
                                        stat.value
                                    )}
                                </h3>
                            </div>
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
