"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
    LayoutDashboard,
    Bell,
    Plus,
    Menu,
    QrCode,
    type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface BottomTabBarProps {
    /** Called when the "More" tab is tapped — parent toggles the sidebar drawer */
    onMoreClick: () => void;
    /** Called when the "+" tab is tapped — parent opens Quick Actions sheet */
    onPlusClick: () => void;
}

/**
 * Mobile-only bottom tab bar. Hidden on md+ (tablet and desktop use the rail).
 *
 * Five destinations is the ceiling for a bottom bar, and this is exactly five:
 * Home | Scan QR | + (quick actions) | Alerts | More. The active tab is marked
 * by a lapis bar above the icon — the same marker as the rail and the tabs, so
 * "you are here" looks the same everywhere in the app.
 */
export function BottomTabBar({ onMoreClick, onPlusClick }: BottomTabBarProps) {
    const pathname = usePathname();

    const isActive = (href: string) =>
        href === "/dashboard"
            ? pathname === "/dashboard"
            : pathname.startsWith(href);

    return (
        <nav
            aria-label="Primary"
            className="fixed right-0 bottom-0 left-0 z-50 border-t border-line bg-surface-glass pb-[env(safe-area-inset-bottom)] shadow-[0_-4px_20px_-2px_rgba(16,23,40,0.08)] backdrop-blur-xl md:hidden"
        >
            <div className="relative flex h-15 items-stretch justify-between px-1">
                <Tab href="/dashboard" label="Home" icon={LayoutDashboard} active={isActive("/dashboard")} />
                <Tab
                    href="/dashboard/pickup/scan"
                    label="Scan"
                    icon={QrCode}
                    active={isActive("/dashboard/pickup/scan")}
                />

                {/* Quick actions — the centre focal control */}
                <div className="relative flex w-full flex-col items-center justify-end pb-1.5">
                    <button
                        onClick={onPlusClick}
                        aria-label="Quick actions"
                        className="absolute -top-5 flex size-13 cursor-pointer items-center justify-center rounded-full border-4 border-surface bg-linear-to-br from-brass-400 to-brass-600 shadow-brand transition-transform active:scale-95"
                    >
                        <Plus className="size-6 text-white" aria-hidden />
                    </button>
                    <span className="text-[10px] font-medium text-ink-faint">Actions</span>
                </div>

                <Tab
                    href="/dashboard/notifications"
                    label="Alerts"
                    icon={Bell}
                    active={isActive("/dashboard/notifications")}
                />

                <button
                    onClick={onMoreClick}
                    className="flex w-full cursor-pointer flex-col items-center justify-center gap-0.5 text-ink-muted transition-colors active:text-ink"
                    aria-label="Open navigation menu"
                >
                    <Menu className="size-5" aria-hidden />
                    <span className="text-[10px] font-medium">More</span>
                </button>
            </div>
        </nav>
    );
}

function Tab({
    href,
    label,
    icon: Icon,
    active,
}: {
    href: string;
    label: string;
    icon: LucideIcon;
    active: boolean;
}) {
    return (
        <Link
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
                "relative flex w-full flex-col items-center justify-center gap-0.5 transition-colors",
                active ? "text-brand" : "text-ink-muted active:text-ink",
            )}
        >
            {active && (
                <span aria-hidden className="absolute top-1 h-0.5 w-5 rounded-full bg-brand" />
            )}
            <Icon className="size-5" aria-hidden />
            <span className="text-[10px] font-medium">{label}</span>
        </Link>
    );
}
