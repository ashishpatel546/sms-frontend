"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { PanelLeftClose, PanelLeftOpen, Menu } from "lucide-react";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { NotificationBell } from "@/components/NotificationBell";
import { NAV_CONFIG } from "@/lib/navConfig";

interface TopBarProps {
    user: any;
    /** Collapsed state of the sidebar — controls the toggle icon direction */
    sidebarCollapsed: boolean;
    /** Called when the sidebar toggle button is clicked (tablet/desktop only) */
    onToggleSidebar: () => void;
    /** Called when the mobile menu button is tapped */
    onOpenMobileNav?: () => void;
}

/**
 * Resolve the current route to "Group / Page" using NAV_CONFIG, so the
 * breadcrumb can never drift from the navigation. Deeper routes
 * (/dashboard/students/42/edit) resolve to their nearest nav ancestor rather
 * than inventing a label from the URL.
 */
function useCrumb(pathname: string): { group?: string; page: string } {
    // Flatten and try the longest href first, ACROSS groups — otherwise
    // /dashboard (the overview item) prefix-matches every route in the app and
    // every page would call itself "Dashboard".
    const all = NAV_CONFIG.flatMap(group =>
        group.items.map(item => ({ ...item, group: group.label })),
    ).sort((a, b) => b.href.length - a.href.length);

    for (const item of all) {
        // "/dashboard" only ever matches itself; everything else may match a
        // deeper route (/dashboard/students/42/edit → Students).
        const matches =
            item.href === "/dashboard"
                ? pathname === "/dashboard"
                : pathname === item.href || pathname.startsWith(`${item.href}/`);
        if (matches) return { group: item.group, page: item.label };
    }
    return { page: "Dashboard" };
}

/**
 * The glass bar over the canvas. It spans only the content area — the ink rail
 * carries its own masthead — so the dark and light halves of the design meet
 * on a single vertical seam instead of overlapping.
 *
 * – Mobile  (<md): menu button + page name | theme + bell
 * – Tablet+ (≥md): rail collapse toggle + breadcrumb | theme + bell + user pill
 */
export function TopBar({ user, sidebarCollapsed, onToggleSidebar, onOpenMobileNav }: TopBarProps) {
    const pathname = usePathname();
    const { group, page } = useCrumb(pathname);

    return (
        <header
            className={[
                "fixed top-0 right-0 z-30 h-14",
                "border-b border-line bg-surface-glass backdrop-blur-xl",
                // Sits beside the rail on tablet+, full width on mobile
                "left-0",
                sidebarCollapsed ? "md:left-16" : "md:left-64",
                "transition-[left] duration-300 ease-out",
                "px-3 sm:px-4",
                "pt-[env(safe-area-inset-top)]",
            ].join(" ")}
        >
            <div className="flex h-full w-full items-center gap-2 sm:gap-3">

                {/* ── Left: rail control + where you are ── */}
                <button
                    onClick={onToggleSidebar}
                    className="hidden size-8 shrink-0 cursor-pointer items-center justify-center rounded-md text-ink-muted transition-colors hover:bg-surface-secondary hover:text-ink md:flex"
                    aria-label={sidebarCollapsed ? "Expand navigation" : "Collapse navigation"}
                >
                    {sidebarCollapsed
                        ? <PanelLeftOpen className="size-4" />
                        : <PanelLeftClose className="size-4" />
                    }
                </button>

                <button
                    onClick={onOpenMobileNav}
                    className="flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-md text-ink-muted transition-colors hover:bg-surface-secondary hover:text-ink md:hidden"
                    aria-label="Open navigation menu"
                >
                    <Menu className="size-5" />
                </button>

                <nav aria-label="Breadcrumb" className="min-w-0">
                    <ol className="flex items-center gap-1.5 text-[12.5px]">
                        <li className="hidden sm:block">
                            <Link href="/dashboard" className="text-ink-faint transition-colors hover:text-brand">
                                Home
                            </Link>
                        </li>
                        {group && (
                            <>
                                <li aria-hidden className="hidden text-ink-faint sm:block">/</li>
                                <li className="hidden truncate text-ink-muted sm:block">{group}</li>
                            </>
                        )}
                        <li aria-hidden className="hidden text-ink-faint sm:block">/</li>
                        <li className="truncate font-semibold text-ink" aria-current="page">{page}</li>
                    </ol>
                </nav>

                {/* ── Right: theme, alerts, identity ── */}
                <div className="ml-auto flex shrink-0 items-center gap-1.5 sm:gap-2">
                    <ThemeToggle />
                    <NotificationBell variant="light" />

                    {/* Identity pill — large screens only; the rail carries it elsewhere */}
                    <div className="hidden items-center gap-2 rounded-lg border border-line bg-surface py-1 pr-3 pl-1 lg:flex">
                        <span className="grid size-7 place-items-center rounded-md bg-linear-to-br from-lapis-500 to-marigold-400 font-display text-[11px] font-bold text-white select-none">
                            {user?.firstName?.[0]}{user?.lastName?.[0]}
                        </span>
                        <span className="min-w-0">
                            <span className="block max-w-36 truncate text-[12.5px] leading-tight font-semibold text-ink">
                                {user?.firstName} {user?.lastName}
                            </span>
                            <span className="block max-w-36 truncate font-mono text-[9px] leading-tight tracking-[0.1em] text-ink-faint uppercase">
                                {user?.role?.replace(/_/g, " ")}
                            </span>
                        </span>
                    </div>
                </div>
            </div>
        </header>
    );
}
