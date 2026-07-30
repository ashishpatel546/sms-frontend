"use client";

import { usePathname, useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import Link from "next/link";
import { getUser, resetRefreshState, silentRefresh } from "@/lib/auth";
import { TopBar } from "@/components/dashboard/TopBar";
import { Sidebar } from "@/components/dashboard/Sidebar";
import { BottomTabBar } from "@/components/dashboard/BottomTabBar";
import { useRbac } from "@/lib/rbac";
import { X } from "lucide-react";
import { usePinnedActions } from "@/hooks/usePinnedActions";
import { useQuickActionTiles } from "@/lib/quickActions";
import { QuickActionPicker } from "@/components/dashboard/QuickActionPicker";

/**
 * The "+" bottom-tab sheet: choose which quick actions sit on the dashboard.
 *
 * Both the tile list and the add/remove rows are shared with the desktop
 * dialog in QuickActions.tsx, so the two can no longer drift apart.
 */
function QuickActionsSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
    const { pinned, togglePin } = usePinnedActions();
    const { tilesInPlan } = useQuickActionTiles();

    if (!open) return null;

    return (
        <>
            {/* Backdrop */}
            <div
                className="fixed inset-0 z-60 bg-walnut-950/50 backdrop-blur-sm md:hidden"
                onClick={onClose}
                aria-hidden
            />
            {/* Sheet */}
            <div
                role="dialog"
                aria-modal="true"
                aria-label="Dashboard shortcuts"
                className="fixed right-0 bottom-0 left-0 z-70 rounded-t-2xl border-t border-line bg-surface pb-[calc(env(safe-area-inset-bottom)+60px)] shadow-glass md:hidden"
            >
                {/* Drag handle */}
                <div className="mx-auto mt-2.5 h-1 w-10 rounded-full bg-line-strong" aria-hidden />
                <div className="flex flex-col px-4 pt-3 pb-2">
                    <div className="mb-1 flex items-center justify-between">
                        <h3 className="font-display text-[16px] font-semibold text-ink">Dashboard shortcuts</h3>
                        <button
                            onClick={onClose}
                            className="cursor-pointer rounded-md p-1.5 text-ink-muted transition-colors hover:bg-surface-secondary hover:text-ink"
                            aria-label="Close"
                        >
                            <X className="size-5" />
                        </button>
                    </div>
                    <p className="text-[12.5px] text-ink-muted">
                        Pick the actions you use most. They appear as tiles on your dashboard.
                    </p>
                </div>
                <div className="no-scrollbar max-h-[50vh] overflow-y-auto px-4 pt-2 pb-4">
                    <QuickActionPicker tiles={tilesInPlan} pinned={pinned} onToggle={togglePin} />
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
    const [isWide, setIsWide] = useState(true);
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

    // Below lg the rail is icon-only whatever the saved preference says: a
    // 256px rail on a 768px tablet takes a third of the screen, and these are
    // data-dense pages that need the width. The preference still governs
    // desktop, where there is room for labels.
    useEffect(() => {
        const mq = window.matchMedia("(min-width: 1024px)");
        const apply = () => setIsWide(mq.matches);
        apply();
        mq.addEventListener("change", apply);
        return () => mq.removeEventListener("change", apply);
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

    // What the rail actually renders as. The stored preference only applies on
    // desktop; below lg the rail is always the icon variant.
    const railCollapsed = sidebarCollapsed || !isWide;

    const toggleSidebar = () => {
        setSidebarCollapsed(prev => {
            const next = !prev;
            try { localStorage.setItem("dashboard-sidebar-collapsed", JSON.stringify(next)); } catch { /* no-op */ }
            return next;
        });
    };

    if (!user) return (
        <div className="theme-bg flex min-h-dvh items-center justify-center">
            <div className="size-8 animate-spin rounded-full border-2 border-brand border-t-transparent" />
        </div>
    );

    return (
        <div className="theme-bg min-h-dvh text-ink">

            <a
                href="#main-content"
                className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-100 focus:rounded-md focus:bg-brand focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-brand-contrast"
            >
                Skip to main content
            </a>

            <TopBar
                user={user}
                sidebarCollapsed={railCollapsed}
                onToggleSidebar={toggleSidebar}
                onOpenMobileNav={() => setIsMobileNavOpen(v => !v)}
            />

            <Sidebar
                collapsed={railCollapsed}
                isMobileOpen={isMobileNavOpen}
                onMobileClose={() => setIsMobileNavOpen(false)}
            />

            <main
                id="main-content"
                className={[
                    "min-w-0 pt-[calc(3.5rem+env(safe-area-inset-top))] transition-[margin] duration-300 ease-out",
                    railCollapsed ? "md:ml-16" : "md:ml-64",
                    "pb-[calc(env(safe-area-inset-bottom)+64px)] md:pb-0",
                ].join(" ")}
            >
                {children}
            </main>

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

