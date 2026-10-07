'use client';

import * as React from 'react';
import toast from 'react-hot-toast';
import { useTranslations } from 'next-intl';
import { Ban, Download, IdCard, ShieldCheck } from 'lucide-react';

import FeatureNotAvailableNotice from '@/components/parent/FeatureNotAvailableNotice';
import IdCardPreview from '@/components/id-cards/IdCardPreview';
import {
  IdCardApiError,
  fetchParentStudentIdCard,
  isIdCardRevoked,
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
  const t = useTranslations('parent.idCard');
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
          e instanceof Error ? e.message : t('loadFailed'),
        );
        setState('error');
      });

    return () => {
      cancelled = true;
    };
  }, [studentId, t]);

  const download = async () => {
    if (!card || !school) return;
    setSaving(true);
    try {
      const { droppedImages } = await downloadSingleIdCardPdf(card, school);
      // Say so out loud. On a phone the file lands in Downloads with no
      // visible sign, and a silent success is indistinguishable from a dead
      // button — which is exactly how this was reported.
      toast.success(t('saved'));
      if (droppedImages) {
        toast(t('photoDropped'), {
          icon: '⚠️',
          duration: 6000,
        });
      }
    } catch {
      toast.error(t('pdfFailed'));
    } finally {
      setSaving(false);
    }
  };

  if (state === 'off') {
    return (
      <FeatureNotAvailableNotice
        title={t("title")}
        description={t("featureDescription")}
      />
    );
  }

  if (state === 'loading') {
    return (
      <div className="rounded-xl border border-line bg-surface p-4">
        <div className="skeleton mx-auto aspect-[85.6/54] w-full max-w-105 rounded-lg" />
      </div>
    );
  }

  if (state === 'error' || !card || !school) {
    return (
      <div className="rounded-xl border border-accent-danger-edge bg-accent-danger-tint p-4">
        <p className="text-[13.5px] font-medium text-accent-danger-deep">
          {message || t('loadFailed')}
        </p>
        <p className="mt-1 text-[12.5px] text-ink-muted">
          {t('loadFailedHint')}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="diary-band">
        <span className="eyebrow">{t("title")}</span>
      </div>

      <IdCardPreview row={card} school={school} />

      {/* The parent is the person most likely to be caught out by a revoked
          card — they are not in the office when it happens, and the first they
          would otherwise know is their child being turned away at the gate. */}
      {isIdCardRevoked(card) && (
        <div className="rounded-xl border border-accent-danger-edge bg-accent-danger-tint p-4">
          <div className="flex gap-2.5">
            <Ban
              className="mt-0.5 size-4 shrink-0 text-accent-danger-deep"
              aria-hidden
            />
            <div className="text-[12.5px] leading-relaxed text-ink-muted">
              <p className="text-[13.5px] font-semibold text-accent-danger-deep">
                {t('revokedTitle')}
              </p>
              <p className="mt-1">
                {card.revokedReason
                  ? `${t('revokedReason', { reason: card.revokedReason })} `
                  : ''}
                {t('revokedBody')}
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={download}
          disabled={saving || isIdCardRevoked(card)}
          className="inline-flex h-11 cursor-pointer items-center gap-2 rounded-md bg-brand px-4 text-[14px] font-semibold text-brand-contrast shadow-soft transition-all hover:bg-brand-deep hover:shadow-brand disabled:opacity-50"
        >
          {saving ? (
            <span className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
          ) : (
            <Download className="size-4" aria-hidden />
          )}
          {t('savePdf')}
        </button>
        <span className="text-[12px] text-ink-muted">
          {t('savePdfHint')}
        </span>
      </div>

      <div className="rounded-xl border border-line bg-surface-secondary p-4">
        <div className="flex gap-2.5">
          <ShieldCheck className="mt-0.5 size-4 shrink-0 text-accent-success" aria-hidden />
          <div className="text-[12.5px] leading-relaxed text-ink-muted">
            <p className="font-semibold text-ink">{t("qrTitle")}</p>
            <p className="mt-1">
              {t('qrBody')}
            </p>
          </div>
        </div>
      </div>

      <p className="flex items-center gap-1.5 text-[12px] text-ink-faint">
        <IdCard className="size-3.5" aria-hidden />
        {t('printedNote')}
      </p>
    </div>
  );
}

export default IdCardSection;
