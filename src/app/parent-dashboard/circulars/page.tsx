'use client';

import Link from 'next/link';
import { Toaster } from 'react-hot-toast';
import { ChevronLeft } from 'lucide-react';

import { CircularFeed } from '@/components/circulars/CircularFeed';

/**
 * CIRCULARS — the parent side.
 *
 * The same feed the office reads, without the issue button. The header is the
 * portal's own (a back arrow to Home), not the staff app's ledger tab, so the
 * page belongs to the portal it lives in.
 */
export default function ParentCircularsPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-4 px-4 py-6">
      <Toaster position="top-center" />

      <div className="flex items-center gap-3">
        <Link
          href="/parent-dashboard"
          aria-label="Back to home"
          className="grid size-9 shrink-0 place-items-center rounded-xl bg-surface-secondary text-ink-muted transition-colors hover:text-brand"
        >
          <ChevronLeft className="size-4" aria-hidden />
        </Link>
        <div>
          <h1 className="font-display text-[22px] font-semibold tracking-[-0.02em] text-ink sm:text-[26px]">
            Circulars
          </h1>
          <p className="text-xs text-ink-muted">Notices issued by the school</p>
        </div>
      </div>

      <CircularFeed emptyDescription="The school has not issued any circulars yet. When it does, they will appear here and you will be notified." />
    </div>
  );
}
