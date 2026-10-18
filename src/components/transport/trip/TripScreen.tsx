'use client';

import * as React from 'react';
import useSWR from 'swr';
import { useLocale, useTranslations } from 'next-intl';
import toast, { Toaster } from 'react-hot-toast';
import { Bus, CheckCheck, Flag, MapPin, Phone, School, Undo2 } from 'lucide-react';

import {
  completeTrip,
  errorMessage,
  fetchTrip,
  hhmm,
  istClock,
  recordTripEvent,
  TransportApiError,
  undoTripEvent,
  vehicleName,
  type TripDetail,
  type TripEventType,
  type TripStudent,
} from '@/lib/transport-api';
import { INTL_LOCALE } from '@/i18n/config';
import { useRbac } from '@/lib/rbac';
import { PageBody, PageHeader, PageShell } from '@/components/ui/PageHeader';
import { Panel, PanelBody, PanelHeader } from '@/components/ui/Panel';
import { Button } from '@/components/ui/button';
import { Field, Textarea } from '@/components/ui/Field';
import { StatusChip } from '@/components/ui/StatusChip';
import type { Pigment } from '@/components/ui/pigment';
import { EmptyState } from '@/components/ui/EmptyState';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useFormatDate } from '@/components/transport/format';
import { HandoverDialog } from './HandoverDialog';
import { useWakeLock } from './useWakeLock';
import { useFeatureFlag } from '@/lib/useSchoolFeatures';
import { useLocationSharing, type SharingStatus } from '@/components/transport/live/useLocationSharing';
import { TripTrackPanel } from '@/components/transport/live/TripTrackPanel';
import { TrackerAppCard } from '@/components/transport/live/TrackerAppCard';
import { CrewAppTracking } from '@/components/transport/live/CrewAppTracking';
import { useInCrewApp } from '@/components/transport/live/crewApp';

const STATE_PIGMENT: Record<TripEventType, Pigment> = {
  BOARDED: 'info',
  ARRIVED_SCHOOL: 'success',
  DROPPED: 'success',
  HANDED_TO_GUARDIAN: 'success',
  HANDED_VIA_PICKUP: 'success',
  NO_SHOW: 'attn',
  NOT_TRAVELLING: 'attn',
};

/**
 * The crew's trip screen, in stop order, built for one hand in a moving bus:
 * big taps, the next action on each child's row, bulk "reached school" and
 * "board everyone", and an undo for the last mark. Managers get the same
 * screen (and may close a trip that is stuck). Read-only once finished.
 *
 * Polls every 15 s while running so driver and assistant see each other's
 * marks, and keeps the screen awake.
 */
export function TripScreen({ tripId, backHref }: { tripId: number; backHref: string }) {
  const t = useTranslations('transport.trip');
  const tt = useTranslations('transport');
  const formatDate = useFormatDate();
  const { data, error, mutate } = useSWR(['trip', tripId], () => fetchTrip(tripId), {
    refreshInterval: (d) => (d?.status === 'IN_PROGRESS' ? 15_000 : 0),
  });
  const [busy, setBusy] = React.useState(false);
  const [handover, setHandover] = React.useState<TripStudent | null>(null);
  const [finishing, setFinishing] = React.useState(false);
  useWakeLock(!!data?.canOperate);
  const rbac = useRbac();
  const liveOn = useFeatureFlag('transport_live_tracking').enabled === true;
  // Only a phone on the bus shares its position; a manager running the trip
  // from the office must not move the bus to the office. Inside the crew
  // app, the app shares in the background instead of this screen.
  const inApp = useInCrewApp();
  const sharing = useLocationSharing(tripId, liveOn && !!data?.canOperate && rbac.isTransportCrew && !inApp);

  if (error) {
    return (
      <PageShell>
        <EmptyState icon={<Bus />} title={t('loadFailed')} description={errorMessage(error, '')} />
      </PageShell>
    );
  }
  if (!data) {
    return (
      <PageShell>
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="skeleton h-20 w-full rounded-xl" />
          ))}
        </div>
      </PageShell>
    );
  }

  const trip = data;
  const morning = trip.leg === 'MORNING';

  const act = async (fn: () => Promise<TripDetail>, success?: string) => {
    setBusy(true);
    try {
      const next = await fn();
      await mutate(next, { revalidate: false });
      if (success) toast.success(success);
    } catch (e) {
      toast.error(errorMessage(e, t('actionFailed')));
      void mutate();
    } finally {
      setBusy(false);
    }
  };
  const mark = (type: Exclude<TripEventType, 'HANDED_VIA_PICKUP'>, ids: number[], success?: string) =>
    act(() => recordTripEvent(trip.id, { type, studentIds: ids }), success);

  // Morning: everyone sits under their stop. Evening: children not yet on
  // the bus wait "at school"; once boarded they move to their drop stop.
  const atSchool = morning ? [] : trip.students.filter((s) => s.state === null || s.state === 'NOT_TRAVELLING');
  const byStop = morning ? trip.students : trip.students.filter((s) => !atSchool.includes(s));
  const stops = morning ? trip.stops : [...trip.stops].reverse();
  const onBoard = trip.students.filter((s) => s.state === 'BOARDED');
  const toBoard = atSchool.filter((s) => s.state === null && !s.skip);

  return (
    <PageShell>
      <Toaster position="top-center" />
      <PageHeader
        section={tt('section')}
        backHref={backHref}
        backLabel={t('back')}
        title={`${trip.route.routeNumber} · ${t(`leg.${trip.leg}`)}`}
        description={[trip.vehicle ? vehicleName(trip.vehicle) : null, trip.route.name, formatDate(trip.date)].filter(Boolean).join(' · ')}
        actions={
          trip.status === 'IN_PROGRESS' ? (
            <StatusChip pigment="info" size="md" label={t('running')} />
          ) : (
            <StatusChip pigment={trip.forceClosed ? 'attn' : 'success'} size="md" label={t('finishedAt', { time: trip.endedAt ? istClock(trip.endedAt) : '' })} />
          )
        }
      />
      <PageBody>
        <Counts trip={trip} />
        <CrewStrip trip={trip} />
        {/* In the crew app the card stays after the trip ends: it stops the
            app's sharing for this bus. */}
        {liveOn &&
          rbac.isTransportCrew &&
          (inApp ? (
            <CrewAppTracking tripId={trip.id} running={trip.status === 'IN_PROGRESS' && trip.canOperate} />
          ) : (
            trip.canOperate && (
              <>
                {sharing.status !== 'app' && <SharingStrip status={sharing.status} lastSentAt={sharing.lastSentAt} accuracy={sharing.accuracy} />}
                <TrackerAppCard tripId={trip.id} running={trip.status === 'IN_PROGRESS'} />
              </>
            )
          ))}

        {trip.forceClosed && (
          <p className="rounded-lg border border-accent-warn-edge bg-accent-warn-tint px-3 py-2 text-[13px] text-accent-warn-deep">
            {t('forceClosedNote', { note: trip.closeNote ?? '' })}
          </p>
        )}

        {!morning && atSchool.length > 0 && (
          <Group
            icon={<School className="size-4" />}
            title={t('atSchool')}
            subtitle={t('atSchoolHint')}
            action={
              trip.canOperate && toBoard.length > 1 ? (
                <Button size="sm" disabled={busy} onClick={() => mark('BOARDED', toBoard.map((s) => s.studentId), t('boardedMany', { count: toBoard.length }))}>
                  <CheckCheck /> {t('boardAll', { count: toBoard.length })}
                </Button>
              ) : null
            }
          >
            {atSchool.map((s) => (
              <StudentRow key={s.studentId} trip={trip} s={s} busy={busy} onMark={mark} onUndo={(id) => act(() => undoTripEvent(trip.id, id))} onHandover={setHandover} />
            ))}
          </Group>
        )}

        {stops.map((stop) => {
          const here = byStop.filter((s) => s.stopId === stop.id);
          if (here.length === 0) return null;
          const time = hhmm(stop.time);
          return (
            <Group
              key={stop.id}
              icon={<MapPin className="size-4" />}
              title={stop.name}
              subtitle={[time, stop.landmark].filter(Boolean).join(' · ')}
            >
              {here.map((s) => (
                <StudentRow key={s.studentId} trip={trip} s={s} busy={busy} onMark={mark} onUndo={(id) => act(() => undoTripEvent(trip.id, id))} onHandover={setHandover} />
              ))}
            </Group>
          );
        })}

        {(() => {
          const loose = byStop.filter((s) => !stops.some((st) => st.id === s.stopId));
          return loose.length ? (
            <Group icon={<MapPin className="size-4" />} title={t('otherStops')}>
              {loose.map((s) => (
                <StudentRow key={s.studentId} trip={trip} s={s} busy={busy} onMark={mark} onUndo={(id) => act(() => undoTripEvent(trip.id, id))} onHandover={setHandover} />
              ))}
            </Group>
          ) : null;
        })()}

        {trip.students.length === 0 && <EmptyState icon={<Bus />} title={t('noRiders')} description={t('noRidersHint')} />}

        {trip.canOperate && (
          <div className="sticky bottom-[calc(env(safe-area-inset-bottom)+4.5rem)] z-10 flex flex-wrap gap-2 rounded-xl border border-line bg-surface/95 p-3 shadow-soft backdrop-blur md:bottom-4">
            {morning && onBoard.length > 0 && (
              <Button
                className="h-12 flex-1"
                disabled={busy}
                onClick={() => mark('ARRIVED_SCHOOL', onBoard.map((s) => s.studentId), t('arrivedMany', { count: onBoard.length }))}
              >
                <School /> {t('reachedSchool', { count: onBoard.length })}
              </Button>
            )}
            <Button variant="outline" className="h-12 flex-1" disabled={busy} onClick={() => setFinishing(true)}>
              <Flag /> {t('finish')}
            </Button>
          </div>
        )}

        {liveOn && rbac.canManageTransport && <TripTrackPanel trip={trip} />}
        <Timeline trip={trip} />
      </PageBody>

      {handover && (
        <HandoverDialog
          trip={trip}
          student={handover}
          onClose={() => setHandover(null)}
          onDone={(next) => {
            setHandover(null);
            void mutate(next, { revalidate: false });
          }}
        />
      )}
      {finishing && (
        <FinishDialog
          trip={trip}
          onClose={() => setFinishing(false)}
          onDone={(next) => {
            setFinishing(false);
            void mutate(next, { revalidate: false });
          }}
        />
      )}
    </PageShell>
  );
}

function SharingStrip({ status, lastSentAt, accuracy }: { status: SharingStatus; lastSentAt: number | null; accuracy: number | null }) {
  const t = useTranslations('transport.live.sharing');
  const [now, setNow] = React.useState(() => Date.now());
  React.useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 5_000);
    return () => window.clearInterval(id);
  }, []);
  const ok = status === 'sharing';
  const bad = status === 'denied' || status === 'unsupported' || status === 'unavailable';
  const ago = lastSentAt ? Math.max(0, Math.round((now - lastSentAt) / 1000)) : null;
  return (
    <div
      role="status"
      className={`flex min-h-11 items-center gap-2 rounded-lg border px-3 py-2 text-[13px] ${
        ok ? 'border-accent-success-edge bg-accent-success-tint text-accent-success-deep' : bad ? 'border-accent-danger-edge bg-accent-danger-tint text-accent-danger-deep' : 'border-line bg-surface text-ink-muted'
      }`}
    >
      <MapPin className="size-4 shrink-0" />
      <span className="min-w-0 flex-1">
        {t(status)}
        {ok && ago !== null && <span className="tabular"> · {t('sentAgo', { seconds: ago })}</span>}
        {ok && accuracy !== null && <span className="tabular"> · ±{accuracy} m</span>}
      </span>
    </div>
  );
}

function Counts({ trip }: { trip: TripDetail }) {
  const t = useTranslations('transport.trip.count');
  const c = trip.counts;
  const items: [string, number, Pigment][] = [
    [t('onBoard'), c.onBoard, 'info'],
    [t('waiting'), c.pending, 'neutral'],
    [t(trip.leg === 'MORNING' ? 'atSchool' : 'home'), c.done, 'success'],
    [t('notTravelling'), c.noShow + c.notExpected, 'attn'],
  ];
  return (
    <div className="grid grid-cols-4 gap-2">
      {items.map(([label, n, p]) => (
        <div key={label} className="rounded-lg border border-line bg-surface px-2 py-2 text-center">
          <p className={`tabular font-display text-[20px] font-semibold ${p === 'info' && n > 0 ? 'text-accent-info-deep' : 'text-ink'}`}>{n}</p>
          <p className="truncate text-[11.5px] text-ink-muted">{label}</p>
        </div>
      ))}
    </div>
  );
}

function CrewStrip({ trip }: { trip: TripDetail }) {
  const t = useTranslations('transport.trip');
  const people = [
    trip.driver && { ...trip.driver, role: t('driver') },
    trip.assistant && { ...trip.assistant, role: t('assistant') },
  ].filter(Boolean) as { name: string; mobile: string | null; role: string; staffId: number }[];
  if (people.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-2">
      {people.map((p) =>
        p.mobile ? (
          <a
            key={p.staffId}
            href={`tel:${p.mobile}`}
            className="inline-flex min-h-11 items-center gap-2 rounded-full border border-line bg-surface px-3 text-[13px] text-ink hover:border-brand"
          >
            <Phone className="size-4 text-accent-info-deep" /> {p.name}
            <span className="text-ink-muted">· {p.role}</span>
          </a>
        ) : (
          <span key={p.staffId} className="inline-flex min-h-11 items-center gap-2 rounded-full border border-line px-3 text-[13px] text-ink-muted">
            {p.name} · {p.role}
          </span>
        ),
      )}
    </div>
  );
}

function Group({
  icon,
  title,
  subtitle,
  action,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-line bg-surface">
      <header className="flex flex-wrap items-center gap-2 border-b border-line px-3 py-2.5">
        <span className="text-brand">{icon}</span>
        <div className="min-w-0 flex-1">
          <p className="truncate font-display text-[15px] font-semibold text-ink">{title}</p>
          {subtitle && <p className="tabular truncate text-[12px] text-ink-muted">{subtitle}</p>}
        </div>
        {action}
      </header>
      <ul className="divide-y divide-line">{children}</ul>
    </section>
  );
}

function StudentRow({
  trip,
  s,
  busy,
  onMark,
  onUndo,
  onHandover,
}: {
  trip: TripDetail;
  s: TripStudent;
  busy: boolean;
  onMark: (type: Exclude<TripEventType, 'HANDED_VIA_PICKUP'>, ids: number[], success?: string) => Promise<void>;
  onUndo: (eventId: number) => Promise<void>;
  onHandover: (s: TripStudent) => void;
}) {
  const t = useTranslations('transport.trip');
  const intl = INTL_LOCALE[useLocale()];
  const morning = trip.leg === 'MORNING';
  const live = trip.canOperate;
  const klass = [s.className, s.sectionName].filter(Boolean).join(' ');

  const actions: React.ReactNode[] = [];
  if (live) {
    if (s.state === null || (morning && s.state === 'NO_SHOW') || (!morning && s.state === 'NOT_TRAVELLING')) {
      actions.push(
        <Button key="board" className="h-11 min-w-24" variant={s.state || s.skip ? 'outline' : 'primary'} disabled={busy} onClick={() => onMark('BOARDED', [s.studentId])}>
          {t('action.boarded')}
        </Button>,
      );
    }
    if (s.state === null) {
      actions.push(
        <Button key="skip" className="h-11" variant="outline" disabled={busy} onClick={() => onMark(morning ? 'NO_SHOW' : 'NOT_TRAVELLING', [s.studentId])}>
          {t(morning ? 'action.noShow' : 'action.notTravelling')}
        </Button>,
      );
    }
    if (!morning && s.state === 'BOARDED') {
      actions.push(
        <Button key="drop" className="h-11 min-w-24" disabled={busy} onClick={() => onMark('DROPPED', [s.studentId])}>
          {t('action.dropped')}
        </Button>,
        <Button key="hand" className="h-11" variant="outline" disabled={busy} onClick={() => onHandover(s)}>
          {t('action.handover')}
        </Button>,
      );
    }
  }

  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-2 px-3 py-2.5">
      <div className="min-w-0 flex-1 basis-40">
        <p className="truncate text-[15px] font-medium text-ink">{s.name}</p>
        <p className="flex flex-wrap items-center gap-1.5 text-[12px] text-ink-muted">
          {klass && <span>{klass}</span>}
          {s.state ? (
            <StatusChip
              pigment={STATE_PIGMENT[s.state]}
              label={
                s.handedToName
                  ? t('stateHanded', { name: s.handedToName })
                  : t(`state.${s.state}`)
              }
            />
          ) : (
            s.skip && <StatusChip pigment="attn" label={t(`skip.${s.skip}`)} title={s.skipNote ?? undefined} />
          )}
          {s.stateAt && <span className="tabular">{istClock(s.stateAt, intl)}</span>}
        </p>
        {s.skip && !s.state && s.skipNote && <p className="mt-0.5 truncate text-[12px] text-ink-muted">“{s.skipNote}”</p>}
      </div>
      {(actions.length > 0 || (live && s.lastEventId && s.state !== 'HANDED_VIA_PICKUP')) && (
        <div className="flex flex-wrap items-center gap-2">
          {actions}
          {live && s.lastEventId && s.state !== 'HANDED_VIA_PICKUP' && (
            <Button variant="ghost" size="icon-lg" disabled={busy} onClick={() => onUndo(s.lastEventId!)} aria-label={t('action.undo')} title={t('action.undo')}>
              <Undo2 />
            </Button>
          )}
        </div>
      )}
    </li>
  );
}

function FinishDialog({ trip, onClose, onDone }: { trip: TripDetail; onClose: () => void; onDone: (t: TripDetail) => void }) {
  const t = useTranslations('transport.trip.finishDialog');
  const tc = useTranslations('common');
  const rbac = useRbac();
  const [blocked, setBlocked] = React.useState<{ name: string }[] | null>(null);
  const [note, setNote] = React.useState('');
  const [saving, setSaving] = React.useState(false);
  const pending = trip.counts.pending;

  const finish = async (force = false) => {
    setSaving(true);
    try {
      const next = await completeTrip(trip.id, force ? { force: true, note: note.trim() } : {});
      toast.success(t('done'));
      onDone(next);
    } catch (e) {
      if (e instanceof TransportApiError && e.code === 'TRIP_CHILDREN_ON_BOARD') {
        setBlocked(trip.students.filter((s) => s.state === 'BOARDED').map((s) => ({ name: s.name })));
      } else {
        toast.error(errorMessage(e, t('failed')));
      }
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{blocked ? t('blockedTitle') : t('title')}</DialogTitle>
        </DialogHeader>
        {blocked ? (
          <div className="mt-2 space-y-3 px-0.5">
            <p className="text-[13.5px] text-ink">{t('blockedBody')}</p>
            <ul className="list-disc space-y-0.5 pl-5 text-[14px] font-medium text-accent-danger-deep">
              {blocked.map((s) => (
                <li key={s.name}>{s.name}</li>
              ))}
            </ul>
            <p className="text-[12.5px] text-ink-muted">{t('blockedHint')}</p>
            {rbac.canManageTransport && (
              <Field label={t('forceNote')} required>
                <Textarea value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} rows={2} />
              </Field>
            )}
          </div>
        ) : (
          <p className="mt-2 text-[13.5px] text-ink">{pending > 0 ? t('pendingWarning', { count: pending }) : t('body')}</p>
        )}
        <DialogFooter className="mt-5">
          <Button variant="ghost" onClick={onClose}>
            {blocked ? t('goBack') : tc('action.cancel')}
          </Button>
          {!blocked && (
            <Button onClick={() => finish(false)} disabled={saving}>
              {t('confirm')}
            </Button>
          )}
          {blocked && rbac.canManageTransport && (
            <Button variant="destructive" disabled={saving || !note.trim()} onClick={() => finish(true)}>
              {t('forceClose')}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Timeline({ trip }: { trip: TripDetail }) {
  const t = useTranslations('transport.trip');
  const intl = INTL_LOCALE[useLocale()];
  const [all, setAll] = React.useState(false);
  if (trip.events.length === 0) return null;
  const shown = all ? trip.events : trip.events.slice(0, 12);
  return (
    <Panel>
      <PanelHeader title={t('activity')} description={t('activityHint', { start: istClock(trip.startedAt, intl), by: trip.startedBy ?? '—' })} />
      <PanelBody>
        <ol className="space-y-2">
          {shown.map((e) => (
            <li key={e.id} className={`flex gap-3 text-[13px] ${e.voided ? 'text-ink-faint line-through' : 'text-ink'}`}>
              <span className="tabular w-16 shrink-0 text-ink-muted">{istClock(e.at, intl)}</span>
              <span className="min-w-0 flex-1">
                <span className="font-medium">{e.studentName}</span> · {e.handedToName ? t('stateHanded', { name: e.handedToName }) : t(`event.${e.type}`)}
                {e.stopName && <span className="text-ink-muted"> · {e.stopName}</span>}
                {e.by && <span className="text-ink-muted"> · {e.by}</span>}
                {e.voided && <span className="no-underline"> ({t('undone')})</span>}
              </span>
            </li>
          ))}
        </ol>
        {trip.events.length > shown.length && (
          <Button variant="link" className="mt-2 px-0" onClick={() => setAll(true)}>
            {t('showAll', { count: trip.events.length })}
          </Button>
        )}
      </PanelBody>
    </Panel>
  );
}
