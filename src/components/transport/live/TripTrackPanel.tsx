'use client';

import * as React from 'react';
import useSWR from 'swr';
import { useTranslations } from 'next-intl';

import { fetchTripTrack, secondsSince, type TripDetail } from '@/lib/transport-api';
import { Panel, PanelBody, PanelHeader } from '@/components/ui/Panel';
import { LiveMap } from './LiveMap';
import { Ago } from './Ago';

/** School view of one trip: the route's stops, the path driven and the bus now. */
export function TripTrackPanel({ trip }: { trip: TripDetail }) {
  const t = useTranslations('transport.live');
  const running = trip.status === 'IN_PROGRESS';
  const { data } = useSWR(['trip-track', trip.id], () => fetchTripTrack(trip.id), {
    refreshInterval: running ? 15_000 : 0,
  });

  const trail = React.useMemo(
    () => (data?.points ?? []).map((p) => [p.longitude, p.latitude] as [number, number]),
    [data],
  );
  const pins = React.useMemo(
    () => (data?.stops ?? []).map((s) => ({ id: s.id, lat: s.latitude, lng: s.longitude, label: `${s.sequence}. ${s.name}` })),
    [data],
  );
  const buses = React.useMemo(
    () =>
      data?.live
        ? [{ id: trip.vehicle?.id ?? 0, lat: data.live.latitude, lng: data.live.longitude, label: trip.vehicle?.fleetNumber || trip.vehicle?.registrationNumber || '', stale: data.live.stale }]
        : [],
    [data, trip.vehicle],
  );

  if (!data) return null;
  if (data.points.length === 0 && pins.length === 0) return null;

  return (
    <Panel>
      <PanelHeader
        title={t('tripMap')}
        description={
          data.live ? (
            <Ago at={data.live.recordedAt} stale={data.live.stale} />
          ) : running ? (
            t('noSignalYet')
          ) : data.points.length ? (
            t('pathDriven', { count: data.points.length, mins: Math.round(secondsSince(data.points[0].at, new Date(data.points[data.points.length - 1].at).getTime()) / 60) })
          ) : (
            t('noPath')
          )
        }
      />
      <PanelBody>
        <LiveMap buses={buses} pins={pins} trail={trail} className="h-80 w-full" />
      </PanelBody>
    </Panel>
  );
}
