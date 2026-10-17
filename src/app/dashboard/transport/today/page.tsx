'use client';

import * as React from 'react';
import Link from 'next/link';
import useSWR from 'swr';
import { useLocale, useTranslations } from 'next-intl';
import { Toaster } from 'react-hot-toast';
import { AlertTriangle, Bus } from 'lucide-react';

import { fetchTripBoard, istClock, type TripAlert, type TripRun } from '@/lib/transport-api';
import { INTL_LOCALE } from '@/i18n/config';
import { PageBody, PageHeader, PageShell } from '@/components/ui/PageHeader';
import { Panel, PanelBody, PanelHeader } from '@/components/ui/Panel';
import { StatGrid, StatTile } from '@/components/ui/StatTile';
import { EmptyState } from '@/components/ui/EmptyState';
import { TodayRuns } from '@/components/transport/trip/TodayRuns';

/** Managers' live board: every route's runs today, head counts and alerts. */
export default function TransportTodayPage() {
  const t = useTranslations('transport.today');
  const tt = useTranslations('transport');
  const { data, isLoading, mutate } = useSWR('/transport/trip-reports/board', () => fetchTripBoard(), {
    refreshInterval: 30_000,
  });

  const total = (pick: (c: TripRun['legs'][number]['counts']) => number, running = false) =>
    (data?.runs ?? []).reduce(
      (n, r) => n + r.legs.filter((l) => !running || l.trip?.status === 'IN_PROGRESS').reduce((m, l) => m + pick(l.counts), 0),
      0,
    );
  const runningTrips = (data?.runs ?? []).reduce((n, r) => n + r.legs.filter((l) => l.trip?.status === 'IN_PROGRESS').length, 0);

  return (
    <PageShell>
      <Toaster position="top-center" />
      <PageHeader section={tt('section')} title={t('title')} description={t('description')} />
      <PageBody>
        <StatGrid columns={4}>
          <StatTile label={t('stat.running')} value={isLoading ? '—' : runningTrips} icon={<Bus />} pigment="info" />
          <StatTile label={t('stat.onBoard')} value={isLoading ? '—' : total((c) => c.onBoard, true)} pigment="info" />
          <StatTile label={t('stat.waiting')} value={isLoading ? '—' : total((c) => c.pending, true)} pigment="attn" />
          <StatTile label={t('stat.alerts')} value={isLoading ? '—' : data?.alerts.length ?? 0} icon={<AlertTriangle />} pigment={data?.alerts.length ? 'danger' : 'success'} />
        </StatGrid>

        {data && data.alerts.length > 0 && <Alerts alerts={data.alerts} />}

        {data && data.runs.length === 0 && <EmptyState icon={<Bus />} title={t('noRoutes')} description={t('noRoutesHint')} />}
        {data && data.runs.length > 0 && (
          <TodayRuns runs={data.runs} tripHref={(id) => `/dashboard/transport/trips/${id}`} onStarted={() => void mutate()} />
        )}
      </PageBody>
    </PageShell>
  );
}

function Alerts({ alerts }: { alerts: TripAlert[] }) {
  const t = useTranslations('transport.today.alert');
  const tl = useTranslations('transport.trip.leg');
  const intl = INTL_LOCALE[useLocale()];
  return (
    <Panel className="border-accent-danger-edge">
      <PanelHeader title={t('title')} />
      <PanelBody>
        <ul className="space-y-2">
          {alerts.map((a, i) => {
            const where = `${a.vehicle} · ${a.routeNumber} · ${tl(a.leg)}`;
            const text =
              a.type === 'BOARDED_BUT_ABSENT'
                ? t('boardedButAbsent', { name: a.studentName, where })
                : a.type === 'FORCE_CLOSED'
                  ? t('forceClosed', { where, note: a.note ?? '' })
                  : t(a.type === 'CHILDREN_ON_BOARD' ? 'childrenOnBoard' : 'runningLong', { where, time: istClock(a.since, intl) });
            return (
              <li key={`${a.type}-${a.tripId}-${i}`}>
                <Link
                  href={`/dashboard/transport/trips/${a.tripId}`}
                  className="flex min-h-11 items-start gap-2 rounded-lg border border-line px-3 py-2 text-[13.5px] text-ink hover:border-brand"
                >
                  <AlertTriangle className="mt-0.5 size-4 shrink-0 text-accent-danger-deep" />
                  <span>{text}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </PanelBody>
    </Panel>
  );
}
