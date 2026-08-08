'use client';

import * as React from 'react';
import { ImageIcon } from 'lucide-react';
import { Panel, PanelBody, PanelHeader } from '@/components/ui/Panel';
import { hasPhotoFor, type PhotoKind } from '@/lib/person-documents-api';
import { PersonPhotoField, type StagedPhoto } from './PersonPhotoField';

/**
 * The photos block on a person's form. Students carry four slots, staff one.
 *
 * Optional by design — a record is never blocked on a photo. The section is
 * here because the ID-card sheet and the pickup screen both read these, and
 * the counter is the only moment the family is standing in front of you.
 */

export type StagedPhotos = Partial<Record<PhotoKind, StagedPhoto | null>>;

const DEFAULT_LABELS: Record<PhotoKind, string> = {
  self: 'Photo',
  father: "Father's photo",
  mother: "Mother's photo",
  guardian: "Guardian's photo",
};

interface PersonPhotosSectionProps {
  /** Which slots to show, in display order. */
  kinds: PhotoKind[];
  /** The person's USER id. Null stages the photos for upload after creation. */
  userId?: number | null;
  /** The student/staff record, read for `*PhotoS3Key` so empty slots skip a request. */
  record?: unknown;
  /** Overrides the label of the `self` slot — "Student photo", "Staff photo". */
  selfLabel?: string;
  staged?: StagedPhotos;
  onStagedChange?: (kind: PhotoKind, photo: StagedPhoto | null) => void;
  onChanged?: () => void;
  disabled?: boolean;
  disabledReason?: string;
  /**
   * Profile pages: show the plates and nothing else. Empty slots are dropped
   * and the whole section disappears when there is no photo at all — a row of
   * four "No photo" frames is not information.
   */
  readOnly?: boolean;
  title?: string;
  description?: string;
}

export function PersonPhotosSection({
  kinds,
  userId = null,
  record,
  selfLabel,
  staged,
  onStagedChange,
  onChanged,
  disabled = false,
  disabledReason,
  readOnly = false,
  title = 'Photos',
  description,
}: PersonPhotosSectionProps) {
  const labels: Record<PhotoKind, string> = {
    ...DEFAULT_LABELS,
    self: selfLabel ?? DEFAULT_LABELS.self,
  };

  const visible = readOnly
    ? kinds.filter((kind) => (record ? hasPhotoFor(record, kind) : false))
    : kinds;

  if (readOnly && visible.length === 0) return null;

  const defaultDescription = readOnly
    ? undefined
    : userId === null
      ? 'Cropped to the 3:4 ratio the ID cards print at. Uploads when you save the record.'
      : 'Cropped to the 3:4 ratio the ID cards print at. Large phone photos are resized here — no need to shrink them first.';

  return (
    <Panel>
      <PanelHeader
        title={
          <span className="inline-flex items-center gap-2">
            <ImageIcon aria-hidden className="size-4 text-ink-faint" />
            {title}
          </span>
        }
        description={description ?? defaultDescription}
      />
      <PanelBody>
        <div
          className={
            visible.length === 1
              ? 'max-w-40'
              : 'grid grid-cols-2 gap-4 sm:grid-cols-4 sm:gap-5'
          }
        >
          {visible.map((kind) => (
            <PersonPhotoField
              key={kind}
              kind={kind}
              label={labels[kind]}
              userId={userId}
              initialHasPhoto={record ? hasPhotoFor(record, kind) : false}
              staged={staged?.[kind] ?? null}
              onStagedChange={(photo) => onStagedChange?.(kind, photo)}
              onChanged={onChanged}
              disabled={disabled}
              disabledReason={disabledReason}
              readOnly={readOnly}
            />
          ))}
        </div>
      </PanelBody>
    </Panel>
  );
}
