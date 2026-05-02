"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { getUser, isAuthenticated, logout, getToken, setToken, setTokens, authFetch, resetRefreshState } from "@/lib/auth";
import { API_BASE_URL } from "@/lib/api";
import { NotificationBell } from "@/components/NotificationBell";
import NotificationPermissionBanner from "@/components/NotificationPermissionBanner";
import { useSchoolInfo } from "@/lib/useSchoolInfo";

export default function ParentDashboardLayout({ children }: { children: React.ReactNode }) {
    const router = useRouter();
    const pathname = usePathname();
    const [user, setUser] = useState<any>(null);
    const [menuOpen, setMenuOpen] = useState(false);
    const schoolInfo = useSchoolInfo();

    useEffect(() => {
        const u = getUser();
        if (!u) { router.replace("/"); return; }
        if (u.mustChangePassword) { router.replace("/change-password"); return; }
        if (u.role !== "PARENT") { router.replace("/dashboard"); return; }
        setUser(u);
    }, [router]);

    // When the Android PWA returns from background, any in-flight token refresh
    // may have been aborted by the OS. Reset the refresh state so the next API
    // call can attempt a fresh refresh rather than hanging indefinitely.
    useEffect(() => {
        const handleVisibility = () => {
            if (document.visibilityState === 'visible') resetRefreshState();
        };
        document.addEventListener('visibilitychange', handleVisibility);
        return () => document.removeEventListener('visibilitychange', handleVisibility);
    }, []);


    if (!user) return (
        <div className="min-h-screen bg-slate-950 flex items-center justify-center">
            <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
        </div>
    );

    return (
        <div className="min-h-screen bg-linear-to-br from-slate-950 via-slate-900 to-indigo-950">
            <NotificationPermissionBanner />
            {/* Top Nav */}
            <nav className="bg-slate-900/80 backdrop-blur-md border-b border-slate-800 px-4 py-3 sticky top-0 z-50">
                <div className="max-w-5xl mx-auto flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-linear-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
                            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                            </svg>
                        </div>
                        <span className="text-white font-bold text-lg tracking-tight">
                            {schoolInfo?.name || 'School'}
                        </span>
                        <span className="hidden sm:block text-slate-500 text-sm border-l border-slate-700 pl-3 ml-1">Parent Portal</span>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-slate-800 rounded-lg">
                            <div className="w-6 h-6 rounded-full bg-linear-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-xs font-bold">
                                {user.firstName?.[0]}{user.lastName?.[0]}
                            </div>
                            <span className="text-slate-300 text-sm font-medium">{user.firstName} {user.lastName}</span>
                        </div>
                        <Link
                            href="/parent-dashboard"
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all text-sm ${pathname === '/parent-dashboard' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}
                            title="Dashboard"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                            </svg>
                            <span className="hidden sm:block">Dashboard</span>
                        </Link>
                        {/* Notification Bell */}
                        <NotificationBell variant="dark" />
                        <Link
                            href="/parent-dashboard/profile"
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all text-sm ${pathname === '/parent-dashboard/profile' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}
                            title="My Profile"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.121 17.804A13.937 13.937 0 0112 16c2.5 0 4.847.655 6.879 1.804M15 10a3 3 0 11-6 0 3 3 0 016 0zm6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <span className="hidden sm:block">Profile</span>
                        </Link>
                        <button
                            onClick={() => logout()}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-all text-sm"
                            title="Logout"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                            </svg>
                            <span className="hidden sm:block">Logout</span>
                        </button>
                    </div>
                </div>
            </nav>

            {/* Main Content */}
            <main className="max-w-5xl mx-auto px-4 py-6">
                {children}
            </main>
        </div>
    );
}
