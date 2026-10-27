'use client';

import React, { useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Ban, BadgeCheck, CalendarX, Car, DoorOpen, Loader2, LogIn, LogOut, Minus, Plus, ScanLine, ShieldX, Ticket, Users, XCircle } from 'lucide-react';
import { INTL_LOCALE } from '@/i18n/config';
import {
  EVENT_PASS_TIER_COLORS,
  checkInEventPass,
  checkOutEventPass,
  denyEventPass,
  errorMessage,
  passSerial,
  passShortDate,
  passStudentsLine,
  verifyEventPass,
  type EventPassVerifyResult,
} from '@/lib/event-passes-api';

/* ═══════════════════════════════════════════════════════════════════════════
   EVENT PASS AT THE GATE

   Rendered by the shared scanner when an `EVP1:`-prefixed QR is decoded.

   Scanning only LOOKS. Every scan then asks the guard one question — allow
   entry or not — and either answer is recorded with the guard's name, which
   is the audit the office reads later. Allowing takes a head count and is
   refused while the pass is already inside (check out first).

   A pass the system already knows is no good — expired, not valid yet, a day
   it does not cover, cancelled, replaced, event closed — is refused
   automatically: the refusal is recorded with the reason as soon as it is
   scanned, and the guard just reads why.
   ═══════════════════════════════════════════════════════════════════════════ */

interface Props {
  /** Raw QR content, `EVP1:` prefix included. */
  token: string;
  onDone: () => void;
  onCancel: () => void;
}

export default function EventPassScanPanel({ token, onDone, onCancel }: Props) {
  const t = useTranslations('eventPasses.scan');
  const tp = useTranslations('eventPasses');
  const tc = useTranslations('common');
  const intlLocale = INTL_LOCALE[useLocale() as keyof typeof INTL_LOCALE];
  const [result, setResult] = useState<EventPassVerifyResult | null>(null);
  const [error, setError] = useState('');
  const [people, setPeople] = useState(1);
  const [busy, setBusy] = useState<'in' | 'out' | 'deny' | null>(null);
  const [actionError, setActionError] = useState('');
  const [done, setDone] = useState<'in' | 'out' | 'denied' | null>(null);
  // "Don't allow" opens a short reason step before it is recorded.
  const [denying, setDenying] = useState(false);
  const [reason, setReason] = useState('');
  const [autoDenied, setAutoDenied] = useState(false);

  useEffect(() => {
    let cancelled = false;
    verifyEventPass(token)
      .then(async (data) => {
        if (cancelled) return;
        setResult(data);
        setPeople(data.pass.membersAllowed);
        // Nothing to decide on a pass that cannot be let in: record the refusal
        // now. A party already inside is not refused — it may still leave.
        if (data.verdict !== 'VALID' && !data.pass.inside) {
          try {
            const next = await denyEventPass(token, t(`reason.${data.verdict}`));
            if (cancelled) return;
            setResult(next);
            setDone('denied');
            setAutoDenied(true);
          } catch {
            // Falls back to the guard's own "Don't allow" below.
          }
        }
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(errorMessage(e, t('verifyFailed')));
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const time = (iso: string | null) =>
    iso
      ? new Intl.DateTimeFormat(intlLocale, { hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Kolkata' }).format(new Date(iso))
      : '';

  const act = async (kind: 'in' | 'out' | 'deny') => {
    setBusy(kind);
    setActionError('');
    try {
      const next =
        kind === 'in'
          ? await checkInEventPass(token, people)
          : kind === 'out'
            ? await checkOutEventPass(token)
            : await denyEventPass(token, reason.trim());
      setResult(next);
      setDone(kind === 'deny' ? 'denied' : kind);
      setDenying(false);
    } catch (e) {
      setActionError(errorMessage(e, t('actionFailed')));
      // Someone at another gate may have just acted on this pass — show the truth.
      verifyEventPass(token).then(setResult).catch(() => undefined);
    } finally {
      setBusy(null);
    }
  };

  if (error) {
    return (
      <div className="flex flex-col items-center gap-5 py-8 text-center">
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-red-500/20">
          <XCircle className="h-10 w-10 text-red-400" aria-hidden />
        </div>
        <div>
          <h2 className="mb-1 text-xl font-bold text-white">{t('invalidTitle')}</h2>
          <p className="text-sm text-red-400">{error}</p>
        </div>
        <button onClick={onCancel} className="rounded-xl bg-indigo-600 px-8 py-3 font-semibold text-white transition-all hover:bg-indigo-500">
          {t('backToScanner')}
        </button>
      </div>
    );
  }

  if (!result) {
    return (
      <div className="flex flex-col items-center gap-4 py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
        <p className="text-sm text-slate-400">{t('checking')}</p>
      </div>
    );
  }

  const { pass, event, verdict } = result;
  const inside = pass.inside;
  const tone = EVENT_PASS_TIER_COLORS[pass.tier];
  const students = passStudentsLine(pass.students);
  const shortDay = (d: string | null) => (d ? passShortDate(d, intlLocale) : '');
  const validDays = pass.allDays
    ? tp('list.allDays')
    : pass.validDates.map((d) => passShortDate(d, intlLocale)).join(', ');

  const banner = (() => {
    if (done === 'in') {
      return { tone: 'bg-emerald-500/10 border-emerald-500/25 text-emerald-300', icon: <LogIn className="h-5 w-5 shrink-0 text-emerald-400" aria-hidden />, headline: t('checkedIn', { people: pass.checkedInPeople ?? people }), detail: t('checkedInDetail') };
    }
    if (done === 'denied' && !autoDenied) {
      return { tone: 'bg-red-500/10 border-red-500/25 text-red-300', icon: <ShieldX className="h-5 w-5 shrink-0 text-red-400" aria-hidden />, headline: t('deniedHeadline'), detail: t('deniedDetail') };
    }
    if (done === 'out') {
      return { tone: 'bg-sky-500/10 border-sky-500/25 text-sky-300', icon: <LogOut className="h-5 w-5 shrink-0 text-sky-400" aria-hidden />, headline: t('checkedOut'), detail: t('checkedOutDetail') };
    }
    if (verdict === 'VALID' && inside) {
      return {
        tone: 'bg-amber-500/10 border-amber-500/25 text-amber-300',
        icon: <DoorOpen className="h-5 w-5 shrink-0 text-amber-400" aria-hidden />,
        headline: t('alreadyInside', { people: pass.checkedInPeople ?? 0 }),
        detail: t('alreadyInsideDetail', { time: time(pass.checkedInAt), name: pass.checkedInByName ?? '—' }),
      };
    }
    switch (verdict) {
      case 'VALID':
        return { tone: 'bg-emerald-500/10 border-emerald-500/25 text-emerald-300', icon: <BadgeCheck className="h-5 w-5 shrink-0 text-emerald-400" aria-hidden />, headline: t('validHeadline'), detail: t('validDetail') };
      case 'NOT_TODAY':
        return { tone: 'bg-red-500/10 border-red-500/25 text-red-300', icon: <CalendarX className="h-5 w-5 shrink-0 text-red-400" aria-hidden />, headline: t('notTodayHeadline'), detail: t('notTodayDetail', { days: validDays }) };
      case 'NOT_YET':
        return { tone: 'bg-red-500/10 border-red-500/25 text-red-300', icon: <CalendarX className="h-5 w-5 shrink-0 text-red-400" aria-hidden />, headline: t('notYetHeadline'), detail: t('notYetDetail', { date: shortDay(pass.validFrom), days: validDays }) };
      case 'EXPIRED':
        return { tone: 'bg-red-500/10 border-red-500/25 text-red-300', icon: <CalendarX className="h-5 w-5 shrink-0 text-red-400" aria-hidden />, headline: t('expiredHeadline'), detail: t('expiredDetail', { date: shortDay(pass.validUntil) }) };
      case 'CANCELLED':
        return { tone: 'bg-red-500/10 border-red-500/25 text-red-300', icon: <Ban className="h-5 w-5 shrink-0 text-red-400" aria-hidden />, headline: t('cancelledHeadline'), detail: pass.cancelReason ?? t('cancelledDetail') };
      case 'REPLACED':
        return { tone: 'bg-red-500/10 border-red-500/25 text-red-300', icon: <Ban className="h-5 w-5 shrink-0 text-red-400" aria-hidden />, headline: t('replacedHeadline'), detail: t('replacedDetail') };
      default:
        return { tone: 'bg-red-500/10 border-red-500/25 text-red-300', icon: <Ban className="h-5 w-5 shrink-0 text-red-400" aria-hidden />, headline: t('closedHeadline'), detail: t('closedDetail') };
    }
  })();

  // The question every scan asks, unless the party is already inside (then
  // the answer is a check-out) or it has been answered.
  const deciding = !done && !inside;
  const canAllow = verdict === 'VALID';
  // A party inside can always leave on the record, even on a pass cancelled meanwhile.
  const canCheckOut = inside && !done;
  const reasonChips = [
    !canAllow ? t(`reason.${verdict}`) : null,
    t('reason.tooMany'),
    t('reason.idMismatch'),
    t('reason.behaviour'),
  ].filter((r): r is string => !!r);

  const details = [
    { label: t('field.event'), value: event.title },
    { label: t('field.days'), value: validDays },
    { label: t('field.parentOf'), value: students || null },
    { label: t('field.mobile'), value: pass.mobile },
    {
      label: t('field.vehicle'),
      value: pass.vehicleNumber ? `${pass.vehicleType ? `${tp(`vehicle.${pass.vehicleType}`)} · ` : ''}${pass.vehicleNumber}` : null,
      vehicle: true,
    },
    { label: t('field.remarks'), value: pass.remarks },
  ].filter((d): d is { label: string; value: string; vehicle?: boolean } => Boolean(d.value));

  const entriesToday = result.todayMovements.filter((m) => m.direction === 'IN').length;

  return (
    <div className="space-y-4">
      <div className={`flex items-start gap-2.5 rounded-xl border px-4 py-3 ${banner.tone}`}>
        {banner.icon}
        <div className="min-w-0">
          <p className="text-sm font-semibold">{banner.headline}</p>
          <p className="mt-0.5 text-xs opacity-90">{banner.detail}</p>
          {autoDenied && (
            <p className="mt-1.5 flex items-center gap-1 text-xs font-semibold">
              <ShieldX className="h-3.5 w-3.5" aria-hidden /> {t('autoRecorded')}
            </p>
          )}
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900">
        <div className="flex items-center justify-between px-4 py-2" style={{ backgroundColor: tone.band, color: tone.ink }}>
          <span className="inline-flex items-center gap-1.5 text-xs font-bold tracking-widest uppercase">
            <Ticket className="h-3.5 w-3.5" aria-hidden /> {tp(`tier.${pass.tier}`)}
          </span>
          <span className="font-mono text-xs font-semibold">{passSerial(pass.serial)}</span>
        </div>
        <div className="p-4">
          <h3 className="truncate text-lg font-bold text-white">
            {pass.holderName || (students ? tp('list.parentOf', { names: students }) : tp('list.guest'))}
          </h3>
          <div className="mt-2 flex items-end gap-2">
            <Users className="mb-1 h-5 w-5 text-slate-400" aria-hidden />
            <span className="text-3xl leading-none font-bold text-white">{pass.membersAllowed}</span>
            <span className="mb-0.5 text-sm text-slate-400">{t('admits')}</span>
          </div>
          {pass.memberNames.length > 0 && (
            <ol className="mt-2 grid grid-cols-1 gap-1 text-[13px] text-slate-200 sm:grid-cols-2">
              {pass.memberNames.map((n, i) => (
                <li key={i} className="truncate">
                  <span className="mr-1.5 text-slate-500">{i + 1}.</span>
                  {n}
                </li>
              ))}
            </ol>
          )}
          {pass.memberNames.length === 0 && <p className="mt-1 text-xs text-slate-500">{t('noNames')}</p>}

          {details.length > 0 && (
            <dl className="mt-3.5 grid grid-cols-2 gap-x-3 gap-y-2.5 border-t border-slate-800 pt-3">
              {details.map((d) => (
                // Long values (three children, an event title) take the full row.
                <div key={d.label} className={d.value.length > 28 ? 'col-span-2 min-w-0' : 'min-w-0'}>
                  <dt className="text-[10px] font-semibold tracking-widest text-slate-500 uppercase">{d.label}</dt>
                  <dd className="mt-0.5 text-[13px] font-medium break-words text-slate-200">
                    {d.vehicle && <Car className="mr-1 inline h-3.5 w-3.5" aria-hidden />}
                    {d.value}
                  </dd>
                </div>
              ))}
            </dl>
          )}
          {entriesToday > 0 && (
            <p className="mt-3 border-t border-slate-800 pt-3 text-xs text-slate-500">{t('entriesToday', { count: entriesToday })}</p>
          )}
        </div>
      </div>

      {actionError && <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-300">{actionError}</p>}

      {deciding && !denying && (
        <div className="rounded-2xl border border-slate-700 bg-slate-900 p-4">
          <p className="text-base font-semibold text-white">{t('askAllow')}</p>
          {canAllow ? (
            <>
              <p className="mt-3 mb-2 text-xs font-semibold tracking-widest text-slate-500 uppercase">{t('howMany')}</p>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  aria-label={tp('form.fewer')}
                  onClick={() => setPeople((n) => Math.max(1, n - 1))}
                  className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-800 text-white hover:bg-slate-700"
                >
                  <Minus className="h-4 w-4" />
                </button>
                <span className="min-w-12 text-center text-2xl font-bold text-white">{people}</span>
                <button
                  type="button"
                  aria-label={tp('form.more')}
                  onClick={() => setPeople((n) => Math.min(pass.membersAllowed, n + 1))}
                  className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-800 text-white hover:bg-slate-700"
                >
                  <Plus className="h-4 w-4" />
                </button>
                <span className="text-sm text-slate-400">{t('ofAllowed', { count: pass.membersAllowed })}</span>
              </div>
            </>
          ) : (
            <p className="mt-1 text-sm text-red-300">{t('cannotAllow')}</p>
          )}
          <div className="mt-4 grid grid-cols-2 gap-2">
            <button
              onClick={() => {
                setReason(canAllow ? '' : t(`reason.${verdict}`));
                setDenying(true);
              }}
              disabled={!!busy}
              className={`flex items-center justify-center gap-2 rounded-xl border border-red-500/40 bg-red-500/10 py-3 text-sm font-semibold text-red-300 transition-all hover:bg-red-500/20 disabled:opacity-60 ${canAllow ? '' : 'col-span-2'}`}
            >
              <ShieldX className="h-4 w-4" aria-hidden />
              {t('deny')}
            </button>
            {canAllow && (
              <button
                onClick={() => act('in')}
                disabled={!!busy}
                className="flex items-center justify-center gap-2 rounded-xl bg-emerald-600 py-3 text-sm font-semibold text-white transition-all hover:bg-emerald-500 disabled:opacity-60"
              >
                {busy === 'in' ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogIn className="h-4 w-4" />}
                {t('allow', { people })}
              </button>
            )}
          </div>
        </div>
      )}

      {deciding && denying && (
        <div className="rounded-2xl border border-red-500/30 bg-slate-900 p-4">
          <p className="text-base font-semibold text-white">{t('denyTitle')}</p>
          <p className="mt-0.5 text-xs text-slate-400">{t('denyHint')}</p>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {reasonChips.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setReason(r)}
                className={`rounded-full border px-3 py-1.5 text-xs transition-colors ${reason === r ? 'border-red-400 bg-red-500/20 text-red-200' : 'border-slate-700 text-slate-300 hover:bg-slate-800'}`}
              >
                {r}
              </button>
            ))}
          </div>
          <input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            maxLength={300}
            placeholder={t('reasonPlaceholder')}
            aria-label={t('reasonPlaceholder')}
            className="mt-3 w-full rounded-xl border border-slate-700 bg-slate-800 px-3 py-2.5 text-sm text-white placeholder:text-slate-500 focus:border-red-400 focus:outline-none"
          />
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button
              onClick={() => setDenying(false)}
              disabled={!!busy}
              className="rounded-xl bg-slate-800 py-3 text-sm font-medium text-white transition-all hover:bg-slate-700"
            >
              {tc('action.back')}
            </button>
            <button
              onClick={() => act('deny')}
              disabled={!!busy}
              className="flex items-center justify-center gap-2 rounded-xl bg-red-600 py-3 text-sm font-semibold text-white transition-all hover:bg-red-500 disabled:opacity-60"
            >
              {busy === 'deny' ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldX className="h-4 w-4" />}
              {t('confirmDeny')}
            </button>
          </div>
        </div>
      )}

      {canCheckOut && (
        <button
          onClick={() => act('out')}
          disabled={!!busy}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-sky-600 py-3 text-sm font-semibold text-white transition-all hover:bg-sky-500 disabled:opacity-60"
        >
          {busy === 'out' ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogOut className="h-4 w-4" />}
          {t('checkOut', { people: pass.checkedInPeople ?? 0 })}
        </button>
      )}

      <div className="flex gap-2">
        <button onClick={onCancel} className="flex-1 rounded-xl bg-slate-800 py-3 text-sm font-medium text-white transition-all hover:bg-slate-700">
          {tc('action.back')}
        </button>
        {!deciding && (
          <button
            onClick={onDone}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-indigo-600 py-3 text-sm font-semibold text-white transition-all hover:bg-indigo-500"
          >
            <ScanLine className="h-4 w-4" aria-hidden />
            {t('scanNext')}
          </button>
        )}
      </div>
    </div>
  );
}
