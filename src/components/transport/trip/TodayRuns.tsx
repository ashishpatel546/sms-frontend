'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import toast from 'react-hot-toast';
import { ArrowRight, Play, Sun, Sunset } from 'lucide-react';

import {
  errorMessage,
  hhmm,
  startTrip,
  vehicleName,
  type TripLeg,
  type TripRun,
} from '@/lib/transport-api';
import { Button } from '@/components/ui/button';
import { StatusChip } from '@/components/ui/StatusChip';

/**
 * Today's runs, one card per route with a row per leg: start it, continue
 * it, or see how it went. Shared by the crew home and the managers' board.
 *
 * `tripHref` decides where an existing trip opens: the crew screen for
 * drivers and assistants, the manager's trip page on the board.
 */
export function TodayRuns({
  runs,
  tripHref,
  onStarted,
}: {
  runs: TripRun[];
  tripHref: (tripId: number) => string;
  onStarted?: () => void;
}) {
  return (
    <div className="grid gap-3 lg:grid-cols-2">
      {runs.map((run) => (
        <RunCard key={run.route.id} run={run} tripHref={tripHref} onStarted={onStarted} />
      ))}
    </div>
  );
}

function RunCard({
  run,
  tripHref,
  onStarted,
}: {
  run: TripRun;
  tripHref: (tripId: number) => string;
  onStarted?: () => void;
}) {
  const t = useTranslations('transport.today');
  return (
    <div className="rounded-xl border border-line bg-surface p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-display text-[15px] font-semibold text-ink">
            <span className="tabular">{run.route.routeNumber}</span> · {run.route.name}
          </p>
          <p className="mt-0.5 truncate text-[12.5px] text-ink-muted">
            {run.vehicle ? vehicleName(run.vehicle) : t('noVehicle')}
            {run.driver && ` · ${run.driver.name}`}
          </p>
        </div>
      </div>
      <div className="mt-3 divide-y divide-line">
        {run.legs.map((l) => (
          <LegRow
            key={l.leg}
            run={run}
            leg={l}
            start={hhmm(l.leg === 'MORNING' ? run.route.morningStart : run.route.eveningStart)}
            tripHref={tripHref}
            onStarted={onStarted}
          />
        ))}
      </div>
    </div>
  );
}

function LegRow({
  run,
  leg,
  start,
  tripHref,
  onStarted,
}: {
  run: TripRun;
  leg: TripRun['legs'][number];
  start: string | null;
  tripHref: (tripId: number) => string;
  onStarted?: () => void;
}) {
  const t = useTranslations('transport.today');
  const tt = useTranslations('transport.trip');
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  const c = leg.counts;

  const begin = async (which: TripLeg) => {
    setBusy(true);
    try {
      const trip = await startTrip(run.route.id, which);
      onStarted?.();
      router.push(tripHref(trip.id));
    } catch (e) {
      toast.error(errorMessage(e, t('startFailed')));
      setBusy(false);
    }
  };

  const summary = leg.trip
    ? leg.trip.status === 'IN_PROGRESS'
      ? t('liveSummary', { onBoard: c.onBoard, pending: c.pending })
      : t('doneSummary', { done: c.done, missed: c.noShow })
    : t('expected', { count: c.expected });

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 py-2.5">
      <span className="flex min-w-0 flex-1 items-start gap-2 text-[13.5px] text-ink">
        {leg.leg === 'MORNING' ? <Sun className="mt-0.5 size-4 shrink-0 text-ink-muted" /> : <Sunset className="mt-0.5 size-4 shrink-0 text-ink-muted" />}
        <span className="min-w-0">
          <span className="font-medium">{tt(`leg.${leg.leg}`)}</span>
          {start && <span className="tabular ml-2 text-[12.5px] text-ink-muted">{start}</span>}
          <span className="block truncate text-[12.5px] text-ink-muted">{summary}</span>
        </span>
      </span>
      {leg.trip ? (
        <span className="flex items-center gap-2">
          {leg.trip.status === 'IN_PROGRESS' ? (
            <StatusChip pigment="info" label={t('running')} />
          ) : (
            <StatusChip pigment={leg.trip.forceClosed ? 'attn' : 'success'} label={t('finished')} />
          )}
          <Button size="sm" variant={leg.trip.status === 'IN_PROGRESS' ? 'primary' : 'outline'} render={<Link href={tripHref(leg.trip.id)} />}>
            {leg.trip.status === 'IN_PROGRESS' ? t('continue') : t('view')} <ArrowRight />
          </Button>
        </span>
      ) : (
        <Button size="sm" variant="outline" disabled={busy || !run.vehicle} onClick={() => begin(leg.leg)}>
          <Play /> {t('start')}
        </Button>
      )}
    </div>
  );
}
