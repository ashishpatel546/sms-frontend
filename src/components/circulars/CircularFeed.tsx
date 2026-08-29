'use client';

import * as React from 'react';
import useSWR from 'swr';
import { ChevronLeft, ChevronRight, ScrollText, SearchX } from 'lucide-react';
import {
  CIRCULAR_PAGE_SIZE,
  fetchCirculars,
  type Circular,
} from '@/lib/circulars-api';
import { CircularCard } from './CircularCard';
import { CircularReader } from './CircularReader';
import { EmptyState, ErrorState } from '@/components/ui/EmptyState';
import { FilterBar, SearchInput } from '@/components/ui/FilterBar';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/Field';
import { useRbac } from '@/lib/rbac';

/** Long enough that a phone keyboard isn't firing a request per keystroke. */
const SEARCH_DEBOUNCE_MS = 300;

/**
 * THE CIRCULARS FEED — search, list, pagination and the reader.
 *
 * Both portals mount this same component: a circular says the same thing to a
 * parent and to a teacher, so the only sane way to keep the two views honest
 * is to have one of them. What differs is the chrome around it, which is the
 * page's business, and the empty-state copy, which is a prop.
 */
export function CircularFeed({
  emptyTitle = 'No circulars yet',
  emptyDescription,
  emptyAction,
}: {
  emptyTitle?: string;
  emptyDescription: string;
  emptyAction?: React.ReactNode;
}) {
  const rbac = useRbac();
  const [searchInput, setSearchInput] = React.useState('');
  const [search, setSearch] = React.useState('');
  const [page, setPage] = React.useState(1);
  const [includeArchived, setIncludeArchived] = React.useState(false);
  const [reading, setReading] = React.useState<Circular | null>(null);

  // Debounce the typed term into the one the query keys off, and go back to
  // page 1 whenever it changes — page 4 of the old result set means nothing
  // against the new one.
  React.useEffect(() => {
    const t = setTimeout(() => {
      setSearch(searchInput);
      setPage(1);
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [searchInput]);

  const query = {
    search: search || undefined,
    page,
    limit: CIRCULAR_PAGE_SIZE,
    includeArchived: includeArchived || undefined,
  };
  const { data, error, isLoading, mutate } = useSWR(
    ['circulars', search, page, includeArchived],
    () => fetchCirculars(query),
    { revalidateOnFocus: false, keepPreviousData: true },
  );

  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / CIRCULAR_PAGE_SIZE));
  const from = total === 0 ? 0 : (page - 1) * CIRCULAR_PAGE_SIZE + 1;
  const to = Math.min(page * CIRCULAR_PAGE_SIZE, total);
  const searching = search.trim().length > 0;

  return (
    <>
      <FilterBar>
        <SearchInput
          value={searchInput}
          onValueChange={setSearchInput}
          placeholder="Search title or description…"
          aria-label="Search circulars"
        />
        {/* Archived circulars exist for the super admin who withdrew them —
            an audit trail, not a second inbox. Nobody else is offered the
            switch, and the API refuses it for them anyway. */}
        {rbac.canArchiveCirculars && (
          <Checkbox
            checked={includeArchived}
            onChange={(e) => {
              setIncludeArchived(e.target.checked);
              setPage(1);
            }}
            label="Show archived"
          />
        )}
        {data && (
          <span className="ml-auto self-center font-mono text-[11px] tracking-[0.1em] text-ink-faint uppercase">
            {total === 0 ? 'No results' : `${from}–${to} of ${total}`}
          </span>
        )}
      </FilterBar>

      <div className="mt-4 space-y-3">
        {isLoading && !data ? (
          Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-28 w-full rounded-xl sm:h-32" />
          ))
        ) : error ? (
          <ErrorState
            description="The circulars could not be loaded."
            onRetry={() => void mutate()}
          />
        ) : !data || data.data.length === 0 ? (
          searching ? (
            <EmptyState
              icon={<SearchX />}
              title="Nothing matches that"
              description={`No circular has “${search}” in its title or description.`}
              action={
                <Button variant="outline" onClick={() => setSearchInput('')}>
                  Clear the search
                </Button>
              }
            />
          ) : (
            <EmptyState
              icon={<ScrollText />}
              title={emptyTitle}
              description={emptyDescription}
              action={emptyAction}
            />
          )
        ) : (
          data.data.map((circular) => (
            <CircularCard
              key={circular.id}
              circular={circular}
              onOpen={() => setReading(circular)}
            />
          ))
        )}
      </div>

      {totalPages > 1 && (
        <nav
          aria-label="Circular pages"
          className="mt-4 flex items-center justify-between gap-3"
        >
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            <ChevronLeft /> Newer
          </Button>
          <span className="font-mono text-[11.5px] text-ink-muted tabular">
            Page {page} of {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            Older <ChevronRight />
          </Button>
        </nav>
      )}

      {reading && (
        <CircularReader
          circular={reading}
          onClose={() => setReading(null)}
          onChanged={() => void mutate()}
        />
      )}
    </>
  );
}
