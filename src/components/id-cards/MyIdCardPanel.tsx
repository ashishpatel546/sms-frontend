'use client';

import * as React from 'react';
import useSWR from 'swr';
import toast from 'react-hot-toast';
import { Ban, Download, IdCard as IdCardIcon } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { IdCardPreview } from '@/components/id-cards/IdCardPreview';
import {
  fetchMyIdCard,
  isIdCardRevoked,
  type IdCardBranding,
  type IdCardRow,
} from '@/lib/id-card-api';
import { downloadSingleIdCardPdf } from '@/lib/id-card-pdf';

/* ═══════════════════════════════════════════════════════════════════════════
   YOUR OWN CARD

   Everybody in the school has one and may see it: a guard, a teacher, a
   student. Nobody here can see anyone else's — `GET /id-cards/me` takes no
   id, so there is no parameter to point at another person. That is why this
   panel needs no permission check of its own beyond being signed in.

   Download IS allowed. The restriction the school asked for is on OTHER
   people's cards — the class-wide register stays at SUB_ADMIN+. Your own
   identity document is yours; the office would print it for you anyway.
   ═══════════════════════════════════════════════════════════════════════════ */

export function MyIdCardPanel({ className }: { className?: string }) {
  const { data, error, isLoading } = useSWR<{
    school: IdCardBranding;
    card: IdCardRow;
  }>('/id-cards/me', fetchMyIdCard, {
    revalidateOnFocus: false,
    // A card is not issued and then withdrawn mid-session; one fetch is plenty.
    shouldRetryOnError: false,
  });

  const [busy, setBusy] = React.useState(false);

  const download = async () => {
    if (!data) return;
    setBusy(true);
    try {
      const { droppedImages } = await downloadSingleIdCardPdf(
        data.card,
        data.school,
      );
      toast.success('Your ID card — front and back on one sheet');
      if (droppedImages) {
        toast('Your photo could not be embedded — this prints with initials.', {
          icon: '⚠️',
          duration: 6000,
        });
      }
    } catch {
      toast.error('Could not build the PDF. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  if (isLoading) {
    return (
      <div className={className}>
        <div className="bg-surface-inset h-64 w-full max-w-105 animate-pulse rounded-xl" />
      </div>
    );
  }

  /* No card is a normal state, not a failure — a parent account, or a staff
     record that was never linked. Say so plainly instead of showing an error. */
  if (error || !data) {
    return (
      <div className={className}>
        <div className="border-line bg-surface-inset flex flex-col items-center gap-2 rounded-xl border px-6 py-10 text-center">
          <IdCardIcon className="text-ink-faint size-6" aria-hidden />
          <p className="text-ink text-[14px] font-medium">
            No ID card is issued for your account
          </p>
          <p className="text-ink-muted max-w-sm text-[12.5px]">
            Cards are issued to students and staff. If you think this is wrong,
            ask the school office to check your profile.
          </p>
        </div>
      </div>
    );
  }

  /* A revoked card is shown rather than hidden, and the download is taken
     away. Hiding it would leave someone wondering where their card went;
     letting them print it would hand them plastic the gate refuses, which
     they would only discover at the gate. */
  if (isIdCardRevoked(data.card)) {
    return (
      <div className={className}>
        <IdCardPreview row={data.card} school={data.school} />
        <div className="border-accent-danger-edge bg-accent-danger-tint mt-3 flex gap-2.5 rounded-xl border p-3">
          <Ban
            className="text-accent-danger-deep mt-0.5 size-4 shrink-0"
            aria-hidden
          />
          <div className="text-[12.5px] leading-relaxed">
            <p className="text-accent-danger-deep font-semibold">
              This card has been cancelled
            </p>
            <p className="text-ink-muted mt-1">
              {data.card.revokedReason
                ? `Recorded reason: ${data.card.revokedReason}. `
                : ''}
              It will not be accepted at the gate and cannot be downloaded. Ask
              the school office to issue a new one.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={className}>
      <IdCardPreview row={data.card} school={data.school} />
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Button size="sm" onClick={() => void download()} disabled={busy}>
          <Download className="size-3.5" aria-hidden />
          {busy ? 'Preparing…' : 'Download my card'}
        </Button>
        <p className="text-ink-muted text-[11.5px]">
          Prints at 85.6 × 54 mm — the standard card size.
        </p>
      </div>
    </div>
  );
}

export default MyIdCardPanel;
