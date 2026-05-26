"use client";

import { useRouter } from "next/navigation";
import { AppDatePicker } from "@/components/ui/AppDatePicker";

export default function DashboardDatePicker({ defaultDate }: { defaultDate: string }) {
    const router = useRouter();

    return (
        <AppDatePicker
            value={defaultDate}
            onChange={(v) => { if (v) router.push(`/dashboard?date=${v}`); }}
        />
    );
}
