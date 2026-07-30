"use client";

import useSWR from "swr";
import Link from "next/link";
import { authFetch } from "@/lib/auth";
import { API_BASE_URL } from "@/lib/api";
import { Panel } from "@/components/ui/Panel";
import { Skeleton } from "@/components/ui/skeleton";

const fetcher = (url: string) => authFetch(url).then((r) => r.json());

interface AppNotification {
  id: string;
  title: string;
  message: string;
  createdAt: string;
}

export default function NotificationsPage() {
  const { data: notifications, isLoading } = useSWR<AppNotification[]>(
    `${API_BASE_URL}/api/app-notifications`,
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 60000 },
  );

  return (
    <div className="px-4 py-6 max-w-2xl mx-auto space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link
          href="/parent-dashboard"
          className="w-9 h-9 rounded-xl bg-surface-secondary flex items-center justify-center text-ink-muted hover:text-brand transition-colors shrink-0"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </Link>
        <div>
          <h1 className="text-xl font-bold text-ink leading-tight">Notifications</h1>
          <p className="text-xs text-ink-muted">School announcements &amp; alerts</p>
        </div>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-20 w-full rounded-xl" />
          ))}
        </div>
      ) : !notifications || notifications.length === 0 ? (
        <Panel className="p-10 text-center">
          <div className="text-4xl mb-3">🔔</div>
          <p className="text-ink font-semibold">No notifications yet</p>
          <p className="text-sm text-ink-muted mt-1">
            School announcements will appear here
          </p>
        </Panel>
      ) : (
        <div className="space-y-3">
          {notifications.map((n) => (
            <Panel key={n.id} className="p-4">
              <div className="flex items-start gap-3">
                <div className="w-2.5 h-2.5 rounded-full bg-brand mt-1.5 shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-ink leading-snug">{n.title}</p>
                  <p className="text-sm text-ink-muted mt-1 leading-relaxed">{n.message}</p>
                  <p className="text-[11px] text-ink-muted mt-2">
                    {new Date(n.createdAt).toLocaleString("en-IN", {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}
                  </p>
                </div>
              </div>
            </Panel>
          ))}
        </div>
      )}
    </div>
  );
}
