'use client';

import * as React from 'react';
import toast from 'react-hot-toast';
import { useTranslations } from 'next-intl';
import {
  AlertTriangle,
  Ban,
  CalendarClock,
  History,
  RotateCcw,
} from 'lucide-react';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
  extendIdCardValidity,
  fetchIdCardHistory,
  reissueIdCard,
  revokeIdCard,
  type IdCardIssueHistory,
  type IdCardRow,
  type IdCardSubject,
} from '@/lib/id-card-api';
import { formatIdCardDate } from '@/lib/id-card-api';

/* ═══════════════════════════════════════════════════════════════════════════
   WHAT TO DO ABOUT A CARD

   Three actions live in one dialog because a school reaches for them in the
   same moment — someone at the desk is holding a card, or has lost one:

   · REPLACE kills the old card AND prints a new one. The QR carries an issue
     number and the gate only honours the current one, so the plastic in
     circulation stops working the instant this returns.

   · REVOKE kills the card and prints NOTHING. That is the difference that
     matters: replacing a leaver's card would hand them a working one, which is
     the opposite of the intent. Use it for a card reported stolen, or handed
     back at the end of a contract.

   · EXTEND does the opposite of both — it keeps the existing card alive past
     its session. Possible only because the expiry date is stored rather than
     printed into the QR, so nobody has to reprint to get another term out of a
     perfectly good card.

   The reason is required for replace and revoke, and is not a formality: it is
   written onto that card's row, so "what happened to card 1?" has an answer
   months later, with a name and a date against it. For a revocation it is the
   ONLY record — there is no successor card to infer the story from.
   ═══════════════════════════════════════════════════════════════════════════ */

type Mode = 'reissue' | 'revoke' | 'extend';

export function ReissueCardDialog({
  row,
  open,
  onOpenChange,
  onChanged,
  initialMode = 'reissue',
}: {
  row: IdCardRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Refetch the register so the new QR and issue number are picked up. */
  onChanged: () => void;
  /** Which tab to land on — the register's Revoke button opens on 'revoke'. */
  initialMode?: Mode;
}) {
  const t = useTranslations('idCards.reissue');
  const tc = useTranslations('common');
  const [mode, setMode] = React.useState<Mode>(initialMode);
  const [reason, setReason] = React.useState('');
  const [validUntil, setValidUntil] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [history, setHistory] = React.useState<IdCardIssueHistory | null>(null);

  const subject: IdCardSubject | null =
    row?.type === 'STUDENT' ? 'STUDENT' : row?.type === 'STAFF' ? 'STAFF' : null;
  const subjectId = row?.type === 'STUDENT' ? row.studentId : row?.staffId ?? null;
  const revoked = row?.revokedAt != null;

  // Reset for each holder AND for each way the dialog was opened, during
  // render rather than in an effect so the previous person's reason can never
  // be submitted against this one.
  const [shownFor, setShownFor] = React.useState<string | null>(null);
  const key = row ? `${row.type}:${subjectId}:${initialMode}` : null;
  if (shownFor !== key) {
    setShownFor(key);
    setReason('');
    setValidUntil(row?.validUntil ?? '');
    // An already-dead card has nothing to revoke or extend; the only move left
    // is printing a new one, so land there rather than on a disabled tab.
    setMode(row?.revokedAt != null ? 'reissue' : initialMode);
    setHistory(null);
  }

  React.useEffect(() => {
    if (!open || !subject || subjectId == null) return;
    let cancelled = false;
    void fetchIdCardHistory(subject, subjectId)
      .then((h) => {
        if (!cancelled) setHistory(h);
      })
      .catch(() => {
        /* history is context, not the point of the dialog */
      });
    return () => {
      cancelled = true;
    };
  }, [open, subject, subjectId]);

  if (!row || !subject || subjectId == null) return null;

  const submit = async () => {
    setBusy(true);
    try {
      if (mode === 'reissue') {
        const next = await reissueIdCard(subject, subjectId, reason.trim());
        setHistory(next);
        toast.success(t('toastReissued', { version: next.currentVersion }));
      } else if (mode === 'revoke') {
        const next = await revokeIdCard(subject, subjectId, reason.trim());
        setHistory(next);
        toast.success(t('toastRevoked'));
      } else {
        const next = await extendIdCardValidity(
          subject,
          subjectId,
          validUntil,
          reason.trim() || undefined,
        );
        setHistory(next);
        toast.success(
          t('toastExtended', { date: formatIdCardDate(next.validUntil) }),
        );
      }
      onChanged();
      onOpenChange(false);
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : t('toastFailed'),
      );
    } finally {
      setBusy(false);
    }
  };

  const canSubmit =
    mode === 'extend' ? validUntil.length > 0 : reason.trim().length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-lg">
        <DialogTitle className="text-[16px] font-semibold">
          {row.name}
        </DialogTitle>
        <DialogDescription className="text-ink-muted mt-0.5 text-[12.5px]">
          {row.validUntil
            ? t('currentValid', {
                version: row.issueVersion,
                date: formatIdCardDate(row.validUntil),
              })
            : t('current', { version: row.issueVersion })}
        </DialogDescription>

        {revoked && (
          <div className="border-accent-danger-edge bg-accent-danger-tint mt-3 flex gap-2.5 rounded-xl border p-3">
            <Ban
              className="text-accent-danger-deep mt-0.5 size-4 shrink-0"
              aria-hidden
            />
            <div className="text-[12.5px] leading-relaxed">
              <p className="text-accent-danger-deep font-semibold">
                {t('revokedTitle')}
              </p>
              <p className="text-ink-muted mt-1">
                {row.revokedReason
                  ? t('revokedWithReason', {
                      reason: row.revokedReason,
                      next: row.issueVersion + 1,
                    })
                  : t('revokedNoReason', { next: row.issueVersion + 1 })}
              </p>
            </div>
          </div>
        )}

        <div className="border-line mt-3 flex gap-1 rounded-lg border p-1">
          <ModeTab
            active={mode === 'reissue'}
            onClick={() => setMode('reissue')}
            icon={<RotateCcw className="size-3.5" aria-hidden />}
            label={revoked ? t('tabIssueNew') : t('tabReplace')}
          />
          <ModeTab
            active={mode === 'revoke'}
            onClick={() => setMode('revoke')}
            icon={<Ban className="size-3.5" aria-hidden />}
            label={t('tabRevoke')}
            // Nothing left to revoke; the tab would only produce a 400.
            disabled={revoked}
          />
          <ModeTab
            active={mode === 'extend'}
            onClick={() => setMode('extend')}
            icon={<CalendarClock className="size-3.5" aria-hidden />}
            label={t('tabExtend')}
            // Moving the expiry of a dead card changes nothing at the gate.
            disabled={revoked}
          />
        </div>

        {mode === 'revoke' ? (
          <>
            <div className="border-accent-danger-edge bg-accent-danger-tint mt-3 flex gap-2.5 rounded-xl border p-3">
              <AlertTriangle
                className="text-accent-danger-deep mt-0.5 size-4 shrink-0"
                aria-hidden
              />
              <div className="text-[12.5px] leading-relaxed">
                <p className="text-accent-danger-deep font-semibold">
                  {t('revokeWarnTitle')}
                </p>
                <p className="text-ink-muted mt-1">
                  {t('revokeWarnBody', {
                    version: row.issueVersion,
                    firstName: row.name.split(' ')[0],
                  })}
                </p>
                <p className="text-ink-muted mt-1.5">
                  {t.rich('revokeUseReplace', {
                    b: (c) => <span className="font-medium">{c}</span>,
                  })}
                </p>
              </div>
            </div>

            <label className="mt-3 block">
              <span className="text-ink text-[13px] font-medium">
                {t('revokeReasonLabel')}
              </span>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={2}
                maxLength={500}
                placeholder={t('revokePlaceholder')}
                className="border-line bg-surface text-ink placeholder:text-ink-faint focus:border-brand mt-1 w-full rounded-md border px-3 py-2 text-[13.5px] outline-none"
              />
              <span className="text-ink-faint text-[11.5px]">
                {t('revokeReasonHint')}
              </span>
            </label>
          </>
        ) : mode === 'reissue' ? (
          <>
            <div className="border-accent-danger-edge bg-accent-danger-tint mt-3 flex gap-2.5 rounded-xl border p-3">
              <AlertTriangle
                className="text-accent-danger-deep mt-0.5 size-4 shrink-0"
                aria-hidden
              />
              <div className="text-[12.5px] leading-relaxed">
                <p className="text-accent-danger-deep font-semibold">
                  {revoked
                    ? t('reissueWarnRevoked')
                    : t('reissueWarnActive')}
                </p>
                <p className="text-ink-muted mt-1">
                  {revoked
                    ? t('reissueBodyRevoked', {
                        version: row.issueVersion,
                        next: row.issueVersion + 1,
                      })
                    : t('reissueBodyActive', {
                        version: row.issueVersion,
                        next: row.issueVersion + 1,
                      })}
                </p>
              </div>
            </div>

            <label className="mt-3 block">
              <span className="text-ink text-[13px] font-medium">
                {t('replaceReasonLabel')}
              </span>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={2}
                maxLength={500}
                placeholder={t('replacePlaceholder')}
                className="border-line bg-surface text-ink placeholder:text-ink-faint focus:border-brand mt-1 w-full rounded-md border px-3 py-2 text-[13.5px] outline-none"
              />
              <span className="text-ink-faint text-[11.5px]">
                {t('replaceHint')}
              </span>
            </label>
          </>
        ) : (
          <>
            <p className="text-ink-muted mt-3 text-[12.5px] leading-relaxed">
              {t('extendBody')}
            </p>
            <label className="mt-3 block">
              <span className="text-ink text-[13px] font-medium">
                {t('validUntil')}
              </span>
              <input
                type="date"
                value={validUntil}
                onChange={(e) => setValidUntil(e.target.value)}
                className="border-line bg-surface text-ink focus:border-brand mt-1 w-full rounded-md border px-3 py-2 text-[13.5px] outline-none"
              />
            </label>
            <label className="mt-2 block">
              <span className="text-ink text-[13px] font-medium">
                {t.rich('noteLabel', {
                  muted: (c) => <span className="text-ink-faint">{c}</span>,
                })}
              </span>
              <input
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                maxLength={500}
                placeholder={t('extendPlaceholder')}
                className="border-line bg-surface text-ink placeholder:text-ink-faint focus:border-brand mt-1 w-full rounded-md border px-3 py-2 text-[13.5px] outline-none"
              />
            </label>
          </>
        )}

        {history && history.issues.length > 0 && (
          <div className="border-line mt-4 rounded-xl border p-3">
            <p className="text-ink flex items-center gap-1.5 text-[12.5px] font-semibold">
              <History className="size-3.5" aria-hidden />
              {t('historyTitle')}
            </p>
            <ul className="mt-2 space-y-2">
              {history.issues.map((issue) => (
                <li key={issue.version} className="text-[12px] leading-relaxed">
                  <span className="text-ink font-medium">
                    {t('historyIssue', { version: issue.version })}
                  </span>
                  {/* A revoked CURRENT issue was cancelled outright; a revoked
                      older one was superseded. Same column, different story. */}
                  {issue.revokedAt ? (
                    <span className="text-accent-danger-deep">
                      {issue.version === history.currentVersion
                        ? ` ${t('historyRevoked')}`
                        : ` ${t('historyReplaced')}`}
                    </span>
                  ) : (
                    <span className="text-accent-success"> {t('historyCurrent')}</span>
                  )}
                  {issue.validUntil && !issue.revokedAt && (
                    <span className="text-ink-muted">
                      {' '}
                      {t('historyUntil', {
                        date: formatIdCardDate(issue.validUntil),
                      })}
                    </span>
                  )}
                  {issue.revokedReason && (
                    <p className="text-ink-muted">
                      {issue.revokedReason}
                      {issue.revokedByName ? ` — ${issue.revokedByName}` : ''}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}

        <DialogFooter className="mt-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onOpenChange(false)}
            disabled={busy}
          >
            {tc('action.cancel')}
          </Button>
          <Button
            variant={mode === 'extend' ? 'primary' : 'destructive'}
            size="sm"
            onClick={() => void submit()}
            disabled={busy || !canSubmit}
          >
            {busy
              ? t('working')
              : mode === 'reissue'
                ? revoked
                  ? t('submitIssue', { next: row.issueVersion + 1 })
                  : t('submitReplace', { next: row.issueVersion + 1 })
                : mode === 'revoke'
                  ? t('submitRevoke', { version: row.issueVersion })
                  : t('submitExtend')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ModeTab({
  active,
  onClick,
  icon,
  label,
  disabled = false,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={
        'flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-2 text-[12.5px] font-medium transition-colors ' +
        (disabled
          ? 'text-ink-faint cursor-not-allowed'
          : active
            ? 'bg-surface-inset text-ink shadow-soft cursor-pointer'
            : 'text-ink-muted hover:text-ink cursor-pointer')
      }
    >
      {icon}
      {label}
    </button>
  );
}

export default ReissueCardDialog;
