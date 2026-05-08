"use client";

import { useState } from "react";
import { API_BASE_URL } from "@/lib/api";
import { authFetch } from "@/lib/auth";
import toast from "react-hot-toast";

type LeaveType = "SICK_LEAVE" | "CASUAL_LEAVE" | "OTHER_LEAVE";
type LeaveDuration = "FULL_DAY" | "HALF_DAY";

const LEAVE_TYPE_OPTIONS: { value: LeaveType; label: string }[] = [
    { value: "SICK_LEAVE", label: "Sick Leave" },
    { value: "CASUAL_LEAVE", label: "Casual Leave" },
    { value: "OTHER_LEAVE", label: "Other Leave" },
];

interface Props {
    studentId: number;
    studentName: string;
    onClose: () => void;
    onSuccess: () => void;
}

export default function ApplyLeaveModal({ studentId, studentName, onClose, onSuccess }: Props) {
    const [leaveType, setLeaveType] = useState<LeaveType>("CASUAL_LEAVE");
    const [leaveDuration, setLeaveDuration] = useState<LeaveDuration>("FULL_DAY");
    const [fromDate, setFromDate] = useState("");
    const [toDate, setToDate] = useState("");
    const [reason, setReason] = useState("");
    const [file, setFile] = useState<File | null>(null);
    const [submitting, setSubmitting] = useState(false);

    const today = new Date().toISOString().split("T")[0];

    const handleFromDateChange = (val: string) => {
        setFromDate(val);
        if (leaveDuration === "HALF_DAY") setToDate(val);
        else if (toDate && toDate < val) setToDate(val);
    };

    /** For sick leave: max = today (cannot apply for future dates).
     *  All types allow past dates — no min date restriction. */
    const maxDate = leaveType === "SICK_LEAVE" ? today : undefined;
    const minFromDate = undefined;

    const handleLeaveTypeChange = (val: LeaveType) => {
        setLeaveType(val);
        // When switching to sick leave, clear any future dates
        if (val === "SICK_LEAVE") {
            if (fromDate > today) setFromDate("");
            if (toDate > today) setToDate("");
        }
    };

    const handleDurationChange = (val: LeaveDuration) => {
        setLeaveDuration(val);
        if (val === "HALF_DAY" && fromDate) setToDate(fromDate);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!fromDate || !toDate) { toast.error("Please select leave dates."); return; }
        if (!reason.trim()) { toast.error("Please enter a reason."); return; }
        if (leaveDuration === "HALF_DAY" && fromDate !== toDate) {
            toast.error("Half day leave must be a single day.");
            return;
        }

        setSubmitting(true);
        try {
            // 1. Create leave application
            const res = await authFetch(`${API_BASE_URL}/leaves`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    studentId,
                    leaveType,
                    leaveDuration,
                    fromDate,
                    toDate,
                    reason: reason.trim(),
                }),
            });

            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err.message || "Failed to apply for leave.");
            }

            const created = await res.json();

            // 2. Upload document if provided
            if (file && created.id) {
                const formData = new FormData();
                formData.append("file", file);
                const docRes = await authFetch(`${API_BASE_URL}/leaves/${created.id}/documents`, {
                    method: "POST",
                    body: formData,
                });
                if (!docRes.ok) {
                    toast.error("Leave applied, but document upload failed.");
                }
            }

            toast.success("Leave application submitted successfully!");
            onSuccess();
        } catch (err: any) {
            toast.error(err.message || "Something went wrong.");
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden max-h-[90vh] flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 shrink-0">
                    <div>
                        <h3 className="text-base font-semibold text-gray-900">Apply for Leave</h3>
                        <p className="text-xs text-gray-500 mt-0.5">{studentName}</p>
                    </div>
                    <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
                        <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="overflow-y-auto flex-1 p-5 space-y-4">
                    {/* Leave Type */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Leave Type <span className="text-red-500">*</span></label>
                        <select
                            value={leaveType}
                            onChange={e => handleLeaveTypeChange(e.target.value as LeaveType)}
                            className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white"
                        >
                            {LEAVE_TYPE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                        </select>
                        {leaveType === "SICK_LEAVE" && (
                            <p className="text-xs text-amber-600 mt-1.5 flex items-center gap-1">
                                <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                Sick leave can only be applied for today or past dates.
                            </p>
                        )}
                    </div>

                    {/* Duration */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Duration <span className="text-red-500">*</span></label>
                        <div className="flex gap-3">
                            {(["FULL_DAY", "HALF_DAY"] as LeaveDuration[]).map(d => (
                                <label
                                    key={d}
                                    className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border cursor-pointer text-sm font-medium transition-colors ${
                                        leaveDuration === d
                                            ? "border-blue-500 bg-blue-50 text-blue-700"
                                            : "border-gray-200 text-gray-700 hover:border-gray-300 hover:bg-gray-50"
                                    }`}
                                >
                                    <input type="radio" name="duration" value={d} checked={leaveDuration === d} onChange={() => handleDurationChange(d)} className="sr-only" />
                                    {d === "FULL_DAY" ? "Full Day" : "Half Day"}
                                </label>
                            ))}
                        </div>
                    </div>

                    {/* Dates */}
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">From Date <span className="text-red-500">*</span></label>
                            <input
                                type="date"
                                value={fromDate}
                                min={minFromDate}
                                max={maxDate}
                                onChange={e => handleFromDateChange(e.target.value)}
                                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                                required
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">To Date <span className="text-red-500">*</span></label>
                            <input
                                type="date"
                                value={toDate}
                                min={fromDate || minFromDate}
                                max={maxDate}
                                onChange={e => setToDate(e.target.value)}
                                disabled={leaveDuration === "HALF_DAY"}
                                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 disabled:bg-gray-50 disabled:text-gray-400"
                                required
                            />
                            {leaveDuration === "HALF_DAY" && <p className="text-xs text-gray-400 mt-1">Auto-set for half day</p>}
                        </div>
                    </div>

                    {/* Reason */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Reason <span className="text-red-500">*</span></label>
                        <textarea
                            value={reason}
                            onChange={e => setReason(e.target.value)}
                            rows={3}
                            maxLength={1000}
                            placeholder="Describe the reason for leave..."
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none"
                            required
                        />
                        <p className="text-right text-xs text-gray-400 mt-0.5">{reason.length}/1000</p>
                    </div>

                    {/* Document upload (optional) */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Supporting Document <span className="text-gray-400 font-normal">(optional)</span></label>
                        <div
                            className={`border-2 border-dashed rounded-xl p-4 text-center transition-colors ${
                                file ? "border-blue-400 bg-blue-50" : "border-gray-300 hover:border-gray-400"
                            }`}
                        >
                            {file ? (
                                <div className="flex items-center justify-center gap-2">
                                    <svg className="w-5 h-5 text-blue-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" /></svg>
                                    <span className="text-sm text-blue-700 truncate max-w-xs">{file.name}</span>
                                    <button type="button" onClick={() => setFile(null)} className="ml-1 text-gray-400 hover:text-red-500 transition-colors">
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                    </button>
                                </div>
                            ) : (
                                <>
                                    <svg className="w-8 h-8 mx-auto mb-2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg>
                                    <p className="text-xs text-gray-500">JPEG, PNG, WEBP, or PDF — max 10 MB</p>
                                    <label className="mt-2 inline-block cursor-pointer text-xs font-medium text-blue-600 hover:text-blue-700">
                                        Choose file
                                        <input
                                            type="file"
                                            accept="image/jpeg,image/png,image/webp,application/pdf"
                                            className="hidden"
                                            onChange={e => setFile(e.target.files?.[0] ?? null)}
                                        />
                                    </label>
                                </>
                            )}
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="flex gap-3 pt-1">
                        <button type="button" onClick={onClose} className="flex-1 py-2.5 border border-gray-300 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={submitting}
                            className="flex-1 py-2.5 bg-blue-700 text-white rounded-xl text-sm font-medium hover:bg-blue-800 disabled:opacity-50 transition-colors"
                        >
                            {submitting ? "Submitting…" : "Submit Application"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
