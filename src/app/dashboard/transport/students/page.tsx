'use client';

import * as React from 'react';
import useSWR from 'swr';
import { useTranslations } from 'next-intl';
import toast, { Toaster } from 'react-hot-toast';
import { Plus, Users } from 'lucide-react';

import {
  endTransport,
  errorMessage,
  fetchAssignments,
  fetchRoutes,
  fetchSettings,
  fetchStudentTransport,
  todayIst,
  type Assignment,
  type AssignmentQuery,
} from '@/lib/transport-api';
import { PageBody, PageHeader, PageShell } from '@/components/ui/PageHeader';
import { Column, DataTable, TableCount } from '@/components/ui/DataTable';
import { FilterBar, FilterField, SearchInput } from '@/components/ui/FilterBar';
import { Button } from '@/components/ui/button';
import { Field, Input, Select } from '@/components/ui/Field';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { formatINR, Money } from '@/components/ui/Money';
import { RowActionsMenu } from '@/components/ui/RowActionsMenu';
import { StatusChip } from '@/components/ui/StatusChip';
import type { Pigment } from '@/components/ui/pigment';
import { AssignTransportDialog } from '@/components/transport/AssignTransportDialog';
import { useFormatDate } from '@/components/transport/format';

const PAGE_SIZE = 25;
type StatusFilter = NonNullable<AssignmentQuery['status']>;

const STATE_PIGMENT: Record<Assignment['state'], Pigment> = {
  CURRENT: 'success',
  UPCOMING: 'info',
  ENDED: 'neutral',
  CHANGED: 'neutral',
};

export default function TransportStudentsPage() {
  const t = useTranslations('transport.students');
  const tt = useTranslations('transport');
  const tc = useTranslations('common');
  const formatDate = useFormatDate();

  const [search, setSearch] = React.useState('');
  const [routeId, setRouteId] = React.useState<number | ''>('');
  const [status, setStatus] = React.useState<StatusFilter>('current');
  const [page, setPage] = React.useState(1);

  const query: AssignmentQuery = { search: search || undefined, routeId: routeId || undefined, status, page, limit: PAGE_SIZE };
  const { data, isLoading, mutate } = useSWR(`/transport/assignments?${JSON.stringify(query)}`, () => fetchAssignments(query));
  const { data: routes } = useSWR('/transport/routes', fetchRoutes);

  const [assignOpen, setAssignOpen] = React.useState(false);
  const [changing, setChanging] = React.useState<Assignment | null>(null);
  const [ending, setEnding] = React.useState<Assignment | null>(null);
  const [historyOf, setHistoryOf] = React.useState<Assignment | null>(null);

  const filtered = Boolean(search || routeId || status !== 'current');

  const columns: Column<Assignment>[] = [
    {
      key: 'student',
      header: t('col.student'),
      card: 'title',
      accessor: (a) => (
        <div className="min-w-0">
          <p className="font-medium text-ink">{a.student?.name}</p>
          <p className="text-[12px] text-ink-muted">
            {[a.student?.className && `${a.student.className}${a.student.sectionName ? `-${a.student.sectionName}` : ''}`, a.student?.admissionNumber]
              .filter(Boolean)
              .join(' · ')}
          </p>
        </div>
      ),
    },
    {
      key: 'route',
      header: t('col.route'),
      card: 'meta',
      accessor: (a) => <span className="tabular">{a.pickupRoute.routeNumber}</span>,
    },
    {
      key: 'pickup',
      header: t('col.pickup'),
      accessor: (a) => (
        <div>
          <p>{a.pickupStop.name}</p>
          {!a.dropSameAsPickup && (
            <p className="text-[12px] text-ink-muted">
              {t('differentEvening', { route: a.dropRoute.routeNumber, stop: a.dropStop.name })}
            </p>
          )}
        </div>
      ),
    },
    {
      key: 'fee',
      header: t('col.fee'),
      align: 'right',
      accessor: (a) => (
        <div className="text-right">
          <Money amount={a.monthlyFee} symbol />
          {a.exemption && a.exemption.status !== 'REJECTED' && (
            <div className="mt-0.5 flex justify-end">
              <StatusChip
                size="sm"
                status={a.exemption.status ?? undefined}
                label={
                  a.exemption.status === 'APPROVED'
                    ? t('net', { amount: formatINR(a.exemption.netMonthlyFee, { symbol: true }) })
                    : tt('exemptionStatus.PENDING')
                }
              />
            </div>
          )}
        </div>
      ),
    },
    {
      key: 'since',
      header: t('col.since'),
      hideBelow: 'lg',
      accessor: (a) => (
        <span className="tabular text-[12.5px] text-ink-muted">
          {formatDate(a.startDate)}
          {a.endDate ? ` – ${formatDate(a.endDate)}` : ''}
        </span>
      ),
    },
    {
      key: 'status',
      header: t('col.status'),
      card: 'trailing',
      accessor: (a) => <StatusChip size="sm" pigment={STATE_PIGMENT[a.state]} label={tt(`state.${a.state}`)} />,
    },
    {
      key: 'actions',
      header: tc('action.actions'),
      align: 'right',
      card: 'trailing',
      accessor: (a) => (
        <RowActionsMenu
          actions={[
            a.state !== 'ENDED' && a.state !== 'CHANGED' && { label: t('menu.change'), onSelect: () => setChanging(a) },
            a.state !== 'ENDED' && a.state !== 'CHANGED' && { label: t('menu.end'), onSelect: () => setEnding(a) },
            { label: t('menu.history'), onSelect: () => setHistoryOf(a) },
          ]}
        />
      ),
    },
  ];

  return (
    <PageShell>
      <Toaster position="top-center" />
      <PageHeader
        section={tt('section')}
        title={t('title')}
        description={t('description')}
        actions={
          <Button onClick={() => setAssignOpen(true)}>
            <Plus /> {t('assign')}
          </Button>
        }
      />
      <PageBody>
        <FilterBar>
          <SearchInput
            value={search}
            onValueChange={(v) => {
              setSearch(v);
              setPage(1);
            }}
            placeholder={t('searchPlaceholder')}
          />
          <FilterField label={t('route')} width="md">
            <Select
              value={routeId}
              onChange={(e) => {
                setRouteId(e.target.value ? Number(e.target.value) : '');
                setPage(1);
              }}
            >
              <option value="">{t('allRoutes')}</option>
              {(routes ?? []).map((r) => (
                <option key={r.id} value={r.id}>
                  {r.routeNumber} — {r.name}
                </option>
              ))}
            </Select>
          </FilterField>
          <FilterField label={t('status')} width="md">
            <Select
              value={status}
              onChange={(e) => {
                setStatus(e.target.value as StatusFilter);
                setPage(1);
              }}
            >
              {(['current', 'upcoming', 'ended', 'all'] as const).map((s) => (
                <option key={s} value={s}>
                  {t(`filter.${s}`)}
                </option>
              ))}
            </Select>
          </FilterField>
        </FilterBar>

        <DataTable
          className="mt-4"
          columns={columns}
          data={data?.data}
          loading={isLoading}
          rowKey={(a) => a.id}
          emptyMessage={filtered ? t('emptyFiltered') : t('empty')}
          toolbar={
            <>
              <Users className="size-4 text-ink-faint" />
              <span className="font-display text-[15px] font-semibold text-ink">{t('tableTitle')}</span>
              {data && <TableCount>{data.total}</TableCount>}
            </>
          }
          footer={
            data && data.total > PAGE_SIZE ? (
              <span className="text-[12.5px] text-ink-muted">
                {t('pageOf', { page, pages: Math.max(1, Math.ceil(data.total / PAGE_SIZE)) })}
              </span>
            ) : undefined
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

      {(assignOpen || changing) && (
        <AssignTransportDialog
          existing={changing}
          onClose={() => {
            setAssignOpen(false);
            setChanging(null);
          }}
          onSaved={() => {
            setAssignOpen(false);
            setChanging(null);
            mutate();
          }}
        />
      )}
      {ending && (
        <EndTransportDialog
          assignment={ending}
          onClose={() => setEnding(null)}
          onSaved={() => {
            setEnding(null);
            mutate();
          }}
        />
      )}
      {historyOf && historyOf.student && (
        <HistoryDialog studentId={historyOf.student.id} name={historyOf.student.name} onClose={() => setHistoryOf(null)} />
      )}
    </PageShell>
  );
}

function EndTransportDialog({
  assignment,
  onClose,
  onSaved,
}: {
  assignment: Assignment;
  onClose: () => void;
  onSaved: () => void;
}) {
  const t = useTranslations('transport.endForm');
  const tt = useTranslations('transport');
  const tc = useTranslations('common');
  const { data: settings } = useSWR('/transport/settings', fetchSettings);
  const [lastDay, setLastDay] = React.useState(todayIst());
  const [reason, setReason] = React.useState('');
  const [saving, setSaving] = React.useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await endTransport(assignment.id, { lastDay, reason: reason.trim() || undefined });
      toast.success(t('ended'));
      onSaved();
    } catch (err) {
      toast.error(errorMessage(err, t('failed')));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={submit}>
          <DialogHeader>
            <DialogTitle>{t('title', { name: assignment.student?.name ?? '' })}</DialogTitle>
          </DialogHeader>
          <div className="mt-3 space-y-4">
            <Field label={t('lastDay')} required>
              <Input type="date" value={lastDay} min={assignment.startDate} onChange={(e) => setLastDay(e.target.value)} required />
            </Field>
            <Field label={t('reason')}>
              <Input value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} />
            </Field>
            {settings && (
              <p className="text-[12.5px] text-ink-muted">
                {t('hint', { rule: tt(`billing.${settings.leaveBilling}`).toLowerCase() })}
              </p>
            )}
          </div>
          <DialogFooter className="mt-5">
            <Button type="button" variant="ghost" onClick={onClose}>
              {tc('action.cancel')}
            </Button>
            <Button type="submit" variant="destructive" disabled={saving}>
              {saving ? tc('action.saving') : t('save')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function HistoryDialog({ studentId, name, onClose }: { studentId: number; name: string; onClose: () => void }) {
  const t = useTranslations('transport.history');
  const tt = useTranslations('transport');
  const tc = useTranslations('common');
  const formatDate = useFormatDate();
  const { data } = useSWR(`/transport/students/${studentId}`, () => fetchStudentTransport(studentId));

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t('title', { name })}</DialogTitle>
        </DialogHeader>
        <div className="mt-3 max-h-[65vh] overflow-y-auto">
          {!data ? null : data.history.length === 0 ? (
            <p className="text-[13px] text-ink-muted">{t('empty')}</p>
          ) : (
            <ol className="space-y-3">
              {data.history.map((h) => (
                <li key={h.id} className="rounded-lg border border-line p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="tabular text-[12.5px] text-ink-muted">
                      {h.endDate
                        ? t('period', { from: formatDate(h.startDate), to: formatDate(h.endDate) })
                        : t('ongoing', { from: formatDate(h.startDate) })}
                    </span>
                    <StatusChip size="sm" pigment={STATE_PIGMENT[h.state]} label={tt(`state.${h.state}`)} />
                  </div>
                  <p className="mt-1.5 text-[13.5px] text-ink">
                    <span className="tabular">{h.pickupRoute.routeNumber}</span> · {h.pickupStop.name}
                    {!h.dropSameAsPickup && (
                      <span className="text-ink-muted">
                        {' · '}
                        {tt('students.differentEvening', { route: h.dropRoute.routeNumber, stop: h.dropStop.name })}
                      </span>
                    )}
                  </p>
                  <p className="mt-0.5 text-[13px] text-ink">
                    <Money amount={h.monthlyFee} symbol />
                    {h.exemption && (
                      <span className="text-ink-muted">
                        {' · '}
                        {t('exemption', {
                          value: h.exemption.type === 'PERCENT' ? `${h.exemption.value}%` : formatINR(h.exemption.value, { symbol: true }),
                        })}{' '}
                        ({tt(`exemptionStatus.${h.exemption.status ?? 'PENDING'}`)})
                      </span>
                    )}
                  </p>
                  {h.remarks && <p className="mt-1 text-[12px] text-ink-faint">{h.remarks}</p>}
                </li>
              ))}
            </ol>
          )}
        </div>
        <DialogFooter className="mt-4">
          <Button type="button" variant="ghost" onClick={onClose}>
            {tc('action.close')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
