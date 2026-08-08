'use client';

import * as React from 'react';
import toast from 'react-hot-toast';
import { Download, IdCard, ShieldCheck } from 'lucide-react';

import FeatureNotAvailableNotice from '@/components/parent/FeatureNotAvailableNotice';
import IdCardPreview from '@/components/id-cards/IdCardPreview';
import {
  IdCardApiError,
  fetchParentStudentIdCard,
  type IdCardBranding,
  type IdCardRow,
} from '@/lib/id-card-api';
import { downloadSingleIdCardPdf } from '@/lib/id-card-pdf';

/**
 * A parent looking at their child's school ID.
 *
 * The same card component the office prints from, so what a parent sees here
 * is what is on the lanyard — that is the whole value of showing it. The
 * download exists for the one situation that actually happens: the card is
 * lost on a Tuesday and the office reprints on Friday.
 */
export function IdCardSection({ studentId }: { studentId: string | number }) {
  const [card, setCard] = React.useState<IdCardRow | null>(null);
  const [school, setSchool] = React.useState<IdCardBranding | null>(null);
  const [state, setState] = React.useState<'loading' | 'ready' | 'off' | 'error'>(
    'loading',
  );
  const [message, setMessage] = React.useState('');
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    setState('loading');

    fetchParentStudentIdCard(studentId)
      .then((result) => {
        if (cancelled) return;
        setCard(result.card);
        setSchool(result.school);
        setState('ready');
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        if (e instanceof IdCardApiError && e.featureDisabled) {
          setState('off');
          return;
        }
        setMessage(
          e instanceof Error ? e.message : 'We could not load the ID card just now.',
        );
        setState('error');
      });

    return () => {
      cancelled = true;
    };
  }, [studentId]);

  const download = async () => {
    if (!card || !school) return;
    setSaving(true);
    try {
      await downloadSingleIdCardPdf(card, school);
    } catch {
      toast.error('Could not build the PDF. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  if (state === 'off') {
    return (
      <FeatureNotAvailableNotice
        title="School ID card"
        description="You would be able to see and save your child's identity card here."
      />
    );
  }

  if (state === 'loading') {
    return (
      <div className="rounded-xl border border-line bg-surface p-4">
        <div className="skeleton mx-auto aspect-[85.6/54] w-full max-w-[420px] rounded-lg" />
      </div>
    );
  }

  if (state === 'error' || !card || !school) {
    return (
      <div className="rounded-xl border border-accent-danger-edge bg-accent-danger-tint p-4">
        <p className="text-[13.5px] font-medium text-accent-danger-deep">
          {message || 'We could not load the ID card just now.'}
        </p>
        <p className="mt-1 text-[12.5px] text-ink-muted">
          Pull down to refresh, or try again in a moment.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="diary-band">
        <span className="eyebrow">School ID card</span>
      </div>

      <IdCardPreview row={card} school={school} />

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={download}
          disabled={saving}
          className="inline-flex h-11 cursor-pointer items-center gap-2 rounded-md bg-brand px-4 text-[14px] font-semibold text-brand-contrast shadow-soft transition-all hover:bg-brand-deep hover:shadow-brand disabled:opacity-50"
        >
          {saving ? (
            <span className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
          ) : (
            <Download className="size-4" aria-hidden />
          )}
          Save as PDF
        </button>
        <span className="text-[12px] text-ink-muted">
          Front and back on one A4 page.
        </span>
      </div>

      <div className="rounded-xl border border-line bg-surface-secondary p-4">
        <div className="flex gap-2.5">
          <ShieldCheck className="mt-0.5 size-4 shrink-0 text-accent-success" aria-hidden />
          <div className="text-[12.5px] leading-relaxed text-ink-muted">
            <p className="font-semibold text-ink">The QR is checked live at the gate</p>
            <p className="mt-1">
              It carries no personal details — the school looks your child up
              when it is scanned. A lost card cannot be used by anyone else once
              the office deactivates it, so tell them straight away.
            </p>
          </div>
        </div>
      </div>

      <p className="flex items-center gap-1.5 text-[12px] text-ink-faint">
        <IdCard className="size-3.5" aria-hidden />
        The printed card comes from the school office. This copy is for your
        records.
      </p>
    </div>
  );
}

export default IdCardSection;
