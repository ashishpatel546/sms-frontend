"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown, ChevronRight, Lock, LogOut, User, X } from "lucide-react";
import { NAV_CONFIG } from "@/lib/navConfig";
import { useRbac } from "@/lib/rbac";
import { useSchoolFeatures } from "@/lib/useSchoolFeatures";
import { getUser, logout } from "@/lib/auth";

interface SidebarProps {
    /** Whether the sidebar is in icon-only (collapsed) mode */
    collapsed: boolean;
    /** Whether the mobile drawer is open */
    isMobileOpen: boolean;
    /** Called when the user closes the drawer (mobile backdrop tap, X button, nav link) */
    onMobileClose: () => void;
}

/**
 * Sidebar navigation for the admin/staff dashboard.
 *
 * Responsive behaviour:
 * – Mobile  (<md, <768px):  hidden behind left edge; slides in as a full drawer
 *                           when `isMobileOpen` is true.
 * – Tablet  (md–lg):        always visible, icon-only (64 px) to save screen space.
 *                           Collapse state controlled by parent via `collapsed` prop.
 * – Desktop (≥lg, ≥1024px): always visible, full width (256 px) by default.
 *                           User can collapse via the toggle button in TopBar.
 *
 * Multi-tenant: nav items are filtered by RBAC so each school staff member only
 * sees the sections their role unlocks.  No school-specific hardcoding here.
 */
export function Sidebar({ collapsed, isMobileOpen, onMobileClose }: SidebarProps) {
    const pathname = usePathname();
    const rbac = useRbac();
    const { features, status: featureStatus } = useSchoolFeatures();
    const user = getUser();

    // ── Accordion state ─────────────────────────────────────────────────────
    // Keyed by group label; unlabeled group (Dashboard/Notifications) always visible.
    // Default: all collapsed. Persisted to localStorage.
    const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>(() => {
        if (typeof window === 'undefined') return {};
        try {
            const saved = localStorage.getItem('sidebar-expanded-groups');
            return saved ? JSON.parse(saved) : {};
        } catch {
            return {};
        }
    });

    // Auto-expand the group containing the active route on first load
    useEffect(() => {
        const activeGroup = NAV_CONFIG.find(
            (g) => g.label && g.items.some((item) => {
                if (item.href === '/dashboard') return pathname === '/dashboard';
                return pathname === item.href || pathname.startsWith(`${item.href}/`);
            })
        );
        if (activeGroup?.label) {
            setExpandedGroups((prev) => {
                if (prev[activeGroup.label!]) return prev;  // already expanded, no change
                const next = { ...prev, [activeGroup.label!]: true };
                try { localStorage.setItem('sidebar-expanded-groups', JSON.stringify(next)); } catch { /* ignore */ }
                return next;
            });
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const toggleGroup = (label: string) => {
        setExpandedGroups((prev) => {
            // Accordion: close all others, toggle clicked one
            const isOpen = !!prev[label];
            const next: Record<string, boolean> = {};
            if (!isOpen) next[label] = true;  // open only this one
            try { localStorage.setItem('sidebar-expanded-groups', JSON.stringify(next)); } catch { /* ignore */ }
            return next;
        });
    };
    // ────────────────────────────────────────────────────────────────────────

    const isActive = (href: string) => {
        if (href === '/dashboard') return pathname === '/dashboard';
        return pathname === href || pathname.startsWith(`${href}/`);
    };

    const navLinkClass = (active: boolean, isCollapsed: boolean) => [
        'group relative flex items-center gap-3 rounded-xl text-sm font-medium',
        'transition-all duration-150 outline-none',
        'focus-visible:ring-2 focus-visible:ring-brand/50',
        isCollapsed ? 'justify-center px-0 py-2.5 mx-1' : 'px-3 py-2',
        !isCollapsed
            ? active
                ? 'bg-brand/10 dark:bg-brand/15'
                : 'hover:bg-slate-100/80 dark:hover:bg-surface-secondary'
            : '',
    ].join(' ');

    return (
        <>
            {/* ── Mobile backdrop ──────────────────────────────────────── */}
            {isMobileOpen && (
                <div
                    className="fixed inset-0 z-30 bg-black/50 backdrop-blur-sm md:hidden"
                    onClick={onMobileClose}
                    aria-hidden="true"
                />
            )}

            {/* ── Sidebar panel ────────────────────────────────────────── */}
            <aside
                aria-label="Sidebar navigation"
                className={[
                    // Positioning
                    'fixed top-0 left-0 z-40 h-dvh flex flex-col',
                    // Glass surface — adapts to all themes
                    'bg-white/95 dark:bg-surface/98 backdrop-blur-xl',
                    'border-r border-slate-200/80 dark:border-white/10',
                    // Width — collapsed = icon-only (64 px), expanded = 256 px
                    collapsed ? 'w-16' : 'w-64',
                    // Smooth width + slide transitions
                    'transition-all duration-300 ease-out',
                    // Mobile: translated off-screen unless drawer is open
                    isMobileOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full',
                    // Tablet+: always visible (override the translate)
                    'md:translate-x-0 md:shadow-none',
                    // Clear the fixed TopBar (h-14 = 56 px) and on mobile also
                    // clear the fixed BottomTabBar (60px + safe area) so the
                    // profile section is never hidden behind it.
                    'pt-14',
                    'pb-[calc(env(safe-area-inset-bottom)+60px)] md:pb-0',
                ].join(' ')}
            >
                {/* Mobile close button */}
                <button
                    onClick={onMobileClose}
                    className="md:hidden absolute top-15 right-2 p-1.5 rounded-lg text-ink-muted hover:text-ink hover:bg-surface-secondary transition-colors"
                    aria-label="Close menu"
                >
                    <X className="w-4 h-4" />
                </button>

                {/* ── Scrollable nav area ────────────────────────────── */}
                <nav className="flex-1 overflow-y-auto py-2 px-2 no-scrollbar" aria-label="Main navigation">
                    {NAV_CONFIG.map((group, gi) => {
                        const visibleItems = group.items.filter(item => {
                            // GUARD is deny-by-default: only explicitly flagged items appear
                            if (rbac.isGuard) return item.guardAllowed === true;
                            if (item.rbacKey && !(rbac as any)[item.rbacKey]) return false;
                            return true;
                        });
                        if (!visibleItems.length) return null;

                        /**
                         * A module the school's plan does not include.
                         *
                         * Shown rather than hidden: a school that cannot see a
                         * feature cannot ask for it, and a menu that silently
                         * differs per plan makes support conversations start
                         * with "what am I even missing?". The item stays
                         * reachable and the page behind it explains the upgrade.
                         *
                         * Only judged once the plan is actually known — a slow
                         * or failed lookup leaves everything unlocked rather
                         * than padlocking the whole menu.
                         */
                        const isLocked = (item: typeof visibleItems[number]) =>
                            Boolean(item.featureFlag)
                            && featureStatus === 'ready'
                            && features[item.featureFlag!] !== true;

                        // Shared item renderer to avoid duplication
                        const renderItems = (items: typeof visibleItems) => (
                            <ul className="space-y-0.5" role="list">
                                {items.map(item => {
                                    const active = isActive(item.href);
                                    const Icon = item.icon;
                                    const locked = isLocked(item);
                                    return (
                                        <li key={item.id}>
                                            <Link
                                                href={item.href}
                                                onClick={onMobileClose}
                                                aria-current={active ? 'page' : undefined}
                                                title={locked ? `${item.label} — not in your plan` : collapsed ? item.label : undefined}
                                                className={navLinkClass(active, collapsed)}
                                            >
                                                {active && !collapsed && (
                                                    <span aria-hidden className={`absolute left-0 top-1.5 bottom-1.5 w-0.5 rounded-full ${item.iconColor.replace('text-', 'bg-')}`} />
                                                )}
                                                {collapsed ? (
                                                    <div className={`flex items-center justify-center w-9 h-9 rounded-xl transition-colors ${active ? 'bg-brand/10 dark:bg-brand/15' : 'group-hover:bg-slate-100/80 dark:group-hover:bg-surface-secondary'}`}>
                                                        <Icon aria-hidden="true" className={`w-5 h-5 transition-opacity ${locked ? 'text-ink-muted opacity-40' : active ? item.iconColor : `${item.iconColor} opacity-55 group-hover:opacity-90`}`} />
                                                    </div>
                                                ) : (
                                                    <Icon aria-hidden="true" className={`shrink-0 w-4 h-4 transition-opacity ${locked ? 'text-ink-muted opacity-40' : active ? item.iconColor : `${item.iconColor} opacity-55 group-hover:opacity-90`}`} />
                                                )}
                                                {!collapsed && (
                                                    <>
                                                        <span className={`truncate transition-colors ${locked ? 'text-ink-muted/70' : active ? 'text-brand font-semibold' : 'text-ink-muted group-hover:text-ink'}`}>
                                                            {item.label}
                                                        </span>
                                                        {locked && (
                                                            <Lock aria-label="Not in your plan" className="ml-auto shrink-0 w-3 h-3 text-ink-muted/60" />
                                                        )}
                                                    </>
                                                )}
                                            </Link>
                                        </li>
                                    );
                                })}
                            </ul>
                        );

                        // ── Unlabeled group (Dashboard + Notifications) — always visible ──
                        if (!group.label) {
                            return (
                                <div key={gi} className={gi > 0 ? 'mt-1 pt-2 border-t border-slate-200/60 dark:border-white/8' : ''}>
                                    {renderItems(visibleItems)}
                                </div>
                            );
                        }

                        // ── Labeled group — accordion in expanded mode, flat icons when sidebar is icon-only ──
                        const isOpen = !!expandedGroups[group.label];

                        return (
                            <div key={gi} className="mt-1 pt-2 border-t border-slate-200/60 dark:border-white/8">
                                {/* Group header button — only shown in expanded sidebar */}
                                {!collapsed && (
                                    <button
                                        onClick={() => toggleGroup(group.label!)}
                                        className="w-full flex items-center justify-between px-3 pt-1 pb-1.5 rounded-lg hover:bg-slate-100/60 dark:hover:bg-surface-secondary/60 transition-colors group"
                                        aria-expanded={isOpen}
                                    >
                                        <span className="text-[10px] font-semibold text-ink-muted uppercase tracking-wider select-none group-hover:text-ink transition-colors">
                                            {group.label}
                                        </span>
                                        {isOpen
                                            ? <ChevronDown className="w-3 h-3 text-ink-muted" />
                                            : <ChevronRight className="w-3 h-3 text-ink-muted" />
                                        }
                                    </button>
                                )}

                                {/* Items — animated open/close in expanded mode; always visible flat in icon-only mode */}
                                <div className={[
                                    'overflow-hidden transition-all duration-200 ease-out',
                                    collapsed ? 'max-h-[2000px]' : isOpen ? 'max-h-150 opacity-100' : 'max-h-0 opacity-0',
                                ].join(' ')}>
                                    {renderItems(visibleItems)}
                                </div>
                            </div>
                        );
                    })}
                </nav>

                {/* ── Profile section — pinned to bottom ───────────────── */}
                <div className="border-t border-slate-200/80 dark:border-white/10 p-2">
                    {!collapsed ? (
                        <div>
                            {/* User info row */}
                            <div className="flex items-center gap-2.5 px-3 py-2">
                                <div className="w-8 h-8 rounded-full bg-linear-to-br from-brand to-brand-light flex items-center justify-center text-white text-xs font-bold shrink-0 select-none">
                                    {user?.firstName?.[0]}{user?.lastName?.[0]}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-semibold text-ink leading-tight truncate">
                                        {user?.firstName} {user?.lastName}
                                    </p>
                                    <p className="text-[11px] text-ink-muted leading-tight truncate capitalize">
                                        {user?.role?.replace(/_/g, ' ').toLowerCase()}
                                    </p>
                                </div>
                            </div>

                            {/* Action buttons — always visible, one tap each */}
                            <div className="flex items-center gap-1 px-1 pb-1">
                                <Link
                                    href="/dashboard/profile"
                                    onClick={onMobileClose}
                                    title="My Profile"
                                    className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-medium text-ink-muted hover:text-ink hover:bg-slate-100/80 dark:hover:bg-surface-secondary transition-colors"
                                >
                                    <User className="w-3.5 h-3.5" aria-hidden />
                                    Profile
                                </Link>
                                <button
                                    onClick={() => logout()}
                                    title="Sign out"
                                    className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-medium text-accent-danger hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors"
                                >
                                    <LogOut className="w-3.5 h-3.5" aria-hidden />
                                    Sign out
                                </button>
                            </div>
                        </div>
                    ) : (
                        /* Collapsed state — avatar + logout stacked */
                        <div className="flex flex-col items-center gap-1.5 py-1">
                            <Link
                                href="/dashboard/profile"
                                title={`${user?.firstName} ${user?.lastName} — My Profile`}
                                className="w-8 h-8 rounded-full bg-linear-to-br from-brand to-brand-light flex items-center justify-center text-white text-xs font-bold select-none hover:ring-2 hover:ring-brand/40 transition-all"
                            >
                                {user?.firstName?.[0]}{user?.lastName?.[0]}
                            </Link>
                            <button
                                onClick={() => logout()}
                                title="Sign out"
                                className="p-1.5 rounded-lg text-ink-muted hover:text-accent-danger hover:bg-surface-secondary transition-colors"
                                aria-label="Sign out"
                            >
                                <LogOut className="w-3.5 h-3.5" />
                            </button>
                        </div>
                    )}
                </div>
            </aside>
        </>
    );
}
