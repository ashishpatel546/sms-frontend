"use client";

import { useState, useEffect } from "react";
import { hrApi, PayrollRun } from "@/lib/hr-api";
import { useRbac } from "@/lib/rbac";
import toast, { Toaster } from "react-hot-toast";
import Link from "next/link";

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const now = new Date();

export default function PayrollPage() {
  const rbac = useRbac();
  const [runs, setRuns] = useState<PayrollRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDraft, setShowDraft] = useState(false);
  const [draftForm, setDraftForm] = useState({ month: now.getMonth() + 1, year: now.getFullYear() });
  const [drafting, setDrafting] = useState(false);

  const load = async () => {
    setLoading(true);
    try { setRuns(await hrApi.payroll.listRuns()); }
    catch { toast.error("Failed to load payroll runs"); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const handleGenerateDraft = async () => {
    setDrafting(true);
    try {
      const run = await hrApi.payroll.generateDraft(draftForm.month, draftForm.year);
      toast.success(`Draft created for ${MONTHS[run.month - 1]} ${run.year}`);
      setShowDraft(false); load();
    } catch (e: any) { toast.error(e?.info?.message ?? "Draft generation failed"); }
    finally { setDrafting(false); }
  };

  const handleFinalize = async (runId: number, month: number, year: number) => {
    if (!confirm(`Finalize payroll for ${MONTHS[month - 1]} ${year}? This cannot be undone.`)) return;
    try { await hrApi.payroll.finalize(runId); toast.success("Payroll finalized"); load(); }
    catch (e: any) { toast.error(e?.info?.message ?? "Finalize failed"); }
  };

  return (
    <div className="p-6 space-y-4">
      <Toaster />
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">Payroll</h1>
        {rbac.canManagePayroll && (
          <button onClick={() => setShowDraft(true)} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700">
            + Generate Draft
          </button>
        )}
      </div>

      {/* Info Banner */}
      <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4">
        <h2 className="text-sm font-semibold text-indigo-900 mb-1">About Payroll Runs</h2>
        <p className="text-xs text-indigo-800 leading-relaxed">
          Payroll is processed in two steps: <strong>1. Generate Draft</strong> — computes gross pay, LOP deductions (based on approved leaves), PF, PT, and TDS for all staff for a given month.
          <strong>2. Finalize</strong> — locks the payroll so no further changes can be made and makes salary slips available to staff.
          You can <strong>recalculate</strong> a draft run if attendance or leave data changes before finalizing.
          Once finalized, each staff member can download their salary slip from <em>My Salary</em>.
          <strong>LOP (Loss of Pay)</strong> days are automatically deducted from gross salary based on approved leave applications that exceeded the leave balance.
        </p>
      </div>

      {loading ? (
        <p className="text-sm text-gray-500">Loading…</p>
      ) : runs.length === 0 ? (
        <div className="text-center py-12 text-gray-500 text-sm">No payroll runs yet.</div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-200">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-gray-600 text-xs uppercase">
              <tr>
                <th className="px-4 py-3 text-left">Period</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-left">Created</th>
                <th className="px-4 py-3 text-left">Finalized At</th>
                <th className="px-4 py-3 text-left">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {runs.map((r) => (
                <tr key={r.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">
                    {MONTHS[r.month - 1]} {r.year}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${r.status === "FINALIZED" ? "bg-green-50 text-green-700 border-green-200" : "bg-amber-50 text-amber-700 border-amber-200"}`}>
                      {r.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-500">{new Date(r.createdAt).toLocaleDateString()}</td>
                  <td className="px-4 py-3 text-gray-500">{r.finalizedAt ? new Date(r.finalizedAt).toLocaleDateString() : "—"}</td>
                  <td className="px-4 py-3 flex gap-2">
                    <Link href={`/dashboard/hr/payroll/${r.id}`} className="text-blue-600 hover:underline text-xs">
                      View Entries
                    </Link>
                    {rbac.canManagePayroll && r.status === "DRAFT" && (
                      <button onClick={() => handleFinalize(r.id, r.month, r.year)} className="text-green-600 hover:underline text-xs">
                        Finalize
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Generate draft modal */}
      {showDraft && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-sm space-y-4">
            <h2 className="font-semibold text-lg">Generate Payroll Draft</h2>
            <p className="text-sm text-gray-600">
              This will calculate attendance-adjusted salaries for all staff with an active CTC for the selected month.
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium">Month</label>
                <select value={draftForm.month} onChange={(e) => setDraftForm((f) => ({ ...f, month: Number(e.target.value) }))} className="w-full border rounded-lg px-3 py-2 text-sm mt-1">
                  {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
                </select>
              </div>
              <div>
                <label className="text-sm font-medium">Year</label>
                <select value={draftForm.year} onChange={(e) => setDraftForm((f) => ({ ...f, year: Number(e.target.value) }))} className="w-full border rounded-lg px-3 py-2 text-sm mt-1">
                  {[now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1].map((y) => <option key={y}>{y}</option>)}
                </select>
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setShowDraft(false)} className="px-4 py-2 text-sm border rounded-lg hover:bg-gray-50">Cancel</button>
              <button onClick={handleGenerateDraft} disabled={drafting} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-60">
                {drafting ? "Generating…" : "Generate Draft"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
