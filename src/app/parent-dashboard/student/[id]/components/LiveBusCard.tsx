'use client';

import * as React from 'react';
import useSWR from 'swr';
import { useTranslations } from 'next-intl';
import { MapPin } from 'lucide-react';

import { fetchChildLive, TransportApiError } from '@/lib/transport-api';
import { LiveMap } from '@/components/transport/live/LiveMap';
import { Ago } from '@/components/transport/live/Ago';

/**
 * The child's bus on a map while it is coming for them or carrying them.
 * The server stops answering with a position once the child reaches school
 * or is dropped, so this simply disappears then. Polls every 10 s, and only
 * while the page is visible.
 */
export function LiveBusCard({ studentId }: { studentId: number }) {
  const t = useTranslations('transport.live.parent');
  const [visible, setVisible] = React.useState(true);
  React.useEffect(() => {
    const on = () => setVisible(document.visibilityState === 'visible');
    document.addEventListener('visibilitychange', on);
    return () => document.removeEventListener('visibilitychange', on);
  }, []);

  const { data, error } = useSWR(visible ? ['child-live', studentId] : null, () => fetchChildLive(studentId), {
    refreshInterval: 10_000,
    keepPreviousData: true,
  });

  const live = data?.available ? data : null;
  const buses = React.useMemo(
    () => (live ? [{ id: 'bus', lat: live.position.latitude, lng: live.position.longitude, label: live.vehicle, stale: live.stale, selected: true }] : []),
    [live],
  );
  const pins = React.useMemo(
    () =>
      live?.stop?.latitude != null && live.stop.longitude != null
        ? [{ id: 'stop', lat: live.stop.latitude, lng: live.stop.longitude, label: live.stop.name, tone: 'home' as const }]
        : [],
    [live],
  );

  // Not enabled for this school (403), or nothing to show right now.
  if (error instanceof TransportApiError && error.status === 403) return null;
  if (!data) return null;
  if (!data.available) {
    if (data.reason !== 'NO_SIGNAL') return null;
    return <p className="rounded-lg border border-line bg-surface px-3 py-2 text-[13px] text-ink-muted">{t('noSignal')}</p>;
  }

  const onBoardToSchool = live!.leg === 'MORNING' && live!.state === 'BOARDED';
  return (
    <div className="space-y-2 rounded-xl border border-line bg-surface p-3">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <span className="relative flex size-2.5">
          {!live!.stale && <span className="absolute inline-flex size-full animate-ping rounded-full bg-accent-success opacity-60" />}
          <span className={`relative inline-flex size-2.5 rounded-full ${live!.stale ? 'bg-accent-warn' : 'bg-accent-success'}`} />
        </span>
        <span className="font-display text-[15px] font-semibold text-ink">{t('title', { vehicle: live!.vehicle })}</span>
        <span className="ml-auto text-[12px]">
          <Ago at={live!.recordedAt} stale={live!.stale} />
        </span>
      </div>
      <p className="flex items-center gap-1.5 text-[13.5px] text-ink">
        <MapPin className="size-4 shrink-0 text-brand" />
        {onBoardToSchool
          ? t('toSchool')
          : live!.distanceM != null && live!.stop
            ? t('away', {
                distance: live!.distanceM >= 1000 ? `${(live!.distanceM / 1000).toFixed(1)} km` : `${Math.max(50, Math.round(live!.distanceM / 50) * 50)} m`,
                stop: live!.stop.name,
                mins: live!.etaMinutes ?? 1,
              })
            : live!.state === 'BOARDED'
              ? t('onTheWay')
              : t('coming')}
      </p>
      <LiveMap buses={buses} pins={pins} className="h-64 w-full" />
      <p className="text-[11.5px] text-ink-faint">{t('privacy')}</p>
    </div>
  );
}
