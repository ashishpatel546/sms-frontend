"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter, usePathname } from "next/navigation";
import { getUser, isAuthenticated, logout, getToken, getRefreshToken, setToken, setTokens, authFetch, resetRefreshState } from "@/lib/auth";
import { getSchoolSlug } from "@/lib/env";
import { API_BASE_URL } from "@/lib/api";
import NotificationPermissionBanner from "@/components/NotificationPermissionBanner";
import { useSchoolInfo } from "@/lib/useSchoolInfo";
import { ThemeToggle } from "@/components/ui/ThemeToggle";

export default function ParentDashboardLayout({ children }: { children: React.ReactNode }) {
    const router = useRouter();
    const pathname = usePathname();
    const [user, setUser] = useState<any>(null);
    const [menuOpen, setMenuOpen] = useState(false);
    const schoolInfo = useSchoolInfo();
    // Prefer the lightweight S3 URL (same one the SplashScreen renders
    // successfully). `logoDataUrl` exists for PDF generation only — it can be
    // several MB and is slow/unreliable for an inline <img>.
    const logoSrc = schoolInfo?.logoUrl || schoolInfo?.logoDataUrl || null;

    useEffect(() => {
        const u = getUser();
        if (!u) { router.replace("/"); return; }
        if (u.mustChangePassword) { router.replace("/change-password"); return; }
        if (u.role !== "PARENT") { router.replace("/dashboard"); return; }
        setUser(u);

        // Proactively refresh the access token so the navbar always reflects
        // the latest name from the DB (e.g. after admin updates father's name).
        const rt = getRefreshToken();
        if (rt) {
            const slug = getSchoolSlug();
            fetch(`${API_BASE_URL}/auth/refresh-token`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(slug ? { 'X-School-Slug': slug } : {}),
                },
                body: JSON.stringify({ refreshToken: rt }),
            })
                .then(res => res.ok ? res.json() : null)
                .then(data => {
                    if (data?.access_token) {
                        setTokens(data.access_token, rt);
                        const updated = getUser();
                        if (updated) setUser(updated);
                    }
                })
                .catch(() => { /* silent — stale name is non-critical */ });
        }
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
        <div className="min-h-screen bg-surface flex items-center justify-center">
            <div className="w-8 h-8 border-2 border-brand border-t-transparent rounded-full animate-spin" />
        </div>
    );

    return (
        <div className="theme-bg min-h-screen text-ink pb-[calc(env(safe-area-inset-bottom)+70px)] md:pb-0">
            {/* Skip to main content — keyboard a11y */}
            <a
                href="#main-content"
                className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-100 focus:px-4 focus:py-2 focus:bg-brand focus:text-white focus:rounded-lg focus:text-sm focus:font-semibold"
            >
                Skip to main content
            </a>
            <NotificationPermissionBanner />
            {/* Top Nav (Glass) */}
            <nav className="bg-white/80 dark:bg-surface/90 backdrop-blur-xl border-b border-white/40 dark:border-white/10 px-4 py-3 sticky top-0 z-50 shadow-soft">
                <div className="max-w-5xl mx-auto flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl bg-linear-to-br from-brand to-brand-light flex items-center justify-center shadow-md overflow-hidden">
                            {logoSrc ? (
                                // Match SplashScreen — next/image with `unoptimized` so the
                                // S3 URL is fetched directly (no Next image optimiser proxy
                                // that may strip cross-origin requests behind a tunnel).
                                <Image
                                    src={logoSrc}
                                    alt={`${schoolInfo?.name || 'School'} logo`}
                                    width={48}
                                    height={48}
                                    unoptimized
                                    className="w-full h-full object-contain bg-white"
                                />
                            ) : (
                                <svg className="w-5 h-5 sm:w-6 sm:h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253" />
                                </svg>
                            )}
                        </div>
                        <span className="text-brand font-bold text-lg tracking-tight">
                            {schoolInfo?.name || 'School'}
                        </span>
                        <span className="hidden sm:block text-ink-muted text-sm border-l border-slate-200 pl-3 ml-1">Parent Portal</span>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-surface-secondary rounded-lg">
                            <div className="w-6 h-6 rounded-full bg-linear-to-br from-brand to-brand-light flex items-center justify-center text-white text-xs font-bold">
                                {user.firstName?.[0]}{user.lastName?.[0]}
                            </div>
                            <span className="text-ink text-sm font-medium">{user.firstName} {user.lastName}</span>
                        </div>
                        
                        {/* Desktop Links */}
                        <div className="hidden md:flex items-center gap-2">
                            <Link
                                href="/parent-dashboard"
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all text-sm ${pathname === '/parent-dashboard' ? 'bg-surface-secondary text-brand font-medium' : 'text-ink-muted hover:text-ink hover:bg-surface-secondary'}`}
                                title="Dashboard"
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                                </svg>
                                <span>Dashboard</span>
                            </Link>
                            
                            <Link
                                href="/parent-dashboard/profile"
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all text-sm ${pathname === '/parent-dashboard/profile' ? 'bg-surface-secondary text-brand font-medium' : 'text-ink-muted hover:text-ink hover:bg-surface-secondary'}`}
                                title="My Profile"
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.121 17.804A13.937 13.937 0 0112 16c2.5 0 4.847.655 6.879 1.804M15 10a3 3 0 11-6 0 3 3 0 016 0zm6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                <span>Profile</span>
                            </Link>
                        </div>

                        {/* Theme Toggle */}
                        <div className="flex items-center gap-1.5 bg-surface-secondary border border-slate-200/80 rounded-xl px-2.5 py-1.5 shadow-sm">
                            <ThemeToggle />
                            <span className="hidden md:inline text-xs font-medium text-ink-muted select-none">Theme</span>
                        </div>

                        {/* Today's Date */}
                        <div className="hidden sm:flex items-center gap-1 px-2.5 py-1.5 bg-surface-secondary/60 rounded-xl text-xs font-medium text-ink-muted select-none" suppressHydrationWarning>
                            <svg className="w-3 h-3 shrink-0 opacity-60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                            <span suppressHydrationWarning>
                                {new Date().toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}
                            </span>
                        </div>
                        
                        <button
                            onClick={() => logout()}
                            className="hidden md:flex items-center gap-1.5 px-3 py-1.5 text-ink-muted hover:text-accent-danger hover:bg-red-50 rounded-lg transition-all text-sm"
                            title="Logout"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                            </svg>
                        </button>
                    </div>
                </div>
            </nav>

            {/* Main Content */}
            <main id="main-content" className="max-w-5xl mx-auto w-full">
                {children}
            </main>

            {/* Mobile Bottom Tab Bar */}
            <nav aria-label="Main navigation" className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white/90 dark:bg-surface/95 backdrop-blur-xl border-t border-white/40 dark:border-white/10 shadow-[0_-4px_20px_-2px_rgba(0,0,0,0.05)] pb-[env(safe-area-inset-bottom)]">
                <div className="flex items-center justify-around h-[60px]">
                    <Link
                        href="/parent-dashboard"
                        aria-current={pathname === '/parent-dashboard' || pathname.includes('/student/') ? 'page' : undefined}
                        className={`flex flex-col items-center justify-center w-full h-full gap-1 ${pathname === '/parent-dashboard' || pathname.includes('/student/') ? 'text-brand' : 'text-ink-muted'}`}
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                        </svg>
                        <span className="text-[10px] font-medium">Home</span>
                    </Link>
                    
                    <Link
                        href="/parent-dashboard/notifications"
                        aria-current={pathname === '/parent-dashboard/notifications' ? 'page' : undefined}
                        className={`flex flex-col items-center justify-center w-full h-full gap-1 ${pathname === '/parent-dashboard/notifications' ? 'text-brand' : 'text-ink-muted'}`}
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                        </svg>
                        <span className="text-[10px] font-medium">Alerts</span>
                    </Link>

                    <Link
                        href="/parent-dashboard/profile"
                        aria-current={pathname === '/parent-dashboard/profile' ? 'page' : undefined}
                        className={`flex flex-col items-center justify-center w-full h-full gap-1 ${pathname === '/parent-dashboard/profile' ? 'text-brand' : 'text-ink-muted'}`}
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                        <span className="text-[10px] font-medium">Profile</span>
                    </Link>
                </div>
            </nav>
        </div>
    );
}
