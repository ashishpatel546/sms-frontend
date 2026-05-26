"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut, User, X } from "lucide-react";
import { NAV_CONFIG } from "@/lib/navConfig";
import { useRbac } from "@/lib/rbac";
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
    const user = getUser();

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
                    className="md:hidden absolute top-[60px] right-2 p-1.5 rounded-lg text-ink-muted hover:text-ink hover:bg-surface-secondary transition-colors"
                    aria-label="Close menu"
                >
                    <X className="w-4 h-4" />
                </button>

                {/* ── Scrollable nav area ────────────────────────────── */}
                <nav className="flex-1 overflow-y-auto py-2 px-2 no-scrollbar" aria-label="Main navigation">
                    {NAV_CONFIG.map((group, gi) => {
                        // Filter nav items by RBAC — every school tenant has different
                        // role assignments, so this must be dynamic.
                        const visibleItems = group.items.filter(item =>
                            !item.rbacKey || Boolean((rbac as any)[item.rbacKey])
                        );
                        if (!visibleItems.length) return null;

                        return (
                            <div
                                key={gi}
                                className={gi > 0 ? 'mt-1 pt-2 border-t border-slate-200/60 dark:border-white/8' : ''}
                            >
                                {/* Section header — only in expanded mode */}
                                {group.label && !collapsed && (
                                    <p className="px-3 pt-1 pb-1.5 text-[10px] font-semibold text-ink-muted uppercase tracking-wider select-none">
                                        {group.label}
                                    </p>
                                )}

                                <ul className="space-y-0.5" role="list">
                                    {visibleItems.map(item => {
                                        const active = isActive(item.href);
                                        const Icon = item.icon;
                                        return (
                                            <li key={item.id}>
                                                <Link
                                                    href={item.href}
                                                    onClick={onMobileClose}
                                                    aria-current={active ? 'page' : undefined}
                                                    // Show tooltip when collapsed (replaces label)
                                                    title={collapsed ? item.label : undefined}
                                                    className={navLinkClass(active, collapsed)}
                                                >
                                                    {/* Active left-rail — tinted with the item's own icon colour */}
                                                    {active && !collapsed && (
                                                        <span
                                                            aria-hidden
                                                            className={`absolute left-0 top-1.5 bottom-1.5 w-0.5 rounded-full ${item.iconColor.replace('text-', 'bg-')}`}
                                                        />
                                                    )}
                                                    {/* Icon — solid colour pill in collapsed mode, plain in expanded */}
                                                    {collapsed ? (
                                                        <div className={`flex items-center justify-center w-9 h-9 rounded-xl transition-colors ${
                                                            active
                                                                ? 'bg-brand/10 dark:bg-brand/15'
                                                                : 'group-hover:bg-slate-100/80 dark:group-hover:bg-surface-secondary'
                                                        }`}>
                                                            <Icon aria-hidden="true" className={`w-5 h-5 transition-opacity ${
                                                                active ? item.iconColor : `${item.iconColor} opacity-55 group-hover:opacity-90`
                                                            }`} />
                                                        </div>
                                                    ) : (
                                                        <Icon aria-hidden="true" className={`shrink-0 w-4 h-4 transition-opacity ${
                                                            active ? item.iconColor : `${item.iconColor} opacity-55 group-hover:opacity-90`
                                                        }`} />
                                                    )}
                                                    {/* Label */}
                                                    {!collapsed && (
                                                        <span className={`truncate transition-colors ${
                                                            active ? 'text-brand font-semibold' : 'text-ink-muted group-hover:text-ink'
                                                        }`}>
                                                            {item.label}
                                                        </span>
                                                    )}
                                                </Link>
                                            </li>
                                        );
                                    })}
                                </ul>
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
