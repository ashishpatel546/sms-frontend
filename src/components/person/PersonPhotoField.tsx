'use client';

import * as React from 'react';
import { createPortal } from 'react-dom';
import toast from 'react-hot-toast';
import { useTranslations } from 'next-intl';
import {
  Camera,
  ImagePlus,
  Loader2,
  Maximize2,
  Trash2,
  User,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  deletePersonPhoto,
  getPersonPhotoUrl,
  uploadPersonPhoto,
  type PhotoKind,
} from '@/lib/person-documents-api';
import { PhotoCropDialog } from './PhotoCropDialog';
import { formatBytes, isImageFile, type PreparedPhoto } from './photo-pipeline';

/* ═══════════════════════════════════════════════════════════════════════════
   THE PHOTO PLATE

   One component behind every photo in the app — student, father, mother,
   guardian, staff member. A 3:4 portrait frame with album corner mounts, the
   controls under it, and nothing else.

   It works in two modes, because a photo has to be capturable on the form
   that creates the person as well as the one that edits them:

     live    `userId` is known → uploads immediately
     staged  `userId` is null → holds the encoded pair in memory and hands it
             to the parent, which uploads it once the record has an id

   Reads always ask for the THUMBNAIL (≈12 KB) and swap to the full image in
   `onError`, which covers photos uploaded before thumbnails existed. The full
   image is only ever fetched when someone asks to see it full size.
   ═══════════════════════════════════════════════════════════════════════════ */

export type StagedPhoto = PreparedPhoto;

interface PersonPhotoFieldProps {
  kind: PhotoKind;
  /** Names the slot — "Student photo", "Father's photo". */
  label: string;
  /** One line of context. Not a repeat of the label. */
  hint?: string;
  /** The person's USER id. Null puts the field in staged mode. */
  userId?: number | null;
  /** Seeded from the record's `*PhotoS3Key`, so no request is made for an empty slot. */
  initialHasPhoto?: boolean;
  /** Staged mode only — the photo held for upload after the record is created. */
  staged?: StagedPhoto | null;
  onStagedChange?: (photo: StagedPhoto | null) => void;
  /** Live mode — fired after a successful upload or delete. */
  onChanged?: () => void;
  disabled?: boolean;
  /** Why the controls are disabled, shown as the tooltip. */
  disabledReason?: string;
  /** Show the plate alone — no controls at all. For profile pages. */
  readOnly?: boolean;
  className?: string;
}

export function PersonPhotoField({
  kind,
  label,
  hint,
  userId = null,
  initialHasPhoto = false,
  staged = null,
  onStagedChange,
  onChanged,
  disabled = false,
  disabledReason,
  readOnly = false,
  className,
}: PersonPhotoFieldProps) {
  const t = useTranslations('students.photo');
  const staging = userId === null || userId === undefined;

  const [thumbUrl, setThumbUrl] = React.useState<string | null>(null);
  const [fallbackUrl, setFallbackUrl] = React.useState<string | null>(null);
  /** Set once the first read has come back, whatever it found. */
  const [resolved, setResolved] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [pickedFile, setPickedFile] = React.useState<File | null>(null);
  const [zoomUrl, setZoomUrl] = React.useState<string | null>(null);

  // Derived rather than a state flag: the record says a photo exists, so the
  // frame is loading until the signed URL arrives. Setting a flag here would
  // mean writing state synchronously inside an effect.
  const loading = !staging && initialHasPhoto && !resolved;

  const libraryInput = React.useRef<HTMLInputElement>(null);
  const cameraInput = React.useRef<HTMLInputElement>(null);

  const loadThumb = React.useCallback(async () => {
    if (staging || userId === null) return;
    try {
      const result = await getPersonPhotoUrl(userId, kind, 'thumb');
      setThumbUrl(result?.url ?? null);
      setFallbackUrl(result?.fullUrl ?? null);
    } catch {
      setThumbUrl(null);
      setFallbackUrl(null);
    } finally {
      setResolved(true);
    }
  }, [kind, staging, userId]);

  React.useEffect(() => {
    if (staging || !initialHasPhoto) return;
    void loadThumb();
  }, [initialHasPhoto, loadThumb, staging]);

  const preview = staged?.previewUrl ?? thumbUrl;
  const hasPhoto = Boolean(preview);

  const pick = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    // Reset so picking the same file twice still fires a change event.
    event.target.value = '';
    if (!file) return;
    if (!isImageFile(file)) {
      toast.error(t('notImage'));
      return;
    }
    // Deliberately no size check: the crop step downsizes whatever comes in.
    setPickedFile(file);
  };

  const handleCropped = async (prepared: PreparedPhoto) => {
    if (staging) {
      if (staged?.previewUrl) URL.revokeObjectURL(staged.previewUrl);
      onStagedChange?.(prepared);
      setPickedFile(null);
      toast.success(t('ready', { size: formatBytes(prepared.fullBytes) }));
      return;
    }

    if (userId === null) return;
    setBusy(true);
    try {
      await uploadPersonPhoto(userId, kind, prepared.full, prepared.thumb);
      setPickedFile(null);
      await loadThumb();
      onChanged?.();
      toast.success(t('saved', { label, size: formatBytes(prepared.fullBytes) }));
    } catch (err) {
      toast.error((err instanceof Error && err.message) || t('saveFailed'));
      throw err;
    } finally {
      setBusy(false);
      URL.revokeObjectURL(prepared.previewUrl);
    }
  };

  const handleRemove = async () => {
    if (staging) {
      if (staged?.previewUrl) URL.revokeObjectURL(staged.previewUrl);
      onStagedChange?.(null);
      return;
    }
    if (userId === null) return;
    setBusy(true);
    try {
      await deletePersonPhoto(userId, kind);
      setThumbUrl(null);
      setFallbackUrl(null);
      onChanged?.();
      toast.success(t('removed', { label }));
    } catch (err) {
      toast.error((err instanceof Error && err.message) || t('removeFailed'));
    } finally {
      setBusy(false);
    }
  };

  /** The zoom view is the only place the full-size image is ever fetched. */
  const handleZoom = async () => {
    if (staged) {
      setZoomUrl(URL.createObjectURL(staged.full));
      return;
    }
    if (userId === null) return;
    setBusy(true);
    try {
      const result = await getPersonPhotoUrl(userId, kind, 'full');
      if (result) setZoomUrl(result.url);
    } catch {
      toast.error(t('openFailed'));
    } finally {
      setBusy(false);
    }
  };

  const controlTitle = disabled ? disabledReason : undefined;

  return (
    <div className={cn('min-w-0', className)}>
      <div className="eyebrow mb-1.5">{label}</div>

      {/* ── The plate ── */}
      <div
        className={cn(
          'relative aspect-3/4 w-full overflow-hidden rounded-lg border bg-surface-inset transition-colors',
          hasPhoto ? 'border-line-strong' : 'border-dashed border-line-strong',
        )}
      >
        {hasPhoto && preview ? (
          <>
            {/* A signed S3 URL that expires, or a blob: URL from the crop step.
                next/image would proxy and cache both, which is exactly wrong
                for private, short-lived links. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={preview}
              alt={label}
              loading="lazy"
              decoding="async"
              className="size-full object-cover"
              onError={(e) => {
                // The thumbnail may not exist for photos uploaded before
                // client-side thumbnails — fall back to the full image once.
                const img = e.currentTarget;
                if (fallbackUrl && img.src !== fallbackUrl) img.src = fallbackUrl;
              }}
            />
            {/* Album corner mounts — the photo is held in place, not printed on. */}
            <span
              aria-hidden
              className="pointer-events-none absolute top-1.5 left-1.5 size-3.5 border-t-2 border-l-2 border-brass-300/80"
            />
            <span
              aria-hidden
              className="pointer-events-none absolute right-1.5 bottom-1.5 size-3.5 border-r-2 border-b-2 border-brass-300/80"
            />
            <button
              type="button"
              onClick={handleZoom}
              aria-label={t('viewFullFor', { label: label.toLowerCase() })}
              title={t('viewFull')}
              className="absolute top-1.5 right-1.5 grid size-8 cursor-pointer place-items-center rounded-md bg-walnut-950/55 text-white/85 backdrop-blur-xs transition-colors hover:bg-walnut-950/80 hover:text-white"
            >
              <Maximize2 className="size-3.5" />
            </button>
          </>
        ) : (
          <div className="flex size-full flex-col items-center justify-center gap-1.5 px-2 text-center">
            {loading ? (
              <Loader2 className="size-5 animate-spin text-ink-faint" />
            ) : (
              <>
                <User aria-hidden className="size-6 text-ink-faint" />
                <span className="text-[11.5px] text-ink-faint">{t('none')}</span>
              </>
            )}
          </div>
        )}

        {busy && (
          <div className="absolute inset-0 grid place-items-center bg-surface/70 backdrop-blur-xs">
            <Loader2 className="size-5 animate-spin text-brand" />
          </div>
        )}
      </div>

      {/* ── Controls ── */}
      <div className={cn('mt-2 flex flex-wrap gap-1.5', readOnly && 'hidden')}>
        <button
          type="button"
          onClick={() => libraryInput.current?.click()}
          disabled={disabled || busy}
          title={controlTitle}
          className="inline-flex h-9 flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-md border border-line-strong bg-surface px-2.5 text-[12.5px] font-semibold text-ink transition-colors hover:border-brand hover:bg-brand-tint hover:text-brand disabled:cursor-not-allowed disabled:opacity-50"
        >
          <ImagePlus className="size-3.5" />
          {hasPhoto ? t('replace') : t('add')}
        </button>

        {/* Camera is offered separately only where there is one worth offering. */}
        <button
          type="button"
          onClick={() => cameraInput.current?.click()}
          disabled={disabled || busy}
          title={controlTitle ?? t('takePhoto')}
          aria-label={t('takePhoto')}
          className="inline-flex size-9 cursor-pointer items-center justify-center rounded-md border border-line-strong bg-surface text-ink-muted transition-colors hover:border-brand hover:bg-brand-tint hover:text-brand disabled:cursor-not-allowed disabled:opacity-50 sm:hidden"
        >
          <Camera className="size-3.5" />
        </button>

        {hasPhoto && (
          <button
            type="button"
            onClick={handleRemove}
            disabled={disabled || busy}
            title={controlTitle ?? t('removeFor', { label: label.toLowerCase() })}
            aria-label={t('removeFor', { label: label.toLowerCase() })}
            className="inline-flex size-9 cursor-pointer items-center justify-center rounded-md border border-accent-danger-edge bg-accent-danger-tint text-accent-danger-deep transition-colors hover:border-accent-danger hover:bg-accent-danger hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Trash2 className="size-3.5" />
          </button>
        )}
      </div>

      {hint && <p className="mt-1.5 text-[11.5px] text-ink-muted">{hint}</p>}
      {staged && (
        <p className="mt-1.5 text-[11.5px] text-accent-warn-deep">
          {t('stagedHint', { size: formatBytes(staged.fullBytes) })}
        </p>
      )}

      <input
        ref={libraryInput}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={pick}
      />
      <input
        ref={cameraInput}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={pick}
      />

      {pickedFile && (
        <PhotoCropDialog
          file={pickedFile}
          title={label}
          onCancel={() => setPickedFile(null)}
          onConfirm={handleCropped}
        />
      )}

      {zoomUrl && (
        <PhotoLightbox
          url={zoomUrl}
          alt={label}
          onClose={() => {
            if (zoomUrl.startsWith('blob:')) URL.revokeObjectURL(zoomUrl);
            setZoomUrl(null);
          }}
        />
      )}
    </div>
  );
}

/** Full-size view. Portalled so no panel's `overflow-hidden` can clip it. */
function PhotoLightbox({
  url,
  alt,
  onClose,
}: {
  url: string;
  alt: string;
  onClose: () => void;
}) {
  const tc = useTranslations('common');
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  // Opened by a click, so it never renders on the server.
  if (typeof document === 'undefined') return null;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={alt}
      onClick={onClose}
      className="fixed inset-0 z-70 flex items-center justify-center bg-walnut-950/80 p-4 backdrop-blur-sm"
    >
      <img
        src={url}
        alt={alt}
        className="max-h-full max-w-full rounded-lg object-contain shadow-raised"
        onClick={(e) => e.stopPropagation()}
      />
      <button
        type="button"
        onClick={onClose}
        aria-label={tc('action.close')}
        className="absolute top-4 right-4 grid size-11 cursor-pointer place-items-center rounded-md border border-white/12 bg-white/8 text-white transition-colors hover:bg-white/16"
      >
        <X className="size-4" />
      </button>
    </div>,
    document.body,
  );
}
