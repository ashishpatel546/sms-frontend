'use client';

import * as React from 'react';
import toast from 'react-hot-toast';
import { useLocale, useTranslations } from 'next-intl';
import { Car, Download, Loader2, MapPin, Sun, Users } from 'lucide-react';

import { INTL_LOCALE } from '@/i18n/config';
import { useSchoolInfo } from '@/lib/useSchoolInfo';
import {
  EVENT_PASS_TIER_COLORS,
  passSerial,
  passShortDate,
  passStudentsLine,
  type ParentEventPass,
} from '@/lib/event-passes-api';
import { downloadEventPassesPdf, renderEventPassQr } from '@/lib/event-pass-pdf';

/* ═══════════════════════════════════════════════════════════════════════════
   MY EVENT PASSES (parent portal)

   The same pass the office would print, on the phone instead: show this QR at
   the gate. Only passes issued to the parent's own mobile, for published
   events that have not ended.
   ═══════════════════════════════════════════════════════════════════════════ */

export function ParentEventPasses({ passes }: { passes: ParentEventPass[] }) {
  const t = useTranslations('eventPasses.parent');
  if (!passes.length) {
    return <p className="text-ink-muted rounded-xl border border-dashed border-slate-300 p-6 text-center text-sm dark:border-white/15">{t('empty')}</p>;
  }
  return (
    <div className="space-y-4">
      {passes.map((p) => (
        <PassCard key={p.id} pass={p} />
      ))}
      <p className="text-ink-muted flex items-center justify-center gap-1.5 text-center text-xs">
        <Sun className="size-3.5" aria-hidden /> {t('brightness')}
      </p>
    </div>
  );
}

function PassCard({ pass }: { pass: ParentEventPass }) {
  const t = useTranslations('eventPasses');
  const intlLocale = INTL_LOCALE[useLocale() as keyof typeof INTL_LOCALE];
  const school = useSchoolInfo();
  const [qr, setQr] = React.useState<string | null>(null);
  const [downloading, setDownloading] = React.useState(false);
  const tone = EVENT_PASS_TIER_COLORS[pass.tier];
  const { event } = pass;

  React.useEffect(() => {
    let cancelled = false;
    renderEventPassQr(pass.token, 560).then((url) => {
      if (!cancelled) setQr(url);
    });
    return () => {
      cancelled = true;
    };
  }, [pass.token]);

  const dates = pass.allDays
    ? event.endDate && event.endDate !== event.startDate
      ? t('parent.allDaysRange', { from: passShortDate(event.startDate, intlLocale), to: passShortDate(event.endDate, intlLocale) })
      : passShortDate(event.startDate, intlLocale)
    : pass.validDates.map((d) => passShortDate(d, intlLocale)).join(', ');
  const students = passStudentsLine(pass.students);

  const download = async () => {
    setDownloading(true);
    try {
      await downloadEventPassesPdf(
        [pass],
        event,
        school?.name ?? '',
      );
    } catch {
      toast.error(t('parent.downloadFailed'));
    } finally {
      setDownloading(false);
    }
  };

  return (
    <article className="bg-surface overflow-hidden rounded-2xl border border-slate-200 shadow-sm dark:border-white/10">
      <div className="flex items-center justify-between px-4 py-2" style={{ backgroundColor: tone.band, color: tone.ink }}>
        <span className="text-xs font-bold tracking-widest uppercase">{t(`tier.${pass.tier}`)}</span>
        <span className="font-mono text-xs font-semibold">{passSerial(pass.serial)}</span>
      </div>
      <div className="p-4">
        <h3 className="text-ink text-base leading-snug font-bold">{event.title}</h3>
        <p className="text-ink-muted mt-0.5 text-[13px]">{dates}</p>
        {event.venue && (
          <p className="text-ink-muted mt-0.5 flex items-center gap-1 text-[13px]">
            <MapPin className="size-3.5" aria-hidden /> {event.venue}
          </p>
        )}

        <div className="mx-auto mt-4 aspect-square w-full max-w-[260px] rounded-xl bg-white p-3">
          {qr ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={qr} alt={t('parent.qrAlt')} className="h-full w-full" />
          ) : (
            <div className="grid h-full w-full place-items-center">
              <Loader2 className="size-6 animate-spin text-slate-400" aria-hidden />
            </div>
          )}
        </div>

        <dl className="mt-4 grid grid-cols-2 gap-x-3 gap-y-2.5 text-[13px]">
          {pass.holderName && (
            <div className="col-span-2 min-w-0">
              <dt className="text-ink-muted text-[10.5px] font-semibold tracking-widest uppercase">{t('parent.holder')}</dt>
              <dd className="text-ink truncate font-medium">{pass.holderName}</dd>
            </div>
          )}
          {students && (
            <div className="col-span-2 min-w-0">
              <dt className="text-ink-muted text-[10.5px] font-semibold tracking-widest uppercase">{t('scan.field.parentOf')}</dt>
              <dd className="text-ink font-medium">{students}</dd>
            </div>
          )}
          <div>
            <dt className="text-ink-muted text-[10.5px] font-semibold tracking-widest uppercase">{t('scan.admits')}</dt>
            <dd className="text-ink flex items-center gap-1 font-medium">
              <Users className="size-3.5" aria-hidden /> {pass.membersAllowed}
            </dd>
          </div>
          {pass.vehicleNumber && (
            <div className="min-w-0">
              <dt className="text-ink-muted text-[10.5px] font-semibold tracking-widest uppercase">{t('scan.field.vehicle')}</dt>
              <dd className="text-ink flex items-center gap-1 truncate font-medium">
                <Car className="size-3.5 shrink-0" aria-hidden /> {pass.vehicleNumber}
              </dd>
            </div>
          )}
          {pass.memberNames.length > 0 && (
            <div className="col-span-2">
              <dt className="text-ink-muted text-[10.5px] font-semibold tracking-widest uppercase">{t('parent.people')}</dt>
              <dd className="text-ink font-medium">{pass.memberNames.join(', ')}</dd>
            </div>
          )}
        </dl>

        <button
          type="button"
          onClick={download}
          disabled={downloading}
          className="text-ink hover:bg-brand/5 mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 py-2.5 text-sm font-medium transition-colors disabled:opacity-60 dark:border-white/10"
        >
          {downloading ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
          {t('parent.download')}
        </button>
      </div>
    </article>
  );
}
