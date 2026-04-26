"use client";

import dynamic from "next/dynamic";
import { Toaster } from "react-hot-toast";

const PickupScanner = dynamic(() => import("@/components/PickupScanner"), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center py-16">
      <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
    </div>
  ),
});

export default function PickupScanPage() {
  return (
    <div className="min-h-screen bg-slate-950 p-4 sm:p-6">
      <Toaster position="top-center" />
      <div className="max-w-md mx-auto space-y-5">
        {/* Header */}
        <div className="flex items-center gap-3 pt-2">
          <div className="w-10 h-10 rounded-xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center text-xl shrink-0">
            📷
          </div>
          <div>
            <h1 className="text-white font-bold text-xl leading-tight">Pickup Scanner</h1>
            <p className="text-slate-400 text-sm">Scan parent QR to verify student handover</p>
          </div>
        </div>

        <PickupScanner />
      </div>
    </div>
  );
}
