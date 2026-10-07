import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import DashboardDatePicker from "./DashboardDatePicker";
import QuickActions from "./QuickActions";
import DashboardStats from "./DashboardStats";
import AttendanceSummaryTile from "./AttendanceSummaryTile";
import Birthdays from "./Birthdays";
import RecentActivity from "@/components/RecentActivity";
import GreetingCard from "./GreetingCardDynamic";
import { GuardSwitch } from "./GuardDashboard";
import BillingDueBanner from "@/components/dashboard/BillingDueBanner";
import { PageBody, PageHeader, PageShell } from "@/components/ui/PageHeader";
import { todayLocalDate } from "@/lib/utils";

export async function generateMetadata(): Promise<Metadata> {
    const t = await getTranslations("dashboard");
    return { title: t("home.metaTitle") };
}

export default async function Dashboard({ searchParams }: { searchParams: Promise<{ date?: string }> }) {
    const resolvedSearchParams = await searchParams;
    const todayIST = todayLocalDate();
    const selectedDate = resolvedSearchParams.date || todayIST;
    const isToday = selectedDate === todayIST;
    const t = await getTranslations("dashboard");

    return (
        <GuardSwitch>
            <PageShell>
                {/* ── Subscription dues, for the school owner ───────── */}
                <BillingDueBanner />

                <PageHeader
                    section={t("home.section")}
                    title={t("home.title")}
                    description={
                        isToday
                            ? t("home.descriptionToday")
                            : t("home.descriptionDate", { date: selectedDate })
                    }
                    actions={<DashboardDatePicker defaultDate={selectedDate} />}
                />

                <PageBody>
                    {/* ── Personalised greeting ─────────────────────── */}
                    <GreetingCard />

                    {/* ── Stat tiles ────────────────────────────────── */}
                    <DashboardStats selectedDate={selectedDate} />

                    {/* ── Today's staff attendance (HR Portal plan gated) ── */}
                    <AttendanceSummaryTile />

                    {/* ── Student & staff birthdays ─────────────────── */}
                    <Birthdays selectedDate={selectedDate} />

                    {/* ── Bottom two-column grid. items-start so a short
                        quick-actions panel doesn't stretch to match the
                        activity feed's height. ───────────────────────── */}
                    <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-2">
                        <QuickActions />
                        <RecentActivity />
                    </div>
                </PageBody>
            </PageShell>
        </GuardSwitch>
    );
}
