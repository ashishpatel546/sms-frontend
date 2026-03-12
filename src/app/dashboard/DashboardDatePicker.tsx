"use client";

import { useRouter } from "next/navigation";
import { Calendar } from "lucide-react";

export default function DashboardDatePicker({ defaultDate }: { defaultDate: string }) {
    const router = useRouter();

    const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedDate = e.target.value;
        if (selectedDate) {
            router.push(`/dashboard?date=${selectedDate}`);
        }
    };

    return (
        <div className="relative flex items-center bg-white border border-slate-200 rounded-lg shadow-sm px-3 py-1.5 focus-within:ring-2 focus-within:ring-indigo-500 focus-within:border-indigo-500 transition-shadow">
            <Calendar className="w-4 h-4 text-slate-400 mr-2" />
            <input
                type="date"
                defaultValue={defaultDate}
                onChange={handleDateChange}
                className="bg-transparent border-none text-sm text-slate-700 font-medium focus:ring-0 cursor-pointer outline-none"
            />
        </div>
    );
}
