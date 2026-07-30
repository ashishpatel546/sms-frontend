"use client";

import { useState, useEffect } from "react";
import { hrApi, PayrollRun } from "@/lib/hr-api";
import { useRbac } from "@/lib/rbac";
import toast, { Toaster } from "react-hot-toast";
import Link from "next/link";
import { InfoBanner } from "@/components/ui/InfoBanner";

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const now = new Date();

export default function PayrollPage() {
  const rbac = useRbac();
  const [runs, setRuns] = useState<PayrollRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDraft, setShowDraft] = useState(false);
  const [draftForm, setDraftForm] = useState({ month: now.getMonth() + 1, year: now.getFullYear() });
  const [drafting, setDrafting] = useState(false);
  const [processingId, setProcessingId] = useState<number | null>(null);
  const [unmarkedWarning, setUnmarkedWarning] = useState<any[] | null>(null);

  const load = async () => {
    setLoading(true);
    try { setRuns(await hrApi.payroll.listRuns()); }
    catch { toast.error("Failed to load payroll runs"); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const handleGenerateDraft = async (force = false) => {
    setDrafting(true);
    try {
      const run = await hrApi.payroll.generateDraft(draftForm.month, draftForm.year, force);
      toast.success(`Draft created for ${MONTHS[run.month - 1]} ${run.year}`);
      setShowDraft(false); setUnmarkedWarning(null); load();
    } catch (e: any) { 
      if (e?.info?.unmarked) {
        setUnmarkedWarning(e.info.unmarked);
      } else {
        toast.error(e?.info?.message ?? "Draft generation failed"); 
      }
    }
    finally { setDrafting(false); }
  };

  const handleFinalize = async (runId: number, month: number, year: number) => {
    if (!confirm(`Finalize payroll for ${MONTHS[month - 1]} ${year}? This cannot be undone.`)) return;
    try { await hrApi.payroll.finalize(runId); toast.success("Payroll finalized"); load(); }
    catch (e: any) { toast.error(e?.info?.message ?? "Finalize failed"); }
  };

  const handleDelete = async (runId: number) => {
    if (!confirm("Delete this draft payroll run?")) return;
    setProcessingId(runId);
    try { await hrApi.payroll.deleteDraft(runId); toast.success("Draft deleted"); load(); }
    catch (e: any) { toast.error(e?.info?.message ?? "Delete failed"); }
    finally { setProcessingId(null); }
  };

  const handleRefresh = async (runId: number) => {
    if (!confirm("Refresh this draft? It will recalculate all entries.")) return;
    setProcessingId(runId);
    try { await hrApi.payroll.refreshDraft(runId); toast.success("Draft refreshed"); load(); }
    catch (e: any) { toast.error(e?.info?.message ?? "Refresh failed"); }
    finally { setProcessingId(null); }
  };

  return (
    <div className="p-3 sm:p-6 space-y-4">
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
      <InfoBanner title="About Payroll Runs" variant="indigo">
        Payroll is processed in two steps: <strong>1. Generate Draft</strong> — computes gross pay, LOP deductions (based on approved leaves), PF, PT, and TDS for all staff for a given month.
        <strong>2. Finalize</strong> — locks the payroll so no further changes can be made and makes salary slips available to staff.
        You can <strong>recalculate</strong> a draft run if attendance or leave data changes before finalizing.
        Once finalized, each staff member can download their salary slip from <em>My Salary</em>.
        <strong>LOP (Loss of Pay)</strong> days are automatically deducted from gross salary based on approved leave applications that exceeded the leave balance.
      </InfoBanner>

      {loading ? (
        <p className="text-sm text-gray-500">Loading…</p>
      ) : runs.length === 0 ? (
        <div className="text-center py-12 text-gray-500 text-sm">No payroll runs yet.</div>
      ) : (
        <>
          {/* Mobile cards */}
          <div className="sm:hidden space-y-3">
            {runs.map((r) => (
              <div key={r.id} className="bg-white border border-gray-200 rounded-xl p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-gray-900">{MONTHS[r.month - 1]} {r.year}</span>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${r.status === "FINALIZED" ? "bg-green-50 text-green-700 border-green-200" : "bg-amber-50 text-amber-700 border-amber-200"}`}>{r.status}</span>
                </div>
                <p className="text-xs text-gray-500">Created: {new Date(r.createdAt).toLocaleDateString()}{r.finalizedAt ? ` · Finalized: ${new Date(r.finalizedAt).toLocaleDateString()}` : ""}</p>
                <div className="flex gap-3">
                  <Link href={`/dashboard/hr/payroll/${r.id}`} className="text-blue-600 hover:underline text-xs">View Entries</Link>
                  {rbac.canManagePayroll && r.status === "DRAFT" && (
                    <>
                      <button onClick={() => handleRefresh(r.id)} disabled={processingId === r.id} className="text-amber-600 hover:underline text-xs disabled:opacity-50">Refresh</button>
                      <button onClick={() => handleDelete(r.id)} disabled={processingId === r.id} className="text-red-600 hover:underline text-xs disabled:opacity-50">Delete</button>
                      <button onClick={() => handleFinalize(r.id, r.month, r.year)} className="text-green-600 hover:underline text-xs">Finalize</button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Tablet+ table */}
          <div className="hidden sm:block overflow-x-auto rounded-xl border border-gray-200">
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
                    <td className="px-4 py-3 font-medium text-gray-900">{MONTHS[r.month - 1]} {r.year}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${r.status === "FINALIZED" ? "bg-green-50 text-green-700 border-green-200" : "bg-amber-50 text-amber-700 border-amber-200"}`}>{r.status}</span>
                    </td>
                    <td className="px-4 py-3 text-gray-500">{new Date(r.createdAt).toLocaleDateString()}</td>
                    <td className="px-4 py-3 text-gray-500">{r.finalizedAt ? new Date(r.finalizedAt).toLocaleDateString() : "—"}</td>
                    <td className="px-4 py-3 flex gap-2">
                      <Link href={`/dashboard/hr/payroll/${r.id}`} className="text-blue-600 hover:underline text-xs">View Entries</Link>
                      {rbac.canManagePayroll && r.status === "DRAFT" && (
                        <>
                          <button onClick={() => handleRefresh(r.id)} disabled={processingId === r.id} className="text-amber-600 hover:underline text-xs disabled:opacity-50">Refresh</button>
                          <button onClick={() => handleDelete(r.id)} disabled={processingId === r.id} className="text-red-600 hover:underline text-xs disabled:opacity-50">Delete</button>
                          <button onClick={() => handleFinalize(r.id, r.month, r.year)} className="text-green-600 hover:underline text-xs">Finalize</button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Generate draft modal */}
      {showDraft && (
        <div className="fixed inset-0 bg-walnut-950/55 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
          <div className="bg-white rounded-t-2xl sm:rounded-xl p-5 w-full sm:max-w-sm space-y-4">
            <h2 className="font-semibold text-lg">Generate Payroll Draft</h2>
            {unmarkedWarning ? (
              <div className="space-y-3">
                <div className="bg-red-50 text-red-700 p-3 rounded-lg text-sm border border-red-200">
                  <p className="font-semibold mb-1">Unmarked Attendances Found</p>
                  <p className="mb-2">Please ask HR/Admin to update attendance with a warning first. If you continue, these days will be treated as ABSENT (LOP).</p>
                  <div className="max-h-32 overflow-y-auto text-xs space-y-1">
                    {Array.from(new Set(unmarkedWarning.map((u: any) => `${u.name} (Staff ID: ${u.staffId})`)))
                      .slice(0, 10)
                      .map((staffText: string, i: number) => (
                        <div key={i}>• {staffText}</div>
                      ))}
                    {Array.from(new Set(unmarkedWarning.map((u: any) => u.staffId))).length > 10 && (
                      <div>and {Array.from(new Set(unmarkedWarning.map((u: any) => u.staffId))).length - 10} more staff members...</div>
                    )}
                  </div>
                </div>
                <div className="flex gap-2 justify-end">
                  <button onClick={() => setUnmarkedWarning(null)} className="px-4 py-2 text-sm border rounded-lg hover:bg-gray-50">Go Back</button>
                  <button onClick={() => handleGenerateDraft(true)} disabled={drafting} className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-60">
                    {drafting ? "Generating…" : "Generate Anyway"}
                  </button>
                </div>
              </div>
            ) : (
              <>
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
                  <button onClick={() => handleGenerateDraft(false)} disabled={drafting} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-60">
                    {drafting ? "Generating…" : "Generate Draft"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
