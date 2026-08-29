'use client';

import * as React from 'react';
import useSWR from 'swr';
import toast from 'react-hot-toast';
import {
  AlertTriangle,
  Archive,
  ArchiveRestore,
  Download,
  ExternalLink,
  FileText,
  Loader2,
  Paperclip,
  X,
} from 'lucide-react';
import {
  archiveCircular,
  downloadCircularFile,
  fetchCircularFileUrl,
  formatFileSize,
  formatPublishedAt,
  restoreCircular,
  type Circular,
} from '@/lib/circulars-api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/Field';
import { Note } from '@/components/ui/Panel';
import { useRbac } from '@/lib/rbac';

/**
 * THE READER — a circular, opened.
 *
 * A sheet on a phone and a centred panel from `sm` up, because the two are the
 * same gesture at different sizes: the notice comes up over what you were
 * doing and goes away again. The PDF is loaded only once the reader opens —
 * a signed URL lives 15 minutes, so fetching one per row in the list would
 * burn them on circulars nobody opened.
 */
export function CircularReader({
  circular,
  onClose,
  onChanged,
}: {
  circular: Circular;
  onClose: () => void;
  /** Called after an archive/restore so the list behind can refetch. */
  onChanged?: () => void;
}) {
  const rbac = useRbac();
  const [downloading, setDownloading] = React.useState(false);
  const [confirmingArchive, setConfirmingArchive] = React.useState(false);
  const [reason, setReason] = React.useState('');
  const [working, setWorking] = React.useState(false);
  const closeRef = React.useRef<HTMLButtonElement>(null);
  const archived = !!circular.archivedAt;

  // SWR rather than an effect: the signed URL is a fetch keyed by the circular
  // being read, and SWR already owns request de-duplication and the
  // loading/error split this needs.
  const { data: file, error: fileError } = useSWR(
    circular.fileName ? ['circular-file', circular.id] : null,
    () => fetchCircularFileUrl(circular.id),
    { revalidateOnFocus: false },
  );
  const fileUrl = file?.url ?? null;

  // Escape closes, and the page behind must not scroll while the reader is up.
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeRef.current?.focus();
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [onClose]);

  const handleDownload = async () => {
    if (!circular.fileName) return;
    setDownloading(true);
    try {
      await downloadCircularFile(circular.id, circular.fileName);
    } catch {
      toast.error('Could not download the attachment.');
    } finally {
      setDownloading(false);
    }
  };

  const handleArchive = async () => {
    setWorking(true);
    try {
      await archiveCircular(circular.id, reason.trim() || undefined);
      toast.success('Circular archived — the school can no longer see it.');
      onChanged?.();
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not archive the circular.');
    } finally {
      setWorking(false);
    }
  };

  const handleRestore = async () => {
    setWorking(true);
    try {
      await restoreCircular(circular.id);
      toast.success('Circular restored — it is visible to the school again.');
      onChanged?.();
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not restore the circular.');
    } finally {
      setWorking(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="circular-reader-title"
      className="fixed inset-0 z-100 flex items-end justify-center bg-walnut-950/55 p-0 backdrop-blur-sm sm:items-center sm:p-6"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-2xl border border-line bg-surface shadow-glass sm:max-h-[88dvh] sm:max-w-3xl sm:rounded-2xl">
        {/* Grab handle — the sheet affordance, phones only. */}
        <div aria-hidden className="grid shrink-0 place-items-center pt-2 sm:hidden">
          <span className="h-1 w-9 rounded-full bg-line-strong" />
        </div>

        <header className="flex shrink-0 items-start gap-3 border-b border-line px-4 py-3 sm:px-5 sm:py-4">
          <div className="min-w-0 flex-1">
            <p className="eyebrow">Circular</p>
            <h2
              id="circular-reader-title"
              className="mt-0.5 font-display text-[17px] leading-snug font-semibold text-ink sm:text-[20px]"
            >
              {circular.title}
            </h2>
            <p className="mt-1 text-[11.5px] text-ink-muted" suppressHydrationWarning>
              {formatPublishedAt(circular.publishedAt)}
              {circular.createdByName ? ` · Issued by ${circular.createdByName}` : ''}
            </p>
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="grid size-9 shrink-0 cursor-pointer place-items-center rounded-md text-ink-muted transition-colors hover:bg-surface-secondary hover:text-ink focus-visible:ring-3 focus-visible:ring-brand/40 focus-visible:outline-none"
          >
            <X className="size-4" />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-5">
          {archived && (
            <Note
              className="mb-4"
              pigment="attn"
              icon={<Archive />}
              title="Archived — the school cannot see this"
            >
              Withdrawn on {formatPublishedAt(circular.archivedAt!)}.
              {circular.archiveReason ? ` Reason: ${circular.archiveReason}` : ''}
            </Note>
          )}
          <p className="text-[14px] leading-relaxed whitespace-pre-line text-ink">
            {circular.description}
          </p>

          {circular.fileName && (
            <section className="mt-5">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5 rounded-lg border border-line bg-surface-secondary px-3 py-2.5">
                <Paperclip className="size-4 shrink-0 text-brand" aria-hidden />
                <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-ink">
                  {circular.fileName}
                </span>
                <span className="font-mono text-[11px] text-ink-faint">
                  {formatFileSize(circular.fileSize)}
                </span>
              </div>

              {/* The document itself. An iframe on a laptop; on a phone the
                  built-in PDF viewer is a far better reader than a 300px-tall
                  frame, so the small screen gets a button that opens it. */}
              {fileError ? (
                <p className="mt-3 rounded-lg border border-accent-danger-edge bg-accent-danger-tint px-3 py-2.5 text-[12.5px] text-accent-danger-deep">
                  The attachment could not be loaded. Try downloading it instead.
                </p>
              ) : fileUrl ? (
                <>
                  <iframe
                    src={fileUrl}
                    title={circular.fileName}
                    className="mt-3 hidden h-[55vh] w-full rounded-lg border border-line bg-white sm:block"
                  />
                  <a
                    href={fileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-3 flex items-center justify-center gap-2 rounded-md border border-line-strong bg-surface px-3 py-2.5 text-[13.5px] font-semibold text-ink transition-colors hover:border-brand hover:bg-brand-tint hover:text-brand sm:hidden"
                  >
                    <ExternalLink className="size-4" aria-hidden />
                    Open the PDF
                  </a>
                </>
              ) : (
                <div className="mt-3 flex items-center justify-center gap-2 rounded-lg border border-line bg-surface-secondary py-8 text-[12.5px] text-ink-muted sm:h-[55vh]">
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                  Loading the attachment…
                </div>
              )}
            </section>
          )}

          {!circular.fileName && (
            <p className="mt-5 flex items-center gap-2 text-[12px] text-ink-faint">
              <FileText className="size-3.5" aria-hidden />
              No attachment on this circular.
            </p>
          )}
        </div>

        <footer className="shrink-0 border-t border-line bg-surface-secondary px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-5">
          {confirmingArchive ? (
            <div className="space-y-2.5">
              <p className="flex items-start gap-2 text-[12.5px] leading-relaxed text-ink">
                <AlertTriangle className="mt-0.5 size-4 shrink-0 text-accent-deep" aria-hidden />
                <span>
                  This withdraws the circular from every parent and staff
                  member. The text is not changed and nothing is deleted — but
                  the notification already sent when it was issued cannot be
                  recalled.
                </span>
              </p>
              <Input
                value={reason}
                onChange={(e) => setReason(e.target.value.slice(0, 300))}
                maxLength={300}
                placeholder="Reason (optional, kept for the audit trail)"
                aria-label="Reason for archiving"
              />
              <div className="flex flex-wrap items-center gap-2">
                <Button variant="destructive" onClick={() => void handleArchive()} disabled={working}>
                  {working ? <Loader2 className="animate-spin" /> : <Archive />}
                  {working ? 'Archiving…' : 'Yes, archive it'}
                </Button>
                <Button variant="ghost" onClick={() => setConfirmingArchive(false)} disabled={working}>
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              {circular.fileName && (
                <Button onClick={handleDownload} disabled={downloading}>
                  {downloading ? <Loader2 className="animate-spin" /> : <Download />}
                  {downloading ? 'Downloading…' : 'Download PDF'}
                </Button>
              )}
              {rbac.canArchiveCirculars &&
                (archived ? (
                  <Button variant="outline" onClick={() => void handleRestore()} disabled={working}>
                    {working ? <Loader2 className="animate-spin" /> : <ArchiveRestore />}
                    {working ? 'Restoring…' : 'Restore'}
                  </Button>
                ) : (
                  <Button variant="outline" onClick={() => setConfirmingArchive(true)}>
                    <Archive /> Archive
                  </Button>
                ))}
              <Button variant="ghost" className="ml-auto" onClick={onClose}>
                Close
              </Button>
            </div>
          )}
        </footer>
      </div>
    </div>
  );
}
