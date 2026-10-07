import * as React from 'react';
import { useTranslations } from 'next-intl';
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
 * The status word for a chip given no label: the shared `common.status`
 * translation when there is one (PAID → paid, HALF_DAY → halfDay), else the
 * humanised code. Screens pass their own `label` for anything more specific.
 */
function useStatusWord(status: string | null | undefined): string {
  const t = useTranslations('common.status');
  if (!status) return humanizeStatus(status);
  const key = String(status)
    .toLowerCase()
    .replace(/[_\s-]+([a-z])/g, (_, c: string) => c.toUpperCase()) as Parameters<typeof t>[0];
  return t.has(key) ? t(key) : humanizeStatus(status);
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
  const word = useStatusWord(status);

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
      {label ?? word}
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
  const word = useStatusWord(status);
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
      <span className="font-medium opacity-80">{label ?? word}</span>
    </span>
  );
}
