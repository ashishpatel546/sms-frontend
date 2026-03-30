"use client";

import { useState } from "react";
import ExamScheduleList from "./ExamScheduleList";
import ExamScheduleCalendar from "./ExamScheduleCalendar";

export default function ExamScheduleTab() {
    const [view, setView] = useState<"list" | "editor">("list");
    const [selectedScheduleId, setSelectedScheduleId] = useState<number | null>(null);

    return (
        <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200 min-h-[500px]">
            {view === "list" ? (
                <ExamScheduleList 
                    onView={(id) => {
                        setSelectedScheduleId(id);
                        setView("editor");
                    }} 
                />
            ) : (
                <ExamScheduleCalendar 
                    scheduleId={selectedScheduleId!} 
                    onBack={() => {
                        setView("list");
                        setSelectedScheduleId(null);
                    }} 
                />
            )}
        </div>
    );
}
