"use client";

type ActorUser = { id?: number; firstName: string; lastName: string; role?: string };

export interface LeaveForTimeline {
    createdAt: string;
    firstApprover?: ActorUser;
    firstApprovedAt?: string;
    secondApprover?: ActorUser;
    secondApprovedAt?: string;
    rejectedBy?: ActorUser;
    rejectedAt?: string;
    rejectionReason?: string;
    cancelledBy?: ActorUser;
    cancelledAt?: string;
    cancellationNote?: string;
    actionRequiredBy?: ActorUser;
    actionRequiredAt?: string;
    actionRequiredMessage?: string;
    parentResponseNote?: string;
    parentResponseAt?: string;
}

interface TimelineEvent {
    timestamp: Date;
    label: string;
    note?: string;
    colorClass: string;           // dot color
    bgClass: string;              // note box background (theme-specific)
    borderClass: string;
    textClass: string;
    labelColorClass: string;
}

const ROLE_LABELS: Record<string, string> = {
    ADMIN: "Admin",
    SUB_ADMIN: "Sub-Admin",
    TEACHER: "Teacher",
    PARENT: "Parent",
    STUDENT: "Student",
    SUPER_ADMIN: "Super Admin",
    SYSTEM_ADMIN: "System Admin",
};

function fullName(u?: ActorUser) {
    if (!u) return "";
    const name = `${u.firstName} ${u.lastName}`;
    const role = u.role ? ROLE_LABELS[u.role] ?? u.role : null;
    const tag = role && u.id ? `${role}-${u.id}` : role ?? (u.id ? `#${u.id}` : null);
    return tag ? `${name} (${tag})` : name;
}

function formatDateTime(d: string | Date) {
    const date = new Date(d);
    return date.toLocaleString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
    });
}

function buildEvents(leave: LeaveForTimeline, theme: "light" | "dark"): TimelineEvent[] {
    const events: TimelineEvent[] = [];

    const add = (
        ts: string | Date | undefined,
        label: string,
        note: string | undefined,
        color: "gray" | "blue" | "green" | "red" | "orange" | "slate",
    ) => {
        if (!ts) return;
        const colorMap: Record<string, { dot: string; bg: string; border: string; text: string; labelColor: string }> = {
            gray: {
                dot: theme === "light" ? "bg-gray-400" : "bg-slate-500",
                bg: theme === "light" ? "bg-gray-50" : "bg-slate-800/60",
                border: theme === "light" ? "border-gray-200" : "border-slate-700",
                text: theme === "light" ? "text-gray-700" : "text-slate-300",
                labelColor: theme === "light" ? "text-gray-500" : "text-slate-400",
            },
            blue: {
                dot: "bg-blue-500",
                bg: theme === "light" ? "bg-blue-50" : "bg-blue-900/30",
                border: theme === "light" ? "border-blue-200" : "border-blue-700/50",
                text: theme === "light" ? "text-blue-800" : "text-blue-300",
                labelColor: theme === "light" ? "text-blue-600" : "text-blue-400",
            },
            green: {
                dot: "bg-green-500",
                bg: theme === "light" ? "bg-green-50" : "bg-green-900/30",
                border: theme === "light" ? "border-green-200" : "border-green-700/50",
                text: theme === "light" ? "text-green-800" : "text-green-300",
                labelColor: theme === "light" ? "text-green-600" : "text-green-400",
            },
            red: {
                dot: "bg-red-500",
                bg: theme === "light" ? "bg-red-50" : "bg-red-900/30",
                border: theme === "light" ? "border-red-200" : "border-red-700/50",
                text: theme === "light" ? "text-red-800" : "text-red-300",
                labelColor: theme === "light" ? "text-red-600" : "text-red-400",
            },
            orange: {
                dot: "bg-orange-500",
                bg: theme === "light" ? "bg-orange-50" : "bg-orange-900/30",
                border: theme === "light" ? "border-orange-200" : "border-orange-700/50",
                text: theme === "light" ? "text-orange-800" : "text-orange-300",
                labelColor: theme === "light" ? "text-orange-600" : "text-orange-400",
            },
            slate: {
                dot: "bg-slate-500",
                bg: theme === "light" ? "bg-slate-50" : "bg-slate-800/60",
                border: theme === "light" ? "border-slate-200" : "border-slate-700",
                text: theme === "light" ? "text-slate-700" : "text-slate-300",
                labelColor: theme === "light" ? "text-slate-500" : "text-slate-400",
            },
        };
        const c = colorMap[color];
        events.push({
            timestamp: new Date(ts),
            label,
            note,
            colorClass: c.dot,
            bgClass: c.bg,
            borderClass: c.border,
            textClass: c.text,
            labelColorClass: c.labelColor,
        });
    };

    add(leave.createdAt, "Applied", undefined, "gray");
    add(leave.firstApprovedAt, `1st Approved${leave.firstApprover ? ` by ${fullName(leave.firstApprover)}` : ""}`, undefined, "blue");
    add(leave.actionRequiredAt, `Info Requested${leave.actionRequiredBy ? ` by ${fullName(leave.actionRequiredBy)}` : ""}`, leave.actionRequiredMessage, "orange");
    add(leave.parentResponseAt, "Parent Replied", leave.parentResponseNote, "slate");
    add(leave.secondApprovedAt, `Approved${leave.secondApprover ? ` by ${fullName(leave.secondApprover)}` : ""}`, undefined, "green");
    add(leave.rejectedAt, `Rejected${leave.rejectedBy ? ` by ${fullName(leave.rejectedBy)}` : ""}`, leave.rejectionReason, "red");
    add(leave.cancelledAt, `Cancelled${leave.cancelledBy ? ` by ${fullName(leave.cancelledBy)}` : ""}`, leave.cancellationNote, "gray");

    // Sort chronologically
    events.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
    return events;
}

export default function LeaveTimeline({
    leave,
    theme = "light",
}: {
    leave: LeaveForTimeline;
    theme?: "light" | "dark";
}) {
    const events = buildEvents(leave, theme);
    const connectorClass = theme === "light" ? "bg-gray-200" : "bg-slate-700";
    const headingClass = theme === "light"
        ? "text-xs font-semibold text-gray-500 uppercase tracking-wider"
        : "text-xs font-semibold text-slate-500 uppercase tracking-wider";

    return (
        <div>
            <p className={`${headingClass} mb-3`}>Timeline</p>
            <div className="relative">
                {/* Vertical connector line */}
                <div className={`absolute left-[9px] top-3 bottom-3 w-0.5 ${connectorClass}`} />

                <div className="space-y-4">
                    {events.map((ev, i) => (
                        <div key={i} className="relative flex gap-3">
                            {/* Dot */}
                            <div className={`w-5 h-5 rounded-full shrink-0 mt-0.5 flex items-center justify-center z-10 ${ev.colorClass}`}>
                                <span className="w-2 h-2 rounded-full bg-white/80" />
                            </div>
                            {/* Content */}
                            <div className="flex-1 min-w-0">
                                <div className="flex items-baseline justify-between gap-2 flex-wrap">
                                    <p className={`text-sm font-medium ${ev.labelColorClass}`}>{ev.label}</p>
                                    <p className={`text-xs shrink-0 ${theme === "light" ? "text-gray-400" : "text-slate-500"}`}>
                                        {formatDateTime(ev.timestamp)}
                                    </p>
                                </div>
                                {ev.note && (
                                    <div className={`mt-1.5 px-3 py-2 rounded-lg border text-xs ${ev.bgClass} ${ev.borderClass} ${ev.textClass}`}>
                                        {ev.note}
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
