'use client';

import * as React from 'react';
import Link from 'next/link';
import useSWR from 'swr';
import { useTranslations } from 'next-intl';
import toast, { Toaster } from 'react-hot-toast';
import { AlertTriangle, BadgePercent, Bus, FileWarning, Map, Smartphone, Users } from 'lucide-react';

import {
  decideExemption,
  errorMessage,
  fetchOverview,
  fetchPendingExemptions,
  type Assignment,
  type ExpiringDocument,
} from '@/lib/transport-api';
import { useRbac } from '@/lib/rbac';
import { PageBody, PageHeader, PageShell } from '@/components/ui/PageHeader';
import { Panel, PanelBody, PanelHeader } from '@/components/ui/Panel';
import { StatGrid, StatTile } from '@/components/ui/StatTile';
import { StatusChip } from '@/components/ui/StatusChip';
import { Money } from '@/components/ui/Money';
import { Button, buttonVariants } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/EmptyState';
import { ExpiryChip } from '@/components/transport/ExpiryChip';
import { useFormatDate } from '@/components/transport/format';

export default function TransportOverviewPage() {
  const t = useTranslations('transport.overview');
  const tt = useTranslations('transport');
  const { data, isLoading, mutate } = useSWR('/transport/overview', fetchOverview);
  const { data: pending, mutate: mutatePending } = useSWR('/transport/exemptions/pending', fetchPendingExemptions);

  const attention: React.ReactNode[] = [];
  if (data?.routesWithoutVehicle) {
    attention.push(t('noVehicle', { count: data.routesWithoutVehicle }));
  }
  for (const r of data?.overCapacity ?? []) {
    attention.push(t('overCapacity', { route: r.routeNumber, riders: r.riders, capacity: r.capacity }));
  }

  const refresh = () => {
    mutate();
    mutatePending();
  };

  return (
    <PageShell>
      <Toaster position="top-center" />
      <PageHeader
        section={tt('section')}
        title={t('title')}
        description={t('description')}
        actions={
          <Link href="/crew-app" target="_blank" className={buttonVariants({ variant: 'outline', size: 'sm' })}>
            <Smartphone />
            {t('crewApp')}
          </Link>
        }
      />
      <PageBody>
        <StatGrid columns={4}>
          <StatTile label={t('stat.vehicles')} value={isLoading ? '—' : data?.vehicles ?? 0} icon={<Bus />} pigment="info" />
          <StatTile label={t('stat.routes')} value={isLoading ? '—' : data?.routes ?? 0} icon={<Map />} pigment="info" />
          <StatTile label={t('stat.riders')} value={isLoading ? '—' : data?.riders ?? 0} icon={<Users />} pigment="success" />
          <StatTile
            label={t('stat.pending')}
            value={isLoading ? '—' : data?.pendingExemptions ?? 0}
            icon={<BadgePercent />}
            pigment={data?.pendingExemptions ? 'attn' : 'neutral'}
          />
        </StatGrid>

        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <Panel>
            <PanelHeader title={t('pendingTitle')} />
            <PanelBody>
              {!pending || pending.length === 0 ? (
                <p className="text-[13px] text-ink-muted">{t('pendingEmpty')}</p>
              ) : (
                <ul className="divide-y divide-line">
                  {pending.map((a) => (
                    <PendingExemptionRow key={a.id} assignment={a} onDecided={refresh} />
                  ))}
                </ul>
              )}
            </PanelBody>
          </Panel>

          <div className="space-y-4">
            <Panel>
              <PanelHeader title={t('attention')} />
              <PanelBody>
                {attention.length === 0 ? (
                  <p className="text-[13px] text-ink-muted">{t('allClear')}</p>
                ) : (
                  <ul className="space-y-2">
                    {attention.map((line, i) => (
                      <li key={i} className="flex items-start gap-2 text-[13.5px] text-ink">
                        <AlertTriangle className="mt-0.5 size-4 shrink-0 text-accent-warn-deep" />
                        <span>{line}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </PanelBody>
            </Panel>

            <Panel>
              <PanelHeader
                title={t('documentsTitle')}
                action={
                  <Link href="/dashboard/transport/vehicles" className="text-[12.5px] font-medium text-accent-info-deep hover:underline">
                    {t('openVehicles')}
                  </Link>
                }
              />
              <PanelBody>
                <DocumentList documents={data?.documents} reminderDays={data?.reminderDays ?? 30} />
              </PanelBody>
            </Panel>
          </div>
        </div>
      </PageBody>
    </PageShell>
  );
}

function DocumentList({ documents, reminderDays }: { documents: ExpiringDocument[] | undefined; reminderDays: number }) {
  const t = useTranslations('transport');
  const formatDate = useFormatDate();
  if (!documents) return null;
  if (documents.length === 0) {
    return (
      <EmptyState compact icon={<FileWarning />} title={t('overview.documentsEmpty', { days: reminderDays })} />
    );
  }
  return (
    <ul className="divide-y divide-line">
      {documents.map((d) => (
        <li key={`${d.vehicleId}-${d.document}`} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
          <div className="min-w-0">
            <p className="text-[13.5px] font-medium text-ink">
              {d.fleetNumber ? `${d.fleetNumber} · ` : ''}
              <span className="tabular">{d.registrationNumber}</span>
            </p>
            <p className="text-[12px] text-ink-muted">
              {t(`document.${d.document}`)} · <span className="tabular">{formatDate(d.expiresOn)}</span>
            </p>
          </div>
          <ExpiryChip daysLeft={d.daysLeft} />
        </li>
      ))}
    </ul>
  );
}

function PendingExemptionRow({ assignment: a, onDecided }: { assignment: Assignment; onDecided: () => void }) {
  const t = useTranslations('transport.overview');
  const rbac = useRbac();
  const [busy, setBusy] = React.useState<'approve' | 'reject' | null>(null);
  const ex = a.exemption!;

  const decide = async (approve: boolean) => {
    setBusy(approve ? 'approve' : 'reject');
    try {
      await decideExemption(a.id, { approve });
      toast.success(approve ? t('approved') : t('rejected'));
      onDecided();
    } catch (err) {
      toast.error(errorMessage(err, t('decideFailed')));
    } finally {
      setBusy(null);
    }
  };

  return (
    <li className="py-3 first:pt-0 last:pb-0">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[14px] font-medium text-ink">{a.student?.name}</p>
          <p className="text-[12px] text-ink-muted">
            {a.pickupRoute.routeNumber} · {a.pickupStop.name}
            {a.student?.className ? ` · ${a.student.className}${a.student.sectionName ? `-${a.student.sectionName}` : ''}` : ''}
          </p>
        </div>
        <StatusChip status="PENDING" size="sm" />
      </div>
      <p className="mt-1.5 text-[13px] text-ink">
        {ex.type === 'PERCENT' ? <span className="tabular">{ex.value}%</span> : <Money amount={ex.value} symbol />}
        {' · '}
        <Money amount={ex.monthlyAmount} symbol /> / <Money amount={a.monthlyFee} symbol />
        {ex.reason ? <span className="text-ink-muted"> — {ex.reason}</span> : null}
      </p>
      {ex.requestedBy && <p className="mt-0.5 text-[12px] text-ink-faint">{t('requestedBy', { name: ex.requestedBy })}</p>}
      {/* The server decides who may approve (a school setting); the buttons
          are shown to admins, and anyone else gets the server's answer. */}
      {rbac.isSubAdmin && (
        <div className="mt-2 flex gap-2">
          <Button size="sm" onClick={() => decide(true)} disabled={busy !== null}>
            {t('approve')}
          </Button>
          <Button size="sm" variant="outline" onClick={() => decide(false)} disabled={busy !== null}>
            {t('reject')}
          </Button>
        </div>
      )}
    </li>
  );
}
