import type { Metadata } from "next";
import DashboardDatePicker from "./DashboardDatePicker";
import QuickActions from "./QuickActions";
import DashboardStats from "./DashboardStats";
import RecentActivity from "@/components/RecentActivity";
import GreetingCard from "./GreetingCardDynamic";
import { GuardSwitch } from "./GuardDashboard";
import { todayLocalDate } from "@/lib/utils";

export const metadata: Metadata = {
    title: "Dashboard",
};

export default async function Dashboard({ searchParams }: { searchParams: Promise<{ date?: string }> }) {
    const resolvedSearchParams = await searchParams;
    const todayIST = todayLocalDate();
    const selectedDate = resolvedSearchParams.date || todayIST;
    const isToday = selectedDate === todayIST;

    return (
        <GuardSwitch>
        <div className="min-h-screen p-4 sm:p-6">
            <div className="max-w-7xl mx-auto space-y-5">

                {/* ── Personalised greeting ─────────────────────────── */}
                <GreetingCard />

                {/* ── Page header + date picker ─────────────────────── */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                        <h1 className="text-2xl sm:text-3xl font-bold text-ink tracking-tight">Overview</h1>
                        <p className="mt-0.5 text-ink-muted text-sm">
                            {isToday ? "Here's what's happening today." : `Showing data for ${selectedDate}.`}
                        </p>
                    </div>
                    <div className="shrink-0">
                        <DashboardDatePicker defaultDate={selectedDate} />
                    </div>
                </div>

                {/* ── Stats tiles ───────────────────────────────────── */}
                <DashboardStats selectedDate={selectedDate} />

                {/* ── Bottom two-column grid ────────────────────────── */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                    <QuickActions />
                    <RecentActivity />
                </div>
            </div>
        </div>
        </GuardSwitch>
    );
}
