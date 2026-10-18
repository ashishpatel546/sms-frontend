'use client';

import * as React from 'react';
import useSWR from 'swr';
import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { History } from 'lucide-react';

import { fetchRoutes, fetchTripLog, istClock, todayIst, type TripLeg, type TripLogRow } from '@/lib/transport-api';
import { INTL_LOCALE } from '@/i18n/config';
import { PageBody, PageHeader, PageShell } from '@/components/ui/PageHeader';
import { Column, DataTable, TableCount } from '@/components/ui/DataTable';
import { FilterBar, FilterField } from '@/components/ui/FilterBar';
import { Input, Select } from '@/components/ui/Field';
import { Button } from '@/components/ui/button';
import { StatusChip } from '@/components/ui/StatusChip';
import { useFormatDate } from '@/components/transport/format';

const PAGE_SIZE = 25;

function daysAgo(n: number): string {
  const [y, m, d] = todayIst().split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d - n)).toISOString().slice(0, 10);
}

/** Every trip run, newest first, with who boarded and anything left open. */
export default function TripLogPage() {
  const t = useTranslations('transport.log');
  const tt = useTranslations('transport');
  const tl = useTranslations('transport.trip.leg');
  const tc = useTranslations('common');
  const formatDate = useFormatDate();
  const intl = INTL_LOCALE[useLocale()];
  const router = useRouter();
  const [from, setFrom] = React.useState(daysAgo(6));
  const [to, setTo] = React.useState(todayIst());
  const [routeId, setRouteId] = React.useState<number | ''>('');
  const [leg, setLeg] = React.useState<TripLeg | ''>('');
  const [page, setPage] = React.useState(1);

  const { data: routes } = useSWR('/transport/routes', fetchRoutes);
  const q = { from, to, routeId: routeId || undefined, leg: leg || undefined, page, limit: PAGE_SIZE };
  const { data, isLoading } = useSWR(['trip-log', q], () => fetchTripLog(q));

  const columns: Column<TripLogRow>[] = [
    {
      key: 'date',
      header: t('col.date'),
      card: 'title',
      accessor: (r) => (
        <div>
          <p className="font-medium text-ink">{formatDate(r.date)}</p>
          <p className="text-[12px] text-ink-muted">{tl(r.leg)}</p>
        </div>
      ),
    },
    {
      key: 'route',
      header: t('col.route'),
      card: 'meta',
      accessor: (r) => (
        <span>
          <span className="tabular">{r.route.routeNumber}</span> · {r.vehicle}
        </span>
      ),
    },
    {
      key: 'time',
      header: t('col.time'),
      accessor: (r) => (
        <span className="tabular text-ink-muted">
          {istClock(r.startedAt, intl)} – {r.endedAt ? istClock(r.endedAt, intl) : '…'}
        </span>
      ),
    },
    { key: 'boarded', header: t('col.boarded'), align: 'right', accessor: (r) => <span className="tabular">{r.boarded}</span> },
    { key: 'missed', header: t('col.missed'), align: 'right', accessor: (r) => <span className="tabular">{r.notTravelled}</span> },
    {
      key: 'status',
      header: t('col.status'),
      card: 'trailing',
      accessor: (r) =>
        r.status === 'IN_PROGRESS' ? (
          <StatusChip pigment={r.onBoard ? 'attn' : 'info'} label={r.onBoard ? t('openOnBoard', { count: r.onBoard }) : t('running')} />
        ) : (
          <StatusChip pigment={r.forceClosed ? 'attn' : 'success'} label={r.forceClosed ? t('forceClosed') : t('finished')} />
        ),
    },
  ];

  return (
    <PageShell>
      <PageHeader section={tt('section')} title={t('title')} description={t('description')} />
      <PageBody>
        <FilterBar>
          <FilterField label={t('from')} width="md">
            <Input type="date" value={from} max={to} onChange={(e) => { setFrom(e.target.value); setPage(1); }} />
          </FilterField>
          <FilterField label={t('to')} width="md">
            <Input type="date" value={to} min={from} max={todayIst()} onChange={(e) => { setTo(e.target.value); setPage(1); }} />
          </FilterField>
          <FilterField label={t('route')} width="md">
            <Select value={routeId} onChange={(e) => { setRouteId(e.target.value ? Number(e.target.value) : ''); setPage(1); }}>
              <option value="">{t('allRoutes')}</option>
              {(routes ?? []).map((r) => (
                <option key={r.id} value={r.id}>
                  {r.routeNumber} — {r.name}
                </option>
              ))}
            </Select>
          </FilterField>
          <FilterField label={t('leg')} width="sm">
            <Select value={leg} onChange={(e) => { setLeg(e.target.value as TripLeg | ''); setPage(1); }}>
              <option value="">{t('bothLegs')}</option>
              <option value="MORNING">{tl('MORNING')}</option>
              <option value="EVENING">{tl('EVENING')}</option>
            </Select>
          </FilterField>
        </FilterBar>

        <DataTable
          className="mt-4"
          columns={columns}
          data={data?.data}
          loading={isLoading}
          rowKey={(r) => r.id}
          onRowClick={(r) => router.push(`/dashboard/transport/trips/${r.id}`)}
          isRowFlagged={(r) => r.forceClosed || (r.status === 'IN_PROGRESS' && r.onBoard > 0)}
          emptyMessage={t('empty')}
          toolbar={
            <>
              <History className="size-4 text-ink-faint" />
              <span className="font-display text-[15px] font-semibold text-ink">{t('tableTitle')}</span>
              {data && <TableCount>{data.total}</TableCount>}
            </>
          }
        />
        {data && data.total > PAGE_SIZE && (
          <div className="mt-3 flex justify-end gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              {tc('action.previous')}
            </Button>
            <Button variant="outline" size="sm" disabled={page * PAGE_SIZE >= data.total} onClick={() => setPage((p) => p + 1)}>
              {tc('action.next')}
            </Button>
          </div>
        )}
      </PageBody>
    </PageShell>
  );
}
