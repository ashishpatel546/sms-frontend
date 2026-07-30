"use client";

import { CheckCircle2 } from 'lucide-react';
import { useState, useEffect } from "react";
import { useFees } from "../hooks/useStudentData";

interface FeesBottomSheetProps {
    isOpen: boolean;
    onClose: () => void;
    studentId: string;
    academicYearString: string;
    onInitiatePayment: (selectedKeys: string[], dueItems: any[]) => void;
    onViewReceipt: (receiptData: any) => void;
    onViewReceiptsList: (data: { feeMonth: string; payments: any[]; adjustments: any[]; balanceRemaining: number; totalDue?: number }) => void;
    onViewFull: () => void;
    studentInfo: { firstName: string; lastName: string; className?: string; sectionName?: string };
    /** School feature flag: when false, the online payment gateway is hidden */
    paymentEnabled: boolean;
}

export default function FeesBottomSheet({
    isOpen,
    onClose,
    studentId,
    academicYearString,
    onInitiatePayment,
    onViewReceipt,
    onViewReceiptsList,
    onViewFull,
    studentInfo,
    paymentEnabled,
}: FeesBottomSheetProps) {
    const [selectedKeys, setSelectedKeys] = useState<string[]>([]);

    // Lazy load: only fetch when the sheet is open
    const { data: fees, isLoading } = useFees(studentId, isOpen ? academicYearString : "");

    const dueMonths: any[] = fees?.months?.filter((m: any) => !m.paid && m.amount > 0) ?? [];
    const otFee = fees?.oneTimeFees ?? null;
    const dueOneTimeFee = otFee && !otFee.paid && otFee.amount > 0 ? otFee : null;
    const allDueItems: any[] = [...(dueOneTimeFee ? [dueOneTimeFee] : []), ...dueMonths];

    const paidMonths: any[] = fees?.months?.filter((m: any) => m.paid && m.amount > 0) ?? [];
    const lastPaid = paidMonths.length > 0 ? paidMonths[paidMonths.length - 1] : null;

    const selectedTotal = selectedKeys.reduce((sum, key) => {
        const item = allDueItems.find((x) => x.key === key);
        return sum + (item ? item.amount : 0);
    }, 0);

    const allSelected = allDueItems.length > 0 && selectedKeys.length === allDueItems.length;

    // Lock scroll when open
    useEffect(() => {
        if (isOpen) document.body.style.overflow = "hidden";
        else document.body.style.overflow = "";
        return () => { document.body.style.overflow = ""; };
    }, [isOpen]);

    // Clear selections when sheet closes
    useEffect(() => {
        if (!isOpen) setSelectedKeys([]);
    }, [isOpen]);

    if (!isOpen) return null;

    const toggleKey = (key: string) =>
        setSelectedKeys((prev) =>
            prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
        );

    const toggleAll = () =>
        setSelectedKeys(allSelected ? [] : allDueItems.map((x) => x.key));

    const handleViewLastReceipt = () => {
        if (!lastPaid) return;
        if (lastPaid.payments && lastPaid.payments.length > 1) {
            onViewReceiptsList({
                feeMonth: lastPaid.label,
                payments: lastPaid.payments,
                adjustments: lastPaid.adjustments ?? [],
                balanceRemaining: lastPaid.outstanding ?? 0,
                totalDue: lastPaid.totalDue,
            });
        } else {
            const paymentToView = lastPaid.payments?.[0] ?? lastPaid.payment;
            if (paymentToView) {
                onViewReceipt({
                    ...paymentToView,
                    components: paymentToView.components ?? [],
                    feeMonth: lastPaid.label,
                    studentName: `${studentInfo.firstName} ${studentInfo.lastName}`,
                    studentClass: studentInfo.className,
                    studentSection: studentInfo.sectionName,
                    adjustments: lastPaid.adjustments ?? [],
                    balanceRemaining: lastPaid.outstanding ?? 0,
                    totalPayable: lastPaid.totalDue ?? null,
                });
            }
        }
        onClose();
    };

    return (
        <div
            className="fixed inset-0 z-60 flex flex-col justify-end"
            role="dialog"
            aria-modal="true"
            aria-label="Fee Summary"
        >
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-walnut-950/55 backdrop-blur-sm"
                onClick={onClose}
                aria-hidden="true"
            />

            {/* Sheet */}
            <div
                className="relative bg-white rounded-t-3xl max-h-[85vh] flex flex-col overflow-hidden shadow-2xl"
                style={{ animation: "feeSheetSlideUp 0.28s cubic-bezier(0.32,0.72,0,1)" }}
            >
                {/* Drag handle */}
                <div className="flex justify-center pt-3 pb-1 shrink-0">
                    <div className="w-10 h-1 bg-slate-300 rounded-full" />
                </div>

                {/* Header */}
                <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100 shrink-0">
                    <div>
                        <h2 className="text-base font-bold text-slate-800">Fee Summary</h2>
                        {academicYearString && (
                            <p className="text-xs text-slate-400 mt-0.5">{academicYearString}</p>
                        )}
                    </div>
                    <button
                        onClick={onClose}
                        aria-label="Close"
                        className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 transition-colors"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* Scrollable content */}
                <div className="overflow-y-auto flex-1">
                    <div className="px-5 pt-4 pb-4 space-y-4">

                        {isLoading ? (
                            <div className="flex items-center justify-center py-14">
                                <div className="w-5 h-5 border-2 border-brand border-t-transparent rounded-full animate-spin" />
                                <span className="ml-3 text-slate-500 text-sm">Loading fees…</span>
                            </div>
                        ) : allDueItems.length === 0 && paidMonths.length === 0 ? (
                            <div className="text-center py-14">
                                <div className="text-4xl mb-3">📭</div>
                                <p className="text-slate-700 font-semibold">No fee data</p>
                                <p className="text-slate-400 text-sm mt-1">Nothing to show for {academicYearString}</p>
                            </div>
                        ) : (
                            <>
                                {/* ── Pending Dues ── */}
                                {allDueItems.length === 0 ? (
                                    <div className="text-center py-8">
                                        <div className="mx-auto mb-2 grid size-11 place-items-center rounded-full bg-accent-success-tint text-accent-success-deep"><CheckCircle2 className="size-5" aria-hidden /></div>
                                        <p className="text-slate-700 font-semibold">All fees paid!</p>
                                        <p className="text-slate-400 text-sm mt-1">No pending dues for {academicYearString}</p>
                                    </div>
                                ) : (
                                    <>
                                        <div className="flex items-center justify-between">
                                            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                                                Pending Dues
                                                <span className="bg-red-100 text-red-600 px-1.5 py-0.5 rounded-full text-[10px] font-bold">
                                                    {allDueItems.length}
                                                </span>
                                            </p>
                                            {paymentEnabled && (
                                                <button
                                                    onClick={toggleAll}
                                                    className="text-xs font-medium text-brand hover:underline"
                                                >
                                                    {allSelected ? "Deselect All" : "Select All"}
                                                </button>
                                            )}
                                        </div>

                                        <div className="space-y-2">
                                            {allDueItems.map((item: any) => {
                                                const isSelected = selectedKeys.includes(item.key);
                                                return (
                                                    <label
                                                        key={item.key}
                                                        className={`flex items-start gap-3 p-3.5 rounded-xl border transition-all ${isSelected
                                                            ? "bg-brand/5 border-brand/30 shadow-sm"
                                                            : "bg-slate-50 border-slate-200"
                                                        } ${paymentEnabled ? "cursor-pointer hover:border-slate-300" : ""}`}
                                                    >
                                                        {paymentEnabled && (
                                                            <input
                                                                type="checkbox"
                                                                checked={isSelected}
                                                                onChange={() => toggleKey(item.key)}
                                                                className="mt-0.5 w-4 h-4 rounded border-slate-300 text-brand focus:ring-brand shrink-0"
                                                            />
                                                        )}
                                                        <div className="flex-1 min-w-0">
                                                            <div className="flex items-center justify-between gap-2">
                                                                <span className="text-sm font-semibold text-slate-800 truncate">
                                                                    {item.label ?? item.monthKey}
                                                                </span>
                                                                <span className="text-sm font-bold text-slate-900 shrink-0">
                                                                    ₹{Number(item.amount).toLocaleString()}
                                                                </span>
                                                            </div>

                                                            {/* Category breakdown pills */}
                                                            {item.categoryBreakdown?.length > 0 && (
                                                                <div className="flex flex-wrap gap-1 mt-1.5">
                                                                    {item.categoryBreakdown.map((cat: any) => (
                                                                        <span
                                                                            key={cat.categoryName}
                                                                            className="text-[10px] bg-slate-200 text-slate-600 px-2 py-0.5 rounded-full"
                                                                        >
                                                                            {cat.categoryName}: ₹{Number(cat.amount).toLocaleString()}
                                                                        </span>
                                                                    ))}
                                                                </div>
                                                            )}

                                                            {item.status === "PARTIAL" && item.totalPaid > 0 && (
                                                                <p className="text-[11px] text-yellow-600 mt-1">
                                                                    ₹{Number(item.totalPaid).toLocaleString()} already paid of ₹{Number(item.totalDue).toLocaleString()}
                                                                </p>
                                                            )}
                                                            {item.lateFee > 0 && (
                                                                <p className="text-[11px] text-red-500 mt-0.5">
                                                                    Incl. ₹{Number(item.lateFee).toLocaleString()} late fee
                                                                </p>
                                                            )}
                                                        </div>
                                                    </label>
                                                );
                                            })}
                                        </div>

                                        {/* Notice when online payment is disabled for the school */}
                                        {!paymentEnabled && (
                                            <div className="flex items-start gap-2 p-3 bg-sky-50 border border-sky-200 rounded-xl">
                                                <span className="text-sm">ℹ️</span>
                                                <p className="text-sky-700 text-xs">Online payment is not available. Please pay at the school office.</p>
                                            </div>
                                        )}

                                        {/* Payment summary when items selected */}
                                        {paymentEnabled && selectedKeys.length > 0 && (
                                            <div className="bg-brand/5 border border-brand/20 rounded-2xl p-4">
                                                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                                                    Payment Summary
                                                </p>
                                                {selectedKeys.map((key) => {
                                                    const item = allDueItems.find((x) => x.key === key);
                                                    if (!item) return null;
                                                    return (
                                                        <div key={key} className="flex justify-between text-sm text-slate-700 py-0.5">
                                                            <span>{item.label ?? item.monthKey}</span>
                                                            <span className="font-medium">₹{Number(item.amount).toLocaleString()}</span>
                                                        </div>
                                                    );
                                                })}
                                                <div className="flex justify-between font-bold text-slate-900 border-t border-slate-200 mt-2 pt-2 text-sm">
                                                    <span>Total</span>
                                                    <span>₹{Number(selectedTotal).toLocaleString()}</span>
                                                </div>
                                            </div>
                                        )}
                                    </>
                                )}

                                {/* ── Last Receipt ── */}
                                {lastPaid && (
                                    <div className="border-t border-slate-100 pt-4">
                                        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                                            Recent Payment
                                        </p>
                                        <button
                                            onClick={handleViewLastReceipt}
                                            className="w-full flex items-center justify-between p-3.5 bg-green-50 border border-green-200 rounded-xl hover:bg-green-100 transition-colors text-left"
                                        >
                                            <div>
                                                <p className="text-sm font-semibold text-green-800">
                                                    {lastPaid.label}
                                                </p>
                                                <p className="text-xs text-green-600 mt-0.5">
                                                    ₹{Number(lastPaid.amount).toLocaleString()} · Paid
                                                </p>
                                            </div>
                                            <span className="text-green-600 text-sm font-medium flex items-center gap-1 shrink-0">
                                                View Receipt
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                                </svg>
                                            </span>
                                        </button>
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                </div>

                {/* Footer CTA */}
                <div className="shrink-0 px-5 pb-10 pt-3 border-t border-slate-100 space-y-2 bg-white">
                    {paymentEnabled && selectedKeys.length > 0 ? (
                        <button
                            onClick={() => {
                                onInitiatePayment(selectedKeys, allDueItems);
                                onClose();
                            }}
                            className="w-full py-3.5 bg-brand text-white rounded-2xl font-bold text-sm shadow-lg shadow-brand/20 active:scale-[0.98] transition-transform"
                        >
                            Pay ₹{Number(selectedTotal).toLocaleString()} →
                        </button>
                    ) : (
                        <button
                            onClick={() => { onViewFull(); onClose(); }}
                            className="w-full py-3.5 bg-slate-100 text-slate-600 rounded-2xl font-semibold text-sm hover:bg-slate-200 transition-colors"
                        >
                            View Full Fee Details →
                        </button>
                    )}
                </div>
            </div>

            <style jsx>{`
                @keyframes feeSheetSlideUp {
                    from { transform: translateY(100%); }
                    to   { transform: translateY(0); }
                }
            `}</style>
        </div>
    );
}
