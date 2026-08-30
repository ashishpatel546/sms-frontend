'use client';

import * as React from 'react';
import toast from 'react-hot-toast';
import { AlertTriangle, FileUp, Loader2, Lock, Send, X } from 'lucide-react';
import {
  CIRCULAR_AUDIENCES,
  CIRCULAR_DESCRIPTION_MAX,
  CIRCULAR_DESCRIPTION_MIN,
  CIRCULAR_MAX_FILE_BYTES,
  CIRCULAR_TITLE_MAX,
  type CircularAudience,
  createCircular,
  formatFileSize,
} from '@/lib/circulars-api';
import { Field, Fieldset, Input, Label, Textarea } from '@/components/ui/Field';
import { Note } from '@/components/ui/Panel';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/** Below this much headroom the counter starts warning rather than informing. */
const COUNTER_WARN_AT = 100;

/**
 * Who is about to be interrupted, as a sentence subject. The confirmation and
 * the toast both name them: "everyone has been notified" is exactly the phrase
 * that stops someone reading the audience they just chose.
 */
const AUDIENCE_PHRASE: Record<CircularAudience, string> = {
  ALL: 'Every parent and staff member',
  PARENT: 'Every parent',
  STAFF: 'Every member of staff',
};

/**
 * ISSUING A CIRCULAR.
 *
 * The form is short because the act is not reversible: a circular cannot be
 * edited or withdrawn, and issuing one pushes a notification to every parent
 * and staff member in the school. So the weight sits on the last step —
 * the primary button asks for a confirmation rather than firing straight off.
 */
export function IssueCircularDialog({
  onClose,
  onIssued,
}: {
  onClose: () => void;
  onIssued: () => void;
}) {
  const [title, setTitle] = React.useState('');
  const [description, setDescription] = React.useState('');
  // Everyone is the default: it is what a circular meant before audiences
  // existed, and the mistake it risks (too many people told) is the one the
  // office can see and correct. The other way round, nobody notices.
  const [audience, setAudience] = React.useState<CircularAudience>('ALL');
  const [file, setFile] = React.useState<File | null>(null);
  const [fileError, setFileError] = React.useState<string | null>(null);
  const [confirming, setConfirming] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !submitting) onClose();
    };
    document.addEventListener('keydown', onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [onClose, submitting]);

  const trimmedTitle = title.trim();
  const trimmedDescription = description.trim();
  const remaining = CIRCULAR_DESCRIPTION_MAX - description.length;
  const canSubmit =
    trimmedTitle.length > 0 &&
    trimmedDescription.length >= CIRCULAR_DESCRIPTION_MIN &&
    description.length <= CIRCULAR_DESCRIPTION_MAX &&
    !fileError;

  const pickFile = (picked: File | null) => {
    setFileError(null);
    if (!picked) {
      setFile(null);
      return;
    }
    if (picked.type !== 'application/pdf') {
      setFileError('Only a PDF can be attached.');
      setFile(null);
      return;
    }
    if (picked.size > CIRCULAR_MAX_FILE_BYTES) {
      setFileError(
        `That file is ${formatFileSize(picked.size)} — the limit is ${CIRCULAR_MAX_FILE_BYTES / (1024 * 1024)} MB.`,
      );
      setFile(null);
      return;
    }
    setFile(picked);
  };

  const submit = async () => {
    setSubmitting(true);
    try {
      await createCircular({
        title: trimmedTitle,
        description: trimmedDescription,
        audience,
        file,
      });
      toast.success(
        `Circular issued — ${AUDIENCE_PHRASE[audience].toLowerCase()} has been notified.`,
      );
      onIssued();
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'The circular could not be issued.');
      setConfirming(false);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="issue-circular-title"
      className="fixed inset-0 z-100 flex items-end justify-center bg-walnut-950/55 backdrop-blur-sm sm:items-center sm:p-6"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !submitting) onClose();
      }}
    >
      <div className="flex max-h-[94dvh] w-full flex-col overflow-hidden rounded-t-2xl border border-line bg-surface shadow-glass sm:max-h-[90dvh] sm:max-w-xl sm:rounded-2xl">
        <div aria-hidden className="grid shrink-0 place-items-center pt-2 sm:hidden">
          <span className="h-1 w-9 rounded-full bg-line-strong" />
        </div>

        <header className="flex shrink-0 items-start gap-3 border-b border-line px-4 py-3 sm:px-5 sm:py-4">
          <div className="min-w-0 flex-1">
            <p className="eyebrow">Circulars</p>
            <h2
              id="issue-circular-title"
              className="mt-0.5 font-display text-[18px] leading-snug font-semibold text-ink sm:text-[20px]"
            >
              Issue a circular
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            aria-label="Close"
            className="grid size-9 shrink-0 cursor-pointer place-items-center rounded-md text-ink-muted transition-colors hover:bg-surface-secondary hover:text-ink disabled:opacity-40 focus-visible:ring-3 focus-visible:ring-brand/40 focus-visible:outline-none"
          >
            <X className="size-4" />
          </button>
        </header>

        <form
          id="issue-circular-form"
          onSubmit={(e) => {
            e.preventDefault();
            if (canSubmit) setConfirming(true);
          }}
          className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4 sm:px-5"
        >
          <Note
            pigment="attn"
            icon={<Lock />}
            title="Published once, and final"
          >
            A circular cannot be edited after it is issued, and the audience
            you choose is notified immediately. To correct one, issue a new
            circular — only the school&rsquo;s owner can withdraw one.
          </Note>

          <Fieldset
            legend="Who is this for?"
            description="Only this group is notified, and a staff circular never reaches the parent portal."
          >
            <div className="space-y-2">
              {CIRCULAR_AUDIENCES.map((option) => {
                const selected = audience === option.value;
                return (
                  <label
                    key={option.value}
                    className={cn(
                      'flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors',
                      selected
                        ? 'border-brand bg-brand-tint'
                        : 'border-line bg-surface-secondary hover:border-line-strong',
                    )}
                  >
                    <input
                      type="radio"
                      name="circular-audience"
                      value={option.value}
                      checked={selected}
                      onChange={() => setAudience(option.value)}
                      className="mt-0.5 size-4 shrink-0 accent-brand"
                    />
                    <span className="min-w-0">
                      <span className="block text-[13.5px] font-semibold text-ink">
                        {option.label}
                      </span>
                      <span className="mt-0.5 block text-[12px] leading-relaxed text-ink-muted">
                        {option.who}
                      </span>
                    </span>
                  </label>
                );
              })}
            </div>
          </Fieldset>

          <Field label="Title" required>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value.slice(0, CIRCULAR_TITLE_MAX))}
              maxLength={CIRCULAR_TITLE_MAX}
              placeholder="e.g. Summer vacation from 15 May"
              autoFocus
              required
            />
          </Field>

          <Field
            label="Description"
            htmlFor="circular-description"
            required
            hint={
              <span className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                <span>Attach the full notice as a PDF if it runs longer.</span>
                <span
                  className={cn(
                    'font-mono text-[11px] tabular',
                    remaining <= COUNTER_WARN_AT ? 'text-accent-deep' : 'text-ink-faint',
                  )}
                  aria-live="polite"
                >
                  {remaining.toLocaleString('en-IN')} of{' '}
                  {CIRCULAR_DESCRIPTION_MAX.toLocaleString('en-IN')} left
                </span>
              </span>
            }
          >
            <Textarea
              id="circular-description"
              value={description}
              onChange={(e) => setDescription(e.target.value.slice(0, CIRCULAR_DESCRIPTION_MAX))}
              maxLength={CIRCULAR_DESCRIPTION_MAX}
              rows={7}
              placeholder="What the school is announcing…"
              required
            />
          </Field>

          {/* Attachment */}
          <div>
            <Label htmlFor="circular-file" className="mb-1.5">
              Attachment
              <span className="ml-1.5 normal-case tracking-normal text-ink-faint">
                (optional PDF, up to {CIRCULAR_MAX_FILE_BYTES / (1024 * 1024)} MB)
              </span>
            </Label>
            <input
              ref={fileInputRef}
              id="circular-file"
              type="file"
              accept="application/pdf,.pdf"
              className="sr-only"
              onChange={(e) => pickFile(e.target.files?.[0] ?? null)}
            />
            {file ? (
              <div className="mt-1.5 flex items-center gap-2 rounded-lg border border-line bg-surface-secondary px-3 py-2.5">
                <FileUp className="size-4 shrink-0 text-brand" aria-hidden />
                <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-ink">
                  {file.name}
                </span>
                <span className="font-mono text-[11px] text-ink-faint">
                  {formatFileSize(file.size)}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="xs"
                  onClick={() => {
                    setFile(null);
                    if (fileInputRef.current) fileInputRef.current.value = '';
                  }}
                >
                  Remove
                </Button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="mt-0 flex w-full cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-line-strong bg-surface-secondary px-3 py-5 text-[13px] font-medium text-ink-muted transition-colors hover:border-brand hover:bg-brand-tint hover:text-brand focus-visible:ring-3 focus-visible:ring-brand/40 focus-visible:outline-none"
              >
                <FileUp className="size-4" aria-hidden />
                Choose a PDF
              </button>
            )}
            {fileError && (
              <p className="mt-1.5 text-[12px] font-medium text-accent-danger-deep">{fileError}</p>
            )}
          </div>
        </form>

        <footer className="shrink-0 border-t border-line bg-surface-secondary px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-5">
          {confirming ? (
            <div className="space-y-2.5">
              <p className="flex items-start gap-2 text-[12.5px] leading-relaxed text-ink">
                <AlertTriangle className="mt-0.5 size-4 shrink-0 text-accent-deep" aria-hidden />
                <span>
                  {AUDIENCE_PHRASE[audience]} will be notified straight away,
                  and this circular can never be edited.
                  {audience === 'STAFF' && ' Parents will not see it at all.'}
                  {audience === 'PARENT' &&
                    ' Staff can still find it in the circulars list, but will not be notified.'}{' '}
                  Issue it?
                </span>
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <Button onClick={() => void submit()} disabled={submitting}>
                  {submitting ? <Loader2 className="animate-spin" /> : <Send />}
                  {submitting ? 'Issuing…' : 'Yes, issue it'}
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => setConfirming(false)}
                  disabled={submitting}
                >
                  Keep editing
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              <Button type="submit" form="issue-circular-form" disabled={!canSubmit}>
                <Send /> Issue circular
              </Button>
              <Button variant="ghost" className="ml-auto" onClick={onClose}>
                Cancel
              </Button>
            </div>
          )}
        </footer>
      </div>
    </div>
  );
}
