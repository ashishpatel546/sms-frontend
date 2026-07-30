"use client";

import { useState } from "react";

type CancellationAction = "MARK_ABSENT" | "MARK_PRESENT" | "NO_CHANGE";

interface Props {
    leave: { id: number; fromDate: string; toDate: string; student?: { user?: { firstName: string; lastName: string } } };
    /** True when leave status is APPROVED — requires attendance action */
    isApproved: boolean;
    onClose: () => void;
    onConfirm: (note: string, action: CancellationAction | "") => void;
    loading: boolean;
}

function formatDate(d: string) {
    if (!d) return "—";
    const [y, m, day] = d.split("-");
    return `${day}/${m}/${y}`;
}

const ACTIONS: { value: CancellationAction; label: string; description: string }[] = [
    { value: "MARK_ABSENT", label: "Mark Absent", description: "Revert attendance to Absent for each leave day" },
    { value: "MARK_PRESENT", label: "Mark Present", description: "Revert attendance to Present for each leave day" },
    { value: "NO_CHANGE", label: "No Change", description: "Leave attendance records unchanged" },
];

export default function LeaveCancellationModal({ leave, isApproved, onClose, onConfirm, loading }: Props) {
    const [note, setNote] = useState("");
    const [action, setAction] = useState<CancellationAction | "">("");

    const canConfirm = !isApproved || action !== "";

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-walnut-950/50">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
                    <h3 className="text-base font-semibold text-gray-900">Cancel Leave #{leave.id}</h3>
                    <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
                        <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                <div className="p-5 space-y-5">
                    {/* Student + dates summary */}
                    <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm">
                        <p className="font-medium text-amber-900">
                            {leave.student?.user?.firstName} {leave.student?.user?.lastName}
                        </p>
                        <p className="text-amber-700 text-xs mt-0.5">
                            {formatDate(leave.fromDate)} → {formatDate(leave.toDate)}
                        </p>
                    </div>

                    {/* Attendance action — required when leave is APPROVED */}
                    {isApproved && (
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Attendance Action <span className="text-red-500">*</span>
                            </label>
                            <p className="text-xs text-gray-500 mb-3">
                                This leave is already approved and attendance has been updated. Choose what to do with those attendance records.
                            </p>
                            <div className="space-y-2">
                                {ACTIONS.map(opt => (
                                    <label
                                        key={opt.value}
                                        className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${
                                            action === opt.value
                                                ? "border-blue-500 bg-blue-50"
                                                : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"
                                        }`}
                                    >
                                        <input
                                            type="radio"
                                            name="cancellationAction"
                                            value={opt.value}
                                            checked={action === opt.value}
                                            onChange={() => setAction(opt.value)}
                                            className="mt-0.5 shrink-0 accent-blue-600"
                                        />
                                        <div>
                                            <p className="text-sm font-medium text-gray-900">{opt.label}</p>
                                            <p className="text-xs text-gray-500 mt-0.5">{opt.description}</p>
                                        </div>
                                    </label>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Note — optional */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Cancellation Note <span className="text-gray-400 font-normal">(optional)</span>
                        </label>
                        <textarea
                            value={note}
                            onChange={e => setNote(e.target.value)}
                            rows={3}
                            maxLength={500}
                            placeholder="Add a note for the parent/student..."
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand/40 resize-none"
                        />
                        <p className="text-right text-xs text-gray-400 mt-0.5">{note.length}/500</p>
                    </div>
                </div>

                {/* Footer */}
                <div className="flex gap-3 px-5 pb-5">
                    <button onClick={onClose} className="flex-1 py-2.5 border border-gray-300 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
                        Keep Leave
                    </button>
                    <button
                        onClick={() => canConfirm && onConfirm(note.trim(), action)}
                        disabled={!canConfirm || loading}
                        className="flex-1 py-2.5 bg-amber-600 text-white rounded-xl text-sm font-medium hover:bg-amber-700 disabled:opacity-50 transition-colors"
                    >
                        {loading ? "Cancelling…" : "Cancel Leave"}
                    </button>
                </div>
            </div>
        </div>
    );
}
