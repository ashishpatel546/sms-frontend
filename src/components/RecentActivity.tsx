"use client";

import { useState, useEffect, useCallback } from "react";
import { authFetch } from "@/lib/auth";
import { API_BASE_URL } from "@/lib/api";

interface ActivityLogEntry {
  id: number;
  actorName: string | null;
  action: string;
  description: string | null;
  createdAt: string;
}

const ACTION_ICON: Record<string, string> = {
  BYPASS_WINDOW_OPENED: "🔓",
  BYPASS_WINDOW_CLOSED: "🔒",
  LEAVE_APPROVED: "✅",
  LEAVE_REJECTED: "❌",
  LEAVE_CANCELLED: "↩️",
  STUDENT_UPDATED: "✏️",
};

function timeAgo(iso: string): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export default function RecentActivity() {
  const [logs, setLogs] = useState<ActivityLogEntry[]>([]);
  const [limit, setLimit] = useState(20);
  const [loading, setLoading] = useState(true);

  const fetchLogs = useCallback(async (n: number) => {
    setLoading(true);
    try {
      const res = await authFetch(`${API_BASE_URL}/dashboard/activity?limit=${n}`);
      if (res.ok) {
        const data = await res.json();
        setLogs(Array.isArray(data) ? data : []);
      }
    } catch {
      // silently fail — activity feed is non-critical
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchLogs(limit); }, [fetchLogs, limit]);

  return (
    <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-slate-800">Recent Activity</h3>
        <div className="flex items-center gap-2">
          <label className="text-xs text-slate-500">Show</label>
          <select
            value={limit}
            onChange={(e) => setLimit(Number(e.target.value))}
            className="text-xs border border-slate-200 rounded-md px-2 py-1 bg-white text-slate-700"
          >
            <option value={10}>Last 10</option>
            <option value={20}>Last 20</option>
            <option value={50}>Last 50</option>
          </select>
        </div>
      </div>

      {loading ? (
        <div className="space-y-2">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-10 bg-slate-100 rounded-lg animate-pulse" />
          ))}
        </div>
      ) : logs.length === 0 ? (
        <div className="flex items-center justify-center h-36 bg-slate-50 border border-dashed border-slate-200 rounded-xl">
          <p className="text-slate-400 text-sm">No recent activity to display</p>
        </div>
      ) : (
        <ul className="space-y-1 max-h-72 overflow-y-auto pr-1">
          {logs.map((log) => (
            <li key={log.id} className="flex items-start gap-3 py-2 border-b border-slate-100 last:border-0">
              <span className="text-base mt-0.5 shrink-0" title={log.action}>
                {ACTION_ICON[log.action] ?? "📋"}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-slate-700 leading-snug truncate">
                  {log.description ?? log.action}
                </p>
                {log.actorName && (
                  <p className="text-xs text-slate-400 mt-0.5">{log.actorName}</p>
                )}
              </div>
              <span className="text-xs text-slate-400 shrink-0 mt-0.5">{timeAgo(log.createdAt)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
