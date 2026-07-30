import * as React from 'react';
import { cn } from '@/lib/utils';
import { PIGMENT_CLASS, humanizeStatus, pigmentFor, type Pigment } from './pigment';

interface StatusChipProps extends React.HTMLAttributes<HTMLSpanElement> {
  /** The domain status — `PAID`, `pending_approval`, `Absent`. Resolved via pigmentFor(). */
  status?: string | null;
  /** Override the resolved pigment when the word alone isn't enough context. */
  pigment?: Pigment;
  /** Override the displayed text. Defaults to a humanised `status`. */
  label?: React.ReactNode;
  size?: 'sm' | 'md';
  /** Hide the dot for very tight cells. Keep it wherever there's room. */
  hideDot?: boolean;
  icon?: React.ReactNode;
}

/**
 * The one status badge. Never colour alone: a chip is always a dot plus a
 * word, so it survives colour blindness, greyscale printing, and a projector.
 */
export function StatusChip({
  status,
  pigment,
  label,
  size = 'sm',
  hideDot = false,
  icon,
  className,
  ...props
}: StatusChipProps) {
  const resolved = pigment ?? pigmentFor(status);
  const p = PIGMENT_CLASS[resolved];

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border font-semibold whitespace-nowrap',
        size === 'sm' ? 'px-2 py-0.5 text-[11.5px]' : 'px-2.5 py-1 text-xs',
        p.chip,
        className,
      )}
      {...props}
    >
      {icon
        ? <span className="shrink-0 [&_svg]:size-3">{icon}</span>
        : !hideDot && <span aria-hidden className={cn('size-1.5 shrink-0 rounded-full', p.dot)} />}
      {label ?? humanizeStatus(status)}
    </span>
  );
}

/**
 * A count paired with a status word — "18 overdue". Used in filter bars and
 * table toolbars where the number is the point and the word is the qualifier.
 */
export function StatusCount({
  status,
  pigment,
  count,
  label,
  className,
  ...props
}: StatusChipProps & { count: number | string }) {
  const resolved = pigment ?? pigmentFor(status);
  const p = PIGMENT_CLASS[resolved];
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11.5px]',
        p.chip,
        className,
      )}
      {...props}
    >
      <span aria-hidden className={cn('size-1.5 shrink-0 rounded-full', p.dot)} />
      <span className="tabular font-semibold">{count}</span>
      <span className="font-medium opacity-80">{label ?? humanizeStatus(status)}</span>
    </span>
  );
}
