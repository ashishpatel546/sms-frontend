'use client';

import { Info } from 'lucide-react';

/**
 * Explains a feature the school has not enabled.
 *
 * The parent portal deliberately keeps these sections visible rather than
 * hiding them: a parent who cannot find online payment assumes the app is
 * broken, whereas a parent who is told the school has not switched it on knows
 * exactly what to ask for. The wording points them at the school without
 * suggesting the school has done anything wrong — they are our customer's
 * customer, and the request should feel reasonable to make.
 */
export default function FeatureNotAvailableNotice({
  title,
  description,
  className = '',
}: {
  /** The feature as a parent would name it, e.g. "Online fee payment". */
  title: string;
  /** One line on what they would be able to do if it were enabled. */
  description?: string;
  className?: string;
}) {
  return (
    <div
      className={`rounded-xl border border-slate-200 bg-slate-50/80 dark:border-white/10 dark:bg-white/5 p-4 flex gap-3 ${className}`}
    >
      <Info className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" aria-hidden />
      <div>
        <p className="text-sm font-medium text-ink">
          {title} is not available yet
        </p>
        <p className="text-xs text-ink-muted mt-1">
          {description ? `${description} ` : ''}
          Your school has not enabled this feature. If it would be useful to
          you, do mention it to the school office — they can turn it on for
          everyone.
        </p>
      </div>
    </div>
  );
}
