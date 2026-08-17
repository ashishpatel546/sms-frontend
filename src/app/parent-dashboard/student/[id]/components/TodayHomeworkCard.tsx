import React from 'react';
import { Paperclip, CheckCheck } from 'lucide-react';
import { createSubjectColorMap } from '@/lib/subjectColors';
import { Skeleton } from '@/components/ui/skeleton';

/* ═══════════════════════════════════════════════════════════════════════════
   What was set today — the second question, so it sits beside the first.

   Deliberately compact: this is the "is there any" answer, not the homework
   itself. Tapping opens the homework section, where the full text lives.
   ═══════════════════════════════════════════════════════════════════════════ */

interface HomeworkItem {
  id: string;
  subject: string | null;
  message: string;
  worksheetFileName?: string | null;
}

interface TodayHomeworkCardProps {
  items: HomeworkItem[];
  isLoading: boolean;
  onOpen: () => void;
}

const VISIBLE = 3;

export const TodayHomeworkCard = ({ items, isLoading, onOpen }: TodayHomeworkCardProps) => {
  // One map per render of this list — sharing it with the homework tab's own
  // list would let the same colour mean two subjects on two screens.
  const colourFor = React.useMemo(() => createSubjectColorMap(), []);
  const shown = items.slice(0, VISIBLE);
  const overflow = items.length - shown.length;

  return (
    <button
      onClick={onOpen}
      aria-label={`Homework set today: ${items.length} item${items.length === 1 ? '' : 's'}. Open homework.`}
      className="flex min-h-42 w-full cursor-pointer flex-col rounded-xl border border-line bg-surface p-3 text-left shadow-soft transition-all hover:-translate-y-0.5 hover:border-brand-edge hover:shadow-raised focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none"
    >
      <span className="mb-1.5 flex items-center justify-between gap-2">
        <span className="eyebrow">Homework</span>
        {!isLoading && items.length > 0 && (
          <span className="grid size-5 shrink-0 place-items-center rounded-full bg-accent-info text-[11px] leading-none font-bold text-white">
            {items.length}
          </span>
        )}
      </span>

      {isLoading ? (
        <span className="space-y-2">
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-full" />
        </span>
      ) : items.length === 0 ? (
        /* An empty card next to a stamped one reads as unfinished, so this
           state gets a mark of its own weight, sitting at the same height as
           the stamp opposite. Not a second stamp: the tilted outline means
           "the register was marked" and stops meaning it if two of them share
           a row. Sage rather than grey because for a parent this is good news,
           not a missing record. */
        <span className="flex flex-1 flex-col items-center justify-center gap-1.5 pb-1 text-center">
          <span className="grid size-11 place-items-center rounded-2xl bg-accent-success-tint text-accent-success-deep">
            <CheckCheck className="size-5.5" strokeWidth={2.6} aria-hidden />
          </span>
          <span className="text-[12.5px] leading-tight font-semibold text-ink">
            No homework today
          </span>
          <span className="text-[10.5px] leading-tight text-ink-muted">
            Nothing was set
          </span>
        </span>
      ) : (
        <span className="block divide-y divide-line">
          {shown.map((h) => {
            const colour = colourFor(h.subject);
            return (
              <span key={h.id} className="flex items-center gap-2.5 py-1.25">
                <span
                  className={`h-6 w-1.5 shrink-0 rounded-full ${colour.dot}`}
                  aria-hidden
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[12px] leading-tight font-semibold text-ink">
                    {h.subject || 'General'}
                  </span>
                  <span className="block truncate text-[10.5px] leading-tight text-ink-muted">
                    {h.message}
                  </span>
                </span>
                {h.worksheetFileName && (
                  <Paperclip className="size-3 shrink-0 text-ink-faint" aria-label="Worksheet attached" />
                )}
              </span>
            );
          })}
        </span>
      )}

      {overflow > 0 && (
        <span className="mt-auto pt-1.5 text-[11px] font-semibold text-brand">
          +{overflow} more
        </span>
      )}
    </button>
  );
};
