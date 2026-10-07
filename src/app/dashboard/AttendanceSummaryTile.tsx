'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Lock, Sparkles, CalendarCheck2, ArrowUpRight } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useFeatureFlag } from '@/lib/useSchoolFeatures';
import { INTL_LOCALE, type Locale } from '@/i18n/config';
import { useRbac } from '@/lib/rbac';
import { attendanceSettingsApi, type AttendanceTodaySummary } from '@/lib/attendance-settings-api';
import { Skeleton } from '@/components/ui/skeleton';
import { PIGMENT_CLASS, pigmentFor } from '@/components/ui/pigment';
import { cn } from '@/lib/utils';

/**
 * Compact "today's staff attendance" tile for the main dashboard.
 *
 * Sibling of `DashboardStats` rather than a change to it — this feature is
 * gated behind `hr_portal` (a paid module) while the rest of that component
 * is not, so it needs its own loading/locked states instead of folding into
 * the unconditional stat row.
 *
 * Locked state deliberately reuses FeatureGate's visual language (tinted icon
 * square + lock badge + "See plans and upgrade" CTA, super-admin only) at a
 * size that fits a dashboard grid cell instead of a full-page block.
 *
 * Visible only to SUB_ADMIN+ — the same floor the backend's `today-summary`
 * endpoint enforces (`@MinRole(UserRole.SUB_ADMIN)` on the controller), so
 * nobody who cannot call the API is shown a tile promising it.
 */
export default function AttendanceSummaryTile() {
  const t = useTranslations('dashboard');
  const tc = useTranslations('common');
  const tu = useTranslations('ui');
  const locale = useLocale() as Locale;
  const rbac = useRbac();
  const { enabled, status } = useFeatureFlag('hr_portal');
  const [summary, setSummary] = useState<AttendanceTodaySummary | null>(null);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    if (!rbac.isSubAdmin || !enabled) return;
    let cancelled = false;
    attendanceSettingsApi
      .todaySummary()
      .then((s) => {
        if (!cancelled) setSummary(s);
      })
      .catch(() => {
        if (!cancelled) setLoadError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [rbac.isSubAdmin, enabled]);

  // School-wide staff stat — only shown to roles that would plausibly see the
  // rest of the main admin dashboard (mirrors DashboardStats' own gating,
  // one level stricter since this endpoint itself requires SUB_ADMIN+).
  if (!rbac.isSubAdmin) return null;

  // ── Loading: feature flag not resolved yet ──────────────────────────────
  if (status === 'loading') {
    return (
      <div className="rounded-xl border border-line bg-surface p-4 shadow-soft">
        <Skeleton className="h-4 w-36" />
        <div className="mt-4 grid grid-cols-3 gap-2.5 sm:grid-cols-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  // ── Locked: module not on this school's plan (or flag unreachable) ─────
  if (status === 'error' || !enabled) {
    return (
      <div className="rounded-xl border border-line bg-surface p-4 shadow-soft">
        <div className="flex items-start gap-3">
          <div className="relative size-10 shrink-0">
            <div className="grid size-10 place-items-center rounded-lg bg-surface-inset text-ink-faint [&_svg]:size-4.5">
              <CalendarCheck2 aria-hidden />
            </div>
            <span className="absolute -right-1 -bottom-1 grid size-4.5 place-items-center rounded-full border border-line bg-surface">
              <Lock className="size-2.5 text-ink-muted" aria-hidden />
            </span>
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[13.5px] font-semibold text-ink">{t('staffAttendance.lockedTitle')}</p>
            <p className="mt-0.5 text-[12px] text-ink-muted">
              {status === 'error'
                ? t('staffAttendance.planCheckFailed')
                : t('staffAttendance.higherPlan')}
            </p>
            {status !== 'error' && (
              rbac.isSuperAdmin ? (
                <Link
                  href="/dashboard/billing"
                  className="mt-2 inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-brand hover:text-brand-deep"
                >
                  <Sparkles className="size-3.5" aria-hidden />
                  {t('featureGate.seePlans')}
                </Link>
              ) : (
                <p className="mt-2 text-[11.5px] text-ink-faint">{t('staffAttendance.askSuperAdmin')}</p>
              )
            )}
          </div>
        </div>
      </div>
    );
  }

  // ── Enabled: fetch + show today's counts ────────────────────────────────
  const s = summary?.summary;
  const cells = s
    ? [
        { label: 'Present', text: tc('status.present'), value: s.PRESENT },
        { label: 'Absent', text: tc('status.absent'), value: s.ABSENT },
        // `lateArrivals` (isLate=true today), not `summary.LATE` — that
        // legacy status bucket goes stale now that auto-compute never
        // assigns it. See the field doc on AttendanceTodaySummary.
        { label: 'Late', text: tc('status.late'), value: summary?.lateArrivals ?? 0 },
        { label: 'Half day', text: tc('status.halfDay'), value: s.HALF_DAY },
        { label: 'Not marked', text: tu('stamp.notMarked'), value: s.NOT_MARKED ?? 0 },
      ]
    : [];

  return (
    <Link
      href="/dashboard/hr/staff-attendance"
      className="group block rounded-xl border border-line bg-surface p-4 shadow-soft transition-all hover:-translate-y-0.5 hover:shadow-raised"
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="grid size-8 shrink-0 place-items-center rounded-md bg-accent-info-tint text-accent-info-deep [&_svg]:size-4">
            <CalendarCheck2 aria-hidden />
          </div>
          <div>
            <p className="text-[13.5px] font-semibold text-ink leading-tight">{t('staffAttendance.title')}</p>
            {summary && (
              <p className="text-[11.5px] text-ink-muted">
                {t('staffAttendance.expected', { count: summary.totalStaff, formatted: summary.totalStaff.toLocaleString(INTL_LOCALE[locale]) })}
              </p>
            )}
          </div>
        </div>
        <ArrowUpRight
          aria-hidden
          className="size-4 shrink-0 text-ink-faint transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-brand"
        />
      </div>

      {loadError ? (
        <p className="mt-3 text-[12.5px] text-accent-danger-deep">{t('staffAttendance.loadFailed')}</p>
      ) : !summary ? (
        <div className="mt-3 grid grid-cols-3 gap-2.5 sm:grid-cols-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full rounded-lg" />
          ))}
        </div>
      ) : (
        <div className="mt-3 grid grid-cols-3 gap-2.5 sm:grid-cols-5">
          {cells.map((c) => {
            const p = PIGMENT_CLASS[pigmentFor(c.label)];
            return (
              <div key={c.label} className={cn('rounded-lg px-2 py-2 text-center', p.tint)}>
                <div className={cn('tabular text-[18px] font-semibold leading-none', p.text)}>{c.value}</div>
                <div className="mt-1 text-[10px] font-medium uppercase tracking-wide text-ink-muted">{c.text}</div>
              </div>
            );
          })}
        </div>
      )}
    </Link>
  );
}
