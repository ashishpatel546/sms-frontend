'use client';

import * as React from 'react';
import { Search, X } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * The strip of controls above a list: search, a few selects, maybe a date
 * range. One component so filters sit in the same place, at the same height,
 * on every page — and so nothing needs a bespoke toolbar again.
 */
export function FilterBar({
  children,
  className,
  actions,
}: {
  children: React.ReactNode;
  className?: string;
  /** Pushed to the right — export, bulk actions. */
  actions?: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        'flex flex-wrap items-end gap-2.5 rounded-xl border border-line bg-surface p-3 shadow-soft sm:gap-3',
        className,
      )}
    >
      {children}
      {actions && <div className="ml-auto flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

/**
 * The search input. Debouncing stays with the caller — how long to wait
 * depends on whether the filter is local or a request.
 */
export function SearchInput({
  value,
  onValueChange,
  placeholder = 'Search…',
  className,
  ...props
}: Omit<React.ComponentProps<'input'>, 'onChange' | 'value'> & {
  value: string;
  onValueChange: (value: string) => void;
}) {
  return (
    <div className={cn('relative min-w-0 flex-1 sm:max-w-72', className)}>
      <Search
        aria-hidden
        className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-faint"
      />
      <input
        type="search"
        value={value}
        onChange={(e) => onValueChange(e.target.value)}
        placeholder={placeholder}
        className="h-11 w-full rounded-md border border-line-strong bg-surface pr-9 pl-9 text-[14px] text-ink transition-colors placeholder:text-ink-faint focus:border-brand focus:ring-3 focus:ring-brand/16 focus:outline-none sm:h-10 [&::-webkit-search-cancel-button]:hidden"
        {...props}
      />
      {value && (
        <button
          type="button"
          onClick={() => onValueChange('')}
          aria-label="Clear search"
          className="absolute top-1/2 right-2.5 grid size-6 -translate-y-1/2 cursor-pointer place-items-center rounded text-ink-faint transition-colors hover:bg-surface-secondary hover:text-ink"
        >
          <X className="size-3.5" />
        </button>
      )}
    </div>
  );
}

/** A labelled filter control. The label is mono micro-caps, like a form field. */
export function FilterField({
  label,
  children,
  className,
  width = 'auto',
}: {
  label: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  width?: 'auto' | 'sm' | 'md' | 'lg' | 'full';
}) {
  return (
    <div
      className={cn(
        'min-w-0',
        width === 'sm' && 'w-28',
        width === 'md' && 'w-40',
        width === 'lg' && 'w-56',
        width === 'full' && 'w-full',
        className,
      )}
    >
      <span className="eyebrow mb-1.5 block">{label}</span>
      {children}
    </div>
  );
}

/**
 * A segmented control for a small, fixed set of choices — a term, a payment
 * mode, present/absent/late. Better than a select when the options matter
 * enough to stay visible.
 */
export function SegmentedControl<T extends string>({
  value,
  onValueChange,
  options,
  className,
  size = 'md',
}: {
  value: T;
  onValueChange: (value: T) => void;
  options: { value: T; label: React.ReactNode; icon?: React.ReactNode }[];
  className?: string;
  size?: 'sm' | 'md';
}) {
  return (
    <div
      role="tablist"
      className={cn(
        'inline-flex items-center gap-0.5 rounded-lg border border-line bg-surface-secondary p-0.5',
        className,
      )}
    >
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onValueChange(opt.value)}
            className={cn(
              'inline-flex cursor-pointer items-center gap-1.5 rounded-md font-semibold whitespace-nowrap transition-all [&_svg]:size-3.5',
              size === 'sm' ? 'h-7 px-2.5 text-[12px]' : 'h-9 px-3 text-[13px]',
              active
                ? 'bg-surface text-ink shadow-soft'
                : 'text-ink-muted hover:text-ink',
            )}
          >
            {opt.icon}
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

/**
 * Page-level tabs, pinned to the bottom edge of a PageHeader. The active tab
 * is marked with a lapis underline that slides — the same marker language as
 * the nav rail.
 */
export function PageTabs<T extends string>({
  value,
  onValueChange,
  options,
  className,
}: {
  value: T;
  onValueChange: (value: T) => void;
  options: { value: T; label: React.ReactNode; count?: number; icon?: React.ReactNode }[];
  className?: string;
}) {
  return (
    <div
      role="tablist"
      className={cn('no-scrollbar -mb-px flex gap-1 overflow-x-auto', className)}
    >
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onValueChange(opt.value)}
            className={cn(
              'relative inline-flex shrink-0 cursor-pointer items-center gap-1.5 border-b-2 px-3 py-2.5 text-[13.5px] font-semibold whitespace-nowrap transition-colors [&_svg]:size-4',
              active
                ? 'border-brand text-brand'
                : 'border-transparent text-ink-muted hover:border-line-strong hover:text-ink',
            )}
          >
            {opt.icon}
            {opt.label}
            {opt.count !== undefined && (
              <span
                className={cn(
                  'tabular rounded-full px-1.5 py-px text-[10.5px]',
                  active ? 'bg-brand-tint text-brand' : 'bg-surface-inset text-ink-muted',
                )}
              >
                {opt.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

/**
 * Pagination. Shows the range in words as well as the page numbers, because
 * "1–25 of 412" is the thing a clerk actually reads.
 */
export function Pagination({
  page,
  pageCount,
  onPageChange,
  total,
  pageSize,
  className,
}: {
  /** 1-based. */
  page: number;
  pageCount: number;
  onPageChange: (page: number) => void;
  total?: number;
  pageSize?: number;
  className?: string;
}) {
  if (pageCount <= 1 && !total) return null;

  const from = pageSize ? (page - 1) * pageSize + 1 : undefined;
  const to = pageSize && total ? Math.min(page * pageSize, total) : undefined;

  // Windowed page numbers: first, last, and two either side of the current.
  const pages: (number | '…')[] = [];
  for (let p = 1; p <= pageCount; p++) {
    if (p === 1 || p === pageCount || Math.abs(p - page) <= 1) pages.push(p);
    else if (pages[pages.length - 1] !== '…') pages.push('…');
  }

  return (
    <div className={cn('flex w-full flex-wrap items-center gap-x-3 gap-y-2', className)}>
      {total !== undefined && (
        <span className="text-[12.5px] text-ink-muted">
          {from && to ? (
            <>
              Showing <span className="tabular text-ink">{from}–{to}</span> of{' '}
              <span className="tabular text-ink">{total.toLocaleString('en-IN')}</span>
            </>
          ) : (
            <>
              <span className="tabular text-ink">{total.toLocaleString('en-IN')}</span> records
            </>
          )}
        </span>
      )}

      {pageCount > 1 && (
        <nav aria-label="Pagination" className="ml-auto flex items-center gap-1">
          <PageButton onClick={() => onPageChange(page - 1)} disabled={page <= 1} label="Previous">
            ‹
          </PageButton>
          {pages.map((p, i) =>
            p === '…' ? (
              <span key={`gap-${i}`} className="tabular px-1 text-[12px] text-ink-faint">
                …
              </span>
            ) : (
              <PageButton
                key={p}
                onClick={() => onPageChange(p)}
                active={p === page}
                label={`Page ${p}`}
              >
                {p}
              </PageButton>
            ),
          )}
          <PageButton
            onClick={() => onPageChange(page + 1)}
            disabled={page >= pageCount}
            label="Next"
          >
            ›
          </PageButton>
        </nav>
      )}
    </div>
  );
}

function PageButton({
  children,
  onClick,
  active,
  disabled,
  label,
}: {
  children: React.ReactNode;
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'tabular grid size-8 cursor-pointer place-items-center rounded-md border text-[12.5px] transition-colors',
        active
          ? 'border-rail bg-rail font-semibold text-white'
          : 'border-line-strong bg-surface text-ink hover:border-brand hover:text-brand',
        disabled && 'cursor-not-allowed opacity-40 hover:border-line-strong hover:text-ink',
      )}
    >
      {children}
    </button>
  );
}
