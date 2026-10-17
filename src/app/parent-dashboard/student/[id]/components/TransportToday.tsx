'use client';

import * as React from 'react';
import useSWR from 'swr';
import { useLocale, useTranslations } from 'next-intl';
import toast from 'react-hot-toast';
import { CalendarX2, Check, Sun, Sunset, X } from 'lucide-react';

import {
  errorMessage,
  fetchChildDay,
  hhmm,
  istClock,
  setNotTravelling,
  todayIst,
  withdrawNotTravelling,
  type ChildDay,
  type TripLeg,
} from '@/lib/transport-api';
import { INTL_LOCALE } from '@/i18n/config';
import { Button } from '@/components/ui/button';
import { Checkbox, Field, Input } from '@/components/ui/Field';
import { StatusChip } from '@/components/ui/StatusChip';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useFormatDate } from '@/components/transport/format';
import { LiveBusCard } from './LiveBusCard';

/**
 * Today on the bus: each leg's marks as they happen (boarded, reached
 * school, dropped, handed over), plus "not travelling" so the bus does not
 * wait at the stop. Polls while a trip is running.
 */
export function TransportToday({ studentId }: { studentId: number }) {
  const t = useTranslations('transport.parent.day');
  const formatDate = useFormatDate();
  const { data, mutate } = useSWR(['child-day', studentId], () => fetchChildDay(studentId), {
    refreshInterval: (d) => (d?.legs.some((l) => l.trip?.status === 'IN_PROGRESS') ? 30_000 : 0),
  });
  const [planning, setPlanning] = React.useState(false);
  const [busy, setBusy] = React.useState(false);

  if (!data || data.legs.length === 0) return null;
  const today = data.date;
  const later = data.notices.filter((n) => n.date > today);

  const toggleToday = async (leg: TripLeg, on: boolean) => {
    setBusy(true);
    try {
      const next = on
        ? await setNotTravelling(studentId, { date: today, legs: [leg] })
        : await withdrawNotTravelling(studentId, { date: today, legs: [leg] });
      await mutate(next, { revalidate: false });
      toast.success(on ? t('savedOff') : t('savedOn'));
    } catch (e) {
      toast.error(errorMessage(e, t('failed')));
    } finally {
      setBusy(false);
    }
  };

  const withdraw = async (date: string, leg: TripLeg) => {
    setBusy(true);
    try {
      await mutate(await withdrawNotTravelling(studentId, { date, legs: [leg] }), { revalidate: false });
    } catch (e) {
      toast.error(errorMessage(e, t('failed')));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-xl border border-line bg-surface p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="font-display text-[16px] font-semibold text-ink">{t('title')}</p>
        <Button size="sm" variant="ghost" onClick={() => setPlanning(true)}>
          <CalendarX2 /> {t('planAhead')}
        </Button>
      </div>
      {data.legs.some((l) => l.trip?.status === 'IN_PROGRESS') && (
        <div className="mt-3">
          <LiveBusCard studentId={studentId} />
        </div>
      )}
      <div className="mt-2 divide-y divide-line">
        {data.legs.map((l) => (
          <LegToday key={l.leg} leg={l} busy={busy} onToggle={(on) => toggleToday(l.leg, on)} />
        ))}
      </div>
      {later.length > 0 && (
        <div className="mt-3 border-t border-line pt-3">
          <p className="text-[12px] font-semibold uppercase tracking-wide text-ink-muted">{t('upcoming')}</p>
          <ul className="mt-1.5 space-y-1.5">
            {later.map((n) => (
              <li key={`${n.date}-${n.leg}`} className="flex items-center gap-2 text-[13.5px] text-ink">
                <span className="min-w-0 flex-1 truncate">
                  {formatDate(n.date)} · {t(`legName.${n.leg}`)}
                  {n.reason && <span className="text-ink-muted"> · {n.reason}</span>}
                </span>
                <Button size="sm" variant="ghost" disabled={busy} onClick={() => withdraw(n.date, n.leg)}>
                  <X /> {t('withdraw')}
                </Button>
              </li>
            ))}
          </ul>
        </div>
      )}
      {planning && (
        <PlanDialog
          studentId={studentId}
          onClose={() => setPlanning(false)}
          onSaved={(next) => {
            setPlanning(false);
            void mutate(next, { revalidate: false });
          }}
        />
      )}
    </div>
  );
}

function LegToday({ leg, busy, onToggle }: { leg: ChildDay['legs'][number]; busy: boolean; onToggle: (notTravelling: boolean) => void }) {
  const t = useTranslations('transport.parent.day');
  const tt = useTranslations('transport.trip');
  const intl = INTL_LOCALE[useLocale()];
  const time = hhmm(leg.stop?.time);
  const running = leg.trip?.status === 'IN_PROGRESS';

  let status: React.ReactNode;
  if (leg.notTravelling) status = <StatusChip pigment="attn" label={t('notTravelling')} />;
  else if (leg.state) status = <StatusChip pigment={leg.state === 'BOARDED' ? 'info' : leg.state === 'NO_SHOW' || leg.state === 'NOT_TRAVELLING' ? 'attn' : 'success'} label={tt(`state.${leg.state}`)} />;
  else if (running) status = <StatusChip pigment="info" label={t('busOnWay')} />;
  else if (leg.trip) status = <StatusChip pigment="neutral" label={t('tripDone')} />;
  else status = <StatusChip pigment="neutral" label={t('notStarted')} />;

  return (
    <div className="py-3">
      <div className="flex flex-wrap items-center gap-2">
        {leg.leg === 'MORNING' ? <Sun className="size-4 text-ink-muted" /> : <Sunset className="size-4 text-ink-muted" />}
        <span className="text-[14px] font-medium text-ink">{t(`legName.${leg.leg}`)}</span>
        {leg.stop && (
          <span className="text-[12.5px] text-ink-muted">
            {leg.stop.name}
            {time && <span className="tabular"> · {time}</span>}
          </span>
        )}
        <span className="ml-auto">{status}</span>
      </div>
      {leg.events.length > 0 && (
        <ol className="mt-2 space-y-1 border-l-2 border-line pl-3">
          {leg.events.map((e, i) => (
            <li key={i} className="flex gap-2 text-[13px] text-ink">
              <span className="tabular w-16 shrink-0 text-ink-muted">{istClock(e.at, intl)}</span>
              <span className="min-w-0">
                {e.handedToName ? tt('stateHanded', { name: e.handedToName }) : tt(`event.${e.type}`)}
                {e.stopName && <span className="text-ink-muted"> · {e.stopName}</span>}
              </span>
            </li>
          ))}
        </ol>
      )}
      {leg.canChangeNotice && (
        <div className="mt-2">
          {leg.notTravelling ? (
            <Button size="sm" variant="outline" disabled={busy} onClick={() => onToggle(false)}>
              <Check /> {t('willTravel')}
            </Button>
          ) : (
            <Button size="sm" variant="outline" disabled={busy} onClick={() => onToggle(true)}>
              <X /> {t('notToday')}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

function PlanDialog({ studentId, onClose, onSaved }: { studentId: number; onClose: () => void; onSaved: (d: ChildDay) => void }) {
  const t = useTranslations('transport.parent.day');
  const tc = useTranslations('common');
  const today = todayIst();
  const [date, setDate] = React.useState(today);
  const [morning, setMorning] = React.useState(true);
  const [evening, setEvening] = React.useState(true);
  const [reason, setReason] = React.useState('');
  const [saving, setSaving] = React.useState(false);
  const max = (() => {
    const [y, m, d] = today.split('-').map(Number);
    return new Date(Date.UTC(y, m - 1, d + 30)).toISOString().slice(0, 10);
  })();
  const legs = [morning && 'MORNING', evening && 'EVENING'].filter(Boolean) as TripLeg[];

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const next = await setNotTravelling(studentId, { date, legs, reason: reason.trim() || undefined });
      toast.success(t('savedOff'));
      onSaved(next);
    } catch (err) {
      toast.error(errorMessage(err, t('failed')));
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={save}>
          <DialogHeader>
            <DialogTitle>{t('planTitle')}</DialogTitle>
          </DialogHeader>
          <div className="mt-3 space-y-4 px-0.5">
            <Field label={t('date')} required>
              <Input type="date" value={date} min={today} max={max} onChange={(e) => setDate(e.target.value)} required />
            </Field>
            <div className="flex flex-wrap gap-4">
              <Checkbox checked={morning} onChange={(e) => setMorning(e.target.checked)} label={t('legName.MORNING')} />
              <Checkbox checked={evening} onChange={(e) => setEvening(e.target.checked)} label={t('legName.EVENING')} />
            </div>
            <Field label={t('reason')}>
              <Input value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} />
            </Field>
          </div>
          <DialogFooter className="mt-5">
            <Button type="button" variant="ghost" onClick={onClose}>
              {tc('action.cancel')}
            </Button>
            <Button type="submit" disabled={saving || legs.length === 0}>
              {t('save')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
