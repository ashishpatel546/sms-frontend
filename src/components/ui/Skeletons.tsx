import * as React from 'react';
import { Skeleton } from './skeleton';
import { cn } from '@/lib/utils';

/* ═══════════════════════════════════════════════════════════════════════════
   LOADING SHAPES

   Each of these is a tracing of a real layout that lives somewhere in the app.
   That is the whole point: the skeleton has to sit on the same grid, at the
   same sizes, as the thing replacing it, or the page jumps when data lands and
   the skeleton has made the wait feel WORSE rather than better.

   So when a layout below changes, its shape here changes with it. They are
   deliberately kept side by side in one file for that reason — a shape that
   drifts from its subject is worse than no shape at all.
   ═══════════════════════════════════════════════════════════════════════════ */

/** Staggers the sweep across a row so a grid doesn't pulse in lockstep. */
const delayClass = (i: number) =>
  ['', 'skeleton-delay-1', 'skeleton-delay-2', 'skeleton-delay-3'][i % 4];

/* ─────────────────────────────────────────────────────────────────────────
   CHILD CARD  — traces the <Link> card in app/parent-dashboard/page.tsx
   ───────────────────────────────────────────────────────────────────────── */

export function ChildCardSkeleton({ index = 0 }: { index?: number }) {
  const d = delayClass(index);
  return (
    <div className="relative flex flex-col overflow-hidden rounded-xl border border-line bg-surface p-4 shadow-soft sm:p-5">
      {/* The rail is chrome, not content — it is known before the fetch
          returns, so it paints at full strength like the ledger tab does.
          It is also what makes this read as a card rather than grey bars. */}
      <span aria-hidden className="absolute inset-y-0 left-0 w-[3px] bg-brand/60" />

      <div className="flex items-center gap-3.5">
        <Skeleton className={cn('size-14 shrink-0 rounded-xl', d)} />
        <div className="min-w-0 flex-1 space-y-2">
          <Skeleton className={cn('h-4.5 w-36 max-w-full', d)} />
          <Skeleton className={cn('h-3 w-28 max-w-full', d)} />
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-x-3 gap-y-2 border-t border-line pt-3.5">
        {[0, 1].map((i) => (
          <div key={i} className="space-y-1.5">
            <Skeleton className={cn('h-2.5 w-12', d)} />
            <Skeleton className={cn('h-3.5 w-10', d)} />
          </div>
        ))}
      </div>

      <Skeleton className={cn('mt-4 h-3 w-24', d)} />
    </div>
  );
}

/** The responsive grid of child cards, matching the real one column for column. */
export function ChildGridSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div
      role="status"
      aria-label="Loading your children"
      className="grid grid-cols-1 gap-3 sm:grid-cols-2"
    >
      {Array.from({ length: count }).map((_, i) => (
        <ChildCardSkeleton key={i} index={i} />
      ))}
      <span className="sr-only">Loading your children…</span>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
   GENERIC PANEL — a titled card with n lines of content
   ───────────────────────────────────────────────────────────────────────── */

export function PanelSkeleton({
  rows = 4,
  title = true,
  className,
}: {
  rows?: number;
  title?: boolean;
  className?: string;
}) {
  return (
    <div className={cn('rounded-xl border border-line bg-surface shadow-soft', className)}>
      {title && (
        <div className="border-b border-line px-4 py-3.5">
          <Skeleton className="h-3.5 w-36 max-w-[60%]" />
        </div>
      )}
      <div className="space-y-3 p-4">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex items-center gap-3">
            <Skeleton className={cn('size-9 shrink-0 rounded-lg', delayClass(i))} />
            <div className="flex-1 space-y-1.5">
              <Skeleton className={cn('h-3.5', delayClass(i))} style={{ width: `${72 - i * 7}%` }} />
              <Skeleton className={cn('h-2.5', delayClass(i))} style={{ width: `${48 - i * 5}%` }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
   STAT TILES — traces StatTile's rail + label + figure
   ───────────────────────────────────────────────────────────────────────── */

export function StatTileSkeleton({ index = 0 }: { index?: number }) {
  const d = delayClass(index);
  return (
    <div className="relative overflow-hidden rounded-xl border border-line bg-surface p-4 shadow-soft">
      {/* Neutral, not pigmented: which pigment a tile earns depends on the
          figure that has not arrived yet. */}
      <span aria-hidden className="absolute inset-y-0 left-0 w-[3px] bg-ink-faint/30" />
      <div className="flex items-start justify-between gap-3">
        <Skeleton className={cn('h-2.5 w-24', d)} />
        <Skeleton className={cn('size-8 shrink-0 rounded-lg', d)} />
      </div>
      <Skeleton className={cn('mt-3 h-7 w-20', d)} />
      <Skeleton className={cn('mt-2 h-2.5 w-16', d)} />
    </div>
  );
}

export function StatRowSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {Array.from({ length: count }).map((_, i) => (
        <StatTileSkeleton key={i} index={i} />
      ))}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
   STUDENT RECORD — the whole parent-portal student screen, first paint.
   Identity strip, the section-tab grid, then the panels underneath.
   ───────────────────────────────────────────────────────────────────────── */

export function StudentRecordSkeleton() {
  return (
    <div
      role="status"
      aria-label="Loading student record"
      className="max-w-5xl space-y-4 px-3 py-4 sm:px-5 sm:py-6"
    >
      {/* identity */}
      <div className="rounded-xl border border-line bg-surface p-4 shadow-soft sm:p-5">
        <div className="flex items-center gap-3.5">
          <Skeleton className="size-14 shrink-0 rounded-xl" />
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className="h-5 w-48 max-w-full" />
            <Skeleton className="h-3 w-32 max-w-full skeleton-delay-1" />
          </div>
        </div>
      </div>

      {/* the 12 section tabs */}
      <div className="grid grid-cols-4 gap-2 rounded-xl border border-line bg-surface p-2.5 shadow-soft sm:grid-cols-6 lg:grid-cols-12">
        {Array.from({ length: 12 }).map((_, i) => (
          <div
            key={i}
            className="flex min-h-15 flex-col items-center justify-center gap-1.5 rounded-lg border border-line px-1 py-2"
          >
            <Skeleton className={cn('size-4.5 rounded', delayClass(i))} />
            <Skeleton className={cn('h-2 w-10 max-w-full', delayClass(i))} />
          </div>
        ))}
      </div>

      <StatRowSkeleton count={4} />
      <PanelSkeleton rows={4} />

      <span className="sr-only">Loading student record…</span>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
   SECTION — swapping tabs on a frame that is already on screen.
   Only the panel area is unknown, so only the panel area is drawn.
   ───────────────────────────────────────────────────────────────────────── */

export function SectionSkeleton({ stats = false }: { stats?: boolean }) {
  return (
    <div role="status" aria-label="Loading section" className="animate-fade-in space-y-4">
      {stats && <StatRowSkeleton count={4} />}
      <PanelSkeleton rows={5} />
      <span className="sr-only">Loading…</span>
    </div>
  );
}
