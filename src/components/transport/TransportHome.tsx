'use client';

import Link from 'next/link';
import useSWR from 'swr';
import { useTranslations } from 'next-intl';
import { Bus, Phone, Sun, Sunset } from 'lucide-react';

import { fetchCrewDuty, fetchTripsToday, hhmm, vehicleName } from '@/lib/transport-api';
import { TodayRuns } from '@/components/transport/trip/TodayRuns';
import { useRbac } from '@/lib/rbac';
import { useFeatureFlag } from '@/lib/useSchoolFeatures';
import GreetingCard from '@/app/dashboard/GreetingCardDynamic';
import { PageBody, PageHeader, PageShell } from '@/components/ui/PageHeader';
import { Panel, PanelBody, PanelHeader } from '@/components/ui/Panel';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/EmptyState';

/**
 * Dashboard home for people who only hold transport roles. A driver or
 * assistant sees today's vehicle, its routes and every stop with how many
 * children board or get off there — plus a one-tap call to the other crew
 * member. A transport in-charge gets a way into the module.
 */
export default function TransportHome() {
  const t = useTranslations('transport.home');
  const tt = useTranslations('transport');
  const rbac = useRbac();
  const { enabled } = useFeatureFlag('transport_management');
  const { data } = useSWR(rbac.isTransportCrew && enabled !== false ? '/transport/crew/me' : null, fetchCrewDuty);
  const { data: today, mutate: mutateToday } = useSWR(
    rbac.isTransportCrew && enabled !== false ? '/transport/trips/today' : null,
    fetchTripsToday,
    { refreshInterval: 60_000 },
  );

  return (
    <PageShell>
      <div className="mb-4">
        <GreetingCard />
      </div>
      <PageHeader section={t('section')} title={rbac.isTransportCrew ? t('title') : t('inchargeTitle')} description={rbac.isTransportCrew ? t('description') : t('inchargeHint')} />
      <PageBody>
        {rbac.canManageTransport && (
          <Button render={<Link href="/dashboard/transport" />}>
            <Bus /> {t('openTransport')}
          </Button>
        )}

        {rbac.isTransportCrew && data && data.vehicles.length === 0 && (
          <EmptyState icon={<Bus />} title={t('noDuty')} description={t('noDutyHint')} />
        )}

        {today && today.runs.length > 0 && (
          <section className="mt-4">
            <h2 className="mb-2 font-display text-[16px] font-semibold text-ink">{t('todayTrips')}</h2>
            <TodayRuns runs={today.runs} tripHref={(id) => `/dashboard/trip/${id}`} onStarted={() => void mutateToday()} />
          </section>
        )}

        <div className="mt-4 space-y-4">
          {data?.vehicles.map((v) => {
            const partner = v.crew.find((c) => c.role !== v.role);
            return (
              <Panel key={v.vehicle.id}>
                <PanelHeader
                  title={vehicleName(v.vehicle)}
                  description={`${tt(`vehicleType.${v.vehicle.type}`)} · ${t('seats', { count: v.vehicle.capacity })} · ${t('youAre', { role: tt(`crewRole.${v.role}`).toLowerCase() })}`}
                />
                <PanelBody>
                  {partner?.mobile && (
                    <a
                      href={`tel:${partner.mobile}`}
                      className="mb-4 flex min-h-11 items-center gap-2 rounded-lg border border-line px-3 py-2 text-[14px] text-ink hover:border-brand"
                    >
                      <Phone className="size-4 text-accent-info-deep" />
                      <span className="min-w-0 flex-1 truncate">
                        {t('call', { name: partner.name })}
                        <span className="text-ink-muted"> · {tt(`crewRole.${partner.role}`)}</span>
                      </span>
                      <span className="tabular text-[13px] text-ink-muted">{partner.mobile}</span>
                    </a>
                  )}
                  <div className="space-y-5">
                    {v.routes.map((r) => (
                      <div key={r.id}>
                        <p className="font-display text-[15px] font-semibold text-ink">
                          <span className="tabular">{r.routeNumber}</span> · {r.name}
                        </p>
                        <div className="mt-2 grid gap-3 md:grid-cols-2">
                          <Leg
                            icon={<Sun className="size-4" />}
                            title={t('morning')}
                            start={hhmm(r.morningStart)}
                            stops={r.stops.map((s) => ({ key: s.id, seq: s.sequence, name: s.name, time: hhmm(s.pickupTime), count: s.boarding, label: t('boarding', { count: s.boarding }) }))}
                          />
                          <Leg
                            icon={<Sunset className="size-4" />}
                            title={t('evening')}
                            start={hhmm(r.eveningStart)}
                            stops={[...r.stops].reverse().map((s) => ({ key: s.id, seq: s.sequence, name: s.name, time: hhmm(s.dropTime), count: s.alighting, label: t('alighting', { count: s.alighting }) }))}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </PanelBody>
              </Panel>
            );
          })}
        </div>
      </PageBody>
    </PageShell>
  );
}

function Leg({
  icon,
  title,
  start,
  stops,
}: {
  icon: React.ReactNode;
  title: string;
  start: string | null;
  stops: { key: number; seq: number; name: string; time: string | null; count: number; label: string }[];
}) {
  const t = useTranslations('transport.home');
  return (
    <div className="rounded-lg border border-line p-3">
      <p className="flex items-center gap-1.5 text-[13px] font-semibold text-ink">
        {icon} {title}
        {start && <span className="tabular ml-auto text-[12px] font-normal text-ink-muted">{t('starts', { time: start })}</span>}
      </p>
      <ol className="mt-2 space-y-1.5">
        {stops.map((s) => (
          <li key={s.key} className="flex items-center gap-2 text-[13px]">
            <span className="tabular w-11 shrink-0 text-ink-muted">{s.time ?? '—'}</span>
            <span className="min-w-0 flex-1 truncate text-ink">{s.name}</span>
            <span className={s.count > 0 ? 'text-ink' : 'text-ink-faint'}>{s.label}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}
