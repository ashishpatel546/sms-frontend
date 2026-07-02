"use client";

import { useState, useEffect, useCallback } from "react";
import { authFetch } from "@/lib/auth";
import { API_BASE_URL } from "@/lib/api";
import {
  LockOpen, Lock, CheckCircle2, XCircle, Undo2, Pencil,
  ClipboardList, type LucideIcon,
} from "lucide-react";

interface ActivityLogEntry {
  id: number;
  actorName: string | null;
  action: string;
  description: string | null;
  createdAt: string;
}

const ACTION_META: Record<string, { Icon: LucideIcon; color: string }> = {
  BYPASS_WINDOW_OPENED: { Icon: LockOpen,     color: "text-amber-500"   },
  BYPASS_WINDOW_CLOSED: { Icon: Lock,          color: "text-slate-500"   },
  LEAVE_APPROVED:       { Icon: CheckCircle2,  color: "text-emerald-500" },
  LEAVE_REJECTED:       { Icon: XCircle,       color: "text-red-500"     },
  LEAVE_CANCELLED:      { Icon: Undo2,         color: "text-orange-500"  },
  STUDENT_UPDATED:      { Icon: Pencil,        color: "text-blue-500"    },
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
  const [limit, setLimit] = useState(10);
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
    <div className="bg-surface/80 backdrop-blur-sm rounded-2xl p-6 shadow-soft border border-slate-200/80 dark:border-white/10">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-ink">Recent Activity</h3>
        <div className="flex items-center gap-2">
          <label className="text-xs text-ink-muted">Show</label>
          <select
            value={limit}
            onChange={(e) => setLimit(Number(e.target.value))}
            className="text-xs border border-slate-200/80 dark:border-white/10 rounded-md px-2 py-1 bg-surface-secondary text-ink"
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
            <div key={i} className="h-10 bg-surface-secondary rounded-lg animate-pulse" />
          ))}
        </div>
      ) : logs.length === 0 ? (
        <div className="flex items-center justify-center h-36 bg-surface-secondary border border-dashed border-slate-200/80 dark:border-white/10 rounded-xl">
          <p className="text-ink-muted text-sm">No recent activity to display</p>
        </div>
      ) : (
        <ul className="space-y-1 max-h-72 overflow-y-auto pr-1">
          {logs.map((log) => (
            <li key={log.id} className="flex items-start gap-3 py-2 border-b border-slate-100 dark:border-white/5 last:border-0">
              {(() => {
                const meta = ACTION_META[log.action];
                const Icon = meta?.Icon ?? ClipboardList;
                const color = meta?.color ?? "text-ink-muted";
                return (
                  <span className={`mt-0.5 shrink-0 p-1.5 rounded-lg bg-slate-100 dark:bg-surface-secondary ${color}`} title={log.action}>
                    <Icon className="w-3.5 h-3.5" aria-hidden />
                  </span>
                );
              })()}
              <div className="flex-1 min-w-0">
                <p className="text-sm text-ink leading-snug truncate">
                  {log.description ?? log.action}
                </p>
                {log.actorName && (
                  <p className="text-xs text-ink-muted mt-0.5">{log.actorName}</p>
                )}
              </div>
              <span className="text-xs text-ink-muted shrink-0 mt-0.5">{timeAgo(log.createdAt)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
