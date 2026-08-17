import React from 'react';
import Link from 'next/link';
import { Megaphone, ChevronRight } from 'lucide-react';

/* The most recent thing the school said, pulled out of the list so it is read
   rather than scrolled past. "View all" goes to the notifications page — the
   old code called onChangeSection("notifications"), which is not a section, so
   the link silently did nothing. */

interface AnnouncementBannerProps {
  title: string;
  message: string;
}

export const AnnouncementBanner = ({ title, message }: AnnouncementBannerProps) => (
  <div className="flex items-center gap-3 rounded-xl border border-accent-info-edge bg-accent-info-tint p-3">
    <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-accent-info/15 text-accent-info-deep">
      <Megaphone className="size-4.5" aria-hidden />
    </span>
    <div className="min-w-0 flex-1">
      <p className="truncate text-[12.5px] leading-tight font-semibold text-ink">{title}</p>
      <p className="truncate text-[11.5px] leading-tight text-ink-muted">{message}</p>
    </div>
    <Link
      href="/parent-dashboard/notifications"
      className="group/va flex shrink-0 items-center gap-0.5 text-[11.5px] font-semibold text-accent-info-deep hover:underline"
    >
      View all
      <ChevronRight className="size-3.5 transition-transform group-hover/va:translate-x-0.5" aria-hidden />
    </Link>
  </div>
);
