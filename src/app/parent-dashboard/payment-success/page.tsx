"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState, useEffect, Suspense } from "react";
import { API_BASE_URL } from "@/lib/api";
import { authFetch } from "@/lib/auth";

function PaymentSuccessContent() {
    const searchParams = useSearchParams();
    const orderId = searchParams.get('order_id') || searchParams.get('razorpay_order_id');
    const paymentId = searchParams.get('payment_id') || searchParams.get('razorpay_payment_id');
    const signature = searchParams.get('signature') || searchParams.get('razorpay_signature');

    const [verifying, setVerifying] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!orderId || !paymentId || !signature) {
            setError("Missing payment verification details.");
            setVerifying(false);
            return;
        }

        const verifyPayment = async () => {
            try {
                const res = await authFetch(`${API_BASE_URL}/fees/razorpay/verify`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        razorpay_order_id: orderId,
                        razorpay_payment_id: paymentId,
                        razorpay_signature: signature
                    })
                });

                if (!res.ok) {
                    const data = await res.json();
                    throw new Error(data.message || "Verification failed");
                }

                setVerifying(false);
            } catch (err: any) {
                console.error("Payment Verification Error:", err);
                setError(err.message || "Failed to verify your payment. Please contact support if the amount was deducted.");
                setVerifying(false);
            }
        };

        verifyPayment();
    }, [orderId, paymentId, signature]);

    if (verifying) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-100 to-slate-200 flex flex-col items-center justify-center p-4">
                <div className="bg-white/95 backdrop-blur-sm border border-slate-200 rounded-2xl p-8 max-w-md w-full shadow-xl text-center flex flex-col items-center justify-center">
                    <div className="w-16 h-16 border-4 border-brand border-t-transparent rounded-full animate-spin mb-6" />
                    <h2 className="text-ink text-xl font-bold mb-2">Verifying Payment...</h2>
                    <p className="text-ink-muted text-sm">Please do not close or refresh this page.</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-100 to-slate-200 flex flex-col items-center justify-center p-4">
                <div className="bg-white/95 backdrop-blur-sm border border-slate-200 rounded-2xl p-8 max-w-md w-full shadow-xl text-center">
                    <div className="w-20 h-20 bg-red-500/20 text-red-400 rounded-full flex items-center justify-center text-4xl mx-auto mb-6">
                        <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </div>
                    <h1 className="font-display text-[22px] sm:text-[26px] font-semibold tracking-[-0.02em] text-ink">Verification Failed</h1>
                    <p className="text-red-400 mb-8">{error}</p>
                    <Link href="/parent-dashboard" className="w-full inline-flex justify-center items-center py-3 px-4 bg-slate-100 hover:bg-slate-200 text-ink font-semibold rounded-xl transition-all shadow-lg">
                        Return to Dashboard
                    </Link>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-100 to-slate-200 flex flex-col items-center justify-center p-4">
            <div className="bg-white/95 backdrop-blur-sm border border-slate-200 rounded-2xl p-8 max-w-md w-full shadow-xl text-center">
                <div className="w-20 h-20 bg-emerald-500/20 text-emerald-400 rounded-full flex items-center justify-center text-4xl mx-auto mb-6">
                    <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                </div>
                <h1 className="font-display text-[22px] sm:text-[26px] font-semibold tracking-[-0.02em] text-ink">Payment Successful!</h1>
                <p className="text-ink-muted mb-8">
                    Thank you for your payment. Your transaction has been securely processed and recorded.
                </p>

                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-left mb-8 space-y-3">
                    {orderId && (
                        <div className="flex justify-between items-center text-sm">
                            <span className="text-ink-muted">Order ID:</span>
                            <span className="text-ink font-mono text-xs bg-slate-100 px-2 py-1 rounded">{orderId}</span>
                        </div>
                    )}
                    {paymentId && (
                        <div className="flex justify-between items-center text-sm">
                            <span className="text-ink-muted">Payment ID:</span>
                            <span className="text-ink font-mono text-xs bg-slate-100 px-2 py-1 rounded">{paymentId}</span>
                        </div>
                    )}
                </div>

                <Link href="/parent-dashboard" className="w-full inline-flex justify-center items-center py-3 px-4 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-xl transition-all shadow-lg shadow-emerald-500/25">
                    Return to Dashboard
                </Link>
            </div>
        </div>
    );
}

export default function PaymentSuccessPage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen bg-gradient-to-br from-slate-100 to-slate-200 flex flex-col items-center justify-center p-4">
                <div className="w-10 h-10 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
            </div>
        }>
            <PaymentSuccessContent />
        </Suspense>
    );
}
