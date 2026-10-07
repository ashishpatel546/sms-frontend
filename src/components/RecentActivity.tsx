"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslations } from "next-intl";
import { authFetch } from "@/lib/auth";
import { API_BASE_URL } from "@/lib/api";
import {
  LockOpen, Lock, CheckCircle2, XCircle, Undo2, Pencil,
  ClipboardList, Trash2, PartyPopper, Archive, type LucideIcon,
} from "lucide-react";
import { Panel, PanelHeader } from "@/components/ui/Panel";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/skeleton";
import { PIGMENT_CLASS, type Pigment } from "@/components/ui/pigment";

interface ActivityLogEntry {
  id: number;
  actorName: string | null;
  action: string;
  description: string | null;
  createdAt: string;
}

/**
 * Each action gets a pigment rather than a colour, so the feed says what
 * *kind* of thing happened: an approval is settled, a rejection is a
 * correction, an opened bypass window wants attention.
 */
const ACTION_META: Record<string, { Icon: LucideIcon; pigment: Pigment }> = {
  BYPASS_WINDOW_OPENED: { Icon: LockOpen,    pigment: "attn"    },
  BYPASS_WINDOW_CLOSED: { Icon: Lock,        pigment: "neutral" },
  LEAVE_APPROVED:       { Icon: CheckCircle2, pigment: "success" },
  LEAVE_REJECTED:       { Icon: XCircle,      pigment: "danger"  },
  LEAVE_CANCELLED:      { Icon: Undo2,        pigment: "danger"  },
  STUDENT_UPDATED:      { Icon: Pencil,       pigment: "info"    },
  HOMEWORK_UPDATED:     { Icon: Pencil,       pigment: "info"    },
  HOMEWORK_DELETED:     { Icon: Trash2,       pigment: "danger"  },
  ACTIVITY_PUBLISHED:   { Icon: PartyPopper,  pigment: "success" },
  ACTIVITY_UPDATED:     { Icon: Pencil,       pigment: "info"    },
  ACTIVITY_ARCHIVED:    { Icon: Archive,      pigment: "neutral" },
};

function timeAgo(iso: string, t: ReturnType<typeof useTranslations<"dashboard">>): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60) return t("activity.justNow");
  if (diff < 3600) return t("activity.minutesAgo", { count: Math.floor(diff / 60) });
  if (diff < 86400) return t("activity.hoursAgo", { count: Math.floor(diff / 3600) });
  return t("activity.daysAgo", { count: Math.floor(diff / 86400) });
}

export default function RecentActivity() {
  const t = useTranslations("dashboard");
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
    <Panel>
      <PanelHeader
        title={t("activity.title")}
        action={
          <label className="flex items-center gap-2">
            <span className="eyebrow">{t("activity.show")}</span>
            <select
              value={limit}
              onChange={(e) => setLimit(Number(e.target.value))}
              className="cursor-pointer rounded-md border border-line-strong bg-surface px-2 py-1 text-[12px] text-ink"
              aria-label={t("activity.showAria")}
            >
              <option value={10}>{t("activity.lastN", { count: 10 })}</option>
              <option value={20}>{t("activity.lastN", { count: 20 })}</option>
              <option value={50}>{t("activity.lastN", { count: 50 })}</option>
            </select>
          </label>
        }
      />

      {loading ? (
        <div className="space-y-3 p-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="space-y-1.5">
              <Skeleton className="h-3.5 w-3/5" />
              <Skeleton className="h-2.5 w-1/4" />
            </div>
          ))}
        </div>
      ) : logs.length === 0 ? (
        <EmptyState
          compact
          icon={<ClipboardList />}
          title={t("activity.emptyTitle")}
          description={t("activity.emptyBody")}
        />
      ) : (
        <ul className="max-h-72 divide-y divide-line overflow-y-auto">
          {logs.map((log) => {
            const meta = ACTION_META[log.action];
            const Icon = meta?.Icon ?? ClipboardList;
            const p = PIGMENT_CLASS[meta?.pigment ?? "neutral"];
            return (
              <li key={log.id} className="flex items-start gap-3 px-4 py-2.5">
                <span
                  className={`mt-0.5 grid size-7 shrink-0 place-items-center rounded-md ${p.tint} ${p.text}`}
                  title={log.action}
                >
                  <Icon className="size-3.5" aria-hidden />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-[13.5px] leading-snug text-ink wrap-break-word">
                      {log.description ?? log.action}
                    </p>
                    <span className="tabular mt-0.5 shrink-0 text-[11.5px] whitespace-nowrap text-ink-faint">
                      {timeAgo(log.createdAt, t)}
                    </span>
                  </div>
                  {log.actorName && (
                    <p className="mt-0.5 text-[12px] text-ink-muted">{log.actorName}</p>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Panel>
  );
}
