import * as React from 'react';
import { Panel, PanelBody, PanelHeader } from './Panel';
import { PageBody, PageHeader, PageShell } from './PageHeader';
import { StatusChip } from './StatusChip';
import { cn } from '@/lib/utils';

/* ═══════════════════════════════════════════════════════════════════════════
   THE PERSON PROFILE

   Students and staff are the same page: a name, a status, a back link, an
   edit action, then a stack of labelled read-only fields. Both routes used to
   hand-write that shell and ~40 identical label/value blocks each, which is
   how their headers drifted — the student record had no way back on a phone
   long after the staff one did.

   One shell now, so a fix to the chrome lands on both:
     <ProfileShell>   page frame, header, back + actions
     <ProfileSection> a titled block of fields
     <ReadField>      one label/value pair

   Read-only by construction: nothing here takes an onChange. Editing lives on
   the /edit routes.
   ═══════════════════════════════════════════════════════════════════════════ */

interface ProfileShellProps {
  /** Ledger tab — the nav group this record belongs to. */
  section?: React.ReactNode;
  title: React.ReactNode;
  /** The identity line under the name — "Student ID: 101". */
  subtitle?: React.ReactNode;
  /** Domain status word; resolved to a pigment by StatusChip. */
  status?: string | null;
  /** Where "Back" goes. Rendered by PageHeader, so it survives every width. */
  backHref: string;
  backLabel?: string;
  /**
   * Buttons for the actions cluster — Edit, Mark Exit. Callers inline their own
   * permission checks; pass nothing and the cluster disappears.
   */
  actions?: React.ReactNode;
  children: React.ReactNode;
}

export function ProfileShell({
  section,
  title,
  subtitle,
  status,
  backHref,
  backLabel = 'Back',
  actions,
  children,
}: ProfileShellProps) {
  return (
    <PageShell>
      <PageHeader
        section={section}
        title={title}
        description={subtitle}
        backHref={backHref}
        backLabel={backLabel}
        meta={status ? <StatusChip status={status} size="md" /> : undefined}
        actions={actions}
      />
      <PageBody>{children}</PageBody>
    </PageShell>
  );
}

/**
 * A titled block of fields. `cols` is the widest the grid ever gets — it steps
 * down to one column on a phone, because two 130px columns of Aadhaar numbers
 * is not a layout.
 */
export function ProfileSection({
  title,
  description,
  action,
  cols = 3,
  className,
  children,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  cols?: 1 | 2 | 3 | 4;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <Panel>
      <PanelHeader title={title} description={description} action={action} />
      <PanelBody>
        <dl
          className={cn(
            'grid gap-x-6 gap-y-5',
            cols === 1 && 'grid-cols-1',
            cols === 2 && 'grid-cols-1 sm:grid-cols-2',
            cols === 3 && 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
            cols === 4 && 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4',
            className,
          )}
        >
          {children}
        </dl>
      </PanelBody>
    </Panel>
  );
}

/**
 * One label/value pair. Values wrap rather than overflow — an email address is
 * a single unbreakable token and used to push the whole page sideways.
 */
export function ReadField({
  label,
  value,
  span,
  className,
}: {
  label: React.ReactNode;
  /** `null`/`undefined`/`''` all render the em dash. */
  value?: React.ReactNode;
  /** Widen the field across the grid — for an address line. */
  span?: 2 | 'full';
  className?: string;
}) {
  const empty = value === null || value === undefined || value === '';
  return (
    <div
      className={cn(
        'min-w-0',
        span === 2 && 'sm:col-span-2',
        span === 'full' && 'col-span-full',
        className,
      )}
    >
      <dt className="eyebrow text-[10px]">{label}</dt>
      <dd
        className={cn(
          'mt-0.5 text-[14px] break-words',
          empty ? 'text-ink-faint' : 'font-medium text-ink',
        )}
      >
        {empty ? '—' : value}
      </dd>
    </div>
  );
}

/** A date value, formatted once so the two profiles can't disagree. */
export function formatDate(value?: string | Date | null): string | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toLocaleDateString('en-IN');
}

/** A rupee value, or null when there is nothing to show. */
export function formatMoney(value?: number | string | null): string | null {
  if (value === null || value === undefined || value === '') return null;
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isNaN(n) ? null : `₹${n.toLocaleString('en-IN')}`;
}
