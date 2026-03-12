'use client';

import Link from 'next/link';
import { Users, IndianRupee, CalendarCheck } from 'lucide-react';
import { useRbac } from '@/lib/rbac';

export default function QuickActions() {
    const rbac = useRbac();

    return (
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
            <h3 className="text-lg font-semibold text-slate-800 mb-4">Quick Actions</h3>
            <div className="grid grid-cols-2 gap-4">
                {/* Take Attendance — visible to ALL staff including TEACHER */}
                <Link
                    href="/dashboard/attendance"
                    className="flex flex-col items-center justify-center p-6 bg-slate-50 rounded-xl hover:bg-emerald-50 hover:text-emerald-600 transition-colors border border-slate-100 group"
                >
                    <CalendarCheck className="w-8 h-8 text-slate-400 group-hover:text-emerald-600 mb-3" />
                    <span className="text-sm font-medium text-slate-600 group-hover:text-emerald-700">Take Attendance</span>
                </Link>

                {/* Add Student — SUB_ADMIN+ only */}
                {rbac.canManageStudents && (
                    <Link
                        href="/dashboard/students/new"
                        className="flex flex-col items-center justify-center p-6 bg-slate-50 rounded-xl hover:bg-blue-50 hover:text-blue-600 transition-colors border border-slate-100 group"
                    >
                        <Users className="w-8 h-8 text-slate-400 group-hover:text-blue-600 mb-3" />
                        <span className="text-sm font-medium text-slate-600 group-hover:text-blue-700">Add Student</span>
                    </Link>
                )}

                {/* Collect Fee — SUB_ADMIN+ only */}
                {rbac.canAccessFees && (
                    <Link
                        href="/dashboard/fees"
                        className="flex flex-col items-center justify-center p-6 bg-slate-50 rounded-xl hover:bg-purple-50 hover:text-purple-600 transition-colors border border-slate-100 group"
                    >
                        <IndianRupee className="w-8 h-8 text-slate-400 group-hover:text-purple-600 mb-3" />
                        <span className="text-sm font-medium text-slate-600 group-hover:text-purple-700">Collect Fee</span>
                    </Link>
                )}
            </div>
        </div>
    );
}
