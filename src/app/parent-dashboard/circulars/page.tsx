'use client';

import Link from 'next/link';
import { Toaster } from 'react-hot-toast';
import { ChevronLeft } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { CircularFeed } from '@/components/circulars/CircularFeed';

/**
 * CIRCULARS — the parent side.
 *
 * The same feed the office reads, without the issue button. The header is the
 * portal's own (a back arrow to Home), not the staff app's ledger tab, so the
 * page belongs to the portal it lives in.
 */
export default function ParentCircularsPage() {
  const t = useTranslations('parent.circulars');
  return (
    <div className="mx-auto max-w-2xl space-y-4 px-4 py-6">
      <Toaster position="top-center" />

      <div className="flex items-center gap-3">
        <Link
          href="/parent-dashboard"
          aria-label={t("backHome")}
          className="grid size-9 shrink-0 place-items-center rounded-xl bg-surface-secondary text-ink-muted transition-colors hover:text-brand"
        >
          <ChevronLeft className="size-4" aria-hidden />
        </Link>
        <div>
          <h1 className="font-display text-[22px] font-semibold tracking-[-0.02em] text-ink sm:text-[26px]">
            {t("title")}
          </h1>
          <p className="text-xs text-ink-muted">{t("subtitle")}</p>
        </div>
      </div>

      <CircularFeed emptyDescription={t("emptyDescription")} />
    </div>
  );
}
