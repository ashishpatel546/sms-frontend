'use client';

import Link from 'next/link';
import {
    Users, IndianRupee, CalendarCheck, GraduationCap, Pencil,
    QrCode, BarChart2, Bell, type LucideIcon, Plus, Minus, Settings, X
} from 'lucide-react';
import { useRbac } from '@/lib/rbac';
import { usePinnedActions, defaultPinnedActions } from '@/hooks/usePinnedActions';
import { useState } from 'react';

interface ActionTile {
    label: string;
    href: string;
    icon: LucideIcon;
    /** Tailwind colour classes: icon colour + tile bg on hover */
    color: string;
    bg: string;
}

/**
 * Role-aware quick action tiles.
 * – All roles:   Take Attendance, Homework, Send Notification
 * – SUB_ADMIN+:  Add Student
 * – Fees access: Collect Fee
 * – Admin+:      View Reports
 * – Teacher mgmt: Add Staff
 *
 * Displayed as a horizontal scroll strip on mobile and a wrap grid on md+,
 * so every action is always one tap away without shrinking tiles.
 */
export default function QuickActions() {
    const rbac = useRbac();
    const [isCustomizing, setIsCustomizing] = useState(false);

    const tiles: ActionTile[] = [
        {
            label: 'Take Attendance',
            href: '/dashboard/attendance',
            icon: CalendarCheck,
            color: 'text-emerald-700 dark:text-emerald-300',
            bg: 'bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:hover:bg-emerald-900/50 border-emerald-100 dark:border-emerald-900/50',
        },
        {
            label: 'Notifications',
            href: '/dashboard/notifications',
            icon: Bell,
            color: 'text-sky-700 dark:text-sky-300',
            bg: 'bg-sky-50 hover:bg-sky-100 dark:bg-sky-950/40 dark:hover:bg-sky-900/50 border-sky-100 dark:border-sky-900/50',
        },
        {
            label: 'Homework',
            href: '/dashboard/homework',
            icon: Pencil,
            color: 'text-pink-700 dark:text-pink-300',
            bg: 'bg-pink-50 hover:bg-pink-100 dark:bg-pink-950/40 dark:hover:bg-pink-900/50 border-pink-100 dark:border-pink-900/50',
        },
        {
            label: 'Students',
            href: '/dashboard/students',
            icon: Users,
            color: 'text-blue-700 dark:text-blue-300',
            bg: 'bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/40 dark:hover:bg-blue-900/50 border-blue-100 dark:border-blue-900/50',
        },
        ...(rbac.canManageStudents ? [{
            label: 'Add Student',
            href: '/dashboard/students/new',
            icon: GraduationCap,
            color: 'text-cyan-700 dark:text-cyan-300',
            bg: 'bg-cyan-50 hover:bg-cyan-100 dark:bg-cyan-950/40 dark:hover:bg-cyan-900/50 border-cyan-100 dark:border-cyan-900/50',
        }] : []),
        ...(rbac.canAccessFees ? [{
            label: 'Collect Fee',
            href: '/dashboard/fees',
            icon: IndianRupee,
            color: 'text-purple-700 dark:text-purple-300',
            bg: 'bg-purple-50 hover:bg-purple-100 dark:bg-purple-950/40 dark:hover:bg-purple-900/50 border-purple-100 dark:border-purple-900/50',
        }] : []),
        ...(rbac.canManageTeachers ? [{
            label: 'Add Staff',
            href: '/dashboard/staff/new',
            icon: Users,
            color: 'text-orange-700 dark:text-orange-300',
            bg: 'bg-orange-50 hover:bg-orange-100 dark:bg-orange-950/40 dark:hover:bg-orange-900/50 border-orange-100 dark:border-orange-900/50',
        }] : []),
        ...(rbac.isTeacher ? [{
            label: 'Scan QR',
            href: '/dashboard/pickup/scan',
            icon: QrCode,
            color: 'text-teal-700 dark:text-teal-300',
            bg: 'bg-teal-50 hover:bg-teal-100 dark:bg-teal-950/40 dark:hover:bg-teal-900/50 border-teal-100 dark:border-teal-900/50',
        }] : []),
        ...(rbac.isAdmin ? [{
            label: 'Reports',
            href: '/dashboard/reports',
            icon: BarChart2,
            color: 'text-indigo-700 dark:text-indigo-300',
            bg: 'bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/40 dark:hover:bg-indigo-900/50 border-indigo-100 dark:border-indigo-900/50',
        }] : []),
    ];

    const { pinned, isLoaded, togglePin } = usePinnedActions();
    
    // Filter tiles to only show pinned ones. 
    // If not loaded yet, use defaultPinnedActions so the initial render is not empty.
    const activePins = isLoaded ? pinned : defaultPinnedActions;
    const visibleTiles = tiles.filter(tile => activePins.includes(tile.href));

    return (
        <div className="bg-white/80 dark:bg-surface/80 backdrop-blur-sm rounded-2xl p-5 shadow-soft border border-slate-200/80 dark:border-white/10">
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-semibold text-ink">Quick Actions</h3>
                <button
                    onClick={() => setIsCustomizing(true)}
                    className="hidden md:flex items-center gap-1.5 px-2 py-1 -mr-2 rounded-lg text-xs font-medium text-ink-muted hover:text-brand hover:bg-brand/10 transition-colors"
                >
                    <Settings className="w-3.5 h-3.5" />
                    Customize
                </button>
            </div>

            {/* Mobile: horizontal scroll (thumb-friendly); md+: wrap so all tiles are visible */}
            <div className="flex gap-3 overflow-x-auto no-scrollbar pb-1 md:flex-wrap md:overflow-visible md:pb-0 min-h-[100px]">
                {visibleTiles.length > 0 ? (
                    visibleTiles.map(tile => {
                        const Icon = tile.icon;
                        return (
                            <Link
                                key={tile.href}
                                href={tile.href}
                                className={`flex flex-col items-center justify-center gap-2 p-4 rounded-xl border transition-all active:scale-95 shrink-0 w-[100px] ${tile.bg}`}
                            >
                                <Icon className={`w-7 h-7 ${tile.color}`} aria-hidden />
                                <span className={`text-xs font-medium text-center leading-tight ${tile.color}`}>
                                    {tile.label}
                                </span>
                            </Link>
                        );
                    })
                ) : (
                    <div className="flex items-center justify-center w-full h-24 text-sm text-ink-muted border-2 border-dashed border-slate-200 dark:border-white/10 rounded-xl">
                        Tap customize to add quick actions
                    </div>
                )}
            </div>

            {/* Desktop Customization Modal */}
            {isCustomizing && (
                <>
                    <div 
                        className="fixed inset-0 z-60 bg-black/40 backdrop-blur-sm hidden md:block"
                        onClick={() => setIsCustomizing(false)}
                        aria-hidden
                    />
                    <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-70 w-full max-w-md hidden md:block bg-surface/98 backdrop-blur-xl rounded-2xl shadow-2xl border border-slate-200/60 dark:border-white/10">
                        <div className="flex flex-col px-5 pt-5 pb-3">
                            <div className="flex items-center justify-between mb-2">
                                <h3 className="text-base font-semibold text-ink">Customize Dashboard</h3>
                                <button onClick={() => setIsCustomizing(false)} className="p-1.5 rounded-lg text-ink-muted hover:bg-surface-secondary transition-colors" aria-label="Close">
                                    <X className="w-5 h-5" />
                                </button>
                            </div>
                            <p className="text-xs text-ink-muted">Add or remove quick action items on your dashboard.</p>
                        </div>
                        <div className="grid grid-cols-1 gap-2 px-5 pb-5 max-h-[60vh] overflow-y-auto no-scrollbar">
                            {tiles.map(tile => {
                                const Icon = tile.icon;
                                const isPinned = activePins.includes(tile.href);
                                return (
                                    <div
                                        key={tile.href}
                                        className={`flex items-center justify-between p-3 rounded-xl border transition-all ${tile.bg} ${isPinned ? 'border-brand/30' : 'opacity-80'}`}
                                    >
                                        <div className="flex items-center gap-3">
                                            <Icon className={`w-5 h-5 ${tile.color}`} aria-hidden />
                                            <span className={`text-sm font-medium ${tile.color}`}>{tile.label}</span>
                                        </div>
                                        <button
                                            onClick={() => togglePin(tile.href)}
                                            className={`p-1.5 rounded-full transition-colors ${
                                                isPinned 
                                                    ? 'bg-red-100 text-red-600 hover:bg-red-200 dark:bg-red-900/30 dark:text-red-400' 
                                                    : 'bg-brand/10 text-brand hover:bg-brand/20'
                                            }`}
                                            aria-label={isPinned ? "Remove action" : "Add action"}
                                        >
                                            {isPinned ? <Minus className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                                        </button>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
