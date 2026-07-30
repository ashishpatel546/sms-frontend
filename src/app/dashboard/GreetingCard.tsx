"use client";

import { useMemo } from "react";
import { getUser } from "@/lib/auth";
import { CalendarDays, Sun, CloudSun, Moon, type LucideIcon } from "lucide-react";

/**
 * The greeting strip. Warm walnut wash rather than a card, so it reads as a
 * masthead for the page rather than competing with the stat tiles below it —
 * those carry the actual figures and should win the eye.
 */
export default function GreetingCard() {
    const user = getUser();
    const { greeting, TimeIcon } = useMemo<{
        greeting: string;
        TimeIcon: LucideIcon;
    }>(() => {
        const hour = new Date().getHours();
        if (hour < 12) return { greeting: "Good morning", TimeIcon: Sun };
        if (hour < 17) return { greeting: "Good afternoon", TimeIcon: CloudSun };
        return { greeting: "Good evening", TimeIcon: Moon };
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
        <div className="relative overflow-hidden rounded-xl border border-line bg-surface shadow-soft">
            {/* A brass wash from the left — the same light that sits on the rail */}
            <div
                aria-hidden
                className="absolute inset-0 bg-linear-to-r from-brand-tint via-surface to-surface"
            />

            <div className="relative flex flex-row items-center gap-3 p-4 sm:gap-4 sm:px-5">
                <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-linear-to-br from-brass-500 to-marigold-400 font-display text-[15px] font-bold text-white sm:size-13 sm:text-[18px]">
                    {initials}
                </span>

                <div className="min-w-0 flex-1">
                    <h2 className="flex items-center gap-2 font-display text-[17px] font-semibold text-ink sm:text-[21px]">
                        <span className="truncate">
                            {greeting}, {firstName}
                        </span>
                        <TimeIcon className="size-4 shrink-0 text-accent sm:size-5" aria-hidden />
                    </h2>

                    <div className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1">
                        {roleLabel && (
                            <span className="rounded border border-brand-edge bg-brand-tint px-1.5 py-0.5 font-mono text-[9.5px] font-semibold tracking-[0.1em] whitespace-nowrap text-brand uppercase">
                                {roleLabel}
                            </span>
                        )}
                        <span className="flex items-center gap-1.5 text-[12.5px] text-ink-muted">
                            <CalendarDays className="size-3.5 shrink-0" aria-hidden />
                            <span className="whitespace-nowrap">{dateStr}</span>
                        </span>
                    </div>
                </div>

                {/* Live badge — sage, because a working connection is a settled fact */}
                <span className="ml-auto flex shrink-0 items-center gap-1.5 rounded-full border border-accent-success-edge bg-accent-success-tint px-2.5 py-1 text-[11px] font-semibold text-accent-success-deep">
                    <span className="relative flex size-1.5">
                        <span className="absolute inline-flex size-full animate-ping rounded-full bg-accent-success opacity-75" />
                        <span className="relative inline-flex size-1.5 rounded-full bg-accent-success" />
                    </span>
                    Live
                </span>
            </div>
        </div>
    );
}
