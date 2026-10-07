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
import { FilterBar, FilterField, SearchInput, SegmentedControl } from '@/components/ui/FilterBar';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/Field';
import { useRbac } from '@/lib/rbac';
import { useTranslations } from 'next-intl';

/** Long enough that a phone keyboard isn't firing a request per keystroke. */
const SEARCH_DEBOUNCE_MS = 300;

/**
 * The staff audience filter. `EVERYTHING` is the absence of a filter, not a
 * value the API understands — asking for "PARENT" means "everything a parent
 * can see", school-wide notices included, which is the question the office
 * actually has ("what did parents get?").
 */
const EVERYTHING = 'EVERYTHING';
type AudienceFilter = typeof EVERYTHING | 'PARENT' | 'STAFF';

/** `key` is the label's key in `circulars.feed.filter`. */
const AUDIENCE_FILTERS: { value: AudienceFilter; key: 'all' | 'parents' | 'staff' }[] = [
  { value: EVERYTHING, key: 'all' },
  { value: 'PARENT', key: 'parents' },
  { value: 'STAFF', key: 'staff' },
];

/**
 * THE CIRCULARS FEED — search, list, pagination and the reader.
 *
 * Both portals mount this same component: a circular says the same thing to a
 * parent and to a teacher, so the only sane way to keep the two views honest
 * is to have one of them. What differs is the chrome around it, which is the
 * page's business, and the empty-state copy, which is a prop.
 */
export function CircularFeed({
  emptyTitle,
  emptyDescription,
  emptyAction,
}: {
  emptyTitle?: string;
  emptyDescription: string;
  emptyAction?: React.ReactNode;
}) {
  const t = useTranslations('circulars');
  const rbac = useRbac();
  const [searchInput, setSearchInput] = React.useState('');
  const [search, setSearch] = React.useState('');
  const [page, setPage] = React.useState(1);
  const [includeArchived, setIncludeArchived] = React.useState(false);
  const [audience, setAudience] = React.useState<AudienceFilter>(EVERYTHING);
  const [reading, setReading] = React.useState<Circular | null>(null);

  // Debounce the typed term into the one the query keys off, and go back to
  // page 1 whenever it changes — page 4 of the old result set means nothing
  // against the new one.
  React.useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput);
      setPage(1);
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const query = {
    search: search || undefined,
    page,
    limit: CIRCULAR_PAGE_SIZE,
    includeArchived: includeArchived || undefined,
    audience: audience === EVERYTHING ? undefined : audience,
  };
  const { data, error, isLoading, mutate } = useSWR(
    ['circulars', search, page, includeArchived, audience],
    () => fetchCirculars(query),
    { revalidateOnFocus: false, keepPreviousData: true },
  );

  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / CIRCULAR_PAGE_SIZE));
  const from = total === 0 ? 0 : (page - 1) * CIRCULAR_PAGE_SIZE + 1;
  const to = Math.min(page * CIRCULAR_PAGE_SIZE, total);
  // A filtered-empty list is not an empty school — say which it is, or the
  // office concludes it never sent the notice it is looking for.
  const searching = search.trim().length > 0;
  const filtered = audience !== EVERYTHING;

  return (
    <>
      <FilterBar>
        <SearchInput
          value={searchInput}
          onValueChange={setSearchInput}
          placeholder={t('feed.searchPlaceholder')}
          aria-label={t('feed.searchAria')}
        />
        {/* Staff read every circular whatever its audience, so the filter is
            the only way to answer "what did parents get?". A parent is pinned
            to their own stream by the API and has nothing to filter. */}
        {rbac.seesAllCirculars && (
          <FilterField label={t('feed.audience')}>
            <SegmentedControl
              value={audience}
              onValueChange={(v) => {
                setAudience(v);
                setPage(1);
              }}
              options={AUDIENCE_FILTERS.map((f) => ({ value: f.value, label: t(`feed.filter.${f.key}`) }))}
              size="sm"
            />
          </FilterField>
        )}
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
            label={t('feed.showArchived')}
          />
        )}
        {data && (
          <span className="ml-auto self-center font-mono text-[11px] tracking-[0.1em] text-ink-faint uppercase">
            {total === 0 ? t('feed.noResults') : t('feed.range', { from, to, total })}
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
            description={t('feed.loadFailed')}
            onRetry={() => void mutate()}
          />
        ) : !data || data.data.length === 0 ? (
          searching ? (
            <EmptyState
              icon={<SearchX />}
              title={t('feed.noMatchTitle')}
              description={t('feed.noMatchBody', { search })}
              action={
                <Button variant="outline" onClick={() => setSearchInput('')}>
                  {t('feed.clearSearch')}
                </Button>
              }
            />
          ) : filtered ? (
            <EmptyState
              icon={<SearchX />}
              title={t('feed.noAudienceTitle')}
              description={
                audience === 'PARENT' ? t('feed.noAudienceParents') : t('feed.noAudienceStaff')
              }
              action={
                <Button variant="outline" onClick={() => setAudience(EVERYTHING)}>
                  {t('feed.showAll')}
                </Button>
              }
            />
          ) : (
            <EmptyState
              icon={<ScrollText />}
              title={emptyTitle ?? t('feed.emptyTitle')}
              description={emptyDescription}
              action={emptyAction}
            />
          )
        ) : (
          data.data.map((circular) => (
            <CircularCard
              key={circular.id}
              circular={circular}
              showAudience={rbac.seesAllCirculars}
              onOpen={() => setReading(circular)}
            />
          ))
        )}
      </div>

      {totalPages > 1 && (
        <nav
          aria-label={t('feed.pagesAria')}
          className="mt-4 flex items-center justify-between gap-3"
        >
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            <ChevronLeft /> {t('feed.newer')}
          </Button>
          <span className="font-mono text-[11.5px] text-ink-muted tabular">
            {t('feed.pageOf', { page, totalPages })}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            {t('feed.older')} <ChevronRight />
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
