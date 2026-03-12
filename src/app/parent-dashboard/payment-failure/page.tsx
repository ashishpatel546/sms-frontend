"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

function PaymentFailureContent() {
    const searchParams = useSearchParams();
    const orderId = searchParams.get('order_id') || searchParams.get('razorpay_order_id');
    const errorMsg = searchParams.get('error') || "The transaction could not be completed securely. Please try again or use another payment method.";

    return (
        <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 max-w-md w-full shadow-2xl text-center">
                <div className="w-20 h-20 bg-red-500/20 text-red-500 rounded-full flex items-center justify-center text-4xl mx-auto mb-6">
                    <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </div>
                <h1 className="text-white text-3xl font-bold mb-2">Payment Failed</h1>
                <p className="text-slate-400 mb-8">
                    {errorMsg}
                </p>

                {orderId && (
                    <div className="bg-slate-800/50 rounded-xl p-4 text-left mb-8">
                        <div className="flex justify-between items-center text-sm">
                            <span className="text-slate-500">Failed Order ID:</span>
                            <span className="text-slate-300 font-mono text-xs bg-slate-800 px-2 py-1 rounded">{orderId}</span>
                        </div>
                    </div>
                )}

                <div className="flex gap-3">
                    <Link href="/parent-dashboard" className="flex-1 inline-flex justify-center items-center py-3 px-4 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white font-semibold rounded-xl transition-all">
                        Cancel
                    </Link>
                    <button onClick={() => window.history.back()} className="flex-1 inline-flex justify-center items-center py-3 px-4 bg-red-600 hover:bg-red-500 text-white font-semibold rounded-xl transition-all shadow-lg shadow-red-500/25">
                        Try Again
                    </button>
                </div>
            </div>
        </div>
    );
}

export default function PaymentFailurePage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4">
                <div className="w-10 h-10 border-2 border-red-500 border-t-transparent rounded-full animate-spin" />
            </div>
        }>
            <PaymentFailureContent />
        </Suspense>
    );
}
