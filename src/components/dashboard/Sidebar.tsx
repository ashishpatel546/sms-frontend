"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { ChevronDown, ChevronRight, Lock, LogOut, User, X } from "lucide-react";
import { NAV_CONFIG, isNavItemUnlocked } from "@/lib/navConfig";
import { useRbac } from "@/lib/rbac";
import { useSchoolFeatures } from "@/lib/useSchoolFeatures";
import { useSchoolInfo } from "@/lib/useSchoolInfo";
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
 * THE WALNUT RAIL — navigation for the admin/staff dashboard.
 *
 * The rail is the warm half of the design and the only place it appears in the
 * staff app: walnut ground with a brass bloom in the top corner so it reads as
 * lit rather than painted. It is chrome you stop seeing, which is exactly the
 * job — the cool paper canvas beside it is where the work happens.
 *
 * The active item is marked by a marigold bar in the margin — the same marker
 * language as the register's margin rule on a table row.
 *
 * Responsive behaviour:
 * – Mobile  (<md, <768px):  hidden behind left edge; slides in as a full drawer
 *                           when `isMobileOpen` is true.
 * – Tablet  (md–lg):        always visible, icon-only (64 px) to save screen space.
 * – Desktop (≥lg, ≥1024px): always visible, full width (256 px) by default.
 *
 * Multi-tenant: nav items are filtered by RBAC so each school staff member only
 * sees the sections their role unlocks.  No school-specific hardcoding here.
 */
export function Sidebar({ collapsed, isMobileOpen, onMobileClose }: SidebarProps) {
    const pathname = usePathname();
    const rbac = useRbac();
    const { features, status: featureStatus } = useSchoolFeatures();
    const school = useSchoolInfo();
    // Prefer the S3 URL for fast loading; the data-url is only for PDF generation.
    const logoSrc = school?.logoUrl || school?.logoDataUrl || null;
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

    return (
        <>
            {/* ── Mobile backdrop ──────────────────────────────────────── */}
            {isMobileOpen && (
                <div
                    className="fixed inset-0 z-30 bg-walnut-950/60 backdrop-blur-sm md:hidden"
                    onClick={onMobileClose}
                    aria-hidden="true"
                />
            )}

            {/* ── The rail ─────────────────────────────────────────────── */}
            <aside
                aria-label="Sidebar navigation"
                className={[
                    'fixed top-0 left-0 z-40 flex h-dvh flex-col',
                    // Ink ground with the lapis bloom — see .rail-surface in globals.css
                    'rail-surface border-r border-rail-line',
                    collapsed ? 'w-16' : 'w-64',
                    'transition-[width,transform] duration-300 ease-out',
                    // Mobile: off-canvas until the drawer opens
                    isMobileOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full',
                    'md:translate-x-0 md:shadow-none',
                    // On mobile, clear the BottomTabBar so the profile block is
                    // never hidden behind it.
                    'pt-[env(safe-area-inset-top)]',
                    'pb-[calc(env(safe-area-inset-bottom)+60px)] md:pb-0',
                ].join(' ')}
            >
                {/* ── Brand block — the rail owns its own masthead, so the light
                     topbar spans only the canvas beside it. ───────────────── */}
                <div className={[
                    'flex h-14 shrink-0 items-center border-b border-rail-line',
                    collapsed ? 'justify-center px-0' : 'gap-2.5 px-3',
                ].join(' ')}>
                    <Link
                        href="/dashboard"
                        onClick={onMobileClose}
                        className="flex min-w-0 items-center gap-2.5 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-brand-light"
                        title={school?.name || 'Dashboard'}
                    >
                        <span className="grid size-8 shrink-0 place-items-center overflow-hidden rounded-lg bg-linear-to-br from-brass-500 to-marigold-400 font-display text-[15px] font-bold text-white">
                            {logoSrc ? (
                                <Image
                                    src={logoSrc}
                                    alt=""
                                    width={32}
                                    height={32}
                                    unoptimized
                                    // Always above the fold (rail header) and can be
                                    // the LCP on sparse pages — load it eagerly.
                                    priority
                                    className="size-full bg-white object-contain"
                                />
                            ) : (
                                (school?.name?.[0] ?? 'S').toUpperCase()
                            )}
                        </span>
                        {!collapsed && (
                            <span className="min-w-0">
                                <span className="block truncate font-display text-[14px] leading-tight font-semibold text-rail-ink">
                                    {school?.name || 'School'}
                                </span>
                                <span className="block truncate font-mono text-[9px] tracking-[0.12em] text-rail-ink-muted uppercase">
                                    Management portal
                                </span>
                            </span>
                        )}
                    </Link>

                    {/* Mobile close button */}
                    <button
                        onClick={onMobileClose}
                        className="ml-auto cursor-pointer rounded-md p-1.5 text-rail-ink-muted transition-colors hover:bg-white/8 hover:text-rail-ink md:hidden"
                        aria-label="Close menu"
                    >
                        <X className="size-4" />
                    </button>
                </div>

                {/* ── Scrollable nav area ────────────────────────────── */}
                <nav className="no-scrollbar flex-1 overflow-y-auto px-2 py-2" aria-label="Main navigation">
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
                            && !isNavItemUnlocked(item.featureFlag, features);

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
                                                className={[
                                                    'group relative flex items-center gap-2.5 rounded-md text-[13.5px] font-medium',
                                                    'outline-none transition-colors duration-150',
                                                    'focus-visible:ring-2 focus-visible:ring-brand-light',
                                                    collapsed ? 'mx-1 justify-center px-0 py-2' : 'px-2.5 py-2',
                                                    active
                                                        ? 'bg-linear-to-r from-brass-400/34 to-brass-400/8 text-white'
                                                        : 'text-rail-ink-soft hover:bg-white/6 hover:text-white',
                                                ].join(' ')}
                                            >
                                                {/* Marigold marker in the margin — "you are here" */}
                                                {active && (
                                                    <span
                                                        aria-hidden
                                                        className={[
                                                            'absolute top-1/2 h-5 w-0.75 -translate-y-1/2 rounded-r-sm bg-accent',
                                                            collapsed ? '-left-1' : '-left-2',
                                                        ].join(' ')}
                                                    />
                                                )}
                                                <Icon
                                                    aria-hidden="true"
                                                    className={[
                                                        'shrink-0 transition-opacity',
                                                        collapsed ? 'size-5' : 'size-4',
                                                        locked ? 'opacity-30' : active ? 'opacity-100' : 'opacity-65 group-hover:opacity-100',
                                                    ].join(' ')}
                                                />
                                                {!collapsed && (
                                                    <>
                                                        <span className={['truncate', locked && 'opacity-50'].filter(Boolean).join(' ')}>
                                                            {item.label}
                                                        </span>
                                                        {locked && (
                                                            <Lock aria-label="Not in your plan" className="ml-auto size-3 shrink-0 opacity-50" />
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
                                <div key={gi} className={gi > 0 ? 'mt-1 border-t border-rail-line pt-2' : ''}>
                                    {renderItems(visibleItems)}
                                </div>
                            );
                        }

                        // ── Labeled group — accordion in expanded mode, flat icons when sidebar is icon-only ──
                        const isOpen = !!expandedGroups[group.label];

                        return (
                            <div key={gi} className="mt-1 border-t border-rail-line pt-2">
                                {/* Group header button — only shown in expanded sidebar */}
                                {!collapsed && (
                                    <button
                                        onClick={() => toggleGroup(group.label!)}
                                        className="group flex w-full cursor-pointer items-center justify-between rounded-md px-2.5 pt-1 pb-1.5 transition-colors hover:bg-white/5"
                                        aria-expanded={isOpen}
                                    >
                                        {/* Same brightness as the nav items below it. Small
                                            mono uppercase with wide tracking reads lighter
                                            than 13.5px body text at the identical colour, so
                                            matching the token still leaves the header
                                            subordinate — the size and tracking carry the
                                            hierarchy, not a dimmer ink. */}
                                        <span className="font-mono text-[10.5px] font-semibold tracking-[0.11em] text-rail-ink-soft uppercase transition-colors select-none group-hover:text-rail-ink">
                                            {group.label}
                                        </span>
                                        {isOpen
                                            ? <ChevronDown className="size-3 text-rail-ink-soft" />
                                            : <ChevronRight className="size-3 text-rail-ink-soft" />
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
                <div className="border-t border-rail-line p-2">
                    {!collapsed ? (
                        <div>
                            {/* User info row */}
                            <div className="flex items-center gap-2.5 px-2 py-2">
                                <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-linear-to-br from-brass-500 to-marigold-400 font-display text-[11.5px] font-bold text-white select-none">
                                    {user?.firstName?.[0]}{user?.lastName?.[0]}
                                </div>
                                <div className="min-w-0 flex-1">
                                    <p className="truncate text-[13px] leading-tight font-semibold text-rail-ink">
                                        {user?.firstName} {user?.lastName}
                                    </p>
                                    <p className="truncate font-mono text-[9.5px] leading-tight tracking-widest text-rail-ink-muted uppercase">
                                        {user?.role?.replace(/_/g, ' ')}
                                    </p>
                                </div>
                            </div>

                            {/* Action buttons — always visible, one tap each */}
                            <div className="flex items-center gap-1 pb-1">
                                <Link
                                    href="/dashboard/profile"
                                    onClick={onMobileClose}
                                    title="My profile"
                                    className="flex flex-1 items-center justify-center gap-1.5 rounded-md py-2 text-[12px] font-medium text-rail-ink-soft transition-colors hover:bg-white/8 hover:text-rail-ink"
                                >
                                    <User className="size-3.5" aria-hidden />
                                    Profile
                                </Link>
                                <button
                                    onClick={() => logout()}
                                    title="Sign out"
                                    className="flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-md py-2 text-[12px] font-medium text-vermilion-300 transition-colors hover:bg-vermilion-500/16 hover:text-vermilion-200"
                                >
                                    <LogOut className="size-3.5" aria-hidden />
                                    Sign out
                                </button>
                            </div>
                        </div>
                    ) : (
                        /* Collapsed state — avatar + logout stacked */
                        <div className="flex flex-col items-center gap-1.5 py-1">
                            <Link
                                href="/dashboard/profile"
                                title={`${user?.firstName} ${user?.lastName} — my profile`}
                                className="flex size-8 items-center justify-center rounded-lg bg-linear-to-br from-brass-500 to-marigold-400 font-display text-[11.5px] font-bold text-white transition-all select-none hover:ring-2 hover:ring-brand-light/50"
                            >
                                {user?.firstName?.[0]}{user?.lastName?.[0]}
                            </Link>
                            <button
                                onClick={() => logout()}
                                title="Sign out"
                                className="cursor-pointer rounded-md p-1.5 text-rail-ink-muted transition-colors hover:bg-vermilion-500/16 hover:text-vermilion-300"
                                aria-label="Sign out"
                            >
                                <LogOut className="size-3.5" />
                            </button>
                        </div>
                    )}
                </div>
            </aside>
        </>
    );
}
