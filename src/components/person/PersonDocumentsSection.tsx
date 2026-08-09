'use client';

import * as React from 'react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import {
  ExternalLink,
  FileText,
  Loader2,
  ListChecks,
  Paperclip,
  StickyNote,
  Trash2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Panel, PanelBody, PanelHeader } from '@/components/ui/Panel';
import { SegmentedControl } from '@/components/ui/FilterBar';
import { StatusChip } from '@/components/ui/StatusChip';
import { cn } from '@/lib/utils';
import {
  ACCEPTED_DOCUMENT_TYPES,
  DOCUMENT_STATUS_LABEL,
  DOCUMENT_TYPES,
  MAX_DOCUMENT_FILE_BYTES,
  OWNER_LABEL,
  attachPersonDocumentFile,
  deletePersonDocumentFile,
  getPersonDocumentFileUrl,
  listPersonDocuments,
  upsertPersonDocument,
  type PersonDocument,
  type PersonDocumentOwner,
  type PersonDocumentType,
} from '@/lib/person-documents-api';
import { formatBytes } from './photo-pipeline';

/* ═══════════════════════════════════════════════════════════════════════════
   THE DOCUMENT CHECKLIST

   What the office actually does: a list of papers, ticked off as they arrive.
   A tick means "we hold a copy" — usually a photocopy in a folder, sometimes a
   scan. Those are the same fact to a clerk, so the tick works with or without
   a file, and attaching a scan is a separate, optional step.

   Three states, and the middle one is the point:
     Not tracked  nobody has said this paper is expected
     Pending      expected, not handed over — this is what the trace lists
     Collected    the school holds it (a scan makes it "On file")
   ═══════════════════════════════════════════════════════════════════════════ */

/** A checklist row captured before the person exists. */
export interface StagedDocument {
  owner: PersonDocumentOwner;
  docType: PersonDocumentType;
  status: 'PENDING' | 'COLLECTED';
  notes?: string;
}

/** Writes rows captured on a create form, once the record has a user id. */
export async function persistStagedDocuments(
  userId: number,
  rows: StagedDocument[],
): Promise<void> {
  for (const row of rows) {
    await upsertPersonDocument({
      userId,
      owner: row.owner,
      docType: row.docType,
      status: row.status,
      notes: row.notes,
    });
  }
}

interface PersonDocumentsSectionProps {
  /** The person's USER id. Null holds the checklist in memory instead. */
  userId?: number | null;
  /** Which parties can own paperwork here. Staff get `['SELF']`. */
  owners?: PersonDocumentOwner[];
  /** Overrides the label of the SELF tab — "Student", "Staff member". */
  selfLabel?: string;
  staged?: StagedDocument[];
  onStagedChange?: (rows: StagedDocument[]) => void;
  disabled?: boolean;
  disabledReason?: string;
  /** Shows the "Open the trace" link in the header. */
  showTraceLink?: boolean;
}

export function PersonDocumentsSection({
  userId = null,
  owners = ['SELF'],
  selfLabel,
  staged = [],
  onStagedChange,
  disabled = false,
  disabledReason,
  showTraceLink = false,
}: PersonDocumentsSectionProps) {
  const staging = userId === null || userId === undefined;

  const [rows, setRows] = React.useState<PersonDocument[]>([]);
  const [loading, setLoading] = React.useState(!staging);
  const [owner, setOwner] = React.useState<PersonDocumentOwner>(owners[0] ?? 'SELF');
  const [pendingKey, setPendingKey] = React.useState<string | null>(null);
  const [openNote, setOpenNote] = React.useState<string | null>(null);
  const [noteDraft, setNoteDraft] = React.useState('');
  const [bulkBusy, setBulkBusy] = React.useState(false);

  const fileInput = React.useRef<HTMLInputElement>(null);
  const attachTarget = React.useRef<PersonDocumentType | null>(null);

  React.useEffect(() => {
    if (staging || userId === null) return;
    let cancelled = false;
    setLoading(true);
    listPersonDocuments(userId)
      .then((data) => {
        if (!cancelled) setRows(data);
      })
      .catch(() => {
        if (!cancelled) toast.error('The document checklist did not load.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [staging, userId]);

  /* ── Reading the current state of one row ───────────────────────────── */

  const liveRow = (docType: PersonDocumentType) =>
    rows.find((r) => r.owner === owner && r.docType === docType) ?? null;

  const stagedRow = (docType: PersonDocumentType) =>
    staged.find((r) => r.owner === owner && r.docType === docType) ?? null;

  const statusOf = (docType: PersonDocumentType) =>
    staging ? (stagedRow(docType)?.status ?? null) : (liveRow(docType)?.status ?? null);

  const notesOf = (docType: PersonDocumentType) =>
    staging ? (stagedRow(docType)?.notes ?? '') : (liveRow(docType)?.notes ?? '');

  const pendingCount = (o: PersonDocumentOwner) =>
    staging
      ? staged.filter((r) => r.owner === o && r.status === 'PENDING').length
      : rows.filter((r) => r.owner === o && r.status === 'PENDING').length;

  /* ── Writes ─────────────────────────────────────────────────────────── */

  const replaceRow = (updated: PersonDocument) =>
    setRows((prev) => {
      const index = prev.findIndex((r) => r.id === updated.id);
      if (index === -1) return [...prev, updated];
      const next = [...prev];
      next[index] = updated;
      return next;
    });

  const setStaged = (
    docType: PersonDocumentType,
    patch: Partial<StagedDocument> | null,
  ) => {
    const others = staged.filter((r) => !(r.owner === owner && r.docType === docType));
    if (patch === null) {
      onStagedChange?.(others);
      return;
    }
    const current = stagedRow(docType);
    onStagedChange?.([
      ...others,
      {
        owner,
        docType,
        status: patch.status ?? current?.status ?? 'PENDING',
        notes: patch.notes ?? current?.notes,
      },
    ]);
  };

  const toggleCollected = async (docType: PersonDocumentType, checked: boolean) => {
    const next: 'PENDING' | 'COLLECTED' = checked ? 'COLLECTED' : 'PENDING';

    if (staging) {
      setStaged(docType, { status: next });
      return;
    }
    if (userId === null) return;

    const existing = liveRow(docType);
    if (existing?.s3Key) {
      toast.error('Remove the attached file before changing this status.');
      return;
    }

    setPendingKey(docType);
    try {
      const saved = await upsertPersonDocument({
        userId,
        owner,
        docType,
        status: next,
      });
      replaceRow(saved);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'That change did not save.');
    } finally {
      setPendingKey(null);
    }
  };

  const saveNote = async (docType: PersonDocumentType, value: string) => {
    setOpenNote(null);
    if (value === notesOf(docType)) return;

    if (staging) {
      setStaged(docType, { notes: value });
      return;
    }
    if (userId === null) return;

    setPendingKey(docType);
    try {
      // No status in the payload: the server refuses status changes while a
      // file is attached, and a note is not a status change.
      const saved = await upsertPersonDocument({ userId, owner, docType, notes: value });
      replaceRow(saved);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'That note did not save.');
    } finally {
      setPendingKey(null);
    }
  };

  /** Creates PENDING rows for everything untracked, so the trace can see them. */
  const trackAllPending = async () => {
    if (userId === null) return;
    const missing = DOCUMENT_TYPES.filter((d) => !liveRow(d.value));
    if (missing.length === 0) return;

    setBulkBusy(true);
    try {
      const saved: PersonDocument[] = [];
      for (const doc of missing) {
        saved.push(
          await upsertPersonDocument({
            userId,
            owner,
            docType: doc.value,
            status: 'PENDING',
          }),
        );
      }
      setRows((prev) => [...prev, ...saved]);
      toast.success(`${missing.length} documents now listed as pending.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Those rows did not save.');
    } finally {
      setBulkBusy(false);
    }
  };

  const startAttach = (docType: PersonDocumentType) => {
    attachTarget.current = docType;
    fileInput.current?.click();
  };

  const handleFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    const docType = attachTarget.current;
    attachTarget.current = null;
    if (!file || !docType || userId === null) return;

    if (file.size > MAX_DOCUMENT_FILE_BYTES) {
      toast.error(
        `That file is ${formatBytes(file.size)}. Scans must be 5 MB or smaller.`,
      );
      return;
    }

    setPendingKey(docType);
    try {
      // The file endpoint needs a row id, so make sure the row exists first.
      let row = liveRow(docType);
      if (!row) {
        row = await upsertPersonDocument({ userId, owner, docType, status: 'PENDING' });
        setRows((prev) => [...prev, row!]);
      }
      const saved = await attachPersonDocumentFile(row.id, file);
      replaceRow(saved);
      toast.success('Scan attached.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'That file did not upload.');
    } finally {
      setPendingKey(null);
    }
  };

  const openFile = async (docType: PersonDocumentType) => {
    const row = liveRow(docType);
    if (!row) return;
    setPendingKey(docType);
    try {
      const { url } = await getPersonDocumentFileUrl(row.id);
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch {
      toast.error('That file could not be opened.');
    } finally {
      setPendingKey(null);
    }
  };

  const removeFile = async (docType: PersonDocumentType) => {
    const row = liveRow(docType);
    if (!row) return;
    setPendingKey(docType);
    try {
      const saved = await deletePersonDocumentFile(row.id);
      replaceRow(saved);
      toast.success('Scan removed. The document is still marked collected.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'That file was not removed.');
    } finally {
      setPendingKey(null);
    }
  };

  /* ── Render ─────────────────────────────────────────────────────────── */

  const untracked = staging
    ? 0
    : DOCUMENT_TYPES.filter((d) => !liveRow(d.value)).length;

  return (
    <Panel>
      <PanelHeader
        title={
          <span className="inline-flex items-center gap-2">
            <ListChecks aria-hidden className="size-4 text-ink-faint" />
            Documents
          </span>
        }
        description={
          staging
            ? 'Tick what the family has already handed over. Saved with the record; scans can be attached afterwards.'
            : 'Tick what the school holds. A tick works on its own — attach a scan only when there is one.'
        }
        action={
          showTraceLink && (
            <Button
              variant="ghost"
              size="sm"
              render={<Link href="/dashboard/documents" />}
            >
              Open the trace
              <ExternalLink />
            </Button>
          )
        }
      />

      {owners.length > 1 && (
        <div className="border-b border-line bg-surface-secondary px-4 py-2.5">
          <SegmentedControl
            value={owner}
            onValueChange={setOwner}
            size="sm"
            className="max-w-full overflow-x-auto"
            options={owners.map((o) => {
              const count = pendingCount(o);
              return {
                value: o,
                label: (
                  <span className="inline-flex items-center gap-1.5">
                    {o === 'SELF' ? (selfLabel ?? 'Own') : OWNER_LABEL[o]}
                    {count > 0 && (
                      <span className="tabular rounded-full bg-accent-warn-tint px-1.5 py-px text-[10px] font-semibold text-accent-warn-deep">
                        {count}
                      </span>
                    )}
                  </span>
                ),
              };
            })}
          />
        </div>
      )}

      {loading ? (
        <PanelBody>
          <div className="flex items-center gap-2 py-6 text-[13.5px] text-ink-muted">
            <Loader2 className="size-4 animate-spin" />
            Loading the checklist…
          </div>
        </PanelBody>
      ) : (
        <>
          <ul className="divide-y divide-line" role="list">
            {DOCUMENT_TYPES.map((doc) => {
              const status = statusOf(doc.value);
              const row = staging ? null : liveRow(doc.value);
              const notes = notesOf(doc.value);
              const busy = pendingKey === doc.value;
              const hasFile = Boolean(row?.s3Key);
              const checked = status === 'COLLECTED' || status === 'UPLOADED';
              const inputId = `doc-${owner}-${doc.value}`;

              return (
                <li key={doc.value} className="px-4 py-3">
                  <div className="flex items-start gap-3">
                    <input
                      id={inputId}
                      type="checkbox"
                      checked={checked}
                      disabled={disabled || busy || hasFile}
                      title={
                        hasFile
                          ? 'A scan is attached. Remove it to change this.'
                          : disabled
                            ? disabledReason
                            : undefined
                      }
                      onChange={(e) => void toggleCollected(doc.value, e.target.checked)}
                      className="mt-1 size-4.5 shrink-0 cursor-pointer rounded border-line-strong accent-brand disabled:cursor-not-allowed disabled:opacity-50"
                    />

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <label
                          htmlFor={inputId}
                          className="cursor-pointer text-[13.5px] font-semibold text-ink"
                        >
                          {doc.label}
                        </label>
                        {status ? (
                          <StatusChip
                            status={status}
                            label={DOCUMENT_STATUS_LABEL[status]}
                          />
                        ) : (
                          <StatusChip pigment="neutral" label="Not tracked" />
                        )}
                        {busy && (
                          <Loader2 className="size-3.5 animate-spin text-ink-faint" />
                        )}
                      </div>

                      {row?.fileName && (
                        <p className="mt-1 flex items-center gap-1.5 text-[12px] text-ink-muted">
                          <FileText aria-hidden className="size-3.5 shrink-0" />
                          <span className="truncate">{row.fileName}</span>
                        </p>
                      )}

                      {openNote === doc.value ? (
                        <textarea
                          autoFocus
                          rows={2}
                          value={noteDraft}
                          onChange={(e) => setNoteDraft(e.target.value)}
                          onBlur={() => void saveNote(doc.value, noteDraft.trim())}
                          placeholder="e.g. original returned to the parent on 12 Aug"
                          maxLength={2000}
                          className="mt-2 w-full rounded-md border border-line-strong bg-surface px-3 py-2 text-[13px] text-ink placeholder:text-ink-faint focus:border-brand focus:ring-3 focus:ring-brand/16 focus:outline-none"
                        />
                      ) : (
                        notes && (
                          <p className="mt-1 text-[12px] text-ink-muted italic">{notes}</p>
                        )
                      )}
                    </div>

                    <div className="flex shrink-0 items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          setNoteDraft(notes);
                          setOpenNote(openNote === doc.value ? null : doc.value);
                        }}
                        disabled={disabled || busy}
                        aria-label={notes ? 'Edit note' : 'Add a note'}
                        title={notes ? 'Edit note' : 'Add a note'}
                        className={cn(
                          'grid size-9 cursor-pointer place-items-center rounded-md border transition-colors disabled:cursor-not-allowed disabled:opacity-50',
                          notes
                            ? 'border-accent-info-edge bg-accent-info-tint text-accent-info-deep'
                            : 'border-line-strong bg-surface text-ink-muted hover:border-brand hover:text-brand',
                        )}
                      >
                        <StickyNote className="size-3.5" />
                      </button>

                      {staging ? null : hasFile ? (
                        <>
                          <button
                            type="button"
                            onClick={() => void openFile(doc.value)}
                            disabled={busy}
                            aria-label={`Open the ${doc.label.toLowerCase()} scan`}
                            title="Open the scan"
                            className="grid size-9 cursor-pointer place-items-center rounded-md border border-line-strong bg-surface text-ink-muted transition-colors hover:border-brand hover:text-brand disabled:opacity-50"
                          >
                            <ExternalLink className="size-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => void removeFile(doc.value)}
                            disabled={disabled || busy}
                            aria-label={`Remove the ${doc.label.toLowerCase()} scan`}
                            title="Remove the scan"
                            className="grid size-9 cursor-pointer place-items-center rounded-md border border-accent-danger-edge bg-accent-danger-tint text-accent-danger-deep transition-colors hover:border-accent-danger hover:bg-accent-danger hover:text-white disabled:opacity-50"
                          >
                            <Trash2 className="size-3.5" />
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          onClick={() => startAttach(doc.value)}
                          disabled={disabled || busy}
                          aria-label={`Attach a ${doc.label.toLowerCase()} scan`}
                          title="Attach a scan (PDF or image, up to 5 MB)"
                          className="grid size-9 cursor-pointer place-items-center rounded-md border border-line-strong bg-surface text-ink-muted transition-colors hover:border-brand hover:text-brand disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          <Paperclip className="size-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>

          {!staging && untracked > 0 && (
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-line bg-surface-secondary px-4 py-3">
              <p className="min-w-0 flex-1 text-[12.5px] text-ink-muted">
                {untracked} of these are not tracked yet, so they stay off the
                school-wide trace.
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => void trackAllPending()}
                disabled={disabled || bulkBusy}
                title={disabled ? disabledReason : undefined}
              >
                {bulkBusy && <Loader2 className="animate-spin" />}
                List the rest as pending
              </Button>
            </div>
          )}
        </>
      )}

      <input
        ref={fileInput}
        type="file"
        accept={ACCEPTED_DOCUMENT_TYPES}
        className="hidden"
        onChange={handleFile}
      />
    </Panel>
  );
}
