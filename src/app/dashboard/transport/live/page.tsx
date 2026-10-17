'use client';

import * as React from 'react';
import Link from 'next/link';
import useSWR from 'swr';
import { useTranslations } from 'next-intl';
import { ArrowRight, MapPinned } from 'lucide-react';

import { fetchLiveBoard, vehicleName, type LiveBoard } from '@/lib/transport-api';
import { useFeatureFlag } from '@/lib/useSchoolFeatures';
import { PageBody, PageHeader, PageShell } from '@/components/ui/PageHeader';
import { StatusChip } from '@/components/ui/StatusChip';
import { EmptyState } from '@/components/ui/EmptyState';
import { Button } from '@/components/ui/button';
import { LiveMap } from '@/components/transport/live/LiveMap';
import { Ago } from '@/components/transport/live/Ago';

type Row = LiveBoard['vehicles'][number];

/**
 * Where every bus is, for the school: super admin, admins and the transport
 * in-charge. Buses on a running trip that are sharing come first; the rest
 * show where they were last seen.
 */
export default function TransportLivePage() {
  const t = useTranslations('transport.live');
  const tt = useTranslations('transport');
  const tl = useTranslations('transport.trip.leg');
  const flag = useFeatureFlag('transport_live_tracking');
  const on = flag.enabled === true;
  const { data, isLoading } = useSWR(on ? '/transport/live/board' : null, fetchLiveBoard, { refreshInterval: 10_000 });
  const [selected, setSelected] = React.useState<number | null>(null);

  const rows = React.useMemo(() => {
    const rank = (r: Row) => (r.trip?.sharing && r.live && !r.live.stale ? 0 : r.trip ? 1 : r.live ? 2 : 3);
    return [...(data?.vehicles ?? [])].sort((a, b) => rank(a) - rank(b));
  }, [data]);

  const buses = React.useMemo(
    () =>
      rows
        .filter((r) => r.live)
        .map((r) => ({
          id: r.vehicle.id,
          lat: r.live!.latitude,
          lng: r.live!.longitude,
          label: r.vehicle.fleetNumber || r.vehicle.registrationNumber,
          stale: r.live!.stale || !r.trip?.sharing,
          selected: r.vehicle.id === selected,
        })),
    [rows, selected],
  );
  const pins = React.useMemo(() => {
    const route = selected ? rows.find((r) => r.vehicle.id === selected)?.trip?.route.id : undefined;
    return (data?.routes ?? [])
      .filter((r) => !route || r.routeId === route)
      .flatMap((r) => r.stops.map((s) => ({ id: `${r.routeId}-${s.id}`, lat: s.latitude, lng: s.longitude, label: s.name })));
  }, [data, rows, selected]);

  if (flag.enabled === false) {
    return (
      <PageShell>
        <PageHeader section={tt('section')} title={t('title')} />
        <EmptyState icon={<MapPinned />} title={t('offTitle')} description={t('offHint')} />
      </PageShell>
    );
  }

  return (
    <PageShell>
      <PageHeader section={tt('section')} title={t('title')} description={t('description')} />
      <PageBody>
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
          <LiveMap buses={buses} pins={pins} fitKey={selected ?? 'all'} onBusClick={(id) => setSelected(Number(id))} className="h-[55dvh] min-h-80 w-full lg:h-[70dvh]" />
          <div className="space-y-2">
            {isLoading && <div className="skeleton h-20 w-full rounded-xl" />}
            {data && rows.length === 0 && <EmptyState icon={<MapPinned />} title={t('noVehicles')} />}
            {rows.map((r) => (
              <button
                key={r.vehicle.id}
                type="button"
                onClick={() => setSelected(r.vehicle.id === selected ? null : r.vehicle.id)}
                className={`w-full rounded-xl border bg-surface p-3 text-left transition-colors hover:border-brand ${r.vehicle.id === selected ? 'border-brand ring-2 ring-brand/25' : 'border-line'}`}
              >
                <div className="flex items-center gap-2">
                  <span className="min-w-0 flex-1 truncate font-display text-[15px] font-semibold text-ink">{vehicleName(r.vehicle)}</span>
                  <Status row={r} />
                </div>
                {r.trip ? (
                  <p className="mt-1 text-[12.5px] text-ink-muted">
                    <span className="tabular">{r.trip.route.routeNumber}</span> · {tl(r.trip.leg)} · {t('counts', { onBoard: r.trip.onBoard, pending: r.trip.pending })}
                  </p>
                ) : (
                  <p className="mt-1 text-[12.5px] text-ink-muted">{t('noTrip')}</p>
                )}
                {r.live && (
                  <p className="mt-0.5 text-[12px]">
                    <Ago at={r.live.recordedAt} stale={r.live.stale || !r.trip?.sharing} />
                    {r.trip?.sharing && (
                      <span className="text-ink-muted">
                        {' · '}
                        {r.live.source === 'APP' ? t('viaApp') : t('viaScreen')}
                        {r.live.source === 'APP' && r.tracker.battery != null && <span> · {t('battery', { pct: r.tracker.battery })}</span>}
                      </span>
                    )}
                  </p>
                )}
                {r.trip && r.vehicle.id === selected && (
                  <Button size="sm" variant="outline" className="mt-2" render={<Link href={`/dashboard/transport/trips/${r.trip.id}`} />}>
                    {t('openTrip')} <ArrowRight />
                  </Button>
                )}
              </button>
            ))}
          </div>
        </div>
      </PageBody>
    </PageShell>
  );
}

function Status({ row }: { row: Row }) {
  const t = useTranslations('transport.live.status');
  if (!row.trip) return <StatusChip pigment="neutral" label={t('idle')} />;
  if (!row.trip.sharing || !row.live) return <StatusChip pigment="attn" label={t('noSignal')} />;
  if (row.live.stale) return <StatusChip pigment="attn" label={t('stale')} />;
  return <StatusChip pigment="success" label={t('live')} />;
}
