import React from 'react';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

/* What has happened lately, in one list. The notices carry a timestamp so
   "2h ago" is real; homework has only the day it was set, so those rows say
   "Today" rather than inventing a time. */

interface Notification {
  id: string | number;
  title: string;
  message: string;
  createdAt: string;
}

interface RecentUpdatesProps {
  notifications: Notification[];
  /** Subjects set today — keeps the card from being empty on quiet news days. */
  homeworkSubjects: string[];
  isLoading: boolean;
  onOpenHomework: () => void;
}

function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';
  const mins = Math.round((Date.now() - then) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  return days === 1 ? 'yesterday' : `${days}d ago`;
}

export const RecentUpdates = ({
  notifications,
  homeworkSubjects,
  isLoading,
  onOpenHomework,
}: RecentUpdatesProps) => {
  const hasRows = notifications.length > 0 || homeworkSubjects.length > 0;
  if (!isLoading && !hasRows) return null;

  return (
    <div className="rounded-xl border border-line bg-surface p-3.5 shadow-soft">
      <div className="mb-1 flex items-center justify-between gap-3">
        <p className="eyebrow">Recent updates</p>
        <Link
          href="/parent-dashboard/notifications"
          className="group/va flex shrink-0 items-center gap-0.5 text-[11.5px] font-semibold text-brand hover:underline"
        >
          View all
          <ChevronRight className="size-3.5 transition-transform group-hover/va:translate-x-0.5" aria-hidden />
        </Link>
      </div>

      {isLoading ? (
        <div className="space-y-2 pt-2">
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-9 w-full" />
        </div>
      ) : (
        <ul className="divide-y divide-line">
          {homeworkSubjects.map((subject) => (
            <li key={`hw-${subject}`}>
              <button
                onClick={onOpenHomework}
                className="flex w-full cursor-pointer items-start gap-2.5 py-2.5 text-left"
              >
                <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-accent-info" aria-hidden />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[12.5px] leading-tight font-semibold text-ink">
                    {subject} homework posted
                  </span>
                </span>
                <span className="shrink-0 text-[10.5px] text-ink-faint">Today</span>
              </button>
            </li>
          ))}

          {notifications.map((n) => (
            <li key={n.id} className="flex items-start gap-2.5 py-2.5">
              <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-brand" aria-hidden />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[12.5px] leading-tight font-semibold text-ink">
                  {n.title}
                </span>
                <span className="mt-0.5 block line-clamp-1 text-[11.5px] leading-tight text-ink-muted">
                  {n.message}
                </span>
              </span>
              <span className="tabular shrink-0 text-[10.5px] text-ink-faint">
                {relativeTime(n.createdAt)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
