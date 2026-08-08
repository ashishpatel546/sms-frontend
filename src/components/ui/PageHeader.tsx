import * as React from 'react';
import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * THE LEDGER TAB — the app's signature.
 *
 * Every page opens as a page *in a file*, and the tab names the section the
 * page sits inside. It carries information rather than decorating: the label
 * mirrors the nav group you used to get here, so the tab answers "where am I"
 * without a breadcrumb trail.
 *
 * Reserved for page headers. It is not a badge.
 */
export function LedgerTab({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span className={cn('ledger-tab', className)}>
      <span aria-hidden className="ledger-tab-dot" />
      {children}
    </span>
  );
}

interface PageHeaderProps {
  /** The section this page belongs to — shown in the ledger tab. */
  section?: React.ReactNode;
  title: React.ReactNode;
  /** One line naming what's on the page. Not a sales pitch. */
  description?: React.ReactNode;
  /** Right-aligned actions. The primary action goes last. */
  actions?: React.ReactNode;
  /** A "back to the list" link, for detail and edit pages. */
  backHref?: string;
  backLabel?: string;
  /** Counts, filters or status chips shown under the title. */
  meta?: React.ReactNode;
  /** Tabs or a segmented control pinned to the bottom edge of the header. */
  tabs?: React.ReactNode;
  className?: string;
}

/**
 * The one page header. Every route renders this so titles, spacing, tab
 * placement and the actions cluster are identical everywhere — and a change
 * to page chrome is one edit.
 */
export function PageHeader({
  section,
  title,
  description,
  actions,
  backHref,
  backLabel = 'Back',
  meta,
  tabs,
  className,
}: PageHeaderProps) {
  return (
    <header
      className={cn(
        'overflow-hidden rounded-xl border border-line bg-surface shadow-soft',
        className,
      )}
    >
      {(section || backHref) && (
        <div className="flex items-center gap-3 pt-3">
          {section && <LedgerTab>{section}</LedgerTab>}
          {backHref && (
            <Link
              href={backHref}
              className="ml-auto mr-4 inline-flex items-center gap-1 text-[12.5px] font-medium text-ink-muted transition-colors hover:text-brand"
            >
              <ChevronLeft className="size-3.5" />
              {backLabel}
            </Link>
          )}
        </div>
      )}

      <div
        className={cn(
          'flex flex-col gap-3 px-4 sm:px-5 sm:flex-row sm:items-end sm:justify-between',
          section || backHref ? 'pt-3' : 'pt-4',
          tabs ? 'pb-3' : 'pb-4',
        )}
      >
        <div className="min-w-0">
          <h1 className="font-display text-[22px] leading-tight font-semibold text-ink sm:text-[26px]">
            {title}
          </h1>
          {description && (
            <p className="mt-1 text-[13.5px] text-ink-muted">{description}</p>
          )}
          {meta && (
            <div className="mt-2.5 flex flex-wrap items-center gap-2">{meta}</div>
          )}
        </div>

        {actions && (
          <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>
        )}
      </div>

      {tabs && <div className="border-t border-line px-2 sm:px-3">{tabs}</div>}
    </header>
  );
}

/**
 * The standard page frame: header, then content, on the wide measure.
 * Use `measure="reading"` for forms so labels and help text stay scannable.
 */
export function PageShell({
  children,
  className,
  measure = 'wide',
}: {
  children: React.ReactNode;
  className?: string;
  measure?: 'wide' | 'reading' | 'full';
}) {
  return (
    <div
      className={cn(
        'mx-auto w-full px-3 py-4 sm:px-5 sm:py-6',
        measure === 'wide' && 'max-w-wide',
        measure === 'reading' && 'max-w-reading',
        className,
      )}
    >
      {children}
    </div>
  );
}

/** Vertical rhythm between the blocks of a page, with the load sequence. */
export function PageBody({
  children,
  className,
  stagger = true,
}: {
  children: React.ReactNode;
  className?: string;
  stagger?: boolean;
}) {
  return (
    <div className={cn('mt-4 space-y-4', stagger && 'stagger', className)}>{children}</div>
  );
}
