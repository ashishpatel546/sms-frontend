"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
    LayoutDashboard,
    Bell,
    Plus,
    Menu,
    QrCode,
} from "lucide-react";

interface BottomTabBarProps {
    /** Called when the "More" tab is tapped — parent toggles the sidebar drawer */
    onMoreClick: () => void;
    /** Called when the "+" tab is tapped — parent opens Quick Actions sheet */
    onPlusClick: () => void;
}

/**
 * Mobile-only bottom tab bar for the admin/staff dashboard.
 * Hidden on md+ (tablet & desktop use the sidebar instead).
 *
 * 5 tabs: Home | Scan QR | + (Quick Actions) | Alerts | More
 * – "+" opens a Quick Actions bottom sheet.
 * – "More" opens the sidebar drawer which contains all nav + Profile + Sign out.
 */
export function BottomTabBar({ onMoreClick, onPlusClick }: BottomTabBarProps) {
    const pathname = usePathname();

    const isActive = (href: string) =>
        href === "/dashboard"
            ? pathname === "/dashboard"
            : pathname.startsWith(href);

    const tabs = [
        { label: "Home",   href: "/dashboard",              icon: LayoutDashboard },
        { label: "Alerts", href: "/dashboard/notifications", icon: Bell            },
    ] as const;

    return (
        <nav
            aria-label="Main navigation"
            className="fixed bottom-0 left-0 right-0 z-50 bg-white/92 dark:bg-surface/95 backdrop-blur-xl border-t border-slate-200/60 dark:border-white/10 shadow-[0_-4px_20px_-2px_rgba(0,0,0,0.06)] pb-[env(safe-area-inset-bottom)] md:hidden"
        >
            <div className="flex items-center justify-between px-2 h-[60px] relative">
                {/* 1. Home */}
                <Link
                    href="/dashboard"
                    aria-current={isActive("/dashboard") ? "page" : undefined}
                    className={`relative flex flex-col items-center justify-center w-full h-full gap-0.5 transition-colors ${
                        isActive("/dashboard") ? "text-violet-500" : "text-ink-muted"
                    }`}
                >
                    {isActive("/dashboard") && (
                        <span className="absolute top-1 w-5 h-0.5 rounded-full bg-violet-500" />
                    )}
                    <LayoutDashboard className="w-5 h-5" aria-hidden />
                    <span className="text-[10px] font-medium">Home</span>
                </Link>

                {/* 2. Scan QR */}
                <Link
                    href="/dashboard/pickup/scan"
                    aria-current={isActive("/dashboard/pickup/scan") ? "page" : undefined}
                    className={`relative flex flex-col items-center justify-center w-full h-full gap-0.5 transition-colors ${
                        isActive("/dashboard/pickup/scan") ? "text-teal-500" : "text-ink-muted"
                    }`}
                >
                    {isActive("/dashboard/pickup/scan") && (
                        <span className="absolute top-1 w-5 h-0.5 rounded-full bg-teal-500" />
                    )}
                    <QrCode className="w-5 h-5" aria-hidden />
                    <span className="text-[10px] font-medium">Scan QR</span>
                </Link>

                {/* 3. Quick Actions "+" — centre focal button */}
                <div className="flex flex-col items-center justify-center w-full h-full relative">
                    <button
                        onClick={onPlusClick}
                        aria-label="Quick actions"
                        className="absolute -top-6 flex items-center justify-center w-14 h-14 rounded-full bg-linear-to-br from-brand to-brand-light shadow-lg shadow-brand/30 border-4 border-white dark:border-surface hover:scale-105 active:scale-95 transition-transform"
                    >
                        <Plus className="w-6 h-6 text-white" aria-hidden />
                    </button>
                    <span className="text-[10px] font-medium mt-auto mb-1 text-ink-muted">Actions</span>
                </div>

                {/* 4. Alerts */}
                <Link
                    href="/dashboard/notifications"
                    aria-current={isActive("/dashboard/notifications") ? "page" : undefined}
                    className={`relative flex flex-col items-center justify-center w-full h-full gap-0.5 transition-colors ${
                        isActive("/dashboard/notifications") ? "text-sky-500" : "text-ink-muted"
                    }`}
                >
                    {isActive("/dashboard/notifications") && (
                        <span className="absolute top-1 w-5 h-0.5 rounded-full bg-sky-500" />
                    )}
                    <Bell className="w-5 h-5" aria-hidden />
                    <span className="text-[10px] font-medium">Alerts</span>
                </Link>

                {/* 5. More — opens the sidebar drawer */}
                <button
                    onClick={onMoreClick}
                    className="flex flex-col items-center justify-center w-full h-full gap-0.5 text-ink-muted"
                    aria-label="Open navigation menu"
                >
                    <Menu className="w-5 h-5" aria-hidden />
                    <span className="text-[10px] font-medium">More</span>
                </button>
            </div>
        </nav>
    );
}

