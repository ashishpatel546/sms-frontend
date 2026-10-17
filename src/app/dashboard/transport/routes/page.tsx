'use client';

import * as React from 'react';
import Link from 'next/link';
import useSWR from 'swr';
import { useTranslations } from 'next-intl';
import { Toaster } from 'react-hot-toast';
import { ChevronRight, Map, Plus } from 'lucide-react';

import { fetchRoutes, hhmm, vehicleName, type Route } from '@/lib/transport-api';
import { PageBody, PageHeader, PageShell } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/EmptyState';
import { StatusChip } from '@/components/ui/StatusChip';
import { RouteFormDialog } from '@/components/transport/RouteFormDialog';
import { cn } from '@/lib/utils';

export default function TransportRoutesPage() {
  const t = useTranslations('transport.routes');
  const tt = useTranslations('transport');
  const { data: routes, isLoading, mutate } = useSWR('/transport/routes', fetchRoutes);
  const [formOpen, setFormOpen] = React.useState(false);

  return (
    <PageShell>
      <Toaster position="top-center" />
      <PageHeader
        section={tt('section')}
        title={t('title')}
        description={t('description')}
        actions={
          <Button onClick={() => setFormOpen(true)}>
            <Plus /> {t('add')}
          </Button>
        }
      />
      <PageBody>
        {!isLoading && routes?.length === 0 ? (
          <EmptyState
            icon={<Map />}
            title={t('empty')}
            action={
              <Button onClick={() => setFormOpen(true)}>
                <Plus /> {t('add')}
              </Button>
            }
          />
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {(routes ?? []).map((r) => (
              <RouteCard key={r.id} route={r} />
            ))}
          </ul>
        )}
      </PageBody>

      {formOpen && (
        <RouteFormDialog
          onClose={() => setFormOpen(false)}
          onSaved={() => {
            setFormOpen(false);
            mutate();
          }}
        />
      )}
    </PageShell>
  );
}

function RouteCard({ route: r }: { route: Route }) {
  const t = useTranslations('transport.routes');
  const riders = r.riders ?? 0;
  const capacity = r.vehicle?.capacity ?? 0;
  const full = capacity > 0 ? Math.min(1, riders / capacity) : 0;
  const over = capacity > 0 && riders > capacity;

  return (
    <li>
      <Link
        href={`/dashboard/transport/routes/${r.id}`}
        className={cn(
          'group flex h-full flex-col rounded-xl border border-line bg-surface p-4 shadow-soft transition-colors hover:border-brand',
          !r.isActive && 'opacity-70',
        )}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="eyebrow tabular">{r.routeNumber}</p>
            <p className="mt-0.5 truncate font-display text-[16px] font-semibold text-ink">{r.name}</p>
          </div>
          {!r.isActive ? (
            <StatusChip size="sm" status="INACTIVE" label={t('inactive')} />
          ) : (
            <ChevronRight className="mt-1 size-4 text-ink-faint transition-transform group-hover:translate-x-0.5" />
          )}
        </div>

        <p className="mt-2 text-[12.5px] text-ink-muted">
          {t('stops', { count: r.stops.length })}
          {(r.morningStart || r.eveningStart) && (
            <>
              {' · '}
              <span className="tabular">
                {t('times', { morning: hhmm(r.morningStart) ?? '—', evening: hhmm(r.eveningStart) ?? '—' })}
              </span>
            </>
          )}
        </p>

        <div className="mt-auto pt-3">
          <p className="text-[13px] text-ink">
            {r.vehicle ? vehicleName(r.vehicle) : <span className="text-accent-warn-deep">{t('noVehicle')}</span>}
          </p>
          <div className="mt-1.5 flex items-center gap-2">
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-inset">
              <div
                className={cn('h-full rounded-full', over ? 'bg-accent-danger' : 'bg-accent-success')}
                style={{ width: `${Math.round(full * 100)}%` }}
              />
            </div>
            <span className={cn('tabular text-[12px]', over ? 'text-accent-danger-deep' : 'text-ink-muted')}>
              {capacity ? t('riders', { riders, capacity }) : t('ridersNoVehicle', { riders })}
            </span>
          </div>
        </div>
      </Link>
    </li>
  );
}
