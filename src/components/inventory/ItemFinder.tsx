'use client';

import * as React from 'react';
import useSWR from 'swr';
import toast from 'react-hot-toast';
import { PackageSearch, ScanLine, Search } from 'lucide-react';

import {
  fetchCategories,
  fetchItems,
  lookupItem,
  type InventoryItem,
} from '@/lib/inventory-api';
import { Input, Select } from '@/components/ui/Field';
import { SegmentedControl } from '@/components/ui/FilterBar';
import { Button } from '@/components/ui/button';
import { Money } from '@/components/ui/Money';
import { cn } from '@/lib/utils';
import StableScanner from './StableScanner';
import { useKeyboardWedge } from './useKeyboardWedge';

/* ═══════════════════════════════════════════════════════════════════════════
   THE ONE WAY TO PUT AN ITEM ON A COUNTER SCREEN

   Two ways in, because a counter has two situations:

   • The item is in hand and carries a label — scan it, or type the code.
   • The item is in hand and carries nothing, or the label is torn off, or the
     buyer only knows "the small blue notebook". The code is unavailable, and
     before this the operator was stuck. So: pick a category, type part of the
     name, choose from the list.

   Both funnel to the same `onPick`. The scanner, the USB/Bluetooth wedge and
   the typed code all resolve through /inventory/items/lookup (exact match);
   the browse tab uses /inventory/items?search=&categoryId= (case-insensitive
   partial across name/code/barcode, paginated by the server).
   ═══════════════════════════════════════════════════════════════════════════ */

const RESULT_LIMIT = 20;
const DEBOUNCE_MS = 300;

type FinderTab = 'code' | 'browse';

interface Props {
  /**
   * Called with the chosen item. Return `false` to reject it (the sell counter
   * refuses a line already at its stock ceiling) — the scanner then stays open
   * so the operator can try the next one without reopening the camera.
   */
  onPick: (item: InventoryItem) => boolean | void | Promise<boolean | void>;
  /** Label of the button next to the code box — "Add" at the till, "Find" elsewhere. */
  submitLabel?: string;
  /** Label of the button that opens the camera. */
  scanLabel?: React.ReactNode;
  autoFocus?: boolean;
  className?: string;
}

export default function ItemFinder({
  onPick,
  submitLabel = 'Add',
  scanLabel = 'Open camera scanner',
  autoFocus = false,
  className,
}: Props) {
  const [tab, setTab] = React.useState<FinderTab>('code');

  const [code, setCode] = React.useState('');
  const [scannerOpen, setScannerOpen] = React.useState(false);
  const [lookingUp, setLookingUp] = React.useState(false);

  const [categoryId, setCategoryId] = React.useState('');
  const [term, setTerm] = React.useState('');
  const [debouncedTerm, setDebouncedTerm] = React.useState('');
  const [activeIndex, setActiveIndex] = React.useState(0);

  const codeRef = React.useRef<HTMLInputElement>(null);
  const searchRef = React.useRef<HTMLInputElement>(null);
  const listRef = React.useRef<HTMLUListElement>(null);
  const listboxId = React.useId();

  /* ── Data ──────────────────────────────────────────────────────────────── */

  // Shares SWR's cache key with the catalogue and reports screens, so switching
  // to this tab is usually a render, not a request.
  const { data: categories } = useSWR('/inventory/categories', fetchCategories);

  React.useEffect(() => {
    const timer = setTimeout(() => setDebouncedTerm(term.trim()), DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [term]);

  const category = categoryId ? Number(categoryId) : undefined;
  // A bare category is a legitimate query ("show me the uniforms"); nothing at
  // all is not — an unfiltered dump of the catalogue is not a search result.
  const hasQuery = debouncedTerm.length > 0 || category !== undefined;

  const { data: results, isLoading } = useSWR(
    tab === 'browse' && hasQuery ? ['inventory:item-finder', category ?? 0, debouncedTerm] : null,
    () =>
      fetchItems({
        search: debouncedTerm || undefined,
        categoryId: category,
        isActive: true,
        page: 1,
        limit: RESULT_LIMIT,
      }),
    // Keeps the previous list on screen while the next keystroke's request is
    // in flight — the list stays readable instead of blinking empty per letter.
    { keepPreviousData: true },
  );

  const rows = results?.data ?? [];
  const active = Math.min(activeIndex, Math.max(rows.length - 1, 0));

  /* ── Picking ───────────────────────────────────────────────────────────── */

  const pick = async (item: InventoryItem, { fromScanner = false } = {}): Promise<void> => {
    if (item.availableQty <= 0) {
      toast.error(`"${item.name}" is out of stock`);
      return;
    }
    const accepted = (await onPick(item)) !== false;
    // One scan, one line: the camera is closed on success so the operator sees
    // the change before deciding to scan again. A rejected pick leaves it open.
    if (accepted && fromScanner) setScannerOpen(false);
  };

  // Deliberately NOT memoized: the scanner and the wedge both hold the latest
  // callback in a ref, and this closure must see the caller's current state
  // (the sell counter's cart, for one).
  const submitCode = async (raw: string, opts?: { fromScanner?: boolean }) => {
    const value = raw.trim();
    if (!value) return;
    setLookingUp(true);
    try {
      const item = await lookupItem(value);
      // Cleared only once the code resolved — a typo stays on screen to be
      // corrected. A wedge scan lands in this box too, so this is also what
      // stops the last scanned code from sitting there under the next one.
      setCode('');
      await pick(item, opts);
    } catch {
      toast.error(`No item found for "${value}"`);
    } finally {
      setLookingUp(false);
    }
  };

  // A USB/Bluetooth gun types its payload and presses Enter. It is recognised
  // by timing, not by focus, so it works from either tab — and human typing in
  // the name box is far too slow to be mistaken for it.
  useKeyboardWedge((scanned) => {
    void submitCode(scanned);
  });

  /* ── Keyboard on the browse list ───────────────────────────────────────── */

  // Focus follows the tab the operator chose, but never on first mount — that
  // would fight `autoFocus` and pop the keyboard open on a phone unasked.
  const mountedRef = React.useRef(false);
  React.useEffect(() => {
    if (!mountedRef.current) {
      mountedRef.current = true;
      return;
    }
    (tab === 'code' ? codeRef : searchRef).current?.focus();
  }, [tab]);

  React.useEffect(() => {
    listRef.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' });
  }, [active, rows.length]);

  const onSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      if (!rows.length) return;
      e.preventDefault();
      setActiveIndex((i) =>
        e.key === 'ArrowDown'
          ? Math.min(Math.min(i, rows.length - 1) + 1, rows.length - 1)
          : Math.max(Math.min(i, rows.length - 1) - 1, 0),
      );
      return;
    }
    if (e.key === 'Enter') {
      // Always swallowed: this input can sit inside another form (the issue
      // dialog), and Enter here means "take the highlighted row", never "submit".
      e.preventDefault();
      const row = rows[active];
      if (row) void pick(row);
    }
  };

  /* ── Render ────────────────────────────────────────────────────────────── */

  return (
    <div className={cn('space-y-3', className)}>
      <SegmentedControl
        value={tab}
        onValueChange={(v) => setTab(v)}
        options={[
          { value: 'code', label: 'Scan / code', icon: <ScanLine /> },
          { value: 'browse', label: 'Name / category', icon: <Search /> },
        ]}
        className="max-w-full"
      />

      {tab === 'code' ? (
        <>
          {scannerOpen ? (
            <StableScanner
              onCode={(scanned) => {
                void submitCode(scanned, { fromScanner: true });
              }}
              onClose={() => setScannerOpen(false)}
            />
          ) : (
            <Button type="button" variant="outline" block onClick={() => setScannerOpen(true)}>
              <ScanLine /> {scanLabel}
            </Button>
          )}
          {/* A div, not a form: this can sit inside another form (the issue
              dialog), and a nested <form> is invalid HTML — React warns, and
              Enter submits whichever form the browser guesses. Enter is wired
              by hand so the code box still behaves as one expects. */}
          <div className="flex gap-2">
            <Input
              ref={codeRef}
              value={code}
              onChange={(e) => setCode(e.target.value)}
              onKeyDown={(e) => {
                if (e.key !== 'Enter') return;
                e.preventDefault();
                void submitCode(code);
              }}
              placeholder="Type an item code, or scan with a USB/BT scanner"
              autoFocus={autoFocus}
              aria-label="Item code"
            />
            <Button
              type="button"
              disabled={lookingUp || !code.trim()}
              onClick={() => {
                void submitCode(code);
              }}
            >
              {submitLabel}
            </Button>
          </div>
          <p className="text-[12px] text-ink-muted">
            No code on the item?{' '}
            <button
              type="button"
              onClick={() => setTab('browse')}
              className="cursor-pointer font-semibold text-brand underline-offset-2 hover:underline"
            >
              Search by name or category
            </button>
          </p>
        </>
      ) : (
        <>
          <div className="grid gap-2 sm:grid-cols-[10.5rem_minmax(0,1fr)]">
            <Select
              value={categoryId}
              onChange={(e) => {
                setCategoryId(e.target.value);
                setActiveIndex(0);
              }}
              aria-label="Category"
            >
              <option value="">All categories</option>
              {categories
                ?.filter((c) => c.isActive)
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
            </Select>
            <Input
              ref={searchRef}
              value={term}
              onChange={(e) => {
                setTerm(e.target.value);
                setActiveIndex(0);
              }}
              onKeyDown={onSearchKeyDown}
              placeholder="Type part of the item name…"
              aria-label="Item name"
              role="combobox"
              aria-expanded={rows.length > 0}
              aria-controls={listboxId}
              aria-autocomplete="list"
              aria-activedescendant={rows.length ? `${listboxId}-${active}` : undefined}
            />
          </div>

          {!hasQuery ? (
            <p className="rounded-md border border-dashed border-line-strong px-3 py-4 text-center text-[12.5px] text-ink-muted">
              Pick a category, or type part of the name — matching is partial and ignores case.
            </p>
          ) : isLoading && !results ? (
            <p className="px-1 py-3 text-center text-[12.5px] text-ink-muted">Searching…</p>
          ) : rows.length === 0 ? (
            <p className="rounded-md border border-dashed border-line-strong px-3 py-4 text-center text-[12.5px] text-ink-muted">
              <PackageSearch aria-hidden className="mx-auto mb-1.5 size-4 text-ink-faint" />
              No item matches this search
            </p>
          ) : (
            <>
              <ul
                ref={listRef}
                id={listboxId}
                role="listbox"
                aria-label="Matching items"
                className="max-h-64 divide-y divide-line overflow-y-auto rounded-md border border-line"
              >
                {rows.map((item, i) => {
                  const out = item.availableQty <= 0;
                  return (
                    <li
                      key={item.id}
                      id={`${listboxId}-${i}`}
                      role="option"
                      aria-selected={i === active}
                      aria-disabled={out || undefined}
                      onMouseEnter={() => setActiveIndex(i)}
                      onClick={() => void pick(item)}
                      className={cn(
                        'flex cursor-pointer items-center gap-3 px-3 py-2.5 transition-colors',
                        i === active && 'bg-brand-tint',
                        out && 'cursor-not-allowed opacity-60',
                      )}
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13.5px] font-medium text-ink">{item.name}</p>
                        <p className="truncate text-[12px] text-ink-muted">
                          {item.code}
                          {item.category?.name ? ` · ${item.category.name}` : ''} ·{' '}
                          <Money amount={item.sellingPrice} symbol />
                        </p>
                      </div>
                      <span
                        className={cn(
                          'tabular shrink-0 rounded-full bg-surface-inset px-2 py-0.5 text-[11px] font-semibold',
                          out ? 'text-accent-warn-deep' : 'text-ink-muted',
                        )}
                      >
                        {out ? 'Out of stock' : `${item.availableQty} left`}
                      </span>
                    </li>
                  );
                })}
              </ul>
              {results && results.total > rows.length && (
                <p className="text-[12px] text-ink-muted">
                  Showing the first {rows.length} of {results.total} matches — narrow the search to
                  see the rest.
                </p>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}
