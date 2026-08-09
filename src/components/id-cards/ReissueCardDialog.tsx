'use client';

import * as React from 'react';
import toast from 'react-hot-toast';
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
        toast.success(
          `New card issued (issue ${next.currentVersion}). The previous card no longer works.`,
        );
      } else if (mode === 'revoke') {
        const next = await revokeIdCard(subject, subjectId, reason.trim());
        setHistory(next);
        toast.success(
          `Card revoked. It is refused at the gate from now on — no replacement has been printed.`,
        );
      } else {
        const next = await extendIdCardValidity(
          subject,
          subjectId,
          validUntil,
          reason.trim() || undefined,
        );
        setHistory(next);
        toast.success(
          `Valid until ${formatIdCardDate(next.validUntil)} — the same card keeps working.`,
        );
      }
      onChanged();
      onOpenChange(false);
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : 'Could not update the card.',
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
          Currently on issue {row.issueVersion}
          {row.validUntil
            ? `, valid until ${formatIdCardDate(row.validUntil)}`
            : ''}
          .
        </DialogDescription>

        {revoked && (
          <div className="border-accent-danger-edge bg-accent-danger-tint mt-3 flex gap-2.5 rounded-xl border p-3">
            <Ban
              className="text-accent-danger-deep mt-0.5 size-4 shrink-0"
              aria-hidden
            />
            <div className="text-[12.5px] leading-relaxed">
              <p className="text-accent-danger-deep font-semibold">
                This card is revoked
              </p>
              <p className="text-ink-muted mt-1">
                {row.revokedReason
                  ? `“${row.revokedReason}” — i`
                  : 'I'}
                t is refused at the gate. Issue {row.issueVersion + 1} to give
                them a working card again.
              </p>
            </div>
          </div>
        )}

        <div className="border-line mt-3 flex gap-1 rounded-lg border p-1">
          <ModeTab
            active={mode === 'reissue'}
            onClick={() => setMode('reissue')}
            icon={<RotateCcw className="size-3.5" aria-hidden />}
            label={revoked ? 'Issue new card' : 'Replace card'}
          />
          <ModeTab
            active={mode === 'revoke'}
            onClick={() => setMode('revoke')}
            icon={<Ban className="size-3.5" aria-hidden />}
            label="Revoke"
            // Nothing left to revoke; the tab would only produce a 400.
            disabled={revoked}
          />
          <ModeTab
            active={mode === 'extend'}
            onClick={() => setMode('extend')}
            icon={<CalendarClock className="size-3.5" aria-hidden />}
            label="Extend"
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
                  The card stops working and nothing replaces it
                </p>
                <p className="text-ink-muted mt-1">
                  Issue {row.issueVersion} is refused at the gate from the
                  moment you confirm, and {row.name.split(' ')[0]} will have no
                  working card until you issue one. The card disappears from
                  the parent portal and cannot be printed from here.
                </p>
                <p className="text-ink-muted mt-1.5">
                  Use <span className="font-medium">Replace card</span> instead
                  if they need a new one straight away.
                </p>
              </div>
            </div>

            <label className="mt-3 block">
              <span className="text-ink text-[13px] font-medium">
                Why is it being revoked?
              </span>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={2}
                maxLength={500}
                placeholder="Reported stolen — police complaint filed"
                className="border-line bg-surface text-ink placeholder:text-ink-faint focus:border-brand mt-1 w-full rounded-md border px-3 py-2 text-[13.5px] outline-none"
              />
              <span className="text-ink-faint text-[11.5px]">
                With no replacement card to explain itself, this reason is the
                only record of what happened.
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
                    ? 'A working card is issued in place of the revoked one'
                    : 'The card they are holding will stop working immediately'}
                </p>
                <p className="text-ink-muted mt-1">
                  {revoked ? (
                    <>
                      Issue {row.issueVersion} stays revoked and keeps its
                      reason. Issue {row.issueVersion + 1} appears on the parent
                      portal and here straight away — print it and hand it over.
                    </>
                  ) : (
                    <>
                      Issue {row.issueVersion} is refused at the gate from the
                      moment you confirm. Issue {row.issueVersion + 1} appears
                      on the parent portal and here straight away — print it and
                      hand it over.
                    </>
                  )}
                </p>
              </div>
            </div>

            <label className="mt-3 block">
              <span className="text-ink text-[13px] font-medium">
                Why is it being replaced?
              </span>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={2}
                maxLength={500}
                placeholder="Lost on the school bus"
                className="border-line bg-surface text-ink placeholder:text-ink-faint focus:border-brand mt-1 w-full rounded-md border px-3 py-2 text-[13.5px] outline-none"
              />
              <span className="text-ink-faint text-[11.5px]">
                Kept against the old card, so this is answerable later.
              </span>
            </label>
          </>
        ) : (
          <>
            <p className="text-ink-muted mt-3 text-[12.5px] leading-relaxed">
              Keeps the current card working past its session. Nothing is
              reprinted and the QR does not change — the same plastic simply
              stays valid.
            </p>
            <label className="mt-3 block">
              <span className="text-ink text-[13px] font-medium">
                Valid until
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
                Note <span className="text-ink-faint">(optional)</span>
              </span>
              <input
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                maxLength={500}
                placeholder="Session extended by a term"
                className="border-line bg-surface text-ink placeholder:text-ink-faint focus:border-brand mt-1 w-full rounded-md border px-3 py-2 text-[13.5px] outline-none"
              />
            </label>
          </>
        )}

        {history && history.issues.length > 0 && (
          <div className="border-line mt-4 rounded-xl border p-3">
            <p className="text-ink flex items-center gap-1.5 text-[12.5px] font-semibold">
              <History className="size-3.5" aria-hidden />
              Card history
            </p>
            <ul className="mt-2 space-y-2">
              {history.issues.map((issue) => (
                <li key={issue.version} className="text-[12px] leading-relaxed">
                  <span className="text-ink font-medium">
                    Issue {issue.version}
                  </span>
                  {/* A revoked CURRENT issue was cancelled outright; a revoked
                      older one was superseded. Same column, different story. */}
                  {issue.revokedAt ? (
                    <span className="text-accent-danger-deep">
                      {issue.version === history.currentVersion
                        ? ' · revoked'
                        : ' · replaced'}
                    </span>
                  ) : (
                    <span className="text-accent-success"> · current</span>
                  )}
                  {issue.validUntil && !issue.revokedAt && (
                    <span className="text-ink-muted">
                      {' '}
                      · until {formatIdCardDate(issue.validUntil)}
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
            Cancel
          </Button>
          <Button
            variant={mode === 'extend' ? 'primary' : 'destructive'}
            size="sm"
            onClick={() => void submit()}
            disabled={busy || !canSubmit}
          >
            {busy
              ? 'Working…'
              : mode === 'reissue'
                ? `${revoked ? 'Issue' : 'Replace —'} issue ${row.issueVersion + 1}`
                : mode === 'revoke'
                  ? `Revoke issue ${row.issueVersion}`
                  : 'Extend validity'}
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
