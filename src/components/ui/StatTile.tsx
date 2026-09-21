import * as React from 'react';
import { cn } from '@/lib/utils';
import { PIGMENT_CLASS, type Pigment } from './pigment';

interface StatTileProps extends React.HTMLAttributes<HTMLDivElement> {
  /** What the figure is. Set in mono micro-caps — it labels, nothing more. */
  label?: React.ReactNode;
  /** Alias for `label`, kept so existing call sites keep working. */
  title?: string;
  value: React.ReactNode;
  /** A short line under the figure: comparison, breakdown, or the next step. */
  hint?: React.ReactNode;
  /** The signed change. Coloured by `deltaTone`, not by guessing the sign. */
  delta?: React.ReactNode;
  deltaTone?: 'up' | 'down' | 'flat';
  /** Alias for `deltaTone`, kept so existing call sites keep working. */
  deltaType?: 'positive' | 'negative' | 'neutral';
  icon?: React.ReactNode;
  /** Which pigment rails the tile. Defaults to info — see pigment.ts. */
  pigment?: Pigment;
  /** Optional footer, e.g. a mini bar or sparkline. */
  children?: React.ReactNode;
  /** Tighter padding, smaller value type, no hint row — for dense rows like the main dashboard. */
  compact?: boolean;
}

/**
 * A single figure. The pigment rail down the left edge is what makes a row of
 * tiles readable at a glance: collected is sage, outstanding is marigold,
 * overdue is vermilion — you read the colours before you read the numbers.
 */
export const StatTile = React.forwardRef<HTMLDivElement, StatTileProps>(
  (
    {
      label,
      title,
      value,
      hint,
      delta,
      deltaTone,
      deltaType,
      icon,
      pigment = 'info',
      className,
      children,
      compact = false,
      ...props
    },
    ref,
  ) => {
    const p = PIGMENT_CLASS[pigment];
    const interactive = Boolean(props.onClick);
    const tone =
      deltaTone ??
      (deltaType === 'positive' ? 'up' : deltaType === 'negative' ? 'down' : 'flat');

    return (
      <div
        ref={ref}
        className={cn(
          'relative overflow-hidden rounded-xl border border-line bg-surface shadow-soft transition-all',
          compact ? 'px-3 py-2.5' : 'px-4 py-3.5',
          interactive && 'cursor-pointer hover:-translate-y-0.5 hover:shadow-raised',
          className,
        )}
        {...props}
      >
        <span aria-hidden className={cn('absolute top-0 bottom-0 left-0 w-0.75', p.rail)} />

        <div className="flex items-start justify-between gap-2">
          <p className="eyebrow">{label ?? title}</p>
          {icon && (
            <div
              className={cn(
                'grid size-8 shrink-0 place-items-center rounded-md [&_svg]:size-4',
                p.tint,
                p.text,
              )}
            >
              {icon}
            </div>
          )}
        </div>

        <div
          className={cn(
            'tabular font-display leading-none font-semibold tracking-tight text-ink',
            compact ? 'mt-1 text-[19px]' : 'mt-1.5 text-[24px] sm:text-[28px]',
          )}
        >
          {value}
        </div>

        {!compact && (hint || delta) && (
          <div className="mt-2 flex flex-wrap items-center gap-x-1.5 text-[12.5px] text-ink-muted">
            {delta && (
              <span
                className={cn(
                  'tabular font-semibold',
                  tone === 'up' && 'text-accent-success-deep',
                  tone === 'down' && 'text-accent-danger-deep',
                  tone === 'flat' && 'text-ink-muted',
                )}
              >
                {delta}
              </span>
            )}
            {hint}
          </div>
        )}

        {children && <div className="mt-2.5">{children}</div>}
      </div>
    );
  },
);
StatTile.displayName = 'StatTile';

/**
 * The row of tiles at the top of a page. Two columns on a phone, filling the
 * width on a desktop — one grid, so every page's tiles line up with each other.
 */
export function StatGrid({
  children,
  className,
  columns = 4,
}: {
  children: React.ReactNode;
  className?: string;
  columns?: 2 | 3 | 4 | 5;
}) {
  return (
    <div
      className={cn(
        'grid grid-cols-2 gap-2.5 sm:gap-3',
        columns === 2 && 'sm:grid-cols-2',
        columns === 3 && 'sm:grid-cols-3',
        columns === 4 && 'sm:grid-cols-2 lg:grid-cols-4',
        columns === 5 && 'sm:grid-cols-3 lg:grid-cols-5',
        className,
      )}
    >
      {children}
    </div>
  );
}
