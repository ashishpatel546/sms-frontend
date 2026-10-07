"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import useSWR from "swr";
import { useTranslations } from "next-intl";
import { API_BASE_URL, fetcher } from "@/lib/api";
import { useRbac } from "@/lib/rbac";
import GreetingCard from "./GreetingCardDynamic";
import { GraduationCap, Users, QrCode, Clock, LogIn, LogOut } from "lucide-react";

/**
 * Role gate for the dashboard home. GUARD sees ONLY aggregate counts
 * (students/staff/present/visitors) — no names, fees, or activity feed.
 * Every other role gets the regular dashboard passed as children.
 */
export function GuardSwitch({ children }: { children: React.ReactNode }) {
    const rbac = useRbac();
    const [mounted, setMounted] = useState(false);
    useEffect(() => setMounted(true), []);
    if (!mounted) return null; // role comes from localStorage — avoid hydration flash
    return rbac.isGuard ? <GuardDashboard /> : <>{children}</>;
}

function GuardDashboard() {
    const t = useTranslations("dashboard");
    const { data, isLoading } = useSWR(`${API_BASE_URL}/dashboard/guard-summary`, fetcher);

    const tiles = [
        { label: t("guard.students"), value: data?.students, sub: t("guard.presentToday", { count: data?.studentsPresentToday ?? "—" }), icon: GraduationCap, color: "text-blue-500", bg: "bg-blue-500/10" },
        { label: t("guard.staff"), value: data?.staff, sub: t("guard.presentToday", { count: data?.staffPresentToday ?? "—" }), icon: Users, color: "text-indigo-500", bg: "bg-indigo-500/10" },
        { label: t("guard.visitorsToday"), value: data?.visitorsToday, sub: t("guard.currentlyInside", { count: data?.visitorsInside ?? "—" }), icon: LogIn, color: "text-teal-500", bg: "bg-teal-500/10" },
    ];

    return (
        <div className="min-h-screen p-4 sm:p-6">
            <div className="max-w-3xl mx-auto space-y-5">
                <GreetingCard />

                <div>
                    <h1 className="text-2xl sm:text-3xl font-bold text-ink tracking-tight">{t("guard.title")}</h1>
                    <p className="mt-0.5 text-ink-muted text-sm">{t("guard.subtitle")}</p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    {tiles.map(tile => {
                        const Icon = tile.icon;
                        return (
                            <div key={tile.label} className="bg-surface border border-slate-200 dark:border-white/10 rounded-2xl p-4">
                                <div className={`w-10 h-10 rounded-xl ${tile.bg} flex items-center justify-center mb-3`}>
                                    <Icon className={`w-5 h-5 ${tile.color}`} />
                                </div>
                                <div className="text-2xl font-bold text-ink">
                                    {isLoading ? "…" : tile.value ?? "—"}
                                </div>
                                <div className="text-sm font-medium text-ink">{tile.label}</div>
                                <div className="text-xs text-ink-muted mt-0.5">{tile.sub}</div>
                            </div>
                        );
                    })}
                </div>

                {/* Quick actions for the gate */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <Link href="/dashboard/pickup/scan"
                        className="flex items-center gap-3 p-4 rounded-2xl bg-teal-600 hover:bg-teal-500 text-white transition-colors">
                        <QrCode className="w-6 h-6" />
                        <div>
                            <div className="font-semibold text-sm">{t("quickActions.tile.scanQr")}</div>
                            <div className="text-xs text-white/75">{t("guard.scanHint")}</div>
                        </div>
                    </Link>
                    <Link href="/dashboard/visitors"
                        className="flex items-center gap-3 p-4 rounded-2xl bg-surface border border-slate-200 dark:border-white/10 hover:bg-surface-secondary transition-colors">
                        <LogOut className="w-6 h-6 text-cyan-500" />
                        <div>
                            <div className="font-semibold text-sm text-ink">{t("quickActions.tile.visitors")}</div>
                            <div className="text-xs text-ink-muted">{t("guard.visitorsHint")}</div>
                        </div>
                    </Link>
                    <Link href="/dashboard/my-attendance"
                        className="flex items-center gap-3 p-4 rounded-2xl bg-surface border border-slate-200 dark:border-white/10 hover:bg-surface-secondary transition-colors">
                        <Clock className="w-6 h-6 text-amber-500" />
                        <div>
                            <div className="font-semibold text-sm text-ink">{t("quickActions.tile.myAttendance")}</div>
                            <div className="text-xs text-ink-muted">{t("guard.attendanceHint")}</div>
                        </div>
                    </Link>
                </div>
            </div>
        </div>
    );
}
