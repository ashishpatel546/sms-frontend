'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { Bus, MapPin, Phone, Sun, Sunset } from 'lucide-react';

import FeatureNotAvailableNotice from '@/components/parent/FeatureNotAvailableNotice';
import {
  fetchChildTransport,
  hhmm,
  todayIst,
  TransportApiError,
  vehicleName,
  type CrewSummary,
  type RouteLeg,
  type StudentTransport,
} from '@/lib/transport-api';
import { formatINR } from '@/components/ui/Money';
import { useFormatDate } from '@/components/transport/format';
import { TransportToday } from './TransportToday';

/**
 * The child's school transport: which bus, which stops at what time, and who
 * is on board — with the driver's and assistant's numbers one tap away, which
 * is what a parent waiting at a stop actually needs.
 *
 * Self-fetching, like Activities: a school without the transport module gets
 * the API's 403 and the not-available notice. Rendered with `key={studentId}`
 * so switching child starts from the loading state again.
 */
export function TransportSection({ studentId }: { studentId: string | number }) {
  const t = useTranslations('transport.parent');
  const formatDate = useFormatDate();
  const [state, setState] = React.useState<'loading' | 'ready' | 'off' | 'error'>('loading');
  const [data, setData] = React.useState<StudentTransport | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    fetchChildTransport(Number(studentId))
      .then((res) => {
        if (cancelled) return;
        setData(res);
        setState('ready');
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setState(e instanceof TransportApiError && e.status === 403 && /not enabled/i.test(e.message) ? 'off' : 'error');
      });
    return () => {
      cancelled = true;
    };
  }, [studentId]);

  if (state === 'off') return <FeatureNotAvailableNotice title={t('title')} description={t('description')} />;
  if (state === 'loading') {
    return (
      <div className="space-y-3">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="skeleton h-28 w-full rounded-xl" />
        ))}
      </div>
    );
  }
  if (state === 'error' || !data) {
    return <p className="rounded-xl border border-line bg-surface p-4 text-[13.5px] text-ink-muted">{t('notAssignedHint')}</p>;
  }
  if (!data.assigned) {
    return (
      <div className="rounded-xl border border-line bg-surface p-6 text-center">
        <Bus className="mx-auto size-8 text-ink-faint" />
        <p className="mt-2 font-display text-[16px] font-semibold text-ink">{t('notAssigned')}</p>
        <p className="mt-1 text-[13px] text-ink-muted">{t('notAssignedHint')}</p>
      </div>
    );
  }

  const sameVehicle = data.morning.vehicle?.id === data.evening.vehicle?.id;
  const ex = data.exemption?.status === 'APPROVED' ? data.exemption : null;

  return (
    <div className="space-y-3">
      {data.startsOn > todayIst() && (
        <p className="rounded-lg border border-accent-info-edge bg-accent-info-tint px-3 py-2 text-[13px] text-accent-info-deep">
          {t('startsOn', { date: formatDate(data.startsOn) })}
        </p>
      )}
      {data.endsOn && (
        <p className="rounded-lg border border-accent-warn-edge bg-accent-warn-tint px-3 py-2 text-[13px] text-accent-warn-deep">
          {t('endsOn', { date: formatDate(data.endsOn) })}
        </p>
      )}

      {data.startsOn <= todayIst() && <TransportToday studentId={Number(studentId)} />}

      <LegCard icon={<Sun className="size-4" />} title={t('morning')} leg={data.morning} />
      <LegCard icon={<Sunset className="size-4" />} title={t('evening')} leg={data.evening} showCrew={!sameVehicle} />
      {sameVehicle && <CrewCard leg={data.morning} />}

      <div className="rounded-xl border border-line bg-surface p-4">
        <p className="text-[12px] text-ink-muted">{t('fee')}</p>
        <p className="mt-0.5 tabular font-display text-[18px] font-semibold text-ink">{formatINR(data.monthlyFee, { symbol: true })}</p>
        {ex && (
          <p className="mt-1 text-[13px] text-accent-success-deep">
            {t('exemption')}: {ex.type === 'PERCENT' ? `${ex.value}%` : formatINR(ex.value, { symbol: true })} ·{' '}
            {t('youPay', { amount: formatINR(ex.netMonthlyFee, { symbol: true }) })}
          </p>
        )}
      </div>
    </div>
  );
}

function LegCard({ icon, title, leg, showCrew = false }: { icon: React.ReactNode; title: string; leg: RouteLeg; showCrew?: boolean }) {
  const t = useTranslations('transport.parent');
  const time = hhmm(leg.stop.time);
  return (
    <div className="rounded-xl border border-line bg-surface p-4">
      <p className="flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-wide text-ink-muted">
        {icon} {title}
      </p>
      <div className="mt-2 flex items-start gap-2.5">
        <MapPin className="mt-0.5 size-4 shrink-0 text-brand" />
        <div className="min-w-0">
          <p className="text-[15px] font-medium text-ink">
            {leg.stop.name}
            {time && <span className="tabular text-ink-muted"> · {t('at', { time })}</span>}
          </p>
          {leg.stop.landmark && <p className="text-[12.5px] text-ink-muted">{leg.stop.landmark}</p>}
          <p className="mt-1 text-[12.5px] text-ink-muted">
            <span className="tabular">{leg.route.routeNumber}</span> · {leg.route.name}
          </p>
        </div>
      </div>
      <p className="mt-3 flex items-center gap-2 text-[13.5px] text-ink">
        <Bus className="size-4 text-ink-faint" />
        {leg.vehicle ? <span className="tabular">{vehicleName(leg.vehicle)}</span> : <span className="text-ink-muted">{t('noVehicle')}</span>}
      </p>
      {showCrew && <CrewRows leg={leg} />}
    </div>
  );
}

function CrewCard({ leg }: { leg: RouteLeg }) {
  return (
    <div className="rounded-xl border border-line bg-surface p-4">
      <CrewRows leg={leg} />
    </div>
  );
}

function CrewRows({ leg }: { leg: RouteLeg }) {
  const t = useTranslations('transport.parent');
  return (
    <div className="mt-1 divide-y divide-line">
      <Person label={t('driver')} person={leg.driver} />
      <Person label={t('assistant')} person={leg.assistant} />
    </div>
  );
}

function Person({ label, person }: { label: string; person: CrewSummary | null }) {
  const t = useTranslations('transport.parent');
  return (
    <div className="flex min-h-12 items-center justify-between gap-3 py-2">
      <div className="min-w-0">
        <p className="text-[12px] text-ink-muted">{label}</p>
        <p className="truncate text-[14px] text-ink">{person?.name ?? t('notAssignedYet')}</p>
      </div>
      {person?.mobile && (
        <a
          href={`tel:${person.mobile}`}
          className="inline-flex h-11 shrink-0 items-center gap-1.5 rounded-full border border-line px-4 text-[13px] font-medium text-accent-info-deep hover:border-accent-info"
          aria-label={`${t('call')} ${person.name} ${person.mobile}`}
        >
          <Phone className="size-4" /> {t('call')}
        </a>
      )}
    </div>
  );
}
