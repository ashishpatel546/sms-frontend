"use client";

/**
 * ReceiptModal – shared across admin fee-collection and parent portal.
 *
 * Features:
 *  • Responsive: scrollable body, always-visible header + footer buttons.
 *  • Print: prints ONLY the receipt, formatted for A5 paper.
 */

import React, { useRef, useState } from "react";
import { CheckCircle2, School, CreditCard, CalendarDays, User, Hash } from "lucide-react";
import { jsPDF } from "jspdf";
import { toPng } from "html-to-image";

export interface ReceiptData {
    receiptNumber?: string;
    paymentDate?: string;
    studentName?: string;
    academicYear?: string;
    studentClass?: string;
    studentSection?: string;
    /** Months label shown on the receipt */
    monthsPaid?: string;
    /** Used as fallback for monthsPaid on parent portal */
    feeMonth?: string;
    paymentMethod?: string;
    /** Normalised component breakdown (new API) */
    components?: Array<{
        type: "FEE_CATEGORY" | "DISCOUNT" | "LATE_FEE";
        feeCategoryName?: string;
        discountName?: string;
        amount: number;
    }>;
    /** Legacy category breakdown */
    categoryBreakdown?: Array<{ name: string; amount: number }>;
    /** Legacy applied-discounts breakdown */
    appliedDiscounts?: Array<{ name: string; amount: number }>;
    /** Legacy feeBreakdown object (parent portal older payments) */
    feeBreakdown?: {
        categories?: Array<{ name: string; amount: number }>;
        discounts?: Array<{ name: string; amount: number }>;
        lateFee?: number;
    };
    /** Fallback when no category rows exist */
    feeCategory?: string;
    totalBaseFee?: number;
    totalLateFee?: number;
    baseFeeAmount?: number;
    discountAmount?: number;
    otherFeeAmount?: number;
    /** Total payable before payment (admin + parent portal) */
    totalPayable?: number | null;
    amountPaid: number;
    /** Admin portal: balance still owed after this payment */
    balanceAfterPayment?: number;
    /** Parent portal: balance remaining for partial payments */
    balanceRemaining?: number;
    excess?: number;
    adjustments?: Array<{
        type: "REFUND" | "WAIVE_OFF";
        amount: number;
        paymentMethod?: string;
        adjustedAt?: string;
        reason?: string;
        createdByName?: string;
    }>;
    collectedByName?: string;
    gatewayPaymentId?: string;
    gatewayOrderId?: string;
    remarks?: string;
    /** Admin portal: used to pass month key for collect-remaining / waive-off actions */
    monthKey?: string;
}

interface AdminExtraProps {
    /** Whether the logged-in user is an admin (for waive-off / refund actions) */
    isAdmin?: boolean;
    onCollectRemaining?: () => void;
    onWaiveOff?: () => void;
    onIssueRefund?: () => void;
}

interface ReceiptModalProps extends AdminExtraProps {
    receiptData: ReceiptData;
    onClose: () => void;
}

export default function ReceiptModal({
    receiptData,
    onClose,
    isAdmin,
    onCollectRemaining,
    onWaiveOff,
    onIssueRefund,
}: ReceiptModalProps) {
    const schoolName = process.env.NEXT_PUBLIC_SCHOOL_NAME || "EduSphere";

    const monthLabel =
        receiptData.monthsPaid || receiptData.feeMonth || "—";

    // Ref to the receipt card — used by handlePrint to grab exact HTML without
    // risk of querySelector matching another .receipt-print-area on the page.
    const receiptRef = useRef<HTMLDivElement>(null);
    const [isDownloading, setIsDownloading] = useState(false);
    const [isPrinting, setIsPrinting] = useState(false);

    // ── Print handler (A5)
    // Uses html-to-image to capture the receipt as a PNG, then injects a single
    // <img> into a print container and calls window.print().
    //
    // Why image-based instead of HTML injection?
    // The previous HTML-injection approach relied on @media print CSS to hide
    // siblings and let the receipt flow across pages. This is fragile on mobile
    // PWA (Android/iOS standalone mode): the browser computes print page count
    // from the live DOM height BEFORE the @media print rules are applied, which
    // causes the receipt to repeat on every generated page (duplication bug).
    //
    // Injecting a single <img> instead means:
    //   • One element → browser always produces exactly one page
    //   • No CSS color/class parsing — just a flat image
    //   • Works identically on desktop Chrome, Android PWA, and iOS standalone
    const handlePrint = async () => {
        if (!receiptRef.current) return;
        setIsPrinting(true);

        const element = receiptRef.current;
        const originalMaxHeight = element.style.maxHeight;
        element.style.maxHeight = 'none';

        const scrollBody = element.querySelector('.receipt-scroll-body') as HTMLElement;
        const sbOriginalMaxHeight = scrollBody ? scrollBody.style.maxHeight : '';
        const sbOriginalOverflow = scrollBody ? scrollBody.style.overflow : '';
        if (scrollBody) {
            scrollBody.style.maxHeight = 'none';
            scrollBody.style.overflow = 'visible';
        }

        try {
            const imgData = await toPng(element, {
                pixelRatio: 2,
                filter: (node: Node) => {
                    const el = node as HTMLElement;
                    if (!el.classList) return true;
                    return (
                        !el.classList.contains('no-print') &&
                        !el.hasAttribute('data-html2canvas-ignore')
                    );
                },
            });

            // Restore constraints before opening print dialog
            element.style.maxHeight = originalMaxHeight;
            if (scrollBody) {
                scrollBody.style.maxHeight = sbOriginalMaxHeight;
                scrollBody.style.overflow = sbOriginalOverflow;
            }

            // Inject a single <img> — one element = exactly one print page,
            // no page-count computation issues on mobile.
            // The container is locked to the exact A5 page dimensions and
            // object-fit:contain scales the image to fit — so regardless of
            // the receipt's aspect ratio it always renders on a single page.
            const printContainer = document.createElement('div');
            printContainer.id = '__receipt-print-root__';
            printContainer.innerHTML = `<img src="${imgData}" style="display:block;width:148mm;height:210mm;object-fit:contain;object-position:top center;" />`;
            document.body.appendChild(printContainer);

            const printStyle = document.createElement('style');
            printStyle.id = '__receipt-print-style__';
            printStyle.textContent = `
@media print {
  @page { size: A5 portrait; margin: 0; }
  html, body {
    margin: 0 !important; padding: 0 !important; background: white !important;
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
  }
  body > *:not(#__receipt-print-root__) { display: none !important; }
  #__receipt-print-root__ {
    display: block !important;
    width: 148mm !important;
    height: 210mm !important;
    overflow: hidden !important;
    page-break-after: avoid !important;
    break-after: avoid !important;
  }
  #__receipt-print-root__ img {
    display: block !important;
    width: 148mm !important;
    height: 210mm !important;
    object-fit: contain !important;
    object-position: top center !important;
    page-break-inside: avoid !important;
    break-inside: avoid !important;
  }
}`;
            document.head.appendChild(printStyle);

            setTimeout(() => {
                setIsPrinting(false);
                window.print();
                setTimeout(() => {
                    document.getElementById('__receipt-print-root__') && document.body.removeChild(printContainer);
                    document.getElementById('__receipt-print-style__') && document.head.removeChild(printStyle);
                }, 1500);
            }, 150);

        } catch {
            element.style.maxHeight = originalMaxHeight;
            if (scrollBody) {
                scrollBody.style.maxHeight = sbOriginalMaxHeight;
                scrollBody.style.overflow = sbOriginalOverflow;
            }
            setIsPrinting(false);
        }
    };

    // ── PDF Download handler (A4, uses html-to-image + jsPDF)
    // html-to-image renders via SVG foreignObject so the browser handles ALL
    // CSS natively — including modern color functions like oklch()/lab() used
    // by Tailwind v4, which legacy html2canvas cannot parse.
    const handleDownloadPDF = async () => {
        if (!receiptRef.current) return;
        setIsDownloading(true);

        const element = receiptRef.current;
        const originalMaxHeight = element.style.maxHeight;
        element.style.maxHeight = 'none';

        const scrollBody = element.querySelector('.receipt-scroll-body') as HTMLElement;
        const sbOriginalMaxHeight = scrollBody ? scrollBody.style.maxHeight : '';
        const sbOriginalOverflow = scrollBody ? scrollBody.style.overflow : '';
        if (scrollBody) {
            scrollBody.style.maxHeight = 'none';
            scrollBody.style.overflow = 'visible';
        }

        try {
            const imgData = await toPng(element, {
                pixelRatio: 2,
                filter: (node: Node) => {
                    const el = node as HTMLElement;
                    if (!el.classList) return true;
                    return (
                        !el.classList.contains('no-print') &&
                        !el.hasAttribute('data-html2canvas-ignore')
                    );
                },
            });

            // Measure the rendered image dimensions to compute mmHeight
            const img = new Image();
            await new Promise<void>((resolve) => { img.onload = () => resolve(); img.src = imgData; });

            const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a5' });
            // Available area with 8mm margins on all sides (A5 = 148×210mm)
            const margin = 8;
            const availW = 148 - margin * 2;
            const availH = 210 - margin * 2;
            const imgRatio = img.naturalHeight / img.naturalWidth;
            const availRatio = availH / availW;

            // Scale to fit entirely within the page, maintaining aspect ratio
            let fitW: number, fitH: number;
            if (imgRatio > availRatio) {
                fitH = availH;
                fitW = availH / imgRatio;
            } else {
                fitW = availW;
                fitH = availW * imgRatio;
            }
            const x = margin + (availW - fitW) / 2;
            pdf.addImage(imgData, 'PNG', x, margin, fitW, fitH);

            pdf.save(`receipt-${receiptData.receiptNumber || 'download'}.pdf`);
        } finally {
            element.style.maxHeight = originalMaxHeight;
            if (scrollBody) {
                scrollBody.style.maxHeight = sbOriginalMaxHeight;
                scrollBody.style.overflow = sbOriginalOverflow;
            }
            setIsDownloading(false);
        }
    };


    // ── Compute late fee from normalised components or legacy fields
    const lateFeeComp = receiptData.components?.find(
        (c) => c.type === "LATE_FEE"
    );
    const lateFeeAmt = lateFeeComp
        ? Number(lateFeeComp.amount)
        : Number(
              receiptData.totalLateFee ??
                  receiptData.otherFeeAmount ??
                  receiptData.feeBreakdown?.lateFee ??
                  0
          );

    // ── Category rows
    const feeCategories =
        (receiptData.components?.filter((c) => c.type === "FEE_CATEGORY") ?? []).length > 0
            ? receiptData.components!
                  .filter((c) => c.type === "FEE_CATEGORY")
                  .map((c, i) => (
                      <tr key={`cat-${i}`} className="border-b border-gray-100">
                          <td className="py-2 pl-4 pr-2">{c.feeCategoryName}</td>
                          <td className="py-2 text-right whitespace-nowrap">
                              ₹{Number(c.amount).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                          </td>
                      </tr>
                  ))
            : receiptData.categoryBreakdown && receiptData.categoryBreakdown.length > 0
            ? receiptData.categoryBreakdown.map((c, i) => (
                  <tr key={`cat-${i}`} className="border-b border-gray-100">
                      <td className="py-2 pl-4 pr-2">{c.name}</td>
                      <td className="py-2 text-right whitespace-nowrap">
                          ₹{Number(c.amount).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                      </td>
                  </tr>
              ))
            : receiptData.feeBreakdown?.categories && receiptData.feeBreakdown.categories.length > 0
            ? receiptData.feeBreakdown.categories.map((c, i) => (
                  <tr key={`cat-${i}`} className="border-b border-gray-100">
                      <td className="py-2 pl-4 pr-2">{c.name}</td>
                      <td className="py-2 text-right whitespace-nowrap">
                          ₹{Number(c.amount).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                      </td>
                  </tr>
              ))
            : (receiptData.baseFeeAmount ?? receiptData.totalBaseFee ?? 0) > 0
            ? [
                  <tr key="base" className="border-b border-gray-100">
                      <td className="py-2 pl-4 pr-2">
                          Base Tuition
                          {receiptData.feeCategory ? ` / ${receiptData.feeCategory} Fee` : ""}
                      </td>
                      <td className="py-2 text-right whitespace-nowrap">
                          ₹{Number(
                              receiptData.baseFeeAmount ?? receiptData.totalBaseFee
                          ).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                      </td>
                  </tr>,
              ]
            : [];

    // ── Discount rows
    const discountRows =
        (receiptData.components?.filter((c) => c.type === "DISCOUNT") ?? []).length > 0
            ? receiptData.components!
                  .filter((c) => c.type === "DISCOUNT")
                  .map((c, i) => (
                      <tr key={`disc-${i}`} className="border-b border-gray-100 text-green-600">
                          <td className="py-2 pl-4 pr-2">Discount ({c.discountName})</td>
                          <td className="py-2 text-right whitespace-nowrap">
                              -₹{Number(c.amount).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                          </td>
                      </tr>
                  ))
            : receiptData.appliedDiscounts && receiptData.appliedDiscounts.length > 0
            ? receiptData.appliedDiscounts.map((d, i) => (
                  <tr key={`disc-${i}`} className="border-b border-gray-100 text-green-600">
                      <td className="py-2 pl-4 pr-2">Discount ({d.name})</td>
                      <td className="py-2 text-right whitespace-nowrap">
                          -₹{Number(d.amount).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                      </td>
                  </tr>
              ))
            : receiptData.feeBreakdown?.discounts && receiptData.feeBreakdown.discounts.length > 0
            ? receiptData.feeBreakdown.discounts.map((d, i) => (
                  <tr key={`disc-${i}`} className="border-b border-gray-100 text-green-600">
                      <td className="py-2 pl-4 pr-2">Discount ({d.name})</td>
                      <td className="py-2 text-right whitespace-nowrap">
                          -₹{Number(d.amount).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                      </td>
                  </tr>
              ))
            : !receiptData.feeBreakdown?.discounts &&
              (receiptData.discountAmount ?? 0) > 0
            ? [
                  <tr key="disc-legacy" className="border-b border-gray-100 text-green-600">
                      <td className="py-2 pl-4 pr-2">Discount</td>
                      <td className="py-2 text-right whitespace-nowrap">
                          -₹{Number(receiptData.discountAmount).toLocaleString("en-IN", {
                              minimumFractionDigits: 2,
                          })}
                      </td>
                  </tr>,
              ]
            : [];

    const balanceDue =
        receiptData.balanceAfterPayment ?? receiptData.balanceRemaining ?? 0;

    return (
        <>
            {/* ── Print styles (Removed since we do direct PDF generation) ── */}

            {/* ── Backdrop ── */}
            {/*
             * NOTE: no `no-print` class on this div intentionally.
             * When printing, the receipt HTML is captured and injected into a separate
             * #__receipt-print-root__ node directly in <body>. The backdrop (and everything
             * else on the page) is hidden via `body > *:not(#__receipt-print-root__){ display:none }`,
             * so the backdrop/modal are simply not in the print render path at all.
             */}
            <div
                className="fixed inset-0 z-200 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm"
                onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
            >
                {/*
                 * ── Modal card ───────────────────────────────────────────────
                 * The receipt acts as the canvas for the PDF.
                 * overflow-hidden keeps the backgrounds locked in.
                 */}
                <div ref={receiptRef} className="receipt-print-area bg-white rounded-2xl shadow-2xl w-full max-w-md flex flex-col relative overflow-hidden"
                    style={{ maxHeight: "92vh" }}>
                    
                    {/* Optional: 'PAID' Watermark effect visible in the background */}
                    <div className="absolute inset-0 z-0 flex items-center justify-center pointer-events-none opacity-[0.03] rotate-[-30deg]">
                        <span className="text-[120px] font-black tracking-widest text-emerald-600">PAID</span>
                    </div>

                    {/* ── Premium Header ── */}
                    <div className="relative z-10 shrink-0 bg-slate-900 border-b-4 border-emerald-500 px-6 py-6 text-center print:rounded-none overflow-hidden">
                        {/* Subtle background pattern */}
                        <div className="absolute inset-0 opacity-10 bg-[radial-gradient(circle_at_center,var(--tw-gradient-stops))] from-white to-transparent" />
                        
                        <div className="relative z-10 flex flex-col items-center justify-center">
                            <div className="bg-white/10 p-2 rounded-full mb-3 inline-flex">
                                <School className="w-6 h-6 text-emerald-400" />
                            </div>
                            <h2 className="text-white font-black text-xl tracking-wide">
                                {schoolName}
                            </h2>
                            <p className="text-slate-300 text-xs mt-1 uppercase tracking-widest font-medium">Official Fee Receipt</p>
                        </div>
                    </div>

                    {/* ── Scrollable body ── */}
                    <div className="receipt-scroll-body relative z-10 flex-1 overflow-y-auto px-6 py-6 bg-slate-50">

                        {/* Beautiful Meta Info Cards */}
                        <div className="grid grid-cols-2 gap-4 text-sm mb-6">
                            <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm flex items-start gap-3">
                                <div className="p-1.5 bg-slate-100 rounded-lg text-slate-500">
                                    <Hash className="w-4 h-4" />
                                </div>
                                <div>
                                    <p className="text-slate-400 text-[10px] uppercase font-bold tracking-wider mb-0.5">Receipt No.</p>
                                    <p className="font-bold font-mono text-slate-800 break-all text-sm leading-tight">
                                        {receiptData.receiptNumber || "—"}
                                    </p>
                                </div>
                            </div>

                            <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm flex items-start justify-end gap-3 text-right pr-6">
                                <div>
                                    <p className="text-slate-400 text-[10px] uppercase font-bold tracking-wider mb-0.5 mt-0.5">Date</p>
                                    <p className="font-semibold text-slate-800 text-sm leading-tight">
                                        {receiptData.paymentDate
                                            ? new Date(receiptData.paymentDate).toLocaleDateString("en-IN", {
                                                  day: "2-digit",
                                                  month: "short",
                                                  year: "numeric",
                                              })
                                            : "—"}
                                    </p>
                                </div>
                                <div className="p-1.5 bg-emerald-50 rounded-lg text-emerald-600 shadow-sm">
                                    <CalendarDays className="w-4 h-4" />
                                </div>
                            </div>

                            {receiptData.studentName && (
                                <div className="col-span-2 bg-white p-3 rounded-xl border border-slate-200 shadow-sm flex items-start gap-3">
                                    <div className="p-1.5 bg-blue-50 rounded-lg text-blue-600">
                                        <User className="w-4 h-4" />
                                    </div>
                                    <div className="flex-1">
                                        <p className="text-slate-400 text-[10px] uppercase font-bold tracking-wider mb-0.5">Student Details</p>
                                        <div className="flex justify-between items-end">
                                            <p className="font-bold text-slate-800 text-base">{receiptData.studentName}</p>
                                            <p className="font-medium text-slate-500 text-xs">
                                                {[receiptData.studentClass, receiptData.studentSection].filter(Boolean).join(" – ")}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            )}

                            <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm col-span-2 flex justify-between items-center">
                                <div>
                                    <p className="text-slate-400 text-[10px] uppercase font-bold tracking-wider mb-0.5">Fee Month(s)</p>
                                    <p className="font-semibold text-slate-800 text-sm">{monthLabel}</p>
                                </div>
                                {receiptData.paymentMethod && (
                                    <div className="text-right">
                                        <p className="text-slate-400 text-[10px] uppercase font-bold tracking-wider mb-0.5">Payment Method</p>
                                        <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-slate-100 border border-slate-200 text-slate-700 text-xs font-medium">
                                            <CreditCard className="w-3 h-3" />
                                            {receiptData.paymentMethod}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Breakdown table — Redesigned as a modern card */}
                        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden mb-6">
                            <table className="w-full text-sm text-left">
                                <thead className="bg-slate-50 border-b border-slate-200">
                                    <tr>
                                        <th className="py-2.5 px-4 text-slate-500 font-bold text-xs uppercase tracking-wider">Description</th>
                                        <th className="py-2.5 px-4 text-right text-slate-500 font-bold text-xs uppercase tracking-wider">Amount</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {feeCategories}
                                    {discountRows}

                                {/* Late Fee */}
                                {lateFeeAmt > 0 && (
                                    <tr className="border-b border-gray-100 text-red-600">
                                        <td className="py-2 pl-4 pr-2">Late Fee</td>
                                        <td className="py-2 text-right whitespace-nowrap">
                                            +₹{lateFeeAmt.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                                        </td>
                                    </tr>
                                )}

                                {/* Total Payable */}
                                {receiptData.totalPayable != null && (
                                    <tr className="border-b border-gray-200 text-gray-600">
                                        <td className="py-2 pl-4 pr-2 text-sm">Total Payable</td>
                                        <td className="py-2 text-right text-sm whitespace-nowrap">
                                            ₹{Number(receiptData.totalPayable).toLocaleString("en-IN", {
                                                minimumFractionDigits: 2,
                                            })}
                                        </td>
                                    </tr>
                                )}

                                {/* Total Paid — Emphasized */}
                                <tr className="bg-emerald-50 border-t-2 border-slate-200">
                                    <td className="py-3.5 px-4 font-bold text-slate-800 flex items-center gap-2">
                                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                                        Total Paid
                                    </td>
                                    <td className="py-3.5 px-4 text-right font-bold text-emerald-700 text-base whitespace-nowrap">
                                        ₹{Number(receiptData.amountPaid).toLocaleString("en-IN", {
                                            minimumFractionDigits: 2,
                                        })}
                                    </td>
                                </tr>

                                {/* Refund adjustments */}
                                {(receiptData.adjustments ?? [])
                                    .filter((a) => a.type === "REFUND")
                                    .map((a, i) => (
                                        <tr key={`ref-${i}`} className="border-b border-orange-50 text-orange-600">
                                            <td className="py-2 pl-4 pr-2 text-sm">
                                                Refund ({a.paymentMethod || "—"})
                                                {a.adjustedAt && (
                                                    <span className="ml-1 text-xs text-gray-400">
                                                        {new Date(a.adjustedAt).toLocaleDateString("en-IN", {
                                                            day: "2-digit",
                                                            month: "short",
                                                            year: "numeric",
                                                        })}
                                                    </span>
                                                )}
                                                {a.reason && (
                                                    <span className="block text-xs text-gray-400">{a.reason}</span>
                                                )}
                                                {a.createdByName && (
                                                    <span className="block text-xs text-gray-400">
                                                        Refunded by: {a.createdByName}
                                                    </span>
                                                )}
                                            </td>
                                            <td className="py-2 text-right text-sm whitespace-nowrap">
                                                -₹{Number(a.amount).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                                            </td>
                                        </tr>
                                    ))}

                                {/* Waive-off adjustments */}
                                {(receiptData.adjustments ?? [])
                                    .filter((a) => a.type === "WAIVE_OFF")
                                    .map((a, i) => (
                                        <tr key={`waive-${i}`} className="border-b border-purple-50 text-purple-600">
                                            <td className="py-2 pl-4 pr-2 text-sm">
                                                Fee Waived Off
                                                {a.adjustedAt && (
                                                    <span className="ml-1 text-xs text-gray-400">
                                                        {new Date(a.adjustedAt).toLocaleDateString("en-IN", {
                                                            day: "2-digit",
                                                            month: "short",
                                                            year: "numeric",
                                                        })}
                                                    </span>
                                                )}
                                                {a.reason && (
                                                    <span className="block text-xs text-gray-400">{a.reason}</span>
                                                )}
                                                {a.createdByName && (
                                                    <span className="block text-xs text-gray-400">
                                                        Waived by: {a.createdByName}
                                                    </span>
                                                )}
                                            </td>
                                            <td className="py-2 text-right text-sm whitespace-nowrap">
                                                -₹{Number(a.amount).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                                            </td>
                                        </tr>
                                    ))}

                                {/* Excess balance */}
                                {(receiptData.excess ?? 0) > 0 && (
                                    <tr className="text-green-700 border-b border-green-100">
                                        <td className="py-2 pl-4 pr-2 text-sm font-medium">Excess Balance</td>
                                        <td className="py-2 text-right text-sm font-medium whitespace-nowrap">
                                            ₹{Number(receiptData.excess).toLocaleString("en-IN", {
                                                minimumFractionDigits: 2,
                                            })}
                                        </td>
                                    </tr>
                                )}

                                {/* Balance remaining */}
                                {balanceDue > 0 && (
                                    <tr className="text-red-600 border-t border-red-100">
                                        <td className="py-2 pl-4 pr-2 text-sm font-medium">Balance Remaining</td>
                                        <td className="py-2 text-right text-sm font-medium whitespace-nowrap">
                                            ₹{Number(balanceDue).toLocaleString("en-IN", {
                                                minimumFractionDigits: 2,
                                            })}
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                        </div>

                        {/* Collected / gateway info */}
                        {receiptData.collectedByName ? (
                            <div className="text-xs text-slate-500 flex justify-between border-t border-slate-200 pt-3 mt-4">
                                <span>Collected by:</span>
                                <span className="font-medium text-slate-800">{receiptData.collectedByName}</span>
                            </div>
                        ) : receiptData.gatewayPaymentId ? (
                            <div className="text-xs text-slate-500 flex justify-between border-t border-slate-200 pt-3 mt-4">
                                <span>Processed via:</span>
                                <span className="font-medium text-slate-800">Razorpay</span>
                            </div>
                        ) : null}

                        {receiptData.gatewayPaymentId && (
                            <div className="mt-2 border border-blue-100 bg-blue-50 rounded-lg px-3 py-2 text-xs">
                                <p className="text-gray-500 mb-0.5">Gateway Transaction ID</p>
                                <div className="flex items-center gap-2 justify-between">
                                    <span className="font-mono text-blue-700 break-all">
                                        {receiptData.gatewayPaymentId}
                                    </span>
                                    <button
                                        onClick={() =>
                                            navigator.clipboard.writeText(receiptData.gatewayPaymentId!)
                                        }
                                        className="no-print text-gray-400 hover:text-blue-600 shrink-0"
                                        title="Copy"
                                    >
                                        ⧉
                                    </button>
                                </div>
                                {receiptData.gatewayOrderId && (
                                    <p className="text-gray-400 mt-1 font-mono break-all">
                                        Order: {receiptData.gatewayOrderId}
                                    </p>
                                )}
                            </div>
                        )}

                        {receiptData.remarks && (
                            <p className="mt-3 text-xs text-gray-500">Remarks: {receiptData.remarks}</p>
                        )}

                        {/* Authorized signature line / Digital generation notice */}
                        <div className="mt-6 pt-4 border-t border-slate-200 text-xs text-slate-500 flex justify-between items-center">
                            {isAdmin ? (
                                <div className="text-center">
                                    <div className="w-32 border-b border-slate-400 mb-1 h-6"></div>
                                    <span className="font-medium">Authorized Signature</span>
                                </div>
                            ) : (
                                <span className="italic bg-blue-50 text-blue-700 px-3 py-1.5 rounded-lg border border-blue-100">
                                    This is a digitally generated receipt and does not require a signature.
                                </span>
                            )}
                            <span className="font-medium text-slate-400 uppercase tracking-widest text-[10px]">Thank You</span>
                        </div>
                    </div>

                    {/* ── Pinned footer – action buttons always visible ── */}
                    {/* data-html2canvas-ignore="true" ensures buttons aren't captured in the PDF */}
                    <div data-html2canvas-ignore="true" className="no-print shrink-0 px-6 pb-5 pt-3 border-t border-gray-100 flex flex-wrap gap-2 justify-end rounded-b-2xl bg-white">
                        <button
                            onClick={onClose}
                            className="px-4 py-2 border border-gray-300 rounded-xl text-gray-700 hover:bg-gray-50 transition-colors text-sm"
                        >
                            Close
                        </button>

                        {/* Admin-only: Collect Remaining */}
                        {onCollectRemaining && (receiptData.balanceAfterPayment ?? 0) > 0 && (
                            <button
                                onClick={onCollectRemaining}
                                className="px-4 py-2 bg-blue-100 text-blue-700 border border-blue-200 rounded-xl hover:bg-blue-200 transition-colors text-sm"
                            >
                                Collect Remaining ₹{Number(receiptData.balanceAfterPayment).toFixed(2)}
                            </button>
                        )}

                        {/* Admin-only: Waive Off */}
                        {isAdmin && onWaiveOff && (receiptData.balanceAfterPayment ?? 0) > 0 && (
                            <button
                                onClick={onWaiveOff}
                                className="px-4 py-2 bg-purple-100 text-purple-700 border border-purple-200 rounded-xl hover:bg-purple-200 transition-colors text-sm"
                            >
                                Waive Off Remaining
                            </button>
                        )}

                        {/* Admin-only: Issue Refund */}
                        {isAdmin && onIssueRefund && (receiptData.excess ?? 0) > 0 && (
                            <button
                                onClick={onIssueRefund}
                                className="px-4 py-2 bg-orange-100 text-orange-700 border border-orange-200 rounded-xl hover:bg-orange-200 transition-colors text-sm"
                            >
                                Issue Refund (₹{Number(receiptData.excess).toFixed(2)} excess)
                            </button>
                        )}

                        <button
                            onClick={handleDownloadPDF}
                            disabled={isDownloading}
                            className="px-4 py-2 rounded-xl transition-colors text-sm flex items-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
                            style={{ backgroundColor: '#047857', color: '#ffffff' }}
                        >
                            {isDownloading ? (
                                <>
                                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                                    </svg>
                                    Generating…
                                </>
                            ) : (
                                <>
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                    </svg>
                                    Download PDF
                                </>
                            )}
                        </button>

                        <button
                            onClick={handlePrint}
                            disabled={isPrinting}
                            className="px-4 py-2 rounded-xl transition-colors text-sm flex items-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
                            style={{ backgroundColor: '#1e293b', color: '#ffffff' }}
                        >
                            {isPrinting ? (
                                <>
                                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                                    </svg>
                                    Preparing…
                                </>
                            ) : (
                                <>
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                                    </svg>
                                    Print Receipt
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </>
    );
}
