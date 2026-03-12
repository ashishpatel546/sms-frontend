"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";

export default function FeePaymentPage() {
    const params = useParams();
    const studentId = params.id;
    const [step, setStep] = useState<"form" | "processing" | "success">("form");
    const [paymentMethod, setPaymentMethod] = useState("UPI");
    const [amount, setAmount] = useState("5000");

    const mockTransactionId = `TXN${Date.now().toString().slice(-8)}`;

    const handlePay = (e: React.FormEvent) => {
        e.preventDefault();
        setStep("processing");
        setTimeout(() => setStep("success"), 2500);
    };

    return (
        <div className="max-w-md mx-auto">
            <Link href={`/parent-dashboard/student/${studentId}`} className="flex items-center gap-1.5 text-slate-400 hover:text-white text-sm mb-6 transition-colors">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                Back to Dashboard
            </Link>
            <h1 className="text-white text-2xl font-bold mb-6">Pay Fee Online</h1>

            {step === "form" && (
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
                    <div className="flex items-center gap-3 p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl mb-6">
                        <span className="text-2xl">🔒</span>
                        <div>
                            <p className="text-amber-300 text-sm font-semibold">Secure Demo Payment</p>
                            <p className="text-amber-400/70 text-xs">Online payment gateway will be integrated in the next update</p>
                        </div>
                    </div>
                    <form onSubmit={handlePay} className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-2">Amount (₹)</label>
                            <input type="number" value={amount} onChange={e => setAmount(e.target.value)} required
                                className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-2">Payment Method</label>
                            <div className="grid grid-cols-3 gap-2">
                                {["UPI", "Card", "Net Banking"].map(m => (
                                    <button key={m} type="button" onClick={() => setPaymentMethod(m)}
                                        className={`py-2.5 px-3 rounded-xl text-sm font-medium border transition-all ${paymentMethod === m ? 'border-indigo-500 bg-indigo-500/20 text-indigo-300' : 'border-slate-700 text-slate-400 hover:border-slate-600'}`}>
                                        {m === "UPI" ? "📱 " : m === "Card" ? "💳 " : "🏦 "}{m}
                                    </button>
                                ))}
                            </div>
                        </div>
                        {paymentMethod === "UPI" && (
                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-2">UPI ID</label>
                                <input type="text" placeholder="yourname@upi" className="w-full bg-slate-800 border border-slate-700 text-white placeholder-slate-500 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                            </div>
                        )}
                        {paymentMethod === "Card" && (
                            <div className="space-y-3">
                                <input placeholder="Card Number" className="w-full bg-slate-800 border border-slate-700 text-white placeholder-slate-500 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                                <div className="grid grid-cols-2 gap-3">
                                    <input placeholder="MM/YY" className="bg-slate-800 border border-slate-700 text-white placeholder-slate-500 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                                    <input placeholder="CVV" type="password" className="bg-slate-800 border border-slate-700 text-white placeholder-slate-500 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                                </div>
                            </div>
                        )}
                        <button type="submit" className="w-full py-3 bg-linear-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-semibold rounded-xl transition-all shadow-lg shadow-indigo-500/20 mt-2">
                            Pay ₹{Number(amount).toLocaleString()}
                        </button>
                    </form>
                </div>
            )}

            {step === "processing" && (
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center">
                    <div className="w-16 h-16 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-6" />
                    <p className="text-white font-semibold text-lg mb-2">Processing Payment</p>
                    <p className="text-slate-400 text-sm">Please do not close this window...</p>
                </div>
            )}

            {step === "success" && (
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 text-center">
                    <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-4">
                        <svg className="w-8 h-8 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                    </div>
                    <h2 className="text-white text-xl font-bold mb-2">Payment Successful!</h2>
                    <p className="text-slate-400 text-sm mb-6">Your fee payment has been processed.</p>
                    <div className="bg-slate-800 rounded-xl p-4 text-left mb-6 space-y-2">
                        <div className="flex justify-between text-sm"><span className="text-slate-400">Transaction ID</span><span className="text-white font-mono">{mockTransactionId}</span></div>
                        <div className="flex justify-between text-sm"><span className="text-slate-400">Amount</span><span className="text-green-400 font-semibold">₹{Number(amount).toLocaleString()}</span></div>
                        <div className="flex justify-between text-sm"><span className="text-slate-400">Method</span><span className="text-white">{paymentMethod}</span></div>
                        <div className="flex justify-between text-sm"><span className="text-slate-400">Status</span><span className="text-green-400">✅ Success</span></div>
                    </div>
                    <Link href={`/parent-dashboard/student/${studentId}`}
                        className="inline-flex items-center gap-2 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-medium transition-colors">
                        Back to Dashboard
                    </Link>
                </div>
            )}
        </div>
    );
}
