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
  children,
}: {
  flag: string;
  /** Module name as the school knows it, e.g. "Library Management". */
  title: string;
  /** Icon for the not-enabled screen — the same one the module uses in the rail. */
  icon: React.ReactNode;
  /** One line on what the module does, so the upsell is not abstract. */
  description?: string;
  children: React.ReactNode;
}) {
  const { enabled, status } = useFeatureFlag(flag);
  const rbac = useRbac();

  if (status === 'loading') {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <div className="size-6 animate-spin rounded-full border-2 border-brand border-t-transparent" />
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <p className="text-[13.5px] font-medium text-accent-danger-deep">
          We couldn&apos;t check which modules your school has. Refresh to try again.
        </p>
      </div>
    );
  }

  if (!enabled) {
    return (
      <div className="flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md rounded-xl border border-line bg-surface p-8 text-center shadow-soft">
          <div className="relative mx-auto mb-5 size-14">
            <div className="grid size-14 place-items-center rounded-xl bg-brand-tint text-brand [&_svg]:size-6">
              {icon}
            </div>
            <span className="absolute -right-1 -bottom-1 grid size-6 place-items-center rounded-full border border-line bg-surface">
              <Lock className="size-3 text-ink-muted" aria-hidden />
            </span>
          </div>

          <h2 className="font-display text-[17px] font-semibold text-ink">
            {`${title} isn’t part of your plan`}
          </h2>

          <p className="mt-2 text-[13.5px] text-ink-muted">
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
                className="mt-6 inline-flex h-10 items-center gap-2 rounded-md bg-brand px-4 text-[13.5px] font-semibold text-brand-contrast shadow-soft transition-all hover:bg-brand-deep hover:shadow-brand"
              >
                <Sparkles className="size-4" aria-hidden />
                See plans and upgrade
              </Link>
              <p className="mt-3 text-[12px] text-ink-faint">
                Or write to{' '}
                <a
                  href="mailto:support@appme.in"
                  className="underline hover:text-ink-muted"
                >
                  support@appme.in
                </a>{' '}
                and we will sort it out.
              </p>
            </>
          ) : (
            <p className="mt-6 text-[12px] text-ink-faint">
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
