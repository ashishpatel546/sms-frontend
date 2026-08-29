"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter, usePathname } from "next/navigation";
import { Bell, CalendarDays, House, LifeBuoy, LogOut, ScrollText, UserRound, type LucideIcon } from "lucide-react";
import { getUser, logout, getRefreshToken, setTokens, resetRefreshState } from "@/lib/auth";
import { getSchoolSlug } from "@/lib/env";
import { API_BASE_URL } from "@/lib/api";
import NotificationPermissionBanner from "@/components/NotificationPermissionBanner";
import { useSchoolInfo } from "@/lib/useSchoolInfo";
import { ThemePicker } from "@/components/ui/ThemePicker";
import PullToRefresh from "@/components/ui/PullToRefresh";
import { cn } from "@/lib/utils";

/**
 * THE PARENT PORTAL SHELL
 *
 * The staff app puts its dark half in a navigation rail. A parent has three
 * destinations, so there is no rail to put it in — the top bar becomes the
 * walnut instead. Same two materials, same seam, one less axis of navigation.
 */
export default function ParentDashboardLayout({ children }: { children: React.ReactNode }) {
    const router = useRouter();
    const pathname = usePathname();
    const [user, setUser] = useState<any>(null);
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
        <div className="theme-bg flex min-h-dvh items-center justify-center">
            <div className="size-8 animate-spin rounded-full border-2 border-brand border-t-transparent" />
        </div>
    );

    // "Home" stays current while browsing a child's record — that page is
    // reached from Home and has no tab of its own.
    const isHome = pathname === '/parent-dashboard' || pathname.includes('/student/');

    return (
        <div className="theme-bg min-h-dvh pb-[calc(env(safe-area-inset-bottom)+70px)] text-ink md:pb-0">
            {/* Skip to main content — keyboard a11y */}
            <a
                href="#main-content"
                className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-100 focus:rounded-md focus:bg-brand focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-brand-contrast"
            >
                Skip to main content
            </a>
            <NotificationPermissionBanner />

            {/* ── The walnut bar ─────────────────────────────────────────── */}
            <header className="rail-surface sticky top-0 z-50 border-b border-rail-line px-4 pt-[env(safe-area-inset-top)]">
                <div className="mx-auto flex h-14 max-w-5xl items-center gap-3">
                    <Link href="/parent-dashboard" className="flex min-w-0 items-center gap-2.5">
                        <span className="grid size-9 shrink-0 place-items-center overflow-hidden rounded-lg bg-linear-to-br from-tile-from to-tile-to font-display text-[15px] font-bold text-tile-ink">
                            {logoSrc ? (
                                // next/image with `unoptimized` so the S3 URL is fetched
                                // directly — the optimiser proxy can drop cross-origin
                                // requests behind the tunnel.
                                <Image
                                    src={logoSrc}
                                    alt=""
                                    width={36}
                                    height={36}
                                    unoptimized
                                    // Always above the fold (sticky header) and can be
                                    // the LCP on sparse pages — load it eagerly.
                                    priority
                                    className="size-full bg-white object-contain"
                                />
                            ) : (
                                (schoolInfo?.name?.[0] ?? 'S').toUpperCase()
                            )}
                        </span>
                        <span className="min-w-0">
                            <span className="block truncate font-display text-[15px] leading-tight font-semibold text-rail-ink">
                                {schoolInfo?.name || 'School'}
                            </span>
                            <span className="block font-mono text-[9px] tracking-[0.14em] text-rail-ink-muted uppercase">
                                Parent portal
                            </span>
                        </span>
                    </Link>

                    <div className="ml-auto flex shrink-0 items-center gap-2">
                        {/* Desktop destinations — the bottom bar covers mobile */}
                        <nav className="hidden items-center gap-1 md:flex" aria-label="Sections">
                            <BarLink href="/parent-dashboard" icon={House} label="Home" active={isHome} />
                            <BarLink
                                href="/parent-dashboard/notifications"
                                icon={Bell}
                                label="Alerts"
                                active={pathname === '/parent-dashboard/notifications'}
                            />
                            <BarLink
                                href="/parent-dashboard/circulars"
                                icon={ScrollText}
                                label="Circulars"
                                active={pathname.startsWith('/parent-dashboard/circulars')}
                            />
                            <BarLink
                                href="/parent-dashboard/support"
                                icon={LifeBuoy}
                                label="Help"
                                active={pathname === '/parent-dashboard/support'}
                            />
                            <BarLink
                                href="/parent-dashboard/profile"
                                icon={UserRound}
                                label="Profile"
                                active={pathname === '/parent-dashboard/profile'}
                            />
                        </nav>

                        <span
                            className="hidden items-center gap-1.5 font-mono text-[11px] text-rail-ink-muted select-none sm:flex"
                            suppressHydrationWarning
                        >
                            <CalendarDays className="size-3.5 shrink-0" aria-hidden />
                            <span suppressHydrationWarning>
                                {new Date().toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}
                            </span>
                        </span>

                        <ThemePicker onInk />

                        <span className="hidden items-center gap-2 rounded-lg border border-rail-line bg-rail-selected py-1 pr-3 pl-1 sm:flex">
                            <span className="grid size-7 place-items-center rounded-md bg-linear-to-br from-tile-from to-tile-to font-display text-[11px] font-bold text-tile-ink select-none">
                                {user.firstName?.[0]}{user.lastName?.[0]}
                            </span>
                            <span className="max-w-32 truncate text-[12.5px] font-semibold text-rail-ink">
                                {user.firstName} {user.lastName}
                            </span>
                        </span>

                        <button
                            onClick={() => logout()}
                            className="hidden size-9 cursor-pointer items-center justify-center rounded-md text-rail-ink-soft transition-colors hover:bg-rail-danger-bg hover:text-rail-danger-ink md:flex"
                            aria-label="Sign out"
                            title="Sign out"
                        >
                            <LogOut className="size-4" />
                        </button>
                    </div>
                </div>
            </header>

            <main id="main-content" className="mx-auto w-full max-w-5xl">
                <PullToRefresh>{children}</PullToRefresh>
            </main>

            {/* ── Mobile bottom tabs ─────────────────────────────────────── */}
            <nav
                aria-label="Primary"
                className="fixed right-0 bottom-0 left-0 z-50 border-t border-line bg-surface-glass pb-[env(safe-area-inset-bottom)] shadow-[0_-4px_20px_-2px_rgba(33,28,22,0.08)] backdrop-blur-xl md:hidden"
            >
                <div className="flex h-15 items-stretch justify-around">
                    <Tab href="/parent-dashboard" icon={House} label="Home" active={isHome} />
                    <Tab
                        href="/parent-dashboard/notifications"
                        icon={Bell}
                        label="Alerts"
                        active={pathname === '/parent-dashboard/notifications'}
                    />
                    <Tab
                        href="/parent-dashboard/circulars"
                        icon={ScrollText}
                        label="Circulars"
                        active={pathname.startsWith('/parent-dashboard/circulars')}
                    />
                    <Tab
                        href="/parent-dashboard/support"
                        icon={LifeBuoy}
                        label="Help"
                        active={pathname === '/parent-dashboard/support'}
                    />
                    <Tab
                        href="/parent-dashboard/profile"
                        icon={UserRound}
                        label="Profile"
                        active={pathname === '/parent-dashboard/profile'}
                    />
                </div>
            </nav>
        </div>
    );
}

/** A destination in the walnut bar (desktop). */
function BarLink({
    href, icon: Icon, label, active,
}: { href: string; icon: LucideIcon; label: string; active: boolean }) {
    return (
        <Link
            href={href}
            aria-current={active ? 'page' : undefined}
            className={cn(
                'flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[13px] font-medium transition-colors',
                active
                    ? 'bg-rail-selected text-rail-ink'
                    : 'text-rail-ink-soft hover:bg-rail-hover hover:text-rail-ink',
            )}
        >
            <Icon className="size-4" aria-hidden />
            {label}
        </Link>
    );
}

/** A destination in the mobile bottom bar, marked the same way as the staff app. */
function Tab({
    href, icon: Icon, label, active,
}: { href: string; icon: LucideIcon; label: string; active: boolean }) {
    return (
        <Link
            href={href}
            aria-current={active ? 'page' : undefined}
            className={cn(
                'relative flex w-full flex-col items-center justify-center gap-0.5 transition-colors',
                active ? 'text-brand' : 'text-ink-muted active:text-ink',
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
