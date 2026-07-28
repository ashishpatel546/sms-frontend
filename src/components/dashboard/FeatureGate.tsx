'use client';

import Link from 'next/link';
import { Lock, Sparkles } from 'lucide-react';
import { useFeatureFlag } from '@/lib/useSchoolFeatures';
import { useRbac } from '@/lib/rbac';

/**
 * Blocks a route when the school's plan does not include the module.
 *
 * Replaces the near-identical fetch-and-branch block that used to live in each
 * gated layout. Sharing `useFeatureFlag` also means the whole dashboard makes
 * one features request instead of one per gated section.
 *
 * "Not enabled" and "could not check" stay distinct on purpose: telling a
 * school their module is switched off when the API is simply unreachable sends
 * them to support for no reason.
 *
 * The locked screen is a real destination rather than a dead end — the sidebar
 * deliberately still shows these modules so schools know what exists, which
 * only works if landing here tells them how to get it.
 */
export default function FeatureGate({
  flag,
  title,
  icon,
  description,
  spinnerClass = 'border-blue-600',
  children,
}: {
  flag: string;
  /** Module name as the school knows it, e.g. "Library Management". */
  title: string;
  /** Emoji shown on the not-enabled screen. */
  icon: string;
  /** One line on what the module does, so the upsell is not abstract. */
  description?: string;
  /** Tailwind border colour for the loading spinner, to match the section. */
  spinnerClass?: string;
  children: React.ReactNode;
}) {
  const { enabled, status } = useFeatureFlag(flag);
  const rbac = useRbac();

  if (status === 'loading') {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <div
          className={`w-6 h-6 border-2 ${spinnerClass} border-t-transparent rounded-full animate-spin`}
        />
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <p className="text-red-500">
          Could not check which modules are available. Please refresh.
        </p>
      </div>
    );
  }

  if (!enabled) {
    return (
      <div className="flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-surface p-8 text-center shadow-sm">
          <div className="relative mx-auto mb-5 w-16 h-16">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100 dark:bg-surface-secondary text-3xl">
              {icon}
            </div>
            <span className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full bg-white dark:bg-surface border border-slate-200 dark:border-white/10">
              <Lock className="h-3.5 w-3.5 text-ink-muted" aria-hidden />
            </span>
          </div>

          <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100">
            {title} is not part of your plan
          </h2>

          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
            {description ??
              `${title} is available on our higher plans.`}{' '}
            We would be glad to switch it on for you.
          </p>

          {/*
            Only the super admin can act on this, so only they are told to.
            Everyone else is pointed at the person who can, which is the honest
            next step rather than a button that would fail for them.
          */}
          {rbac.isSuperAdmin ? (
            <>
              <Link
                href="/dashboard/billing"
                className="mt-6 inline-flex items-center gap-2 rounded-xl bg-brand px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-light"
              >
                <Sparkles className="h-4 w-4" aria-hidden />
                See plans and upgrade
              </Link>
              <p className="mt-3 text-xs text-slate-400">
                Or write to{' '}
                <a
                  href="mailto:support@appme.in"
                  className="underline hover:text-slate-600 dark:hover:text-slate-300"
                >
                  support@appme.in
                </a>{' '}
                and we will sort it out.
              </p>
            </>
          ) : (
            <p className="mt-6 text-xs text-slate-400">
              Ask your school&apos;s super admin to add it — they can do it from
              the Billing section.
            </p>
          )}
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
