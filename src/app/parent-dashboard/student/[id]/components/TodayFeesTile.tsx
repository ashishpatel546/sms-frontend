import React from 'react';
import { Check } from 'lucide-react';
import { Money } from '@/components/ui/Money';
import { Skeleton } from '@/components/ui/skeleton';

/* ═══════════════════════════════════════════════════════════════════════════
   What is owed.

   Previously a full-width strip under the row, which cost a band of its own
   for a single number. As the row's third tile it says the same thing in the
   same glance, and always occupies the same space whether or not anything is
   due — so the page does not reflow around a parent's payment.
   ═══════════════════════════════════════════════════════════════════════════ */

interface TodayFeesTileProps {
  totalDue: number;
  isLoading: boolean;
  onOpen: () => void;
}

export const TodayFeesTile = ({ totalDue, isLoading, onOpen }: TodayFeesTileProps) => {
  const settled = totalDue <= 0;

  return (
    <button
      onClick={onOpen}
      aria-label={settled ? 'No fees due. Open fees.' : `${totalDue} rupees due. Open fees to pay.`}
      className={`flex min-h-33 w-full cursor-pointer flex-col items-center gap-1 rounded-xl border p-2.5 text-center shadow-soft transition-all hover:-translate-y-0.5 hover:shadow-raised focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none ${
        settled ? 'border-line bg-surface hover:border-brand-edge' : 'border-accent-warn-edge bg-accent-warn-tint'
      }`}
    >
      <span className="eyebrow w-full text-left">Fees</span>

      {isLoading ? (
        <Skeleton className="mt-2 h-11 w-16 rounded-lg" />
      ) : settled ? (
        <span className="mt-1.5 flex flex-col items-center gap-1">
          <span className="grid size-9 place-items-center rounded-xl bg-accent-success-tint text-accent-success-deep">
            <Check className="size-4.5" strokeWidth={3} aria-hidden />
          </span>
          <span className="text-[11px] leading-tight font-semibold text-ink">All paid</span>
        </span>
      ) : (
        <span className="mt-1.5 flex flex-col items-center">
          {/* Money keeps en-IN grouping and tabular figures consistent with the
              fees tab, so the same amount reads identically on both screens. */}
          <Money
            amount={totalDue}
            symbol
            short={totalDue >= 100000}
            className="text-[17px] leading-none font-extrabold text-accent-warn-deep"
          />
          <span className="mt-1 text-[11px] leading-tight font-semibold text-ink">due</span>
        </span>
      )}

      {!settled && !isLoading && (
        <span className="mt-auto rounded-md bg-brand px-2.5 py-1 text-[11px] font-semibold text-brand-contrast">
          Pay
        </span>
      )}
      {(settled || isLoading) && <span className="mt-auto pt-1.5 text-[11px] text-ink-faint">&nbsp;</span>}
    </button>
  );
};
