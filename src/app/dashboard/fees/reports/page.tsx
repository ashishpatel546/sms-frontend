"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import useSWR from "swr";
import { fetcher } from "@/lib/api";
import { Loader } from "@/components/ui/Loader";

export default function FeeReportsDashboard() {
    const [academicYear, setAcademicYear] = useState("2026-2027");

    const { data: report, error, isLoading: loading } = useSWR(
        `/fees/reports/dashboard?academicYear=${academicYear}`,
        fetcher
    );

    if (loading) {
        return (
            <Loader fullScreen={true} />
        );
    }

    if (error || !report) {
        return (
            <div className="p-6 text-center text-red-500">
                <p>Could not load report data</p>
                <button onClick={() => window.location.reload()} className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">Retry</button>
            </div>
        );
    }

    return (
        <main className="p-4 flex-1 h-full overflow-y-auto w-full max-w-7xl mx-auto printable-area">
            <style dangerouslySetInnerHTML={{
                __html: `
                @media print {
                    body * { visibility: hidden; }
                    .printable-area, .printable-area * { visibility: visible; }
                    .printable-area { position: absolute; left: 0; top: 0; width: 100%; margin: 0; padding: 20px; box-shadow: none !important; }
                    .no-print { display: none !important; }
                    html, body, main { height: auto !important; min-height: auto !important; overflow: visible !important; background: white !important; }
                }
            `}} />

            <div className="flex justify-between items-center mb-6">
                <div>
                    <div className="flex items-center gap-3 mb-2 no-print">
                        <Link href="/dashboard/fees" className="text-sm font-medium text-blue-600 hover:underline">← Back to Fees Management</Link>
                    </div>
                    <h1 className="text-3xl font-bold text-slate-800">Fee Intelligence Dashboard</h1>
                    <p className="text-gray-500">Comprehensive overview of school financials</p>
                </div>
                <div className="flex gap-4 items-center no-print">
                    <select
                        value={academicYear}
                        onChange={(e) => setAcademicYear(e.target.value)}
                        className="bg-white border border-gray-300 text-sm rounded-lg p-2.5 shadow-sm focus:ring-blue-500 focus:border-blue-500"
                    >
                        <option value="2025-2026">2025-2026</option>
                        <option value="2026-2027">2026-2027</option>
                        <option value="2027-2028">2027-2028</option>
                    </select>
                    <button onClick={() => window.print()} className="px-4 py-2.5 bg-slate-800 text-white rounded-lg hover:bg-slate-700 transition-colors shadow-sm flex items-center gap-2">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"></path></svg>
                        Print Report
                    </button>
                </div>
            </div>

            {/* Top Stat Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                {/* Total Expected */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                    <div className="flex justify-between items-start mb-4">
                        <div>
                            <p className="text-sm font-medium text-gray-500">Total Expected</p>
                            <h3 className="text-2xl font-bold text-slate-800 mt-1">₹{(report.totalExpected || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</h3>
                        </div>
                        <div className="p-3 bg-blue-50 rounded-lg text-blue-600">
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                        </div>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2 mb-1">
                        <div className="bg-blue-600 h-2 rounded-full" style={{ width: '100%' }}></div>
                    </div>
                    <p className="text-xs text-gray-500">For academic year {academicYear}</p>
                </div>

                {/* Total Collected */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                    <div className="flex justify-between items-start mb-4">
                        <div>
                            <p className="text-sm font-medium text-gray-500">Total Collected</p>
                            <h3 className="text-2xl font-bold text-green-600 mt-1">₹{(report.totalCollected || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</h3>
                        </div>
                        <div className="p-3 bg-green-50 rounded-lg text-green-600">
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                        </div>
                    </div>
                    {(() => {
                        const pct = report.totalExpected > 0 ? (report.totalCollected / report.totalExpected) * 100 : 0;
                        return (
                            <>
                                <div className="w-full bg-gray-200 rounded-full h-2 mb-1">
                                    <div className="bg-green-500 h-2 rounded-full" style={{ width: `${Math.min(pct, 100)}%` }}></div>
                                </div>
                                <p className="text-xs text-gray-500">{pct.toFixed(1)}% of expected revenue</p>
                            </>
                        );
                    })()}
                </div>

                {/* Total Overdue */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                    <div className="flex justify-between items-start mb-4">
                        <div>
                            <p className="text-sm font-medium text-gray-500">Total Overdue</p>
                            <h3 className="text-2xl font-bold text-red-600 mt-1">₹{(report.totalOverdue || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</h3>
                        </div>
                        <div className="p-3 bg-red-50 rounded-lg text-red-600">
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                        </div>
                    </div>
                    {(() => {
                        const pct = report.totalExpected > 0 ? (report.totalOverdue / report.totalExpected) * 100 : 0;
                        return (
                            <>
                                <div className="w-full bg-gray-200 rounded-full h-2 mb-1">
                                    <div className="bg-red-500 h-2 rounded-full" style={{ width: `${Math.min(pct, 100)}%` }}></div>
                                </div>
                                <p className="text-xs text-gray-500">{pct.toFixed(1)}% of expected revenue</p>
                            </>
                        );
                    })()}
                </div>

                {/* Discounts & Late Fees */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                    <div className="flex justify-between items-start mb-4">
                        <div>
                            <p className="text-sm font-medium text-gray-500">Discounts vs Late Fees</p>
                            <div className="mt-1 flex items-baseline gap-2">
                                <h3 className="text-2xl font-bold text-purple-600">-₹{(report.totalDiscount || 0).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</h3>
                                <span className="text-sm text-gray-500">/ +₹{(report.totalLateFee || 0).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</span>
                            </div>
                        </div>
                        <div className="p-3 bg-purple-50 rounded-lg text-purple-600">
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3"></path></svg>
                        </div>
                    </div>
                    <p className="text-xs text-gray-500 pt-3 border-t border-gray-100">Discounts waived vs Late fees applied</p>
                </div>
            </div >

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
                {/* Current Month Snapshot */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 lg:col-span-1">
                    <h2 className="text-lg font-bold text-slate-800 mb-6">Current Month: {report.currentMonth.monthKey}</h2>

                    <div className="relative w-48 h-48 mx-auto mb-6 flex items-center justify-center">
                        <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                            <path
                                className="text-gray-200"
                                strokeDasharray="100, 100"
                                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                                fill="none" stroke="currentColor" strokeWidth="3"
                            />
                            <path
                                className="text-blue-600"
                                strokeDasharray={`${report.currentMonth.collectionRate}, 100`}
                                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                                fill="none" stroke="currentColor" strokeWidth="3"
                            />
                        </svg>
                        <div className="absolute flex flex-col items-center justify-center text-center">
                            <span className="text-3xl font-bold text-slate-800">{report.currentMonth.collectionRate.toFixed(0)}%</span>
                            <span className="text-xs text-gray-500 uppercase tracking-wider font-semibold">Collected</span>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                            <span className="text-sm font-medium text-gray-600">Expected</span>
                            <span className="font-bold text-slate-800">₹{(report.currentMonth?.expected || 0).toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between items-center p-3 bg-blue-50 rounded-lg border border-blue-100">
                            <span className="text-sm font-medium text-blue-800">Collected</span>
                            <span className="font-bold text-blue-800">₹{(report.currentMonth?.collected || 0).toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between items-center p-3 bg-red-50 rounded-lg border border-red-100">
                            <span className="text-sm font-medium text-red-800">Deficit</span>
                            <span className="font-bold text-red-800">₹{((report.currentMonth?.expected || 0) - (report.currentMonth?.collected || 0)).toLocaleString()}</span>
                        </div>
                    </div>
                </div>

                {/* Recent Transactions */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 lg:col-span-2">
                    <div className="flex justify-between items-center mb-6">
                        <h2 className="text-lg font-bold text-slate-800">Recent Transactions</h2>
                        <span className="text-sm text-gray-500">Last 20 payments</span>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="text-xs text-gray-500 uppercase bg-gray-50 border-b border-gray-200">
                                <tr>
                                    <th className="px-4 py-3 rounded-tl-lg">Receipt No</th>
                                    <th className="px-4 py-3">Student</th>
                                    <th className="px-4 py-3">Months Paid</th>
                                    <th className="px-4 py-3 text-center">Method</th>
                                    <th className="px-4 py-3 text-right">Date</th>
                                    <th className="px-4 py-3 text-right rounded-tr-lg">Amount</th>
                                </tr>
                            </thead>
                            <tbody>
                                {report.recentTransactions.map((tx: any) => (
                                    <tr key={tx.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                                        <td className="px-4 py-3 font-medium text-blue-600">{tx.receiptNumber}</td>
                                        <td className="px-4 py-3 font-medium text-slate-800">{tx.student ? `${tx.student.firstName} ${tx.student.lastName}` : 'Unknown'}</td>
                                        <td className="px-4 py-3 text-gray-600" title={tx.feeMonth}>
                                            {tx.feeMonth.split(',').length > 1 ? `${tx.feeMonth.split(',').length} Months` : tx.feeMonth}
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            <span className="px-2 py-1 text-[10px] font-bold uppercase rounded bg-gray-100 text-gray-600 border border-gray-200">
                                                {tx.paymentMethod}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-right text-gray-500">{new Date(tx.paymentDate).toLocaleDateString()}</td>
                                        <td className="px-4 py-3 text-right font-bold text-slate-800">₹{Number(tx.amountPaid).toFixed(2)}</td>
                                    </tr>
                                ))}
                                {report.recentTransactions.length === 0 && (
                                    <tr>
                                        <td colSpan={6} className="px-4 py-8 text-center text-gray-500 italic">No recent transactions found.</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </main>
    );
}
