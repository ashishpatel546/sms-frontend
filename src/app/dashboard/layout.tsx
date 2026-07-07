"use client";

import { usePathname, useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import Link from "next/link";
import { getUser, resetRefreshState, silentRefresh } from "@/lib/auth";
import { TopBar } from "@/components/dashboard/TopBar";
import { Sidebar } from "@/components/dashboard/Sidebar";
import { BottomTabBar } from "@/components/dashboard/BottomTabBar";
import { useRbac } from "@/lib/rbac";
import {
    Users, IndianRupee, CalendarCheck, GraduationCap, Pencil,
    QrCode, BarChart2, Bell, X, Plus, Minus, type LucideIcon, Clock
} from "lucide-react";
import { usePinnedActions } from "@/hooks/usePinnedActions";

// ── Quick Actions Sheet ─────────────────────────────────────────────────────
// Shown from the "+" bottom tab. Lists role-aware action tiles in a bottom sheet.
function QuickActionsSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
    const rbac = useRbac();
    const { pinned, togglePin } = usePinnedActions();

    type Tile = { label: string; href: string; icon: LucideIcon; color: string; bg: string };
    const tiles: Tile[] = [
        { label: 'Take Attendance', href: '/dashboard/attendance',    icon: CalendarCheck, color: 'text-emerald-700 dark:text-emerald-300', bg: 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-100 dark:border-emerald-900/50' },
        { label: 'Notifications',   href: '/dashboard/notifications', icon: Bell,          color: 'text-sky-700 dark:text-sky-300',         bg: 'bg-sky-50 dark:bg-sky-950/40 border-sky-100 dark:border-sky-900/50' },
        { label: 'Homework',        href: '/dashboard/homework',      icon: Pencil,        color: 'text-pink-700 dark:text-pink-300',       bg: 'bg-pink-50 dark:bg-pink-950/40 border-pink-100 dark:border-pink-900/50' },
        { label: 'Students',        href: '/dashboard/students',      icon: Users,         color: 'text-blue-700 dark:text-blue-300',       bg: 'bg-blue-50 dark:bg-blue-950/40 border-blue-100 dark:border-blue-900/50' },
        ...(rbac.canManageStudents ? [{ label: 'Add Student', href: '/dashboard/students/new', icon: GraduationCap, color: 'text-cyan-700 dark:text-cyan-300', bg: 'bg-cyan-50 dark:bg-cyan-950/40 border-cyan-100 dark:border-cyan-900/50' }] : []),
        ...(rbac.canAccessFees     ? [{ label: 'Collect Fee',  href: '/dashboard/fees',         icon: IndianRupee,   color: 'text-purple-700 dark:text-purple-300', bg: 'bg-purple-50 dark:bg-purple-950/40 border-purple-100 dark:border-purple-900/50' }] : []),
        ...(rbac.canManageTeachers ? [{ label: 'Add Staff',    href: '/dashboard/staff/new',    icon: Users,         color: 'text-orange-700 dark:text-orange-300', bg: 'bg-orange-50 dark:bg-orange-950/40 border-orange-100 dark:border-orange-900/50' }] : []),
        ...(rbac.isTeacher         ? [{ label: 'Scan QR',      href: '/dashboard/pickup/scan',  icon: QrCode,        color: 'text-teal-700 dark:text-teal-300',     bg: 'bg-teal-50 dark:bg-teal-950/40 border-teal-100 dark:border-teal-900/50' }] : []),
        ...(rbac.isAdmin           ? [{ label: 'Reports',      href: '/dashboard/reports',      icon: BarChart2,     color: 'text-indigo-700 dark:text-indigo-300', bg: 'bg-indigo-50 dark:bg-indigo-950/40 border-indigo-100 dark:border-indigo-900/50' }] : []),
        ...(rbac.canAccessHRSelfService ? [{ label: 'My Attendance', href: '/dashboard/my-attendance', icon: Clock, color: 'text-amber-700 dark:text-amber-300', bg: 'bg-amber-50 dark:bg-amber-950/40 border-amber-100 dark:border-amber-900/50' }] : []),
    ];

    if (!open) return null;

    return (
        <>
            {/* Backdrop */}
            <div
                className="fixed inset-0 z-60 bg-black/40 backdrop-blur-sm md:hidden"
                onClick={onClose}
                aria-hidden
            />
            {/* Sheet */}
            <div className="fixed bottom-0 left-0 right-0 z-70 md:hidden bg-surface/98 backdrop-blur-xl rounded-t-2xl shadow-2xl border-t border-slate-200/60 dark:border-white/10 pb-[calc(env(safe-area-inset-bottom)+60px)]">
                <div className="flex flex-col px-4 pt-4 pb-2">
                    <div className="flex items-center justify-between mb-2">
                        <h3 className="text-base font-semibold text-ink">Customize Dashboard</h3>
                        <button onClick={onClose} className="p-1.5 rounded-lg text-ink-muted hover:bg-surface-secondary transition-colors" aria-label="Close">
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                    <p className="text-xs text-ink-muted mb-2">Add or remove quick action items on your dashboard page using the +/- icons.</p>
                </div>
                {/* Drag handle */}
                <div className="w-10 h-1 bg-slate-300 dark:bg-white/20 rounded-full mx-auto mb-3" />
                <div className="grid grid-cols-1 gap-2 px-4 pb-4 max-h-[50vh] overflow-y-auto no-scrollbar">
                    {tiles.map(tile => {
                        const Icon = tile.icon;
                        const isPinned = pinned.includes(tile.href);
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
    );
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const router = useRouter();
    const [user, setUser] = useState<any>(null);
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
    const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
    const [isQuickActionsOpen, setIsQuickActionsOpen] = useState(false);

    // ── Auth bootstrap ──────────────────────────────────────────────────────
    useEffect(() => {
        const initAuth = async () => {
            let u = getUser();
            if (!u) { router.replace("/"); return; }
            if (u.mustChangePassword) { router.replace("/change-password"); return; }
            if (u.role === "PARENT") { router.replace("/parent-dashboard"); return; }
            // Always refresh the access token on dashboard load — the backend
            // re-reads the user from the DB, so role changes made by an admin
            // (e.g. promotion to HR_ADMIN) take effect on the next page load
            // instead of only after logout/login (tokens live 7 days).
            try {
                if (await silentRefresh()) u = getUser() ?? u;
            } catch { /* transient network error — keep the current token */ }
            if (!u) { router.replace("/"); return; }
            setUser(u);
        };
        initAuth();
    }, [router]);

    useEffect(() => {
        try {
            const saved = localStorage.getItem("dashboard-sidebar-collapsed");
            if (saved !== null) setSidebarCollapsed(JSON.parse(saved));
        } catch { /* localStorage unavailable — use default */ }
    }, []);

    useEffect(() => {
        const onVisibility = () => {
            if (document.visibilityState === "visible") resetRefreshState();
        };
        document.addEventListener("visibilitychange", onVisibility);
        return () => document.removeEventListener("visibilitychange", onVisibility);
    }, []);

    // Close drawers on route change
    useEffect(() => {
        setIsMobileNavOpen(false);
        setIsQuickActionsOpen(false);
    }, [pathname]);

    const toggleSidebar = () => {
        setSidebarCollapsed(prev => {
            const next = !prev;
            try { localStorage.setItem("dashboard-sidebar-collapsed", JSON.stringify(next)); } catch { /* no-op */ }
            return next;
        });
    };

    if (!user) return (
        <div className="min-h-screen bg-surface flex items-center justify-center">
            <div className="w-8 h-8 border-2 border-brand border-t-transparent rounded-full animate-spin" />
        </div>
    );

    return (
        <div className="theme-bg min-h-screen text-ink">

            <a
                href="#main-content"
                className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-100 focus:px-4 focus:py-2 focus:bg-brand focus:text-white focus:rounded-lg focus:text-sm focus:font-semibold"
            >
                Skip to main content
            </a>

            <TopBar
                user={user}
                sidebarCollapsed={sidebarCollapsed}
                onToggleSidebar={toggleSidebar}
            />

            <div className="flex pt-14">
                <Sidebar
                    collapsed={sidebarCollapsed}
                    isMobileOpen={isMobileNavOpen}
                    onMobileClose={() => setIsMobileNavOpen(false)}
                />

                <main
                    id="main-content"
                    className={[
                        "flex-1 min-w-0 transition-all duration-300",
                        sidebarCollapsed ? "md:ml-16" : "md:ml-64",
                        "pb-[calc(env(safe-area-inset-bottom)+64px)] md:pb-0",
                    ].join(" ")}
                >
                    {children}
                </main>
            </div>

            <BottomTabBar
                onMoreClick={() => setIsMobileNavOpen(v => !v)}
                onPlusClick={() => setIsQuickActionsOpen(v => !v)}
            />

            <QuickActionsSheet
                open={isQuickActionsOpen}
                onClose={() => setIsQuickActionsOpen(false)}
            />
        </div>
    );
}

