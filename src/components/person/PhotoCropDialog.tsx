'use client';

import * as React from 'react';
import { createPortal } from 'react-dom';
import Cropper, { type Area } from 'react-easy-crop';
import { Loader2, RotateCcw, RotateCw, X, ZoomIn, ZoomOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  PHOTO_ASPECT,
  formatBytes,
  loadImageFromFile,
  preparePhoto,
  type PreparedPhoto,
} from './photo-pipeline';

/* ═══════════════════════════════════════════════════════════════════════════
   THE LIGHT TABLE

   The one place outside the navigation rail where the register's dark cover
   shows up. It earns it: cropping is the only task in this app where the
   screen has exactly one subject, and dropping the surroundings to walnut is
   what puts the face under the lamp.

   Sized for a thumb first. The stage takes the width it can get, the controls
   sit at the bottom where a hand already is, and every target clears 44px.
   ═══════════════════════════════════════════════════════════════════════════ */

const MIN_ZOOM = 1;
const MAX_ZOOM = 4;

interface PhotoCropDialogProps {
  file: File;
  /** Names the slot being filled — "Student photo", "Father's photo". */
  title: string;
  onCancel: () => void;
  /** Receives the encoded pair. The dialog stays up until this resolves. */
  onConfirm: (prepared: PreparedPhoto) => void | Promise<void>;
  confirmLabel?: string;
}

export function PhotoCropDialog({
  file,
  title,
  onCancel,
  onConfirm,
  confirmLabel = 'Use this photo',
}: PhotoCropDialogProps) {
  const [image, setImage] = React.useState<HTMLImageElement | null>(null);
  const [source, setSource] = React.useState<string | null>(null);
  const [loadError, setLoadError] = React.useState<string | null>(null);

  const [crop, setCrop] = React.useState({ x: 0, y: 0 });
  const [zoom, setZoom] = React.useState(1);
  const [rotation, setRotation] = React.useState(0);
  const [area, setArea] = React.useState<Area | null>(null);

  const [saving, setSaving] = React.useState(false);
  const [saveError, setSaveError] = React.useState<string | null>(null);

  /* Decode the picked file once. The object URL lives as long as the dialog. */
  React.useEffect(() => {
    let cancelled = false;
    let url: string | null = null;

    loadImageFromFile(file)
      .then(({ image: img, objectUrl }) => {
        url = objectUrl;
        if (cancelled) {
          URL.revokeObjectURL(objectUrl);
          return;
        }
        setImage(img);
        setSource(objectUrl);
      })
      .catch((err: Error) => {
        if (!cancelled) setLoadError(err.message);
      });

    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [file]);

  /* Escape closes; the page behind must not scroll while the stage is open. */
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !saving) onCancel();
    };
    document.addEventListener('keydown', onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previous;
    };
  }, [onCancel, saving]);

  const handleConfirm = async () => {
    if (!image || !area || saving) return;
    setSaving(true);
    setSaveError(null);
    try {
      const prepared = await preparePhoto(image, area, rotation);
      await onConfirm(prepared);
    } catch (err) {
      setSaveError(
        err instanceof Error ? err.message : 'That photo could not be prepared.',
      );
      setSaving(false);
    }
  };

  // Only ever reached after a click, so the server never renders it — no
  // mounted flag, and no hydration mismatch to guard against.
  if (typeof document === 'undefined') return null;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Crop ${title.toLowerCase()}`}
      className="fixed inset-0 z-70 flex items-stretch justify-center bg-walnut-950/70 backdrop-blur-sm sm:items-center sm:p-4"
    >
      <div
        className={cn(
          'flex w-full flex-col overflow-hidden bg-walnut-900 text-white shadow-raised',
          'sm:max-w-lg sm:rounded-xl sm:border sm:border-white/10',
        )}
      >
        {/* ── Header ── */}
        <div className="flex items-center gap-3 border-b border-white/10 px-4 py-3">
          <div className="min-w-0">
            <h2 className="font-display text-[15px] leading-tight font-semibold">
              {title}
            </h2>
            <p className="mt-0.5 text-[11.5px] text-white/55">
              Drag to position · pinch or use the slider to zoom
            </p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            disabled={saving}
            aria-label="Close without saving"
            className="ml-auto grid size-9 shrink-0 cursor-pointer place-items-center rounded-md text-white/60 transition-colors hover:bg-white/10 hover:text-white disabled:opacity-40"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* ── Stage ── */}
        <div className="relative flex-1 bg-walnut-950 sm:h-[58vh] sm:flex-none">
          {loadError ? (
            <div className="flex h-full min-h-64 items-center justify-center px-6 text-center text-[13.5px] text-white/70">
              {loadError}
            </div>
          ) : !source ? (
            <div className="flex h-full min-h-64 items-center justify-center">
              <Loader2 className="size-5 animate-spin text-white/50" />
            </div>
          ) : (
            <>
              <Cropper
                image={source}
                crop={crop}
                zoom={zoom}
                rotation={rotation}
                aspect={PHOTO_ASPECT}
                minZoom={MIN_ZOOM}
                maxZoom={MAX_ZOOM}
                showGrid
                restrictPosition
                objectFit="contain"
                onCropChange={setCrop}
                onZoomChange={setZoom}
                onRotationChange={setRotation}
                onCropComplete={(_, pixels) => setArea(pixels)}
              />
              <span className="pointer-events-none absolute bottom-2 left-1/2 -translate-x-1/2 rounded-full bg-walnut-950/80 px-2.5 py-1 font-mono text-[10px] tracking-widest text-white/60 uppercase">
                3:4 · ID card ratio
              </span>
            </>
          )}
        </div>

        {/* ── Controls ── */}
        <div className="space-y-3 border-t border-white/10 px-4 py-3">
          <div className="flex items-center gap-3">
            <ZoomOut aria-hidden className="size-4 shrink-0 text-white/45" />
            <input
              type="range"
              min={MIN_ZOOM}
              max={MAX_ZOOM}
              step={0.01}
              value={zoom}
              onChange={(e) => setZoom(Number(e.target.value))}
              aria-label="Zoom"
              disabled={!source || saving}
              className="h-11 min-w-0 flex-1 cursor-pointer accent-brass-300 disabled:opacity-40"
            />
            <ZoomIn aria-hidden className="size-4 shrink-0 text-white/45" />
            <div className="flex shrink-0 items-center gap-1.5">
              <button
                type="button"
                onClick={() => setRotation((r) => (r - 90 + 360) % 360)}
                disabled={!source || saving}
                aria-label="Rotate left"
                title="Rotate left"
                className="grid size-11 cursor-pointer place-items-center rounded-md border border-white/12 bg-white/8 text-white/80 transition-colors hover:bg-white/16 hover:text-white disabled:opacity-40"
              >
                <RotateCcw className="size-4" />
              </button>
              <button
                type="button"
                onClick={() => setRotation((r) => (r + 90) % 360)}
                disabled={!source || saving}
                aria-label="Rotate right"
                title="Rotate right"
                className="grid size-11 cursor-pointer place-items-center rounded-md border border-white/12 bg-white/8 text-white/80 transition-colors hover:bg-white/16 hover:text-white disabled:opacity-40"
              >
                <RotateCw className="size-4" />
              </button>
            </div>
          </div>

          <p className="text-[11.5px] text-white/45">
            Saved at 1200px in WebP, with a matching thumbnail. Original:{' '}
            {formatBytes(file.size)}.
          </p>

          {saveError && (
            <p className="rounded-md bg-vermilion-500/15 px-3 py-2 text-[12.5px] text-vermilion-200">
              {saveError}
            </p>
          )}

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="onInk"
              block
              className="sm:w-auto"
              onClick={onCancel}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button
              type="button"
              block
              className="sm:w-auto"
              onClick={handleConfirm}
              disabled={!area || saving || !!loadError}
            >
              {saving && <Loader2 className="animate-spin" />}
              {saving ? 'Saving…' : confirmLabel}
            </Button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
