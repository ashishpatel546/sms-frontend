'use client';

import * as React from 'react';
import toast from 'react-hot-toast';
import useSWR from 'swr';
import { useLocale, useTranslations } from 'next-intl';
import { Ban, Loader2, LogIn, LogOut, RotateCcw, ShieldX } from 'lucide-react';

import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Field, Textarea } from '@/components/ui/Field';
import { Skeleton } from '@/components/ui/skeleton';
import { INTL_LOCALE } from '@/i18n/config';
import { cn } from '@/lib/utils';
import {
  cancelEventPass,
  errorMessage,
  fetchEventPassMovements,
  officeCheckOutEventPass,
  passSerial,
  reissueEventPass,
  type EventPass,
} from '@/lib/event-passes-api';

export type EventPassAction = 'cancel' | 'reissue' | 'checkOut';

/**
 * Why a pass was replaced. Stored as a plain English prefix ("Lost: …") so the
 * audit log reads on its own; `reissueReasonLabel` translates it back.
 */
const REISSUE_KINDS = ['LOST', 'DAMAGED', 'OTHER'] as const;
type ReissueKind = (typeof REISSUE_KINDS)[number];
const REISSUE_PREFIX: Record<Exclude<ReissueKind, 'OTHER'>, string> = { LOST: 'Lost', DAMAGED: 'Damaged' };

export function reissueReasonLabel(reason: string, kindLabel: (kind: 'LOST' | 'DAMAGED') => string): string {
  for (const kind of ['LOST', 'DAMAGED'] as const) {
    const prefix = REISSUE_PREFIX[kind];
    if (reason === prefix) return kindLabel(kind);
    if (reason.startsWith(`${prefix}: `)) return `${kindLabel(kind)}: ${reason.slice(prefix.length + 2)}`;
  }
  return reason;
}

/**
 * One dialog for the three actions that need a reason. The reason is not a
 * formality: it is what the audit log shows months later.
 */
export function EventPassReasonDialog(props: {
  activityId: string;
  pass: EventPass | null;
  action: EventPassAction | null;
  onClose: () => void;
  onDone: () => void;
}) {
  const { pass, action, onClose } = props;
  return (
    <Dialog open={!!pass && !!action} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        {/* Mounted per opening, so the reason always starts empty. */}
        {pass && action && <ReasonForm key={`${pass.id}-${action}`} {...props} pass={pass} action={action} />}
      </DialogContent>
    </Dialog>
  );
}

function ReasonForm({
  activityId,
  pass,
  action,
  onClose,
  onDone,
}: {
  activityId: string;
  pass: EventPass;
  action: EventPassAction;
  onClose: () => void;
  onDone: () => void;
}) {
  const t = useTranslations('eventPasses');
  const tc = useTranslations('common');
  const [reason, setReason] = React.useState('');
  const [kind, setKind] = React.useState<ReissueKind>('LOST');
  const [busy, setBusy] = React.useState(false);
  const isReissue = action === 'reissue';
  const note = reason.trim();
  const finalReason = !isReissue || kind === 'OTHER' ? note : note ? `${REISSUE_PREFIX[kind]}: ${note}` : REISSUE_PREFIX[kind];

  const run = async () => {
    setBusy(true);
    try {
      const fn = action === 'cancel' ? cancelEventPass : action === 'reissue' ? reissueEventPass : officeCheckOutEventPass;
      await fn(activityId, pass.id, finalReason);
      toast.success(t(`action.${action}.done`));
      onDone();
      onClose();
    } catch (err) {
      toast.error(errorMessage(err, t(`action.${action}.failed`)));
    } finally {
      setBusy(false);
    }
  };

  const Icon = action === 'cancel' ? Ban : action === 'reissue' ? RotateCcw : LogOut;

  return (
    <>
      <DialogTitle className="flex items-center gap-2 text-[16px] font-semibold">
        <Icon className="size-4" aria-hidden />
        {t(`action.${action}.title`, { serial: passSerial(pass.serial) })}
      </DialogTitle>
      <DialogDescription className="text-ink-muted -mt-2 text-[12.5px]">{t(`action.${action}.explain`)}</DialogDescription>
      {isReissue && (
        <div role="radiogroup" aria-label={t('action.reason')} className="grid grid-cols-3 gap-1.5">
          {REISSUE_KINDS.map((k) => (
            <button
              key={k}
              type="button"
              role="radio"
              aria-checked={kind === k}
              onClick={() => setKind(k)}
              className={cn(
                'rounded-lg border px-2 py-2 text-[13px] font-medium transition-colors',
                kind === k ? 'border-brand bg-brand-tint text-ink' : 'border-line text-ink-muted hover:text-ink',
              )}
            >
              {t(`action.reissue.kind.${k}`)}
            </button>
          ))}
        </div>
      )}
      <Field
        label={isReissue && kind !== 'OTHER' ? t('action.reissue.details') : t('action.reason')}
        hint={isReissue && kind !== 'OTHER' ? t('form.optional') : undefined}
        htmlFor="ep-reason"
        required={!isReissue || kind === 'OTHER'}
      >
        <Textarea id="ep-reason" rows={3} maxLength={280} value={reason} onChange={(e) => setReason(e.target.value)} autoFocus={!isReissue} />
      </Field>
      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose} disabled={busy}>
          {tc('action.cancel')}
        </Button>
        <Button variant={action === 'cancel' ? 'destructive' : 'primary'} onClick={run} disabled={busy || !finalReason}>
          {busy && <Loader2 className="animate-spin" />}
          {t(`action.${action}.confirm`)}
        </Button>
      </div>
    </>
  );
}

/** Gate history: every check-in and check-out, and who allowed it. */
export function EventPassHistoryDialog({
  activityId,
  pass,
  onClose,
}: {
  activityId: string;
  pass: EventPass | null;
  onClose: () => void;
}) {
  const t = useTranslations('eventPasses');
  const intlLocale = INTL_LOCALE[useLocale() as keyof typeof INTL_LOCALE];
  const { data, isLoading } = useSWR(pass ? `/activities/${activityId}/passes/${pass.id}/movements` : null, () =>
    fetchEventPassMovements(activityId, pass!.id),
  );
  const when = new Intl.DateTimeFormat(intlLocale, {
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'Asia/Kolkata',
  });

  return (
    <Dialog open={!!pass} onOpenChange={(o) => !o && onClose()}>
      {/* Opened from the pass view as well, so it sits above that dialog. */}
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogTitle className="text-[16px] font-semibold">
          {pass ? t('history.title', { serial: passSerial(pass.serial) }) : ''}
        </DialogTitle>
        <DialogDescription className="text-ink-muted -mt-2 text-[12.5px]">{t('history.subtitle')}</DialogDescription>
        {isLoading ? (
          <Skeleton className="h-24 w-full" />
        ) : !data?.length ? (
          <p className="text-ink-muted py-6 text-center text-[13px]">{t('history.empty')}</p>
        ) : (
          <ol className="divide-line divide-y">
            {data.map((m) => (
              <li key={m.id} className="flex items-start gap-3 py-2.5">
                <span
                  className={
                    m.direction === 'IN'
                      ? 'bg-accent-success-tint text-accent-success-deep grid size-7 shrink-0 place-items-center rounded-full'
                      : m.direction === 'DENIED'
                        ? 'bg-accent-danger-tint text-accent-danger-deep grid size-7 shrink-0 place-items-center rounded-full'
                        : 'bg-surface-sunk text-ink-muted grid size-7 shrink-0 place-items-center rounded-full'
                  }
                >
                  {m.direction === 'IN' ? (
                    <LogIn className="size-3.5" aria-hidden />
                  ) : m.direction === 'DENIED' ? (
                    <ShieldX className="size-3.5" aria-hidden />
                  ) : (
                    <LogOut className="size-3.5" aria-hidden />
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-ink text-[13.5px] font-medium">
                    {m.direction === 'IN'
                      ? t('history.in', { people: m.people })
                      : m.direction === 'DENIED'
                        ? t('history.denied')
                        : t('history.out', { people: m.people })}
                  </p>
                  <p className="text-ink-muted text-[12px]">
                    {t('history.by', { name: m.byName, when: when.format(new Date(m.createdAt)) })}
                  </p>
                  {m.names.length > 0 && <p className="text-ink mt-0.5 text-[12.5px]">{m.names.join(', ')}</p>}
                  {m.note && <p className="text-ink-muted mt-0.5 text-[12px] italic">{m.note}</p>}
                </div>
              </li>
            ))}
          </ol>
        )}
      </DialogContent>
    </Dialog>
  );
}
