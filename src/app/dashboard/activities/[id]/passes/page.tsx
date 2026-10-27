'use client';

import * as React from 'react';
import { useParams } from 'next/navigation';
import useSWR from 'swr';
import toast, { Toaster } from 'react-hot-toast';
import { useLocale, useTranslations } from 'next-intl';
import {
  Ban, Car, CheckSquare, DoorOpen, Eye, History, Loader2, LogOut, Pencil, Plus, Printer, RotateCcw, Ticket, Users,
} from 'lucide-react';

import { fetchActivity } from '@/lib/activities-api';
import {
  EVENT_PASS_TIER_COLORS,
  EVENT_PASS_TIERS,
  errorMessage,
  fetchEventPassPrintData,
  fetchEventPassSummary,
  fetchEventPasses,
  passSerial,
  passShortDate,
  passStudentsLine,
  type EventPass,
  type EventPassQuery,
  type EventPassStatus,
  type EventPassTier,
} from '@/lib/event-passes-api';
import { downloadEventPassesPdf } from '@/lib/event-pass-pdf';
import { useSchoolInfo } from '@/lib/useSchoolInfo';
import { useFeatureFlag } from '@/lib/useSchoolFeatures';
import { useRbac } from '@/lib/rbac';
import { READ_ONLY_TITLE, useReadOnlySession } from '@/lib/support-session';
import { INTL_LOCALE } from '@/i18n/config';
import { cn } from '@/lib/utils';
import { PageBody, PageHeader, PageShell } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/button';
import { Checkbox, Select } from '@/components/ui/Field';
import { FilterBar, FilterField, Pagination, SearchInput } from '@/components/ui/FilterBar';
import { StatGrid, StatTile } from '@/components/ui/StatTile';
import { StatusChip } from '@/components/ui/StatusChip';
import { EmptyState } from '@/components/ui/EmptyState';
import { RowActionsMenu } from '@/components/ui/RowActionsMenu';
import { Skeleton } from '@/components/ui/skeleton';
import { EventPassFormDialog } from '@/components/event-passes/EventPassFormDialog';
import { EventPassViewDialog } from '@/components/event-passes/EventPassViewDialog';
import {
  EventPassHistoryDialog,
  EventPassReasonDialog,
  type EventPassAction,
} from '@/components/event-passes/EventPassDialogs';

/* ═══════════════════════════════════════════════════════════════════════════
   EVENT PASSES — the office's page for one event.

   Issue, find, fix, print. Selection survives paging and filtering, so
   "print every unprinted Gold pass" is: filter, Select unprinted, Print.
   Printing stamps the passes printed; editing anything printed on a pass
   clears the stamp, so "Not printed" is always the reprint list.
   ═══════════════════════════════════════════════════════════════════════════ */

const PAGE_SIZE = 50;

export default function EventPassesPage() {
  const { id } = useParams<{ id: string }>();
  const t = useTranslations('eventPasses');
  const tc = useTranslations('common');
  const ta = useTranslations('activities');
  const intlLocale = INTL_LOCALE[useLocale() as keyof typeof INTL_LOCALE];
  const rbac = useRbac();
  const readOnly = useReadOnlySession();
  const school = useSchoolInfo();
  const { enabled: featureEnabled } = useFeatureFlag('event_passes');
  const canManage = rbac.canManageActivities && !readOnly;

  const [search, setSearch] = React.useState('');
  const [debounced, setDebounced] = React.useState('');
  const [tier, setTier] = React.useState<EventPassTier | ''>('');
  const [status, setStatus] = React.useState<EventPassStatus | ''>('ACTIVE');
  const [printed, setPrinted] = React.useState<'' | 'printed' | 'unprinted'>('');
  const [insideOnly, setInsideOnly] = React.useState(false);
  const [page, setPage] = React.useState(1);
  const [selected, setSelected] = React.useState<Set<string>>(new Set());

  const [formOpen, setFormOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<EventPass | null>(null);
  const [actionPass, setActionPass] = React.useState<EventPass | null>(null);
  const [action, setAction] = React.useState<EventPassAction | null>(null);
  const [historyPass, setHistoryPass] = React.useState<EventPass | null>(null);
  const [viewing, setViewing] = React.useState<EventPass | null>(null);
  const [printing, setPrinting] = React.useState(false);

  React.useEffect(() => {
    const timer = setTimeout(() => {
      setDebounced(search.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);
  /** Any filter change goes back to page 1. */
  const filtered =
    <T,>(set: (value: T) => void) =>
    (value: T) => {
      set(value);
      setPage(1);
    };

  const query: EventPassQuery = {
    search: debounced || undefined,
    tier: tier || undefined,
    status: status || undefined,
    printed: printed || undefined,
    inside: insideOnly || undefined,
    page,
    limit: PAGE_SIZE,
  };

  const { data: activity } = useSWR(id ? `/activities/${id}` : null, () => fetchActivity(id));
  const { data: list, isLoading, mutate } = useSWR(
    id && featureEnabled ? ['event-passes', id, JSON.stringify(query)] : null,
    () => fetchEventPasses(id, query),
    { keepPreviousData: true },
  );
  const { data: summary, mutate: mutateSummary } = useSWR(
    id && featureEnabled ? ['event-pass-summary', id] : null,
    () => fetchEventPassSummary(id),
    { refreshInterval: 30_000 },
  );

  const refresh = () => {
    void mutate();
    void mutateSummary();
  };

  const rows = list?.data ?? [];
  const pageCount = list ? Math.max(1, Math.ceil(list.total / PAGE_SIZE)) : 1;
  const archived = activity?.status === 'ARCHIVED';

  const toggle = (passId: string, on: boolean) =>
    setSelected((cur) => {
      const next = new Set(cur);
      if (on) next.add(passId);
      else next.delete(passId);
      return next;
    });
  const activeRows = rows.filter((r) => r.status === 'ACTIVE');
  const allOnPage = activeRows.length > 0 && activeRows.every((r) => selected.has(r.id));

  /** Every unprinted active pass in the event, not just this page — except expired ones, which nobody needs printed. */
  const selectUnprinted = async () => {
    try {
      const all = await fetchEventPasses(id, { status: 'ACTIVE', printed: 'unprinted', tier: tier || undefined, limit: 200 });
      const printable = all.data.filter((p) => p.validity !== 'EXPIRED');
      setSelected(new Set(printable.map((p) => p.id)));
      toast.success(t('list.selectedN', { count: printable.length }));
    } catch (err) {
      toast.error(errorMessage(err, t('list.loadFailed')));
    }
  };

  const print = async () => {
    if (!selected.size || !school) return;
    setPrinting(true);
    try {
      const data = await fetchEventPassPrintData(id, [...selected], true);
      if (!data.passes.length) {
        toast.error(t('print.nothing'));
        return;
      }
      const sheets = await downloadEventPassesPdf(data.passes, data.event, school.name);
      toast.success(t('print.done', { count: data.passes.length, sheets }));
      setSelected(new Set());
      refresh();
    } catch (err) {
      toast.error(errorMessage(err, t('print.failed')));
    } finally {
      setPrinting(false);
    }
  };

  const openAction = (pass: EventPass, a: EventPassAction) => {
    setActionPass(pass);
    setAction(a);
  };

  const daysLabel = (p: EventPass) =>
    p.allDays ? t('list.allDays') : p.validDates.map((d) => passShortDate(d, intlLocale)).join(', ');

  if (featureEnabled === false) {
    return (
      <PageShell>
        <PageHeader section={ta('list.section')} title={t('title')} backHref={`/dashboard/activities/${id}`} backLabel={tc('action.back')} />
        <PageBody>
          <EmptyState icon={<Ticket />} title={t('disabledTitle')} description={t('disabledBody')} />
        </PageBody>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <Toaster position="top-center" />
      <PageHeader
        section={ta('list.section')}
        title={t('title')}
        backHref={`/dashboard/activities/${id}`}
        backLabel={tc('action.back')}
        description={
          activity
            ? `${activity.title} · ${passShortDate(activity.startDate, intlLocale)}${activity.endDate && activity.endDate !== activity.startDate ? ` – ${passShortDate(activity.endDate, intlLocale)}` : ''}`
            : undefined
        }
        actions={
          canManage && (
            <>
              <Button variant="outline" onClick={print} disabled={!selected.size || printing || !school}>
                {printing ? <Loader2 className="animate-spin" /> : <Printer />}
                {t('print.button', { count: selected.size })}
              </Button>
              <Button
                onClick={() => {
                  setEditing(null);
                  setFormOpen(true);
                }}
                disabled={archived || readOnly}
                title={readOnly ? READ_ONLY_TITLE : archived ? t('archivedHint') : undefined}
              >
                <Plus /> {t('issue')}
              </Button>
            </>
          )
        }
      />
      <PageBody>
        <StatGrid columns={4}>
          <StatTile
            label={t('stat.passes')}
            value={summary?.active ?? '—'}
            hint={summary ? t('stat.people', { count: summary.byTier.reduce((n, r) => n + r.people, 0) }) : undefined}
            icon={<Ticket />}
          />
          <StatTile
            label={t('stat.inside')}
            value={summary?.insidePeople ?? '—'}
            hint={summary ? t('stat.insidePasses', { count: summary.insidePasses }) : undefined}
            icon={<DoorOpen />}
            pigment="success"
          />
          <StatTile
            label={t('stat.enteredToday')}
            value={summary?.enteredTodayPasses ?? '—'}
            hint={
              summary
                ? summary.deniedToday
                  ? t('stat.checkInsDenied', { count: summary.checkInsToday, denied: summary.deniedToday })
                  : t('stat.checkIns', { count: summary.checkInsToday })
                : undefined
            }
            icon={<Users />}
          />
          <StatTile
            label={t('stat.unprinted')}
            value={summary?.unprinted ?? '—'}
            hint={summary?.cancelled ? t('stat.cancelled', { count: summary.cancelled }) : undefined}
            icon={<Printer />}
            pigment={summary?.unprinted ? 'attn' : 'neutral'}
          />
        </StatGrid>

        {summary && summary.byTier.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {EVENT_PASS_TIERS.map((tierKey) => {
              const row = summary.byTier.find((r) => r.tier === tierKey);
              if (!row) return null;
              return (
                <span key={tierKey} className="border-line bg-surface text-ink inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[12px]">
                  <span className="size-2 rounded-full" style={{ backgroundColor: EVENT_PASS_TIER_COLORS[tierKey].band }} aria-hidden />
                  {t(`tier.${tierKey}`)} · {t('list.tierCount', { passes: row.passes, people: row.people })}
                </span>
              );
            })}
          </div>
        )}

        <FilterBar
          className="mt-4"
          actions={
            canManage && (
              <Button variant="ghost" size="sm" onClick={selectUnprinted}>
                <CheckSquare /> {t('list.selectUnprinted')}
              </Button>
            )
          }
        >
          <SearchInput value={search} onValueChange={setSearch} placeholder={t('list.search')} className="basis-full sm:basis-auto" />
          <FilterField label={t('list.tier')} width="sm">
            <Select value={tier} onChange={(e) => filtered(setTier)(e.target.value as EventPassTier | '')}>
              <option value="">{t('list.any')}</option>
              {EVENT_PASS_TIERS.map((v) => (
                <option key={v} value={v}>
                  {t(`tier.${v}`)}
                </option>
              ))}
            </Select>
          </FilterField>
          <FilterField label={t('list.status')} width="sm">
            <Select value={status} onChange={(e) => filtered(setStatus)(e.target.value as EventPassStatus | '')}>
              <option value="">{t('list.any')}</option>
              <option value="ACTIVE">{t('status.ACTIVE')}</option>
              <option value="CANCELLED">{t('status.CANCELLED')}</option>
            </Select>
          </FilterField>
          <FilterField label={t('list.printed')} width="sm">
            <Select value={printed} onChange={(e) => filtered(setPrinted)(e.target.value as '' | 'printed' | 'unprinted')}>
              <option value="">{t('list.any')}</option>
              <option value="unprinted">{t('list.notPrinted')}</option>
              <option value="printed">{t('list.isPrinted')}</option>
            </Select>
          </FilterField>
          <Checkbox checked={insideOnly} onChange={(e) => filtered(setInsideOnly)(e.target.checked)} label={t('list.insideNow')} className="self-end" />
        </FilterBar>

        <div className="border-line bg-surface mt-3 overflow-hidden rounded-xl border">
          {isLoading && !list ? (
            <div className="space-y-2 p-4">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : rows.length === 0 ? (
            <EmptyState
              icon={<Ticket />}
              title={t('list.emptyTitle')}
              description={t('list.emptyBody')}
              compact
            />
          ) : (
            <>
              {canManage && (
                <div className="border-line text-ink-muted flex items-center gap-3 border-b px-4 py-2 text-[12px]">
                  <Checkbox
                    checked={allOnPage}
                    onChange={(e) => activeRows.forEach((r) => toggle(r.id, e.target.checked))}
                    label={t('list.selectPage')}
                  />
                  {selected.size > 0 && (
                    <button type="button" className="text-brand ml-auto hover:underline" onClick={() => setSelected(new Set())}>
                      {t('list.clearSelection', { count: selected.size })}
                    </button>
                  )}
                </div>
              )}
              <ul className="divide-line divide-y">
                {rows.map((p) => {
                  const students = passStudentsLine(p.students);
                  return (
                    <li key={p.id} className={cn('flex gap-3 px-4 py-3', p.status === 'CANCELLED' && 'opacity-60')}>
                      {canManage && (
                        <input
                          type="checkbox"
                          aria-label={t('list.selectPass', { serial: passSerial(p.serial) })}
                          className="border-line-strong accent-brand mt-1 size-4 shrink-0 cursor-pointer rounded"
                          disabled={p.status !== 'ACTIVE'}
                          checked={selected.has(p.id)}
                          onChange={(e) => toggle(p.id, e.target.checked)}
                        />
                      )}
                      <span
                        className="mt-0.5 h-10 w-1.5 shrink-0 rounded-full"
                        style={{ backgroundColor: EVENT_PASS_TIER_COLORS[p.tier].band }}
                        aria-hidden
                      />
                      <button
                        type="button"
                        onClick={() => setViewing(p)}
                        className="hover:bg-brand/5 -my-1 min-w-0 flex-1 cursor-pointer rounded-lg px-1.5 py-1 text-left transition-colors"
                      >
                        <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                          <span className="text-ink-muted font-mono text-[12px]">{passSerial(p.serial)}</span>
                          <span className="text-ink truncate text-[14px] font-semibold">
                            {p.holderName || (students ? t('list.parentOf', { names: students }) : t('list.guest'))}
                          </span>
                          <span className="text-ink-muted text-[12px]">{t(`tier.${p.tier}`)}</span>
                          {p.status === 'CANCELLED' ? (
                            <StatusChip status="CANCELLED" pigment="danger" label={t('status.CANCELLED')} />
                          ) : p.inside ? (
                            <StatusChip status="INSIDE" pigment="success" label={t('list.inside', { people: p.checkedInPeople ?? 0 })} />
                          ) : null}
{p.status === 'ACTIVE' && p.validity && p.validity !== 'VALID_TODAY' && (
                            <StatusChip
                              status={p.validity}
                              pigment={p.validity === 'UPCOMING' ? 'info' : 'neutral'}
                              label={t(`validity.${p.validity}`, { date: p.validFrom ? passShortDate(p.validFrom, intlLocale) : '' })}
                            />
                          )}
                          {p.status === 'ACTIVE' && !p.printedAt && (
                            <StatusChip status="UNPRINTED" pigment="attn" label={t('list.notPrinted')} />
                          )}
                        </span>
                        <span className="block text-ink-muted mt-0.5 text-[12.5px]">
                          {[
                            p.mobile,
                            students && p.holderName ? t('list.parentOf', { names: students }) : null,
                          ]
                            .filter(Boolean)
                            .join(' · ')}
                        </span>
                        <span className="text-ink-muted mt-0.5 flex flex-wrap items-center gap-x-3 text-[12.5px]">
                          <span className="inline-flex items-center gap-1">
                            <Users className="size-3.5" aria-hidden />
                            {t('list.admits', { count: p.membersAllowed })}
                            {p.memberNames.length > 0 && ` · ${p.memberNames.join(', ')}`}
                          </span>
                          <span>{daysLabel(p)}</span>
                          {p.vehicleNumber && (
                            <span className="inline-flex items-center gap-1">
                              <Car className="size-3.5" aria-hidden />
                              {p.vehicleType ? `${t(`vehicle.${p.vehicleType}`)} · ` : ''}
                              {p.vehicleNumber}
                            </span>
                          )}
                        </span>
                        {p.status === 'CANCELLED' && p.cancelReason && (
                          <span className="block text-accent-danger-deep mt-0.5 text-[12px]">
                            {t('list.cancelledBy', { name: p.cancelledByName ?? '—', reason: p.cancelReason })}
                          </span>
                        )}
                      </button>
                      {canManage && (
                        <RowActionsMenu
                          label={tc('action.actions')}
                          actions={[
                            {
                              label: t('view.menu'),
                              icon: <Eye />,
                              onSelect: () => setViewing(p),
                            },
                            p.status === 'ACTIVE' &&
                              !archived && {
                                label: tc('action.edit'),
                                icon: <Pencil />,
                                onSelect: () => {
                                  setEditing(p);
                                  setFormOpen(true);
                                },
                              },
                            {
                              label: t('history.open'),
                              icon: <History />,
                              onSelect: () => setHistoryPass(p),
                            },
                            !!p.checkedInAt && {
                              label: t('action.checkOut.menu'),
                              icon: <LogOut />,
                              onSelect: () => openAction(p, 'checkOut'),
                            },
                            p.status === 'ACTIVE' &&
                              !archived && {
                                label: t('action.reissue.menu'),
                                icon: <RotateCcw />,
                                onSelect: () => openAction(p, 'reissue'),
                              },
                            p.status === 'ACTIVE' && {
                              label: t('action.cancel.menu'),
                              icon: <Ban />,
                              danger: true,
                              onSelect: () => openAction(p, 'cancel'),
                            },
                          ]}
                        />
                      )}
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </div>

        <Pagination className="mt-3" page={page} pageCount={pageCount} onPageChange={setPage} total={list?.total} pageSize={PAGE_SIZE} />
      </PageBody>

      {activity && (
        <EventPassFormDialog
          open={formOpen}
          onOpenChange={setFormOpen}
          activity={activity}
          pass={editing}
          onSaved={refresh}
        />
      )}
      <EventPassReasonDialog
        activityId={id}
        pass={actionPass}
        action={action}
        onClose={() => {
          setActionPass(null);
          setAction(null);
        }}
        onDone={refresh}
      />
      <EventPassViewDialog
        activityId={id}
        event={activity ?? null}
        pass={viewing}
        canManage={canManage}
        onClose={() => setViewing(null)}
        onEdit={(p) => {
          setViewing(null);
          setEditing(p);
          setFormOpen(true);
        }}
        onHistory={(p) => setHistoryPass(p)}
        onChanged={refresh}
      />
      <EventPassHistoryDialog activityId={id} pass={historyPass} onClose={() => setHistoryPass(null)} />
    </PageShell>
  );
}
