"use client";

import Image from "next/image";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { NotificationBell } from "@/components/NotificationBell";
import { useSchoolInfo } from "@/lib/useSchoolInfo";

interface TopBarProps {
    user: any;
    /** Collapsed state of the sidebar — controls the toggle icon direction */
    sidebarCollapsed: boolean;
    /** Called when the sidebar toggle button is clicked (tablet/desktop only) */
    onToggleSidebar: () => void;
}

/**
 * Fixed glass top bar for the admin/staff dashboard.
 * – Mobile  (<md): school logo + name | ThemeToggle + NotificationBell
 * – Tablet (md-lg): sidebar toggle added on the left
 * – Desktop (≥lg):  user pill shown on the right
 *
 * School branding is always pulled from useSchoolInfo() (multi-tenant safe).
 */
export function TopBar({ user, sidebarCollapsed, onToggleSidebar }: TopBarProps) {
    const schoolInfo = useSchoolInfo();
    // Prefer the S3 URL for fast loading; data-url is used only for PDF generation.
    const logoSrc = schoolInfo?.logoUrl || schoolInfo?.logoDataUrl || null;

    return (
        <nav className="h-14 bg-white/80 dark:bg-surface/90 backdrop-blur-xl border-b border-slate-200/60 dark:border-white/10 px-3 sm:px-4 fixed left-0 right-0 top-0 z-50 shadow-sm">
            <div className="flex items-center justify-between h-full w-full gap-2 sm:gap-3">

                {/* ── Left: toggle + school identity ── */}
                <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">

                    {/* Sidebar collapse toggle — tablet & desktop only */}
                    <button
                        onClick={onToggleSidebar}
                        className="hidden md:flex items-center justify-center w-8 h-8 rounded-lg text-ink-muted hover:text-ink hover:bg-surface-secondary transition-colors shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/50"
                        aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
                    >
                        {sidebarCollapsed
                            ? <ChevronRight className="w-4 h-4" />
                            : <ChevronLeft className="w-4 h-4" />
                        }
                    </button>

                    {/* School logo (rounded square, brand gradient fallback) */}
                    <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-linear-to-br from-brand to-brand-light flex items-center justify-center shadow-sm overflow-hidden shrink-0">
                        {logoSrc ? (
                            <Image
                                src={logoSrc}
                                alt={`${schoolInfo?.name || 'School'} logo`}
                                width={36}
                                height={36}
                                unoptimized
                                className="w-full h-full object-contain bg-white"
                            />
                        ) : (
                            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253" />
                            </svg>
                        )}
                    </div>

                    {/* School name — truncated on narrow screens */}
                    <div className="min-w-0">
                        <p className="text-ink font-bold text-sm sm:text-base leading-tight truncate max-w-[130px] xs:max-w-[180px] sm:max-w-xs lg:max-w-sm">
                            {schoolInfo?.name || 'School'}
                        </p>
                        <p className="hidden sm:block text-ink-muted text-[11px] leading-tight">
                            Management Portal
                        </p>
                    </div>
                </div>

                {/* ── Right: user pill (desktop) + theme + bell ── */}
                <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">

                    {/* User identity pill — large screens only */}
                    <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 bg-surface-secondary rounded-xl">
                        <div className="w-6 h-6 rounded-full bg-linear-to-br from-brand to-brand-light flex items-center justify-center text-white text-xs font-bold select-none">
                            {user?.firstName?.[0]}{user?.lastName?.[0]}
                        </div>
                        <span className="text-ink text-sm font-medium max-w-[140px] truncate">
                            {user?.firstName} {user?.lastName}
                        </span>
                        <span className="text-xs text-ink-muted border-l border-slate-200 dark:border-white/10 pl-2 max-w-[90px] truncate capitalize">
                            {user?.role?.replace(/_/g, ' ').toLowerCase()}
                        </span>
                    </div>

                    {/* Theme toggle */}
                    <div className="flex items-center bg-surface-secondary border border-slate-200/80 dark:border-white/10 rounded-xl px-1.5 py-1 shadow-sm">
                        <ThemeToggle />
                    </div>

                    {/* Notification bell */}
                    <NotificationBell variant="light" />
                </div>
            </div>
        </nav>
    );
}
