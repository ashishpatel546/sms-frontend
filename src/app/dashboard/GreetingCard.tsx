"use client";

import { useMemo } from "react";
import { getUser } from "@/lib/auth";
import { CalendarDays, Sun, CloudSun, Moon, type LucideIcon } from "lucide-react";

export default function GreetingCard() {
    const user = getUser();
    const { greeting, TimeIcon, iconColor } = useMemo<{
        greeting: string;
        TimeIcon: LucideIcon;
        iconColor: string;
    }>(() => {
        const hour = new Date().getHours();
        if (hour < 12) return { greeting: "Good morning",   TimeIcon: Sun,      iconColor: "text-amber-500" };
        if (hour < 17) return { greeting: "Good afternoon", TimeIcon: CloudSun, iconColor: "text-orange-500" };
        return            { greeting: "Good evening",   TimeIcon: Moon,     iconColor: "text-indigo-500 dark:text-indigo-400"   };
    }, []);

    if (!user) return null;

    const firstName = user.firstName || "there";
    const initials = `${user.firstName?.[0] ?? ""}${user.lastName?.[0] ?? ""}`;
    const roleLabel = user.role
        ? user.role.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (c: string) => c.toUpperCase())
        : "";

    const dateStr = new Date().toLocaleDateString("en-IN", {
        weekday: "long",
        day: "numeric",
        month: "long",
    });

    return (
        <div className="relative overflow-hidden rounded-2xl bg-white dark:bg-slate-900 shadow-sm border border-slate-200 dark:border-slate-800">
            {/* Elegant gradient background */}
            <div className="absolute inset-0 bg-gradient-to-r from-brand/5 to-transparent dark:from-brand/10 dark:to-transparent" />
            
            {/* Abstract shapes */}
            <div className="absolute -top-24 -right-24 w-64 h-64 rounded-full bg-brand/5 dark:bg-brand/10 blur-3xl" />
            <div className="absolute bottom-0 left-1/3 w-48 h-48 rounded-full bg-brand-light/10 dark:bg-brand-light/5 blur-2xl" />

            <div className="relative p-4 sm:p-6 flex flex-row items-center gap-3 sm:gap-5">
                {/* Avatar */}
                <div className="shrink-0">
                    <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-full bg-gradient-to-br from-brand to-brand-light flex items-center justify-center text-white text-base sm:text-xl font-bold shadow-md ring-2 sm:ring-4 ring-white dark:ring-slate-900 relative z-10">
                        {initials}
                    </div>
                </div>

                {/* Text block */}
                <div className="flex-1 min-w-0">
                    <h2 className="text-lg sm:text-2xl font-bold text-slate-800 dark:text-slate-100 flex items-center gap-1.5 sm:gap-2">
                        <span className="truncate">{greeting}, {firstName}!</span>
                        <TimeIcon className={`w-4 h-4 sm:w-6 sm:h-6 shrink-0 ${iconColor}`} />
                    </h2>
                    
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5 mt-0.5 sm:mt-1.5">
                        {roleLabel && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] sm:text-xs font-semibold bg-brand/10 text-brand dark:text-brand-light border border-brand/20 whitespace-nowrap">
                                {roleLabel}
                            </span>
                        )}
                        <div className="flex items-center gap-1 sm:gap-1.5 text-slate-500 dark:text-slate-400">
                            <CalendarDays className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
                            <span className="text-xs sm:text-sm font-medium whitespace-nowrap">{dateStr}</span>
                        </div>
                        
                        {/* Live badge mobile */}
                        <div className="flex md:hidden items-center gap-1.5 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 rounded px-1.5 py-0.5 text-[10px] text-emerald-700 dark:text-emerald-400 font-semibold shadow-sm ml-auto sm:ml-0">
                            <span className="relative flex h-1.5 w-1.5">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500" />
                            </span>
                            Live
                        </div>
                    </div>
                </div>

                {/* Live badge desktop */}
                <div className="hidden md:flex items-center shrink-0">
                    <div className="flex items-center gap-2 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 rounded-full px-3 py-1.5 text-xs text-emerald-700 dark:text-emerald-400 font-semibold shadow-sm">
                        <span className="relative flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                        </span>
                        Live
                    </div>
                </div>
            </div>
        </div>
    );
}
