'use client';

import * as React from 'react';
import toast from 'react-hot-toast';
import { Download, IdCard, Loader2, TriangleAlert } from 'lucide-react';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog';
import IdCardPreview from '@/components/id-cards/IdCardPreview';
import {
  IdCardApiError,
  fetchStaffIdCards,
  fetchStudentIdCards,
  type IdCardBranding,
  type IdCardRow,
} from '@/lib/id-card-api';
import { downloadSingleIdCardPdf } from '@/lib/id-card-pdf';

/* ═══════════════════════════════════════════════════════════════════════════
   ONE CARD, ANYWHERE

   The same card, opened from wherever someone happens to be looking at a
   person — the students register, the staff register, the ID-cards workbench.
   It renders `IdCardPreview` (which is the print, scaled) and downloads
   through `downloadSingleIdCardPdf`, so a card viewed here, printed from the
   office and saved by a parent are the identical artifact.

   It fetches its own row rather than taking one as a prop, because the pages
   that open it (the student register, say) hold a student record, not a card —
   and a card is derived from the roster on demand, never stored.
   ═══════════════════════════════════════════════════════════════════════════ */

type Subject =
  | { type: 'student'; id: number; name?: string }
  | { type: 'staff'; id: number; name?: string };

export function IdCardDialog({
  subject,
  open,
  onOpenChange,
}: {
  /** Null closes the dialog and clears what it holds. */
  subject: Subject | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [row, setRow] = React.useState<IdCardRow | null>(null);
  const [school, setSchool] = React.useState<IdCardBranding | null>(null);
  const [state, setState] = React.useState<
    'idle' | 'loading' | 'ready' | 'off' | 'error'
  >('idle');
  const [message, setMessage] = React.useState('');
  const [saving, setSaving] = React.useState(false);

  // Which subject the state below belongs to. Switching person clears the old
  // card during render, so the dialog never shows the previous student's face
  // for a frame while the new one is in flight.
  const key = subject ? `${subject.type}:${subject.id}` : null;
  const [loadedFor, setLoadedFor] = React.useState<string | null>(null);
  if (open && key && loadedFor !== key) {
    setLoadedFor(key);
    setRow(null);
    setState('loading');
  }

  React.useEffect(() => {
    if (!open || !subject) return;

    let cancelled = false;

    const request =
      subject.type === 'student'
        ? fetchStudentIdCards({ studentId: subject.id, limit: 1 })
        : fetchStaffIdCards({ staffId: subject.id, limit: 1 });

    request
      .then((batch) => {
        if (cancelled) return;
        const card = batch.rows[0];
        if (!card) {
          // The batch endpoints skip deactivated people on purpose — printing
          // a card for someone who has left is never wanted.
          setMessage(
            'No ID card for this person. They may have been deactivated.',
          );
          setState('error');
          return;
        }
        setRow(card);
        setSchool(batch.school);
        setState('ready');
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        if (e instanceof IdCardApiError && e.featureDisabled) {
          setState('off');
          return;
        }
        setMessage(
          e instanceof Error ? e.message : 'Could not load the ID card.',
        );
        setState('error');
      });

    return () => {
      cancelled = true;
    };
  }, [open, subject]);

  const download = async () => {
    if (!row || !school) return;
    setSaving(true);
    try {
      await downloadSingleIdCardPdf(row, school);
    } catch {
      toast.error('Could not build the PDF. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-lg">
        <div className="flex items-start gap-3">
          <span className="bg-brand-tint text-brand-deep grid size-9 shrink-0 place-items-center rounded-lg">
            <IdCard className="size-4.5" aria-hidden />
          </span>
          <div className="min-w-0">
            <DialogTitle className="text-[16px] font-semibold">
              {row?.name ?? subject?.name ?? 'ID card'}
            </DialogTitle>
            <DialogDescription className="text-ink-muted mt-0.5 text-[12.5px]">
              The card exactly as it prints — 85.6 × 54 mm, front and back.
            </DialogDescription>
          </div>
        </div>

        {state === 'loading' ? (
          <div className="skeleton mx-auto aspect-[85.6/54] w-full max-w-105 rounded-lg" />
        ) : null}

        {state === 'off' ? (
          <div className="border-line bg-surface-secondary rounded-xl border p-4">
            <p className="text-ink text-[13.5px] font-semibold">
              ID cards are not part of this school&apos;s plan yet
            </p>
            <p className="text-ink-muted mt-1 text-[12.5px]">
              Ask your administrator to enable the ID cards module.
            </p>
          </div>
        ) : null}

        {state === 'error' ? (
          <div className="border-accent-danger-edge bg-accent-danger-tint flex gap-2.5 rounded-xl border p-4">
            <TriangleAlert
              className="text-accent-danger-deep mt-0.5 size-4 shrink-0"
              aria-hidden
            />
            <p className="text-accent-danger-deep text-[13px] font-medium">
              {message}
            </p>
          </div>
        ) : null}

        {state === 'ready' && row && school ? (
          <>
            <IdCardPreview row={row} school={school} />
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={download}
                disabled={saving}
                className="bg-brand text-brand-contrast shadow-soft hover:bg-brand-deep hover:shadow-brand inline-flex h-10 cursor-pointer items-center gap-2 rounded-md px-4 text-[13.5px] font-semibold transition-all disabled:opacity-50"
              >
                {saving ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                ) : (
                  <Download className="size-4" aria-hidden />
                )}
                Download PDF
              </button>
              <span className="text-ink-muted text-[12px]">
                Front and back side by side on one A4 sheet.
              </span>
            </div>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

export default IdCardDialog;
