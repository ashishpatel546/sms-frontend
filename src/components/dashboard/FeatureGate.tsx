'use client';

import { useFeatureFlag } from '@/lib/useSchoolFeatures';

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
 */
export default function FeatureGate({
  flag,
  title,
  icon,
  spinnerClass = 'border-blue-600',
  children,
}: {
  flag: string;
  /** Module name as the school knows it, e.g. "Library Management". */
  title: string;
  /** Emoji shown on the not-enabled screen. */
  icon: string;
  /** Tailwind border colour for the loading spinner, to match the section. */
  spinnerClass?: string;
  children: React.ReactNode;
}) {
  const { enabled, status } = useFeatureFlag(flag);

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
      <div className="flex flex-col items-center justify-center min-h-[40vh] gap-4 text-center px-4">
        <div className="text-5xl">{icon}</div>
        <h2 className="text-xl font-semibold text-slate-700 dark:text-slate-200">
          {title} is not included in your plan
        </h2>
        <p className="text-slate-500 dark:text-slate-400 max-w-sm">
          Ask your school administrator to add it — they can upgrade the plan
          from the Billing section.
        </p>
      </div>
    );
  }

  return <>{children}</>;
}
