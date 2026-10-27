'use client';

import * as React from 'react';
import toast from 'react-hot-toast';
import useSWR from 'swr';
import { useLocale, useTranslations } from 'next-intl';
import { Car, History, Loader2, MapPin, Pencil, Printer, Users } from 'lucide-react';

import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { StatusChip } from '@/components/ui/StatusChip';
import { Skeleton } from '@/components/ui/skeleton';
import { INTL_LOCALE } from '@/i18n/config';
import { useSchoolInfo } from '@/lib/useSchoolInfo';
import {
  EVENT_PASS_TIER_COLORS,
  errorMessage,
  fetchEventPass,
  fetchEventPassPrintData,
  passSerial,
  passShortDate,
  passStudentsLine,
  type EventPass,
  type EventPassEvent,
} from '@/lib/event-passes-api';
import { downloadEventPassesPdf, renderEventPassQr } from '@/lib/event-pass-pdf';

/* ═══════════════════════════════════════════════════════════════════════════
   ONE PASS, AS ISSUED

   The pass the way the parent and the guard see it — tier band, QR, who and
   how many — with the office facts underneath (issued by, printed, inside
   now) and the actions a desk needs for one pass: print it, edit it, look at
   its gate history.
   ═══════════════════════════════════════════════════════════════════════════ */

export function EventPassViewDialog({
  activityId,
  event,
  pass,
  canManage,
  onClose,
  onEdit,
  onHistory,
  onChanged,
}: {
  activityId: string;
  event: EventPassEvent | null;
  pass: EventPass | null;
  canManage: boolean;
  onClose: () => void;
  onEdit: (pass: EventPass) => void;
  onHistory: (pass: EventPass) => void;
  onChanged: () => void;
}) {
  const t = useTranslations('eventPasses');
  const intlLocale = INTL_LOCALE[useLocale() as keyof typeof INTL_LOCALE];
  const school = useSchoolInfo();
  // The list row has no QR token; the single read does.
  const { data: full, mutate } = useSWR(pass ? ['event-pass', activityId, pass.id] : null, () => fetchEventPass(activityId, pass!.id));
  const shown = full ?? pass;
  const [qr, setQr] = React.useState<{ token: string; url: string } | null>(null);
  const [printing, setPrinting] = React.useState(false);

  React.useEffect(() => {
    if (!full?.token) return;
    let cancelled = false;
    const token = full.token;
    renderEventPassQr(token, 480).then((url) => {
      if (!cancelled) setQr({ token, url });
    });
    return () => {
      cancelled = true;
    };
  }, [full?.token]);

  const when = (iso: string | null) =>
    iso
      ? new Intl.DateTimeFormat(intlLocale, { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Kolkata' }).format(
          new Date(iso),
        )
      : '';

  const print = async () => {
    if (!shown || !school) return;
    setPrinting(true);
    try {
      const data = await fetchEventPassPrintData(activityId, [shown.id], true);
      if (!data.passes.length) {
        toast.error(t('print.nothing'));
        return;
      }
      await downloadEventPassesPdf(data.passes, data.event, school.name);
      void mutate();
      onChanged();
    } catch (err) {
      toast.error(errorMessage(err, t('print.failed')));
    } finally {
      setPrinting(false);
    }
  };

  return (
    <Dialog open={!!pass} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-lg">
        {shown && (
          <>
            <DialogTitle className="text-[16px] font-semibold">{t('view.title', { serial: passSerial(shown.serial) })}</DialogTitle>
            <DialogDescription className="text-ink-muted -mt-2 text-[12.5px]">{event?.title}</DialogDescription>

            <PassFace pass={shown} event={event} schoolName={school?.name ?? ''} qrUrl={qr && qr.token === full?.token ? qr.url : null} intlLocale={intlLocale} />

            <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-[13px]">
              <Fact label={t('list.status')}>
                <span className="flex flex-wrap gap-1.5">
                  {shown.status === 'CANCELLED' ? (
                    <StatusChip status="CANCELLED" pigment="danger" label={t('status.CANCELLED')} />
                  ) : (
                    <StatusChip status="ACTIVE" pigment="success" label={t('status.ACTIVE')} />
                  )}
                  {shown.inside && <StatusChip status="INSIDE" pigment="info" label={t('list.inside', { people: shown.checkedInPeople ?? 0 })} />}
                  {shown.status === 'ACTIVE' && shown.validity && (
                    <StatusChip
                      status={shown.validity}
                      pigment={shown.validity === 'VALID_TODAY' ? 'success' : shown.validity === 'UPCOMING' ? 'info' : 'neutral'}
                      label={t(`validity.${shown.validity}`, { date: shown.validFrom ? passShortDate(shown.validFrom, intlLocale) : '' })}
                    />
                  )}
                </span>
              </Fact>
              <Fact label={t('form.mobile')}>{shown.mobile ?? '—'}</Fact>
              <Fact label={t('view.issued')}>
                {shown.issuedByName ? t('view.byOn', { name: shown.issuedByName, when: when(shown.createdAt) }) : when(shown.createdAt)}
              </Fact>
              <Fact label={t('view.printed')}>{shown.printedAt ? when(shown.printedAt) : t('list.notPrinted')}</Fact>
              {shown.inside && (
                <Fact label={t('view.insideSince')} wide>
                  {t('view.byOn', { name: shown.checkedInByName ?? '—', when: when(shown.checkedInAt) })}
                </Fact>
              )}
              {shown.remarks && (
                <Fact label={t('form.remarks')} wide>
                  {shown.remarks}
                </Fact>
              )}
              {shown.status === 'CANCELLED' && (
                <Fact label={t('view.cancelled')} wide>
                  {t('list.cancelledBy', { name: shown.cancelledByName ?? '—', reason: shown.cancelReason ?? '' })}
                </Fact>
              )}
            </dl>

            <div className="flex flex-wrap justify-end gap-2">
              <Button variant="ghost" onClick={() => onHistory(shown)}>
                <History /> {t('history.open')}
              </Button>
              {canManage && shown.status === 'ACTIVE' && event?.status !== 'ARCHIVED' && (
                <Button variant="outline" onClick={() => onEdit(shown)}>
                  <Pencil /> {t('view.edit')}
                </Button>
              )}
              {canManage && shown.status === 'ACTIVE' && (
                <Button onClick={print} disabled={printing || !school}>
                  {printing ? <Loader2 className="animate-spin" /> : <Printer />}
                  {t('view.print')}
                </Button>
              )}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Fact({ label, children, wide }: { label: string; children: React.ReactNode; wide?: boolean }) {
  return (
    <div className={wide ? 'col-span-2 min-w-0' : 'min-w-0'}>
      <dt className="text-ink-muted text-[10.5px] font-semibold tracking-widest uppercase">{label}</dt>
      <dd className="text-ink mt-0.5">{children}</dd>
    </div>
  );
}

/** The pass face on screen — same parts, same order as the printed card. */
function PassFace({
  pass,
  event,
  schoolName,
  qrUrl,
  intlLocale,
}: {
  pass: EventPass;
  event: EventPassEvent | null;
  schoolName: string;
  qrUrl: string | null;
  intlLocale: string;
}) {
  const t = useTranslations('eventPasses');
  const tone = EVENT_PASS_TIER_COLORS[pass.tier];
  const students = passStudentsLine(pass.students);
  const dates = !event
    ? ''
    : pass.allDays
      ? event.endDate && event.endDate !== event.startDate
        ? t('parent.allDaysRange', { from: passShortDate(event.startDate, intlLocale), to: passShortDate(event.endDate, intlLocale) })
        : passShortDate(event.startDate, intlLocale)
      : pass.validDates.map((d) => passShortDate(d, intlLocale)).join(', ');

  return (
    <article className={`overflow-hidden rounded-xl border border-slate-200 bg-white text-slate-900 shadow-sm dark:border-white/10 ${pass.status === 'CANCELLED' ? 'opacity-60' : ''}`}>
      <div className="flex items-center justify-between gap-2 px-4 py-2" style={{ backgroundColor: tone.band, color: tone.ink }}>
        <span className="truncate text-xs font-semibold">{schoolName}</span>
        <span className="font-mono text-xs font-bold tracking-widest uppercase">{t(`tier.${pass.tier}`)}</span>
      </div>
      <div className="flex gap-4 p-4">
        <div className="min-w-0 flex-1">
          <p className="text-[15px] leading-snug font-bold">{event?.title}</p>
          <p className="mt-0.5 text-[12px] text-slate-600">{dates}</p>
          {event?.venue && (
            <p className="flex items-center gap-1 text-[12px] text-slate-600">
              <MapPin className="size-3" aria-hidden /> {event.venue}
            </p>
          )}
          <div className="my-2.5 h-px bg-slate-200" />
          <p className="truncate text-[14px] font-semibold">
            {pass.holderName || (students ? t('list.parentOf', { names: students }) : t('list.guest'))}
          </p>
          {students && pass.holderName && <p className="text-[12px] text-slate-600">{t('list.parentOf', { names: students })}</p>}
          {pass.memberNames.length > 0 && <p className="mt-1 text-[12px] text-slate-600">{pass.memberNames.join(', ')}</p>}
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="flex items-end gap-1">
              <Users className="mb-0.5 size-4 text-slate-500" aria-hidden />
              <span className="text-2xl leading-none font-bold">{pass.membersAllowed}</span>
              <span className="mb-0.5 text-[11px] text-slate-500 uppercase">{t('scan.admits')}</span>
            </span>
            {pass.vehicleNumber && (
              <span className="flex items-center gap-1 font-mono text-[12px] font-semibold">
                <Car className="size-3.5" aria-hidden />
                {pass.vehicleNumber}
              </span>
            )}
          </div>
        </div>
        <div className="flex w-28 shrink-0 flex-col items-center sm:w-32">
          {qrUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={qrUrl} alt={t('parent.qrAlt')} className="aspect-square w-full" />
          ) : (
            <Skeleton className="aspect-square w-full" />
          )}
          <span className="mt-1.5 font-mono text-[12px] font-semibold tracking-wider">{passSerial(pass.serial)}</span>
        </div>
      </div>
    </article>
  );
}
