"use client";

import { useState, useEffect } from "react";
import { hrApi, PayrollEntry } from "@/lib/hr-api";
import { getUser } from "@/lib/auth";
import { generateSalarySlipPdf } from "@/lib/salary-slip-pdf";
import toast, { Toaster } from "react-hot-toast";

const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];

export default function MySalaryPage() {
  const user = getUser();
  const [slips, setSlips] = useState<PayrollEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloadingId, setDownloadingId] = useState<number | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const data = await hrApi.payroll.mySlips(user?.staffId);
        setSlips(data);
      } catch { toast.error("Failed to load salary slips"); }
      finally { setLoading(false); }
    };
    load();
  }, [user?.staffId]);

  const handleDownload = async (entry: PayrollEntry) => {
    setDownloadingId(entry.id);
    try {
      await generateSalarySlipPdf(entry, {
        fileName: `salary-slip-run-${entry.payrollRunId}-staff-${entry.staffId}.pdf`,
      });
    } catch (e: any) { toast.error("PDF generation failed"); }
    finally { setDownloadingId(null); }
  };

  const fmt = (n: number) => `₹${Number(n).toLocaleString("en-IN")}`;

  return (
    <div className="p-6 space-y-4">
      <Toaster />
      <h1 className="text-xl font-bold text-gray-900">My Salary Slips</h1>

      {loading ? (
        <p className="text-sm text-gray-500">Loading…</p>
      ) : slips.length === 0 ? (
        <div className="text-center py-12 text-gray-500 text-sm">No finalized salary slips available yet.</div>
      ) : (
        <div className="grid gap-4">
          {slips.map((slip) => (
            <div key={slip.id} className="bg-white border border-gray-200 rounded-xl p-5 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <div className="font-semibold text-gray-900">Payroll Run #{slip.payrollRunId}</div>
                <div className="text-sm text-gray-500 mt-1">
                  Working Days: {slip.workingDays} | Present: {slip.presentDays} | LOP: {slip.lopDays}
                </div>
              </div>
              <div className="flex items-center gap-6 text-sm">
                <div>
                  <div className="text-gray-500">Gross</div>
                  <div className="font-medium text-gray-800">{fmt(slip.grossEarnings)}</div>
                </div>
                <div>
                  <div className="text-gray-500">Deductions</div>
                  <div className="font-medium text-red-600">{fmt(slip.totalDeductions)}</div>
                </div>
                <div>
                  <div className="text-gray-500">Net Pay</div>
                  <div className="text-xl font-bold text-green-700">{fmt(slip.netPay)}</div>
                </div>
                <button
                  onClick={() => handleDownload(slip)}
                  disabled={downloadingId === slip.id}
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 whitespace-nowrap"
                >
                  {downloadingId === slip.id ? "Generating…" : "Download PDF"}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
