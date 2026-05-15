"use client";

import { useState, useEffect, useCallback } from "react";
import { hrApi, StaffAttendanceRecord } from "@/lib/hr-api";
import { getUser } from "@/lib/auth";
import toast, { Toaster } from "react-hot-toast";

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const STATUS_STYLES: Record<string, string> = {
  PRESENT: "bg-green-100 text-green-700 border-green-200",
  LATE: "bg-amber-100 text-amber-700 border-amber-200",
  ABSENT: "bg-red-100 text-red-700 border-red-200",
  HALF_DAY: "bg-blue-100 text-blue-700 border-blue-200",
  ON_LEAVE: "bg-purple-100 text-purple-700 border-purple-200",
  HOLIDAY: "bg-gray-100 text-gray-500 border-gray-200",
};
const now = new Date();

export default function MyAttendancePage() {
  const user = getUser();
  const [records, setRecords] = useState<StaffAttendanceRecord[]>([]);
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!user?.staffId) return;
    setLoading(true);
    try { setRecords(await hrApi.attendance.monthly(user.staffId, month, year)); }
    catch { toast.error("Failed to load attendance"); }
    finally { setLoading(false); }
  }, [user?.staffId, month, year]);

  useEffect(() => { load(); }, [load]);

  const counts = {
    PRESENT: records.filter((r) => r.status === "PRESENT").length,
    LATE: records.filter((r) => r.status === "LATE").length,
    ABSENT: records.filter((r) => r.status === "ABSENT").length,
    ON_LEAVE: records.filter((r) => r.status === "ON_LEAVE").length,
  };

  return (
    <div className="p-6 space-y-4">
      <Toaster />
      <h1 className="text-xl font-bold text-gray-900">My Attendance</h1>

      {/* Month/Year selector */}
      <div className="flex gap-3 items-center">
        <select value={month} onChange={(e) => setMonth(Number(e.target.value))} className="border rounded-lg px-3 py-2 text-sm">
          {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
        </select>
        <select value={year} onChange={(e) => setYear(Number(e.target.value))} className="border rounded-lg px-3 py-2 text-sm">
          {[now.getFullYear() - 1, now.getFullYear()].map((y) => <option key={y}>{y}</option>)}
        </select>
      </div>

      {/* Summary chips */}
      <div className="flex flex-wrap gap-3">
        {Object.entries(counts).map(([status, count]) => (
          <div key={status} className={`px-3 py-1.5 rounded-full text-xs font-medium border ${STATUS_STYLES[status] ?? "bg-gray-100 text-gray-600"}`}>
            {status}: {count}
          </div>
        ))}
      </div>

      {/* Records list */}
      {loading ? (
        <p className="text-sm text-gray-500">Loading…</p>
      ) : records.length === 0 ? (
        <p className="text-sm text-gray-500">No attendance records for this period.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-200">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-gray-600 text-xs uppercase">
              <tr>
                <th className="px-4 py-3 text-left">Date</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-left">Method</th>
                <th className="px-4 py-3 text-left">Check-In</th>
                <th className="px-4 py-3 text-left">Check-Out</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {records.map((r) => (
                <tr key={r.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">{r.date}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${STATUS_STYLES[r.status] ?? "bg-gray-100"}`}>{r.status}</span>
                  </td>
                  <td className="px-4 py-3 text-gray-500">{r.method}</td>
                  <td className="px-4 py-3">{r.checkInTime ?? "—"}</td>
                  <td className="px-4 py-3">{r.checkOutTime ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
