import * as React from 'react';
import { cn } from '@/lib/utils';

/**
 * en-IN grouping — 8,42,500, not 842,500. Amounts in this app are rupees a
 * clerk reads aloud at a counter, so they group the way the counter does.
 */
export function formatINR(
  amount: number | string | null | undefined,
  opts: { decimals?: boolean; symbol?: boolean } = {},
): string {
  const { decimals = false, symbol = false } = opts;
  const n = typeof amount === 'string' ? Number(amount) : amount;
  if (n === null || n === undefined || Number.isNaN(n)) return '—';
  const body = n.toLocaleString('en-IN', {
    minimumFractionDigits: decimals ? 2 : 0,
    maximumFractionDigits: decimals ? 2 : 0,
  });
  return symbol ? `₹${body}` : body;
}

/** 842500 → "8.43L", 12500000 → "1.25Cr". For stat tiles, never for ledgers. */
export function formatINRShort(amount: number | null | undefined): string {
  const n = Number(amount);
  if (!Number.isFinite(n)) return '—';
  const abs = Math.abs(n);
  const sign = n < 0 ? '-' : '';
  if (abs >= 1_00_00_000) return `${sign}${(abs / 1_00_00_000).toFixed(2)}Cr`;
  if (abs >= 1_00_000) return `${sign}${(abs / 1_00_000).toFixed(2)}L`;
  if (abs >= 1_000) return `${sign}${(abs / 1_000).toFixed(1)}K`;
  return `${sign}${abs}`;
}

interface MoneyProps extends React.HTMLAttributes<HTMLSpanElement> {
  amount: number | string | null | undefined;
  /** Show the ₹ symbol. Off inside a column already headed "Amount (₹)". */
  symbol?: boolean;
  decimals?: boolean;
  /** Abbreviate to L / Cr. Stat tiles only — a ledger must show exact paise. */
  short?: boolean;
  /** Colour by sign or by intent: a balance owing reads as attention. */
  tone?: 'default' | 'muted' | 'owing' | 'overdue' | 'settled';
}

/**
 * Every rupee figure in the app. Mono + tabular figures so columns of amounts
 * stack into a column instead of drifting — the whole reason numbers get their
 * own face in this system.
 */
export function Money({
  amount,
  symbol = false,
  decimals = false,
  short = false,
  tone = 'default',
  className,
  ...props
}: MoneyProps) {
  const text = short
    ? `${symbol ? '₹' : ''}${formatINRShort(typeof amount === 'string' ? Number(amount) : amount)}`
    : formatINR(amount, { decimals, symbol });

  return (
    <span
      className={cn(
        'tabular',
        tone === 'muted' && 'text-ink-muted',
        tone === 'owing' && 'font-semibold text-accent-warn-deep',
        tone === 'overdue' && 'font-semibold text-accent-danger-deep',
        tone === 'settled' && 'text-accent-success-deep',
        className,
      )}
      {...props}
    >
      {text}
    </span>
  );
}

/** A plain number that should still align in a column — counts, roll numbers. */
export function Num({
  value,
  className,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { value: number | string | null | undefined }) {
  const n = typeof value === 'string' ? value : value;
  return (
    <span className={cn('tabular', className)} {...props}>
      {n === null || n === undefined || n === '' ? '—' : typeof n === 'number' ? n.toLocaleString('en-IN') : n}
    </span>
  );
}
