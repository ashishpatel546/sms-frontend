'use client';

import * as React from 'react';
import { ArrowDown, ArrowUp, ChevronsUpDown, Inbox } from 'lucide-react';
import { cn } from '@/lib/utils';
import { naturalCompare } from '@/lib/utils';
import { Skeleton } from './skeleton';

/* ═══════════════════════════════════════════════════════════════════════════
   THE TABLE

   Every list of records in the app renders through this. It exists because
   thirty-five pages each hand-rolled their own <table> — with their own idea
   of what a header, an empty state and a loading row looked like.

   What it handles so no page has to:
     · sorting (natural, so "Class 2" precedes "Class 10")
     · the register's margin rule, and flagged / selected rows
     · a sticky header for long registers
     · a card layout below `md` — a 9-column ledger cannot be read on a phone,
       so on mobile each row becomes a card built from the same column config
     · loading, empty and error states
     · row click / row actions, with keyboard access
   ═══════════════════════════════════════════════════════════════════════════ */

export interface Column<T> {
  /** Stable key. Also the sort key and the mobile-card label key. */
  key: string;
  header: React.ReactNode;
  /** Read the cell value. Omit when using `render` for composed cells. */
  accessor?: (row: T) => React.ReactNode;
  render?: (row: T, index: number) => React.ReactNode;
  /** Value used for sorting when it differs from what's displayed. */
  sortValue?: (row: T) => string | number | null | undefined;
  sortable?: boolean;
  align?: 'left' | 'right' | 'center';
  /** Extra classes on both the th and the td. */
  className?: string;
  headerClassName?: string;
  cellClassName?: string;
  /** Hide below the given breakpoint on desktop layout. */
  hideBelow?: 'sm' | 'md' | 'lg' | 'xl';
  /**
   * How the column behaves in the mobile card:
   *   'title'   the card's headline (first such column wins)
   *   'meta'    the small line under the headline
   *   'field'   a labelled row in the card body (default)
   *   'trailing' pinned to the top-right — usually a status chip
   *   'hidden'  omitted from the card
   */
  card?: 'title' | 'meta' | 'field' | 'trailing' | 'hidden';
  /** Fixed width, e.g. 'w-24'. */
  width?: string;
}

export interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[] | null | undefined;
  /** Stable React key per row. Strongly preferred over the array index. */
  rowKey?: (row: T, index: number) => string | number;
  loading?: boolean;
  error?: string | null;
  /** Shown when there is no data. A string, or a full <EmptyState/>. */
  empty?: React.ReactNode;
  emptyMessage?: string;
  /** Default sort on first render. */
  defaultSort?: { key: string; direction?: 'asc' | 'desc' };
  onRowClick?: (row: T, index: number) => void;
  /** Paint the marigold margin rule — "this row wants attention". */
  isRowFlagged?: (row: T) => boolean;
  isRowSelected?: (row: T) => boolean;
  /** Toolbar above the table: title, counts, search, filters. */
  toolbar?: React.ReactNode;
  /** Footer below the table: pagination, totals. */
  footer?: React.ReactNode;
  /** Rendered after the last row — a totals row, for example. */
  tableFooter?: React.ReactNode;
  /** Freeze the header while the body scrolls. Give the wrapper a max height. */
  stickyHeader?: boolean;
  /** Max height of the scroll area, e.g. '70vh'. Implies stickyHeader. */
  maxHeight?: string;
  /** Keep the real table on small screens instead of switching to cards. */
  disableMobileCards?: boolean;
  dense?: boolean;
  className?: string;
  /** Rows to show while loading. */
  skeletonRows?: number;
}

const alignClass = {
  left: 'text-left',
  right: 'text-right',
  center: 'text-center',
} as const;

const hideBelowClass = {
  sm: 'hidden sm:table-cell',
  md: 'hidden md:table-cell',
  lg: 'hidden lg:table-cell',
  xl: 'hidden xl:table-cell',
} as const;

function cellContent<T>(col: Column<T>, row: T, index: number): React.ReactNode {
  if (col.render) return col.render(row, index);
  if (col.accessor) return col.accessor(row);
  return '—';
}

/** Sort comparator: numbers numerically, everything else naturally. */
function compare(a: unknown, b: unknown): number {
  if (a === b) return 0;
  if (a === null || a === undefined || a === '') return 1; // blanks sink
  if (b === null || b === undefined || b === '') return -1;
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  const na = Number(a);
  const nb = Number(b);
  if (!Number.isNaN(na) && !Number.isNaN(nb)) return na - nb;
  return naturalCompare(String(a), String(b));
}

export function DataTable<T>({
  columns,
  data,
  rowKey,
  loading = false,
  error = null,
  empty,
  emptyMessage = 'Nothing here yet',
  defaultSort,
  onRowClick,
  isRowFlagged,
  isRowSelected,
  toolbar,
  footer,
  tableFooter,
  stickyHeader = false,
  maxHeight,
  disableMobileCards = false,
  dense = false,
  className,
  skeletonRows = 5,
}: DataTableProps<T>) {
  const [sort, setSort] = React.useState<{ key: string; direction: 'asc' | 'desc' } | null>(
    defaultSort ? { key: defaultSort.key, direction: defaultSort.direction ?? 'asc' } : null,
  );

  const rows = React.useMemo(() => {
    const list = data ?? [];
    if (!sort) return list;
    const col = columns.find((c) => c.key === sort.key);
    if (!col) return list;
    const read = (row: T) => {
      if (col.sortValue) return col.sortValue(row);
      if (col.accessor) {
        const v = col.accessor(row);
        return typeof v === 'string' || typeof v === 'number' ? v : null;
      }
      return null;
    };
    return [...list].sort((a, b) => {
      const result = compare(read(a), read(b));
      return sort.direction === 'asc' ? result : -result;
    });
  }, [data, sort, columns]);

  const toggleSort = (key: string) => {
    setSort((prev) =>
      prev?.key === key
        ? { key, direction: prev.direction === 'asc' ? 'desc' : 'asc' }
        : { key, direction: 'asc' },
    );
  };

  const pad = dense ? 'px-3 py-2' : 'px-4 py-3';
  const headPad = dense ? 'px-3 py-2' : 'px-4 py-2.5';
  const isEmpty = !loading && !error && rows.length === 0;

  /* ── Header cells, shared by desktop table ──────────────────────────── */
  const head = (
    <tr>
      {columns.map((col) => {
        const sorted = sort?.key === col.key;
        return (
          <th
            key={col.key}
            scope="col"
            aria-sort={sorted ? (sort!.direction === 'asc' ? 'ascending' : 'descending') : undefined}
            className={cn(
              headPad,
              'bg-surface-inset border-b border-line-strong',
              'font-mono text-[10.5px] font-semibold tracking-widest whitespace-nowrap uppercase',
              sorted ? 'text-ink' : 'text-ink-faint',
              alignClass[col.align ?? 'left'],
              col.hideBelow && hideBelowClass[col.hideBelow],
              col.width,
              col.className,
              col.headerClassName,
            )}
          >
            {col.sortable ? (
              <button
                type="button"
                onClick={() => toggleSort(col.key)}
                className={cn(
                  'group/sort inline-flex cursor-pointer items-center gap-1.5 rounded-sm transition-colors hover:text-brand',
                  col.align === 'right' && 'flex-row-reverse',
                )}
              >
                {col.header}
                {sorted ? (
                  sort!.direction === 'asc' ? (
                    <ArrowUp className="size-3 text-brand" />
                  ) : (
                    <ArrowDown className="size-3 text-brand" />
                  )
                ) : (
                  <ChevronsUpDown className="size-3 opacity-0 transition-opacity group-hover/sort:opacity-60" />
                )}
              </button>
            ) : (
              col.header
            )}
          </th>
        );
      })}
    </tr>
  );

  /* ── States ─────────────────────────────────────────────────────────── */
  const stateBlock = (content: React.ReactNode) => (
    <div className="px-4 py-14 text-center">{content}</div>
  );

  const errorState = stateBlock(
    <div className="mx-auto max-w-sm">
      <div className="mx-auto mb-3 grid size-10 place-items-center rounded-lg bg-accent-danger-tint text-accent-danger-deep">
        <Inbox className="size-5" />
      </div>
      <p className="font-display font-semibold text-ink">That didn&apos;t load</p>
      <p className="mt-1 text-sm text-ink-muted">{error}</p>
    </div>,
  );

  const emptyState =
    empty ??
    stateBlock(
      <div className="mx-auto max-w-sm">
        <div className="mx-auto mb-3 grid size-10 place-items-center rounded-lg bg-surface-secondary text-ink-faint">
          <Inbox className="size-5" />
        </div>
        <p className="font-display font-semibold text-ink">{emptyMessage}</p>
      </div>,
    );

  /* ── Mobile cards ───────────────────────────────────────────────────────
     A 9-column ledger is unreadable on a 390px screen, so below `md` each row
     is rebuilt as a card from the same column config — no second markup path
     for a page to keep in sync. */
  const titleCol = columns.find((c) => c.card === 'title');
  const metaCols = columns.filter((c) => c.card === 'meta');
  const trailingCols = columns.filter((c) => c.card === 'trailing');
  const fieldCols = columns.filter(
    (c) => c.card !== 'hidden' && c.card !== 'title' && c.card !== 'meta' && c.card !== 'trailing',
  );

  const mobileCards = (
    <ul className="divide-y divide-line md:hidden" role="list">
      {rows.map((row, index) => {
        const flagged = isRowFlagged?.(row) ?? false;
        const selected = isRowSelected?.(row) ?? false;
        const interactive = Boolean(onRowClick);
        return (
          <li key={rowKey ? rowKey(row, index) : index}>
            <div
              role={interactive ? 'button' : undefined}
              tabIndex={interactive ? 0 : undefined}
              onClick={interactive ? () => onRowClick!(row, index) : undefined}
              onKeyDown={
                interactive
                  ? (e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        onRowClick!(row, index);
                      }
                    }
                  : undefined
              }
              className={cn(
                'relative px-4 py-3 transition-colors',
                interactive && 'cursor-pointer active:bg-brand-tint',
                selected && 'bg-brand-tint',
              )}
            >
              {/* the margin rule, kept on the card edge */}
              <span
                aria-hidden
                className={cn(
                  'absolute top-0 bottom-0 left-0 w-0.5',
                  flagged ? 'bg-accent-warn' : selected ? 'bg-brand' : 'bg-line-strong',
                )}
              />
              <div className="flex items-start gap-3">
                <div className="min-w-0 flex-1">
                  {titleCol && (
                    <div className="truncate font-semibold text-ink">
                      {cellContent(titleCol, row, index)}
                    </div>
                  )}
                  {metaCols.length > 0 && (
                    <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-ink-muted">
                      {metaCols.map((col) => (
                        <span key={col.key} className="truncate">
                          {cellContent(col, row, index)}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                {trailingCols.length > 0 && (
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    {trailingCols.map((col) => (
                      <div key={col.key}>{cellContent(col, row, index)}</div>
                    ))}
                  </div>
                )}
              </div>
              {fieldCols.length > 0 && (
                <dl className="mt-2.5 grid grid-cols-2 gap-x-3 gap-y-1.5 border-t border-line pt-2.5">
                  {fieldCols.map((col) => (
                    <div key={col.key} className="min-w-0">
                      <dt className="eyebrow truncate text-[9.5px]">{col.header}</dt>
                      <dd className="truncate text-[13px] text-ink">
                        {cellContent(col, row, index)}
                      </dd>
                    </div>
                  ))}
                </dl>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );

  const skeletonBody = (
    <tbody>
      {Array.from({ length: skeletonRows }).map((_, r) => (
        <tr key={r} className="border-b border-line">
          {columns.map((col) => (
            <td
              key={col.key}
              className={cn(pad, col.hideBelow && hideBelowClass[col.hideBelow])}
            >
              <Skeleton className={cn('h-4', r % 2 ? 'w-3/5' : 'w-4/5')} />
            </td>
          ))}
        </tr>
      ))}
    </tbody>
  );

  return (
    <section
      className={cn(
        'overflow-hidden rounded-xl border border-line bg-surface shadow-soft',
        className,
      )}
    >
      {toolbar && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-line bg-surface-secondary px-4 py-3">
          {toolbar}
        </div>
      )}

      {error ? (
        errorState
      ) : (
        <>
          {/* ── Desktop / tablet: the real table ── */}
          <div
            className={cn(
              'overflow-x-auto',
              disableMobileCards ? 'block' : 'hidden md:block',
              (stickyHeader || maxHeight) && 'overflow-y-auto',
            )}
            style={maxHeight ? { maxHeight } : undefined}
          >
            <table className="w-full border-collapse">
              <thead className={cn(stickyHeader || maxHeight ? 'sticky top-0 z-10' : '')}>
                {head}
              </thead>
              {loading ? (
                skeletonBody
              ) : (
                <tbody>
                  {rows.map((row, index) => {
                    const flagged = isRowFlagged?.(row) ?? false;
                    const selected = isRowSelected?.(row) ?? false;
                    return (
                      <tr
                        key={rowKey ? rowKey(row, index) : index}
                        data-flagged={flagged || undefined}
                        data-selected={selected || undefined}
                        onClick={onRowClick ? () => onRowClick(row, index) : undefined}
                        tabIndex={onRowClick ? 0 : undefined}
                        onKeyDown={
                          onRowClick
                            ? (e) => {
                                if (e.key === 'Enter') onRowClick(row, index);
                              }
                            : undefined
                        }
                        className={cn(
                          'ruled-row border-b border-line transition-colors last:border-0',
                          onRowClick && 'cursor-pointer',
                          selected ? 'bg-brand-tint' : 'hover:bg-brand-tint/60',
                        )}
                      >
                        {columns.map((col) => (
                          <td
                            key={col.key}
                            className={cn(
                              pad,
                              'text-[13.5px] align-middle',
                              alignClass[col.align ?? 'left'],
                              col.hideBelow && hideBelowClass[col.hideBelow],
                              col.className,
                              col.cellClassName,
                            )}
                          >
                            {cellContent(col, row, index)}
                          </td>
                        ))}
                      </tr>
                    );
                  })}
                </tbody>
              )}
              {tableFooter && !loading && rows.length > 0 && (
                <tfoot className="border-t-2 border-line-strong bg-surface-secondary font-semibold">
                  {tableFooter}
                </tfoot>
              )}
            </table>
            {isEmpty && emptyState}
          </div>

          {/* ── Mobile: the same rows as cards ── */}
          {!disableMobileCards && (
            <div className="md:hidden">
              {loading ? (
                <div className="divide-y divide-line">
                  {Array.from({ length: skeletonRows }).map((_, r) => (
                    <div key={r} className="space-y-2 px-4 py-3.5">
                      <Skeleton className="h-4 w-2/5" />
                      <Skeleton className="h-3 w-3/5" />
                    </div>
                  ))}
                </div>
              ) : isEmpty ? (
                emptyState
              ) : (
                mobileCards
              )}
            </div>
          )}
        </>
      )}

      {footer && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-line bg-surface-secondary px-4 py-2.5 text-[12.5px] text-ink-muted">
          {footer}
        </div>
      )}
    </section>
  );
}

/* ── Toolbar furniture ─────────────────────────────────────────────────── */

export function TableTitle({ children }: { children: React.ReactNode }) {
  return <span className="font-display text-[15px] font-semibold text-ink">{children}</span>;
}

/** The row count pill that sits next to a table title. */
export function TableCount({ children }: { children: React.ReactNode }) {
  return (
    <span className="tabular rounded-full border border-line bg-surface px-2 py-0.5 text-[11.5px] text-ink-muted">
      {children}
    </span>
  );
}
