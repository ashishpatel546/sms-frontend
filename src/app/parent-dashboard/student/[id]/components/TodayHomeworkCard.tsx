import React from 'react';
import { CheckCheck, ChevronRight } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

/* ═══════════════════════════════════════════════════════════════════════════
   What was set today — the count, not the contents.

   This used to list the first three subjects, which meant the tile's height
   depended on how much homework there was: one subject left it half empty,
   five overflowed it. A parent glancing at the page wants to know whether
   there IS homework; the tasks themselves are a tap away and are better read
   in the homework section, where the full text fits.
   ═══════════════════════════════════════════════════════════════════════════ */

interface TodayHomeworkCardProps {
  count: number;
  isLoading: boolean;
  onOpen: () => void;
}

export const TodayHomeworkCard = ({ count, isLoading, onOpen }: TodayHomeworkCardProps) => {
  const none = count === 0;

  return (
    <button
      onClick={onOpen}
      aria-label={
        none ? 'No homework set today. Open homework.' : `${count} homework task${count === 1 ? '' : 's'} set today. Open homework.`
      }
      className="flex min-h-33 w-full cursor-pointer flex-col items-center gap-1 rounded-xl border border-line bg-surface p-2.5 text-center shadow-soft transition-all hover:-translate-y-0.5 hover:border-brand-edge hover:shadow-raised focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none"
    >
      <span className="eyebrow w-full text-left">Homework</span>

      {isLoading ? (
        <Skeleton className="mt-2 h-11 w-14 rounded-lg" />
      ) : none ? (
        /* Sage, not grey: for a parent this is good news, not a missing record. */
        <span className="mt-1.5 flex flex-col items-center gap-1">
          <span className="grid size-9 place-items-center rounded-xl bg-accent-success-tint text-accent-success-deep">
            <CheckCheck className="size-4.5" strokeWidth={2.6} aria-hidden />
          </span>
          <span className="text-[11px] leading-tight font-semibold text-ink">Nothing set</span>
        </span>
      ) : (
        <span className="mt-1 flex flex-col items-center leading-none">
          <span className="tabular font-display text-[30px] leading-none font-extrabold text-accent-info-deep">
            {count}
          </span>
          <span className="mt-1 text-[11px] leading-tight font-semibold text-ink">
            {count === 1 ? 'task' : 'tasks'}
          </span>
        </span>
      )}

      <span className="mt-auto flex items-center gap-0.5 pt-1.5 text-[11px] font-semibold text-brand">
        View
        <ChevronRight className="size-3.5" aria-hidden />
      </span>
    </button>
  );
};
