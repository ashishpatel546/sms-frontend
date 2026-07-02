"use client";

import React, { useState, useEffect, useCallback } from "react";
import { API_BASE_URL } from "@/lib/api";
import { authFetch } from "@/lib/auth";

type PickupStatus = "PENDING" | "CONFIRMED" | "CANCELLED" | "EXPIRED";

interface PickupRecord {
  id: string;
  status: PickupStatus;
  studentName: string;
  className: string;
  sectionName: string;
  authorizedPersonName: string;
  authorizedPersonMobile: string | null;
  notes: string | null;
  expiresAt: string;
  createdAt: string;
  confirmedAt: string | null;
  parentName: string;
  confirmedByName: string | null;
}

const STATUS_BADGE: Record<PickupStatus, { label: string; cls: string }> = {
  PENDING: { label: "Active", cls: "bg-emerald-500/20 text-emerald-400" },
  CONFIRMED: { label: "Confirmed", cls: "bg-blue-500/20 text-blue-400" },
  CANCELLED: { label: "Cancelled", cls: "bg-slate-500/20 text-slate-400" },
  EXPIRED: { label: "Expired", cls: "bg-red-500/20 text-red-400" },
};

export default function PickupHistoryPage() {
  const [studentIdInput, setStudentIdInput] = useState("");
  const [studentId, setStudentId] = useState<number | null>(null);
  const [records, setRecords] = useState<PickupRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const LIMIT = 20;

  const fetchHistory = useCallback(async (sid: number, p: number) => {
    setLoading(true);
    try {
      const res = await authFetch(
        `${API_BASE_URL}/pickup/student/${sid}/history?page=${p}&limit=${LIMIT}`
      );
      if (res.ok) {
        const data = await res.json();
        setRecords(data.items ?? []);
        setTotal(data.total ?? 0);
      }
    } catch { /* noop */ }
    finally { setLoading(false); }
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const id = parseInt(studentIdInput);
    if (!id) return;
    setStudentId(id);
    setPage(1);
    setSearched(true);
    fetchHistory(id, 1);
  };

  useEffect(() => {
    if (studentId) fetchHistory(studentId, page);
  }, [page, studentId, fetchHistory]);

  const totalPages = Math.ceil(total / LIMIT);

  return (
    <div className="min-h-screen bg-slate-950 p-4 sm:p-6">
      <div className="max-w-3xl mx-auto space-y-5">
        {/* Header */}
        <div className="flex items-center gap-3 pt-2">
          <div className="w-10 h-10 rounded-xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center text-xl shrink-0">
            📋
          </div>
          <div>
            <h1 className="text-white font-bold text-xl leading-tight">Pickup History</h1>
            <p className="text-slate-400 text-sm">View pickup records for any student</p>
          </div>
        </div>

        {/* Retention notice */}
        <div className="flex items-start gap-2 px-4 py-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-300 text-xs">
          <svg className="w-4 h-4 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>Records older than 30 days are automatically removed from the system.</span>
        </div>

        {/* Search */}
        <form onSubmit={handleSearch} className="flex gap-2">
          <input
            type="number"
            value={studentIdInput}
            onChange={(e) => setStudentIdInput(e.target.value)}
            placeholder="Enter Student ID"
            className="flex-1 bg-slate-900 border border-slate-700 text-white rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 placeholder-slate-600"
            min={1}
            required
          />
          <button
            type="submit"
            className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm font-medium transition-all"
          >
            Search
          </button>
        </form>

        {/* Results */}
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : searched && records.length === 0 ? (
          <div className="text-center py-12 text-slate-500 text-sm">No pickup records found for this student</div>
        ) : (
          records.length > 0 && (
            <div className="space-y-3">
              <p className="text-slate-500 text-xs">{total} record{total !== 1 ? "s" : ""} found</p>
              {records.map((r) => {
                const badge = STATUS_BADGE[r.status];
                return (
                  <div key={r.id} className="bg-slate-900 border border-slate-800 rounded-xl p-4">
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <div>
                        <p className="text-white font-semibold text-sm">{r.studentName}</p>
                        <p className="text-slate-500 text-xs">
                          {r.className}{r.sectionName ? ` — ${r.sectionName}` : ""}
                        </p>
                      </div>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${badge.cls}`}>
                        {badge.label}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 text-xs">
                      <p className="text-slate-400"><span className="text-slate-500">Pickup by:</span> <span className="text-white">{r.authorizedPersonName}</span></p>
                      {r.authorizedPersonMobile && (
                        <p className="text-slate-400"><span className="text-slate-500">Mobile:</span> <span className="text-white">{r.authorizedPersonMobile}</span></p>
                      )}
                      <p className="text-slate-400"><span className="text-slate-500">Parent:</span> <span className="text-white">{r.parentName}</span></p>
                      <p className="text-slate-400">
                        <span className="text-slate-500">Created:</span>{" "}
                        {new Date(r.createdAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}
                      </p>
                      <p className="text-slate-400">
                        <span className="text-slate-500">Expires:</span>{" "}
                        {new Date(r.expiresAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}
                      </p>
                      {r.confirmedAt && (
                        <p className="text-blue-400 sm:col-span-2">
                          <span className="text-slate-500">Confirmed:</span>{" "}
                          {new Date(r.confirmedAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}
                          {r.confirmedByName ? ` by ${r.confirmedByName}` : ""}
                        </p>
                      )}
                      {r.notes && (
                        <p className="text-slate-400 italic sm:col-span-2">
                          <span className="text-slate-500">Note:</span> {r.notes}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex justify-center gap-2 pt-2">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-white rounded-xl text-sm transition-all"
                  >
                    ← Prev
                  </button>
                  <span className="px-4 py-2 text-slate-400 text-sm">
                    {page} / {totalPages}
                  </span>
                  <button
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-white rounded-xl text-sm transition-all"
                  >
                    Next →
                  </button>
                </div>
              )}
            </div>
          )
        )}
      </div>
    </div>
  );
}
