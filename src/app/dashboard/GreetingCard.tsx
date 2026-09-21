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

            <div className="relative flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5 sm:px-5">
                <h2 className="flex min-w-0 items-center gap-1.5 truncate font-display text-[14.5px] font-semibold text-ink sm:text-[15.5px]">
                    <TimeIcon className="size-4 shrink-0 text-accent" aria-hidden />
                    <span className="truncate">{`${greeting}, ${firstName}`}</span>
                </h2>

                {roleLabel && (
                    <span className="shrink-0 rounded border border-brand-edge bg-brand-tint px-1.5 py-0.5 font-mono text-[9.5px] font-semibold tracking-[0.1em] whitespace-nowrap text-brand uppercase">
                        {roleLabel}
                    </span>
                )}

                <span className="flex shrink-0 items-center gap-1.5 text-[12px] text-ink-muted">
                    <CalendarDays className="size-3.5 shrink-0" aria-hidden />
                    <span className="whitespace-nowrap">{dateStr}</span>
                </span>

                <span className="ml-auto flex shrink-0 items-center gap-1.5 rounded-full border border-accent-success-edge bg-accent-success-tint px-2 py-0.5 text-[10.5px] font-semibold text-accent-success-deep">
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
