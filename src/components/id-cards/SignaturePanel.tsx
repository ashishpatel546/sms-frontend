'use client';

import * as React from 'react';
import toast from 'react-hot-toast';
import { useTranslations } from 'next-intl';
import { PenLine, RefreshCw, Trash2, Upload } from 'lucide-react';

import { Panel, PanelBody, PanelHeader } from '@/components/ui/Panel';
import { Button } from '@/components/ui/button';
import {
  clearSchoolSignatureCache,
  getSchoolSignature,
  removeSchoolSignature,
  uploadSchoolSignature,
  type IdCardBranding,
} from '@/lib/id-card-api';

/* ═══════════════════════════════════════════════════════════════════════════
   THE AUTHORISED SIGNATORY

   The back of every card carries a signature rule. Without this, a school
   signs each printed card by hand — fine for one reprint, impossible for a
   class of fifty.

   WHY IT LIVES ON THE ID CARDS PAGE, not in Settings: this is the only place
   its effect is visible. Upload a signature here and the preview two panels
   over redraws with it, which is the whole confirmation an office needs.
   Buried under Settings it would be a form whose result you have to go
   somewhere else to check.

   CACHING. The image is embedded in every card of a print run, so it is
   fetched once per tab and held, keyed on the school's `signatureUpdatedAt`.
   Re-uploading changes that key, so the cache corrects itself. "Refresh" is
   for the case the key cannot see: another admin replaced the signature while
   this tab was open, so this tab's branding still carries the old timestamp.
   ═══════════════════════════════════════════════════════════════════════════ */

const ACCEPT = 'image/png,image/jpeg';
const MAX_BYTES = 1024 * 1024;

export function SignaturePanel({
  school,
  onChanged,
}: {
  school: IdCardBranding;
  /** Re-fetch the batch so `signatureUpdatedAt` (the cache key) is current. */
  onChanged: () => void;
}) {
  const t = useTranslations('idCards.signature');
  const tc = useTranslations('common');
  const [busy, setBusy] = React.useState<'upload' | 'remove' | 'refresh' | null>(
    null,
  );
  const inputRef = React.useRef<HTMLInputElement | null>(null);
  const key = school.signatureUpdatedAt;

  // Stored with the key it was fetched for, so `preview` can be derived. A
  // school with no signature, or one whose signature was just removed, then
  // needs no effect to clear the image — the key simply stops matching.
  const [loaded, setLoaded] = React.useState<{
    key: string | null;
    url: string | null;
  }>({ key: null, url: null });

  // Bumped by "Refresh" so the fetch re-runs even when the timestamp is
  // unchanged — without it, clearing the cache would have no visible effect.
  const [reloads, setReloads] = React.useState(0);

  React.useEffect(() => {
    if (!key) return;
    let cancelled = false;
    void getSchoolSignature(school).then((url) => {
      if (!cancelled) setLoaded({ key, url });
    });
    return () => {
      cancelled = true;
    };
    // Keyed on the timestamp: `school` is a new object every revalidation.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, reloads]);

  const preview = loaded.key === key ? loaded.url : null;

  const onPick = async (file: File | undefined) => {
    if (!file) return;
    if (file.size > MAX_BYTES) {
      toast.error(t('tooLarge'));
      return;
    }
    setBusy('upload');
    try {
      await uploadSchoolSignature(file);
      toast.success(t('saved'));
      onChanged();
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : t('uploadFailed'),
      );
    } finally {
      setBusy(null);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const onRemove = async () => {
    setBusy('remove');
    try {
      await removeSchoolSignature();
      // No need to clear `preview` — `onChanged()` refetches branding with a
      // null timestamp, and the derived preview follows.
      toast.success(t('removed'));
      onChanged();
    } catch {
      toast.error(t('removeFailed'));
    } finally {
      setBusy(null);
    }
  };

  const onRefresh = () => {
    setBusy('refresh');
    clearSchoolSignatureCache();
    onChanged(); // fresh branding, in case the timestamp moved
    setReloads((n) => n + 1); // and re-fetch even if it did not
    setTimeout(() => setBusy(null), 400);
  };

  return (
    <Panel className="mt-4">
      <PanelHeader
        title={t('title')}
        description={t('description')}
      />
      <PanelBody className="space-y-3">
        <div className="border-line bg-surface-inset flex h-20 items-end justify-center rounded-lg border px-4 pb-2">
          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={preview}
              alt={t('alt')}
              className="max-h-14 max-w-full object-contain"
            />
          ) : (
            <span className="text-ink-faint flex items-center gap-1.5 pb-3 text-[12px]">
              <PenLine className="size-3.5" aria-hidden />
              {t('none')}
            </span>
          )}
        </div>

        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT}
          className="hidden"
          onChange={(e) => void onPick(e.target.files?.[0])}
        />

        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => inputRef.current?.click()}
            disabled={busy !== null}
          >
            <Upload className="size-3.5" aria-hidden />
            {preview ? t('replace') : t('upload')}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={onRefresh}
            disabled={busy !== null}
            title={t('refreshTitle')}
          >
            <RefreshCw
              className={busy === 'refresh' ? 'size-3.5 animate-spin' : 'size-3.5'}
              aria-hidden
            />
            {tc('action.refresh')}
          </Button>
          {preview && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => void onRemove()}
              disabled={busy !== null}
              className="text-accent-danger-deep"
            >
              <Trash2 className="size-3.5" aria-hidden />
              {tc('action.remove')}
            </Button>
          )}
        </div>

        <p className="text-ink-muted text-[11.5px] leading-relaxed">
          {t('hint')}
        </p>
      </PanelBody>
    </Panel>
  );
}

export default SignaturePanel;
