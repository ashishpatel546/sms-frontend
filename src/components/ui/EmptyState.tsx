import * as React from 'react';
import { cn } from '@/lib/utils';

/**
 * An empty screen is an invitation to act, not a shrug. Every empty state
 * names what would be here and gives the one action that creates it.
 */
export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
  compact = false,
}: {
  icon?: React.ReactNode;
  /** What isn't here yet — "No fee structures", not "No data". */
  title: React.ReactNode;
  /** Why it's empty and what to do about it. One sentence. */
  description?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
  compact?: boolean;
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center px-6 text-center',
        compact ? 'py-10' : 'py-16',
        className,
      )}
    >
      {icon && (
        <div className="mb-3.5 grid size-11 place-items-center rounded-xl border border-line bg-surface-secondary text-ink-faint [&_svg]:size-5">
          {icon}
        </div>
      )}
      <h3 className="font-display text-[16px] font-semibold text-ink">{title}</h3>
      {description && (
        <p className="mt-1.5 max-w-sm text-[13.5px] leading-relaxed text-ink-muted">
          {description}
        </p>
      )}
      {action && <div className="mt-4 flex flex-wrap items-center justify-center gap-2">{action}</div>}
    </div>
  );
}

/**
 * A failure, stated plainly. Errors don't apologise and are never vague about
 * what happened — they say what went wrong and how to get past it.
 */
export function ErrorState({
  title = 'That didn’t load',
  description,
  onRetry,
  retryLabel = 'Try again',
  className,
}: {
  title?: React.ReactNode;
  description?: React.ReactNode;
  onRetry?: () => void;
  retryLabel?: string;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-col items-center justify-center px-6 py-14 text-center', className)}>
      <div className="mb-3.5 grid size-11 place-items-center rounded-xl border border-accent-danger-edge bg-accent-danger-tint text-accent-danger-deep">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="size-5">
          <path strokeLinecap="round" d="M12 9v4M12 17h.01" />
          <path strokeLinecap="round" d="M10.3 3.9 2.4 18a2 2 0 0 0 1.7 3h15.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
        </svg>
      </div>
      <h3 className="font-display text-[16px] font-semibold text-ink">{title}</h3>
      {description && (
        <p className="mt-1.5 max-w-sm text-[13.5px] leading-relaxed text-ink-muted">{description}</p>
      )}
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-4 inline-flex h-9 cursor-pointer items-center rounded-md border border-line-strong bg-surface px-3.5 text-[13.5px] font-semibold text-ink transition-colors hover:border-brand hover:bg-brand-tint hover:text-brand"
        >
          {retryLabel}
        </button>
      )}
    </div>
  );
}
