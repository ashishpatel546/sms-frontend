'use client';

import { useEffect, useState } from 'react';
import { CircleCheck, CircleX, Loader2, PencilLine, Undo2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { DraftItem } from './useAssistantChat';

function minutesLeft(expiresAt: string | null, now: number): number | null {
  if (!expiresAt) return null;
  return Math.ceil((Date.parse(expiresAt) - now) / 60_000);
}

/**
 * A proposed change, "pencilled in": dashed iris outline until the person
 * confirms it, then "inked" — solid sage, marked saved. Nothing is written to
 * the school's records until Confirm is pressed (or a plain "yes" is said).
 */
export function DraftCard({
  draft,
  onConfirm,
  onCancel,
}: {
  draft: DraftItem;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const [now, setNow] = useState(() => Date.now());
  const pending = draft.state === 'pending';

  useEffect(() => {
    if (!pending) return;
    const t = window.setInterval(() => setNow(Date.now()), 20_000);
    return () => window.clearInterval(t);
  }, [pending]);

  const left = minutesLeft(draft.expires_at, now);
  const expired = pending && left !== null && left <= 0;
  const state = expired ? 'expired' : draft.state;

  const frame = {
    pending: 'border-dashed border-accent-ai-edge bg-surface',
    expired: 'border-dashed border-line-strong bg-surface-secondary',
    done: 'border-solid border-accent-success-edge bg-surface assistant-inked',
    cancelled: 'border-solid border-line bg-surface-secondary',
    failed: 'border-solid border-accent-danger-edge bg-accent-danger-tint',
  }[state];

  const heading = {
    pending: { icon: PencilLine, text: 'Draft, not saved yet', tone: 'text-accent-ai' },
    expired: { icon: PencilLine, text: 'Draft expired. Ask again to prepare it.', tone: 'text-ink-muted' },
    done: { icon: CircleCheck, text: 'Saved', tone: 'text-accent-success-deep' },
    cancelled: { icon: Undo2, text: 'Cancelled, nothing was changed', tone: 'text-ink-muted' },
    failed: { icon: CircleX, text: 'Not saved', tone: 'text-accent-danger-deep' },
  }[state];
  const Icon = heading.icon;

  return (
    <div
      className={`mt-2.5 rounded-md border-2 px-3.5 py-3 transition-colors duration-300 motion-reduce:transition-none ${frame}`}
      role="group"
      aria-label={heading.text}
    >
      <p className={`flex items-center gap-1.5 text-[12.5px] font-semibold ${heading.tone}`}>
        <Icon className="size-3.5" aria-hidden />
        {heading.text}
      </p>
      <p
        className={`mt-1.5 text-[14px] leading-relaxed ${
          state === 'cancelled' || state === 'expired' ? 'text-ink-faint line-through decoration-1' : 'text-ink'
        }`}
      >
        {draft.summary}
      </p>

      {pending && !expired && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            variant="primary"
            onClick={onConfirm}
            disabled={!!draft.working}
            className="min-h-10"
          >
            {draft.working === 'confirm' ? (
              <Loader2 className="size-4 animate-spin" aria-hidden />
            ) : (
              <CircleCheck className="size-4" aria-hidden />
            )}
            Confirm and save
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={onCancel}
            disabled={!!draft.working}
            className="min-h-10"
          >
            {draft.working === 'cancel' && <Loader2 className="size-4 animate-spin" aria-hidden />}
            Cancel
          </Button>
          {left !== null && (
            <span className="ml-auto font-mono text-[11px] text-ink-faint tabular-nums">
              {left <= 1 ? 'Expires in a minute' : `Expires in ${left} min`}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
