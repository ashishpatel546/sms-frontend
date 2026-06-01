"use client";

import { useState, useEffect } from "react";
import { hrApi, PayrollEntry } from "@/lib/hr-api";
import { getUser } from "@/lib/auth";
import { generateSalarySlipPdf } from "@/lib/salary-slip-pdf";
import { useSchoolInfo } from "@/lib/useSchoolInfo";
import toast, { Toaster } from "react-hot-toast";

const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];

export default function MySalaryPage() {
  const user = getUser();
  const [entries, setEntries] = useState<PayrollEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloadingId, setDownloadingId] = useState<number | null>(null);
  
  const schoolInfo = useSchoolInfo();

  useEffect(() => {
    const load = async () => {
      try {
        const data = await hrApi.payroll.mySlips(user?.staffId);
        setEntries(data);
      } catch { toast.error("Failed to load salary slips"); }
      finally { setLoading(false); }
    };
    load();
  }, [user?.staffId]);

  const handleDownload = async (entry: PayrollEntry) => {
    setDownloadingId(entry.id);
    try {
      const run = entry.payrollRun;
      const nameParts = [];
      if (entry.staff?.user?.firstName) nameParts.push(entry.staff.user.firstName);
      if (entry.staff?.user?.lastName) nameParts.push(entry.staff.user.lastName);
      const staffName = nameParts.length > 0 ? nameParts.join('-').replace(/\s+/g, '-') : 'Staff';
      
      const fileName = `salary-slip-${run ? `${MONTHS[run.month - 1]}-${run.year}` : `run-${entry.payrollRunId}`}-${staffName}-${entry.staffId}.pdf`;

      await generateSalarySlipPdf(entry, {
        fileName,
        month: run?.month,
        year: run?.year,
        schoolInfo: schoolInfo || undefined,
      });
    } catch (e: any) {
      toast.error("PDF generation failed: " + (e?.message ?? ""));
    } finally {
      setDownloadingId(null);
    }
  };

  const fmt = (n: number) => `Rs. ${Number(n).toLocaleString("en-IN")}`;

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto space-y-6">
      <Toaster />
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">My Salary Slips</h1>
          <p className="text-sm text-gray-500 mt-1">View and download your finalized payslips.</p>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-500">Loading your salary slips...</div>
      ) : entries.length === 0 ? (
        <div className="text-center py-12 bg-white border border-gray-200 rounded-xl">
          <p className="text-gray-500">No finalized salary slips found.</p>
        </div>
      ) : (
        <>
          {/* Mobile view (Cards) */}
          <div className="sm:hidden space-y-4">
            {entries.map((entry) => (
              <div key={entry.id} className="bg-white border border-gray-200 rounded-xl p-4 space-y-3 shadow-sm">
                <div className="flex justify-between items-center border-b pb-2">
                  <h3 className="font-bold text-gray-800">
                    {entry.payrollRun ? `${MONTHS[entry.payrollRun.month - 1]} ${entry.payrollRun.year}` : `Run #${entry.payrollRunId}`}
                  </h3>
                  <span className="bg-green-100 text-green-700 text-xs px-2 py-1 rounded-full font-medium">Finalized</span>
                </div>
                
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="block text-gray-500 text-xs">Gross Earnings</span>
                    <span className="font-medium">{fmt(Number(entry.grossEarnings))}</span>
                  </div>
                  <div>
                    <span className="block text-gray-500 text-xs">Total Deductions</span>
                    <span className="font-medium text-red-600">{fmt(Number(entry.totalDeductions))}</span>
                  </div>
                  <div className="col-span-2 mt-1">
                    <span className="block text-gray-500 text-xs">Net Pay</span>
                    <span className="font-bold text-lg text-green-700">{fmt(Number(entry.netPay))}</span>
                  </div>
                </div>

                <div className="pt-2 border-t mt-2">
                  <button 
                    onClick={() => handleDownload(entry)} 
                    disabled={downloadingId === entry.id}
                    className="w-full flex items-center justify-center gap-2 bg-blue-50 text-blue-700 font-medium py-2 rounded-lg hover:bg-blue-100 disabled:opacity-50"
                  >
                    {downloadingId === entry.id ? 'Generating...' : 'Download PDF'}
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Tablet/Desktop view (Table) */}
          <div className="hidden sm:block overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 text-gray-600 text-xs uppercase font-semibold">
                <tr>
                  <th className="px-6 py-4 text-left">Salary Month</th>
                  <th className="px-6 py-4 text-right">Working Days</th>
                  <th className="px-6 py-4 text-right">Gross Earnings</th>
                  <th className="px-6 py-4 text-right">Deductions</th>
                  <th className="px-6 py-4 text-right">Net Pay</th>
                  <th className="px-6 py-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {entries.map((entry) => (
                  <tr key={entry.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 font-medium text-gray-900">
                      {entry.payrollRun ? `${MONTHS[entry.payrollRun.month - 1]} ${entry.payrollRun.year}` : `Run #${entry.payrollRunId}`}
                    </td>
                    <td className="px-6 py-4 text-right text-gray-600">
                      {entry.workingDays} <span className="text-xs text-gray-400">({entry.paidDays} Paid)</span>
                    </td>
                    <td className="px-6 py-4 text-right text-gray-900">{fmt(Number(entry.grossEarnings))}</td>
                    <td className="px-6 py-4 text-right text-red-600">{fmt(Number(entry.totalDeductions))}</td>
                    <td className="px-6 py-4 text-right font-bold text-green-700">{fmt(Number(entry.netPay))}</td>
                    <td className="px-6 py-4 text-right">
                      <button 
                        onClick={() => handleDownload(entry)} 
                        disabled={downloadingId === entry.id}
                        className="text-blue-600 hover:text-blue-800 font-medium disabled:opacity-50 bg-blue-50 px-3 py-1.5 rounded"
                      >
                        {downloadingId === entry.id ? 'Generating...' : 'Download PDF'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
