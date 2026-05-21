import type { Metadata } from "next";
import DashboardDatePicker from "./DashboardDatePicker";
import QuickActions from "./QuickActions";
import DashboardStats from "./DashboardStats";
import RecentActivity from "@/components/RecentActivity";

export const metadata: Metadata = {
    title: "Dashboard",
};

export default async function Dashboard({ searchParams }: { searchParams: Promise<{ date?: string }> }) {
    const resolvedSearchParams = await searchParams;
    const selectedDate = resolvedSearchParams.date || new Date().toISOString().split('T')[0];
    const isToday = selectedDate === new Date().toISOString().split('T')[0];

    return (
        <main className="min-h-screen bg-slate-50/50 p-6">
            <div className="max-w-7xl mx-auto space-y-8">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Overview</h1>
                        <p className="mt-1 text-slate-500 text-sm">Welcome back! Here's what's happening {isToday ? 'today' : `on ${selectedDate}`}.</p>
                    </div>
                    <div className="flex items-center gap-3">
                        <DashboardDatePicker defaultDate={selectedDate} />
                        <div className="self-start sm:self-auto flex items-center space-x-2 text-sm text-slate-500 bg-white px-4 py-2 rounded-full border border-slate-200 shadow-sm">
                            <span className="relative flex h-2.5 w-2.5">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                            </span>
                            <span>Live Data System Active</span>
                        </div>
                    </div>
                </div>

                <DashboardStats selectedDate={selectedDate} />

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-8">
                    <RecentActivity />
                    <QuickActions />
                </div>
            </div>
        </main>
    );
}
