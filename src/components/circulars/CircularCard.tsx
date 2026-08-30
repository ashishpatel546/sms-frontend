'use client';

import * as React from 'react';
import { Archive, FileText, Paperclip, Users } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  circularAudienceLabel,
  formatFileSize,
  type Circular,
} from '@/lib/circulars-api';

/** A circular issued within this window is still worth pointing at. */
const NEW_FOR_DAYS = 3;

export function isRecent(iso: string): boolean {
  const age = Date.now() - new Date(iso).getTime();
  return age >= 0 && age < NEW_FOR_DAYS * 24 * 60 * 60 * 1000;
}

/**
 * One circular in the list.
 *
 * A torn-off date block leads, the way a notice pinned to a board is filed by
 * the day it went up — it is also the only sort key the list has, so it earns
 * the strongest position. The body is clamped to three lines: the card is an
 * index entry, the full text lives one tap away in the reader.
 */
export function CircularCard({
  circular,
  onOpen,
  showAudience = false,
  className,
}: {
  circular: Circular;
  onOpen: () => void;
  /**
   * Staff only. A parent's feed contains nothing but circulars addressed to
   * them, so the badge would tell them something they already know — and a
   * row of "To: Parents" on every card is noise, not information.
   */
  showAudience?: boolean;
  className?: string;
}) {
  const published = new Date(circular.publishedAt);
  const day = published.toLocaleDateString('en-IN', { day: '2-digit' });
  const month = published.toLocaleDateString('en-IN', { month: 'short' });
  const year = published.getFullYear();
  const archived = !!circular.archivedAt;
  const fresh = isRecent(circular.publishedAt) && !archived;

  return (
    <article
      className={cn(
        'group w-full overflow-hidden rounded-xl border border-line bg-surface text-left shadow-soft',
        'transition-all duration-150 hover:border-brand/40 hover:shadow-brand',
        'focus-within:border-brand focus-within:ring-3 focus-within:ring-brand/16',
        // An archived circular is only ever shown to a super admin who asked
        // for it. Muted and dashed so it reads as withdrawn at a glance,
        // never mistaken for something the school can currently see.
        archived && 'border-dashed bg-surface-secondary opacity-75 hover:border-line-strong hover:shadow-soft',
        className,
      )}
    >
      <button
        type="button"
        onClick={onOpen}
        className="flex w-full cursor-pointer items-start gap-3 p-3.5 text-left outline-none sm:gap-4 sm:p-4"
        aria-label={`Open circular: ${circular.title}`}
      >
        {/* The date block — day over month, the way a notice is filed. */}
        <span
          aria-hidden
          className="grid shrink-0 place-items-center rounded-lg border border-line bg-surface-secondary px-2.5 py-2 text-center sm:px-3"
        >
          <span className="font-display text-[19px] leading-none font-bold text-ink tabular sm:text-[22px]">
            {day}
          </span>
          <span className="mt-1 font-mono text-[9.5px] tracking-[0.14em] text-ink-muted uppercase">
            {month}
          </span>
          <span className="font-mono text-[9.5px] tracking-widest text-ink-faint">{year}</span>
        </span>

        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="font-display text-[15px] leading-snug font-semibold text-ink sm:text-[16px]">
              {circular.title}
            </span>
            {fresh && (
              <span className="inline-flex items-center rounded-full border border-accent-edge bg-accent-tint px-1.5 py-0.5 font-mono text-[9.5px] font-semibold tracking-[0.12em] text-accent-deep uppercase">
                New
              </span>
            )}
            {archived && (
              <span className="inline-flex items-center gap-1 rounded-full border border-line-strong bg-surface-inset px-1.5 py-0.5 font-mono text-[9.5px] font-semibold tracking-[0.12em] text-ink-muted uppercase">
                <Archive className="size-2.5" aria-hidden />
                Archived
              </span>
            )}
            {showAudience && (
              <span className="inline-flex items-center gap-1 rounded-full border border-line bg-surface-secondary px-1.5 py-0.5 font-mono text-[9.5px] font-semibold tracking-[0.12em] text-ink-muted uppercase">
                <Users className="size-2.5" aria-hidden />
                {circularAudienceLabel(circular.audience)}
              </span>
            )}
          </span>

          <span className="mt-1.5 line-clamp-3 block text-[13px] leading-relaxed whitespace-pre-line text-ink-muted sm:text-[13.5px]">
            {circular.description}
          </span>

          <span className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11.5px] text-ink-faint">
            {circular.fileName && (
              <span className="inline-flex items-center gap-1 text-brand">
                <Paperclip className="size-3.5" aria-hidden />
                PDF
                {circular.fileSize ? ` · ${formatFileSize(circular.fileSize)}` : ''}
              </span>
            )}
            <span suppressHydrationWarning>
              {published.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })}
            </span>
            {circular.createdByName && <span className="truncate">Issued by {circular.createdByName}</span>}
          </span>
        </span>

        <FileText
          aria-hidden
          className="mt-0.5 hidden size-4 shrink-0 text-ink-faint transition-colors group-hover:text-brand sm:block"
        />
      </button>
    </article>
  );
}
